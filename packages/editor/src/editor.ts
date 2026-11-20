// The editor's state: the open chart, its history (every change is an operation from @crownline/ops), and
// the engine's latest result. Each change schedules a build in the worker; only the newest result is shown.
import type { ChartDoc, Problem } from "@crownline/schema";
import type { Issue, Lock } from "@crownline/engine";
import { diff, History, type Op, type Patch } from "@crownline/ops";
import type { Layout } from "@crownline/viewer/layout";
import type { Built, FromWorker, ToWorker } from "./engine.worker.ts";
import { fontChoice, dumpLock } from "@crownline/engine";
import { loadChart, startEngine } from "./load.ts";
import { ChangedOnDisk, type Store } from "./store.ts";

/** what history holds: the document and its lock (moving a card in frozen mode changes the lock) */
export interface State { doc: ChartDoc; lock: Lock | null }

/** asked when the files changed on disk and there are unsaved changes: take theirs (true), keep ours (false), later (null) */
type Ask = () => Promise<boolean | null>;
/** what a change on disk did: nothing new, brought in, ours kept, or left for later */
type Outside = "same" | "loaded" | "kept" | "deferred";

/** a document as Save writes it (2-space JSON, a final newline) */
const docText = (doc: ChartDoc) => JSON.stringify(doc, null, 2) + "\n";

/** a patch's paths, put under one key of the history's state */
const under = (key: keyof State, patch: Patch): Patch => patch.map(st => ({ ...st, path: [key, ...st.path] }));

export interface Result {
  html: string | null;
  layout: Layout | null;
  issues: Issue[];
  problems: Problem[];
  placed: string[];
  ms: number;
  /** why there is no new page (the document has errors, or the engine failed) */
  failed: string | null;
  /** where everything is on the page shown, as a lock */
  lock: Lock | null;
}

type Listener = (what: "doc" | "result" | "select" | "saved") => void;

export class Editor {
  readonly history: History<State>;
  result: Result = { html: null, layout: null, issues: [], problems: [], placed: [], ms: 0, failed: null, lock: null };
  /** where everything was when the chart was opened or last saved: the position diff compares the page with it */
  baseline: Lock | null = null;
  selected: string | null = null;
  /** frozen mode (Phase 7c): lay out from the lock, so an edit moves only what it must */
  frozen: boolean;
  /** the UI language for text fields: the document's default */
  lang: string;
  private worker: Worker;
  private seq = 0;
  private shownSeq = 0;
  private timer = 0;
  /** a build is waiting for the typing to stop */
  private scheduled = false;
  private listeners = new Set<Listener>();
  private probes = new Map<number, (m: FromWorker) => void>();
  private probeSeq = 0;
  building = false;

  /** the lock file as last saved (or opened): Save writes the lock only when it changed */
  private savedLock: string | null;
  /** the document as last read or written, as Save writes it: a file on disk that differs was changed elsewhere */
  private diskDoc: string;

  private constructor(readonly store: Store, readonly chartPath: string, doc: ChartDoc, lock: Lock | null, worker: Worker) {
    this.history = new History<State>({ doc, lock });
    this.savedLock = lock ? dumpLock(lock) : null;
    this.diskDoc = docText(doc);
    this.frozen = lock !== null;
    this.lang = doc.meta.defaultLang;
    this.worker = worker;
    this.worker.onmessage = (e: MessageEvent<FromWorker>) => this.received(e.data);
    this.history.on(() => {
      if (!this.lock) this.frozen = false;                  // the lock was undone (Keep this layout, undone)
      this.emit("doc"); this.schedule();
    });
  }

  get doc(): ChartDoc { return this.history.doc.doc; }
  get lock(): Lock | null { return this.history.doc.lock; }
  get lockPath(): string { return this.chartPath.replace(/chart\.json$/, "layout.lock.json"); }

  /** open a chart: the document, its lock, and the files the engine needs (fonts, map data, the file list) */
  static async open(store: Store, chartPath: string): Promise<Editor> {
    const l = await loadChart(store, chartPath);
    const ed = new Editor(store, chartPath, l.doc, l.lock, startEngine(chartPath, l));
    for (const f of l.files) ed.files.add(f);
    for (const f of Object.keys(l.fonts)) ed.fonts.add(f);
    ed.build();
    return ed;
  }

  /** the editor is closed (the app went back to the view or the library): its engine stops */
  close(): void { clearTimeout(this.timer); this.worker.terminate(); this.listeners.clear(); }

  on(fn: Listener): () => void { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  private emit(what: Parameters<Listener>[0]): void { for (const fn of this.listeners) fn(what); }

  /** apply an operation (undoable); `key` merges quick edits of one field into one step */
  run(op: Op, key?: string): void { this.history.run({ ...op, patch: under("doc", op.patch) }, key); }

  /** change the lock (frozen mode: where boxes stay); undoable like any edit */
  runLock(label: string, patch: Patch): void { if (this.lock) this.history.run({ label, patch: under("lock", patch) }); }

  select(id: string | null): void {
    if (id === this.selected) return;
    this.selected = id && this.doc.people[id] ? id : null;
    this.emit("select");
  }

  setFrozen(on: boolean): void { this.frozen = on && this.lock !== null; this.build(); }

  /** lay a version out without showing it (a re-layout proposal): the page, the layout and its lock */
  probe(doc: ChartDoc, lock: Lock | null): Promise<FromWorker> {
    const seq = -(++this.probeSeq);                       // its own numbers: the shown builds' order is not touched
    return new Promise(resolve => {
      this.probes.set(seq, resolve);
      const msg: ToWorker = { type: "build", seq, doc, lock, probe: true };
      this.worker.postMessage(msg);
    });
  }

  /** a chart without a lock: take the layout on screen as its lock, so edits keep it (frozen mode). Undoable;
   *  Save writes layout.lock.json */
  makeLock(): void {
    if (this.lock || !this.result.lock) return;
    this.history.run({ label: "Keep this layout (make the lock)", patch: [{ op: "set", path: ["lock"], value: structuredClone(this.result.lock) }] });
    this.frozen = true;
    this.build();
  }

  /** build soon: edits in quick succession (typing) give one build */
  private schedule(): void {
    clearTimeout(this.timer);
    this.scheduled = true;
    this.timer = window.setTimeout(() => this.build(), 120);
  }

  /** the fonts the worker has; a document that asks for others (the style panel) has them fetched first */
  private fonts = new Set<string>();
  private fetching: Promise<void> | null = null;

  private missingFonts(): string[] {
    try {
      const c = fontChoice(this.doc, false);
      return [c.regular, c.bold, c.script, c.secondScript].filter((f): f is string => !!f && !this.fonts.has(f));
    } catch { return []; }                                  // an unknown font: the build will say so
  }

  /** tell the engine that files now exist (an imported portrait or emblem) */
  /** the files under assets/ and charts/ (as the engine is told), so an import does not overwrite another's */
  readonly files = new Set<string>();

  addFiles(paths: string[]): void {
    for (const p of paths) this.files.add(p);
    const m: ToWorker = { type: "more", files: paths };
    this.worker.postMessage(m);
  }

  /** write an imported file (a picture, a crops.json) into the project */
  async putAsset(path: string, body: Blob | string): Promise<void> {
    await this.store.write(path, body);
    this.addFiles([path]);
  }

  build(): void {
    clearTimeout(this.timer);
    this.scheduled = false;
    const need = this.missingFonts();
    if (need.length) {
      this.fetching ??= Promise.all(need.map(async f => [f, await (await this.store.read(f)).arrayBuffer()] as const)).then(got => {
        const m: ToWorker = { type: "more", fonts: Object.fromEntries(got) };
        this.worker.postMessage(m, got.map(([, b]) => b));
        for (const [f] of got) this.fonts.add(f);
      }).catch(() => { for (const f of need) this.fonts.add(f); })    // not fetched: the build says which font is missing
        .finally(() => { this.fetching = null; this.build(); });
      return;
    }
    const msg: ToWorker = { type: "build", seq: ++this.seq, doc: this.doc, lock: this.frozen ? this.lock : null };
    this.building = true;
    this.worker.postMessage(msg);
    this.emit("result");
  }

  private received(m: FromWorker): void {
    if (m.probe) { this.probes.get(m.seq)?.(m); this.probes.delete(m.seq); return; }
    if (m.seq < this.shownSeq) return;                // an older build finished after a newer one
    this.shownSeq = m.seq;
    this.building = m.seq !== this.seq;
    if (m.type === "built") {
      const b = m as Built;
      this.result = { html: b.html, layout: b.layout as Layout, issues: b.issues, problems: b.problems, placed: b.placed, ms: b.ms, failed: null, lock: b.lock };
      this.baseline ??= this.lock ? structuredClone(this.lock) : b.lock;
    } else {
      // keep the last good page on screen; say why it is not new
      this.result = { ...this.result, problems: m.problems, failed: m.message, issues: m.problems.length ? [] : this.result.issues };
    }
    if (this.selected && !this.doc.people[this.selected]) this.selected = null;
    this.emit("result");
  }

  /** write the chart file, then the lock if it changed; `check`: only over what the editor last saw. Each is put
   *  back in the bookkeeping only if its own write failed (one that was written is on disk) */
  private async writeFiles(text: string, lock: string | null, check: boolean): Promise<void> {
    const wasDoc = this.diskDoc, wasLock = this.savedLock;
    if (text !== wasDoc || !check) {
      this.diskDoc = text;
      try { await this.store.write(this.chartPath, text, check ? wasDoc : undefined); } catch (e) { this.diskDoc = wasDoc; throw e; }
    }
    if (lock !== this.savedLock) {
      // a lock undone after it was saved ("Keep this layout", undone) goes from the project too
      this.savedLock = lock;
      try {
        if (lock === null) await this.store.remove(this.lockPath, check ? wasLock : undefined);
        else await this.store.write(this.lockPath, lock, check ? wasLock : undefined);
      } catch (e) { this.savedLock = wasLock; throw e; }
    }
  }

  /** the files changed on disk (a model's batch, or a person's edit; PLAN 8.5): bring them in as one step that
   *  can be undone. With unsaved changes here, `ask` decides: true takes theirs (ours stay in the history, one
   *  Undo away), false keeps ours (Save will write over theirs). Says what happened */
  async reload(ask: Ask): Promise<Outside> {
    await this.saving;
    return this.merge(ask);
  }

  /** asks, when the files on disk differ from what was read or written last and there are unsaved changes here:
   *  true takes theirs, false keeps ours, null decides later (Save asks again). Set by the page */
  ask: Ask | null = null;

  /** the files as they are on disk: the document's text and the lock's (null: there is none). A lock that cannot
   *  be read (half written, or broken) is an error, not "no lock": that would throw the kept layout away */
  private async readDisk(): Promise<{ doc: ChartDoc; lock: Lock | null; text: string; lockText: string | null }> {
    const doc = JSON.parse(await (await this.store.read(this.chartPath)).text()) as ChartDoc;
    let lock: Lock | null = null;
    let raw: string | null = null;
    try { raw = await (await this.store.read(this.lockPath)).text(); }
    catch (e) { if (!/HTTP 404$|is not in the folder|was not in the uploaded folder/.test((e as Error).message)) throw e; }
    if (raw !== null) {
      try { lock = JSON.parse(raw); } catch (e) { throw new Error(`${this.lockPath} cannot be read (${(e as Error).message})`); }
      delete (lock as unknown as Record<string, unknown>).$schema;
    }
    return { doc, lock, text: docText(doc), lockText: lock ? dumpLock(lock) : null };
  }

  private async merge(ask: Ask): Promise<Outside> {
    const { doc, lock, text, lockText } = await this.readDisk();
    if (text === this.diskDoc && lockText === this.savedLock) return "same";
    if (this.history.dirty) {
      const take = await ask();
      if (take === null) return "deferred";                           // asked again on the next change, or by Save
      if (!take) {
        // ours stays, unsaved even if undone to where it was saved: the file on disk is no state in this history
        this.diskDoc = text; this.savedLock = lockText;
        this.history.markSaved(Number.MAX_SAFE_INTEGER);
        return "kept";
      }
    }
    const patch = diff(this.history.doc, { doc, lock });
    const hadLock = this.lock !== null;
    if (patch.length) this.history.run({ label: "Changed outside the editor", patch });
    this.diskDoc = text; this.savedLock = lockText;
    this.history.markSaved();
    if (lock && !hadLock) this.frozen = true;
    this.baseline = null;                                             // Moves compares with the page as it is on disk
    this.build();
    this.emit("saved");
    return "loaded";
  }

  /** write the document back to its file, as the repository keeps it (2-space JSON, a final newline) */
  async save(): Promise<void> {
    const run = this.saving.then(() => this.write());            // one save at a time, in order
    this.saving = run.catch(() => {});
    return run;
  }
  private saving: Promise<void> = Promise.resolve();

  private async write(): Promise<void> {
    // the files changed on disk since they were read or written (a model's batch, moments ago): never write over
    // that unasked. Taking theirs, or deciding later, is no save
    if (this.ask && this.store.kind !== "upload") {
      const r = await this.merge(this.ask);
      if (r === "loaded") throw new Error("the chart had changed on disk: that version is now open (Undo brings yours back), and nothing was written");
      if (r === "deferred") throw new Error("the chart changed on disk: choose which version to keep");
    }
    // the document as it is now; what is typed while the files are written stays unsaved
    const at = this.history.seal(), text = docText(this.doc);
    const lock = this.lock ? dumpLock(this.lock) : null, current = this.building || this.scheduled ? null : this.result;
    // what the files will say, known before they are written: the server's word that they changed is then ours
    // each file is written only if it is still what the editor last saw (the server checks, under the lock the
    // crownline tools take too); refused, the change on disk is brought in or kept as above, and a kept one (or a
    // file that differs only in its formatting) is then written over, once
    for (let attempt = 0; ; attempt++) {
      try { await this.writeFiles(text, lock, attempt === 0); break; }
      catch (e) {
        if (!(e instanceof ChangedOnDisk) || attempt > 0 || !this.ask) throw e;
        const r = await this.merge(this.ask);
        if (r === "loaded") throw new Error("the chart had changed on disk: that version is now open (Undo brings yours back), and nothing more was written");
        if (r === "deferred") throw new Error("the chart changed on disk: choose which version to keep");
      }
    }
    this.history.markSaved(at);
    await this.store.saved?.(this.chartPath);                    // the demo site: the chart's folder, downloaded
    // what Moves compares with: the page as saved (when it is still being drawn, the page that comes next)
    if (current?.lock && !current.failed) this.baseline = current.lock; else if (!current) this.baseline = null;
    this.emit("saved");
  }
}

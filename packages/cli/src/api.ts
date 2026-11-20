// What the command line and the MCP server do (PLAN Phase 8): each function takes a chart and typed input and
// returns plain data; the two front-ends only format it. Every change goes through the operation registry
// (registry.ts), is validated and laid out before it is saved, and is journalled so it can be undone.
//
// Guardrails (PLAN 8.3): a batch is all or nothing; a batch that adds layout errors is not saved unless asked;
// the document is validated as the editor validates it; a stale write (the file changed since it was read) is
// refused when the caller passes the hash it read; files are written whole and renamed into place; with a kept
// layout (layout.lock.json) the chart is laid out from it, so an edit moves only what it must.
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { closeSync, existsSync, mkdirSync, openSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { Value } from "@sinclair/typebox/value";
import { compose, dumpLock, headerPanel, lockOf, render, type Issue } from "@crownline/engine";
import { envFor } from "@crownline/engine/node";
import { format, validate, validateLock, type ChartDoc, type LockT } from "@crownline/schema";
import { apply as applyPatch, diff as patchDiff, type Patch } from "@crownline/ops";
import { BY_NAME, OPS } from "./registry.ts";

export const ROOT = fileURLToPath(new URL("../../../", import.meta.url));

export class UserError extends Error {}
/** refused because the files changed meanwhile: not a mistake in the command (the command line exits 1) */
export class Conflict extends UserError {}
const fail = (msg: string): never => { throw new UserError(msg); };

// ------------------------------------------------------------------------------------------ opening
export interface Opened {
  /** the chart's folder and its chart.json, absolute; `rel` as typed in messages (from the repository) */
  dir: string; path: string; rel: string;
  doc: ChartDoc; lock: LockT | null;
  /** the files as read: a change to either changes the hash */
  hash: string;
}

/** a chart by id (wangsa-mataram), folder (charts/tokugawa) or file (charts/tokugawa/chart.json): only a chart
 *  in the charts/ folder of `base` (the repository) */
export function open(chart: string, base = ROOT): Opened {
  if (!chart) fail("which chart? give its id (wangsa-mataram), its folder or its chart.json");
  const tries = [chart, join("charts", chart)].map(c => resolve(base, c)).map(p => (p.endsWith(".json") ? p : join(p, "chart.json")));
  const path = tries.find(p => existsSync(p) && statSync(p).isFile());
  if (!path) fail(`no chart "${chart}": try ${listCharts(base).map(c => c.id).join(", ") || "a path to a chart.json"}`);
  const rel = relative(join(base, "charts"), path!).split(sep);
  if (rel.length !== 2 || rel[0] === ".." || isAbsolute(rel.join(sep)) || rel[1] !== "chart.json")
    fail(`${chart} is not a chart in charts/: only charts/<id>/chart.json can be opened (crownline charts lists them)`);
  return read(path!, base);
}

function read(path: string, base: string): Opened {
  const dir = dirname(path), lockPath = join(dir, "layout.lock.json");
  const docText = readFileSync(path, "utf8"), lockText = existsSync(lockPath) ? readFileSync(lockPath, "utf8") : null;
  let doc: ChartDoc;
  try { doc = JSON.parse(docText); } catch (e) { return fail(`${relative(base, path)} is not JSON: ${(e as Error).message}`); }
  if (!doc || typeof doc !== "object" || !("meta" in doc) || !("people" in doc)) fail(`${relative(base, path)} is not a chart document (no meta and people)`);
  let lock: LockT | null = null;
  if (lockText !== null) {
    try { lock = JSON.parse(lockText); } catch (e) { return fail(`${relative(base, lockPath)} is not JSON: ${(e as Error).message}`); }
    const bad = validateLock(lock!).errors.map(format);
    if (bad.length) fail(`${relative(base, lockPath)}: ${bad.join("; ")}`);
    delete (lock as unknown as Record<string, unknown>).$schema;
  }
  return { dir, path, rel: relative(base, path).split(sep).join("/"), doc, lock, hash: hashOf(docText, lockText) };
}

export const hashOf = (doc: string, lock: string | null) => createHash("sha256").update(doc).update("\0").update(lock ?? "").digest("hex").slice(0, 12);

/** the files' hash as they are on disk now */
function diskHash(o: Opened): string {
  const lockPath = join(o.dir, "layout.lock.json");
  return hashOf(readFileSync(o.path, "utf8"), existsSync(lockPath) ? readFileSync(lockPath, "utf8") : null);
}

/** one writer at a time per chart (an apply or an undo from another process: a second model, the command line),
 *  through a lock file in .crownline/; inside it, `fn` must check the files are still the ones it read. A lock
 *  left by a process that died is taken over after a minute */
function exclusive<T>(o: Opened, fn: () => T): T {
  const dir = join(o.dir, ".crownline"), file = join(dir, "writing");
  mkdirSync(dir, { recursive: true });
  const until = Date.now() + 15_000;
  for (;;) {
    try { closeSync(openSync(file, "wx")); break; }
    catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
      try { if (Date.now() - statSync(file).mtimeMs > 60_000) { rmSync(file, { force: true }); continue; } } catch { continue; }
      if (Date.now() > until) fail("another change to this chart is still being written: try again in a moment");
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50);
    }
  }
  try { return fn(); } finally { rmSync(file, { force: true }); }
}

/** refused when the files changed since they were read (the editor saved, or another batch landed meanwhile) */
const unchanged = (o: Opened, what: string) => {
  if (diskHash(o) !== o.hash) throw new Conflict(`the chart changed on disk while ${what} (the editor saved, or another batch was applied): read it again and try again`);
};

export function listCharts(base = ROOT): { id: string; path: string; title: string }[] {
  const dir = join(base, "charts");
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter(d => existsSync(join(dir, d, "chart.json"))).sort().map(d => {
      try { const doc = JSON.parse(readFileSync(join(dir, d, "chart.json"), "utf8")); return { id: d, path: `charts/${d}/chart.json`, title: name(doc.meta.title, doc.meta.defaultLang) }; }
      catch { return { id: d, path: `charts/${d}/chart.json`, title: "(cannot be read)" }; }
    });
}

// ------------------------------------------------------------------------------------------ building
export interface Built {
  /** null: laid out; else why not (the document is invalid, or the layout failed) */
  failed: string[] | null;
  lock: LockT | null;
  canvas: [number, number];
  html: string;
  issues: Issue[];
  errors: string[]; warnings: string[];
  /** warnings the chart's acceptedWarnings cover */
  accepted: string[];
  /** people not in the lock, placed by their locked relatives */
  placed: string[];
}

/** validate and lay out a version of the chart, from its lock when `frozen` and it has one */
export function build(o: Pick<Opened, "path">, doc: ChartDoc, lock: LockT | null, frozen = true): Built {
  const none: Built = { failed: null, lock: null, canvas: [0, 0], html: "", issues: [], errors: [], warnings: [], accepted: [], placed: [] };
  const v = validate(doc);
  if (v.errors.length) return { ...none, failed: v.errors.map(format) };
  try {
    const env = envFor(doc as never, o.path, { root: ROOT });
    const c = compose(doc as never, env, headerPanel(doc as never), frozen ? lock as never : null);
    const page = render(doc as never, env, c);
    const acc = Object.values(doc.acceptedWarnings ?? {}).map(a => a.match);
    const accepted = page.report.warnings.filter(w => acc.some(m => w.includes(m)));
    return { failed: null, lock: lockOf(doc as never, c, page) as unknown as LockT, canvas: [c.canvas.W, c.canvas.HGT], html: page.html,
      issues: page.report.issues, errors: page.report.errors, warnings: page.report.warnings.filter(w => !accepted.includes(w)), accepted, placed: c.placed };
  } catch (e) {
    return { ...none, failed: [`the chart cannot be laid out: ${(e as Error).message}`] };
  }
}

// ------------------------------------------------------------------------------------------ reading
const name = (t: unknown, lang: string): string => typeof t === "string" ? t : t && typeof t === "object" ? ((t as Record<string, string>)[lang] ?? Object.values(t)[0] ?? "") : "";
const fold = (s: string) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function describe(o: Opened) {
  const d = o.doc, L = d.meta.defaultLang, b = build(o, d, o.lock);
  const years = Object.values(d.people).map(p => p.show.year).filter((y): y is number => y !== undefined);
  const count = (h: string) => Object.values(d.people).filter(p => p.house === h).length;
  return {
    chart: o.rel, id: d.meta.id, title: name(d.meta.title, L), hash: o.hash, languages: d.meta.languages,
    counts: { people: Object.keys(d.people).length, unions: Object.keys(d.unions ?? {}).length, lines: Object.keys(d.descents ?? {}).length,
      notes: Object.keys(d.notes ?? {}).length, adjustments: Object.keys(d.adjustments ?? {}).length },
    houses: Object.entries(d.houses).map(([id, h]) => ({ id, name: name(h.name, L), colour: h.colour, people: count(id) })),
    years: years.length ? [Math.min(...years), Math.max(...years)] : null,
    eras: (d.timeline?.eras ?? []).map(e => ({ year: e.year, name: name(e.name, L) })),
    kept_layout: o.lock !== null,
    canvas: b.canvas,
    check: b.failed ? { failed: b.failed } : { errors: b.errors.length, warnings: b.warnings.length, accepted: b.accepted.length },
  };
}

const card = (d: ChartDoc, id: string) => {
  const p = d.people[id], L = d.meta.defaultLang;
  return p ? { id, name: name(p.name, L), ...(p.title ? { title: p.title } : {}), ...(p.house ? { house: p.house } : {}),
    ...(p.show.year !== undefined ? { year: p.show.year } : {}), box: p.show.box, ...(p.show.beside ? { beside: p.show.beside.of } : {}) } : { id, name: "(missing)" };
};

export function find(o: Opened, q: { query?: string; house?: string; year?: number; limit?: number }) {
  const d = o.doc, words = fold(q.query ?? "").split(/\s+/).filter(Boolean), limit = q.limit ?? 20;
  const hits = Object.entries(d.people).filter(([id, p]) => {
    if (q.house && p.house !== q.house) return false;
    if (q.year !== undefined && (p.show.year === undefined || Math.abs(p.show.year - q.year) > 15)) return false;
    const hay = fold([id, name(p.name, d.meta.defaultLang), ...Object.values(typeof p.name === "object" ? p.name : {}), p.title ?? "",
      ...(p.aka ?? []).map(a => name(a, d.meta.defaultLang)), ...(p.variants ?? [])].join(" "));
    return words.every(w => hay.includes(w));
  }).map(([id]) => card(d, id));
  return { total: hits.length, people: hits.slice(0, limit), ...(hits.length > limit ? { more: `${hits.length - limit} more: narrow with house, year or more words` } : {}) };
}

export function readPerson(o: Opened, id: string, opts: { depth?: number } = {}) {
  const d = o.doc;
  if (!Object.prototype.hasOwnProperty.call(d.people, id)) fail(`there is no person ${id}: crownline_find finds people by name`);
  const lines = Object.entries(d.descents ?? {}), unions = Object.entries(d.unions ?? {});
  const b = build(o, d, o.lock), rect = b.lock?.boxes[id] ?? null;
  const mine = unions.filter(([, u]) => u.partners.includes(id));
  const kids = (pid: string, depth: number): unknown[] => depth <= 0 ? [] : lines
    .filter(([, l]) => l.parent === pid || (!l.parent && l.union && d.unions?.[l.union]?.partners.includes(pid)))
    .map(([lid, l]) => ({ ...card(d, l.child), line: lid, ...(l.union ? { union: l.union } : {}), ...(l.show?.line ? { style: l.show.line } : {}),
      ...(depth > 1 ? { children: kids(l.child, depth - 1) } : {}) }));
  const related = new Set([id, ...mine.map(([k]) => k), ...lines.filter(([, l]) => l.child === id || l.parent === id).map(([k]) => k)]);
  const notes = Object.entries(d.notes ?? {}).filter(([, n]) => n.anchor === id);
  for (const [k] of notes) related.add(k);
  return {
    person: { id, ...d.people[id] },
    rect,
    parents: lines.filter(([, l]) => l.child === id).map(([lid, l]) => ({ line: lid, ...(l.parent ? { parent: card(d, l.parent) } : {}),
      ...(l.union ? { union: l.union, couple: d.unions?.[l.union]?.partners.map(p => card(d, p).name) } : {}), ...(l.kind ? { kind: l.kind } : {}), ...(l.show ? { show: l.show } : {}) })),
    unions: mine.map(([uid, u]) => ({ union: uid, kind: u.kind, partner: card(d, u.partners.find(p => p !== id)!), drawn: u.partners[0] === id ? "left" : "right" })),
    children: kids(id, Math.max(1, Math.min(3, opts.depth ?? 1))),
    notes: notes.map(([k, n]) => ({ id: k, text: name(n.text, d.meta.defaultLang), show: n.show, rect: b.lock?.notes[k] ?? null })),
    adjustments: Object.entries(d.adjustments ?? {}).filter(([, a]) => related.has(a.target)).map(([k, a]) => ({ id: k, ...a })),
    issues: b.issues.filter(i => i.people.includes(id)).map(brief),
  };
}

// ------------------------------------------------------------------------------------------ checking
/** what to try first for each kind of issue: the order of local fixes (HOW_IT_WORKS §14) */
const FIXES: Record<string, string[]> = {
  "block-over-box": ["move the note: move_note dx/dy, or set notes.<id>.show.side (r, l, b, t) or show.width", "lift the label: adjust textLift", "last: move_person the smaller branch"],
  "blocks-overlap": ["move one note: move_note, or change its side or width", "last: move_person"],
  "line-through-block": ["move the note off the line: move_note", "move the line's level: adjust drop, or shareBus", "the break mark: adjust breakAt"],
  "era-line-through-block": ["move the note: move_note dy", "lift the label: adjust textLift"],
  "line-through-box": ["hang the line off the parent's line: adjust shareBus", "change the line's level: adjust drop", "last: move_person the box or the branch"],
  "lines-overlap": ["adjust drop on one line", "adjust shareBus", "last: move_person"],
  "boxes-overlap": ["move_person the smaller branch (dx), or with branch false the card alone", "a new person beside someone: try side l instead of r"],
  "no-clear-level": ["adjust drop on the line", "accept it: set acceptedWarnings.<id> {match, reason}"],
  "no-clean-line": ["move the people closer: move_person", "accept it: set acceptedWarnings.<id> {match, reason}"],
};
const brief = (i: Issue) => ({ severity: i.severity, code: i.code, message: i.message,
  ...(i.people.length ? { people: i.people } : {}), ...(i.lines.length ? { lines: i.lines } : {}), ...(i.box ? { box: i.box } : {}) });

export function check(o: Opened, q: { ids?: string[]; level?: "errors" | "all" } = {}) {
  const b = build(o, o.doc, o.lock);
  if (b.failed) return { ok: false, failed: b.failed };
  const want = (i: Issue) => (!q.ids?.length || q.ids.some(id => i.people.includes(id) || i.lines.includes(id) || i.blocks.some(x => x === id || x.split(":").pop() === id)))
    && (q.level !== "errors" || i.severity === "error") && !(i.severity === "warning" && b.accepted.includes(i.message));
  const issues = b.issues.filter(want).map(i => ({ ...brief(i), fixes: FIXES[i.code] ?? [] }));
  return { ok: b.errors.length === 0, errors: b.errors.length, warnings: b.warnings.length, accepted: b.accepted.length, placed: b.placed, issues };
}

// ------------------------------------------------------------------------------------------ changing
export interface ApplyInput {
  ops: unknown[];
  reason: string;
  dry_run?: boolean;
  allow_errors?: boolean;
  /** the hash from describe (or the last apply): refused if the files changed since */
  expected_hash?: string;
}

interface Move { id: string; dx: number; dy: number }
/** what moved between two layouts: people's boxes and inline notes, more than half a pixel */
export function moves(a: LockT | null, b: LockT | null) {
  const out = { moved: [] as Move[], notes: [] as Move[], added: [] as string[], removed: [] as string[], notes_added: [] as string[], notes_removed: [] as string[] };
  if (!a || !b) return out;
  const r = (v: number) => Math.round(v * 10) / 10;
  for (const [k, v] of Object.entries(b.boxes)) {
    const w = a.boxes[k];
    if (!w) { out.added.push(k); continue; }
    const dx = r(v[0] - w[0]), dy = r(v[1] - w[1]);
    if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) out.moved.push({ id: k, dx, dy });
  }
  for (const k of Object.keys(a.boxes)) if (!b.boxes[k]) out.removed.push(k);
  for (const [k, v] of Object.entries(b.notes)) {
    const w = a.notes[k];
    if (!w) out.notes_added.push(k);
    else if (Math.abs(v[0] - w[0]) > 0.5 || Math.abs(v[1] - w[1]) > 0.5) out.notes.push({ id: k, dx: r(v[0] - w[0]), dy: r(v[1] - w[1]) });
  }
  for (const k of Object.keys(a.notes)) if (!b.notes[k]) out.notes_removed.push(k);
  out.moved.sort((x, y) => Math.abs(y.dx) + Math.abs(y.dy) - Math.abs(x.dx) - Math.abs(x.dy));
  return out;
}

const cap = <T,>(xs: T[], n = 30) => (xs.length > n ? [...xs.slice(0, n), `… and ${xs.length - n} more`] : xs);
const docText = (d: ChartDoc) => JSON.stringify(d, null, 2) + "\n";

/** a batch of operations, one after another, on a copy of the chart: all or nothing */
function runBatch(o: Opened, ops: unknown[], reason: string) {
  const state = { doc: structuredClone(o.doc), lock: o.lock ? structuredClone(o.lock) : null };
  const labels: string[] = [], notes: string[] = [];
  let undo: Patch = [];
  ops.forEach((raw, i) => {
    const at = `operation ${i + 1}`, spec = BY_NAME.get((raw as { op?: string })?.op ?? "");
    if (!spec) fail(`${at}: unknown op "${(raw as { op?: string })?.op}"; the ops are ${OPS.map(s => s.name).join(", ")}`);
    if (!Value.Check(spec!.input, raw)) {
      const e = [...Value.Errors(spec!.input, raw)].slice(0, 3).map(e => `${e.path || "(op)"} ${e.message}`);
      fail(`${at} (${spec!.name}): ${e.join("; ")}. Example: ${JSON.stringify(spec!.example)}`);
    }
    let done;
    // (a failure part-way leaves the copy half changed: the batch as a whole is refused, so it is never saved)
    try {
      done = spec!.run({ doc: state.doc, lock: state.lock, reason }, raw as never);
      undo = [...applyPatch(state as never, done.patch), ...undo];
    } catch (e) { return fail(`${at} (${spec!.name}): ${(e as Error).message}`); }
    labels.push(done.label);
    if (done.notes) notes.push(...done.notes);
  });
  return { state, labels, notes, made: created(o.doc, state.doc), undo };
}

/** the ids a batch made, by kind (a later operation, or the next batch, refers to them) */
const KINDS = ["people", "unions", "descents", "notes", "adjustments", "houses"] as const;
function created(a: ChartDoc, b: ChartDoc): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const k of KINDS) {
    const was = (a as unknown as Record<string, Record<string, unknown> | undefined>)[k] ?? {};
    const now = Object.keys((b as unknown as Record<string, Record<string, unknown> | undefined>)[k] ?? {}).filter(id => !(id in was));
    if (now.length) out[k] = now;
  }
  return out;
}

export function applyOps(o: Opened, input: ApplyInput) {
  if (!Array.isArray(input.ops) || !input.ops.length) fail("ops: give a list of one or more operations (crownline_ops lists them)");
  if (!input.reason?.trim()) fail("reason: say why, in a few words (it is kept with the change)");
  if (input.expected_hash && input.expected_hash !== o.hash)
    throw new Conflict(`the chart changed since you read it (hash ${o.hash}, not ${input.expected_hash}): read it again before changing it`);
  // the operations, one after another, on a copy: all or nothing
  const { state, labels, notes, made, undo: opsUndo } = runBatch(o, input.ops, input.reason);
  let undo = opsUndo;
  const before = build(o, o.doc, o.lock), after = build(o, state.doc, state.lock);
  const was = new Set(before.errors), now = new Set(after.errors), wasW = new Set(before.warnings);
  const report = after.failed ? { failed: after.failed } : {
    errors: after.errors.length, warnings: after.warnings.length,
    new_errors: after.errors.filter(e => !was.has(e)), fixed_errors: before.errors.filter(e => !now.has(e)),
    new_warnings: after.warnings.filter(w => !wasW.has(w)),
    new_issues: after.issues.filter(i => (i.severity === "error" ? !was.has(i.message) : !wasW.has(i.message)) && !after.accepted.includes(i.message))
      .map(i => ({ ...brief(i), fixes: FIXES[i.code] ?? [] })),
  };
  const mv = moves(before.lock, after.lock);
  const bad = after.failed !== null || (report as { new_errors: string[] }).new_errors.length > 0;
  const save = !input.dry_run && (!bad || (Boolean(input.allow_errors) && after.failed === null));
  // the kept layout follows the batch (as "Keep this layout" would): one that passed the check is kept as checked,
  // so the people it added stay where they were placed and those it removed leave the lock. One saved with new
  // errors only loses the removed: a known collision is not pinned. Part of the batch, so undo restores the lock
  if (o.lock && state.lock && after.lock && !after.failed) {
    let kept = bad ? pruned(state.lock, after.lock) : bare(after.lock);
    // a card placed just now, laid out again from its rounded place, can come out a tenth of a pixel off: settle
    // it before it is kept, so the next layout of the saved chart gives back exactly this lock
    for (let pass = 0; !bad && pass < 3; pass++) {
      const again = build(o, state.doc, kept);
      if (again.failed || !again.lock) break;
      const next = bare(again.lock);
      if (dumpLock(next as never) === dumpLock(kept as never)) break;
      kept = next;
    }
    undo = [...applyPatch(state as never, patchDiff(state.lock, kept, ["lock"])), ...undo];
  }
  let hash = o.hash, batch: string | null = null;
  if (save) [hash, batch] = exclusive(o, () => {
    unchanged(o, "this batch was being checked");
    const j = journal(o);
    j.all();                                                            // readable, before anything is written
    const prevLock = o.lock ? dumpLock(o.lock as never) : null, nextLock = state.lock ? dumpLock(state.lock as never) : null;
    const text = docText(state.doc);
    writeBoth(o, text, nextLock !== prevLock && nextLock !== null ? nextLock : null);
    const h = diskHash(o);
    return [h, j.add({ reason: input.reason, labels, undo, redo: input.ops, before: o.hash, after: h })];
  });
  return {
    saved: save, ...(batch ? { batch } : {}), hash,
    ...(input.dry_run ? { dry_run: true } : !save ? { not_saved: after.failed ? "the document is not valid: fix the operations" : "the batch adds layout errors: fix them in the same batch (dry_run to try), or pass allow_errors" } : {}),
    changes: labels, ...(Object.keys(made).length ? { made } : {}), ...(notes.length ? { notes } : {}),
    check: report,
    moved: cap(mv.moved), ...(mv.notes.length ? { notes_moved: cap(mv.notes) } : {}), ...(mv.added.length ? { added: mv.added } : {}), ...(mv.removed.length ? { removed: mv.removed } : {}),
    ...(mv.notes_added.length ? { notes_added: mv.notes_added } : {}), ...(mv.notes_removed.length ? { notes_removed: mv.notes_removed } : {}),
    ...(after.placed.length ? { placed_by_relatives: after.placed } : {}),
    next: save ? `look at it: crownline_render around ${JSON.stringify(lookAt(made, input.ops, after.lock))}`
      : "fix and apply again; dry_run: true tries a batch without saving",
  };
}

/** a lock without its $schema line (as read: dumpLock writes it) */
const bare = (l: LockT): LockT => { const c = structuredClone(l) as LockT & { $schema?: string }; delete c.$schema; return c; };

/** a lock with only what a layout of the chart still has (the people, lines and notes a batch removed leave it) */
function pruned(lock: LockT, now: LockT): LockT {
  const out = structuredClone(lock) as unknown as Record<string, unknown>, cur = now as unknown as Record<string, unknown>;
  for (const [k, v] of Object.entries(out)) {
    const c = cur[k];
    if (!v || typeof v !== "object" || Array.isArray(v) || !c || typeof c !== "object" || Array.isArray(c)) continue;
    for (const id of Object.keys(v)) if (!Object.prototype.hasOwnProperty.call(c, id)) delete (v as Record<string, unknown>)[id];
  }
  return out as unknown as LockT;
}

/** what to look at after a batch: the people and inline notes it made, else the people its operations name */
function lookAt(made: Record<string, string[]>, ops: unknown[], lock: LockT | null): string[] {
  const on = (id: string) => Boolean(lock && (lock.boxes[id] || lock.notes[id]));
  const ids = [...(made.people ?? []), ...(made.notes ?? [])].filter(on);
  if (ids.length) return ids.slice(0, 4);
  const named = (ops as Record<string, unknown>[]).flatMap(x => ["id", "of", "anchor", "parent", "child", "a", "b", "note"].map(k => x[k]))
    .filter((v): v is string => typeof v === "string" && on(v));
  return [...new Set(named)].slice(0, 4);
}

/** a file written whole: to a temporary file beside it, then renamed over it */
function write(path: string, text: string): void {
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, text, "utf8");
  // on Windows a file another program has open for a moment (a reader, the editor's watcher, a virus scanner)
  // cannot be replaced: try again for a second or so
  for (let i = 0; ; i++) {
    try { renameSync(tmp, path); return; }
    catch (e) {
      const code = (e as NodeJS.ErrnoException).code;
      if (i < 40 && (code === "EPERM" || code === "EBUSY" || code === "EACCES")) { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 25); continue; }
      rmSync(tmp, { force: true });
      fail(`could not write ${basename(path)} (${code ?? (e as Error).message}: another program may have it open): try again`);
    }
  }
}

/** the chart file, then the lock if it changed (null: leave it), as one change: if the lock cannot be written,
 *  the chart file is put back, so the two never disagree */
function writeBoth(o: Opened, doc: string, lock: string | null): void {
  const was = readFileSync(o.path, "utf8");
  write(o.path, doc);
  if (lock === null) return;
  try { write(join(o.dir, "layout.lock.json"), lock); }
  catch (e) { write(o.path, was); throw e; }
}

// ------------------------------------------------------------------------------------------ the journal
interface Entry { batch: string; at: string; reason: string; labels: string[]; undo: Patch; redo: unknown[]; before: string; after: string }

/** the batches applied to a chart, for history and undo: <chart>/.crownline/journal.json (not in git) */
function journal(o: Opened) {
  const dir = join(o.dir, ".crownline"), file = join(dir, "journal.json");
  const all = (): Entry[] => {
    if (!existsSync(file)) return [];
    try { const es = JSON.parse(readFileSync(file, "utf8")); if (Array.isArray(es)) return es; } catch { /* below */ }
    return fail(`${relative(ROOT, file)} cannot be read: delete it to go on (the history, and undo of the batches in it, are lost)`);
  };
  const save = (es: Entry[]) => { mkdirSync(dir, { recursive: true }); write(file, JSON.stringify(es.slice(-50), null, 1)); };
  return {
    all,
    add(e: Omit<Entry, "batch" | "at">): string {
      const es = all(), batch = `b${Date.now().toString(36)}`;
      es.push({ batch, at: new Date().toISOString(), ...e });
      save(es);
      return batch;
    },
    pop(): void { const es = all(); es.pop(); save(es); },
  };
}

export function history(o: Opened, limit = 10) {
  const es = journal(o).all();
  return { hash: o.hash, batches: es.slice(-limit).reverse().map(e => ({ batch: e.batch, at: e.at, reason: e.reason, changes: e.labels, current: e.after === o.hash })) };
}

/** undo the last batch, if the chart is still as that batch left it */
export function undo(o: Opened) {
  const j = journal(o), last = j.all().at(-1);
  if (!last) fail("nothing to undo: no batch has been applied to this chart through these tools");
  if (last!.after !== o.hash) fail(`the chart changed after batch ${last!.batch} (by the editor or by hand): undo it there, or with git`);
  const state = { doc: structuredClone(o.doc), lock: o.lock ? structuredClone(o.lock) : null };
  applyPatch(state as never, last!.undo);
  const text = docText(state.doc), lock = state.lock ? dumpLock(state.lock as never) : null;
  const hash = exclusive(o, () => {
    unchanged(o, "the undo was being prepared");
    if (j.all().at(-1)?.batch !== last!.batch) fail("another batch was applied meanwhile: look at the history again");
    const lockPath = join(o.dir, "layout.lock.json");
    writeBoth(o, text, lock !== null && (!existsSync(lockPath) || readFileSync(lockPath, "utf8") !== lock) ? lock : null);
    j.pop();
    return diskHash(o);
  });
  return { undone: last!.batch, reason: last!.reason, changes: last!.labels, hash, restored: hash === last!.before };
}

// ------------------------------------------------------------------------------------------ comparing
/** a version of the chart: "HEAD" or another git ref, or "last" (before the last applied batch) */
function version(o: Opened, from: string): { doc: ChartDoc; lock: LockT | null } {
  if (from === "last") {
    const last = journal(o).all().at(-1);
    if (!last || last.after !== o.hash) fail("no applied batch to compare with: use from HEAD (git)");
    const state = { doc: structuredClone(o.doc), lock: o.lock ? structuredClone(o.lock) : null };
    applyPatch(state as never, last!.undo);
    return state;
  }
  if (!/^[\w./~^@{}-]+$/.test(from) || from.startsWith("-")) fail(`from: "${from}" is not a git ref`);
  const relRepo = relative(ROOT, o.path).split(sep).join("/"), lockRel = relRepo.replace(/chart\.json$/, "layout.lock.json");
  const git = (p: string) => { try { return execFileSync("git", ["show", `${from}:${p}`], { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 64 << 20 }); } catch { return null; } };
  const d = git(relRepo);
  if (d === null) fail(`git has no ${relRepo} at ${from} (a chart not committed yet): use from "last" to compare with the state before the last applied batch`);
  const l = git(lockRel), lock = l ? JSON.parse(l) : null;
  if (lock) delete lock.$schema;
  return { doc: JSON.parse(d!), lock };
}

export function diff(o: Opened, q: { from?: string } = {}) {
  let from = q.from ?? "HEAD", v: ReturnType<typeof version>;
  try { v = version(o, from); }
  catch (e) {
    // the default, on a chart git does not have yet: the state before the last batch, if there is one
    const last = journal(o).all().at(-1);
    if (q.from !== undefined || !last || last.after !== o.hash) throw e;
    from = "last (the chart is not in git)"; v = version(o, "last");
  }
  const a = build(o, v.doc, v.lock), b = build(o, o.doc, o.lock);
  if (a.failed || b.failed) return { ok: false, from, failed: { from: a.failed, now: b.failed } };
  const mv = moves(a.lock, b.lock);
  return {
    from, to: "the files now", unchanged: !mv.moved.length && !mv.notes.length && !mv.added.length && !mv.removed.length && !mv.notes_added.length && !mv.notes_removed.length && a.canvas.join() === b.canvas.join(),
    moved: cap(mv.moved), notes_moved: cap(mv.notes), added: mv.added, removed: mv.removed, notes_added: mv.notes_added, notes_removed: mv.notes_removed,
    ...(a.canvas.join() !== b.canvas.join() ? { canvas: { from: a.canvas, to: b.canvas } } : {}),
    errors: { from: a.errors.length, to: b.errors.length }, warnings: { from: a.warnings.length, to: b.warnings.length },
  };
}

// ------------------------------------------------------------------------------------------ looking
export interface RenderInput {
  around?: string[]; margin?: number;
  box?: { x: number; y: number; w: number; h: number };
  /** device px per chart px; the picture's long edge is kept to max_edge (default 1600) */
  scale?: number; max_edge?: number;
  highlight?: string[];
  issues?: boolean;
  /** the file's name in <chart>/.crownline/renders/ (default: by time) */
  name?: string;
  /** a batch to look at without saving it (as apply with dry_run would make it) */
  ops?: unknown[];
}

export async function renderRegion(o: Opened, q: RenderInput) {
  const bad = (v: number | undefined, ok: (v: number) => boolean) => v !== undefined && !(Number.isFinite(v) && ok(v));
  if (bad(q.scale, v => v > 0 && v <= 2)) fail("scale must be more than 0 and at most 2");
  if (bad(q.margin, v => v >= 0)) fail("margin must be 0 or more");
  if (bad(q.max_edge, v => v >= 100 && v <= 8000)) fail("max_edge must be between 100 and 8000");
  if (q.box && [q.box.x, q.box.y, q.box.w, q.box.h].some(v => !Number.isFinite(v)) || q.box && (q.box.w <= 0 || q.box.h <= 0)) fail("box needs x, y and a w and h above 0");
  const v = q.ops?.length ? runBatch(o, q.ops, "preview").state : o;
  const b = build(o, v.doc, v.lock);
  if (b.failed) fail(`the chart cannot be drawn: ${b.failed.join("; ")}`);
  const L = b.lock!, [W, H] = b.canvas, rects: Record<string, number[]> = { ...L.boxes, ...L.notes };
  let r: { x: number; y: number; w: number; h: number };
  if (q.box) r = q.box;
  else if (q.around?.length) {
    const rs = q.around.map(id => rects[id] ?? fail(`${id} is not on the chart (a person or an inline note id)`));
    // a person's inline notes come with them: a note is part of what is being looked at
    const notes = (v.doc.notes ?? {}) as Record<string, { anchor?: string }>;
    for (const [nid, n] of Object.entries(notes)) if (n.anchor && q.around.includes(n.anchor) && L.notes[nid]) rs.push(L.notes[nid]);
    const m = q.margin ?? 300;
    const x0 = Math.min(...rs.map(v => v[0])) - m, y0 = Math.min(...rs.map(v => v[1])) - m;
    r = { x: x0, y: y0, w: Math.max(...rs.map(v => v[2])) + m - x0, h: Math.max(...rs.map(v => v[3])) + m - y0 };
  } else r = { x: 0, y: 0, w: W, h: H };
  // inside the page
  const x = Math.max(0, Math.floor(r.x)), y = Math.max(0, Math.floor(r.y));
  r = { x, y, w: Math.min(W, Math.ceil(r.x + r.w)) - x, h: Math.min(H, Math.ceil(r.y + r.h)) - y };
  if (r.w < 10 || r.h < 10) fail("the region is outside the chart");
  const scale = Math.round(Math.min(q.scale ?? 1, (q.max_edge ?? 1600) / Math.max(r.w, r.h)) * 1000) / 1000;
  const hit = (v: number[]) => v[2] > r.x && v[0] < r.x + r.w && v[3] > r.y && v[1] < r.y + r.h;
  const inView = Object.entries(L.boxes).filter(([, v]) => hit(v)).map(([k]) => k);
  const issues = b.issues.filter(i => i.box && hit(i.box));
  const marks = [
    ...(q.highlight ?? []).filter(id => rects[id]).map(id => ({ rect: rects[id] as [number, number, number, number], colour: "#1f6feb", label: id })),
    ...(q.issues !== false ? issues.map((i, n) => ({ rect: i.box!, colour: i.severity === "error" ? "#d1242f" : "#bf8700", label: `${n + 1}` })) : []),
  ];
  const dir = join(o.dir, ".crownline", "renders");
  mkdirSync(dir, { recursive: true });
  const html = join(o.dir, ".crownline", "page.html");
  writeFileSync(html, b.html, "utf8");
  const out = join(dir, `${(q.name ?? new Date().toISOString().replace(/[:.]/g, "-")).replace(/[^\w.-]/g, "_")}.png`);
  const { region } = await import("@crownline/engine/print");
  const png = await region(html, ROOT, out, r, scale, marks);
  return {
    file: relative(ROOT, out).split(sep).join("/"), png,
    region: r, scale, size: [Math.round(r.w * scale), Math.round(r.h * scale)],
    ...(q.ops?.length ? { preview: "the batch is drawn but not saved" } : {}),
    in_view: inView.slice(0, 40).map(id => `${id} (${card(v.doc, id).name})`).concat(inView.length > 40 ? [`… and ${inView.length - 40} more`] : []),
    issues_in_view: issues.map((i, n) => ({ n: n + 1, ...brief(i) })),
  };
}

// ------------------------------------------------------------------------------------------ the operations
export function opsList(which?: string) {
  const specs = which ? OPS.filter(s => s.name === which) : OPS;
  if (which && !specs.length) fail(`no op ${which}: they are ${OPS.map(s => s.name).join(", ")}`);
  return specs.map(s => ({ op: s.name, summary: s.summary, example: s.example, ...(which ? { schema: s.input } : {}) }));
}

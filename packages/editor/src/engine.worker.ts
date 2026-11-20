// The engine, off the page's thread: the editor stays responsive while a chart is laid out (Mataram takes a
// few hundred milliseconds). It is given the files once (fonts, map data, which files exist), then each new
// version of the document; it answers with the page, the layout file and the check report.
import { validate, type ChartDoc, type Problem } from "@crownline/schema";
import { compose, headerPanel, layoutFile, lockOf, render, webEnv, type Issue, type Lock } from "@crownline/engine";

export interface Init { type: "init"; chartPath: string; fonts: Record<string, ArrayBuffer>; json: Record<string, unknown>; files: string[] }
/** probe: a build for the editor's own use (a re-layout proposal), not shown as the current chart */
export interface Build { type: "build"; seq: number; doc: ChartDoc; lock: Lock | null; probe?: boolean }
/** files that now exist (an imported portrait), and fonts the document now asks for */
export interface More { type: "more"; files?: string[]; fonts?: Record<string, ArrayBuffer> }
export type ToWorker = Init | Build | More;

export interface Built {
  type: "built"; seq: number; ms: number;
  html: string; layout: unknown;
  issues: Issue[];
  /** the document's own problems (schema, references, tree rules): a document with errors is not laid out */
  problems: Problem[];
  placed: string[];
  /** where everything ended up, as a lock: the position diff compares these */
  lock: Lock;
  probe?: boolean;
}
export interface Failed { type: "failed"; seq: number; message: string; problems: Problem[]; probe?: boolean }
export type FromWorker = Built | Failed;

let files: Init | null = null;
let fonts = new Map<string, Uint8Array>();
let exists = new Set<string>();

const post = (m: FromWorker) => (self as unknown as Worker).postMessage(m);

self.onmessage = (e: MessageEvent<ToWorker>) => {
  const m = e.data;
  if (m.type === "init") {
    files = m;
    fonts = new Map(Object.entries(m.fonts).map(([k, v]) => [k, new Uint8Array(v)]));
    exists = new Set(m.files);
    return;
  }
  if (m.type === "more") {
    for (const f of m.files ?? []) exists.add(f);
    for (const [k, v] of Object.entries(m.fonts ?? {})) fonts.set(k, new Uint8Array(v));
    return;
  }
  if (!files) return post({ type: "failed", seq: m.seq, message: "the engine has no files yet", problems: [], probe: m.probe });
  const t0 = performance.now();
  const v = validate(m.doc), problems = [...v.errors, ...v.warnings];
  try {
    if (v.errors.length) throw new Error(`the document has ${v.errors.length} error${v.errors.length > 1 ? "s" : ""}`);
    const f = files;
    const env = webEnv(m.doc, f.chartPath, {
      font: p => { const b = fonts.get(p); if (!b) throw new Error(`font ${p} was not loaded`); return b; },
      exists: p => exists.has(p),
      json: p => f.json[p],
    });
    const c = compose(m.doc, env, headerPanel(m.doc), m.lock);
    const page = render(m.doc, env, c);
    const layout = layoutFile(m.doc, env, c, page);
    post({ type: "built", seq: m.seq, ms: Math.round(performance.now() - t0), html: page.html, layout, issues: page.report.issues,
           problems, placed: c.placed, lock: lockOf(m.doc, c, page), probe: m.probe });
  } catch (err) {
    post({ type: "failed", seq: m.seq, message: (err as Error).message, problems, probe: m.probe });
  }
};


// Opening a chart from a store: the document, its lock, and the files the engine needs (fonts, map data, the
// file list), handed to the engine in a worker. The editor builds on this; so does the app's view screen
// (Drawing), which only draws the chart as saved and never changes it.
import type { ChartDoc } from "@crownline/schema";
import type { Lock } from "@crownline/engine";
import { fontChoice, dataFiles } from "@crownline/engine";
import type { FromWorker, ToWorker } from "./engine.worker.ts";
import type { Store } from "./store.ts";

export interface Loaded {
  doc: ChartDoc;
  lock: Lock | null;
  /** every file under assets/ and charts/ */
  files: string[];
  /** the font files the document asks for, read */
  fonts: Record<string, ArrayBuffer>;
  /** the map data and other JSON files the document names, parsed */
  json: Record<string, unknown>;
}

/** read a chart and everything its engine needs */
export async function loadChart(store: Store, chartPath: string): Promise<Loaded> {
  const get = (p: string) => store.read(p);
  const parse = async (p: string) => { try { return JSON.parse(await (await get(p)).text()); } catch (e) { throw new Error(`${p}: ${(e as Error).message}`); } };
  const doc = (await parse(chartPath)) as ChartDoc;
  const lockPath = chartPath.replace(/chart\.json$/, "layout.lock.json");
  const files = await store.list();
  let lock: Lock | null = null;
  if (files.includes(lockPath)) { lock = await parse(lockPath); delete (lock as unknown as Record<string, unknown>).$schema; }
  const c = fontChoice(doc, false);
  const fontFiles = [c.regular, c.bold, c.script, c.secondScript].filter((f): f is string => !!f);
  const fonts: Record<string, ArrayBuffer> = {};
  await Promise.all(fontFiles.map(async f => { fonts[f] = await (await get(f)).arrayBuffer(); }));
  const json: Record<string, unknown> = {};
  await Promise.all(dataFiles(doc, chartPath).map(async f => { json[f] = await parse(f); }));
  return { doc, lock, files, fonts, json };
}

/** the engine's worker, given a chart's files */
export function startEngine(chartPath: string, l: Loaded): Worker {
  const worker = new Worker(new URL("./engine.worker.ts", import.meta.url), { type: "module" });
  const init: ToWorker = { type: "init", chartPath, fonts: l.fonts, json: l.json, files: l.files };
  worker.postMessage(init);
  return worker;
}

/** a chart drawn as saved, from its lock when it has one (as the editor opens it): for reading only */
export class Drawing {
  private seq = 0;
  private waiting = new Map<number, (m: FromWorker) => void>();
  private constructor(readonly store: Store, readonly chartPath: string, private worker: Worker, public loaded: Loaded) {
    worker.onmessage = (e: MessageEvent<FromWorker>) => { this.waiting.get(e.data.seq)?.(e.data); this.waiting.delete(e.data.seq); };
  }

  static async open(store: Store, chartPath: string): Promise<Drawing> {
    const l = await loadChart(store, chartPath);
    return new Drawing(store, chartPath, startEngine(chartPath, l), l);
  }

  get lockPath(): string { return this.chartPath.replace(/chart\.json$/, "layout.lock.json"); }

  /** lay the chart out and draw it */
  draw(): Promise<FromWorker> {
    const seq = ++this.seq, msg: ToWorker = { type: "build", seq, doc: this.loaded.doc, lock: this.loaded.lock };
    return new Promise(resolve => { this.waiting.set(seq, resolve); this.worker.postMessage(msg); });
  }

  /** the files changed in the store (a save, a model's batch): read them again, with a new engine when the
   *  fonts or the data files the document needs are not the ones it has */
  async reload(): Promise<void> {
    const l = await loadChart(this.store, this.chartPath);
    this.worker.terminate();
    this.worker = startEngine(this.chartPath, l);
    this.worker.onmessage = (e: MessageEvent<FromWorker>) => { this.waiting.get(e.data.seq)?.(e.data); this.waiting.delete(e.data.seq); };
    this.loaded = l;
  }

  close(): void { this.worker.terminate(); this.waiting.clear(); }
}

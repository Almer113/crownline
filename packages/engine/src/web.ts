// Running the engine without a file system (the browser editor): the caller fetches the files first and
// hands them over. Paths are relative to the repository, '/'-separated, as the Python engine makes them.
import type { Doc, Env } from "./doc.ts";
import { fontChoice } from "./fonts.ts";
import { Measure } from "./text/measure.ts";

/** a '/'-path made plain: "charts/x/../../assets/a.jpg" -> "assets/a.jpg" (".." past the root stays) */
export function plainPath(p: string): string {
  const out: string[] = [];
  for (const part of p.split("/")) {
    if (part === "" || part === ".") continue;
    if (part === ".." && out.length && out[out.length - 1] !== "..") out.pop();
    else out.push(part);
  }
  return out.join("/");
}

/** where a document's media paths start: its folder joined with meta.assetRoot (repository-relative) */
export const assetBase = (doc: Doc, chartPath: string): string =>
  plainPath(`${chartPath.split("/").slice(0, -1).join("/")}/${doc.meta.assetRoot ?? "."}`);

/** the data media a layout reads (the map panel's shapes), as repository paths: fetch these first */
export function dataFiles(doc: Doc, chartPath: string): string[] {
  const base = assetBase(doc, chartPath);
  return Object.values(doc.media ?? {}).filter(m => m.kind === "data").map(m => plainPath(`${base}/${m.file}`));
}

export interface WebFiles {
  /** a font file's bytes, by repository path */
  font: (path: string) => Uint8Array;
  /** whether a file exists, by repository path */
  exists: (path: string) => boolean;
  /** a data file, parsed, by repository path */
  json: (path: string) => unknown;
}

const measures = new Map<Uint8Array, Measure>();
const measure = (bytes: Uint8Array, name: string) => {
  let m = measures.get(bytes);
  if (!m) { m = new Measure(bytes, name); measures.set(bytes, m); }
  return m;
};

/** the environment for a document at `chartPath` (repository-relative), from files fetched beforehand */
export function webEnv(doc: Doc, chartPath: string, files: WebFiles, isPublic = false): Env {
  const c = fontChoice(doc, isPublic), base = assetBase(doc, chartPath);
  const m = (p: string) => measure(files.font(p), p.split("/").pop()!);
  const asset = (file: string) => {
    const p = plainPath(`${base}/${file}`);
    if (isPublic && p.startsWith("..")) throw new Error(`a public build may only use files in the repository, not ${p}`);
    return p;
  };
  return {
    public: isPublic,
    fonts: {
      sans: { regular: m(c.regular), bold: m(c.bold) },
      script: c.script ? m(c.script) : undefined,
      scriptScale: c.scriptScale,
      secondScript: c.secondScript ? m(c.secondScript) : undefined,
      files: { regular: c.regular, bold: c.bold, script: c.script, secondScript: c.secondScript },
    },
    asset,
    exists: files.exists,
    readJson: file => files.json(asset(file)),
  };
}

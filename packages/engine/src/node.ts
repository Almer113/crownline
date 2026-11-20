// Running the engine from Node (the command line and the tests): load a chart document and its fonts from
// disk, the way the Python engine does (chartfile.py, model.py). The engine itself (index.ts) reads no
// files, so the browser editor gives it the same things another way.
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, isAbsolute, join, normalize, relative, resolve, sep } from "node:path";
import { Measure } from "./text/measure.ts";
import type { Doc, Env } from "./doc.ts";
import { fontChoice } from "./fonts.ts";

export { SANS, SCRIPT, SECOND_SCRIPT } from "./fonts.ts";

const cache = new Map<string, Measure>();
function font(root: string, rel: string): Measure {
  const full = join(root, rel);              // by the full path: another root is another font
  let m = cache.get(full);
  if (!m) { m = new Measure(readFileSync(full), rel.split("/").pop()); cache.set(full, m); }
  return m;
}

const data = new Map<string, { at: number; value: unknown }>();   // data media (map shapes), by full path

export interface Loaded { doc: Doc; env: Env; path: string }

/** a chart document and the environment to lay it out in; `root` is the repository (media paths are made
 *  relative to it, as the Python engine's are) */
export function load(docPath: string, opts: { root: string; public?: boolean }): Loaded {
  const path = isAbsolute(docPath) ? docPath : join(opts.root, docPath);
  const doc = JSON.parse(readFileSync(path, "utf8")) as Doc;
  return { doc, env: envFor(doc, path, opts), path };
}

/** the environment to lay out a document that is at `path` (or would be: one changed in memory) */
export function envFor(doc: Doc, path: string, opts: { root: string; public?: boolean }): Env {
  const base = resolve(dirname(path), doc.meta.assetRoot ?? ".");      // an absolute assetRoot wins, as in Python
  const f = fontChoice(doc, Boolean(opts.public));
  const asset = (file: string) => {
    const full = resolve(base, file), rel = relative(opts.root, full);
    // a public page is published from the repository: a file outside it would be a local path on the page
    if (opts.public && (rel.startsWith("..") || isAbsolute(rel))) throw new Error(`a public build may only use files in the repository, not ${full}`);
    return (rel.startsWith("..") || isAbsolute(rel) ? normalize(full) : rel).split(sep).join("/");
  };
  const env: Env = {
    public: Boolean(opts.public),
    fonts: {
      sans: { regular: font(opts.root, f.regular), bold: font(opts.root, f.bold) },
      script: f.script ? font(opts.root, f.script) : undefined,
      scriptScale: f.scriptScale,
      files: { regular: f.regular, bold: f.bold, script: f.script, secondScript: f.secondScript },
      secondScript: f.secondScript ? font(opts.root, f.secondScript) : undefined,
    },
    asset,
    exists: p => existsSync(isAbsolute(p) ? p : join(opts.root, p)),
    readJson: file => {
      const p = asset(file), full = isAbsolute(p) ? p : join(opts.root, p);
      const at = statSync(full).mtimeMs, hit = data.get(full);     // read again once the file has changed
      if (hit?.at === at) return hit.value;
      const value = JSON.parse(readFileSync(full, "utf8"));
      data.set(full, { at, value });
      return value;
    },
  };
  return env;
}

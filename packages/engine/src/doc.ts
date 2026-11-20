// Reading the chart document (the Python chartfile.py): text fields, media, and what the engine is told
// about the outside world. The engine reads no files itself, so it runs the same on the command line and
// in the browser editor: the caller gives it the fonts and says which picture files exist.
import type { ChartDoc } from "@crownline/schema";
import type { Measure } from "./text/measure.ts";

export type Doc = ChartDoc;
type TextValue = string | Record<string, string> | undefined | null;

/** a text field: a plain string (the default language) or {BCP 47 tag: text} */
export function text(doc: Doc, value: TextValue, lang?: string): string {
  if (value && typeof value === "object") {
    const def = doc.meta.defaultLang ?? "en";
    return value[lang ?? def] || value[def] || Object.values(value)[0] || "";
  }
  return value || "";
}

/** the fonts a build lays text out with (theme.fonts names them; the caller loads the files) */
export interface Fonts {
  sans: { regular: Measure; bold: Measure };
  script?: Measure;
  /** the script font's size relative to Apple Chancery, which the type sizes were set for */
  scriptScale?: number;
  secondScript?: Measure;
  /** the font files as the page references them (relative to the page) */
  files: { regular: string; bold: string; script?: string; secondScript?: string };
}

export interface Env {
  fonts: Fonts;
  /** a public build: private portraits become empty frames of the same size (chartfile.private_assets) */
  public: boolean;
  /** a media file's path as the build uses it (Python: chartfile.asset, relative to the repository) */
  asset: (file: string) => string;
  /** whether a file (as `asset` gives it) is present */
  exists: (path: string) => boolean;
  /** a data media file (the map panel's shapes), parsed; `file` as the document gives it */
  readJson: (file: string) => unknown;
}

/** the portrait file the document gives a person, as `env.asset` gives it, or null */
export function portraitFile(doc: Doc, env: Env, pid: string): string | null {
  const mid = doc.people[pid]?.portrait;
  const m = mid ? doc.media?.[mid] : undefined;
  return m ? env.asset(m.file) : null;
}

/** files a public build leaves out, and people whose portrait it leaves out (chartfile.private_files, private_assets) */
export function privateMedia(doc: Doc, env: Env): { files: Set<string>; portraits: Set<string> } {
  const files = new Set<string>(), portraits = new Set<string>();
  for (const m of Object.values(doc.media ?? {})) {
    if (!m.private) continue;
    files.add(env.asset(m.file));
    if (m.kind === "portrait" && m.of) portraits.add(m.of);
  }
  return { files, portraits };
}

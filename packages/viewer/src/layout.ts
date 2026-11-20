// The layout file written by the engine (layout_export.py, format 1). Rects are [left, top, right, bottom]
// in chart pixels.
export type Rect = [number, number, number, number];

export interface Person {
  kind: "ruler" | "heir" | "minor" | "neutral" | "text" | "legend";
  house: string;
  colour: string;
  title: string;
  name: string;
  sub: string;
  year: number;
  rect: Rect;
  portrait: string | null;
  hatch: boolean;
  traditional: boolean;
  tag: string | null;
  // added for the interactive viewer (layout_export.py); absent in older layout files
  family?: { parents: Kin[]; spouses: Kin[]; children: Kin[] };
  crown?: string | null;
  notes?: { text: string; letter: string | null }[];
  bio?: string;
  aka?: string[];
  /** years shown as present on the time slider; spanGuess: no end date is printed, the end is a guess */
  span?: [number, number];
  spanGuess?: boolean;
  /** the panel's words for the person's reigns, by language (from the court's `reign` template) */
  reign?: Record<string, string>;
  /** birth and death claims, the preferred first; the date as written (layout_export.py, Phase 9) */
  born?: Claim[];
  died?: Claim[];
  /** the person's own citations */
  sources?: Cite[];
  /** other spellings to find the person by (not written by the engine; `aka` is searched too) */
  aliases?: string[];
}

/** a relative; gap names generations the chart leaves out ("grandson", "descendant") */
/** a relative; gap names generations the chart leaves out ("grandson", "descendant"); via "adoptive": an
 *  adoption the chart keeps but does not draw (the relationship finder does not follow it) */
export interface Kin { id: string; gap: string | null; via?: "adoptive" }

export interface Cite { source: string; where?: string }
export interface Claim { date?: string; place?: string; note?: string; certainty?: "high" | "medium" | "low"; sources: Cite[] }
export interface Source { kind: string; title: string; author?: string; year?: number; url?: string }

export interface Line {
  owner: string;
  type: "descent" | "marriage";
  from: string[];
  to: string[];
  points: [number, number][];
  colour: string;
  style: string;
  hop: boolean;
}

export interface Layout {
  format: 1;
  chart: string;
  public: boolean;
  canvas: [number, number];
  people: Record<string, Person>;
  lines: Line[];
  notes: { anchor: string; rect: Rect; text: string }[];
  headers: Record<string, { rect: Rect; name: string; kind: string; years?: string; seat?: string;
                            founded?: string; emblem?: string | null }>;
  crowns: Record<string, { rect: Rect }>;
  glossary?: { group: string; term: string; full: string; meaning: string }[];
  eras?: { year: number; name: string }[];
  episodes?: { from: number; to: number; name: string }[];
  stages?: { id: string; from: number; title: string }[];
  tours?: Tour[];
  title?: string;
  intro?: string;
  asOf?: string;
  /** the interface languages the viewer offers (panels.viewer.languages); absent: all */
  interface?: string[];
  /** the works cited by people's records */
  sources?: Record<string, Source>;
  /** the year the time slider opens at when no one is selected (panels.viewer.year) */
  startYear?: number;
}

import type { Tour } from "./toolbar";

export async function loadLayout(url: string): Promise<Layout> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`layout ${url}: HTTP ${res.status}`);
  const lay = (await res.json()) as Layout;
  if (lay.format !== 1) throw new Error(`layout ${url}: unsupported format ${String(lay.format)}`);
  return lay;
}

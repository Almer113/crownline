// The box model (PLAN Phase 5, step 2; the Python model.py and the people section of chartdoc.py): each
// person's box size from their text, and the boxes placed before the layout runs (a spouse beside a
// partner, a side-by-side row). Same formulas, in the same order, as the Python engine.
import { type Doc, type Env, portraitFile, privateMedia, text } from "./doc.ts";

export type Kind = "ruler" | "heir" | "minor" | "neutral" | "text" | "legend";

export interface Box {
  id: string;
  kind: Kind;
  house: string | null;
  /** centre of the label (the portrait sits to its left); set by beside, rows and later the layout */
  x: number;
  year: number;
  title: string;
  name: string;
  sub: string;
  hatch: boolean;
  tag: string | null;
  /** known only from court chronicles: dates traditional */
  trad: boolean;
  /** the portrait file, or null (none, missing, or private in a public build) */
  pic: string | null;
  /** label width, portrait width, height */
  lw: number;
  pw: number;
  h: number;
  cy: number | null;
}

export const P = 88;          // ruler portrait / box height
export const MINOR_H = 62;    // every minor box has the same height
export const LMIN = 214;      // minimum ruler label width
export const GAP_X = 46;      // partner <-> spouse gap

/** word titles are set in capitals; abbreviations with lower case (GRAy., BRAy.) keep their case */
export function dispTitle(t: string): string {
  return /[A-Z][a-z]+\./.test(t) ? t : t.toUpperCase();
}

export const left = (b: Box) => b.x - b.lw / 2 - b.pw;
export const right = (b: Box) => b.x + b.lw / 2;

export interface Boxes {
  boxes: Map<string, Box>;
  /** spouse or row member -> the person whose row they stand on */
  ties: Map<string, string>;
}

/** every person's box, in document order, with spouses and side-by-side rows placed */
export function makeBoxes(doc: Doc, env: Env): Boxes {
  const FS = doc.theme.type as Record<string, number>;
  const { regular, bold } = env.fonts.sans;
  const w = (s: string, size: number, isBold = true) => (isBold ? bold : regular).width(s, size);
  const priv = privateMedia(doc, env);
  const boxes = new Map<string, Box>(), ties = new Map<string, string>();
  const rows = (doc.display?.rows ?? []).map(r => ({ ...r, done: false }));

  const make = (id: string): Box => {
    const p = doc.people[id], s = p.show as Record<string, any>, kind = s.box as Kind;
    const title = p.title ?? "", name = text(doc, p.name as any), sub = text(doc, s.sub);
    const file = portraitFile(doc, env, id);
    // a portrait the document names keeps its frame when the file is absent (a private picture in the public
    // repository, a file not copied yet): the layout never depends on which files are present (model.Node)
    let pic = file && env.exists(file) ? file : null, slot = Boolean(s.portraitFrame) || file !== null;
    if (env.public && (priv.portraits.has(id) || (file !== null && priv.files.has(file)))) { pic = null; slot = true; }
    const tw = title ? w(dispTitle(title), FS.title) * 1.06 + 24 : 0;
    let lw: number, h: number, pw: number;
    if (kind === "ruler" || kind === "heir") {
      lw = Math.max(LMIN, w(name, FS.name) + 30, w(sub, FS.reign, false) + 26, tw);
      h = P; pw = P;
    } else if (kind === "minor") {
      lw = Math.max(w(name, FS.name2) + 28, w(sub, FS.sub2, false) + 24, tw, 130);
      h = MINOR_H; pw = pic || slot ? h : 0;
    } else if (kind === "neutral") {
      const lines = sub.split("<br>");
      lw = s.width || Math.max(w(name, FS.name2) + 28, Math.max(...lines.map(l => w(l, FS.sub2, false))) + 24, 150);
      h = title ? 88 : 76; pw = pic || slot ? h : 0;
    } else if (kind === "legend") {
      lw = Math.max(w(name, FS.name2) + 32, w(sub, FS.sub2, false) + 28, w(dispTitle(title), FS.title) * 1.06 + 28, 150);
      h = 62; pw = 0; pic = null;
    } else {
      lw = Math.max(w(name, FS.name2), w(sub, FS.sub2, false), 60) + 16;
      h = sub ? 54 : 42; pw = 0; pic = null;
    }
    return {
      id, kind, house: kind === "neutral" || kind === "text" ? null : p.house ?? null, x: 0, year: s.year ?? 0,
      title, name, sub, hatch: Boolean(s.hatch), tag: s.tag ?? null, trad: p.basis === "traditional", pic,
      lw, pw, h, cy: null,
    };
  };

  const beside = (partner: string, side: string, b: Box) => {
    const p = boxes.get(partner)!;
    b.year = p.year;
    b.x = side === "r" ? right(p) + GAP_X + b.pw + b.lw / 2 : left(p) - GAP_X - b.lw / 2;
    ties.set(b.id, partner);
  };

  const placeRows = () => {        // a side-by-side row: members stand left of the anchor, joined left to right
    for (const r of rows) {
      if (r.done || ![r.anchor, ...r.members].every(k => boxes.has(k))) continue;
      const anchor = boxes.get(r.anchor)!;
      let edge = left(anchor);
      for (const k of [...r.members].reverse()) {
        const n = boxes.get(k)!;
        n.x = edge - r.gap - n.lw / 2;
        n.year = anchor.year;
        ties.set(k, r.anchor);
        edge = left(n);
      }
      r.done = true;
    }
  };

  for (const id of Object.keys(doc.people)) {
    if (boxes.has(id)) throw new Error(`duplicate node id ${id}`);
    const b = make(id);
    boxes.set(id, b);
    const bs = (doc.people[id].show as Record<string, any>).beside;
    if (bs) beside(bs.of, bs.side, b);
    placeRows();
  }
  return { boxes, ties };
}

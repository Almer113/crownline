// Labels (PLAN Phase 5, step 9; the labels of the Python build.py): the break marks and captions on the
// lines into children, the bracket labels set in a gap between the lines passing through a bracket, and the
// era and episode labels, placed clear of boxes, panels, notes and lines.
import { type Box, left, right } from "./boxes.ts";
import { type Doc, type Env, text } from "./doc.ts";
import type { Axis } from "./axis.ts";
import type { Canvas } from "./canvas.ts";
import { GUTTER } from "./canvas.ts";
import type { Geometry, Rect } from "./columns.ts";
import { escape, pyFixed, pyLen } from "./py.ts";
import { issue, type Issue } from "./checks.ts";
import type { Rows } from "./rows.ts";
import { LINE, type Pt, type Routing, type Seg } from "./routing.ts";
import type { Tables } from "./tables.ts";

export const BAND_YEARS = 50;
export const BRACKET_DY = 10;     // the bracket line runs this far above the tops of the boxes it groups

export const ov = (a: Rect, b: Rect) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
export const segRect = (a: Pt, b: Pt, pad = 2): Rect =>
  [Math.min(a[0], b[0]) - pad, Math.min(a[1], b[1]) - pad, Math.max(a[0], b[0]) + pad, Math.max(a[1], b[1]) + pad];
export const segmentsOf = (s: Seg): [Pt, Pt][] => s.pts.slice(0, -1).map((p, i) => [p, s.pts[i + 1]]);

const top = (b: Box) => b.cy! - b.h / 2;
const bottom = (b: Box) => b.cy! + b.h / 2;
const range = (a: number, b: number, step: number) => { const o: number[] = []; for (let v = a; v < b; v += step) o.push(v); return o; };
const sortBy = <V>(xs: V[], key: (v: V) => number) =>
  xs.map((v, i) => [v, key(v), i] as const).sort((p, q) => p[1] - q[1] || p[2] - q[2]).map(([v]) => v);
/** Python's str.split(): on runs of whitespace, no empty words */
const words = (s: string) => s.split(/\s+/).filter(Boolean);

/** one piece of a bracket's label: x, text-anchor, text, rect */
export type Piece = [number, string, string, Rect];
export interface BracketGeom { x0: number; x1: number; y: number; runs: number[]; pieces: Piece[] }
/** where an era label goes: x, text-anchor, rect */
export type EraLabel = [number, string, Rect];

export interface Labels {
  /** the break marks and captions, as SVG (the Python MARKS) */
  marks: string[];
  brackets: BracketGeom[];
  /** label (with " (2)" for a second piece) -> rect */
  bracketLabels: Map<string, Rect>;
  eraLabels: Map<number, EraLabel>;
  /** episodes whose label goes at the left (or at epiX) instead of the right edge */
  epiLeft: Set<string>;
  epiX: Map<string, number>;
  epiLabel: (a: number, b: number, lab: string, side?: "l" | "r") => [string, number, Rect];
  bgAt: (y: number) => string;
  /** labels left out: no line comes down into their person */
  warnings: Issue[];
}

export function placeLabels(doc: Doc, env: Env, boxes: Map<string, Box>, t: Tables, g: Geometry, axis: Axis,
                            rows: Rows, canvas: Canvas, r: Routing): Labels {
  const N = (id: string) => boxes.get(id)!, Y = axis.Y;
  const FS = doc.theme.type as Record<string, number>;
  const pal = (doc.theme as any).palette as Record<string, string>;
  const textW = (s: string, size: number, isBold = true) => (isBold ? env.fonts.sans.bold : env.fonts.sans.regular).width(s, size);
  const { W } = canvas, hd = canvas.header;
  const eras: [number, string][] = (doc.timeline?.eras ?? []).map((e: any) => [e.year, text(doc, e.name)]);
  const episodes: [number, number, string][] = (doc.timeline?.episodes ?? []).map((e: any) => [e.from, e.to, text(doc, e.name)]);
  const f1 = (v: number) => pyFixed(v, 1);

  const bgAt = (y: number) => {      // alternate half-century bands are darker
    const yrs = range(rows.year0, rows.year1, BAND_YEARS);
    for (let i = 0; i < yrs.length; i++)
      if (Y(yrs[i]) <= y && y < Y(Math.min(yrs[i] + BAND_YEARS, rows.year1))) return i % 2 ? pal.band : pal.background;
    return pal.background;
  };

  // ---------------------------------------------------------------- break marks and captions
  const marks: string[] = [];
  const warnings: Issue[] = [];
  const dropOf = (kid: string) => [...r.drops].find(([k]) => k.split(" ")[1] === kid)?.[1];
  // a label that needs a line coming down into the person, when none does (the root, a row line)
  const leftOut = (kid: string, what: string, label: string) => warnings.push(issue("warning", "label-left-out",
    `no line comes down into ${kid}, so its ${what} "${label}" is left out`, { people: [kid] }));
  const breakMark = (owner: string, kid: string, label: string, at = 0.5) => {
    const drop = r.drops.get(`${owner} ${kid}`);
    if (!drop) return leftOut(kid, "break mark", label);
    const [x, y0, y1, col] = drop, ym = y0 + (y1 - y0) * at;
    marks.push(`<rect x="${f1(x - 14)}" y="${f1(ym - 9)}" width="28" height="18" fill="${bgAt(ym)}"/>`
      + `<line x1="${f1(x - 13)}" y1="${f1(ym - 1)}" x2="${f1(x + 13)}" y2="${f1(ym - 10)}" stroke="${col}" stroke-width="${LINE}"/>`
      + `<line x1="${f1(x - 13)}" y1="${f1(ym + 10)}" x2="${f1(x + 13)}" y2="${f1(ym + 1)}" stroke="${col}" stroke-width="${LINE}"/>`
      + `<text x="${f1(x + 22)}" y="${f1(ym + 5)}" class="cap halo" style="stroke:${bgAt(ym)}">${escape(label.toUpperCase())}</text>`);
  };
  const caption = (kid: string, label: string, cls = "cap", owner?: string) => {
    const drop = owner ? r.drops.get(`${owner} ${kid}`) : dropOf(kid);
    if (!drop) return leftOut(kid, cls === "cap" ? "caption" : "event", label);
    const [x, y0, y1] = drop, ym = Math.max((y0 + y1) / 2, y1 - 40);
    marks.push(`<text x="${f1(x + 14)}" y="${f1(ym + 5)}" class="${cls} halo" style="stroke:${bgAt(ym)}">${escape(label)}</text>`);
  };
  t.desc.forEach((d, i) => {
    for (const [k, lab] of Object.entries(d.brk)) breakMark(`d${i}`, k, lab, t.breakAt.get(t.descIds[i][d.kids.indexOf(k)]) ?? 0.5);
    for (const [k, lab] of Object.entries(d.caption)) caption(k, lab.toUpperCase(), "cap", `d${i}`);
  });
  for (const [k, lab] of t.events) caption(k, lab, "event");

  // ---------------------------------------------------------------- brackets
  const vertical: [number, number, number][] = [];
  for (const s of r.segs) for (const [a, b] of segmentsOf(s))
    if (Math.abs(a[0] - b[0]) < 0.5) vertical.push([a[0], Math.min(a[1], b[1]), Math.max(a[1], b[1])]);
  /** A bracket hugs the tops of the boxes it groups; its label sits just above the line, in a gap between the
   *  lines passing down through it. Too wide for any gap: split in two either side of the line nearest the
   *  middle; failing that, two lines */
  const bracketGeom = (ids: string[], label: string): BracketGeom => {
    const ns = ids.map(N);
    const x0 = Math.min(...ns.map(left)) - 8, x1 = Math.max(...ns.map(right)) + 8, y = Math.min(...ns.map(top)) - BRACKET_DY;
    const runs = vertical.filter(([vx, va, vb]) => x0 < vx && vx < x1 && va < y && y < vb).map(([vx]) => vx).sort((a, b) => a - b);
    const blocks = ids.filter(i => t.crowns.has(i)).map(g.crownRect);
    const tw = (s: string) => textW(s, FS.small) * 1.12;           // letter-spaced width
    const tp = y - 20, mid = (x0 + x1) / 2;
    const free = (rc: Rect, skip: number | null = null) => x0 <= rc[0] && rc[2] <= x1 && !blocks.some(bk => ov(rc, bk))
      && runs.every(vx => vx === skip || vx < rc[0] - 8 || vx > rc[2] + 8);
    let best: [number, Piece[]] | null = null;
    for (const c of range(Math.trunc(x0 + 10), Math.trunc(x1 - 10) + 1, 4)) {     // 1. one line in a gap
      const w = tw(label) + 16, rc: Rect = [c - w / 2, tp, c + w / 2, y - 3];
      if (free(rc) && (best === null || Math.abs(c - mid) < best[0])) best = [Math.abs(c - mid), [[c, "middle", label, rc]]];
    }
    if (best) return { x0, x1, y, runs, pieces: best[1] };
    const ws = words(label);
    for (const vx of sortBy(runs, v => Math.abs(v - mid))) {            // 2. split either side of a line
      for (let k = 1; k < ws.length; k++) {
        const a = ws.slice(0, k).join(" "), b = ws.slice(k).join(" ");
        const ra: Rect = [vx - 12 - tw(a), tp, vx - 12, y - 3], rb: Rect = [vx + 12, tp, vx + 12 + tw(b), y - 3];
        if (free(ra, vx) && free(rb, vx)) {
          const cand: [number, Piece[]] = [Math.abs(tw(a) - tw(b)), [[vx - 12, "end", a, ra], [vx + 12, "start", b, rb]]];
          if (best === null || cand[0] < best[0]) best = cand;
        }
      }
      if (best) return { x0, x1, y, runs, pieces: best[1] };
    }
    const half = Math.floor((ws.length + 1) / 2);                      // 3. two lines
    const lines = [ws.slice(0, half).join(" "), ws.slice(half).join(" ")];
    const w = Math.max(...lines.map(tw)) + 16, c = mid, rc: Rect = [c - w / 2, tp - 17, c + w / 2, y - 3];
    return { x0, x1, y, runs, pieces: [[c, "middle", lines[0], [rc[0], rc[1], rc[2], rc[1] + 17]],
                                       [c, "middle", lines[1], [rc[0], rc[1] + 17, rc[2], rc[3]]]] };
  };
  const brackets: BracketGeom[] = [], bracketLabels = new Map<string, Rect>();
  for (const [ids, label] of g.brackets) {
    const bg = bracketGeom(ids, label);
    brackets.push(bg);
    bg.pieces.forEach(([, , , rc], i) => bracketLabels.set(label + (i ? ` (${i + 1})` : ""), rc));
  }

  // ---------------------------------------------------------------- episodes and eras
  const headerRect: Rect = [hd.x, hd.y, hd.x + hd.width, hd.y + hd.height];
  const epiLeft = new Set<string>(), epiX = new Map<string, number>();
  const eraYs = () => eras.slice(1).map(([yr]) => Y(yr));
  /** an episode's label: text, baseline y and rect; at the right edge of the band, or at the left when the
   *  right is blocked */
  const epiLabel = (a: number, b: number, lab: string, side?: "l" | "r"): [string, number, Rect] => {
    const y0 = Y(a), y1 = Y(b), eys = eraYs();
    const ty = [y0 + 19, y1 - 6, y0 - 8, y1 + 19].find(v => !eys.some(ey => v - 20 < ey && ey < v + 10)) ?? y0 + 19;
    const tx = `${lab} · ${a}–${String(b).slice(2)}`.toUpperCase();
    const w = textW(tx, 17) + 1.5 * pyLen(tx);
    if ((side ?? (epiLeft.has(lab) ? "l" : "r")) === "l") {
      let x0 = epiX.get(lab) ?? GUTTER + 14;
      if (!epiX.has(lab) && ov([x0, ty - 13, x0 + w, ty + 3], headerRect)) x0 = headerRect[2] + 44;   // right of the card
      return [tx, ty, [x0, ty - 13, x0 + w, ty + 3]];
    }
    return [tx, ty, [W - GUTTER - 14 - w, ty - 13, W - GUTTER - 14, ty + 3]];
  };

  const obstacles: Rect[] = [...boxes.values()].map(n => [left(n) - 6, top(n) - 6, right(n) + 6, bottom(n) + 6] as Rect);
  obstacles.push(headerRect);
  if (canvas.map) obstacles.push([canvas.MAP_X!, canvas.MAP_Y, canvas.MAP_X! + canvas.map[0], canvas.MAP_Y + canvas.map[1]]);
  obstacles.push(...g.notes.filter((_, i) => g.inline.has(i)).map(nt => { const [x, y, w, h] = g.noteRect(nt); return [x, y, x + w, y + h] as Rect; }));
  obstacles.push(...Object.keys(((doc.display as any)?.headers ?? {}) as object).map(g.headerRect));
  for (const s of r.segs) for (const [a, b] of segmentsOf(s)) obstacles.push(segRect(a, b, 6));

  for (const [a, b, lab] of episodes) {
    const rr = epiLabel(a, b, lab, "r")[2];
    if (!obstacles.some(o => ov(rr, o))) continue;
    const rl = epiLabel(a, b, lab, "l")[2];
    if (!obstacles.some(o => ov(rl, o))) { epiLeft.add(lab); continue; }
    const w = rl[2] - rl[0];
    for (const x of range(Math.trunc(rl[0]) + 100, Math.trunc(W - GUTTER - 14 - w), 100))
      if (!obstacles.some(o => ov([x, rl[1], x + w, rl[3]], o))) { epiX.set(lab, x); epiLeft.add(lab); break; }
  }
  for (const [a, b, lab] of episodes) if (epiLeft.has(lab)) obstacles.push(epiLabel(a, b, lab)[2]);

  // each era label on the left if free, otherwise at the first clear alternative
  const eraLabels = new Map<number, EraLabel>();
  for (const [yr, lab] of eras) {
    const y = Y(yr), w = textW(lab.toUpperCase(), 30) + 6 * pyLen(lab);
    const cands: [number, string][] = [[GUTTER + 14, "start"], [W - GUTTER - 14, "end"]];
    if (hd.arrange === "column") cands.splice(1, 0, [hd.x + hd.width + 44, "start"]);   // beside the card first
    for (const x of range(GUTTER + 214, Math.trunc(W - GUTTER - w), 100)) cands.push([x, "start"]);
    let chosen: EraLabel | null = null;
    for (const [d0, d1] of [[14, 48], [-42, -8]]) {                 // below the line, else above it
      for (const [x, anc] of cands) {
        const x0 = anc === "start" ? x : x - w, rc: Rect = [x0, y + d0, x0 + w, y + d1];
        const rr: Rect = [rc[0] - 30, rc[1], rc[2] + 30, rc[3]];   // clear of panels and boxes beside it
        if (!obstacles.some(o => ov(rr, o)) && ![...eraLabels.values()].some(q => ov(rc, q[2]))) { chosen = [x, anc, rc]; break; }
      }
      if (chosen) break;
    }
    eraLabels.set(yr, chosen ?? [GUTTER + 14, "start", [GUTTER + 14, y + 14, GUTTER + 14 + w, y + 48]]);
  }
  return { marks, brackets, bracketLabels, eraLabels, epiLeft, epiX, epiLabel, bgAt, warnings };
}

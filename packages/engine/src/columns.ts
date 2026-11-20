// The columns (PLAN Phase 5, step 5; the outlines, packing and layout_x of the Python compose.py): a tidy-tree
// packing. A parent sits straight over its main successor (the child with by far the largest branch) or
// centred over its children; every branch is packed as close to its neighbours as its own outline allows.
// Each person's notes, crown, house header and the line into them are part of that outline, so nothing
// collides. Hand nudges (dx) move a branch afterwards. Sets each box's x; the canvas (step 6) then moves the
// whole tree into place.
import { type Box, left, right } from "./boxes.ts";
import { type Doc, type Env, text } from "./doc.ts";
import type { Axis } from "./axis.ts";
import { type NoteText, noteText, snapWidth } from "./notes.ts";
import { BUS, CAP_ROOM, MINDROP } from "./rows.ts";
import type { Tables } from "./tables.ts";
import type { Group, Tree } from "./tree.ts";

export const GAP = 44;          // horizontal gap between neighbouring outlines
export const PILL_UP = 100;     // pill centre above its member's top
export const HDR_H = 118;       // house header height
export const BRACKET_LIFT = 14;

/** x0, y0, x1, y1 */
export type Rect = [number, number, number, number];

/** a note: [anchor, side, dx, dy, width, text] as the Python engine keeps it */
export type Note = [string, string, number, number, number, string];

export interface Geometry {
  notes: Note[];
  /** positions in notes of those drawn in full beside their person */
  inline: Set<number>;
  brackets: [string[], string][];
  bracketed: Set<string>;
  nt: NoteText;
  pillW: (k: string) => number;
  pillPos: (k: string) => [number, number];
  hdrW: (k: string) => number;
  headerRect: (k: string) => Rect;
  crownW: (k: string) => number;
  crownRect: (k: string) => Rect;
  noteRect: (n: Note) => [number, number, number, number];
  ownRects: (a: string) => Rect[];
  rects: (a: string) => Rect[];
  shift: (a: string, dx: number) => void;
  subtree: (a: string) => string[];
}

const top = (b: Box) => b.cy! - b.h / 2;
const bottom = (b: Box) => b.cy! + b.h / 2;
const yov = (r: Rect, p: Rect) => r[1] < p[3] && p[1] < r[3];

/** the outlines everything is packed and checked by; they read the boxes as they stand */
export function geometry(doc: Doc, env: Env, boxes: Map<string, Box>, t: Tables, tree: Tree, axis: Axis): Geometry {
  const N = (id: string) => boxes.get(id)!;
  const FS = doc.theme.type as Record<string, number>;
  const disp = (doc.display ?? {}) as Record<string, any>;
  const { regular, bold } = env.fonts.sans;
  const textW = (s: string, size: number, isBold = true) => (isBold ? bold : regular).width(s, size);
  const nt = noteText(doc, env.fonts);

  const offsets = new Map(Object.values((doc.adjustments ?? {}) as Record<string, any>)
    .filter(a => a.kind === "noteOffset").map(a => [a.target, [a.dx ?? 0, a.dy ?? 0]]));
  const notes: Note[] = [], inline = new Set<number>();
  for (const [nid, n] of Object.entries((doc.notes ?? {}) as Record<string, any>)) {
    const [dx, dy] = offsets.get(nid) ?? [0, 0];
    notes.push([n.anchor, n.show.side, dx, dy, n.show.width, text(doc, n.text)]);
    if (n.show.inline) inline.add(notes.length - 1);
  }
  const brackets: [string[], string][] = (disp.brackets ?? []).map((b: any) => [b.members, b.label]);
  const bracketed = new Set(brackets.flatMap(([ids]) => ids));
  const headers = (disp.headers ?? {}) as Record<string, any>;
  const eras = doc.timeline?.eras ?? [];

  const pillW = (k: string) => textW(t.pills.get(k)![0], 17) + 44;
  const pillPos = (k: string): [number, number] => [N(k).x, top(N(k)) - PILL_UP];
  const hdrW = (k: string) => {
    const h = headers[k], script = env.fonts.script!;
    const w = Math.max(script.width(h.name, 40 * env.fonts.scriptScale!), textW(`${h.years} · ${h.seat}`, 14.5, false) + 10,
                       textW(h.founded, 14.5, false) + 10, textW(String(h.kind).toUpperCase(), 14) * 1.12);
    return (h.emblem ? 90 + 16 : 0) + w + 12;
  };
  const headerRect = (k: string): Rect => {        // right of the pill (left for headerLeft), bottom-aligned with it
    const [x, cy] = pillPos(k);
    let x0 = x + pillW(k) / 2 + 18;
    if (t.headerLeft.has(k)) x0 = x - pillW(k) / 2 - 18 - hdrW(k);
    return [x0, cy + 19 - HDR_H, x0 + hdrW(k), cy + 19];
  };
  const crownW = (k: string) => 31 + textW(t.crowns.get(k)!, 18);
  const crownRect = (k: string): Rect => {
    const n = N(k), cx = n.pw ? left(n) + n.pw / 2 : n.x;     // centred over the portrait, clear of the line in
    const x0 = cx - crownW(k) / 2, up = bracketed.has(k) ? BRACKET_LIFT : 0;
    return [x0, top(n) - 31 - up, x0 + crownW(k), top(n) - 7 - up];
  };
  // the offsets an inline note may move by to keep clear of an era line: nearest first, up before down
  const OFFSETS = Array.from({ length: 161 }, (_, i) => -160 + 2 * i)
    .map((o, i) => [o, i]).sort(([o, i], [p, j]) => Math.abs(o) - Math.abs(p) || i - j).map(([o]) => o);
  const OFFSETS_B = OFFSETS.filter(o => o >= 0);
  const noteRect = ([anchorId, side, dx, dy, w0, h]: Note): [number, number, number, number] => {
    const n = N(anchorId), w = snapWidth(w0);
    const height = nt.wrapLines(nt.nobreak(h), w) * FS.note * 1.3;
    let x: number, y: number;
    if (side === "r") { x = right(n) + 26 + dx; y = top(n) + dy; }
    else if (side === "l") { x = left(n) - 26 - w + dx; y = top(n) + dy; }
    else if (side === "t") {           // above the box, over the line into it; may sit on an era line
      let cx = n.x;
      for (const [ids] of brackets) if (ids.includes(anchorId)) {     // centred on the person's bracket
        const ns = ids.map(N);
        cx = (Math.min(...ns.map(left)) + Math.max(...ns.map(right))) / 2;
      }
      return [cx - w / 2 + dx, top(n) + dy - height, w, height];
    } else { x = n.x - w / 2 + dx; y = bottom(n) + 10 + dy; }
    const eraYs = eras.slice(1).map((e: any) => axis.Y(e.year));
    for (const o of side === "b" ? OFFSETS_B : OFFSETS)
      if (eraYs.every((ey: number) => !(y + o - 10 < ey && ey < y + o + height + 10))) { y += o; break; }
    return [x, y, w, height];
  };

  const ownRects = (a: string): Rect[] => {
    const rs: Rect[] = [];
    for (const m of tree.members(a)) {
      const n = N(m);
      rs.push([left(n), top(n), right(n), bottom(n)]);
      if (t.crowns.has(m)) rs.push(crownRect(m));
      if (n.tag) rs.push([right(n) - 110, top(n) - 30, right(n) + 12, top(n)]);
      if (t.pills.has(m)) {
        const [px, py] = pillPos(m), w = pillW(m);
        rs.push([px - w / 2, py - 19, px + w / 2, py + 19]);
        if (m in headers) rs.push(headerRect(m));
      }
      if (tree.capKids.has(m)) rs.push([n.x + 8, top(n) - MINDROP - CAP_ROOM + 4, n.x + 30 + 230, top(n) - 6]);
      notes.forEach((note, i) => {
        if (inline.has(i) && note[0] === m) {
          const [x, y, w, h] = noteRect(note);
          rs.push([x, y, x + w, y + h]);
        }
      });
    }
    return rs;
  };
  const unitBottom = (a: string) => Math.max(...tree.members(a).filter(m => !t.follow.has(m)).map(m => bottom(N(m))));
  const rects = (a: string): Rect[] => {
    const rs = ownRects(a), yb = unitBottom(a) + BUS;
    for (const k of tree.kidsOf(a)) {
      const kn = N(k);
      rs.push([kn.x - 8, yb, kn.x + 8, top(kn)]);      // the line down into the child
      rs.push(...rects(k));
    }
    return rs;
  };
  const subtree = (a: string): string[] => [...tree.members(a), ...tree.kidsOf(a).flatMap(subtree)];
  const shift = (a: string, dx: number) => { for (const id of subtree(a)) N(id).x += dx; };
  return { notes, inline, brackets, bracketed, nt, pillW, pillPos, hdrW, headerRect, crownW, crownRect, noteRect,
           ownRects, rects, shift, subtree };
}

function pushRight(rs: Rect[], placed: Rect[]): number | null {
  let need: number | null = null;
  for (const r of rs) for (const p of placed) if (yov(r, p)) { const v = p[2] + GAP - r[0]; if (need === null || v > need) need = v; }
  return need;
}

function pushLeft(rs: Rect[], placed: Rect[]): number | null {
  let need: number | null = null;
  for (const r of rs) for (const p of placed) if (yov(r, p)) { const v = p[0] - GAP - r[2]; if (need === null || v < need) need = v; }
  return need;
}

/** lay the tree out across: every box's x, the root at 0, then the hand nudges */
export function placeColumns(boxes: Map<string, Box>, ties: Map<string, string>, t: Tables, tree: Tree, g: Geometry,
                             spouseDx: Map<string, number>): void {
  const N = (id: string) => boxes.get(id)!;
  const { rects, ownRects, shift } = g;
  const origin = (a: string, grp: Group) => {
    if (grp.src[0] === "d") return N(a).x;
    let [, l, r] = grp.src;
    if (N(l).x > N(r).x) [l, r] = [r, l];
    return (right(N(l)) + left(N(r))) / 2;
  };
  const placeRight = (k: string, prev: string, placed: Rect[]) => {   // just right of what is placed
    const p = N(prev), n = N(k);
    shift(k, right(p) + GAP + n.pw + n.lw / 2 - n.x);               // at least side by side with prev
    const dx = pushRight(rects(k), placed);
    if (dx !== null && dx > 0) shift(k, dx);
  };
  const placeLeft = (k: string, prev: string, placed: Rect[]) => {
    const p = N(prev), n = N(k);
    shift(k, left(p) - GAP - n.lw / 2 - n.x);
    const dx = pushLeft(rects(k), placed);
    if (dx !== null && dx < 0) shift(k, dx);
  };

  const layout = (a: string) => {
    const ms = tree.members(a);
    for (const m of ms) if (ties.has(m)) N(m).x = N(ties.get(m)!).x + spouseDx.get(m)!;
    for (const [f, lead] of t.follow) if (ms.includes(lead)) N(f).x = N(lead).x + (t.followDx.get(f) ?? 0);
    const groups = tree.groups.get(a)!.map((grp, i) => [grp, i] as const)
      .sort(([p, i], [q, j]) => p.side - q.side || Number(p.centre) - Number(q.centre) || i - j).map(([grp]) => grp);
    if (!groups.length) return;
    for (const grp of groups) for (const k of grp.kids) { N(k).x = 0; layout(k); }
    const allkids = groups.flatMap(grp => grp.kids);
    const sizes = allkids.map(tree.size).sort((p, q) => q - p);
    let spine: string | null = null;
    if (allkids.length === 1) spine = allkids[0];
    else if (sizes[0] >= Math.max(4, 2 * sizes[1]))
      spine = allkids.reduce((best, k) => (tree.size(k) > tree.size(best) ? k : best));

    const arrange = (grp: Group) => {
      const o = origin(a, grp), ks = grp.kids;
      if (spine !== null && ks.includes(spine)) {
        const i = ks.indexOf(spine);
        shift(spine, o - N(spine).x);
        const placed = rects(spine);
        let prev = spine;
        for (const k of ks.slice(i + 1)) { placeRight(k, prev, placed); placed.push(...rects(k)); prev = k; }
        prev = spine;
        for (const k of ks.slice(0, i).reverse()) { placeLeft(k, prev, placed); placed.push(...rects(k)); prev = k; }
      } else {
        shift(ks[0], o - N(ks[0]).x);
        const placed = rects(ks[0]);
        for (let j = 1; j < ks.length; j++) { placeRight(ks[j], ks[j - 1], placed); placed.push(...rects(ks[j])); }
        const mid = (N(ks[0]).x + N(ks[ks.length - 1]).x) / 2;
        for (const k of ks) shift(k, o - mid);
      }
    };
    for (const grp of groups) arrange(grp);

    let centre = groups.findIndex(grp => grp.centre);
    if (centre < 0) centre = groups.findIndex(grp => spine !== null && grp.kids.includes(spine));
    if (centre < 0) centre = groups.reduce((best, grp, i) => (Math.abs(grp.side) < Math.abs(groups[best].side) ? i : best), 0);
    const kidRects = (grp: Group) => grp.kids.flatMap(rects);
    const placed = [...ownRects(a), ...kidRects(groups[centre])];
    for (const grp of groups.slice(centre + 1)) {
      const dx = pushRight(kidRects(grp), placed);
      if (dx && dx > 0) for (const k of grp.kids) shift(k, dx);
      placed.push(...kidRects(grp));
    }
    for (const grp of groups.slice(0, centre).reverse()) {
      const dx = pushLeft(kidRects(grp), placed);
      if (dx && dx < 0) for (const k of grp.kids) shift(k, dx);
      placed.push(...kidRects(grp));
    }
  };

  N(tree.root).x = 0;
  layout(tree.root);
  for (const [id, [dx]] of t.nudge) if (dx) shift(id, dx);
}

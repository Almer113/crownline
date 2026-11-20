// Line routing (PLAN Phase 5, step 7; the "drawing state" and line functions of the Python build.py): the
// lines from parents to children and between partners, as segments. Each line leaves its parent (or the
// middle of a marriage line), runs along a horizontal "bus" at a level that is clear of boxes, text, era
// lines and other buses, and drops into the top of each child; a child level with its parent is reached by
// a hook. Tree lines are drawn first, then marriages, then the cross-house lines that hop over them.
import { type Box, left, right } from "./boxes.ts";
import type { Doc } from "./doc.ts";
import type { Axis } from "./axis.ts";
import type { Geometry, Rect } from "./columns.ts";
import type { Desc, Marr, Tables } from "./tables.ts";
import { issue, type Issue } from "./checks.ts";

export const LINE = 4.5;
export const BUS = 30;          // preferred drop from a parent to the horizontal line
export const BUS_GAP = 30;      // minimum distance between two parallel horizontal lines
export const ERA_CLEAR = 22;    // lines keep this far from era lines
export const CORNER = 14;       // radius of rounded line elbows

export type Pt = [number, number];

export interface Seg { pts: Pt[]; col: string; style: string; hop: boolean; owner: string; order: number }

/** a horizontal run already used: y, x0, x1, the line's owner */
export type HRun = [number, number, number, string];

export interface Routing {
  segs: Seg[];
  /** "owner kid" -> x, y from, y to, colour: the drop into a child (a child may have more than one line) */
  drops: Map<string, [number, number, number, string]>;
  hruns: HRun[];
  /** buses that could not find a clear level */
  fallbacks: string[];
  /** lines that share the level of another line from the same parent */
  shared: Set<string>;
  /** line owner -> the point its line leaves the parent, rounded */
  source: Map<string, Pt>;
  pillPos: Map<string, Pt>;
  /** text blocks a horizontal line must not cross (house headers, crowns, pills, inline notes) */
  obst: Rect[];
  warnings: Issue[];
}

/** Python's round(): halves go to the even neighbour */
export function pyRound(v: number): number {
  const f = Math.floor(v), d = v - f;
  return d > 0.5 ? f + 1 : d < 0.5 ? f : f % 2 === 0 ? f : f + 1;
}

/** Python's range(a, b, step) */
function range(a: number, b: number, step: number): number[] {
  const out: number[] = [];
  if (step > 0) for (let v = a; v < b; v += step) out.push(v);
  else for (let v = a; v > b; v += step) out.push(v);
  return out;
}

const top = (b: Box) => b.cy! - b.h / 2;
const bottom = (b: Box) => b.cy! + b.h / 2;
const T = (b: Box): Pt => [b.x, top(b)];
const B = (b: Box): Pt => [b.x, bottom(b)];

/** the stable sort Python's sorted(key=...) is */
const sortBy = <V>(xs: V[], key: (v: V) => number) =>
  xs.map((v, i) => [v, key(v), i] as const).sort((p, q) => p[1] - q[1] || p[2] - q[2]).map(([v]) => v);

/** levels: in frozen mode, each line's locked levels by its document id (the lock's "lines") */
export function route(doc: Doc, boxes: Map<string, Box>, ties: Map<string, string>, t: Tables, g: Geometry,
                      axis: Axis, levels: Record<string, number[]> | null = null): Routing {
  const N = (id: string) => boxes.get(id)!;
  const pal = (doc.theme as any).palette as Record<string, string>;
  const GREYLINE = pal.greyLine;
  const HOUSE = new Map(Object.entries(doc.houses).map(([h, v]) => [h, (v as any).colour as string]));
  const house = (h: string | null | undefined) => (h != null && HOUSE.has(h) ? HOUSE.get(h)! : GREYLINE);
  const nodeCol = (n: Box, fallback: string | null) => house(n.house !== null && HOUSE.has(n.house) ? n.house : fallback);
  const headers = Object.keys(((doc.display as any)?.headers ?? {}) as Record<string, unknown>);
  const eraYs = () => (doc.timeline?.eras ?? []).slice(1).map((e: any) => axis.Y(e.year));
  const nodes = [...boxes.values()];

  const segs: Seg[] = [], drops = new Map<string, [number, number, number, string]>(), hruns: HRun[] = [];
  const fallbacks: string[] = [], shared = new Set<string>(), source = new Map<string, Pt>();
  const pillPos = new Map<string, Pt>(), warnings: Issue[] = [];
  const obst: Rect[] = [
    ...headers.map(g.headerRect), ...[...t.crowns.keys()].map(g.crownRect),
    ...[...t.pills.keys()].map(k => { const [x, cy] = g.pillPos(k), w = g.pillW(k); return [x - w / 2, cy - 19, x + w / 2, cy + 19] as Rect; }),
    ...g.notes.filter((_, i) => g.inline.has(i)).map(nt => { const [x, y, w, h] = g.noteRect(nt); return [x, y, x + w, y + h] as Rect; }),
  ];
  const sameSrc = (a: Pt | undefined, b: Pt | undefined) => a !== undefined && b !== undefined && a[0] === b[0] && a[1] === b[1];

  const addSeg = (pts: Pt[], col: string, style: string, hop: boolean, owner: string) =>
    segs.push({ pts, col, style, hop, owner, order: segs.length });
  const boxesHitH = (y: number, x0: number, x1: number, exclude: Set<string>, pad = 10) => {
    const lo = Math.min(x0, x1), hi = Math.max(x0, x1);
    return nodes.some(n => !exclude.has(n.id) && top(n) - pad < y && y < bottom(n) + pad && left(n) - pad < hi && lo < right(n) + pad);
  };
  const boxesHitV = (x: number, y0: number, y1: number, exclude: Set<string>, pad = 6) => {
    const lo = Math.min(y0, y1), hi = Math.max(y0, y1);
    return nodes.some(n => !exclude.has(n.id) && left(n) - pad < x && x < right(n) + pad && top(n) - pad < hi && lo < bottom(n) + pad);
  };
  const hitsObst = (y: number, x0: number, x1: number, pad = 8) => {
    const lo = Math.min(x0, x1), hi = Math.max(x0, x1);
    return obst.some(r => r[1] - pad < y && y < r[3] + pad && r[0] - pad < hi && lo < r[2] + pad);
  };
  const obstV = (x: number, y0: number, y1: number, pad = 8) => {
    const lo = Math.min(y0, y1), hi = Math.max(y0, y1);
    return obst.some(r => r[0] - pad < x && x < r[2] + pad && r[1] - pad < hi && lo < r[3] + pad);
  };
  const runsClear = (y: number, x0: number, x1: number, gap = 18) => {
    const lo = Math.min(x0, x1), hi = Math.max(x0, x1);
    return hruns.every(([hy, hx0, hx1]) => Math.abs(y - hy) >= gap || Math.min(hi, hx1) - Math.max(lo, hx0) <= 30);
  };

  /** the y of a horizontal bus: as close as possible to the preferred level, not through any box, not near
   *  another bus or an era line, with clear drops to the children */
  const freeBus = (sx: number, sy: number, xs: number[], kidTops: number[], exclude: Set<string>, owner: string,
                   ceiling: number | null = null, prefDrop: number | null = null, floor: number | null = null): number => {
    const y = autoBus(sx, sy, xs, kidTops, exclude, owner, ceiling, prefDrop, floor);
    const want = levels?.[owner[0] === "d" ? t.descIds[Number(owner.slice(1))][0] : t.marrIds[Number(owner.slice(1))]];
    if (!want?.length || want.includes(Math.round(y * 10) / 10)) return y;
    // frozen: the locked level nearest the preferred one that is still in range and clear of boxes and era lines
    const ylo = Math.max(sy + 22, floor || 0), yhi = Math.max(ylo, Math.min(...kidTops, ...(ceiling ? [ceiling] : [])) - 30);
    const x0 = Math.min(...xs, sx), x1 = Math.max(...xs, sx), eys = eraYs(), pref = sy + (prefDrop || BUS);
    const ok = sortBy(want.filter(w => ylo <= w && w <= yhi), w => Math.abs(w - pref)).find(w =>
      !eys.some(ey => Math.abs(w - ey) < ERA_CLEAR) && !boxesHitH(w, x0, x1, exclude) && !hitsObst(w, x0, x1)
      && !boxesHitV(sx, sy, w, exclude) && !xs.some((x, i) => boxesHitV(x, w, kidTops[i], exclude)));
    if (ok === undefined) return y;
    const i = fallbacks.indexOf(owner);
    if (i >= 0) fallbacks.splice(i, 1);
    shared.delete(owner);
    return ok;
  };
  const autoBus = (sx: number, sy: number, xs: number[], kidTops: number[], exclude: Set<string>, owner: string,
                   ceiling: number | null, prefDrop: number | null, floor: number | null): number => {
    source.set(owner, [pyRound(sx), pyRound(sy)]);
    const ylo = Math.max(sy + 22, floor || 0);       // floor: keep clear of the bottoms of the boxes it leaves
    const yhi = Math.min(...kidTops, ...(ceiling ? [ceiling] : [])) - 30;
    const pref = sy + (prefDrop || BUS);
    const cands = sortBy(range(Math.trunc(ylo), Math.trunc(Math.max(ylo, yhi)) + 1, 3), y => Math.abs(y - pref));
    const x0 = Math.min(...xs, sx), x1 = Math.max(...xs, sx), eys = eraYs();
    const usable: [number, number][] = [];
    for (const y of cands) {
      if (eys.some(ey => Math.abs(y - ey) < ERA_CLEAR)) continue;
      if (boxesHitH(y, x0, x1, exclude) || hitsObst(y, x0, x1)) continue;
      if (boxesHitV(sx, sy, y, exclude)) continue;
      if (xs.some((x, i) => boxesHitV(x, y, kidTops[i], exclude))) continue;
      const near = hruns.filter(([, hx0, hx1, o]) => Math.min(x1, hx1) - Math.max(x0, hx0) > 30 && o !== owner).map(([hy]) => Math.abs(y - hy));
      if (near.every(d => d >= BUS_GAP)) return y;
      usable.push([Math.min(...near), y]);
    }
    const levels = hruns.filter(([hy, , , o]) => sameSrc(source.get(o), source.get(owner)) && ylo <= hy && hy <= yhi);
    if (levels.length) { shared.add(owner); return levels[0][0]; }   // share the parent's existing line
    fallbacks.push(owner);
    if (usable.length)                               // best compromise: as far as possible from the other lines
      return usable.reduce((b, u) => (u[0] > b[0] || (u[0] === b[0] && u[1] > b[1]) ? u : b))[1];
    return Math.min(Math.max(pref, ylo), Math.max(ylo, yhi));
  };

  /** bus run + drop into child k; the colour changes at a house pill */
  const drawKid = (k: Box, x0: number, bus: number, houseCol: string, kidCol: string, style: string, hop: boolean, owner: string) => {
    if (t.pills.has(k.id)) {
      const [px, pcy] = g.pillPos(k.id);
      pillPos.set(k.id, [px, pcy]);
      addSeg([[x0, bus], [k.x, bus], [k.x, pcy]], houseCol, style, hop, owner);
      addSeg([[k.x, pcy], T(k)], kidCol, style, hop, owner);
    } else addSeg([[x0, bus], [k.x, bus], T(k)], kidCol, style, hop, owner);
    drops.set(`${owner} ${k.id}`, [k.x, bus, top(k), kidCol]);
  };

  /** a child level with its parent, entered from the top like every other child: down from the parent (or
   *  along its bus), across to a gap beside the child, up past it, over and down into it. ybs: candidate
   *  levels for the lower run, nearest first. The points from (sx, yb) on */
  const hook = (k: Box, sx: number, sy: number, ybs: number[], exclude: Set<string>): Pt[] | null => {
    const sides = sortBy([1, -1], sd => Math.abs((sd > 0 ? right(k) + 30 : left(k) - 30) - sx));
    const tops: Pt[] = [];                           // (xv, yt) whose upper part is clear
    for (const sd of sides) for (const dd of range(26, 160, 4)) {
      const xv = sd > 0 ? right(k) + dd : left(k) - dd;
      for (const yt of range(Math.trunc(top(k)) - 24, Math.trunc(top(k)) - 64, -3)) {
        if (boxesHitH(yt, xv, k.x, exclude) || hitsObst(yt, xv, k.x) || !runsClear(yt, xv, k.x)) continue;
        if (boxesHitV(k.x, yt, top(k), exclude) || boxesHitV(xv, yt, bottom(k), exclude, 14)) continue;
        tops.push([xv, yt]);
        break;
      }
    }
    for (const yb of ybs) {
      if (boxesHitV(sx, sy, yb, exclude)) continue;
      for (const [xv, yt] of tops) {
        if (boxesHitH(yb, sx, xv, exclude) || hitsObst(yb, sx, xv) || !runsClear(yb, sx, xv)) continue;
        if (boxesHitV(xv, yt, yb, exclude, 14) || obstV(xv, yt, yb)) continue;
        return [[sx, yb], [xv, yb], [xv, yt], [k.x, yt], [k.x, top(k)]];
      }
    }
    return null;
  };

  const drawDescend = (d: Desc, idx: number) => {
    const p = N(d.parent);
    let [sx, sy] = B(p), floor: number | null = null;
    if (d.couple_of) {                               // leave from the middle of the parents' marriage line
      const [ca, cb] = sortBy(d.couple_of.map(N), n => n.x);
      sx = (right(ca) + left(cb)) / 2; sy = ca.cy!;
      floor = Math.max(bottom(ca), bottom(cb)) + 14;  // not hugging the bottom of either partner's box
    }
    const kids = d.kids.map(N), styles = d.styles, owner = `d${idx}`, pcol = house(p.house);
    const st = (k: Box) => styles[k.id] ?? "solid";
    const col = (k: Box) => (st(k) === "grey" ? GREYLINE : nodeCol(k, p.house));

    if (d.row) {                                     // side by side on one row: a straight line
      const k = kids[0];
      addSeg([[right(p), p.cy!], [left(k), k.cy!]], col(k), st(k), false, owner);
      return;
    }
    if (kids.length === 1 && Math.abs(kids[0].x - sx) < 1 && !d.branch && !d.drop) {
      const k = kids[0];
      drawKid(k, sx, sy, pcol, col(k), st(k), d.hop, owner);
      return;
    }
    const exclude = new Set([p.id, ...kids.map(k => k.id)]);
    let ceiling: number | null = null;
    if (d.branch) {
      const straight = t.desc.filter(dd => dd.parent === p.id && !dd.branch).flatMap(dd => dd.kids).filter(c => Math.abs(N(c).x - p.x) < 1);
      if (!straight.length) throw new Error(`branch from ${p.id} needs a straight line below the parent`);
      ceiling = Math.min(...straight.map(c => top(N(c))));
    }
    if (kids.length === 1 && top(kids[0]) < sy + 60) {
      const k = kids[0];                             // level with the parent: a hook into the top of its box
      const y0 = Math.max(bottom(p), bottom(k)) + 12;
      const pts = hook(k, sx, sy, range(Math.trunc(y0), Math.trunc(y0) + 420, 3), exclude);
      if (pts === null) { warnings.push(issue("warning", "no-clean-line", `no clean line from ${p.id} to ${k.id}; relying on its label`, { people: [p.id, k.id] })); return; }
      const [[, yb], [xv], , [, yt]] = pts;
      hruns.push([yb, Math.min(sx, xv), Math.max(sx, xv), owner]);
      hruns.push([yt, Math.min(xv, k.x), Math.max(xv, k.x), owner]);
      addSeg([[sx, sy], ...pts], col(k), st(k), d.hop, owner);
      drops.set(`${owner} ${k.id}`, [k.x, yt, top(k), col(k)]);
      return;
    }
    const src: Pt = [pyRound(sx), pyRound(sy)];
    const runs = hruns.filter(r => sameSrc(source.get(r[3]), src) && r[3] !== owner);
    if (runs.length && t.descIds[idx].every(did => t.shareBus.has(did))) {     // continue the parent's line
      const bus = runs[0][0], on = runs.filter(r => r[0] === bus);
      const hx0 = Math.min(...on.map(r => r[1])), hx1 = Math.max(...on.map(r => r[2]));
      source.set(owner, src);
      for (const k of kids) {
        const x0 = k.x > hx1 ? hx1 : k.x < hx0 ? hx0 : k.x;
        hruns.push([bus, Math.min(x0, k.x), Math.max(x0, k.x), owner]);
        drawKid(k, x0, bus, pcol, col(k), st(k), d.hop, owner);
      }
      return;
    }
    const level = new Set(kids.filter(k => top(k) < sy + 60).map(k => k.id));   // reached by a hook from the bus
    const bus = freeBus(sx, sy, kids.map(k => k.x), kids.map(k => (level.has(k.id) ? bottom(k) + 44 : top(k))),
                        exclude, owner, level.size ? null : ceiling, d.drop, floor);
    const xs = [sx, ...kids.map(k => k.x)];
    hruns.push([bus, Math.min(...xs), Math.max(...xs), owner]);
    if (!d.branch) {
      let trunk = "solid";
      if (kids.every(k => ["dot", "grey", "legend", "adopt"].includes(styles[k.id]))) trunk = styles[kids[0].id];
      addSeg([[sx, sy], [sx, bus]], trunk === "grey" ? GREYLINE : pcol, trunk, d.hop, owner);
    }
    for (const k of kids) {
      if (level.has(k.id)) {
        const pts = hook(k, sx, sy, [bus], exclude);
        if (pts === null) { warnings.push(issue("warning", "no-clean-line", `no clean line from ${p.id} to ${k.id}; relying on its label`, { people: [p.id, k.id] })); continue; }
        hruns.push([pts[3][1], Math.min(pts[2][0], k.x), Math.max(pts[2][0], k.x), owner]);
        addSeg(pts, col(k), st(k), d.hop, owner);
        drops.set(`${owner} ${k.id}`, [k.x, pts[3][1], top(k), col(k)]);
      } else drawKid(k, sx, bus, pcol, col(k), st(k), d.hop, owner);
    }
  };

  const drawMarriage = (m: Marr, idx: number) => {
    const A = N(m.a), Bn = N(m.b), y = A.cy!, owner = `m${idx}`, mcol = house(m.house);
    if (!m.kids.length) { addSeg([[right(A), y], [left(Bn), y]], mcol, m.style, false, owner); return; }
    let jx = (right(A) + left(Bn)) / 2;
    const kids = m.kids.map(N);
    // a child standing under the marriage line takes the drop straight down into its box
    const under = kids.filter(k => right(A) + 12 <= k.x && k.x <= left(Bn) - 12);
    if (under.length) { const j0 = jx; jx = under.reduce((b, k) => (Math.abs(k.x - j0) < Math.abs(b.x - j0) ? k : b)).x; }
    const anchor = ties.get(m.a) === m.b ? Bn : A, other = anchor === A ? Bn : A;
    const override = t.coupleLine.get(`${m.a} ${m.b}`);
    let h: string | null, royal: Box | null;
    if (override) { h = override; royal = anchor; }
    else {
      const kh = kids[0].house;
      h = kh === A.house || kh === Bn.house ? kh : (anchor.house || other.house);
      royal = anchor.house === h ? anchor : other.house === h ? other : null;
    }
    const pcol = house(h), kst = (k: Box) => m.kidStyles[k.id] ?? "solid";
    const trunk = kids.some(k => kst(k) === "solid") ? "solid" : m.kidStyles[kids[0].id];
    const tcol = trunk === "grey" ? GREYLINE : pcol;
    // the children's line leaves the line-carrying parent, runs to the middle of the marriage line and
    // drops from there; the other half is the marriage line itself
    if (royal === Bn) {
      addSeg([[right(A), y], [jx, y]], mcol, m.style, false, owner);
      addSeg([[left(Bn), y], [jx, y]], tcol, trunk, false, owner);
    } else if (royal === A) {
      addSeg([[right(A), y], [jx, y]], tcol, trunk, false, owner);
      addSeg([[jx, y], [left(Bn), y]], mcol, m.style, false, owner);
    } else addSeg([[right(A), y], [left(Bn), y]], mcol, m.style, false, owner);
    const col = (k: Box) => (kst(k) === "grey" ? GREYLINE : house(k.house || h));
    if (kids.length === 1 && Math.abs(kids[0].x - jx) < 2) {
      const k = kids[0];
      drawKid(k, jx, y, pcol, col(k), kst(k), false, owner);
      return;
    }
    const exclude = new Set([m.a, m.b, ...kids.map(k => k.id)]);
    const bus = freeBus(jx, Math.max(bottom(A), bottom(Bn)), kids.map(k => k.x), kids.map(top), exclude, owner);
    const xs = [jx, ...kids.map(k => k.x)];
    hruns.push([bus, Math.min(...xs), Math.max(...xs), owner]);
    addSeg([[jx, y], [jx, bus]], tcol, trunk, false, owner);
    for (const k of kids) drawKid(k, jx, bus, pcol, col(k), kst(k), false, owner);
  };

  t.desc.forEach((d, i) => { if (!d.hop) drawDescend(d, i); });     // tree lines first, then marriages,
  t.marr.forEach(drawMarriage);
  t.desc.forEach((d, i) => { if (d.hop) drawDescend(d, i); });      // then the cross-house lines over them
  return { segs, drops, hruns, fallbacks, shared, source, pillPos, obst, warnings };
}

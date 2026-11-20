// The rows (PLAN Phase 5, step 4; the "rows" section and the timeOrder pass of the Python compose.py): each
// person's vertical place. A generation sits one regular step below its parent; brothers and sisters whose
// dates are close share a row; a row goes lower only when its people's dates need it (a soft time axis,
// RATE px per year). With display.timeOrder, nobody is drawn above a person with an earlier year, and each
// era line after the first gets a gap of its own. Sets each box's cy; x is left to the columns (step 5).
import type { Box } from "./boxes.ts";
import type { Doc } from "./doc.ts";
import type { Tables } from "./tables.ts";
import type { Tree } from "./tree.ts";

export const BUS = 30;          // parent bottom -> horizontal line into the children
export const MINDROP = 50;      // that line -> child top
export const HDR_ROOM = 205;    // extra drop for the first member of a house (pill and house header)
export const CAP_ROOM = 40;     // extra drop when a label sits on the line into a child
export const RATE = 4.6;        // soft time axis, px per year
export const SIB_YEARS = 20;    // siblings whose dates are this close share a row
export const TOP_GAP = 150;     // a "top" card: from its bottom to the first row
export const ERA_ROOM = 70;     // timeOrder: the gap between the rows either side of an era line

export type Arrange = "row" | "column" | "top";

/** the header card: where it sits and how (panels.header) */
export interface HeaderPanel { x: number; y: number; width: number; height: number; arrange: Arrange }

export function headerPanel(doc: Doc): HeaderPanel {
  const h = (doc.panels as any).header;
  return { x: h.x, y: h.y, width: h.width, height: h.height, arrange: h.arrange ?? "row" };
}

export interface Rows {
  /** the soft time axis: a year's y before the fit */
  T: (year: number) => number;
  tBase: number;
  /** the axis runs from year0 (the half-century before the first era or person) to year1 (the decade after "as of") */
  year0: number;
  year1: number;
  now: number;
  eras: number[];
  timeOrder: boolean;
  /** the people the time order compares (no spouses, followers, text or legend boxes), in document order */
  dated: Box[];
  /** timeOrder: the lowest row each person may be on */
  floor: Map<string, number>;
  crownRoom: (k: string) => number;
  rootY: number;
}

const top = (b: Box) => b.cy! - b.h / 2;
const bottom = (b: Box) => b.cy! + b.h / 2;

export function placeRows(doc: Doc, boxes: Map<string, Box>, ties: Map<string, string>, t: Tables, tree: Tree,
                          header: HeaderPanel = headerPanel(doc)): Rows {
  const N = (id: string) => boxes.get(id)!;
  const eras = (doc.timeline?.eras ?? []).map((e: any) => e.year as number);
  const timeOrder = Boolean((doc.display as any)?.timeOrder);
  const now = parseInt(String((doc.meta as any).asOf.edtf).slice(0, 4), 10);
  const tBase = eras.length ? eras[0] : Math.min(...[...boxes.values()].filter(n => n.year).map(n => n.year));
  const tTop = 330 + (header.arrange === "top" ? header.height + TOP_GAP : 0);
  const T = (year: number) => tTop + RATE * (year - tBase);
  const floor = new Map<string, number>();
  const crownRoom = (k: string) => (t.crowns.has(k) ? 34 : 0);

  const unitBottom = (a: string) => Math.max(...tree.members(a).filter(m => !t.follow.has(m)).map(m => bottom(N(m))));
  const setRow = (a: string, cy: number) => {
    const ms = tree.members(a);
    for (const m of ms) if (!t.follow.has(m)) N(m).cy = cy;
    for (const [f, lead] of t.follow) if (ms.includes(lead)) {
      const fn = N(f);
      fn.cy = top(N(lead)) - 60 - fn.h / 2;
    }
  };
  const needAbove = (k: string) => {
    if (N(k).kind === "legend") return BUS + 26;
    return BUS + MINDROP + (t.pills.has(k) ? HDR_ROOM : 0) + (tree.capKids.has(k) ? CAP_ROOM : 0);
  };
  const rows = (a: string) => {
    // a stable sort by year, as Python's sorted
    const kids = tree.kidsOf(a).map((k, i) => [k, i] as const)
      .sort(([p, i], [q, j]) => N(p).year - N(q).year || i - j).map(([k]) => k);
    const clusters: string[][] = [];
    for (const k of kids) {
      const last = clusters[clusters.length - 1];
      if (last && N(k).year - N(last[0]).year <= SIB_YEARS) last.push(k);
      else clusters.push([k]);
    }
    const base = unitBottom(a);
    for (const cl of clusters) {
      const y = Math.max(T(N(cl[0]).year), Math.max(...cl.map(k => base + needAbove(k) + N(k).h / 2)));
      for (const k of cl) {
        setRow(k, Math.max(y, floor.get(k) ?? 0) + (t.nudge.get(k)?.[1] ?? 0));
        rows(k);
      }
    }
  };

  const rootY = header.y + 40 + (header.arrange === "top" ? header.height + TOP_GAP : 0);
  setRow(tree.root, rootY);
  rows(tree.root);

  const dated = [...boxes.values()].filter(n => n.year && !ties.has(n.id) && !t.follow.has(n.id)
                                               && n.kind !== "text" && n.kind !== "legend");
  if (timeOrder) {
    // lower each row to the lowest earlier-dated row (a person's own descendants don't count) and lay the
    // tree out again, until nothing moves; everyone from an era's year on goes below everyone before it
    const subtree = (a: string): string[] => [...tree.members(a), ...tree.kidsOf(a).flatMap(subtree)];
    const below = new Map(dated.map(n => [n.id, new Set(subtree(n.id))]));
    for (let pass = 0; pass < dated.length; pass++) {
      let moved = false;
      for (const n of dated) {
        const mine = below.get(n.id)!;
        const earlier = dated.filter(m => m.year < n.year && !mine.has(m.id)).map(m => m.cy!);
        let low = earlier.length ? Math.max(...earlier) : 0;
        for (const e of eras.slice(1)) {
          const before = dated.filter(m => m.year < e && e <= n.year && !mine.has(m.id)).map(bottom);
          if (before.length) low = Math.max(low, Math.max(...before) + ERA_ROOM + crownRoom(n.id) + n.h / 2);
        }
        if (low > (floor.get(n.id) ?? 0) + 0.5) { floor.set(n.id, low); moved = true; }
      }
      if (!moved) break;
      setRow(tree.root, rootY);
      rows(tree.root);
    }
  }
  return { T, tBase, year0: Math.floor(tBase / 50) * 50, year1: (Math.floor(now / 10) + 1) * 10, now, eras,
           timeOrder, dated, floor, crownRoom, rootY };
}

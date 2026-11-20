// The background time axis (PLAN Phase 5, step 6; fit_axis, Y and the era-gap pass of the Python compose.py):
// fitted to where people actually are, a monotone (isotonic) fit of row position against year, so the
// half-century bands and era lines stay a faithful but gentle guide. Runs after the rows and before the
// columns, which need it (an inline note keeps clear of the era lines). The canvas may later lift the end.
import type { Box } from "./boxes.ts";
import type { Rows } from "./rows.ts";
import { RATE } from "./rows.ts";
import type { Tables } from "./tables.ts";

export interface Axis {
  /** the years the axis passes through, in order */
  years: number[];
  /** year -> y; the canvas step may still change it */
  ymap: Map<number, number>;
  /** any year's y: straight lines between the fitted years, RATE px per year beyond them */
  Y: (year: number) => number;
}

const top = (b: Box) => b.cy! - b.h / 2;
const bottom = (b: Box) => b.cy! + b.h / 2;

export function fitAxis(boxes: Map<string, Box>, ties: Map<string, string>, t: Tables, rows: Rows): Axis {
  const pts = new Map<number, number[]>();
  for (const n of boxes.values()) {
    if (ties.has(n.id) || t.follow.has(n.id) || n.kind === "text" || n.kind === "legend") continue;
    if (!pts.has(n.year)) pts.set(n.year, []);
    pts.get(n.year)!.push(n.cy!);
  }
  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);     // left to right, as Python's sum
  const xs = [...pts.keys()].sort((a, b) => a - b);
  const blocks: [number, number, number[]][] = xs.map(x => [sum(pts.get(x)!) / pts.get(x)!.length, pts.get(x)!.length, [x]]);
  let i = 0;
  while (i < blocks.length - 1) {                 // pool adjacent violators
    if (blocks[i][0] > blocks[i + 1][0]) {
      const [v0, w0, x0] = blocks[i], [v1, w1, x1] = blocks[i + 1];
      blocks[i] = [(v0 * w0 + v1 * w1) / (w0 + w1), w0 + w1, [...x0, ...x1]];
      blocks.splice(i + 1, 1);
      i = Math.max(i - 1, 0);
    } else i++;
  }
  const fit = new Map<number, number>();
  for (const [v, , yrs] of blocks) {
    const lo = Math.min(...yrs), hi = Math.max(...yrs);
    for (const yr of yrs) fit.set(yr, hi === lo ? v : v - 40 + 80 * (yr - lo) / (hi - lo));   // spread a pooled block
  }
  const eraYears = rows.eras;
  for (const yr of [...eraYears, rows.year0, rows.year1]) {
    if (fit.has(yr)) continue;                    // anchor era years on the fitted curve
    const ks = [...fit.keys()], below = ks.filter(x => x < yr), above = ks.filter(x => x > yr);
    const lo = below.length ? Math.max(...below) : null, hi = above.length ? Math.min(...above) : null;
    if (lo !== null && hi !== null) fit.set(yr, fit.get(lo)! + (fit.get(hi)! - fit.get(lo)!) * (yr - lo) / (hi - lo));
    else if (lo !== null) fit.set(yr, fit.get(lo)! + RATE * (yr - lo));
    else fit.set(yr, fit.get(hi!)! - RATE * (hi! - yr));
  }
  const years = [...fit.keys()].sort((a, b) => a - b), ymap = new Map<number, number>();
  let prev: number | null = null;
  for (const yr of years) {
    let y = fit.get(yr)!;
    if (prev !== null) {
      y = Math.max(y, ymap.get(prev)! + 1.5 * (yr - prev));
      if (eraYears.includes(yr)) {                // consecutive era lines stay at least 90 px apart
        const earlier = eraYears.filter(e => e < yr), last = earlier.length ? Math.max(...earlier) : null;
        if (last !== null && ymap.has(last)) y = Math.max(y, ymap.get(last)! + 90);
      }
    }
    ymap.set(yr, y);
    prev = yr;
  }

  if (rows.timeOrder) {
    // each era line (after the first) halfway across the gap kept for it, the axis bent to match
    for (const e of eraYears.slice(1)) {
      const ups = rows.dated.filter(m => m.year < e).map(bottom);
      const dns = rows.dated.filter(m => m.year >= e).map(m => top(m) - rows.crownRoom(m.id));
      if (!ups.length || !dns.length) continue;
      const up = Math.max(...ups), dn = Math.min(...dns);
      if (up >= dn) continue;
      ymap.set(e, (up + dn) / 2);
      for (const yr of years) {
        if (yr < e) ymap.set(yr, Math.min(ymap.get(yr)!, ymap.get(e)! - 1.5 * (e - yr)));
        else if (yr > e) ymap.set(yr, Math.max(ymap.get(yr)!, ymap.get(e)! + 1.5 * (yr - e)));
      }
    }
  }

  const Y = (year: number) => {
    const first = years[0], last = years[years.length - 1];
    if (year <= first) return ymap.get(first)! - RATE * (first - year);
    if (year >= last) return ymap.get(last)! + RATE * (year - last);
    let j = 0;
    while (years[j] < year) j++;                  // bisect_left
    if (years[j] === year) return ymap.get(year)!;
    const a = years[j - 1], b = years[j];
    return ymap.get(a)! + (ymap.get(b)! - ymap.get(a)!) * (year - a) / (b - a);
  };
  return { years, ymap, Y };
}

// The layout lock (PLAN Phase 5, frozen mode; research 1.5; the Python tests/layout_snapshot.py): the
// accepted position of everything the engine places, kept beside the chart as layout.lock.json.
//
//   lockOf(doc, c, page)   the lock of a layout: boxes, the line into each child, line levels, inline notes
//                          and note letters, pills, house headers, crowns, brackets, the era axis and labels
//   diffLock(old, cur)     what moved between two locks, as report lines (empty: nothing moved)
//   freeze(c, lock)        a composed layout pinned to a lock: every locked box goes back to its locked place,
//                          a new person keeps their place relative to their nearest locked ancestor, the era
//                          years keep their y; the router then takes each line's locked level when it is still
//                          possible (route's `levels`). Unchanged content gives the lock back exactly.
import type { LockT } from "@crownline/schema";
import { left, right, type Box } from "./boxes.ts";
import { GAP } from "./columns.ts";
import type { Composed } from "./compose.ts";
import type { Doc } from "./doc.ts";
import { pyFixed } from "./py.ts";
import { letter, type Page } from "./render.ts";
import { pyRound } from "./routing.ts";

export type Lock = LockT;
export const LOCK_SECTIONS = ["boxes", "drops", "lines", "notes", "letters", "pills", "headers", "crowns", "brackets", "axis", "eraLabels"] as const;
export const TOL = 0.5;      // px: smaller differences are not moves

const r1 = (v: number) => Number(pyFixed(v, 1)) + 0;          // round(v, 1), and no -0
const rect = (r: readonly number[]) => r.map(r1);
const top = (b: Box) => b.cy! - b.h / 2, bottom = (b: Box) => b.cy! + b.h / 2;

/** a line's name in the document: its first descent's id, or its union's (from the router's owner id) */
export function lineName(c: Composed, owner: string): string {
  const i = Number(owner.slice(1));
  return owner[0] === "d" ? c.tables.descIds[i][0] : c.tables.marrIds[i];
}

/** the lock of a laid-out chart (the Python layout_snapshot.current) */
export function lockOf(doc: Doc, c: Composed, page: Page): Lock {
  const { boxes, tables: t, geometry: g, axis } = c, r = page.routing;
  const levels: Record<string, number[]> = {};
  for (const s of r.segs) {
    const k = lineName(c, s.owner), ys = new Set(levels[k] ?? []);
    for (let i = 0; i + 1 < s.pts.length; i++) {
      const [[x0, y0], [x1, y1]] = [s.pts[i], s.pts[i + 1]];
      if (Math.abs(y0 - y1) < 0.01 && Math.abs(x0 - x1) > TOL) ys.add(r1(y0));     // a jog under TOL is not a level
    }
    levels[k] = [...ys].sort((a, b) => a - b);
  }
  const noteIds = Object.keys((doc.notes ?? {}) as object);
  const idOf = new Map(g.notes.map((nt, i) => [nt, noteIds[i]]));
  const notes: Record<string, number[]> = {};
  g.notes.forEach((nt, i) => {
    if (!g.inline.has(i)) return;
    const [x, y, w, h] = g.noteRect(nt);
    notes[noteIds[i]] = rect([x, y, x + w, y + h]);
  });
  const descentOf = (owner: string, kid: string) => {
    const i = Number(owner.slice(1));
    if (owner[0] === "d") return t.descIds[i][t.desc[i].kids.indexOf(kid)];
    const uid = t.marrIds[i];
    return Object.entries((doc.descents ?? {}) as Record<string, any>).find(([, d]) => d.union === uid && d.child === kid)![0];
  };
  const keys = [...r.drops.keys()].map(k => k.split(" ") as [string, string]);
  const count = new Map<string, number>();
  for (const [, kid] of keys) count.set(kid, (count.get(kid) ?? 0) + 1);
  const drops: Record<string, number[]> = {};
  for (const [owner, kid] of keys) {
    const v = r.drops.get(`${owner} ${kid}`)!;
    drops[count.get(kid)! > 1 ? `${kid}@${descentOf(owner, kid)}` : kid] = [r1(v[0]), r1(v[1])];
  }
  const eras = (doc.timeline?.eras ?? []) as { year: number }[];
  return {
    format: 1,
    chart: doc.meta.id,
    canvas: [c.canvas.W, c.canvas.HGT],
    errors: page.report.errors.length,
    warnings: [...page.report.warnings],
    boxes: Object.fromEntries([...boxes.values()].map(n => [n.id, rect([left(n), top(n), right(n), bottom(n)])])),
    drops,
    lines: levels,
    notes,
    letters: Object.fromEntries(page.lettered.map((nt, i) => [idOf.get(nt)!, letter(i)])),
    pills: Object.fromEntries([...r.pillPos].map(([k, [x, y]]) => [k, [r1(x), r1(y)]])),
    headers: Object.fromEntries(Object.keys(((doc.display as any)?.headers ?? {}) as object).map(k => [k, rect(g.headerRect(k))])),
    crowns: Object.fromEntries([...t.crowns.keys()].map(k => [k, rect(g.crownRect(k))])),
    brackets: Object.fromEntries(g.brackets.map(([ids], i) => [ids.join("+"), [r1(page.labels.brackets[i].x0), r1(page.labels.brackets[i].x1), r1(page.labels.brackets[i].y)]])),
    axis: Object.fromEntries(eras.map(e => [String(e.year), r1(axis.Y(e.year))])),
    eraLabels: Object.fromEntries([...page.labels.eraLabels].map(([yr, [, , rr]]) => [String(yr), rect(rr)])),
  };
}

// ---------------------------------------------------------------- the diff
const num = (v: unknown): v is number => typeof v === "number";
/** the largest difference between two positions (lists of numbers, or strings) */
function moved(a: unknown, b: unknown): number {
  if (typeof a === "string" || typeof b === "string") return a === b ? 0 : Infinity;
  const p = num(a) ? [a] : (a as number[]), q = num(b) ? [b] : (b as number[]);
  if (p.length !== q.length) return Infinity;
  return Math.max(0, ...p.map((x, i) => Math.abs(x - q[i])));
}
const pyFloat = (v: number) => (Number.isInteger(v) ? `${v}.0` : String(v));
const signed = (v: number) => (v < 0 || Object.is(v, -0) ? "-" : "+") + pyFloat(Math.abs(v));
const signedInt = (v: number) => (v < 0 ? "-" : "+") + Math.abs(v);
/** a value as Python prints it: the lock's positions are floats (965.0), the canvas whole pixels */
const show = (v: unknown, floats = true): string =>
  Array.isArray(v) ? `[${v.map(x => show(x, floats)).join(", ")}]`
    : typeof v === "number" ? (floats ? pyFloat(v) : String(v)) : typeof v === "string" ? `'${v}'` : String(v);

function describe(sec: string, k: string, a: any, b: any): string {
  if (["boxes", "notes", "headers", "crowns", "eraLabels"].includes(sec) && a.length === 4 && b.length === 4) {
    const d = b.map((y: number, i: number) => r1(y - a[i]));
    return `  ${k}: dx ${signed(d[0])} dy ${signed(d[1])} (width ${signed(r1(d[2] - d[0]))}, height ${signed(r1(d[3] - d[1]))})`;
  }
  if (sec === "lines") return `  ${k}: levels ${show(a)} -> ${show(b)}`;
  if (sec === "letters") return `  ${k}: letter ${a} -> ${b}`;
  return `  ${k}: ${show(a)} -> ${show(b)}`;
}

export const GROUP = 4;      // this many items moved by the same amount are reported on one line

function grouped(sec: string, keys: string[], o: Record<string, any>, c: Record<string, any>, every: boolean): string[] {
  if (every) return keys.map(k => describe(sec, k, o[k], c[k]));
  const groups = new Map<string, { d: (number | string)[]; ks: string[] }>();
  for (const k of keys) {
    const a = o[k], b = c[k];
    const shape = Array.isArray(a) && Array.isArray(b) && a.length === b.length && [2, 4].includes(a.length) && [...a, ...b].every(num);
    const d: (number | string)[] = shape ? b.map((y: number, i: number) => pyRound(y - a[i])) : ["own", k];
    const key = JSON.stringify(d);
    if (!groups.has(key)) groups.set(key, { d, ks: [] });
    groups.get(key)!.ks.push(k);
  }
  const out: string[] = [], single: string[] = [];
  for (const { d, ks } of [...groups.values()].sort((p, q) => q.ks.length - p.ks.length)) {
    if (ks.length < GROUP || d[0] === "own") { single.push(...ks); continue; }
    const [dx, dy] = d as number[];
    const size = d.length === 2 || (d[2] === dx && d[3] === dy) ? "" : `, resized ${signedInt((d[2] as number) - dx)} x ${signedInt((d[3] as number) - dy)}`;
    const names = ks.slice(0, 8).join(", ") + (ks.length > 8 ? `, ... (+${ks.length - 8} more)` : "");
    out.push(`  ${ks.length} moved together, dx ${signedInt(dx)} dy ${signedInt(dy)}${size}: ${names}`);
  }
  return [...out, ...single.sort().map(k => describe(sec, k, o[k], c[k]))];
}

/** the differences between two locks, as report lines (the Python layout_snapshot.diff); empty when
 *  nothing moved. Items that moved by the same amount are one line: a re-flowed branch reads as one move. */
export function diffLock(old: Lock, cur: Lock, every = false): string[] {
  const problems: string[] = [];
  if (cur.errors) problems.push(`layout check reports ${cur.errors} errors`);
  if (JSON.stringify(cur.warnings) !== JSON.stringify(old.warnings)) problems.push(`warnings changed: ${show(old.warnings)} -> ${show(cur.warnings)}`);
  if (JSON.stringify(cur.canvas) !== JSON.stringify(old.canvas)) problems.push(`canvas changed: ${show(old.canvas, false)} -> ${show(cur.canvas, false)}`);
  for (const sec of LOCK_SECTIONS) {
    const o = (old[sec] ?? {}) as Record<string, any>, c = (cur[sec] ?? {}) as Record<string, any>;
    const added = Object.keys(c).filter(k => !(k in o)).sort(), removed = Object.keys(o).filter(k => !(k in c)).sort();
    if (added.length) problems.push(`${sec} added: ${added.join(", ")}`);
    if (removed.length) problems.push(`${sec} removed: ${removed.join(", ")}`);
    const keys = Object.keys(o).filter(k => k in c).sort().filter(k => moved(o[k], c[k]) > TOL);
    if (keys.length) problems.push(`${sec}: ${keys.length} changed\n` + grouped(sec, keys, o, c, every).join("\n"));
  }
  return problems;
}

// ---------------------------------------------------------------- frozen mode
/** pin a composed layout to a lock, in place (see the top of this file); returns who was placed afresh */
export function freeze(c: Composed, lock: Lock): { placed: string[] } {
  const { boxes, tree, axis } = c;
  const auto = new Map([...boxes.values()].map(n => [n.id, [n.x, n.cy!] as const]));
  const delta = new Map<string, [number, number]>();
  // a position the lock holds to 0.1 px is kept exactly when it rounds to the locked value, so unchanged
  // content lays out exactly as before (the router's choices depend on the unrounded values)
  const same = (a: number[], b: readonly number[]) => a.every((v, i) => r1(v) === b[i]);
  for (const n of boxes.values()) {
    const r = lock.boxes[n.id];
    if (!r) continue;
    if (same([left(n), top(n), right(n), bottom(n)], r)) { delta.set(n.id, [0, 0]); continue; }
    // x is the label's centre: where the line into the box comes down (its drop), else from the rect
    // ([left, top, right, bottom]; left = x - lw/2 - pw, right = x + lw/2), so a box that grows or shrinks
    // keeps its centre and its line. Boxes that were in line share one drop x, and stay in line.
    const drop = lock.drops[n.id] ?? Object.entries(lock.drops).find(([k]) => k.startsWith(n.id + "@"))?.[1];
    const x = drop ? drop[0] : (r[0] + r[2] + n.pw) / 2, cy = (r[1] + r[3]) / 2;
    delta.set(n.id, [x - n.x, cy - n.cy!]);
    n.x = x; n.cy = cy;
  }
  // a spouse drawn beside a partner keeps the automatic distance from them once either one has changed
  // (a longer name, another portrait): the distance comes from their widths, so it is the lock's otherwise
  const depthOf = (id: string) => { let d = 0; for (let p = c.ties.get(id); p; p = c.ties.get(p)) d++; return d; };
  for (const [s, p] of [...c.ties].sort(([a], [b]) => depthOf(a) - depthOf(b))) {
    const ns = boxes.get(s)!, np = boxes.get(p)!, ds = delta.get(s), dp = delta.get(p);
    if (!ds || !dp || (!ds[0] && !ds[1] && !dp[0] && !dp[1])) continue;
    const x = np.x + (auto.get(s)![0] - auto.get(p)![0]);
    ds[0] += x - ns.x; ns.x = x;
  }
  // a child that was in line with its parent (to the lock's 0.1 px) stays exactly in line: no tiny jog
  for (const n of boxes.values()) {
    const p = boxes.get(tree.treeParent.get(n.id) ?? "");
    const d = delta.get(n.id);
    if (p && d && delta.has(p.id) && (d[0] || d[1]) && n.x !== p.x && Math.abs(n.x - p.x) < 0.1) {
      d[0] += p.x - n.x; n.x = p.x;
    }
  }
  // a new person moves with their nearest placed ancestor (a spouse with their partner), else stays; parents
  // first, so a new person's new children follow them. One who lands on a box slides sideways, in their row,
  // to the nearest clear place: the locked boxes never move for them.
  const placed: string[] = [];
  const up = (id: string) => c.ties.get(id) ?? tree.treeParent.get(id);
  const depth = (id: string) => { let d = 0; for (let p = up(id); p; p = up(p)) d++; return d; };
  const fresh = [...boxes.values()].filter(n => !lock.boxes[n.id]);
  const done = new Set<string>();
  for (const n of [...fresh].sort((a, b) => depth(a.id) - depth(b.id))) {
    let p = up(n.id);
    while (p && !delta.has(p)) p = up(p);
    const [dx, dy] = p ? delta.get(p)! : [0, 0];
    const [x, cy] = auto.get(n.id)!;
    n.x = x + dx; n.cy = cy + dy;
    if (!c.ties.has(n.id)) n.x += clearance(n, [...boxes.values()].filter(b =>
      b !== n && c.ties.get(b.id) !== n.id && (lock.boxes[b.id] || done.has(b.id))));
    delta.set(n.id, [n.x - x, n.cy - cy]);
    done.add(n.id);
  }
  for (const n of fresh) placed.push(n.id);
  for (const [yr, y] of Object.entries(lock.axis))
    if (axis.ymap.has(Number(yr)) && r1(axis.ymap.get(Number(yr))!) !== y) axis.ymap.set(Number(yr), y);
  return { placed };
}

/** how far to slide box n sideways so that it clears every box in `others` (0 when it already does) */
function clearance(n: Box, others: Box[]): number {
  const rows = others.filter(o => top(o) < bottom(n) && top(n) < bottom(o));
  const hits = (dx: number) => rows.some(o => left(o) - GAP < right(n) + dx && left(n) + dx < right(o) + GAP);
  const tries = [0, ...rows.flatMap(o => [right(o) + GAP - left(n), left(o) - GAP - right(n)])];
  return tries.sort((a, b) => Math.abs(a) - Math.abs(b)).find(dx => !hits(dx)) ?? 0;
}

/** the lock file's text, as tests/layout_snapshot.py writes it: one item per line, sorted by id (years by
 *  length first), positions as floats, so a git diff of the lock reads like the report */
export function dumpLock(lock: Lock): string {
  const j = (v: unknown, floats: boolean): string =>
    Array.isArray(v) ? `[${v.map(x => j(x, floats)).join(", ")}]`
      : typeof v === "number" ? (floats ? pyFloat(v) : String(v)) : JSON.stringify(v);
  const out = ["{", '"$schema": "../../packages/schema/lock.schema.json",'];
  for (const [k, v] of Object.entries(lock))
    if (k !== "$schema" && !(LOCK_SECTIONS as readonly string[]).includes(k)) out.push(`${JSON.stringify(k)}: ${j(v, false)},`);
  LOCK_SECTIONS.forEach((sec, i) => {
    const byLen = sec === "axis" || sec === "eraLabels";
    const items = Object.entries(lock[sec] as Record<string, unknown>).sort(([a], [b]) =>
      (byLen ? a.length - b.length : 0) || (a < b ? -1 : a > b ? 1 : 0));
    const body = items.map(([k, v]) => ` ${JSON.stringify(k)}: ${j(v, sec !== "letters")}`).join(",\n");
    out.push(`${JSON.stringify(sec)}: {\n${body}\n}` + (i < LOCK_SECTIONS.length - 1 ? "," : ""));
  });
  out.push("}");
  return out.join("\n") + "\n";
}

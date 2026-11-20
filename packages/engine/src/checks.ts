// The layout checks (PLAN Phase 5, step 10; lint and text_rects of the Python build.py): geometric sanity
// checks on the finished layout. Errors: boxes overlapping, a line through a box, two lines lying on each
// other, a text block or panel overlapping another, a box, a line or an era line. Warnings: what the
// layout and drawing reported, and lines that could not find a clear level.
import { type Box, left, right } from "./boxes.ts";
import { type Doc, text } from "./doc.ts";
import type { Axis } from "./axis.ts";
import { type Canvas, GUTTER } from "./canvas.ts";
import type { Geometry, Rect } from "./columns.ts";
import { type Labels, ov, segmentsOf, segRect } from "./labels.ts";
import { pyFixed } from "./py.ts";
import type { Pt, Routing } from "./routing.ts";
import type { Tables } from "./tables.ts";

const top = (b: Box) => b.cy! - b.h / 2;
const bottom = (b: Box) => b.cy! + b.h / 2;
const rect = (n: Box, pad: number): Rect => [left(n) - pad, top(n) - pad, right(n) + pad, bottom(n) + pad];

/** the segment a-b starts or ends on the edge of box n and leaves it */
function endsAtBox(a: Pt, b: Pt, n: Box): boolean {
  for (const [p, q] of [[a, b], [b, a]]) {
    if (Math.abs(p[1] - q[1]) < 0.5) {               // horizontal
      if (top(n) <= p[1] && p[1] <= bottom(n) && ((Math.abs(p[0] - left(n)) < 2 && q[0] <= left(n) + 1)
          || (Math.abs(p[0] - right(n)) < 2 && q[0] >= right(n) - 1))) return true;
    } else if (left(n) <= p[0] && p[0] <= right(n) && ((Math.abs(p[1] - top(n)) < 2 && q[1] <= top(n) + 1)
               || (Math.abs(p[1] - bottom(n)) < 2 && q[1] >= bottom(n) - 1))) return true;   // vertical
  }
  return false;
}

/** every placed text block or panel: name -> rect (hist: the historicity scale's labels, from the drawing) */
export function textRects(doc: Doc, t: Tables, g: Geometry, canvas: Canvas, labels: Labels, hist: Rect[]): Map<string, Rect> {
  const hd = canvas.header, rects = new Map<string, Rect>([["header", [hd.x, hd.y, hd.x + hd.width, hd.y + hd.height]]]);
  if (canvas.map) rects.set("map panel", [canvas.MAP_X!, canvas.MAP_Y, canvas.MAP_X! + canvas.map[0], canvas.MAP_Y + canvas.map[1]]);
  for (const k of Object.keys(((doc.display as any)?.headers ?? {}) as object)) rects.set(`house header ${k}`, g.headerRect(k));
  g.notes.forEach((nt, i) => {
    if (!g.inline.has(i)) return;
    const [x, y, w, h] = g.noteRect(nt);
    rects.set(`note:${nt[0]}`, [x, y, x + w, y + h]);
  });
  for (const [yr, [, , r]] of labels.eraLabels) rects.set(`era label ${yr}`, r);
  for (const e of (doc.timeline?.episodes ?? []) as any[]) { const lab = text(doc, e.name); rects.set(`episode ${lab}`, labels.epiLabel(e.from, e.to, lab)[2]); }
  for (const [lab, r] of labels.bracketLabels) rects.set(`bracket label ${lab}`, r);
  for (const k of t.pills.keys()) {
    const [x, cy] = g.pillPos(k), w = g.pillW(k);
    rects.set(`pill ${k}`, [x - w / 2, cy - 19, x + w / 2, cy + 19]);
  }
  rects.set("footer", [GUTTER, canvas.FOOT_Y, canvas.W - GUTTER, canvas.HGT]);
  hist.forEach((r, i) => rects.set(`historicity label ${i}`, r));
  for (const k of t.crowns.keys()) rects.set(`crown ${k}`, g.crownRect(k));
  return rects;
}

/** one thing the check found, for the editor and the AI interface to act on: what (code), who (the people,
 *  lines and text blocks involved, by their ids in the document and textRects' names) and where (a box on
 *  the canvas, [left, top, right, bottom], or null) */
export interface Issue {
  severity: "error" | "warning";
  code: IssueCode;
  message: string;
  people: string[];
  lines: string[];
  blocks: string[];
  box: Rect | null;
}

export type IssueCode =
  | "boxes-overlap"            // two boxes overlap
  | "line-through-box"         // a line passes through a box it does not join
  | "lines-overlap"            // two lines lie on top of each other
  | "blocks-overlap"           // two text blocks or panels overlap
  | "block-over-box"           // a text block or panel overlaps a box
  | "line-through-block"       // a line runs through a text block or panel
  | "era-line-through-block"   // an era line runs through a text block
  | "no-clear-level"           // a line could not find a level clear of everything (warning)
  | "no-clean-line"            // no clean route for a line: its label stands in (warning)
  | "card-too-small"           // the header card's content does not fit (warning)
  | "label-left-out";          // a break mark, caption or event with no line into its person (warning)

/** an issue from its parts (the rest empty) */
export const issue = (severity: Issue["severity"], code: IssueCode, message: string,
                      o: Partial<Pick<Issue, "people" | "lines" | "blocks" | "box">> = {}): Issue =>
  ({ severity, code, message, people: o.people ?? [], lines: o.lines ?? [], blocks: o.blocks ?? [],
     box: o.box ? o.box.map(v => Math.round(v * 10) / 10) as Rect : null });

/** the people a text block belongs to, from its name in textRects */
export function blockPeople(name: string): string[] {
  const m = /^(?:note:|pill |crown |house header )(.+)$/.exec(name);
  return m ? [m[1]] : [];
}

const both = (a: Rect, b: Rect): Rect => [Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.min(a[2], b[2]), Math.min(a[3], b[3])];

/** errors and warnings as sentences (the Python engine's, sorted, each once), and as issues in the same order */
export interface Report { errors: string[]; warnings: string[]; issues: Issue[] }

/** warnings: those the layout and drawing gave (the route's, the header card's) */
export function check(doc: Doc, boxes: Map<string, Box>, t: Tables, g: Geometry, axis: Axis, canvas: Canvas, r: Routing,
                      labels: Labels, hist: Rect[], warnings: Issue[]): Report {
  const found: Issue[] = [...warnings], ns = [...boxes.values()];
  const err = (code: IssueCode, message: string, o: Parameters<typeof issue>[3]) => found.push(issue("error", code, message, o));
  const lineName = (owner: string) => {   // a line's name in the document: its first descent's id, or its union's
    const i = parseInt(owner.slice(1), 10);
    return owner[0] === "d" ? t.descIds[i][0] : t.marrIds[i];
  };
  ns.forEach((a, i) => { for (const b of ns.slice(i + 1)) if (ov(rect(a, 2), rect(b, 2)))
    err("boxes-overlap", `boxes overlap: ${a.id} / ${b.id}`, { people: [a.id, b.id], box: both(rect(a, 0), rect(b, 0)) }); });
  const hitH = (y: number, x0: number, x1: number) => {
    const lo = Math.min(x0, x1), hi = Math.max(x0, x1);
    return ns.filter(n => top(n) + 1 < y && y < bottom(n) - 1 && left(n) + 1 < hi && lo < right(n) - 1);
  };
  const hitV = (x: number, y0: number, y1: number) => {
    const lo = Math.min(y0, y1), hi = Math.max(y0, y1);
    return ns.filter(n => left(n) + 1 < x && x < right(n) - 1 && top(n) + 1 < hi && lo < bottom(n) - 1);
  };
  for (const s of r.segs) for (const [a, b] of segmentsOf(s))
    for (const n of Math.abs(a[1] - b[1]) < 0.5 ? hitH(a[1], a[0], b[0]) : hitV(a[0], a[1], b[1]))
      if (!endsAtBox(a, b, n))
        err("line-through-box", `line ${lineName(s.owner)} passes through box ${n.id}`, { people: [n.id], lines: [lineName(s.owner)], box: rect(n, 0) });

  // parallel lines lying on each other
  const hs = r.segs.flatMap(s => segmentsOf(s).filter(([a, b]) => Math.abs(a[1] - b[1]) < 0.5)
    .map(([a, b]) => [a[1], Math.min(a[0], b[0]), Math.max(a[0], b[0]), s.owner] as const));
  const sameSrc = (o1: string, o2: string) => {
    const p = r.source.get(o1), q = r.source.get(o2);
    return p === q || (p !== undefined && q !== undefined && p[0] === q[0] && p[1] === q[1]);
  };
  hs.forEach(([y1, a1, b1, o1], i) => {
    for (const [y2, a2, b2, o2] of hs.slice(i + 1))
      if (o1 !== o2 && Math.abs(y1 - y2) < 18 && Math.min(b1, b2) - Math.max(a1, a2) > 20
          && !(Math.abs(y1 - y2) < 0.5 && (r.shared.has(o1) || r.shared.has(o2)) && sameSrc(o1, o2)))
        err("lines-overlap", `lines ${o1} and ${o2} lie on top of each other at y=${pyFixed(y1, 0)}`,
            { lines: [lineName(o1), lineName(o2)], box: [Math.max(a1, a2), Math.min(y1, y2), Math.min(b1, b2), Math.max(y1, y2)] });
  });

  const rects = textRects(doc, t, g, canvas, labels, hist), keys = [...rects.keys()];
  const pillKeys = new Set([...t.pills.keys()].map(k => `pill ${k}`));
  const topNotes = new Set(g.notes.filter((nt, i) => g.inline.has(i) && nt[1] === "t").map(nt => `note:${nt[0]}`));
  const eraYears = (doc.timeline?.eras ?? []).slice(1).map((e: any) => e.year as number);
  keys.forEach((k1, i) => {
    const r1 = rects.get(k1)!;
    for (const k2 of keys.slice(i + 1)) if (ov(r1, rects.get(k2)!))
      err("blocks-overlap", `${k1} overlaps ${k2}`, { people: [...blockPeople(k1), ...blockPeople(k2)], blocks: [k1, k2], box: both(r1, rects.get(k2)!) });
    for (const n of ns) if (ov(r1, rect(n, 4)))
      err("block-over-box", `${k1} overlaps box ${n.id}`, { people: [...blockPeople(k1), n.id], blocks: [k1], box: both(r1, rect(n, 4)) });
    if (pillKeys.has(k1) || k1 === "footer") return;
    const inner: Rect = [r1[0] + 3, r1[1] + 3, r1[2] - 3, r1[3] - 3];
    for (const s of r.segs)
      if (segmentsOf(s).some(([a, b]) => ov(inner, segRect(a, b))))
        err("line-through-block", `line ${lineName(s.owner)} runs through ${k1}`, { people: blockPeople(k1), lines: [lineName(s.owner)], blocks: [k1], box: r1 });
    // these mask the line, or (notes above a line) may sit on it
    if (!["era", "yr", "footer", "header", "map", "crown", "bracket"].some(p => k1.startsWith(p)) && !topNotes.has(k1))
      for (const yr of eraYears) {
        const y = axis.Y(yr);
        if (r1[1] - 4 < y && y < r1[3] + 4)
          err("era-line-through-block", `era line ${yr} runs through ${k1}`, { people: blockPeople(k1), blocks: [k1], box: [r1[0], y, r1[2], y] });
      }
  });
  for (const owner of r.fallbacks) {
    const pts = r.segs.filter(s => s.owner === owner).flatMap(s => s.pts);
    found.push(issue("warning", "no-clear-level", `line ${lineName(owner)} could not find a clear level`, {
      lines: [lineName(owner)],
      box: pts.length ? [Math.min(...pts.map(p => p[0])), Math.min(...pts.map(p => p[1])), Math.max(...pts.map(p => p[0])), Math.max(...pts.map(p => p[1]))] : null }));
  }
  // each sentence once (the first issue with it), sorted as Python sorts: by code point
  const seen = new Map<string, Issue>();
  for (const x of found) if (!seen.has(x.severity + " " + x.message)) seen.set(x.severity + " " + x.message, x);
  const issues = [...seen.values()].sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "error" ? -1 : 1)
    || (a.message < b.message ? -1 : a.message > b.message ? 1 : 0));
  return { errors: issues.filter(x => x.severity === "error").map(x => x.message),
           warnings: issues.filter(x => x.severity === "warning").map(x => x.message), issues };
}

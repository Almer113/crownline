// The document read into the tables the layout and drawing use (the Python chartdoc.py, relationships,
// adjustments and display sections). Order matters and is kept: descents and unions in document order, and
// consecutive descents from one parent with the same options form one line.
import { type Doc, text } from "./doc.ts";

/** one drawn line from a parent (or a couple) to its children */
export interface Desc {
  parent: string;
  kids: string[];
  styles: Record<string, string>;
  brk: Record<string, string>;
  hop: boolean;
  caption: Record<string, string>;
  branch: boolean;
  drop: number | null;
  row: boolean;
  /** both parents on the chart: the line comes down from their marriage line */
  couple_of: [string, string] | null;
  union: string | null;
}

/** a marriage line, with the children that hang from it */
export interface Marr {
  a: string;
  b: string;
  house: string | null;
  style: "grey" | "dot";
  kids: string[];
  kidStyles: Record<string, string>;
}

export interface Tables {
  desc: Desc[];
  /** the document's descent ids drawn by each Desc line (the lock file names lines by these) */
  descIds: string[][];
  marr: Marr[];
  /** the union id of each Marr */
  marrIds: string[];
  /** "a b" -> the colour of the couple's children's line */
  coupleLine: Map<string, string>;
  nudge: Map<string, [number, number]>;
  follow: Map<string, string>;
  followDx: Map<string, number>;
  /** keyed by the union or descent they target, so a child with two lines keeps both */
  coupleSide: Map<string, number>;
  shareBus: Set<string>;
  breakAt: Map<string, number>;
  markerTop: Set<string>;
  textLift: Map<string, number>;
  headerLeft: Set<string>;
  /** person -> their reign numbers ("2 · 4"), in house order then number */
  crowns: Map<string, string>;
  pills: Map<string, [string, string]>;
  events: Map<string, string>;
}

export function readTables(doc: Doc): Tables {
  const adj = Object.values(doc.adjustments ?? {}) as Record<string, any>[];
  const of = (kind: string) => adj.filter(a => a.kind === kind);
  const drops = new Map(of("drop").map(a => [a.target as string, a.drop as number]));
  const unions = (doc.unions ?? {}) as Record<string, any>;
  const descents = Object.entries((doc.descents ?? {}) as Record<string, any>);

  const desc: Desc[] = [], descIds: string[][] = [];
  let lastKey: string | null = null;
  for (const [did, d] of descents) {
    if (!("parent" in d)) continue;                        // a child of a couple: drawn with the marriage
    const s = d.show ?? {};
    if (s.drawn === false) continue;                       // kept in the data, not drawn
    const couple = d.union ? ([...unions[d.union].partners] as [string, string]) : null;
    const key = JSON.stringify([d.parent, d.union ?? null, s.hop ?? false, s.branch ?? false, s.row ?? false, s.group ?? null]);
    if (key !== lastKey) {
      desc.push({ parent: d.parent, kids: [], styles: {}, brk: {}, hop: s.hop ?? false, caption: {}, branch: s.branch ?? false,
                  drop: null, row: s.row ?? false, couple_of: couple, union: d.union ?? null });
      descIds.push([]);
      lastKey = key;
    }
    descIds[descIds.length - 1].push(did);
    const g = desc[desc.length - 1], k = d.child as string;
    g.kids.push(k);
    if (s.line) g.styles[k] = s.line;
    if (s.break) g.brk[k] = s.break;
    if (s.caption) g.caption[k] = text(doc, s.caption);
    if (drops.has(did)) g.drop = drops.get(did)!;
  }

  const kidsOf = new Map<string, any[]>();
  for (const [, d] of descents) if (!("parent" in d)) {
    if (!kidsOf.has(d.union)) kidsOf.set(d.union, []);
    kidsOf.get(d.union)!.push(d);
  }
  const marr: Marr[] = [], marrIds: string[] = [], coupleLine = new Map<string, string>();
  for (const [uid, u] of Object.entries(unions)) {
    const [a, b] = u.partners as [string, string], house = u.show?.colour ?? null, ks = kidsOf.get(uid) ?? [];
    marrIds.push(uid);
    marr.push({ a, b, house, style: house === null ? "grey" : "dot", kids: ks.map(d => d.child),
                kidStyles: Object.fromEntries(ks.filter(d => d.show?.line).map(d => [d.child, d.show.line])) });
    if (u.show?.childColour) coupleLine.set(`${a} ${b}`, u.show.childColour);
  }

  const people = doc.people as Record<string, any>, houseOrder = Object.keys(doc.houses);
  const crowned = Object.entries(people).filter(([, p]) => p.reigns?.length);
  crowned.sort(([, p], [, q]) => (houseOrder.indexOf(p.reigns[0].court) - houseOrder.indexOf(q.reigns[0].court))
                                  || (p.reigns[0].n - q.reigns[0].n));
  const disp = (doc.display ?? {}) as Record<string, any>;
  return {
    desc, descIds, marr, marrIds, coupleLine,
    nudge: new Map(of("nudge").map(a => [a.target, [a.dx ?? 0, a.dy ?? 0] as [number, number]])),
    follow: new Map(of("follow").map(a => [a.target, a.of])),
    followDx: new Map(of("follow").map(a => [a.target, a.dx ?? 0])),
    coupleSide: new Map(of("coupleSide").map(a => [a.target, a.side])),
    shareBus: new Set(of("shareBus").map(a => a.target)),
    breakAt: new Map(of("breakAt").map(a => [a.target, a.at])),
    markerTop: new Set(of("markerTop").map(a => a.target)),
    textLift: new Map(of("textLift").map(a => [a.target, a.dy])),
    headerLeft: new Set(of("headerLeft").map(a => a.target)),
    crowns: new Map(crowned.map(([pid, p]) => [pid, p.reigns.map((r: any) => String(r.n)).join(" · ")])),
    pills: new Map(Object.entries(disp.pills ?? {}).map(([k, v]: [string, any]) => [k, [v.label, v.house] as [string, string]])),
    events: new Map(Object.entries(disp.events ?? {}) as [string, string][]),
  };
}

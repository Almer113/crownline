// The family tree the layout packs (PLAN Phase 5, step 3; the "tree" section of the Python compose.py):
// each unit (a person with the spouses drawn beside them) and the groups of children below it, the single
// root, and the errors for a document whose people don't make one tree.
import type { Box } from "./boxes.ts";
import type { Tables } from "./tables.ts";

/** children hanging from one line: from a parent ("d") or a couple ("m"); side -1 left, 0 middle, 1 right */
export interface Group {
  src: ["d", string] | ["m", string, string];
  kids: string[];
  side: number;
  /** a couple's own children with side 0: placed in the middle */
  centre: boolean;
}

export interface Tree {
  root: string;
  /** anchor -> its groups of children, in document order */
  groups: Map<string, Group[]>;
  /** child -> the anchor it hangs from */
  treeParent: Map<string, string>;
  /** people with a label on the line into them (they need extra room above) */
  capKids: Set<string>;
  /** people in each branch, its own members included */
  size: (a: string) => number;
  anchor: (id: string) => string;
  members: (a: string) => string[];
  kidsOf: (a: string) => string[];
}

export class TreeError extends Error {}

export function buildTree(boxes: Map<string, Box>, ties: Map<string, string>, t: Tables): Tree {
  const anchor = (id: string) => { while (ties.has(id)) id = ties.get(id)!; return id; };
  const members = (a: string) => {
    const out = [a, ...[...ties].filter(([, p]) => p === a).map(([s]) => s)];
    out.push(...[...t.follow].filter(([, lead]) => out.includes(lead)).map(([f]) => f));
    return out;
  };
  const groups = new Map<string, Group[]>([...boxes.keys()].map(k => [k, []]));
  const treeParent = new Map<string, string>(), capKids = new Set<string>(t.events.keys());

  t.desc.forEach((d, i) => {
    for (const k of [...Object.keys(d.brk), ...Object.keys(d.caption)]) {
      if (ties.has(k) && t.shareBus.has(t.descIds[i][d.kids.indexOf(k)])) continue;  // fits beside the drop
      capKids.add(k);
    }
    if (d.hop || d.branch || d.row) return;
    const kids = d.kids.filter(k => !ties.has(k));
    if (!kids.length) return;
    if (d.couple_of) {
      // a child of the parent and a spouse on the chart: hangs from the couple, on the spouse's side
      const [a, b] = d.couple_of, side = t.coupleSide.get(d.union!) ?? (d.parent === b ? -1 : 1);
      groups.get(anchor(d.parent))!.push({ src: ["m", a, b], kids, side, centre: false });
    } else groups.get(anchor(d.parent))!.push({ src: ["d", d.parent], kids, side: 0, centre: false });
    for (const k of kids) {
      if (treeParent.has(k)) throw new TreeError(`${k} is a child in two places`);
      treeParent.set(k, anchor(d.parent));
    }
  });
  t.marr.forEach((m, i) => {
    if (!m.kids.length) return;
    const anc = ties.get(m.a) === m.b ? m.b : m.a;
    const side = t.coupleSide.get(t.marrIds[i]) ?? (anc === m.b ? -1 : 1);
    groups.get(anc)!.push({ src: ["m", m.a, m.b], kids: [...m.kids], side, centre: side === 0 });
    for (const k of m.kids) {
      if (treeParent.has(k)) throw new TreeError(`${k} is a child in two places (of ${treeParent.get(k)} and ${anc})`);
      treeParent.set(k, anc);
    }
  });

  const roots = [...boxes.keys()].filter(n => !ties.has(n) && !t.follow.has(n) && !treeParent.has(n));
  if (roots.length !== 1) throw new TreeError(`expected one root of the family tree, found ${JSON.stringify(roots)}`);
  for (const k of t.nudge.keys()) if (!boxes.has(k)) throw new TreeError(`NUDGE names an unknown person: ${k}`);

  const kidsOf = (a: string) => groups.get(a)!.flatMap(g => g.kids);
  const subtree = (a: string): string[] => [...members(a), ...kidsOf(a).flatMap(subtree)];
  const reached = new Set(subtree(roots[0]));
  const lost = [...boxes.keys()].filter(k => !reached.has(k) && !t.follow.has(k)).sort();
  if (lost.length) throw new TreeError(`not connected to the family tree: ${JSON.stringify(lost)}`);

  const sizes = new Map<string, number>();
  const size = (a: string): number => {
    if (!sizes.has(a)) sizes.set(a, members(a).length + kidsOf(a).reduce((s, k) => s + size(k), 0));
    return sizes.get(a)!;
  };
  return { root: roots[0], groups, treeParent, capKids, size, anchor, members, kidsOf };
}

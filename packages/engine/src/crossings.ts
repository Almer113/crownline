// Crossings (PLAN Phase 5, step 8; hop_patches of the Python build.py): every crossing of two lines is drawn
// as one passing over the other. The line underneath gets a small gap, cut out with a mask so the
// background shows through. Which goes over: solid (father to son) over dotted or grey, then a cross-house
// line over a tree line, then a direct line over one across omitted generations, then the later-drawn line.
import { CORNER, LINE, pyRound, type Pt, type Seg } from "./routing.ts";
import type { Tables } from "./tables.ts";

/** the order of the line underneath, and the gap: x, y, w, h */
export type Patch = [number, [number, number, number, number]];

const segmentsOf = (s: Seg): [Pt, Pt][] => s.pts.slice(0, -1).map((p, i) => [p, s.pts[i + 1]]);

export function crossings(segs: Seg[], t: Tables): Patch[] {
  // lines across omitted generations (a GRANDSON-type break) pass under direct lines of the same kind
  const skip = new Set(t.desc.flatMap((d, i) => (Object.keys(d.brk).length ? [`d${i}`] : [])));
  const rank = (s: Seg) => [Number(s.style === "solid"), Number(s.hop), Number(!skip.has(s.owner)), s.order];
  const above = (s: Seg, u: Seg) => {
    const a = rank(s), b = rank(u);
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] > b[i];
    return false;
  };
  const seen = new Set<string>(), patches: Patch[] = [];
  segs.forEach((s, i) => {
    for (const u of segs.slice(i + 1)) {
      if (u.owner === s.owner) continue;
      const [over, under] = above(s, u) ? [s, u] : [u, s];
      for (const [a1, a2] of segmentsOf(over)) for (const [b1, b2] of segmentsOf(under)) {
        const horA = Math.abs(a1[1] - a2[1]) < 0.5, horB = Math.abs(b1[1] - b2[1]) < 0.5;
        if (horA === horB) continue;
        const [h1, h2, v1, v2] = horA ? [a1, a2, b1, b2] : [b1, b2, a1, a2];
        const hy = h1[1], vx = v1[0], m = CORNER + 4;        // never inside a rounded elbow or a junction
        if (!(Math.min(h1[0], h2[0]) + m < vx && vx < Math.max(h1[0], h2[0]) - m
              && Math.min(v1[1], v2[1]) + m < hy && hy < Math.max(v1[1], v2[1]) - m)) continue;
        const key = `${pyRound(vx)} ${pyRound(hy)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        patches.push([under.order, horA ? [vx - 2 * LINE, hy - 10, 4 * LINE, 20] : [vx - 10, hy - 2 * LINE, 20, 4 * LINE]]);
      }
    }
  });
  return patches;
}

// Adjustments: the document's hand corrections to the automatic layout (move a person, share a line, move a
// note...), each with a reason the editor lists. Ids are "<kind>_<target>" in snake case (note_offset_n_x), as the documents write them.
import type { AdjustmentT, ChartDoc, LockT } from "@crownline/schema";
import type { Op } from "./ops.ts";
import type { Patch } from "./patch.ts";

type Doc = ChartDoc;
type Adj = AdjustmentT;

const r1 = (v: number) => Math.round(v * 10) / 10;

/** the adjustment of this kind for this target: [id, record], or null */
export function findAdjustment(doc: Doc, kind: Adj["kind"], target: string): [string, Adj] | null {
  for (const [k, a] of Object.entries(doc.adjustments ?? {})) if (a.kind === kind && a.target === target) return [k, a];
  return null;
}

function freeId(doc: Doc, base: string): string {
  const taken = doc.adjustments ?? {};
  if (!(base in taken)) return base;
  for (let i = 2; ; i++) if (!(`${base}_${i}` in taken)) return `${base}_${i}`;
}

/** set the adjustment of this kind for this target (replacing one there), keeping its reason unless given */
export function setAdjustment(doc: Doc, kind: Adj["kind"], target: string, fields: Record<string, unknown>, reason?: string, label?: string): Op {
  const had = findAdjustment(doc, kind, target);
  const id = had?.[0] ?? freeId(doc, `${kind.replace(/[A-Z]/g, c => "_" + c.toLowerCase())}_${target}`);
  const rec = { kind, target, ...fields, reason: reason ?? had?.[1].reason ?? "" };
  return { label: label ?? `Adjust ${target} (${kind})`, patch: [{ op: "set", path: ["adjustments", id], value: rec }], id };
}

/** remove the adjustment of this kind for this target, if there is one */
export function clearAdjustment(doc: Doc, kind: Adj["kind"], target: string, label?: string): Op {
  const had = findAdjustment(doc, kind, target);
  return { label: label ?? `Remove the ${kind} of ${target}`, patch: had ? [{ op: "del", path: ["adjustments", had[0]] }] : [] };
}

export function removeAdjustment(id: string, label = "Remove an adjustment"): Op {
  return { label, patch: [{ op: "del", path: ["adjustments", id] }] };
}

/** move a person sideways by dx (with everyone below them), added to any nudge they already have */
export function nudge(doc: Doc, target: string, dx: number, reason?: string): Op {
  const had = findAdjustment(doc, "nudge", target);
  const old = had?.[1] as { dx?: number; dy?: number; reason: string } | undefined;
  const nx = r1((old?.dx ?? 0) + dx);
  const label = `Move ${target}`;
  if (had && !nx && !old?.dy) return removeAdjustment(had[0], label);
  const fields: Record<string, unknown> = {};
  if (nx) fields.dx = nx;
  if (old?.dy) fields.dy = old.dy;
  return setAdjustment(doc, "nudge", target, fields, reason || old?.reason, label);
}

/** several operations as one (their patches in order: each is made against the document before any applies,
 *  so they must touch different things) */
export function together(label: string, ops: Op[]): Op {
  const patch: Patch = ops.flatMap(o => o.patch);
  return { label, patch };
}

/** who is drawn under a person in the tree: their children by a placing line (or by a couple they are in), the
 *  partners drawn beside them, and so on down. The person is not included. */
export function below(doc: Doc, id: string): string[] {
  const out: string[] = [], seen = new Set([id]);
  const places = (d: NonNullable<Doc["descents"]>[string]) => !d.show?.hop && !d.show?.branch && !d.show?.row;
  const walk = (p: string) => {
    const kids: string[] = [];
    for (const [k, q] of Object.entries(doc.people)) if (q.show.beside?.of === p) kids.push(k);
    for (const d of Object.values(doc.descents ?? {})) {
      if (!places(d)) continue;
      const fromUnion = !d.parent && d.union && doc.unions?.[d.union]?.partners.includes(p);
      if (d.parent === p || fromUnion) kids.push(d.child);
    }
    for (const k of kids) if (!seen.has(k)) { seen.add(k); out.push(k); walk(k); }
  };
  walk(id);
  return out;
}

/** the people drawn beside a person (and beside them): they move with the card */
export function besideOf(doc: Doc, id: string): string[] {
  const out: string[] = [];
  const walk = (p: string) => { for (const [k, q] of Object.entries(doc.people)) if (q.show.beside?.of === p && !out.includes(k)) { out.push(k); walk(k); } };
  walk(id);
  return out;
}

/** a person's children in the tree (by a placing line), for moving a card without its branch */
export function treeChildren(doc: Doc, id: string): string[] {
  const out: string[] = [];
  for (const d of Object.values(doc.descents ?? {})) {
    if (d.show?.hop || d.show?.branch || d.show?.row) continue;
    const fromUnion = !d.parent && d.union && doc.unions?.[d.union]?.partners.includes(id);
    if ((d.parent === id || fromUnion) && !out.includes(d.child)) out.push(d.child);
  }
  return out;
}

/** the lock's records for these people, moved dx sideways (boxes, drops, pills, crowns, house headers), as a
 *  patch of the lock: what moving a card does when the layout is kept (frozen) */
export function shiftLock(lock: LockT, ids: string[], dx: number): Patch {
  const out: Patch = [], has = new Set(ids), L = lock as unknown as Record<string, Record<string, number[]>>;
  const shift = (sec: string, k: string, xs: number[]) => {
    const v = L[sec]?.[k];
    if (v) out.push({ op: "set", path: [sec, k], value: v.map((c, i) => (xs.includes(i) ? r1(c + dx) : c)) });
  };
  for (const id of ids) { shift("boxes", id, [0, 2]); shift("pills", id, [0]); shift("crowns", id, [0, 2]); shift("headers", id, [0, 2]); }
  for (const k of Object.keys(L.drops ?? {})) if (has.has(k.split("@")[0])) shift("drops", k, [0]);
  return out;
}

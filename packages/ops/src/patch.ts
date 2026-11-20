// Document patches (PLAN §3, research 1.3 decision 4): every change to a chart document is a list of
// patch steps, and applying one gives back its exact inverse, so undo is never hand-written per operation.
//
// Two steps: `set` (a value at a path, creating missing objects on the way) and `del` (remove a key, or an
// array item). Arrays are otherwise treated as values: an operation that changes a list sets the whole list.
// Key order is part of the document (a saved file must not reorder), so `set` can put a key back at its old
// position (`at`), and the inverse of a `del` does that.

export type Path = (string | number)[];
export type Step =
  | { op: "set"; path: Path; value: unknown; at?: number }
  | { op: "del"; path: Path };
export type Patch = Step[];

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const clone = <T>(v: T): T => (v === undefined ? v : structuredClone(v));

/** the value at a path, or undefined */
export function get(doc: unknown, path: Path): unknown {
  let v: unknown = doc;
  for (const k of path) {
    if (v === null || typeof v !== "object") return undefined;
    v = (v as Obj)[k as string];
  }
  return v;
}

/** put `key: value` into an object at position `at` (its index among the keys), keeping the others' order */
function insertAt(o: Obj, key: string, value: unknown, at: number): void {
  const entries = Object.entries(o).filter(([k]) => k !== key);
  entries.splice(Math.min(at, entries.length), 0, [key, value]);
  for (const k of Object.keys(o)) delete o[k];
  for (const [k, v] of entries) o[k] = v;
}

/** keys that would reach Object.prototype (or a constructor) instead of a field of the document */
const UNSAFE = new Set(["__proto__", "prototype", "constructor"]);

/** apply a patch to `doc` in place; returns the patch that undoes it */
export function apply(doc: Obj, patch: Patch): Patch {
  const undo: Patch = [];
  for (const s of patch) {
    if (!s.path.length) throw new Error("a patch step needs a path");
    // a path from outside (a model's operation) must not reach the objects every object inherits from
    const bad = s.path.find(k => typeof k === "string" && UNSAFE.has(k));
    if (bad !== undefined) throw new Error(`"${bad}" is not a field a document can have`);
    const parentPath = s.path.slice(0, -1), key = s.path[s.path.length - 1];
    let parent: unknown = doc;
    for (let i = 0; i < parentPath.length; i++) {
      const k = parentPath[i];
      let next = Object.prototype.hasOwnProperty.call(parent, k as string) ? (parent as Obj)[k as string] : undefined;
      if (next === undefined && s.op === "set") {
        // created on the way: the undo removes the outermost object made here
        next = typeof s.path[i + 1] === "number" ? [] : {};
        (parent as Obj)[k as string] = next;
        undo.unshift({ op: "del", path: parentPath.slice(0, i + 1) });
        for (let j = i + 1; j < parentPath.length; j++) {
          const n = typeof s.path[j + 1] === "number" ? [] : {};
          (next as Obj)[parentPath[j] as string] = n;
          next = n;
        }
        parent = next;
        break;
      }
      if (next === null || typeof next !== "object") throw new Error(`no object at ${parentPath.slice(0, i + 1).join(".")}`);
      parent = next;
    }
    if (Array.isArray(parent)) {
      const i = Number(key);
      if (s.op === "set") {
        if (i < parent.length) undo.unshift({ op: "set", path: s.path, value: clone(parent[i]) });
        else undo.unshift({ op: "del", path: s.path });
        parent[i] = clone(s.value);
      } else {
        if (i >= parent.length) continue;
        undo.unshift({ op: "set", path: parentPath, value: clone(parent) });
        parent.splice(i, 1);
      }
      continue;
    }
    const o = parent as Obj, k = String(key), had = Object.prototype.hasOwnProperty.call(o, k);
    const at = had ? Object.keys(o).indexOf(k) : -1;
    if (s.op === "set") {
      undo.unshift(had ? { op: "set", path: s.path, value: clone(o[k]), at } : { op: "del", path: s.path });
      if (s.at !== undefined) insertAt(o, k, clone(s.value), s.at);
      else o[k] = clone(s.value);
    } else if (had) {
      undo.unshift({ op: "set", path: s.path, value: clone(o[k]), at });
      delete o[k];
    }
  }
  return undo;
}

/** set, or delete when the value is undefined: the usual form edit */
export const put = (path: Path, value: unknown): Step => (value === undefined ? { op: "del", path } : { op: "set", path, value });

export { isObj };

/** the patch that turns `a` into `b`, key order included: objects are compared key by key, arrays and other
 *  values are set whole. What a change made outside the editor (a model, a person) becomes, so it can be
 *  undone like any other */
export function diff(a: unknown, b: unknown, path: Path = []): Patch {
  if (JSON.stringify(a) === JSON.stringify(b)) return [];
  if (isObj(a) && isObj(b)) {
    const ka = Object.keys(a), kb = Object.keys(b), common = kb.filter(k => k in a);
    // the keys both have, in the same order: changed in place; else the object is set whole (below)
    if (common.join("\0") === ka.filter(k => k in b).join("\0")) {
      const out: Patch = [];
      for (const k of ka) if (!(k in b)) out.push({ op: "del", path: [...path, k] });
      kb.forEach((k, i) => {
        if (k in a) out.push(...diff(a[k], b[k], [...path, k]));
        else out.push({ op: "set", path: [...path, k], value: clone(b[k]), at: i });
      });
      return out;
    }
  }
  if (!path.length) throw new Error("diff: the two documents differ at the top");
  return b === undefined ? [{ op: "del", path }] : [{ op: "set", path, value: clone(b) }];
}

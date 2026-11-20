// The named operations (PLAN §3: "operations are the shared language"): the editor's buttons, its undo
// history, and later the command line and the AI tools all change a document through these. Each one reads
// the document and returns a patch (patch.ts) without changing anything; History applies it.
//
// They keep the document valid where they can: deleting a person removes every reference to them (their
// lines, marriages, notes, pills, brackets, tour steps, adjustments), and says what went with them.
import type { ChartDoc } from "@crownline/schema";
import { get, put, type Patch, type Path, type Step } from "./patch.ts";

type Doc = ChartDoc;
type Any = Record<string, any>;
const A = (doc: Doc) => doc as unknown as Any;

export interface Op {
  /** a short description for the undo menu ("Add Pangeran Baru") */
  label: string;
  patch: Patch;
  /** what else changed, for the person to read ("removed 3 lines and 1 note") */
  notes?: string[];
  /** the id an add operation made */
  id?: string;
}

/** an id from a name, as the documents write them: lowercase words joined by _, unique in the document */
export function newId(doc: Doc, name: string, prefix = ""): string {
  const base = (prefix + name).normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").replace(/^(?=[0-9])/, "p_") || "person";
  const taken = (id: string) => [doc.people, doc.unions, doc.descents, doc.notes, doc.media, doc.adjustments, doc.glossary,
                                 doc.houses, doc.sources, doc.tours].some(c => c && id in c);
  let id = base.slice(0, 40), n = 2;
  while (taken(id)) id = `${base.slice(0, 37)}_${n++}`;
  return id;
}

const displayName = (doc: Doc, id: string): string => {
  const n = doc.people[id]?.name;
  return typeof n === "string" ? n : n ? (n[doc.meta.defaultLang] ?? Object.values(n)[0]) : id;
};

/** a field of the document, set or removed (undefined): what a form does */
export function setField(path: Path, value: unknown, label = `Change ${path.slice(-1)[0]}`): Op {
  return { label, patch: [put(path, value)] };
}

/** a text field in one language: a plain string stays plain for the default language, else becomes {lang: text}.
 *  Emptied, an optional field goes; a required one (`keep`, a name, an item of a list) stays, empty: removing an
 *  item of a list would move the next one into its place under the field still being typed in */
export function setText(doc: Doc, path: Path, value: string, lang = doc.meta.defaultLang, label?: string, keep = false): Op {
  const cur = get(doc, path);
  let next: unknown = value;
  if (cur && typeof cur === "object") next = { ...(cur as Any), [lang]: value };
  else if (lang !== doc.meta.defaultLang) next = { ...(cur !== undefined && cur !== "" ? { [doc.meta.defaultLang]: cur } : {}), [lang]: value };
  const last = path[path.length - 1];
  if (value === "" && !keep && last !== "name" && typeof last !== "number") {
    // only this language goes: the others stay (one left in the default language is a plain string again)
    const rest: Any = cur && typeof cur === "object" ? Object.fromEntries(Object.entries(cur as Any).filter(([l]) => l !== lang))
      : typeof cur === "string" && cur !== "" && lang !== doc.meta.defaultLang ? { [doc.meta.defaultLang]: cur } : {};
    const ls = Object.keys(rest);
    next = !ls.length ? undefined : ls.length === 1 && ls[0] === doc.meta.defaultLang ? rest[ls[0]] : rest;
  }
  return setField(path, next, label);
}

export interface NewPerson {
  name: string;
  box?: "ruler" | "heir" | "minor" | "neutral" | "text" | "legend";
  house?: string;
  title?: string;
  year?: number;
  sub?: string;
  sex?: "m" | "f" | "u";
  beside?: { of: string; side: "l" | "r" };
  /** the new id, chosen by the caller (the AI tools); the caller checks it is free. Made from the name otherwise.
   *  The lines and marriages made with the person take their ids from it */
  id?: string;
}

function personRecord(p: NewPerson): Any {
  const show: Any = { box: p.box ?? "minor" };
  if (p.year !== undefined) show.year = p.year;
  if (p.beside) show.beside = p.beside;
  if (p.sub) show.sub = p.sub;
  const rec: Any = { name: p.name };
  if (p.title) rec.title = p.title;
  if (p.house) rec.house = p.house;
  if (p.sex) rec.sex = p.sex;
  rec.show = show;
  return rec;
}

/** a new person, not yet connected to anyone (the check asks for a line into them) */
export function addPerson(doc: Doc, p: NewPerson, id = p.id ?? newId(doc, p.name)): Op {
  return { label: `Add ${p.name}`, patch: [{ op: "set", path: ["people", id], value: personRecord(p) }], id };
}

/** a parent-child line: from a person, from a couple (union), or from a person drawn from the couple's line */
export function addDescent(doc: Doc, d: { parent?: string; union?: string; child: string; kind?: string; line?: string }): Op {
  const from = d.parent ?? d.union!;
  const id = newId(doc, `${from}_${d.child}`, "d_");
  const rec: Any = {};
  if (d.parent) rec.parent = d.parent;
  if (d.union) rec.union = d.union;
  rec.child = d.child;
  if (d.kind && d.kind !== "birth") rec.kind = d.kind;
  if (d.line && d.line !== "solid") rec.show = { line: d.line };
  return { label: `Connect ${displayName(doc, d.child)} to ${d.parent ? displayName(doc, d.parent) : "their parents"}`,
           patch: [{ op: "set", path: ["descents", id], value: rec }], id };
}

/** a marriage (or other union) between two people; partners as drawn, [left, right] */
export function addUnion(doc: Doc, left: string, right: string, kind: "marriage" | "concubinage" | "unknown" = "marriage"): Op {
  const id = newId(doc, `${left}_${right}`, "u_");
  return { label: `Marry ${displayName(doc, left)} and ${displayName(doc, right)}`,
           patch: [{ op: "set", path: ["unions", id], value: { partners: [left, right], kind } }], id };
}

/** the year a person is placed at: their own, or their partner's when drawn beside them */
export function yearOf(doc: Doc, id: string): number | undefined {
  const s = doc.people[id]?.show;
  return s?.year ?? (s?.beside ? doc.people[s.beside.of]?.show.year : undefined);
}

/** a generation, for a new person's first year on the time axis */
export const GENERATION = 30;

/** a new child of a parent (or of a couple: `union`), placed by the new line */
export function addChild(doc: Doc, parent: string, p: NewPerson, union?: string): Op {
  const y = yearOf(doc, parent);
  const person = addPerson(doc, { house: doc.people[parent]?.house, ...(y !== undefined ? { year: y + GENERATION } : {}), ...p });
  const after = { ...doc, people: { ...doc.people, [person.id!]: {} } } as Doc;   // the new id is taken
  const line = addDescent(after, { parent, union, child: person.id! });
  return { label: `Add ${p.name} as a child of ${displayName(doc, parent)}`, patch: [...person.patch, ...line.patch], id: person.id };
}

/** a new spouse drawn beside a person, married to them */
export function addSpouse(doc: Doc, partner: string, p: NewPerson, side: "l" | "r" = "r"): Op {
  const person = addPerson(doc, { box: "text", ...p, beside: { of: partner, side } });
  const after = { ...doc, people: { ...doc.people, [person.id!]: {} } } as Doc;
  const u = side === "r" ? addUnion(after, partner, person.id!) : addUnion(after, person.id!, partner);
  return { label: `Add ${p.name} as a spouse of ${displayName(doc, partner)}`, patch: [...person.patch, ...u.patch], id: person.id };
}

/** a new parent above a person who has no line into them yet */
export function addParent(doc: Doc, child: string, p: NewPerson): Op {
  const year = yearOf(doc, child);
  const person = addPerson(doc, { house: doc.people[child]?.house, ...(year !== undefined ? { year: year - GENERATION } : {}), ...p });
  const after = { ...doc, people: { ...doc.people, [person.id!]: {} } } as Doc;
  const line = addDescent(after, { parent: person.id!, child });
  return { label: `Add ${p.name} as a parent of ${displayName(doc, child)}`, patch: [...person.patch, ...line.patch], id: person.id };
}

// ------------------------------------------------------------------------------------------- deleting

/** what deleting these records takes with it: adjustments that target them */
function adjustmentsOf(doc: Doc, ids: Set<string>): string[] {
  return Object.entries(doc.adjustments ?? {}).filter(([, a]) => ids.has(a.target) || ("of" in a && ids.has(a.of as string)))
    .map(([k]) => k);
}

/** the widths the engine draws notes at (the check warns about any other) */
export const NOTE_WIDTHS = [240, 300, 360, 440, 560];

export interface NewNote { text: string; inline?: boolean; side?: "r" | "l" | "b" | "t"; width?: number }

/** add a note to a person: inline (in full beside the card) or lettered (a letter on the card, the text in the
 *  Notes list); 240 px wide on the right unless said otherwise */
export function addNote(doc: Doc, anchor: string, n: NewNote, id = newId(doc, anchor, "n_")): Op {
  const show: Any = { side: n.side ?? "r", width: n.width ?? NOTE_WIDTHS[0] };
  if (n.inline) show.inline = true;
  return { label: `Add a note to ${displayName(doc, anchor)}`, id, patch: [put(["notes", id], { anchor, text: n.text, show })] };
}

/** delete a note and its adjustments (where it was moved to) */
export function deleteNote(doc: Doc, id: string): Op {
  const patch: Patch = [{ op: "del", path: ["notes", id] }];
  for (const k of adjustmentsOf(doc, new Set([id]))) patch.push({ op: "del", path: ["adjustments", k] });
  return { label: "Delete a note", patch };
}

/** delete a line (descent) and the adjustments that target it */
export function deleteDescent(doc: Doc, id: string): Op {
  const patch: Patch = [{ op: "del", path: ["descents", id] }];
  for (const k of adjustmentsOf(doc, new Set([id]))) patch.push({ op: "del", path: ["adjustments", k] });
  return { label: "Delete a line", patch };
}

/** delete a union: its children's lines from the couple lose the couple (or go, when they have no parent) */
export function deleteUnion(doc: Doc, id: string): Op {
  const patch: Patch = [{ op: "del", path: ["unions", id] }], gone = new Set([id]);
  for (const [k, d] of Object.entries(doc.descents ?? {})) {
    if (d.union !== id) continue;
    if (d.parent) patch.push({ op: "del", path: ["descents", k, "union"] });
    else { patch.push({ op: "del", path: ["descents", k] }); gone.add(k); }
  }
  for (const k of adjustmentsOf(doc, gone)) patch.push({ op: "del", path: ["adjustments", k] });
  return { label: "Delete a marriage", patch };
}

/** delete a person and everything that names them */
export function deletePerson(doc: Doc, id: string): Op {
  const d = A(doc), patch: Patch = [], notes: string[] = [];
  const gone = new Set([id]);
  const del = (path: Path) => patch.push({ op: "del", path });
  const count = (n: number, what: string) => { if (n) notes.push(`${n} ${what}${n > 1 ? "s" : ""}`); };

  del(["people", id]);
  // lines and marriages
  const unions = Object.entries(doc.unions ?? {}).filter(([, u]) => u.partners.includes(id)).map(([k]) => k);
  for (const k of unions) { del(["unions", k]); gone.add(k); }
  let lines = 0;
  for (const [k, ds] of Object.entries(doc.descents ?? {})) {
    if (ds.child === id || ds.parent === id || (ds.union && unions.includes(ds.union) && !ds.parent)) { del(["descents", k]); gone.add(k); lines++; }
    else if (ds.union && unions.includes(ds.union)) patch.push({ op: "del", path: ["descents", k, "union"] });
    else if (ds.through?.includes(id)) {
      const rest = ds.through.filter(x => x !== id);
      patch.push(put(["descents", k, "through"], rest.length ? rest : undefined));
    }
  }
  count(lines, "line"); count(unions.length, "marriage");
  // notes on them
  const ns = Object.entries(doc.notes ?? {}).filter(([, n]) => n.anchor === id).map(([k]) => k);
  for (const k of ns) { del(["notes", k]); gone.add(k); }
  count(ns.length, "note");
  // people drawn beside them stay, no longer beside: in the row they were drawn in
  // A line into them that did not place them (they were beside) would now place them under its parent: not
  // when that parent is itself placed by following them (a circle); such a line becomes a hop.
  const row = yearOf(doc, id);
  const followed = new Map<string, string>((Object.values(d.adjustments ?? {}) as Any[]).filter(a => a.kind === "follow").map(a => [a.target, a.of]));
  const hopped = new Set<string>();
  for (const [k, p] of Object.entries(doc.people)) if (k !== id && p.show.beside?.of === id) {
    del(["people", k, "show", "beside"]);
    if (p.show.year === undefined && row !== undefined) patch.push({ op: "set", path: ["people", k, "show", "year"], value: row });
    for (const [dk, ds] of Object.entries(doc.descents ?? {}))
      if (ds.child === k && !gone.has(dk) && ds.parent && followed.get(ds.parent) === k && !ds.show?.hop) {
        patch.push({ op: "set", path: ["descents", dk, "show"], value: { ...(ds.show ?? {}), hop: true } });
        hopped.add(dk);
      }
  }
  // their portrait goes; other media about them stay (the file and its credit), no longer theirs
  let pics = 0;
  for (const [k, m] of Object.entries(doc.media ?? {})) if (m.of === id) {
    if (m.kind === "portrait") { del(["media", k]); pics++; } else del(["media", k, "of"]);
  }
  count(pics, "portrait record");
  // children whose only line came from them are left unconnected: the person must connect them again
  // (a line drawn as a hop, a branch or in another row does not place them: the schema check's rule)
  const places = (ds: NonNullable<Doc["descents"]>[string]) => !ds.show?.hop && !ds.show?.branch && !ds.show?.row;
  const others = (child: string) => Object.entries(doc.descents ?? {}).some(([k, ds]) => ds.child === child && !gone.has(k) && !hopped.has(k) && places(ds));
  const loose = Object.values(doc.descents ?? {}).filter(ds => ds.child !== id && places(ds) && (ds.parent === id || (ds.union && unions.includes(ds.union) && !ds.parent)))
    .map(ds => ds.child)
    // and partners who were drawn beside them, with no parents of their own on the chart
    .concat(Object.entries(doc.people).filter(([k, p]) => k !== id && p.show.beside?.of === id).map(([k]) => k))
    .filter((c, i, all) => all.indexOf(c) === i && !others(c));
  if (loose.length) notes.push(`${loose.length} ${loose.length > 1 ? "people are" : "person is"} left with no parents on the chart (${loose.map(c => displayName(doc, c)).join(", ")}): connect them to someone, or the chart cannot be drawn`);
  // what the display says about them
  const disp = d.display ?? {};
  for (const sec of ["pills", "headers", "events"]) if (disp[sec]?.[id] !== undefined) del(["display", sec, id]);
  if (disp.brackets) {
    const next = (disp.brackets as Any[]).map(b => ({ ...b, members: b.members.filter((m: string) => m !== id) }))
      .filter(b => b.members.length >= 2);
    if (JSON.stringify(next) !== JSON.stringify(disp.brackets)) patch.push(put(["display", "brackets"], next.length ? next : undefined));
  }
  if (disp.rows) {
    const next = (disp.rows as Any[]).filter(r => r.anchor !== id).map(r => ({ ...r, members: r.members.filter((m: string) => m !== id) }))
      .filter(r => r.members.length);
    if (JSON.stringify(next) !== JSON.stringify(disp.rows)) patch.push(put(["display", "rows"], next.length ? next : undefined));
  }
  // tour steps keep their words, without them
  for (const [tid, tour] of Object.entries(doc.tours ?? {})) {
    let changed = false;
    const steps = tour.steps.map(s => {
      const t: Any = { ...s };
      if (Array.isArray(t.focus) && t.focus.includes(id)) { t.focus = t.focus.filter((x: string) => x !== id); if (!t.focus.length) delete t.focus; changed = true; }
      if (t.light?.includes(id)) { t.light = t.light.filter((x: string) => x !== id); if (!t.light.length) delete t.light; changed = true; }
      if (t.lineage === id) { delete t.lineage; changed = true; }
      return t;
    });
    if (changed) patch.push({ op: "set", path: ["tours", tid, "steps"], value: steps });
  }
  // the historicity scale names its people: without one of its ends it cannot be drawn
  const scale = d.panels?.scale;
  if (scale) {
    if (scale.row.includes(id) || scale.documented === id || (scale.trunk.length === 1 && scale.trunk[0] === id)) {
      del(["panels", "scale"]); notes.push("the historicity scale, which needs them");
    } else if (scale.trunk.includes(id)) patch.push(put(["panels", "scale", "trunk"], scale.trunk.filter((x: string) => x !== id)));
  }
  // adjustments that target anything removed
  const adj = adjustmentsOf(doc, gone);
  for (const k of adj) del(["adjustments", k]);
  count(adj.length, "adjustment");
  return { label: `Delete ${displayName(doc, id)}`, patch, notes };
}

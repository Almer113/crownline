// The operations a model (or a script) may apply to a chart (PLAN Phase 8): each has a name, a TypeBox schema,
// a description and an example, and turns its input into a patch of the chart and its lock through the same
// functions the editor's buttons call (@crownline/ops). The command line's help, the MCP tools' schemas and
// the model guide are all made from this one list, so they cannot drift apart.
import { Type, type Static, type TSchema } from "@sinclair/typebox";
import type { ChartDoc, LockT } from "@crownline/schema";
import {
  addChild, addDescent, addNote, addParent, addPerson, addSpouse, addUnion, below, besideOf, clearAdjustment, deleteDescent,
  deletePerson, deleteUnion, findAdjustment, newId, NOTE_WIDTHS, nudge, removeAdjustment, setAdjustment, setText, shiftLock,
  treeChildren, type NewNote, type NewPerson, type Op, type Patch,
} from "@crownline/ops";

/** what an operation works on: the document, its lock (null: no kept layout), and the batch's reason */
export interface Ctx { doc: ChartDoc; lock: LockT | null; reason: string }
/** what it gives back: a patch of {doc, lock}, what to say about it, and the id it made */
export interface Done { label: string; patch: Patch; notes?: string[]; id?: string }

export interface Spec<S extends TSchema = TSchema> {
  name: string;
  summary: string;
  input: S;
  example: Static<S>;
  run(ctx: Ctx, args: Static<S>): Done;
}

const under = (key: "doc" | "lock", patch: Patch): Patch => patch.map(st => ({ ...st, path: [key, ...st.path] }));
const fromOp = (op: Op): Done => ({ label: op.label, patch: under("doc", op.patch), notes: op.notes, id: op.id });

// ----------------------------------------------------------------------------- shared fields
const Id = Type.String({ pattern: "^[a-z][a-z0-9_]*$", description: "an id in the chart (find it with crownline_find)" });
const Box = Type.Union(["ruler", "heir", "minor", "neutral", "text", "legend"].map(k => Type.Literal(k)), {
  description: "the card: ruler (portrait and crown), heir, minor (a small card), neutral, text (a name only, as spouses are drawn), legend" });
const Line = Type.Union(["solid", "dot", "grey", "legend", "adopt"].map(k => Type.Literal(k)), {
  description: "solid: father to son; dot: through a daughter or by marriage; grey: outside the dynasty; legend: claimed by the chronicles; adopt: adopted" });
const Kind = Type.Union(["marriage", "concubinage", "unknown"].map(k => Type.Literal(k)));
const Reason = Type.Optional(Type.String({ description: "why (kept with the adjustment); the batch's reason when left out" }));
const person = {
  name: Type.String({ minLength: 1, description: "the name as printed on the card" }),
  house: Type.Optional(Type.String({ description: "a house id (crownline_describe lists them); a child takes the parent's" })),
  box: Type.Optional(Box),
  title: Type.Optional(Type.String({ description: "as printed above the name; each word should be a glossary term" })),
  year: Type.Optional(Type.Integer({ description: "the year that places them on the time axis (began to reign, or became notable)" })),
  sub: Type.Optional(Type.String({ description: "the line under the name: dates or reign (r. 1749 – 1788)" })),
  sex: Type.Optional(Type.Union([Type.Literal("m"), Type.Literal("f"), Type.Literal("u")])),
  id: Type.Optional(Type.String({ pattern: "^[a-z][a-z0-9_]*$", description: "the new id; made from the name when left out" })),
};
/** a new person's fields as given: a field left out stays out, so the operation's own default (the parent's
 *  house and year plus a generation, a spouse's text card) is not overwritten with undefined */
const np = (a: { name: string; house?: string; box?: string; title?: string; year?: number; sub?: string; sex?: NewPerson["sex"]; id?: string }, doc: ChartDoc): NewPerson => {
  if (a.id !== undefined && taken(doc, a.id)) throw new Error(`the id ${a.id} is already used in the chart: leave id out, or choose another`);
  return Object.fromEntries(Object.entries({ name: a.name, house: a.house, box: a.box, title: a.title, year: a.year, sub: a.sub, sex: a.sex, id: a.id })
    .filter(([, v]) => v !== undefined)) as unknown as NewPerson;
};
/** a record of the document's own (never one every object inherits, such as "constructor") */
const own = (c: object | undefined, id: string) => Boolean(c && Object.prototype.hasOwnProperty.call(c, id));
const taken = (doc: ChartDoc, id: string) => [doc.people, doc.unions, doc.descents, doc.notes, doc.media, doc.adjustments, doc.glossary, doc.houses]
  .some(c => own(c, id)) || ["__proto__", "prototype", "constructor"].includes(id);

function need(doc: ChartDoc, id: string, what: "person" | "union" | "line" | "note" = "person"): void {
  const has = own(what === "person" ? doc.people : what === "union" ? doc.unions : what === "line" ? doc.descents : doc.notes, id);
  if (!has) throw new Error(`there is no ${what} ${id} in the chart${what === "person" ? " (crownline_find finds people by name)" : ""}`);
}

/** a dotted path (people.hb2.bio, panels.caveats.0) or a list, as a patch path */
const path = (p: string | (string | number)[]) =>
  (typeof p === "string" ? p.split(".") : p).map(k => (typeof k === "string" && /^\d+$/.test(k) ? Number(k) : k));
const Path = Type.Union([Type.String({ description: "dotted: people.hb2.bio, panels.caveats.0" }), Type.Array(Type.Union([Type.String(), Type.Integer()]))]);

// ----------------------------------------------------------------------------- the operations
const S = <T extends TSchema>(s: Spec<T>) => s as unknown as Spec;

export const OPS: Spec[] = [
  S({
    name: "add_child", summary: "Add a new person as the child of a parent, or of a couple (union): a line from them places the child.",
    input: Type.Object({ op: Type.Literal("add_child"), parent: Id, union: Type.Optional(Id), ...person, line: Type.Optional(Line) }, { additionalProperties: false }),
    example: { op: "add_child", parent: "hb2", union: "u_hb2_kencana", name: "Pangeran Contoh", box: "minor", year: 1790, sex: "m" },
    run: ({ doc }, a) => {
      need(doc, a.parent);
      if (a.union) {
        need(doc, a.union, "union");
        const partners = (doc.unions![a.union] as { partners: string[] }).partners;
        if (!partners.includes(a.parent)) {
          const own = Object.entries(doc.unions ?? {}).filter(([, u]) => (u as { partners: string[] }).partners.includes(a.parent)).map(([k]) => k);
          throw new Error(`${a.union} is the marriage of ${partners.join(" and ")}, not of ${a.parent}: ${own.length ? `${a.parent}'s marriages are ${own.join(", ")}` : `${a.parent} has no marriage on the chart (add_spouse, or leave out union)`}`);
        }
      }
      const op = addChild(doc, a.parent, np(a, doc), a.union);
      if (a.line && a.line !== "solid") {
        const st = op.patch.find(s => s.op === "set" && s.path[0] === "descents");
        if (st && st.op === "set") (st.value as Record<string, unknown>).show = { line: a.line };
      }
      return fromOp(op);
    },
  }),
  S({
    name: "add_spouse", summary: "Add a new person married to someone, drawn beside them (side r or l).",
    input: Type.Object({ op: Type.Literal("add_spouse"), of: Id, ...person, side: Type.Optional(Type.Union([Type.Literal("r"), Type.Literal("l")])),
      kind: Type.Optional(Kind) }, { additionalProperties: false }),
    example: { op: "add_spouse", of: "hb2", name: "Ratu Contoh", side: "r", sex: "f" },
    run: ({ doc }, a) => {
      need(doc, a.of);
      const op = addSpouse(doc, a.of, np(a, doc), a.side ?? "r");
      if (a.kind && a.kind !== "marriage")
        for (const st of op.patch) if (st.op === "set" && st.path[0] === "unions") (st.value as Record<string, unknown>).kind = a.kind;
      return fromOp(op);
    },
  }),
  S({
    name: "add_parent", summary: "Add a new person as the parent of someone who has no line into them yet.",
    input: Type.Object({ op: Type.Literal("add_parent"), child: Id, ...person }, { additionalProperties: false }),
    example: { op: "add_parent", child: "hb2", name: "Ayah Contoh", sex: "m" },
    run: ({ doc }, a) => { need(doc, a.child); return fromOp(addParent(doc, a.child, np(a, doc))); },
  }),
  S({
    name: "add_person", summary: "Add a person connected to no one (connect them with connect_child or marry in the same batch, or the check fails).",
    input: Type.Object({ op: Type.Literal("add_person"), ...person }, { additionalProperties: false }),
    example: { op: "add_person", name: "Someone", box: "minor", year: 1800, house: "mataram" },
    run: ({ doc }, a) => fromOp(addPerson(doc, np(a, doc))),
  }),
  S({
    name: "connect_child", summary: "Draw a parent-child line between two people already on the chart: from a parent, or from a couple (union).",
    input: Type.Object({ op: Type.Literal("connect_child"), child: Id, parent: Type.Optional(Id), union: Type.Optional(Id),
      kind: Type.Optional(Type.Union(["birth", "adoptive", "foster", "step", "claimed", "in-law", "other"].map(k => Type.Literal(k)))),
      line: Type.Optional(Line) }, { additionalProperties: false }),
    example: { op: "connect_child", child: "someone", union: "u_hb2_kencana" },
    run: ({ doc }, a) => {
      need(doc, a.child);
      if (!a.parent && !a.union) throw new Error("connect_child needs a parent or a union");
      if (a.parent) need(doc, a.parent);
      if (a.union) need(doc, a.union, "union");
      return fromOp(addDescent(doc, { parent: a.parent, union: a.union, child: a.child, kind: a.kind as string | undefined, line: a.line as string | undefined }));
    },
  }),
  S({
    name: "marry", summary: "Marry two people already on the chart; partners as drawn, left then right.",
    input: Type.Object({ op: Type.Literal("marry"), left: Id, right: Id, kind: Type.Optional(Kind) }, { additionalProperties: false }),
    example: { op: "marry", left: "hb2", right: "someone" },
    run: ({ doc }, a) => {
      need(doc, a.left); need(doc, a.right);
      if (Object.values(doc.unions ?? {}).some(u => u.partners.includes(a.left) && u.partners.includes(a.right))) throw new Error(`${a.left} and ${a.right} are already married`);
      return fromOp(addUnion(doc, a.left, a.right, a.kind as "marriage" | undefined));
    },
  }),
  S({
    name: "remove", summary: "Remove a person (with their lines, marriages, notes and adjustments), a union, a line (descent), a note or an adjustment, by id.",
    input: Type.Object({ op: Type.Literal("remove"), id: Id }, { additionalProperties: false }),
    example: { op: "remove", id: "someone" },
    run: ({ doc }, a) => {
      if (own(doc.people, a.id)) return fromOp(deletePerson(doc, a.id));
      if (own(doc.unions, a.id)) return fromOp(deleteUnion(doc, a.id));
      if (own(doc.descents, a.id)) return fromOp(deleteDescent(doc, a.id));
      if (own(doc.adjustments, a.id)) return fromOp(removeAdjustment(a.id));
      if (own(doc.notes, a.id)) {
        const adj = Object.entries(doc.adjustments ?? {}).filter(([, x]) => x.target === a.id).map(([k]) => k);
        return { label: `Remove the note ${a.id}`, patch: under("doc", [{ op: "del", path: ["notes", a.id] }, ...adj.map(k => ({ op: "del" as const, path: ["adjustments", k] }))]) };
      }
      throw new Error(`there is nothing with the id ${a.id} to remove`);
    },
  }),
  S({
    name: "set_text", summary: "Set a text field in one language (a name, a bio, a title, a caption); empty text removes an optional field.",
    input: Type.Object({ op: Type.Literal("set_text"), path: Path, text: Type.String(), lang: Type.Optional(Type.String({ description: "default: the chart's language" })) }, { additionalProperties: false }),
    example: { op: "set_text", path: "people.hb2.bio", text: "Ruled twice, deposed by the British in 1812." },
    run: ({ doc }, a) => fromOp(setText(doc, path(a.path), a.text, a.lang ?? doc.meta.defaultLang, `Set ${path(a.path).join(".")}`)),
  }),
  S({
    name: "set", summary: "Set any field of the document to a JSON value (null removes it): show.year, reigns, born, sources, display, panels… Anything the schema allows; the batch is validated.",
    input: Type.Object({ op: Type.Literal("set"), path: Path, value: Type.Unknown({ description: "any JSON; null removes the field" }) }, { additionalProperties: false }),
    example: { op: "set", path: "people.hb2.show.year", value: 1792 },
    run: (_ctx, a) => {
      const p = path(a.path);
      if (!p.length) throw new Error("set needs a path");
      if (p[0] === "format" || (p[0] === "meta" && p[1] === "id")) throw new Error(`${p.join(".")} cannot be changed here`);
      return { label: `Set ${p.join(".")}`, patch: under("doc", [a.value === null || a.value === undefined ? { op: "del", path: p } : { op: "set", path: p, value: a.value }]) };
    },
  }),
  S({
    name: "add_note", summary: "Add a note to a person: inline (shown in full beside the card, on side r, l, b or t) or a lettered marker with the text in the Notes list.",
    input: Type.Object({ op: Type.Literal("add_note"), anchor: Id, text: Type.String({ minLength: 1 }),
      inline: Type.Optional(Type.Boolean({ description: "default false: a lettered marker" })),
      side: Type.Optional(Type.Union(["r", "l", "b", "t"].map(k => Type.Literal(k)), { description: "default r" })),
      width: Type.Optional(Type.Union(NOTE_WIDTHS.map(w => Type.Literal(w)), { description: `the note's width in px: ${NOTE_WIDTHS.join(", ")} (default ${NOTE_WIDTHS[0]})` })),
      id: Type.Optional(Type.String({ pattern: "^[a-z][a-z0-9_]*$" })) }, { additionalProperties: false }),
    example: { op: "add_note", anchor: "hb2", text: "Ruled three times: 1792–1810, 1811–1812 and 1826–1828.", inline: true, side: "l", width: 240 },
    run: ({ doc }, a) => {
      need(doc, a.anchor);
      if (a.id !== undefined && taken(doc, a.id)) throw new Error(`the id ${a.id} is already used in the chart: leave id out, or choose another`);
      const op = addNote(doc, a.anchor, { text: a.text, inline: a.inline, side: a.side as NewNote["side"], width: a.width }, a.id ?? newId(doc, a.anchor, "n_"));
      return { label: `Add a note to ${a.anchor}`, id: op.id, patch: under("doc", op.patch) };
    },
  }),
  S({
    name: "move_note", summary: "Move a note by dx, dy px from where it is now (the first local fix for a note that collides).",
    input: Type.Object({ op: Type.Literal("move_note"), note: Id, dx: Type.Optional(Type.Number()), dy: Type.Optional(Type.Number()), reason: Reason }, { additionalProperties: false }),
    example: { op: "move_note", note: "n_hb2", dy: -40, reason: "clear of Kencana's card" },
    run: ({ doc, reason }, a) => {
      need(doc, a.note, "note");
      const had = findAdjustment(doc, "noteOffset", a.note)?.[1] as { dx?: number; dy?: number } | undefined;
      const r1 = (v: number) => Math.round(v * 10) / 10;
      const nx = r1((had?.dx ?? 0) + (a.dx ?? 0)), ny = r1((had?.dy ?? 0) + (a.dy ?? 0)), f: Record<string, number> = {};
      if (nx) f.dx = nx;
      if (ny) f.dy = ny;
      if (!nx && !ny) return fromOp(clearAdjustment(doc, "noteOffset", a.note, "Move a note back"));
      return fromOp(setAdjustment(doc, "noteOffset", a.note, f, a.reason ?? reason, "Move a note"));
    },
  }),
  S({
    name: "move_person", summary: "Move a person's card sideways by dx px: with everyone drawn below them (branch, the default) or alone. With a kept layout (a lock) the lock moves too, so nothing else shifts. The last resort for a collision: prefer note moves and line adjustments.",
    input: Type.Object({ op: Type.Literal("move_person"), id: Id, dx: Type.Number(), branch: Type.Optional(Type.Boolean({ description: "default true: with everyone below them" })), reason: Reason }, { additionalProperties: false }),
    example: { op: "move_person", id: "someone", dx: 60, reason: "clear of the note on hb2" },
    run: ({ doc, lock, reason }, a) => {
      need(doc, a.id);
      const why = a.reason ?? reason, card = [a.id, ...besideOf(doc, a.id)], branch = a.branch !== false;
      const moving = branch ? [a.id, ...below(doc, a.id)] : card;
      const patch: Patch = lock ? under("lock", shiftLock(lock, moving, a.dx)) : [];
      // the nudge is what the layout remembers when it is laid out again
      patch.push(...under("doc", nudge(doc, a.id, a.dx, why).patch));
      if (!branch) for (const k of treeChildren(doc, a.id))
        if (!card.includes(k)) patch.push(...under("doc", nudge(doc, k, -a.dx, why || `stays put when ${a.id} moves`).patch));
      return { label: `Move ${a.id}${branch ? " and their branch" : ""} ${a.dx} px`, patch };
    },
  }),
  S({
    name: "adjust", summary: "A named layout adjustment, the local fixes: breakAt (where a line's break mark sits, 0..1; target: a line), shareBus (a line hangs off the parent's existing line), drop (px from the parent to the line; target: the first line), textLift (lift a label, px), markerTop (the note letter at the box's top right), headerLeft (the house header left of the pill), coupleSide (-1, 0, 1: which side a couple's children go; target: a union), nudge (dy: a person's row).",
    input: Type.Object({ op: Type.Literal("adjust"),
      kind: Type.Union(["breakAt", "shareBus", "drop", "textLift", "markerTop", "headerLeft", "coupleSide", "nudge", "follow"].map(k => Type.Literal(k))),
      target: Id, at: Type.Optional(Type.Number({ minimum: 0, maximum: 1 })), drop: Type.Optional(Type.Number()), dy: Type.Optional(Type.Number()),
      dx: Type.Optional(Type.Number()), side: Type.Optional(Type.Union([Type.Literal(-1), Type.Literal(0), Type.Literal(1)])), of: Type.Optional(Id),
      reason: Reason }, { additionalProperties: false }),
    example: { op: "adjust", kind: "breakAt", target: "d_hb1_hb2", at: 0.3, reason: "the mark clear of the era label" },
    run: ({ doc, reason }, a) => {
      const { op: _o, kind, target, reason: why, ...fields } = a;
      // the fields given change; the others of an adjustment already there stay (a nudge's dx when dy is set)
      const had = findAdjustment(doc, kind as never, target)?.[1] as Record<string, unknown> | undefined;
      const { kind: _k, target: _t, reason: _r, ...kept } = had ?? {};
      return fromOp(setAdjustment(doc, kind as never, target, { ...kept, ...fields }, why ?? reason));
    },
  }),
  S({
    name: "clear_adjustment", summary: "Remove the adjustment of a kind for a target (back to the automatic layout for it).",
    input: Type.Object({ op: Type.Literal("clear_adjustment"), kind: Type.String(), target: Id }, { additionalProperties: false }),
    example: { op: "clear_adjustment", kind: "noteOffset", target: "n_hb2" },
    run: ({ doc }, a) => {
      if (!findAdjustment(doc, a.kind as never, a.target)) throw new Error(`there is no ${a.kind} adjustment for ${a.target}`);
      return fromOp(clearAdjustment(doc, a.kind as never, a.target));
    },
  }),
];

export const BY_NAME = new Map(OPS.map(s => [s.name, s]));

/** one operation of a batch: any of the above (the schema the tools publish) */
export const Operation = Type.Union(OPS.map(s => s.input), { description: "one operation; its `op` names which (crownline_ops lists them with examples)" });

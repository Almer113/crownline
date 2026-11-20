// The Crownline chart document, format 1 (PLAN Phase 4; design in docs/research/1.4-document-format.md).
//
// One JSON file per chart, charts/<chart>/chart.json, in clear sections:
//   content      people, unions, descents, houses, sources, glossary, timeline, notes, tours
//   display      how content is drawn: each record's "show", plus display (rows, pills, headers, brackets,
//                events) and panels (header, intro, caveats, sources, scale, map)
//   adjustments  the hand fixes to the automatic layout, each with a reason
//   theme        palette, type scale, fonts
// Accepted positions are not here: they are in layout.lock.json (lock.ts).
//
// Rules that JSON Schema cannot state (references, one tree parent, no cycles, everyone connected) are
// checked in check.ts. Unknown fields are refused everywhere except under "ext".
//
// Order: collections are objects keyed by id. Where order matters it is the order in the file: people
// (creation order), descents and unions (drawing order; consecutive descents from one parent with the
// same options form one line, unless "show.group" differs), notes (lettering order), glossary (rows).
import { Type, type Static, type TSchema } from "@sinclair/typebox";

export const FORMAT = 1;

const strict = { additionalProperties: false } as const;
const Obj = <T extends Parameters<typeof Type.Object>[0]>(props: T, description?: string) =>
  Type.Object(props, { ...strict, ...(description ? { description } : {}) });
/** a collection keyed by id; a key that is not an id is refused (not silently skipped) */
/** an id that names another record (described) */
const Ref = (description: string) => Type.String({ pattern: "^[a-z][a-z0-9_]*$", description });
const Map_ = <T extends TSchema>(item: T, description?: string) =>
  Type.Record(Id, item, { additionalProperties: false, ...(description ? { description } : {}) });

// ---------------------------------------------------------------- basics
export const Id = Type.String({ pattern: "^[a-z][a-z0-9_]*$", description: "a short readable id, unique in the document (hb9, ratuibu)" });
export const LangTag = Type.String({ pattern: "^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$", description: "a BCP 47 language tag (en, id, jv-Java)" });
export const Text = Type.Union([
  Type.String(),
  Type.Record(LangTag, Type.String(), { minProperties: 1, additionalProperties: false }),
], { description: "a plain string (the document's default language) or text by language tag" });
/** inline markup allowed in text: <b>, <i>, <br>; validated loosely here and strictly in check.ts */
// EDTF level 1 (plus level 2 sets): a date (1587, 1587-05, 1587-05-12, 19XX, with ~ ? %), an interval of two
// dates (either may be open, ..), or a set [a,b] / {a,b} whose members may be ranges (a..b)
const D = "-?[0-9X]{4}(?:-[0-9X]{2}(?:-[0-9X]{2})?)?[~?%]?";
const SetItem = String.raw`(?:${D}(?:\.\.(?:${D})?)?|\.\.${D})`;
export const EDTF_PATTERN = String.raw`^(?:${D}|(?:${D}|\.\.)?/(?:${D}|\.\.)|${D}/|[\[{]${SetItem}(?:,${SetItem})*[\]}])$`;
export const Edtf = Obj({
  edtf: Type.String({ pattern: EDTF_PATTERN, description: "an EDTF date (Library of Congress, level 1, plus level 2 sets): 1587~, 1792/1810, 1989/.., [1822,1823]" }),
  text: Type.Optional(Type.String({ description: "the date as written (c. 1587)" })),
}, "a date: the EDTF value and, optionally, the wording it came from");
export const Ext = Type.Object({}, { additionalProperties: true, description: "extensions: anything, ignored by Crownline" });
export const Hex = Type.String({ pattern: "^#[0-9A-Fa-f]{6}$" });
/** a fixed-length list (JSON Schema 2020-12 has no "items" array, so not a TypeBox tuple) */
const Fixed = <T extends TSchema>(item: T, n: number, description?: string) =>
  Type.Array(item, { minItems: n, maxItems: n, ...(description ? { description } : {}) });

export const Citation = Obj({
  source: Ref("the work cited: a sources id"),
  where: Type.Optional(Type.String({ description: "page, folio or section" })),
  quay: Type.Optional(Type.Integer({ minimum: 0, maximum: 3, description: "GEDCOM 7 quality: 0 unreliable, 1 questionable, 2 secondary, 3 direct" })),
}, "a source for a fact, and where in it");
const Sources = Type.Optional(Type.Array(Citation, { description: "the sources for this record" }));
const Certainty = Type.Union([Type.Literal("high"), Type.Literal("medium"), Type.Literal("low")], { description: "how sure the sources are" });
/** one claim about an event in a life; several claims make a list, the first preferred (GEDCOM 7) */
export const EventClaim = Obj({
  date: Type.Optional(Edtf),
  place: Type.Optional(Text),
  certainty: Type.Optional(Certainty),
  note: Type.Optional(Text),
  asOf: Type.Optional(Type.String({ description: "when this was last true or checked (2026-11)" })),
  sources: Sources,
}, "one claim about an event (a birth, a death); several claims make a list, the preferred first");

// ---------------------------------------------------------------- people
export const Reign = Obj({
  court: Ref("the house whose throne it was: a houses id"),
  n: Type.Integer({ minimum: 1, description: "the order of this reign in the court's list; the crown shows these numbers" }),
  when: Type.Optional(Edtf),
  note: Type.Optional(Text),
  sources: Sources,
}, "one reign: of which court, its number there, and when");

export const BoxKind = Type.Union(["ruler", "heir", "minor", "neutral", "text", "legend"].map(k => Type.Literal(k)), {
  description: "ruler and heir: portrait and coloured label; minor: royal who did not reign; neutral: public figure outside the courts; text: spouse with no public role; legend: legendary ancestor",
});

export const PersonShow = Obj({
  box: BoxKind,
  year: Type.Optional(Type.Integer({ description: "placement year on the time axis (when they began to reign or became notable); not needed with beside" })),
  beside: Type.Optional(Obj({ of: Ref("the partner: a person id"), side: Type.Union([Type.Literal("l"), Type.Literal("r")], { description: "l or r: which side of the partner" }) }, "drawn next to a partner, on the partner's row")),
  sub: Type.Optional(Text),
  hatch: Type.Optional(Type.Boolean({ description: "rival or unrecognised claimant" })),
  tag: Type.Optional(Type.String({ description: "a small badge (disputed)" })),
  width: Type.Optional(Type.Number({ exclusiveMinimum: 0, description: "fixed label width (neutral boxes with a wrapped line)" })),
  portraitFrame: Type.Optional(Type.Boolean({ description: "keep an empty portrait frame when there is no portrait" })),
}, "how the person is drawn");

export const Person = Obj({
  name: Text,
  aka: Type.Optional(Type.Array(Text, { description: "other names (Ratu Ibu)" })),
  variants: Type.Optional(Type.Array(Type.String(), { description: "other spellings (Getas Pendawa)" })),
  title: Type.Optional(Type.String({ description: "as printed; each word should be a glossary term" })),
  house: Type.Optional(Ref("the birth house, a houses id: the card's colour (none: grey, outside the courts)")),
  sex: Type.Optional(Type.Union([Type.Literal("m"), Type.Literal("f"), Type.Literal("u")], { description: "m, f or u (unknown)" })),
  basis: Type.Optional(Type.Union([Type.Literal("legendary"), Type.Literal("traditional"), Type.Literal("documented")], {
    description: "what the facts rest on: legend, court chronicles, or documents (the default)" })),
  reigns: Type.Optional(Type.Array(Reign, { description: "each reign, in order" })),
  born: Type.Optional(Type.Array(EventClaim, { description: "the birth: one claim, or several when the sources differ" })),
  died: Type.Optional(Type.Array(EventClaim, { description: "the death, as born" })),
  portrait: Type.Optional(Ref("the picture on the card: a media id (none: a silhouette)")),
  bio: Type.Optional(Text),
  exid: Type.Optional(Type.Record(Type.String(), Type.String(), { description: "outside identifiers, e.g. {\"wikidata\": \"Q…\"}" })),
  sources: Sources,
  ext: Type.Optional(Ext),
  show: PersonShow,
}, "a person on the chart");

// ---------------------------------------------------------------- relationships
export const Union = Obj({
  partners: Fixed(Id, 2, "[left, right] as drawn"),
  kind: Type.Union([Type.Literal("marriage"), Type.Literal("concubinage"), Type.Literal("unknown")]),
  from: Type.Optional(Edtf),
  to: Type.Optional(Edtf),
  ended: Type.Optional(Type.Union([Type.Literal("divorce"), Type.Literal("death"), Type.Literal("annulment")], { description: "how it ended" })),
  rank: Type.Optional(Text),
  sources: Sources,
  ext: Type.Optional(Ext),
  show: Type.Optional(Obj({
    colour: Type.Optional(Ref("a houses id: the colour of the marriage line, the incoming spouse's birth house")),
    childColour: Type.Optional(Ref("a houses id")),
  }, "colour: the house colour of the marriage line (none: grey, outside the dynasty); childColour: the line to the children when neither parent gives one")),
}, "a marriage or other partnership: two people, drawn joined by a line");

export const LineStyle = Type.Union(["solid", "dot", "grey", "legend", "adopt"].map(k => Type.Literal(k)), {
  description: "solid: father to son; dot: through a daughter or by marriage; grey: outside the dynasty; legend: claimed by the chronicles; adopt: adopted (long dashes)" });
export const Descent = Obj({
  parent: Type.Optional(Ref("the parent: a person id")),
  union: Type.Optional(Ref("the parents as a couple: a unions id; the child's line comes down from their marriage line")),
  child: Ref("the child: a person id"),
  kind: Type.Optional(Type.Union(["birth", "adoptive", "foster", "step", "claimed", "in-law", "other"].map(k => Type.Literal(k)), {
    description: "birth (the default), adoptive, foster, step, claimed; in-law and other are links drawn like a descent (a son-in-law, a court poet)" })),
  status: Type.Optional(Type.Union(["proven", "accepted", "challenged", "disproven"].map(k => Type.Literal(k)), { description: "how well the link is established" })),
  generations: Type.Optional(Type.Union([Type.Integer({ minimum: 1 }), Type.Literal("several")], {
    description: "1 by default; 2 for a grandchild drawn directly; several when the number is not known" })),
  through: Type.Optional(Type.Array(Id, { description: "hidden people in between, when known" })),
  note: Type.Optional(Text),
  sources: Sources,
  ext: Type.Optional(Ext),
  show: Type.Optional(Obj({
    line: Type.Optional(LineStyle),
    break: Type.Optional(Type.String({ description: "label for omitted generations (grandson)" })),
    caption: Type.Optional(Text),
    hop: Type.Optional(Type.Boolean({ description: "a cross-house line: hops over the lines it crosses, does not place the child" })),
    branch: Type.Optional(Type.Boolean({ description: "drawn as its own branch, does not place the child" })),
    row: Type.Optional(Type.Boolean({ description: "parent and child side by side on one row" })),
    group: Type.Optional(Type.String({ description: "separates two consecutive lines from one parent" })),
    drawn: Type.Optional(Type.Boolean({ description: "false: kept in the data but not drawn on the chart (needs hop, so it places nobody)" })),
  }, "how the line is drawn")),
}, "a parent-child link: from a person (parent), from a couple (union), or from a person drawn from the couple's line (both)");

// ---------------------------------------------------------------- other content
export const House = Obj({
  name: Text, colour: Type.String({ pattern: "^#[0-9A-Fa-f]{6}$", description: "the house colour, #RRGGBB: its cards and lines" }),
  reign: Type.Optional(Type.Union([Type.String(), Type.Record(LangTag, Type.String())], {
    description: "how the viewer's panel names a reign of this court: {n} the number, {nth} the English ordinal "
      + "(Tokugawa: \"{nth} head of the Tokugawa house\"); default \"Ruler {n} of\" the court's header" })),
}, "a dynasty, court or house: its name and colour");
export const Source = Obj({
  kind: Type.Union(["chronicle", "colonial", "scholarship", "news", "decree", "court", "other"].map(k => Type.Literal(k))),
  title: Text,
  author: Type.Optional(Type.String()),
  year: Type.Optional(Type.Integer({ description: "the year it was published" })),
  url: Type.Optional(Type.String({ pattern: "^https?://" })),
  accessed: Type.Optional(Type.String({ pattern: "^\\d{4}-\\d{2}-\\d{2}$", description: "when the url was read: YYYY-MM-DD" })),
}, "a work cited: a chronicle, a study, a news report");
export const Term = Obj({
  group: Type.String({ description: "the glossary section it is listed under" }),
  term: Type.String({ description: "the title as printed (KGPAA, Ki Ageng)" }),
  expansion: Type.Optional(Type.String({ description: "the title in full (Kanjeng Gusti Pangeran Adipati Arya)" })),
  gloss: Text,
}, "a title or term explained in the glossary");
export const Note = Obj({
  anchor: Ref("the person it is about: a person id"),
  text: Text,
  sources: Sources,
  show: Obj({
    side: Type.Union(["r", "l", "b", "t"].map(k => Type.Literal(k)), { description: "r, l, b or t: which side of the card it is drawn on" }),
    width: Type.Number({ exclusiveMinimum: 0, description: "its width in px: 240, 300, 360, 440 or 560 (240 is usual)" }),
    inline: Type.Optional(Type.Boolean({ description: "shown in full beside the person; otherwise a lettered marker and the Notes list" })),
  }, "where and how the note is drawn"),
}, "a note about a person: in full beside the card, or a letter on it and the text in the Notes list");
export const Timeline = Obj({
  eras: Type.Array(Obj({ year: Type.Integer({ description: "the year it begins" }), name: Text }), { description: "the eras: each a band of the chart, from its year to the next era's" }),
  episodes: Type.Array(Obj({ from: Type.Integer(), to: Type.Integer(), name: Text }), { description: "shorter events (a war) marked on the time axis, from one year to another" }),
}, "the time axis: eras and episodes");
export const TourStep = Obj({
  title: Type.Optional(Text),
  caption: Text,
  focus: Type.Optional(Type.Union([Type.Literal("all"), Type.Array(Type.String({ pattern: "^([a-z][a-z0-9_]*|map:[A-Za-z0-9_]+)$" }))],
    { description: "what the view fits: all, or a list of person ids and map:<stage>" })),
  light: Type.Optional(Type.Array(Id, { description: "the people lit up (the rest dim)" })),
  lineage: Type.Optional(Ref("a person whose lineage is lit")),
  stage: Type.Optional(Type.String({ description: "the map stage shown beside the step (panels.map.maps[].id)" })),
}, "one step of a tour: what it shows and its caption");
export const Tour = Obj({ title: Text, summary: Type.Optional(Text), steps: Type.Array(TourStep, { minItems: 1 }) }, "a guided tour in the viewer: a few steps through the chart");

export const Media = Obj({
  kind: Type.Union(["portrait", "emblem", "badge", "image", "source", "data"].map(k => Type.Literal(k))),
  file: Type.String({ description: "path relative to meta.assetRoot" }),
  of: Type.Optional(Ref("whom or what it shows: a person or house id")),
  credit: Type.Optional(Obj({
    title: Type.String({ description: "what the picture is, as the credits page names it" }),
    source: Type.Optional(Type.String({ description: "the page it came from" })),
    fileUrl: Type.Optional(Type.String({ description: "the file itself" })),
    author: Type.Optional(Type.String()),
    licence: Type.Optional(Type.String({ description: "public domain, CC BY-SA 4.0, …" })),
    changes: Type.Optional(Type.String({ description: "what was changed (cropped, tone adjusted)" })),
    note: Type.Optional(Type.String()),
  }, "the credit, printed on the credits page")),
  private: Type.Optional(Type.String({ minLength: 1, description: "why it may not be published; a public build leaves it out without moving anything" })),
}, "a picture or data file the chart uses, with its credit");

// ---------------------------------------------------------------- display and panels
export const Display = Obj({
  rows: Type.Optional(Type.Array(Obj({
    anchor: Id, members: Type.Array(Id, { minItems: 1 }), gap: Type.Number(),
  }, "a side-by-side row: members stand left of the anchor on its row, joined left to right (the legendary ancestors)"))),
  pills: Type.Optional(Map_(Obj({ label: Type.String(), house: Ref("a houses id"), disputed: Type.Optional(Type.Boolean({ description: "drawn hatched: a disputed succession" })) }),
    "a house pill on the line into a person (the first member of a house)")),
  headers: Type.Optional(Map_(Obj({
    emblem: Type.Optional(Ref("a media id")), kind: Type.String({ description: "Sultanate, Duchy, …" }), name: Type.String(), years: Type.String(),
    seat: Type.String({ description: "where the court sat" }), founded: Type.String({ description: "how it was founded (Treaty of Giyanti)" }),
  }), "a house header beside the pill")),
  brackets: Type.Optional(Type.Array(Obj({ members: Type.Array(Id, { minItems: 2 }), label: Type.String() }),
    { description: "a bracket under several people with a label (rival claimants)" })),
  events: Type.Optional(Map_(Type.String(), "a short event label on the line into a person")),
  keepTogether: Type.Optional(Type.Array(Type.String({ minLength: 1 }), {
    description: "names printed before a regnal number (\"Pakubuwana II\"): a note never breaks a line between the two" })),
  timeOrder: Type.Optional(Type.Boolean({
    description: "rows keep time order across branches: nobody is drawn above a person with an earlier year (for charts whose branches have very different generation lengths)" })),
}, "how content is drawn beyond each record's own show: side-by-side rows, house pills and headers, brackets and events");

const Part = Type.Union([Type.String(), Obj({ public: Type.Optional(Type.String()), private: Type.Optional(Type.String()) })], {
  description: "text, or text that only a public or only a private build shows" });
const Name = Type.String({ pattern: "^[a-z][A-Za-z0-9]*$" });
const Named = <T extends TSchema>(item: T, description: string) =>
  Type.Record(Name, item, { additionalProperties: false, description });
const Fill = Type.String({ minLength: 1, description: "a colour, or \"a/b\": diagonal stripes of colour a over b. A colour is #RRGGBB, "
  + "house:<id>, house:<id>+0.6 (that house's colour tinted), palette:<key>, or a name from panels.map.colours" });
const LonLat = Fixed(Type.Number(), 2, "longitude, latitude");
const MapMark = Type.Union([
  Obj({ kind: Type.Literal("place"), at: LonLat, label: Type.String(),
        position: Type.Optional(Type.Union(["above", "below", "left", "right-below"].map(k => Type.Literal(k)))) }, "a place: a dot and its name"),
  Obj({ kind: Type.Literal("dot"), at: LonLat, r: Type.Number(), fill: Fill, stroke: Type.Optional(Type.Number()) }, "a coloured dot, white-ringed"),
  Obj({ kind: Type.Literal("ring"), at: LonLat, label: Type.String() }, "a ring round something too small to see, with a label"),
  Obj({ kind: Type.Literal("frame"), view: Name }, "the box of another view (a detail map)"),
]);
export const MapPanel = Obj({
  title: Type.String(),
  width: Type.Number({ description: "each map's width (px); its height follows from its view" }),
  columns: Type.Optional(Type.Integer({ minimum: 1 })),
  height: Type.Number({ description: "the panel's height (px), as rendered" }),
  boundaries: Obj({ adm2: Id, adm3: Type.Optional(Id), adm4: Type.Optional(Id) },
    "media (data): the regencies every map is coloured by, and the districts and villages areas are made of"),
  leaveOut: Type.Optional(Type.Record(Type.String(), Type.Array(Type.String()), { description: "regencies left off the maps, by a property's value" })),
  assignments: Id,
  shapes: Id,
  views: Named(Fixed(Type.Number(), 4), "longitude west, east, latitude south, north"),
  colours: Named(Type.String(), "names for colours the maps use (each a colour as in a fill)"),
  areas: Type.Optional(Named(Type.Union([Obj({ adm3: Type.Array(Type.String(), { minItems: 1 }) }), Obj({ adm4: Type.String() })]),
    "parts of regencies drawn over a map: districts by name, or a group of villages")),
  maps: Type.Array(Obj({
    id: Type.String({ pattern: "^[A-Za-z0-9_]+$", description: "the stage id (assignments, tours: map:<id>)" }),
    from: Type.Integer({ description: "the first year the map describes (the viewer's time slider)" }),
    view: Name, title: Type.String(), caption: Type.String(), note: Type.Optional(Type.String()),
    fills: Type.Record(Type.String(), Fill, { description: "polity (from the assignments) -> its fill" }),
    default: Fill,
    regions: Type.Optional(Type.Record(Type.String(), Fill, { description: "a regency's own fill, by name, over its polity's" })),
    overlays: Type.Optional(Type.Array(Obj({ area: Name, fill: Fill, outline: Type.Optional(Type.Boolean({ description: "white outline, not cut to the coast (enclaves)" })) }))),
    marks: Type.Optional(Type.Array(MapMark)),
  }), { minItems: 1 }),
  legend: Type.Optional(Type.Array(Type.Union([Obj({ fill: Fill, label: Type.String() }), Obj({ dot: Fill, label: Type.String() })]))),
}, "a grid of small maps, one per stage, drawn from ready-merged shapes (tools/map_shapes.py)");
export const Panels = Obj({
  header: Obj({ x: Type.Number({ description: "its left edge (px)" }), y: Type.Number({ description: "its top (px)" }), width: Type.Number(), height: Type.Number(),
    arrange: Type.Optional(Type.Union([Type.Literal("row"), Type.Literal("column"), Type.Literal("top")], {
      description: "row (default): top left, the tree beside it; column: down the left side, as tall as the tree "
        + "(at least its height: give a small tree's card the height its key and glossary need), holding the notes, caveats and sources too; top: across the top, as wide as the chart "
        + "(width ignored), the tree below it" })),
  }, "where the title, key and glossary panel sits"),
  intro: Type.Optional(Text),
  caveats: Type.Optional(Type.Array(Text, { description: "what the reader should know about the chart's limits, as printed" })),
  sources: Type.Optional(Type.Array(Part, { description: "the printed list of sources" })),
  badges: Type.Optional(Type.Array(Id, { description: "media shown in the footer: the licence badge first" })),
  scale: Type.Optional(Obj({
    row: Fixed(Id, 2, "the first and last people of the legendary row"),
    trunk: Type.Array(Id, { minItems: 1, description: "the people of the trunk the scale runs beside" }),
    documented: Ref("the first documented person"),
    stages: Fixed(Obj({ head: Type.String(), lines: Type.Array(Type.String()) }), 3),
  }, "a scale beside a trunk: legend, court tradition, documented")),
  map: Type.Optional(MapPanel),
  key: Type.Optional(Obj({
    house: Type.Optional(Ref("a houses id")), contrast: Type.Optional(Ref("a houses id")),
    labels: Type.Optional(Type.Record(Type.String({ pattern: "^[a-z][A-Za-z]*$" }), Text, { additionalProperties: false })),
  }, "the Key: house (the colour of its examples; default the first house), contrast (a second house: the line passing under, "
     + "the princess married in; default the second), labels (other wording for an entry, by its id: solid, dot, grey, omitted, "
     + "chronicle, caption, crossing, house, houseDisputed, bracket, event, ruler, heir, rival, traditional, legendary, minor, "
     + "marriedIn, neutral, text, noPortrait, tag, crown, letter, band, era, episode, axis). Rows appear only for what the chart uses.")),
  glossaryTitle: Type.Optional(Text),
  succession: Type.Optional(Obj({ court: Ref("a houses id"), title: Type.Optional(Text) },
    "a table of the court's reigns in order, with how each came to rule (worked out from the descents); "
    + "shown in a column or top card when there is room")),
  viewer: Type.Optional(Obj({
    languages: Type.Optional(Type.Array(LangTag, { minItems: 1, description: "interface languages the viewer offers, in order; default all it has (en, id)" })),
    year: Type.Optional(Type.Integer({ description: "the year the time slider opens at when no one is selected; default the middle of the chart's years" })),
  }, "the interactive viewer")),
}, "the panels around the tree: the header card (title, key, glossary), introduction, caveats, sources, footer, scale and maps");

// ---------------------------------------------------------------- adjustments
const Reason = Type.String({ description: "why: shown in the editor's list of adjustments (may be empty)" });
const adj = <K extends string, T extends Parameters<typeof Type.Object>[0]>(kind: K, props: T, description: string) =>
  Type.Object({ kind: Type.Literal(kind), target: Id, ...props, reason: Reason }, { ...strict, description });
export const Adjustment = Type.Union([
  adj("nudge", { dx: Type.Optional(Type.Number()), dy: Type.Optional(Type.Number()) }, "move a person (dx: with everyone below them; dy: their row)"),
  adj("follow", { of: Id, dx: Type.Number() }, "place a person relative to another, moving with them"),
  adj("coupleSide", { side: Type.Union([Type.Literal(-1), Type.Literal(0), Type.Literal(1)]) }, "which side of the parent's other children a couple's children go (target: a union; 0 the centre)"),
  adj("shareBus", {}, "the line hangs off the parent's existing line (target: a descent)"),
  adj("breakAt", { at: Type.Number({ minimum: 0, maximum: 1 }) }, "where the break mark sits on the line (target: a descent)"),
  adj("markerTop", {}, "the note letter at the top right of the box"),
  adj("textLift", { dy: Type.Number() }, "lift a text label (px)"),
  adj("headerLeft", {}, "the house header goes left of the pill"),
  adj("noteOffset", { dx: Type.Optional(Type.Number()), dy: Type.Optional(Type.Number()) }, "move a note (target: a note)"),
  adj("drop", { drop: Type.Number() }, "distance from the parent's bottom to the line (target: the first descent of a line)"),
]);

export const Theme = Obj({
  palette: Obj({
    background: Hex, band: Hex, ink: Hex, noteInk: Hex, muted: Hex, faint: Hex, neutral: Hex, greyLine: Hex,
  }, "the chart's colours, #RRGGBB: background, the era bands, text, note text, muted and faint text, neutral cards, grey lines"),
  type: Obj(Object.fromEntries(["title", "name", "reign", "name2", "sub2", "note", "cap", "small"]
    .map(k => [k, Type.Number({ exclusiveMinimum: 0 })])), "type scale in px at 1x: title, name and reign (ruler cards), name2 and sub2 (small cards), note, cap (captions on lines), small"),
  fonts: Obj({ sans: Type.String({ description: "the font for all text: gantari (open) or altehaas (proprietary: never in a public build)" }),
    script: Type.String({ description: "the font for house names: felipa (open) or chancery (proprietary)" }),
    secondScript: Type.Optional(Type.String({ description: "the font of the title's second script: noto (aksara Jawa), noto-jp (Japanese); without it the browser picks one" })),
    javanese: Type.Optional(Type.String({ description: "older name of secondScript" })) }, "the fonts, by name"),
}, "how the chart looks: colours, type sizes and fonts");

export const Meta = Obj({
  id: Type.String({ pattern: "^[a-z][a-z0-9]*(-[a-z0-9]+)*$", description: "the chart's id: lowercase words joined by - (also its folder and output names)" }),
  title: Text,
  subtitle: Type.Optional(Text),
  asOf: Edtf,
  languages: Type.Array(LangTag, { minItems: 1, description: "the languages the chart's text is written in" }),
  defaultLang: LangTag,
  assetRoot: Type.Optional(Type.String({ description: "where media paths start, relative to this file" })),
}, "the chart itself: its id, title, the date its facts are current to (asOf, printed in the footer) and its languages");

export const Chart = Type.Object({
  $schema: Type.Optional(Type.String()),
  format: Type.Literal(FORMAT, { description: "the format version: 1" }),
  meta: Meta,
  people: Map_(Person, "everyone on the chart, in the order they were added"),
  unions: Type.Optional(Map_(Union, "marriages and other partnerships, in drawing order")),
  descents: Type.Optional(Map_(Descent, "the lines from parents to children, in drawing order")),
  houses: Map_(House, "the houses: their names and colours"),
  sources: Type.Optional(Map_(Source, "the works cited")),
  glossary: Type.Optional(Map_(Term, "the titles explained, in printed order")),
  timeline: Type.Optional(Timeline),
  notes: Type.Optional(Map_(Note, "notes about people")),
  tours: Type.Optional(Map_(Tour, "guided tours for the viewer")),
  panels: Panels,
  media: Type.Optional(Map_(Media, "pictures and data files, with their credits")),
  display: Type.Optional(Display),
  adjustments: Type.Optional(Map_(Adjustment, "hand fixes to the automatic layout, each with its reason")),
  acceptedWarnings: Type.Optional(Map_(Obj({ match: Type.String(), reason: Reason }),
    "build warnings looked at and accepted; a warning that matches is reported as accepted, not as new")),
  theme: Theme,
  ext: Type.Optional(Ext),
}, { ...strict, $id: "https://almer113.github.io/crownline/schema/chart-1.json", title: "Crownline chart document, format 1" });

export type ChartDoc = Static<typeof Chart>;
export type PersonT = Static<typeof Person>;
export type DescentT = Static<typeof Descent>;
export type AdjustmentT = Static<typeof Adjustment>;

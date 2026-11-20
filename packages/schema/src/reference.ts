// The format reference (docs/FORMAT.md), made from the schema so it cannot fall behind it: every field of a chart
// document and of a layout lock, with its type and description. `npm run emit -w @crownline/schema` writes it with
// the JSON Schema files, and a test checks it is up to date.
import type { TSchema } from "@sinclair/typebox";
import { Chart, Citation, Edtf, EventClaim, FORMAT, Id, LangTag, Text } from "./chart.ts";
import { Lock } from "./lock.ts";
import { NOTE_WIDTHS } from "./check.ts";

type S = TSchema & Record<string, any>;

/** shared types, described once and named in the tables (matched by their JSON: TypeBox copies them) */
const SHARED: [string, string, S][] = [
  ["text", "#text", Text as S],
  ["date", "#date", Edtf as S],
  ["citation", "#citation", Citation as S],
  ["event", "#event", EventClaim as S],
];
const sig = (s: S) => JSON.stringify(s);
const shared = (s: S) => SHARED.find(([, , x]) => sig(x) === sig(s));
const ID_PATTERN = (Id as S).pattern;

/** a field's own description: not the one every text, date, id or language tag carries */
const GENERIC = new Set<string>([...SHARED.map(([, , x]) => x.description as string), (Id as S).description as string, (LangTag as S).description as string].filter((d): d is string => !!d));
const own = (d: string) => GENERIC.has(d) ? "" : d;
/** a description as a sentence */
const sentence = (d: string) => !d ? "" : d[0].toUpperCase() + d.slice(1) + (/[.)]$/.test(d) ? "" : ".");

const esc = (t: string) => t.replace(/\|/g, "\\|").replace(/</g, "&lt;").replace(/\n/g, " ");
const code = (t: string) => `\`${t}\``;

/** a short name for a value's type */
function typeOf(s: S): string {
  const sh = shared(s);
  if (sh) return `[${sh[0]}](${sh[1]})`;
  if (s.const !== undefined) return code(JSON.stringify(s.const));
  if (s.anyOf) {
    if (s.anyOf.every((x: S) => x.const !== undefined)) return s.anyOf.map((x: S) => code(JSON.stringify(x.const))).join(", ");
    return s.anyOf.map((x: S) => typeOf(x)).join(" or ");
  }
  if (s.type === "string") {
    if (s.pattern === ID_PATTERN) return "id";
    if (s.pattern === (LangTag as S).pattern) return "language tag";
    if (s.pattern === "^#[0-9A-Fa-f]{6}$") return "colour (#RRGGBB)";
    return "string";
  }
  if (s.type === "integer" || s.type === "number") {
    const n = s.type === "integer" ? "integer" : "number";
    if (s.minimum !== undefined && s.maximum !== undefined) return `${n}, ${s.minimum} to ${s.maximum}`;
    if (s.exclusiveMinimum === 0) return `${n} above 0`;
    if (s.minimum !== undefined) return `${n}, at least ${s.minimum}`;
    return n;
  }
  if (s.type === "boolean") return "true or false";
  if (s.type === "array") {
    if (s.minItems !== undefined && s.minItems === s.maxItems) return `${s.minItems} × ${typeOf(s.items)}`;
    return `list of ${typeOf(s.items)}`;
  }
  if (s.type === "object") {
    if (s.patternProperties) {
      const [k, v] = Object.entries(s.patternProperties)[0] as [string, S];
      return `map: ${k === ID_PATTERN ? "id" : "name"} → ${typeOf(v)}`;
    }
    return "object";
  }
  return "any";
}

/** the object a value holds fields of (itself, a list's items, a map's values), if any */
function inner(s: S): { obj: S; step: string } | null {
  if (shared(s)) return null;
  if (s.type === "object" && s.properties) return { obj: s, step: "." };
  if (s.type === "object" && s.patternProperties) {
    const [k, v] = Object.entries(s.patternProperties)[0] as [string, S];
    const i = inner(v);
    return i && i.obj.properties ? { obj: i.obj, step: k === ID_PATTERN ? ".<id>." : ".<name>." } : null;
  }
  if (s.type === "array") { const i = inner(s.items); return i && i.obj.properties ? { obj: i.obj, step: "[]." } : null; }
  return null;
}

/** a variant list: a union of objects told apart by a literal `kind` */
const variants = (s: S): S[] | null => {
  const u = s.anyOf ?? (s.type === "array" ? s.items?.anyOf : s.type === "object" && s.patternProperties ? (Object.values(s.patternProperties)[0] as S).anyOf : null);
  return u && u.length > 1 && u.every((x: S) => x.properties?.kind?.const !== undefined) ? u : null;
};

/** the rows of a fields table: each field, and the fields inside it */
function rows(obj: S, prefix: string, out: string[], kinds: [string, S[]][]): void {
  const req = new Set<string>(obj.required ?? []);
  for (const [k, v] of Object.entries(obj.properties ?? {}) as [string, S][]) {
    if (k === "$schema") continue;
    const path = prefix + k, vs = variants(v);
    const desc = own(v.description ?? (v.type === "array" ? v.items?.description : undefined) ?? "");
    out.push(`| ${code(path)} | ${vs ? `one of the kinds [below](#${slug(path)})` : typeOf(v)} | ${req.has(k) ? "yes" : ""} | ${esc(desc)} |`);
    if (vs) { kinds.push([path, vs]); continue; }
    const i = inner(v);
    if (i && i.obj !== obj) rows(i.obj, path + i.step, out, kinds);
  }
}

const slug = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const HEAD = "| Field | Type | Required | What it is |\n|---|---|---|---|";

function table(obj: S, prefix = ""): string {
  const out: string[] = [], kinds: [string, S[]][] = [];
  rows(obj, prefix, out, kinds);
  return `${HEAD}\n${out.join("\n")}\n` + kinds.map(([path, vs]) => `\n#### ${path}\n\n${kindTable(path, vs)}`).join("");
}

/** the kinds of a variant list, one row each */
function kindTable(path: string, vs: S[]): string {
  let md = `${variantsIntro(path)}\n\n| ${code("kind")} | Other fields | What it does |\n|---|---|---|\n`;
  for (const v of vs) {
    const req = new Set<string>(v.required ?? []);
    const fields = Object.entries(v.properties).filter(([k]) => k !== "kind")
      .map(([k, f]) => `${code(k)}${req.has(k) ? "" : " (optional)"}: ${typeOf(f as S)}`).join("; ");
    md += `| ${code(String(v.properties.kind.const))} | ${esc(fields)} | ${esc(v.description ?? "")} |\n`;
  }
  return md;
}

const variantsIntro = (path: string) => path === "adjustments"
  ? "Each adjustment has a `kind`, the `target` it applies to (a person unless the kind says otherwise), the fields of its kind, and a `reason` (shown in the editor's Adjusted tab)."
  : "Each has a `kind`, and the fields of its kind:";

/** the sections of the document, in the order of the file */
function sections(): string {
  const top = Chart as S;
  let md = "";
  for (const [k, v] of Object.entries(top.properties) as [string, S][]) {
    if (k === "$schema" || k === "format" || k === "ext") continue;
    const i = inner(v), vs = variants(v);
    md += `\n### ${k}\n\n${esc(sentence(v.description ?? ""))}${(top.required ?? []).includes(k) ? " Required." : " Optional."}\n\n`;
    if (vs) md += kindTable(k, vs);
    else if (i) md += table(i.obj, `${k}${i.step}`);
  }
  return md;
}

function sharedTypes(): string {
  let md = "";
  for (const [name, , s] of SHARED) {
    md += `\n### ${name[0].toUpperCase() + name.slice(1)}\n\n${esc(sentence(s.description ?? ""))}\n\n`;
    if (s.properties) md += table(s);
    if (name === "text") md += "For example `\"Hamengkubuwana I\"`, or `{\"en\": \"Wangsa Mataram\", \"jv-Java\": \"ꦮꦁꦱ​ꦩꦠꦫꦩ꧀\"}`. Only `<b>`, `<i>` and `<br>` markup is allowed in text; write a plain `<` as `&lt;`.\n";
    if (name === "date") md += "\nFor example `{\"edtf\": \"1755/1792\", \"text\": \"1755 – 1792\"}`, `{\"edtf\": \"1587~\", \"text\": \"c. 1587\"}`, or `{\"edtf\": \"1989/..\"}` (from 1989, still going).\n";
  }
  return md;
}

export function reference(): string {
  return `# The chart format

This is the reference for Crownline's two files: \`chart.json\`, the chart document, and \`layout.lock.json\`, its kept layout. It is made from the schema in \`packages/schema\` (\`npm run emit -w @crownline/schema\`), so it lists every field the format allows. [HOW_IT_WORKS.md](HOW_IT_WORKS.md) explains what the engine does with them, and [STYLE.md](STYLE.md) the rules a chart follows.

**Contents**

1. [A chart folder](#a-chart-folder)
2. [Rules for the whole document](#rules-for-the-whole-document)
3. [A small example](#a-small-example)
4. [The document, section by section](#the-document-section-by-section)
5. [Shared types](#shared-types)
6. [The layout lock](#the-layout-lock)

## A chart folder

A chart is a folder, \`charts/<id>/\`:

| File | What it is |
|---|---|
| \`chart.json\` | Everything a person decides: the people and how they are related, notes, eras, houses, panels, pictures and their credits, the theme, and the hand adjustments to the automatic layout. |
| \`layout.lock.json\` | Optional. The kept layout: where every card, line, note and label was accepted to be. With it, a change moves only what it must. The build, the editor and the \`crownline\` tools write it; you never edit it by hand. |
| \`.crownline/\` | Made by the tools: the history of the batches they applied, for undo. Not part of the chart. |

Pictures, fonts and map data live under \`assets/\`, named from the document's \`media\` records. Paths there start at \`meta.assetRoot\` (\`../..\`, the repository, for a chart in \`charts/<id>/\`).

## Rules for the whole document

- **The format.** \`"format": ${FORMAT}\`. A document in an older format is brought up to date with \`npm run check -- migrate <chart.json>\`. Editors that read \`$schema\` (\`"$schema": "../../packages/schema/chart.schema.json"\`) complete and check fields as you type.
- **Ids.** Collections are maps from an id to a record. An id is lower case, starts with a letter and uses letters, digits and \`_\` (\`hb9\`, \`ratu_ibu\`). Ids are unique across the whole document: a person and a note cannot share one.
- **Order.** Where order matters, it is the order in the file: people in the order they were added, unions and descents in drawing order (consecutive descents from one parent form one line), the glossary in printed order.
- **Text** is a plain string in the document's default language, or text by language tag ([text](#text)). **Dates** are EDTF values with the wording they came from ([date](#date)).
- **Unknown fields are refused** everywhere except under \`ext\`, where anything goes and Crownline ignores it.
- **Checking.** \`npm run check\` checks every chart: first against the schema, then the rules a schema cannot state:
  - every id a record names exists and is the right kind of thing (a \`parent\` is a person, a \`portrait\` a portrait in \`media\`);
  - each person is placed in the tree exactly once (by one descent, by \`show.beside\` a partner, or in a \`display.rows\` row), there is one root, everyone is connected to it, and no one is their own ancestor;
  - a person drawn beside a partner comes after them in the file, and needs no \`show.year\`; everyone else needs one;
  - a ruler or heir card needs a house; a reign number is used once per court;
  - a person has at most one lettered note (two letters would sit on top of each other);
  - notes are ${NOTE_WIDTHS.join(", ")} px wide (another width is drawn at the nearest, with a warning);
  - only \`<b>\`, \`<i>\` and \`<br>\` markup;
  - each word of a title is a glossary term (a warning).

  Messages name the record and the field: \`descents.d_hb2_hb3: parent "hb22" is not a person\`.

## A small example

A chart with one house, a ruler, his consort and their son. It is valid as it stands, and builds:

\`\`\`json
{
  "$schema": "../../packages/schema/chart.schema.json",
  "format": ${FORMAT},
  "meta": { "id": "example", "title": "An Example House", "asOf": { "edtf": "2026-11", "text": "November 2026" },
            "languages": ["en"], "defaultLang": "en", "assetRoot": "../.." },
  "people": {
    "first": { "name": "Example the First", "title": "King", "house": "example", "sex": "m",
               "reigns": [{ "court": "example", "n": 1, "when": { "edtf": "1600/1630" } }],
               "show": { "box": "ruler", "year": 1600, "sub": "r. 1600 – 1630" } },
    "consort": { "name": "Queen Consort", "sex": "f", "show": { "box": "text", "beside": { "of": "first", "side": "r" } } },
    "second": { "name": "Example the Second", "house": "example", "sex": "m", "show": { "box": "minor", "year": 1630 } }
  },
  "unions": { "u_first_consort": { "partners": ["first", "consort"], "kind": "marriage" } },
  "descents": { "d_second": { "union": "u_first_consort", "child": "second" } },
  "houses": { "example": { "name": "Example", "colour": "#C9A227" } },
  "glossary": { "king": { "group": "Titles", "term": "King", "gloss": "the ruler" } },
  "panels": { "header": { "x": 140, "y": 130, "width": 800, "height": 1050, "arrange": "column" } },
  "theme": {
    "palette": { "background": "#F3EEDF", "band": "#E9E2CE", "ink": "#1F1F1F", "noteInk": "#3A3A3A",
                 "muted": "#5F5A4C", "faint": "#8C8574", "neutral": "#B9B3A3", "greyLine": "#9A9486" },
    "type": { "title": 64, "name": 22, "reign": 16, "name2": 17, "sub2": 13, "note": 15, "cap": 13, "small": 12 },
    "fonts": { "sans": "gantari", "script": "felipa" }
  }
}
\`\`\`

[GETTING_STARTED.md](GETTING_STARTED.md) makes a chart like this in the editor, without writing any of it by hand.

## The document, section by section

The top level holds \`format\`, \`$schema\`, \`ext\` and these sections. In the tables, \`<id>\` stands for a record's id, \`[]\` for each item of a list, and a field inside another is written with a dot (\`show.box\`).
${sections()}
## Shared types
${sharedTypes()}
## The layout lock

\`layout.lock.json\` records where everything was accepted to be, in px on the chart's canvas. While a chart has one, the engine draws everything in it where the lock says (the editor's "Keep the layout", the build's \`--frozen\`) and places only what is new. \`npm run build:chart -- <chart.json> --lock\` names what moved since the lock was written, and \`--update-lock\` accepts the new layout.

${table(Lock as S)}`;
}

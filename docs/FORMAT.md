# The chart format

This is the reference for Crownline's two files: `chart.json`, the chart document, and `layout.lock.json`, its kept layout. It is made from the schema in `packages/schema` (`npm run emit -w @crownline/schema`), so it lists every field the format allows. [HOW_IT_WORKS.md](HOW_IT_WORKS.md) explains what the engine does with them, and [STYLE.md](STYLE.md) the rules a chart follows.

**Contents**

1. [A chart folder](#a-chart-folder)
2. [Rules for the whole document](#rules-for-the-whole-document)
3. [A small example](#a-small-example)
4. [The document, section by section](#the-document-section-by-section)
5. [Shared types](#shared-types)
6. [The layout lock](#the-layout-lock)

## A chart folder

A chart is a folder, `charts/<id>/`:

| File | What it is |
|---|---|
| `chart.json` | Everything a person decides: the people and how they are related, notes, eras, houses, panels, pictures and their credits, the theme, and the hand adjustments to the automatic layout. |
| `layout.lock.json` | Optional. The kept layout: where every card, line, note and label was accepted to be. With it, a change moves only what it must. The build, the editor and the `crownline` tools write it; you never edit it by hand. |
| `.crownline/` | Made by the tools: the history of the batches they applied, for undo. Not part of the chart. |

Pictures, fonts and map data live under `assets/`, named from the document's `media` records. Paths there start at `meta.assetRoot` (`../..`, the repository, for a chart in `charts/<id>/`).

## Rules for the whole document

- **The format.** `"format": 1`. A document in an older format is brought up to date with `npm run check -- migrate <chart.json>`. Editors that read `$schema` (`"$schema": "../../packages/schema/chart.schema.json"`) complete and check fields as you type.
- **Ids.** Collections are maps from an id to a record. An id is lower case, starts with a letter and uses letters, digits and `_` (`hb9`, `ratu_ibu`). Ids are unique across the whole document: a person and a note cannot share one.
- **Order.** Where order matters, it is the order in the file: people in the order they were added, unions and descents in drawing order (consecutive descents from one parent form one line), the glossary in printed order.
- **Text** is a plain string in the document's default language, or text by language tag ([text](#text)). **Dates** are EDTF values with the wording they came from ([date](#date)).
- **Unknown fields are refused** everywhere except under `ext`, where anything goes and Crownline ignores it.
- **Checking.** `npm run check` checks every chart: first against the schema, then the rules a schema cannot state:
  - every id a record names exists and is the right kind of thing (a `parent` is a person, a `portrait` a portrait in `media`);
  - each person is placed in the tree exactly once (by one descent, by `show.beside` a partner, or in a `display.rows` row), there is one root, everyone is connected to it, and no one is their own ancestor;
  - a person drawn beside a partner comes after them in the file, and needs no `show.year`; everyone else needs one;
  - a ruler or heir card needs a house; a reign number is used once per court;
  - a person has at most one lettered note (two letters would sit on top of each other);
  - notes are 240, 300, 360, 440, 560 px wide (another width is drawn at the nearest, with a warning);
  - only `<b>`, `<i>` and `<br>` markup;
  - each word of a title is a glossary term (a warning).

  Messages name the record and the field: `descents.d_hb2_hb3: parent "hb22" is not a person`.

## A small example

A chart with one house, a ruler, his consort and their son. It is valid as it stands, and builds:

```json
{
  "$schema": "../../packages/schema/chart.schema.json",
  "format": 1,
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
```

[GETTING_STARTED.md](GETTING_STARTED.md) makes a chart like this in the editor, without writing any of it by hand.

## The document, section by section

The top level holds `format`, `$schema`, `ext` and these sections. In the tables, `<id>` stands for a record's id, `[]` for each item of a list, and a field inside another is written with a dot (`show.box`).

### meta

The chart itself: its id, title, the date its facts are current to (asOf, printed in the footer) and its languages. Required.

| Field | Type | Required | What it is |
|---|---|---|---|
| `meta.id` | string | yes | the chart's id: lowercase words joined by - (also its folder and output names) |
| `meta.title` | [text](#text) | yes |  |
| `meta.subtitle` | [text](#text) |  |  |
| `meta.asOf` | [date](#date) | yes |  |
| `meta.languages` | list of language tag | yes | the languages the chart's text is written in |
| `meta.defaultLang` | language tag | yes |  |
| `meta.assetRoot` | string |  | where media paths start, relative to this file |

### people

Everyone on the chart, in the order they were added. Required.

| Field | Type | Required | What it is |
|---|---|---|---|
| `people.<id>.name` | [text](#text) | yes |  |
| `people.<id>.aka` | list of [text](#text) |  | other names (Ratu Ibu) |
| `people.<id>.variants` | list of string |  | other spellings (Getas Pendawa) |
| `people.<id>.title` | string |  | as printed; each word should be a glossary term |
| `people.<id>.house` | id |  | the birth house, a houses id: the card's colour (none: grey, outside the courts) |
| `people.<id>.sex` | `"m"`, `"f"`, `"u"` |  | m, f or u (unknown) |
| `people.<id>.basis` | `"legendary"`, `"traditional"`, `"documented"` |  | what the facts rest on: legend, court chronicles, or documents (the default) |
| `people.<id>.reigns` | list of object |  | each reign, in order |
| `people.<id>.reigns[].court` | id | yes | the house whose throne it was: a houses id |
| `people.<id>.reigns[].n` | integer, at least 1 | yes | the order of this reign in the court's list; the crown shows these numbers |
| `people.<id>.reigns[].when` | [date](#date) |  |  |
| `people.<id>.reigns[].note` | [text](#text) |  |  |
| `people.<id>.reigns[].sources` | list of [citation](#citation) |  | the sources for this record |
| `people.<id>.born` | list of [event](#event) |  | the birth: one claim, or several when the sources differ |
| `people.<id>.died` | list of [event](#event) |  | the death, as born |
| `people.<id>.portrait` | id |  | the picture on the card: a media id (none: a silhouette) |
| `people.<id>.bio` | [text](#text) |  |  |
| `people.<id>.exid` | map: name → string |  | outside identifiers, e.g. {"wikidata": "Q…"} |
| `people.<id>.sources` | list of [citation](#citation) |  | the sources for this record |
| `people.<id>.ext` | object |  | extensions: anything, ignored by Crownline |
| `people.<id>.show` | object | yes | how the person is drawn |
| `people.<id>.show.box` | `"ruler"`, `"heir"`, `"minor"`, `"neutral"`, `"text"`, `"legend"` | yes | ruler and heir: portrait and coloured label; minor: royal who did not reign; neutral: public figure outside the courts; text: spouse with no public role; legend: legendary ancestor |
| `people.<id>.show.year` | integer |  | placement year on the time axis (when they began to reign or became notable); not needed with beside |
| `people.<id>.show.beside` | object |  | drawn next to a partner, on the partner's row |
| `people.<id>.show.beside.of` | id | yes | the partner: a person id |
| `people.<id>.show.beside.side` | `"l"`, `"r"` | yes | l or r: which side of the partner |
| `people.<id>.show.sub` | [text](#text) |  |  |
| `people.<id>.show.hatch` | true or false |  | rival or unrecognised claimant |
| `people.<id>.show.tag` | string |  | a small badge (disputed) |
| `people.<id>.show.width` | number above 0 |  | fixed label width (neutral boxes with a wrapped line) |
| `people.<id>.show.portraitFrame` | true or false |  | keep an empty portrait frame when there is no portrait |

### unions

Marriages and other partnerships, in drawing order. Optional.

| Field | Type | Required | What it is |
|---|---|---|---|
| `unions.<id>.partners` | 2 × id | yes | [left, right] as drawn |
| `unions.<id>.kind` | `"marriage"`, `"concubinage"`, `"unknown"` | yes |  |
| `unions.<id>.from` | [date](#date) |  |  |
| `unions.<id>.to` | [date](#date) |  |  |
| `unions.<id>.ended` | `"divorce"`, `"death"`, `"annulment"` |  | how it ended |
| `unions.<id>.rank` | [text](#text) |  |  |
| `unions.<id>.sources` | list of [citation](#citation) |  | the sources for this record |
| `unions.<id>.ext` | object |  | extensions: anything, ignored by Crownline |
| `unions.<id>.show` | object |  | colour: the house colour of the marriage line (none: grey, outside the dynasty); childColour: the line to the children when neither parent gives one |
| `unions.<id>.show.colour` | id |  | a houses id: the colour of the marriage line, the incoming spouse's birth house |
| `unions.<id>.show.childColour` | id |  | a houses id |

### descents

The lines from parents to children, in drawing order. Optional.

| Field | Type | Required | What it is |
|---|---|---|---|
| `descents.<id>.parent` | id |  | the parent: a person id |
| `descents.<id>.union` | id |  | the parents as a couple: a unions id; the child's line comes down from their marriage line |
| `descents.<id>.child` | id | yes | the child: a person id |
| `descents.<id>.kind` | `"birth"`, `"adoptive"`, `"foster"`, `"step"`, `"claimed"`, `"in-law"`, `"other"` |  | birth (the default), adoptive, foster, step, claimed; in-law and other are links drawn like a descent (a son-in-law, a court poet) |
| `descents.<id>.status` | `"proven"`, `"accepted"`, `"challenged"`, `"disproven"` |  | how well the link is established |
| `descents.<id>.generations` | integer, at least 1 or `"several"` |  | 1 by default; 2 for a grandchild drawn directly; several when the number is not known |
| `descents.<id>.through` | list of id |  | hidden people in between, when known |
| `descents.<id>.note` | [text](#text) |  |  |
| `descents.<id>.sources` | list of [citation](#citation) |  | the sources for this record |
| `descents.<id>.ext` | object |  | extensions: anything, ignored by Crownline |
| `descents.<id>.show` | object |  | how the line is drawn |
| `descents.<id>.show.line` | `"solid"`, `"dot"`, `"grey"`, `"legend"`, `"adopt"` |  | solid: father to son; dot: through a daughter or by marriage; grey: outside the dynasty; legend: claimed by the chronicles; adopt: adopted (long dashes) |
| `descents.<id>.show.break` | string |  | label for omitted generations (grandson) |
| `descents.<id>.show.caption` | [text](#text) |  |  |
| `descents.<id>.show.hop` | true or false |  | a cross-house line: hops over the lines it crosses, does not place the child |
| `descents.<id>.show.branch` | true or false |  | drawn as its own branch, does not place the child |
| `descents.<id>.show.row` | true or false |  | parent and child side by side on one row |
| `descents.<id>.show.group` | string |  | separates two consecutive lines from one parent |
| `descents.<id>.show.drawn` | true or false |  | false: kept in the data but not drawn on the chart (needs hop, so it places nobody) |

### houses

The houses: their names and colours. Required.

| Field | Type | Required | What it is |
|---|---|---|---|
| `houses.<id>.name` | [text](#text) | yes |  |
| `houses.<id>.colour` | colour (#RRGGBB) | yes | the house colour, #RRGGBB: its cards and lines |
| `houses.<id>.reign` | string or map: name → string |  | how the viewer's panel names a reign of this court: {n} the number, {nth} the English ordinal (Tokugawa: "{nth} head of the Tokugawa house"); default "Ruler {n} of" the court's header |

### sources

The works cited. Optional.

| Field | Type | Required | What it is |
|---|---|---|---|
| `sources.<id>.kind` | `"chronicle"`, `"colonial"`, `"scholarship"`, `"news"`, `"decree"`, `"court"`, `"other"` | yes |  |
| `sources.<id>.title` | [text](#text) | yes |  |
| `sources.<id>.author` | string |  |  |
| `sources.<id>.year` | integer |  | the year it was published |
| `sources.<id>.url` | string |  |  |
| `sources.<id>.accessed` | string |  | when the url was read: YYYY-MM-DD |

### glossary

The titles explained, in printed order. Optional.

| Field | Type | Required | What it is |
|---|---|---|---|
| `glossary.<id>.group` | string | yes | the glossary section it is listed under |
| `glossary.<id>.term` | string | yes | the title as printed (KGPAA, Ki Ageng) |
| `glossary.<id>.expansion` | string |  | the title in full (Kanjeng Gusti Pangeran Adipati Arya) |
| `glossary.<id>.gloss` | [text](#text) | yes |  |

### timeline

The time axis: eras and episodes. Optional.

| Field | Type | Required | What it is |
|---|---|---|---|
| `timeline.eras` | list of object | yes | the eras: each a band of the chart, from its year to the next era's |
| `timeline.eras[].year` | integer | yes | the year it begins |
| `timeline.eras[].name` | [text](#text) | yes |  |
| `timeline.episodes` | list of object | yes | shorter events (a war) marked on the time axis, from one year to another |
| `timeline.episodes[].from` | integer | yes |  |
| `timeline.episodes[].to` | integer | yes |  |
| `timeline.episodes[].name` | [text](#text) | yes |  |

### notes

Notes about people. Optional.

| Field | Type | Required | What it is |
|---|---|---|---|
| `notes.<id>.anchor` | id | yes | the person it is about: a person id |
| `notes.<id>.text` | [text](#text) | yes |  |
| `notes.<id>.sources` | list of [citation](#citation) |  | the sources for this record |
| `notes.<id>.show` | object | yes | where and how the note is drawn |
| `notes.<id>.show.side` | `"r"`, `"l"`, `"b"`, `"t"` | yes | r, l, b or t: which side of the card it is drawn on |
| `notes.<id>.show.width` | number above 0 | yes | its width in px: 240, 300, 360, 440 or 560 (240 is usual) |
| `notes.<id>.show.inline` | true or false |  | shown in full beside the person; otherwise a lettered marker and the Notes list |

### tours

Guided tours for the viewer. Optional.

| Field | Type | Required | What it is |
|---|---|---|---|
| `tours.<id>.title` | [text](#text) | yes |  |
| `tours.<id>.summary` | [text](#text) |  |  |
| `tours.<id>.steps` | list of object | yes | one step of a tour: what it shows and its caption |
| `tours.<id>.steps[].title` | [text](#text) |  |  |
| `tours.<id>.steps[].caption` | [text](#text) | yes |  |
| `tours.<id>.steps[].focus` | `"all"` or list of string |  | what the view fits: all, or a list of person ids and map:&lt;stage> |
| `tours.<id>.steps[].light` | list of id |  | the people lit up (the rest dim) |
| `tours.<id>.steps[].lineage` | id |  | a person whose lineage is lit |
| `tours.<id>.steps[].stage` | string |  | the map stage shown beside the step (panels.map.maps[].id) |

### panels

The panels around the tree: the header card (title, key, glossary), introduction, caveats, sources, footer, scale and maps. Required.

| Field | Type | Required | What it is |
|---|---|---|---|
| `panels.header` | object | yes | where the title, key and glossary panel sits |
| `panels.header.x` | number | yes | its left edge (px) |
| `panels.header.y` | number | yes | its top (px) |
| `panels.header.width` | number | yes |  |
| `panels.header.height` | number | yes |  |
| `panels.header.arrange` | `"row"`, `"column"`, `"top"` |  | row (default): top left, the tree beside it; column: down the left side, as tall as the tree (at least its height: give a small tree's card the height its key and glossary need), holding the notes, caveats and sources too; top: across the top, as wide as the chart (width ignored), the tree below it |
| `panels.intro` | [text](#text) |  |  |
| `panels.caveats` | list of [text](#text) |  | what the reader should know about the chart's limits, as printed |
| `panels.sources` | list of string or object |  | the printed list of sources |
| `panels.badges` | list of id |  | media shown in the footer: the licence badge first |
| `panels.scale` | object |  | a scale beside a trunk: legend, court tradition, documented |
| `panels.scale.row` | 2 × id | yes | the first and last people of the legendary row |
| `panels.scale.trunk` | list of id | yes | the people of the trunk the scale runs beside |
| `panels.scale.documented` | id | yes | the first documented person |
| `panels.scale.stages` | 3 × object | yes |  |
| `panels.scale.stages[].head` | string | yes |  |
| `panels.scale.stages[].lines` | list of string | yes |  |
| `panels.map` | object |  | a grid of small maps, one per stage, drawn from ready-merged shapes (tools/map_shapes.py) |
| `panels.map.title` | string | yes |  |
| `panels.map.width` | number | yes | each map's width (px); its height follows from its view |
| `panels.map.columns` | integer, at least 1 |  |  |
| `panels.map.height` | number | yes | the panel's height (px), as rendered |
| `panels.map.boundaries` | object | yes | media (data): the regencies every map is coloured by, and the districts and villages areas are made of |
| `panels.map.boundaries.adm2` | id | yes |  |
| `panels.map.boundaries.adm3` | id |  |  |
| `panels.map.boundaries.adm4` | id |  |  |
| `panels.map.leaveOut` | map: name → list of string |  | regencies left off the maps, by a property's value |
| `panels.map.assignments` | id | yes |  |
| `panels.map.shapes` | id | yes |  |
| `panels.map.views` | map: name → 4 × number | yes | longitude west, east, latitude south, north |
| `panels.map.colours` | map: name → string | yes | names for colours the maps use (each a colour as in a fill) |
| `panels.map.areas` | map: name → object or object |  | parts of regencies drawn over a map: districts by name, or a group of villages |
| `panels.map.maps` | list of object | yes |  |
| `panels.map.maps[].id` | string | yes | the stage id (assignments, tours: map:&lt;id>) |
| `panels.map.maps[].from` | integer | yes | the first year the map describes (the viewer's time slider) |
| `panels.map.maps[].view` | string | yes |  |
| `panels.map.maps[].title` | string | yes |  |
| `panels.map.maps[].caption` | string | yes |  |
| `panels.map.maps[].note` | string |  |  |
| `panels.map.maps[].fills` | map: name → string | yes | polity (from the assignments) -> its fill |
| `panels.map.maps[].default` | string | yes | a colour, or "a/b": diagonal stripes of colour a over b. A colour is #RRGGBB, house:&lt;id>, house:&lt;id>+0.6 (that house's colour tinted), palette:&lt;key>, or a name from panels.map.colours |
| `panels.map.maps[].regions` | map: name → string |  | a regency's own fill, by name, over its polity's |
| `panels.map.maps[].overlays` | list of object |  |  |
| `panels.map.maps[].overlays[].area` | string | yes |  |
| `panels.map.maps[].overlays[].fill` | string | yes | a colour, or "a/b": diagonal stripes of colour a over b. A colour is #RRGGBB, house:&lt;id>, house:&lt;id>+0.6 (that house's colour tinted), palette:&lt;key>, or a name from panels.map.colours |
| `panels.map.maps[].overlays[].outline` | true or false |  | white outline, not cut to the coast (enclaves) |
| `panels.map.maps[].marks` | one of the kinds [below](#panels-map-maps-marks) |  |  |
| `panels.map.legend` | list of object or object |  |  |
| `panels.key` | object |  | the Key: house (the colour of its examples; default the first house), contrast (a second house: the line passing under, the princess married in; default the second), labels (other wording for an entry, by its id: solid, dot, grey, omitted, chronicle, caption, crossing, house, houseDisputed, bracket, event, ruler, heir, rival, traditional, legendary, minor, marriedIn, neutral, text, noPortrait, tag, crown, letter, band, era, episode, axis). Rows appear only for what the chart uses. |
| `panels.key.house` | id |  | a houses id |
| `panels.key.contrast` | id |  | a houses id |
| `panels.key.labels` | map: name → [text](#text) |  |  |
| `panels.glossaryTitle` | [text](#text) |  |  |
| `panels.succession` | object |  | a table of the court's reigns in order, with how each came to rule (worked out from the descents); shown in a column or top card when there is room |
| `panels.succession.court` | id | yes | a houses id |
| `panels.succession.title` | [text](#text) |  |  |
| `panels.viewer` | object |  | the interactive viewer |
| `panels.viewer.languages` | list of language tag |  | interface languages the viewer offers, in order; default all it has (en, id) |
| `panels.viewer.year` | integer |  | the year the time slider opens at when no one is selected; default the middle of the chart's years |

#### panels.map.maps[].marks

Each has a `kind`, and the fields of its kind:

| `kind` | Other fields | What it does |
|---|---|---|
| `place` | `at`: 2 × number; `label`: string; `position` (optional): `"above"`, `"below"`, `"left"`, `"right-below"` | a place: a dot and its name |
| `dot` | `at`: 2 × number; `r`: number; `fill`: string; `stroke` (optional): number | a coloured dot, white-ringed |
| `ring` | `at`: 2 × number; `label`: string | a ring round something too small to see, with a label |
| `frame` | `view`: string | the box of another view (a detail map) |

### media

Pictures and data files, with their credits. Optional.

| Field | Type | Required | What it is |
|---|---|---|---|
| `media.<id>.kind` | `"portrait"`, `"emblem"`, `"badge"`, `"image"`, `"source"`, `"data"` | yes |  |
| `media.<id>.file` | string | yes | path relative to meta.assetRoot |
| `media.<id>.of` | id |  | whom or what it shows: a person or house id |
| `media.<id>.credit` | object |  | the credit, printed on the credits page |
| `media.<id>.credit.title` | string | yes | what the picture is, as the credits page names it |
| `media.<id>.credit.source` | string |  | the page it came from |
| `media.<id>.credit.fileUrl` | string |  | the file itself |
| `media.<id>.credit.author` | string |  |  |
| `media.<id>.credit.licence` | string |  | public domain, CC BY-SA 4.0, … |
| `media.<id>.credit.changes` | string |  | what was changed (cropped, tone adjusted) |
| `media.<id>.credit.note` | string |  |  |
| `media.<id>.private` | string |  | why it may not be published; a public build leaves it out without moving anything |

### display

How content is drawn beyond each record's own show: side-by-side rows, house pills and headers, brackets and events. Optional.

| Field | Type | Required | What it is |
|---|---|---|---|
| `display.rows` | list of object |  | a side-by-side row: members stand left of the anchor on its row, joined left to right (the legendary ancestors) |
| `display.rows[].anchor` | id | yes |  |
| `display.rows[].members` | list of id | yes |  |
| `display.rows[].gap` | number | yes |  |
| `display.pills` | map: id → object |  | a house pill on the line into a person (the first member of a house) |
| `display.pills.<id>.label` | string | yes |  |
| `display.pills.<id>.house` | id | yes | a houses id |
| `display.pills.<id>.disputed` | true or false |  | drawn hatched: a disputed succession |
| `display.headers` | map: id → object |  | a house header beside the pill |
| `display.headers.<id>.emblem` | id |  | a media id |
| `display.headers.<id>.kind` | string | yes | Sultanate, Duchy, … |
| `display.headers.<id>.name` | string | yes |  |
| `display.headers.<id>.years` | string | yes |  |
| `display.headers.<id>.seat` | string | yes | where the court sat |
| `display.headers.<id>.founded` | string | yes | how it was founded (Treaty of Giyanti) |
| `display.brackets` | list of object |  | a bracket under several people with a label (rival claimants) |
| `display.brackets[].members` | list of id | yes |  |
| `display.brackets[].label` | string | yes |  |
| `display.events` | map: id → string |  | a short event label on the line into a person |
| `display.keepTogether` | list of string |  | names printed before a regnal number ("Pakubuwana II"): a note never breaks a line between the two |
| `display.timeOrder` | true or false |  | rows keep time order across branches: nobody is drawn above a person with an earlier year (for charts whose branches have very different generation lengths) |

### adjustments

Hand fixes to the automatic layout, each with its reason. Optional.

Each adjustment has a `kind`, the `target` it applies to (a person unless the kind says otherwise), the fields of its kind, and a `reason` (shown in the editor's Adjusted tab).

| `kind` | Other fields | What it does |
|---|---|---|
| `nudge` | `target`: id; `dx` (optional): number; `dy` (optional): number; `reason`: string | move a person (dx: with everyone below them; dy: their row) |
| `follow` | `target`: id; `of`: id; `dx`: number; `reason`: string | place a person relative to another, moving with them |
| `coupleSide` | `target`: id; `side`: `-1`, `0`, `1`; `reason`: string | which side of the parent's other children a couple's children go (target: a union; 0 the centre) |
| `shareBus` | `target`: id; `reason`: string | the line hangs off the parent's existing line (target: a descent) |
| `breakAt` | `target`: id; `at`: number, 0 to 1; `reason`: string | where the break mark sits on the line (target: a descent) |
| `markerTop` | `target`: id; `reason`: string | the note letter at the top right of the box |
| `textLift` | `target`: id; `dy`: number; `reason`: string | lift a text label (px) |
| `headerLeft` | `target`: id; `reason`: string | the house header goes left of the pill |
| `noteOffset` | `target`: id; `dx` (optional): number; `dy` (optional): number; `reason`: string | move a note (target: a note) |
| `drop` | `target`: id; `drop`: number; `reason`: string | distance from the parent's bottom to the line (target: the first descent of a line) |

### acceptedWarnings

Build warnings looked at and accepted; a warning that matches is reported as accepted, not as new. Optional.

| Field | Type | Required | What it is |
|---|---|---|---|
| `acceptedWarnings.<id>.match` | string | yes |  |
| `acceptedWarnings.<id>.reason` | string | yes | why: shown in the editor's list of adjustments (may be empty) |

### theme

How the chart looks: colours, type sizes and fonts. Required.

| Field | Type | Required | What it is |
|---|---|---|---|
| `theme.palette` | object | yes | the chart's colours, #RRGGBB: background, the era bands, text, note text, muted and faint text, neutral cards, grey lines |
| `theme.palette.background` | colour (#RRGGBB) | yes |  |
| `theme.palette.band` | colour (#RRGGBB) | yes |  |
| `theme.palette.ink` | colour (#RRGGBB) | yes |  |
| `theme.palette.noteInk` | colour (#RRGGBB) | yes |  |
| `theme.palette.muted` | colour (#RRGGBB) | yes |  |
| `theme.palette.faint` | colour (#RRGGBB) | yes |  |
| `theme.palette.neutral` | colour (#RRGGBB) | yes |  |
| `theme.palette.greyLine` | colour (#RRGGBB) | yes |  |
| `theme.type` | object | yes | type scale in px at 1x: title, name and reign (ruler cards), name2 and sub2 (small cards), note, cap (captions on lines), small |
| `theme.type.title` | number above 0 | yes |  |
| `theme.type.name` | number above 0 | yes |  |
| `theme.type.reign` | number above 0 | yes |  |
| `theme.type.name2` | number above 0 | yes |  |
| `theme.type.sub2` | number above 0 | yes |  |
| `theme.type.note` | number above 0 | yes |  |
| `theme.type.cap` | number above 0 | yes |  |
| `theme.type.small` | number above 0 | yes |  |
| `theme.fonts` | object | yes | the fonts, by name |
| `theme.fonts.sans` | string | yes | the font for all text: gantari (open) or altehaas (proprietary: never in a public build) |
| `theme.fonts.script` | string | yes | the font for house names: felipa (open) or chancery (proprietary) |
| `theme.fonts.secondScript` | string |  | the font of the title's second script: noto (aksara Jawa), noto-jp (Japanese); without it the browser picks one |
| `theme.fonts.javanese` | string |  | older name of secondScript |

## Shared types

### Text

A plain string (the document's default language) or text by language tag.

For example `"Hamengkubuwana I"`, or `{"en": "Wangsa Mataram", "jv-Java": "ꦮꦁꦱ​ꦩꦠꦫꦩ꧀"}`. Only `<b>`, `<i>` and `<br>` markup is allowed in text; write a plain `<` as `&lt;`.

### Date

A date: the EDTF value and, optionally, the wording it came from.

| Field | Type | Required | What it is |
|---|---|---|---|
| `edtf` | string | yes | an EDTF date (Library of Congress, level 1, plus level 2 sets): 1587~, 1792/1810, 1989/.., [1822,1823] |
| `text` | string |  | the date as written (c. 1587) |

For example `{"edtf": "1755/1792", "text": "1755 – 1792"}`, `{"edtf": "1587~", "text": "c. 1587"}`, or `{"edtf": "1989/.."}` (from 1989, still going).

### Citation

A source for a fact, and where in it.

| Field | Type | Required | What it is |
|---|---|---|---|
| `source` | id | yes | the work cited: a sources id |
| `where` | string |  | page, folio or section |
| `quay` | integer, 0 to 3 |  | GEDCOM 7 quality: 0 unreliable, 1 questionable, 2 secondary, 3 direct |

### Event

One claim about an event (a birth, a death); several claims make a list, the preferred first.

| Field | Type | Required | What it is |
|---|---|---|---|
| `date` | [date](#date) |  |  |
| `place` | [text](#text) |  |  |
| `certainty` | `"high"`, `"medium"`, `"low"` |  | how sure the sources are |
| `note` | [text](#text) |  |  |
| `asOf` | string |  | when this was last true or checked (2026-11) |
| `sources` | list of [citation](#citation) |  | the sources for this record |

## The layout lock

`layout.lock.json` records where everything was accepted to be, in px on the chart's canvas. While a chart has one, the engine draws everything in it where the lock says (the editor's "Keep the layout", the build's `--frozen`) and places only what is new. `npm run build:chart -- <chart.json> --lock` names what moved since the lock was written, and `--update-lock` accepts the new layout.

| Field | Type | Required | What it is |
|---|---|---|---|
| `format` | `1` | yes |  |
| `chart` | string | yes | meta.id of the chart document |
| `canvas` | 2 × integer, at least 1 | yes | [width, height] |
| `errors` | integer, at least 0 | yes | layout errors when the lock was written (should be 0) |
| `warnings` | list of string | yes | layout warnings when the lock was written |
| `boxes` | map: name → 4 × number | yes | each person's box, by person id |
| `drops` | map: name → 2 × number | yes | the line into each child, by person id ("child@descent" when a child has more than one line): [x, y of the horizontal line it leaves] |
| `lines` | map: name → list of number | yes | the levels (y) of each line's horizontal runs, by descent id (a line's first descent) or union id |
| `notes` | map: name → 4 × number | yes | inline notes, by note id |
| `letters` | map: name → string | yes | the letter of each numbered note, by note id |
| `pills` | map: name → 2 × number | yes | house pills, by person id: centre [x, y] |
| `headers` | map: name → 4 × number | yes | house headers, by person id |
| `crowns` | map: name → 4 × number | yes | crowns, by person id |
| `brackets` | map: name → 3 × number | yes | brackets, by their members joined with +: [x0, x1, y] |
| `axis` | map: name → number | yes | the y of each era's year on the time axis, by year |
| `eraLabels` | map: name → 4 × number | yes | era labels, by year |

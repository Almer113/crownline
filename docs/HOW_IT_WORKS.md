# How Crownline works

Crownline draws large royal genealogy charts in the style of UsefulCharts. A chart is one JSON document. The layout engine places every person on rows and a time axis, routes every line, places the labels, checks the result for collisions and writes one HTML page. Headless Chrome turns that page into a PNG and a PDF, and the interactive viewer shows it with a layout file beside it.

This guide explains how a chart document becomes a drawn chart: the steps, the modules that do them, what the lines and marks mean, the layout check, the lock, and the tools that change a chart. The two charts in the repository are the examples: `charts/wangsa-mataram` (the Mataram dynasty and its four royal houses) and `charts/tokugawa` (the Tokugawa shoguns).

Other documents:

- [GETTING_STARTED.md](GETTING_STARTED.md): installing and first steps.
- [FORMAT.md](FORMAT.md): every field of `chart.json` and `layout.lock.json`, generated from the schema.
- [STYLE.md](STYLE.md): the rules of the style (layout, lines, boxes and colour, text).
- [EDITOR.md](EDITOR.md): the editor.
- [AI.md](AI.md) and [AI_GUIDE.md](AI_GUIDE.md): the `crownline` command line and MCP tools.
- `charts/wangsa-mataram/NOTES.md`: notes for the Mataram chart's maintainers (map data, portraits, versions, open items).

**Contents**

1. [The pipeline](#1-the-pipeline)
2. [Quick start](#2-quick-start)
3. [Outputs](#3-outputs)
4. [Packages and modules](#4-packages-and-modules)
5. [The chart document](#5-the-chart-document)
6. [Adjustments](#6-adjustments)
7. [The layout](#7-the-layout)
8. [Lines](#8-lines)
9. [The rest of the page](#9-the-rest-of-the-page)
10. [The layout check](#10-the-layout-check)
11. [Rendering](#11-rendering)
12. [The layout file](#12-the-layout-file)
13. [Maps](#13-maps)
14. [Portraits, emblems and fonts](#14-portraits-emblems-and-fonts)
15. [The lock and frozen mode](#15-the-lock-and-frozen-mode)
16. [Operations](#16-operations)
17. [The surfaces: app, viewer, command line](#17-the-surfaces-app-viewer-command-line)
18. [Recipes](#18-recipes)
19. [The rules of the style](#19-the-rules-of-the-style)
20. [The Python reference engine](#20-the-python-reference-engine)

---

## 1. The pipeline

```
chart.json ──► validate ──► compose() ───────────────────────► render() ──────────► <id>.html ──► print.ts ──► PNG, PDF
(content)      (schema,     boxes, tables, tree, rows,          route(), crossings(),    │           (Chrome, through
               check.ts)    time axis, columns, canvas          placeLabels(), check(),   │            Playwright)
                            (frozen: pinned to the lock)        the page as HTML + SVG    │
                                                                                          └──► layoutFile() ──► <id>.layout.json
layout.lock.json ──► (frozen mode only) ──► compose()                                         lockOf() ──► layout.lock.json (--update-lock)
```

In words:

1. The document is validated: the JSON Schema first, then the rules a schema can't state (`packages/schema`).
2. `compose()` lays the chart out: box sizes, the tree, rows, the time axis, columns and the canvas. With a lock, everything the lock holds is pinned where it was.
3. `render()` routes the lines, works out the crossings, places the labels, runs the layout check and assembles the HTML page.
4. `layoutFile()` writes what the viewer needs; `lockOf()` gives the lock of this layout.
5. `png()` and `pdf()` in `print.ts` print the page in Chrome or Edge.

The engine core (`packages/engine/src/index.ts`) reads no files. On the command line `src/node.ts` loads a chart and its fonts from disk; in the browser editor `src/web.ts` builds the same environment from files fetched first. So the command line, the editor and the tools all lay a chart out with the same code.

## 2. Quick start

You need Node 22 and npm (`npm install` once in the repository root), and Google Chrome or Microsoft Edge for the images (`CHART_BROWSER` names another executable). Python 3 (`pip install -r requirements-dev.txt`) is needed only for the reference engine, the scripts in `tools/` and the Python tests. [GETTING_STARTED.md](GETTING_STARTED.md) has the details.

| Command | What it does |
|---|---|
| `npm run check` | Validates every `charts/*/chart.json`, and the `layout.lock.json` beside each. Name files to check only those. |
| `npm run build:chart` | Builds every chart: the page, the layout file and the check report. |
| `npm run build:chart -- charts/tokugawa/chart.json` | Builds one chart. |
| `npm run build:chart -- <chart.json> --png --pdf` | Builds, checks and prints the PNG and PDF. |
| `npm run dev` (or `npm run edit`) | The app at http://127.0.0.1:5180: the library, the view and the editor. |
| `npm run crownline -- help` | The `crownline` command line (and `crownline mcp`, the MCP server). |

The build prints every problem, then a line such as `check: 0 errors, 2 warnings`. It refuses to print a PNG or PDF while the check finds errors, unless you pass `--force`. Mataram builds with 0 errors and 2 accepted warnings, Tokugawa with none.

### Build options

All from `packages/engine/src/cli.ts`. Unknown options are refused.

| Option | What it does |
|---|---|
| `[chart.json]` | The chart. Without one, every chart in `charts/`. A path is taken from the folder you typed the command in, else from the repository. |
| `--public` | A public build (`<id>-public.*`): private media are left out, and proprietary fonts are refused. |
| `--out NAME` | Another output name, relative to the repository or absolute. Needs a chart. |
| `--header A[,SIZE]` | Try another header card: `row`, `column` or `top`, with its width (or height, for `top`). For example `--header column,800`. |
| `--png` | A PNG at 2× scale. |
| `--preview` | A quick 1× PNG (`<name>-preview.png`) instead. Not with `--png`. |
| `--pdf` | A one-page PDF. |
| `--force` | Print the PNG or PDF, or save the lock, even when the check finds errors. |
| `--json` | Print the check report as JSON (with every chart: one document, by chart id). |
| `--frozen` | Lay out from the lock beside the chart ([§15](#15-the-lock-and-frozen-mode)). |
| `--lock` | Compare the layout with the lock and name what moved. `--all` lists every item, not the first few of each kind. |
| `--update-lock` | Accept this layout: write the lock. Refused while the check finds errors, unless `--force`. |

The exit code is 0 when all is well, 1 when the check finds errors or `--lock` finds something moved (or an image or lock was refused), and 2 for a mistake in the command, a document that fails validation, or a missing lock.

## 3. Outputs

The build writes at the repository root, so the page's relative paths to fonts, portraits and emblems resolve. Files are named after `meta.id`.

| File | What it is |
|---|---|
| `<id>.html` | The chart as one HTML page, everything positioned absolutely, with SVG layers for lines and maps. Mataram's is 9169 × 4368 CSS px. |
| `<id>.layout.json` | The layout file for the viewer ([§12](#12-the-layout-file)). |
| `<id>.png` | The print image at 2× (Mataram: 18338 × 8736 px). |
| `<id>-preview.png` | A 1× image, with `--preview`. |
| `<id>.pdf` | The page printed to PDF. |
| `<id>-public.*` | The same for a public build. |
| `charts/<id>/layout.lock.json` | The accepted layout, written only by `--update-lock`, the editor or the tools. |

The canvas size is not fixed. It comes out of the layout, so it changes when people are added or moved.

## 4. Packages and modules

The repository is a set of npm workspaces under `packages/`:

| Package | Job |
|---|---|
| `schema` | The chart document's schema (TypeBox, JSON Schema 2020-12) in `chart.ts`, the second-pass checks in `check.ts`, migrations in `migrate.ts`, the lock schema in `lock.ts`. `npm run check` runs it. |
| `engine` | The layout engine the build runs on (below). |
| `ops` | The named operations that change a document, each giving a patch for undo ([§16](#16-operations)). |
| `viewer` | The `<crownline-viewer>` web component. |
| `editor` | The editor, a library the app mounts. |
| `app` | One app: the library of charts, the view and the editor. Its `vite.config.ts` is the local server that reads and saves chart files. |
| `cli` | The `crownline` command line and MCP server. |

The engine's modules, in `packages/engine/src/`, in the order the build uses them:

| Module | Job | Main exports |
|---|---|---|
| `doc.ts` | Reading text fields (plain or by language), media, and private media for a public build. | `text` |
| `text/measure.ts`, `text/font.ts` | Text width from the font files, as Chrome lays text out. | `Measure`, `parseFont` |
| `fonts.ts` | The fonts `theme.fonts` can name, as files. | `fontChoice`, `SANS`, `SCRIPT`, `SECOND_SCRIPT` |
| `node.ts`, `web.ts` | The environment from disk (command line, tests) or from fetched files (browser). | `load`, `envFor`, `webEnv` |
| `boxes.ts` | The box model: each person's box size, and the boxes placed before the layout (spouses beside partners, side-by-side rows). | `makeBoxes`, `dispTitle` |
| `tables.ts` | The document read into the tables the layout uses: lines, marriages, adjustments, display. | `readTables` |
| `tree.ts` | Units, groups of children, the single root. | `buildTree`, `TreeError` |
| `rows.ts` | Each person's row. Also the header card. | `placeRows`, `headerPanel` |
| `axis.ts` | The background time axis fitted to the rows. | `fitAxis` |
| `notes.ts` | Note text: which spaces must not break, how many lines a note needs. | `noteText`, `nobreak` |
| `columns.ts` | Outlines and the tidy-tree packing: each person's x. | `geometry`, `placeColumns` |
| `canvas.ts` | The tree placed around the header card and map panel; the canvas size, notes band and footer. | `placeCanvas` |
| `compose.ts` | The layout end to end, frozen or not. | `compose` |
| `routing.ts` | Every line as segments: buses, drops, hooks, marriage lines. | `route` |
| `crossings.ts` | Which line passes over which, and the gaps cut in the one underneath. | `crossings` |
| `labels.ts` | Break marks, captions, events, bracket, era and episode labels. | `placeLabels` |
| `checks.ts` | The layout check. | `check`, `issue` |
| `content.ts` | The title's second script, the succession table, the sources text. | `succession`, `sourcesText` |
| `maps.ts` | The map panel. | `mapPanel`, `mapSize` |
| `render.ts` | The page: routing, crossings, labels and the check, then the HTML. | `render` |
| `layout.ts` | The layout file. | `layoutFile` |
| `lock.ts` | The lock: making it, comparing two, freezing a layout to one, writing it. | `lockOf`, `diffLock`, `freeze`, `dumpLock` |
| `print.ts`, `png.ts` | PNG and PDF in Chrome; a small PNG reader and writer for the tiles. | `png`, `pdf` |
| `cli.ts` | `npm run build:chart`. | `main` |
| `py.ts` | Python's number formatting, so the output matches the reference engine to the character. | `pyFixed` |

## 5. The chart document

A chart lives in `charts/<id>/chart.json` (format 1), with an optional `layout.lock.json` beside it. The document holds everything a person decides; accepted positions are in the lock. [FORMAT.md](FORMAT.md) lists every field; this section explains what they do to the drawing.

Collections are objects keyed by short readable ids (`hb9`, `ieyasu`, `mooryati`): lower case, starting with a letter (`^[a-z][a-z0-9_]*$`) and unique across the whole document. Where order matters it is the order in the file: people in creation order, descents and unions in drawing order, glossary rows as printed. Note letters follow the position on the chart, not file order.

A text field is a plain string or text by language tag (`{"en": "…", "ja-Jpan": "徳川家康"}`). Dates are EDTF (`1587~`, `1792/1810`, `1989/..`), with the wording kept beside them.

### 5.1 Validation

`npm run check` runs two passes. First the JSON Schema: unknown fields are refused everywhere except under `ext`. Then the rules in `packages/schema/src/check.ts`:

- every id a record names exists and is the right kind of thing;
- ids are unique across the document;
- each person is placed once, there is one root, everyone is reachable from it, and no one is their own ancestor;
- only `<b>`, `<i>` and `<br>` markup;
- every title word is in the glossary (a warning).

Messages name the record and the field, for example `people.hb9.show.box: "king" must be one of "ruler", "heir", …`. It also checks the lock beside each document against its schema and against the document. The build refuses to lay out a document that fails. Editors that read `$schema` get completion from `packages/schema/chart.schema.json`. A newer format is refused; an older one is brought up to date with migrations (`migrate.ts`; there are none yet).

### 5.2 People

```json
"hb9": {"name": "Hamengkubuwana IX", "title": "Sri Sultan", "house": "yogyakarta",
        "reigns": [{"court": "yogyakarta", "n": 13, "when": {"edtf": "1940/1988", "text": "1940 – 1988"}}],
        "portrait": "p_hb9", "show": {"box": "ruler", "year": 1940, "sub": "r. 1940 – 1988"}}
```

`show.box` is the kind of box:

| Box | Looks like | Use for |
|---|---|---|
| `ruler` | Portrait and a coloured label | Anyone who reigned. |
| `heir` | The same, with a light tint of the house colour | An heir. |
| `minor` | Small coloured box, optional portrait | A royal who didn't reign. |
| `neutral` | Grey box, optional portrait | A public figure outside the courts. `sub` may contain `<br>`; `show.width` fixes the width. |
| `text` | Plain text, no box | A spouse with no public role. |
| `legend` | Outlined box, no portrait | A legendary ancestor. |

- `house` sets the box colour: a princess married into another house keeps her birth house's colour.
- `reigns[].n` is the order of the reign in its court's list; the crown shows it.
- `show.year` is when the person began to reign or became notable. The layout places them near that year.
- `show.hatch` stripes the box (a rival or unrecognised claimant); `show.tag` adds a badge (`"disputed"`); `show.portraitFrame` keeps an empty frame with the silhouette.
- `basis: "traditional"` gives a dashed outline on a pale fill (known only from court chronicles); `"legendary"` marks a legendary ancestor.
- `portrait` names a `media` record ([§14](#14-portraits-emblems-and-fonts)). Rulers without one get a grey silhouette.
- `bio`, `aka` and `variants` are shown in the viewer's panel and found by search.

**A spouse beside a partner.** `show.beside: {"of": "pb13", "side": "r"}` places the spouse on the partner's row, 46 px away (`GAP_X` in `boxes.ts`). The spouse moves with the partner and takes the partner's year. The partner must come earlier in the file. Every spouse drawn on the chart is placed this way.

**A side-by-side row.** `display.rows` puts people left to right on one row, joined side to side. Mataram uses it for its legendary ancestors, ending at Enis; the chronicle line bends down there.

**Following someone.** A `follow` adjustment places a person relative to another (`of`, `dx`), 60 px above them, and they move together. Mataram uses it for Sukarno beside his daughter Sukmawati, for example.

### 5.3 Relationships

A **union** is a couple, `partners: [left, right]` as drawn. `show.colour` is the colour of the marriage line, usually the incoming spouse's birth house; without it the line is grey. `show.childColour` colours the children's line when neither parent has a house colour.

A **descent** is one parent-child link, from a person (`parent`), from a couple (`union`: the child hangs from the marriage line), or from a person drawn from the couple's line (both). When a descent names a `union`, the line always comes down from the couple's marriage line; children whose other parent is not on the chart hang from the parent alone.

Consecutive descents from one parent with the same `union`, `hop`, `branch`, `row` and `group` form one line. `show.group` separates two lines that would otherwise join. The options, under `show`:

| Option | What it does |
|---|---|
| `line` | `solid` (the default, father to son), `dot`, `grey`, `legend` or `adopt` ([§8.1](#81-what-the-lines-mean)). |
| `break` | Marks omitted generations: a break mark and a label (`"grandson"`). |
| `caption` | A small label on the line into the child (`"court poet"`). |
| `hop` | A cross-house line. Drawn after the tree, passes over tree lines, places nobody. |
| `branch` | A second set of children (daughters married elsewhere) branching off the parent's line. Places nobody. |
| `row` | Parent and child side by side on one row. |
| `drawn: false` | With `hop`: kept in the data, not drawn. Tokugawa keeps its adoptions this way, since every adopted shogun is already joined to his birth father. |

A union-only descent takes only `show.line`. For a break, caption or hop, give it a `parent` too. `kind` (birth, adoptive, foster, step, claimed, in-law, other) is data; the succession table counts only `birth` as birth.

**A person appears in exactly one tree place.** The check refuses a person placed by two descents and names both. `hop`, `branch` and `row` descents, and descents into spouses placed `beside`, don't place anyone. A couple married twice is refused: the engine draws one marriage line per couple.

### 5.4 Display

- **`display.pills`**: `{first member: {label, house}}`. A rounded pill with the house name on the line into a house's first member. The line changes colour at the pill. `disputed: true` draws it hatched with a dashed outline.
- **`display.headers`**: the house header beside the pill: emblem, kind, name, years, seat and founding caption.
- **`display.events`**: a short event label on the line into a person ("TRUNAJAYA TAKES PLERED · 1677").
- **`display.brackets`**: rivals on one row under a bracket with a label ("DISPUTED SINCE 2025").
- **`display.keepTogether`**: names printed before a regnal number (`"Pakubuwana"`); a note never breaks a line between the name and the number.
- **`display.timeOrder`**: rows keep time order across branches ([§7.4](#74-rows)). Off for Mataram, on for Tokugawa.

### 5.5 Timeline

- **`timeline.eras`**: `[{year, name}]`. A dashed line across the chart with a large letter-spaced title. The first era has a title but no line, and sets where the axis starts: the half-century before it. The axis ends a decade after `meta.asOf`.
- **`timeline.episodes`**: `[{from, to, name}]`. A hatched band with a label at the right (at the left when something is in the way), such as "JAVA WAR · 1825–30".

### 5.6 Notes

```json
"n_benawa": {"anchor": "benawa", "text": "His father Hadiwijaya …", "show": {"side": "r", "width": 300}}
```

- `side`: `r`, `l`, `b` (below) or `t` (above, over the line into the box).
- `width`: 240, 300, 360, 440 or 560 px (`NOTE_WIDTHS`); other widths are drawn at the nearest.
- The text may use `<b>` and `<i>`.
- **Inline** (`show.inline: true`): in full beside the person.
- **Lettered** (the default): a small letter at the box's bottom-right corner, with the text in the Notes list. Letters run top to bottom, then left to right. A person can have one lettered note, plus inline ones.

Inline notes shift up or down to stay clear of era lines; notes above a box may sit on one.

### 5.7 Panels, glossary and tours

- **`panels.header`**: where the card with the title, Key and glossary sits. `arrange` is one of:
  - `row` (the default; Mataram): top left, the tree beside it, at the given width and height.
  - `column` (Tokugawa, 800 px wide): down the left side, as tall as the tree. It also holds the lettered notes, caveats, sources and badges, so there is no band under the chart.
  - `top`: across the top, as wide as the chart, the tree below it. No chart uses it yet.

  For a `column` card, the build estimates the content's height from the same text measurement and warns (`card-too-small`) when it doesn't fit.
- **`panels.intro`**, **`panels.caveats`**, **`panels.sources`** (parts may differ between public and private builds), **`panels.badges`** (footer logos, the licence badge first).
- **`panels.key`**: the Key shows a row only for what the chart uses. `house` and `contrast` pick the colours of its examples; `labels` gives other wording by row id.
- **`glossary`**: the titles table, one column per `group` in file order. `panels.glossaryTitle` is its heading. Titles are checked against it.
- **`panels.succession`**: `{court, title}`. A table of that court's reigns, with how each came to rule worked out from the descents: son, brother, grandson, adopted heir and so on, with the birth father where it helps. Shown in a `column` or `top` card when there is room. Where the kind of box changes (Tokugawa: shogun, then head of the house after 1868) a divider starts a new section.
- **`panels.scale`**: the historicity scale beside a trunk: legendary, court tradition, documented.
- **`panels.map`**: the map panel ([§13](#13-maps)).
- **`panels.viewer`**: `languages` the viewer offers (Tokugawa: `["en"]`, so no language switch) and the `year` the time slider opens at.
- **`houses.<id>`**: `name`, `colour`, and `reign`, how the viewer's panel names a reign (`{n}`, `{nth}`). Tokugawa: "{nth} head of the Tokugawa house".
- **`tours`**: guided tours for the viewer: steps with a caption, what to show and what to light. Every person and map id is checked.
- **`theme`**: the palette, the type scale (px at 1×) and the fonts.
- **`acceptedWarnings`**: build warnings looked at and accepted, each with a `match` and a `reason`. The `crownline` tools report a matching warning as accepted, not new.

## 6. Adjustments

Adjustments are hand fixes applied after the automatic layout. They fix one defect without re-flowing the chart. Each is a record with a `kind`, a `target` and a `reason`, which the editor lists:

```json
"nudge_ratuibu": {"kind": "nudge", "target": "ratuibu", "dx": 80, "reason": "room for the line from Hamengkubuwana II down to Kencana"}
```

| Kind (target) | What it does | Example |
|---|---|---|
| `nudge` (person) | `dx` moves the person and everyone below them; `dy` moves their row. | `ratuibu` +80 (Mataram); `sadanobu` +260 (Tokugawa). |
| `follow` (person) | Places a person relative to another (`of`, `dx`). | `sukarno` follows `sukmawati`. |
| `coupleSide` (union) | Which side of the parent's other children a couple's children go: −1, 0 or 1. Default: the side the wife stands on. `0` keeps file order. | `u_ieyasu_tsukiyama` 0: Nobuyasu before Ieyasu's sons by mothers not on the chart. |
| `shareBus` (descent) | The child continues the parent's existing horizontal line instead of a second parallel one. | `d_hb2_kyaimaja`. |
| `breakAt` (descent) | Where the break mark sits along its line (`at`, 0 to 1, default 0.5). | `d_juminah_bagong` 0.3. |
| `drop` (first descent of a line) | The preferred distance from the parent's bottom to the horizontal line. | `d_pb10_mooryati` 90. |
| `markerTop` (person) | The note letter at the box's top-right corner. | `am4`. |
| `textLift` (person) | Lifts a plain-text label (`dy`). | `ratnaningrum` 8. |
| `headerLeft` (person) | The house header goes left of its pill. | `pa1`. |
| `noteOffset` (note) | Moves a note (`dx`, `dy`). | Mataram has 42. |

Adjustments act on the line or union they target, not on the person: a child reached by a birth line and a `hop` line keeps a drop, a break mark and a `breakAt` for each.

Two kinds are structural: a `follow` adjustment (like `display.rows`) is what places that person. Deleting one disconnects the person, and the check says so.

Give every adjustment a reason. After a change that is meant to move something, check the moves with `--lock` and accept them with `--update-lock` ([§15](#15-the-lock-and-frozen-mode)).

## 7. The layout

The layout is a compact, landscape tidy tree, loosely tied to a time axis. This is the layout the project keeps; [STYLE.md](STYLE.md) says why. `compose()` runs these steps in order.

### 7.1 Text measurement

`text/measure.ts` measures text from the real font files: unrounded advance widths plus GPOS kerning, every kern lookup adding to the total, as Chrome (HarfBuzz) lays out Latin text. It matches Chrome to within about 0.015 px, so boxes are exactly as wide as their text needs.

`notes.ts` wraps notes the same way: `<b>` runs in bold, breaks at spaces and after a hyphen inside a word, a 0.5 px allowance. `nobreak()` keeps dates ("12 May"), numbered titles ("Pakubuwana II", from `display.keepTogether`) and a short last word together. Every note's height equals Chrome's; `npm run test:engine` checks this in Chrome.

### 7.2 Boxes

`makeBoxes()` in `boxes.ts` sizes every box from its text and the document's type scale (`theme.type`):

| Kind | Height | Width |
|---|---|---|
| ruler, heir | 88 px (`P`), plus an 88 px portrait on the left | At least 214 px (`LMIN`), or what the name, reign line or title needs. |
| minor | 62 px (`MINOR_H`), plus a 62 px portrait if there is one | At least 130 px. |
| neutral | 76 px, or 88 with a title | Measured (at least 150 px), or `show.width`. |
| legend | 62 px | At least 150 px. |
| text | 42 px, or 54 with a sub-line | Measured. |

A box's `x` is the centre of its **label**; the portrait hangs to the left of it. Titles are set in capitals, except abbreviations with lower case (GRAy., GRAj.), which keep their case (`dispTitle`). Spouses placed `beside` and side-by-side rows are placed here, before the layout.

### 7.3 The tree

`buildTree()` in `tree.ts`:

1. Every person not placed `beside` a partner, in a `display.rows` row or by a `follow` adjustment is a **unit**: the person, the spouses beside them and anyone following those spouses.
2. Each line of placing descents, and each union's children, adds a **group** of children under a unit. A group has a side (−1, 0, 1) that orders groups under one parent.
3. There must be **exactly one root** (Mataram: Brawijaya V; Tokugawa: `hirotada`, Ieyasu's father), with everyone connected to it. A document that doesn't make one tree stops with a `TreeError`; `npm run check` reports the same problems first.

### 7.4 Rows

`placeRows()` in `rows.ts` sets each person's vertical place:

- Each generation sits one step below its parent: the bus drop (`BUS`, 30 px), then at least 50 px to the child's top (`MINDROP`).
- A house's first member gets extra room for the pill and header (`HDR_ROOM`, 205 px); a child with a label on its line gets 40 px (`CAP_ROOM`). Children with a `shareBus` adjustment are exempt, so a break label doesn't re-flow the layout.
- **Soft time axis:** a row is pushed down when its people's years need it, at `RATE` 4.6 px per year. It is never pulled up.
- Siblings whose years are within 20 (`SIB_YEARS`) share a row; later ones go lower.
- **`display.timeOrder`:** nobody is drawn above anyone with an earlier year (their own descendants aside), and each era line after the first gets a gap of its own (`ERA_ROOM`, 70 px). Without it, a chart whose branches have very different generation lengths drifts: Tokugawa's main line has six generations in 110 years, so its Mito and Kii branches ended up far above their dates.

### 7.5 The time axis

`fitAxis()` in `axis.ts` fits the background axis to where people actually are: a monotone (isotonic) fit of row position against year, over everyone except spouses, followers, plain-text boxes and legends. The half-century bands and era lines become a faithful but gentle guide rather than a rigid scale. Consecutive era lines stay at least 90 px apart, and the bands reach below the last person. `axis.Y(year)` gives the y of any year.

### 7.6 Columns

`geometry()` and `placeColumns()` in `columns.ts` do a tidy-tree packing:

- Each person's **outline** includes their box, crown, badge, pill, house header, caption room, inline notes and the line into each child. Packing outlines rather than boxes keeps notes and headers clear of each other.
- A parent sits straight above its **main successor** when one child's branch is by far the largest (at least 4 people and twice the next): the spine, such as the line of kings. Otherwise it is centred over its children.
- Siblings are packed as close as their outlines allow, 44 px apart (`GAP`), never left of an elder sibling. Groups are packed outward from the centre group.
- Each `nudge` adjustment's `dx` then shifts that person's whole branch.

### 7.7 The canvas

`placeCanvas()` in `canvas.ts` moves the tree clear of the header card (top left) and the map panel (top right), and sets the canvas size, with 120 px gutters for the year labels (`GUTTER`). Below the tree come the Notes band (up to five balanced columns, its height measured from the wrapped text) and the footer (170 px, `FOOT_H`: caveats, sources and logos). A `column` card is stretched as tall as the chart and a `top` card as wide. Mataram's header card is at x 140, y 130, 2190 × 950; its map panel is 2542 × 980.

## 8. Lines

`route()` in `routing.ts` draws tree descents first, then marriages, then the cross-house (`hop`) lines.

### 8.1 What the lines mean

| Style | Meaning |
|---|---|
| Solid (`solid`) | Father to son. |
| Dotted (`dot`) | Through a daughter, or by marriage. |
| Grey (`grey`) | Marriage, descent or patronage outside the dynasty. |
| Legendary (`legend`) | Descent claimed by the chronicles. |
| Long dashes (`adopt`) | Adopted as heir. |
| Break mark and label | Generations omitted: GRANDSON, GRANDDAUGHTER, DESCENDANT. |

A line takes the colour of the house of the person it leads to, and switches at a house pill. Lines are 4.5 px wide (`LINE`) with rounded elbows of radius 14 (`CORNER`).

### 8.2 Shapes

1. **Straight down:** a single child directly below the parent.
2. **Bus:** down from the parent's bottom to a horizontal line (the bus), along it, and down into the top of each child.
3. **Shared bus** (`shareBus`): the child is reached by extending the parent's existing bus, so a grandchild through an omitted daughter stays on the parent's line.
4. **Hook:** a child level with its parent is still entered from the top: down from the parent, across to a gap beside the child, up past it, over and down. If no clean hook exists, the line is left out with a `no-clean-line` warning, and the box's own text ("daughter of …") carries the link.
5. **Row:** side by side, for `display.rows`.

### 8.3 The bus level

Each bus tries levels nearest the preferred drop first (30 px, or the `drop` adjustment), in 3 px steps, at least 22 px below the parent. A level is taken only if it:

- passes through no box and no text block (house headers, inline notes, crowns, pills);
- stays at least 22 px from every era line (`ERA_CLEAR`);
- has clear drops from the parent and into every child, ending at least 30 px above the children's tops;
- is at least 30 px from any other horizontal line it overlaps (`BUS_GAP`).

If no level is clear, it shares the parent's existing line if there is one. Otherwise it takes the compromise farthest from other lines and records a `no-clear-level` warning. A line from a marriage also keeps at least 14 px below both partners' boxes.

### 8.4 Marriage lines

- A horizontal line between the partners at their row's centre, coloured by the union's `show.colour`, or grey.
- When the couple has children, the half nearest the partner who carries the line (the one the other was placed beside) is drawn in the children's style and colour, so the children's line visibly comes from the royal parent.
- The drop falls from the middle of the marriage line, **unless a child stands under the marriage line**. Then it goes straight down into that child (the one nearest the middle, if several), with no middle drop and jog back.

### 8.5 Crossings

`crossings()` in `crossings.ts` draws every crossing as one line passing over the other, with a gap cut in the line underneath. The gap is a mask, so the background shows through. The one on top is chosen in this order:

1. Solid over dotted or grey.
2. Then a cross-house (`hop`) line over a tree line.
3. Then a direct line over one across omitted generations (with a break mark).
4. Then the later-drawn line.

No gap is cut inside a rounded elbow or at a junction.

### 8.6 Labels on lines

`placeLabels()` in `labels.ts`:

- **Break marks:** two slanted strokes on a background-coloured patch, the label in capitals to the right, halfway down the drop by default (`breakAt` moves it).
- **Captions** and **events** sit beside the drop near the child. One whose person has no line into them is left out with a `label-left-out` warning.
- **Bracket labels** sit just above the bracket, in one piece in a gap between the lines passing down through it. Too wide for any gap, a label is split in two either side of the line nearest the middle ("REJECTED THE | 2015 DECREES"); the last resort is two lines.
- **Era titles** go on the left if free, otherwise at the first clear spot below or above the line. **Episode labels** go right, or left when something is in the way.

Text that might sit over a line has a halo in the background colour, so it stays readable.

## 9. The rest of the page

`render()` in `render.ts` assembles everything else:

- **Background:** alternating half-century bands, hatched episode bands, dashed era lines with the era year in bold in both gutters, and year ticks every 50 years. A tick within 45 px of an era year is hidden.
- **Header card:** the title and its second script (Mataram: aksara Jawa; Tokugawa: Japanese), the subtitle and introduction, the Key, the glossary, and in a `column` or `top` card the succession table.
- **House headers:** emblem, "KIND OF", the house name in the script font, years · seat, and the founding caption in italics.
- **Historicity scale** (`panels.scale`): LEGENDARY along the legendary row, COURT TRADITION (dashed) down the trunk, then DOCUMENTED (solid, with an arrow at the first documented ruler).
- **Crowns:** centred over the portrait, lifted above a bracket.
- **Notes band:** the lettered notes, each with its house-coloured letter (in a `column` card, in the card).
- **Footer:** the caveats, the sources ending with `meta.asOf.text`, and the badges. A public build leaves out private media.

## 10. The layout check

`check()` in `checks.ts` runs on every build, in the editor after every change and in every `crownline` batch.

**Errors:**

| Code | What it means |
|---|---|
| `boxes-overlap` | Two boxes overlap. |
| `line-through-box` | A line passes through a box, other than entering or leaving it at its edge. |
| `lines-overlap` | Two parallel lines from different parents lie on each other (within 18 px for more than 20 px), unless one deliberately shares the other. |
| `blocks-overlap` | Two text blocks or panels overlap. |
| `block-over-box` | A text block or panel overlaps a box. |
| `line-through-block` | A line runs through a text block. |
| `era-line-through-block` | An era line runs through a note or label. Era labels, crowns, brackets, panels and notes above a box are exempt. |

Text blocks are the header, map panel, house headers, inline notes, era, episode and bracket labels, pills, the footer, historicity labels and crowns.

**Warnings** (rendering goes ahead):

| Code | What it means |
|---|---|
| `no-clear-level` | A line fell back to a compromise level. |
| `no-clean-line` | A hook found no route; the label stands in. |
| `card-too-small` | The header card's content doesn't fit. |
| `label-left-out` | A break mark, caption or event with no line into its person. |

Mataram's two warnings are long-standing, accepted compromises (`charts/wangsa-mataram/NOTES.md`).

Each problem is a sentence (`report.errors`, `report.warnings`) and an **issue** (`report.issues`) with `severity`, `code`, `message`, the `people`, `lines` and `blocks` involved (document ids; blocks by name, such as `note:<id>` or `crown <id>`), and a `box` on the canvas as `[left, top, right, bottom]`. Lines are named by their first descent's id, or a couple's line by its union id. `--json` prints the report; the editor and the tools work from the issues.

Aim for 0 errors and no new warnings after every change.

## 11. Rendering

The page is HTML with SVG layers. It refers to fonts, portraits and emblems by path, which is why it is written at the repository root.

`print.ts` drives the installed Chrome or Edge through Playwright (no browser download; `CHART_BROWSER` picks another). Very large single screenshots come out blank, so the PNG is shot in **tiles of at most 2400 CSS px** (`TILE`): the chart is shifted under a fixed window for each tile. One browser is started per tile size, because an emulated scale snaps text differently. `png.ts` stitches the tiles band by band, so the whole image is never in memory. The PDF is printed with no header or footer.

The page is opened from a temporary copy at the repository root (`_print_<pid>.html`), so its asset paths resolve wherever it was written. Mataram's 2× PNG takes about 40 s.

## 12. The layout file

`layoutFile()` in `layout.ts` writes `<id>.layout.json`, the contract between the engine and the viewer. In chart pixels, with rectangles as `[left, top, right, bottom]`, it holds:

- every person's box, family, notes, reign order and date span, and, when the chart gives them, their biography, other names, birth and death claims (the preferred first, each with its sources) and citations;
- the works those cite (`sources`), for the panel's numbered list;
- every line with the people it joins;
- notes, house headers and crowns;
- the glossary, eras, map stages and tours;
- whether it is a public build, and which chart.

The viewer uses it for clicking, search, the panel, the time slider, tours and links. Format 1: fields are only ever added.

## 13. Maps

A chart with `panels.map` gets a panel of small maps, one per stage, with a shared legend. Mataram's has six maps of Java, three across, from c. 1640 to the Republic; Tokugawa has none. `maps.ts` only projects and draws: everything the maps show is in the document, and the shapes come ready merged.

What the document gives (`panels.map`):

- `width`, `columns`, `height`: each map's width, maps per row and the panel's height. The panel is `columns × width + 25 × (columns − 1) + 32` px wide.
- `boundaries`: the media ids of the boundary files (`adm2` regencies, and `adm3`, `adm4` for areas); `leaveOut`; `assignments` (which polity each regency belongs to at each stage); `shapes` (the merged shapes file).
- `views` (named longitude and latitude boxes), `colours` (named colours) and `areas` (districts or village groups drawn over regencies).
- `maps`: one per stage, with its `id`, `from` year (the viewer's time slider), `view`, `title`, `caption`, optional `note`, `fills` (polity → colour), `default`, `regions` (one regency's own colour), `overlays` (an area and its colour; `outline` for an enclave) and `marks` (`place`, `dot`, `ring`, or the `frame` of another view).
- `legend`: a fill or a dot, and its label.

A colour is `#RRGGBB`, `house:<id>`, `house:<id>+0.6` (that house's colour tinted), `palette:<key>` or a name from `colours`; `a/b` is diagonal stripes of *a* over *b*, for intermixed or contested lands.

The merging needs Shapely, so it is done once by `tools/map_shapes.py` (`CHART_DOC` names the chart): the land's outline, each map's regencies merged by colour, and each area cut to the land. Run it again after changing a map's fills, regions or areas, or the boundary data; `--check` says whether the shapes file is up to date. Each colour's regencies are one shape with its inner seams closed, grown by a tiny seam allowance and cut back to the coast. The coastline is drawn once, from the outline of all the land.

How Mataram's boundary data is made is in `charts/wangsa-mataram/NOTES.md`.

## 14. Portraits, emblems and fonts

**Media.** Every picture is a `media` record: its `kind` (`portrait`, `emblem`, `badge`, `image`, `source`, `data`), its `file` (relative to `meta.assetRoot`, which is relative to the document; both charts use `"../.."`, the repository), whose picture it is (`of`), and its `credit` (title, source page, file URL, author, licence, changes, note). `private` gives the reason a picture may not be published; a public build leaves it out without moving anything. **A picture whose file is absent** is treated the same way, in every build: a portrait keeps its frame and gets the silhouette, and an emblem or badge leaves its space empty. So the layout never depends on which files are present, and a copy without the private pictures (the public repository) draws every chart where its lock says. `tools/build_site.py` writes the demo site's credits page from these records.

**Portraits.** Sources are in `assets/portraits_src/` and the square crops in `assets/portraits/`, made by `crop_portraits.py`. The main set's crops are in its `CROPS` table as (face x, face y, side): the face centre as fractions of the image and the square's side as a fraction of the width. Another chart keeps its own set: Tokugawa's sources are in `assets/portraits_src/tokugawa/` with their crops in `crops.json`, cut by `python crop_portraits.py --set tokugawa` into `assets/portraits/tokugawa/`. A portrait imported in the editor adds its crop to the set's `crops.json` (for the main set, `assets/portraits_src/crops.json`, which wins over `CROPS`). `npm run portraits` (`tools/portrait_sizes.py`) makes the small WebP copies the viewer uses. People with no portrait get the silhouette.

**Emblems.** In `assets/emblems/`, credited in `media` like portraits. `clean_emblem.py` makes a white background transparent: it upscales 2×, removes near-white pixels (including white enclosed in the design), and un-mixes the white from anti-aliased edges.

**Fonts.** `theme.fonts` names them; `fonts.ts` maps the names to files. The open fonts are in `assets/fonts/open/` (SIL Open Font License):

- `gantari`: Gantari regular and bold, for everything (static cuts of the variable font at 400 and 700).
- `felipa`: Felipa, the script font for house names, drawn 1.21× larger than the size the type scale was set for.
- `secondScript`: the title's second script. `noto` is Noto Sans Javanese (aksara Jawa); `noto-jp` is Noto Sans JP, cut by `tools/subset_font.py` to the characters the charts use (273 KB instead of 9.6 MB). After adding Japanese text, run `python tools/subset_font.py --check assets/fonts/open/NotoSansJP-Regular-subset.ttf --tag ja-Jpan`, and re-cut the font from the full download if it lists missing characters. The older name `javanese` still works.



**Brand.** The licence badge and logo are in `assets/brand/`, named in `panels.badges`.

## 15. The lock and frozen mode

`charts/<id>/layout.lock.json` is the kept layout: the accepted position of everything the engine places. Its schema is `packages/schema/src/lock.ts` (`lock.schema.json`); [FORMAT.md](FORMAT.md) lists its fields. It holds the chart id, the canvas size, the errors and warnings when it was written, and these sections (`LOCK_SECTIONS`):

| Section | By | Value |
|---|---|---|
| `boxes` | person | the box |
| `drops` | child (`child@descent` for a child with more than one line) | x of the line into the child, y of the level it leaves |
| `lines` | descent id (a line's first) or union id | the levels of its horizontal runs |
| `notes` | note id | inline notes |
| `letters` | note id | each lettered note's letter |
| `pills`, `headers`, `crowns` | person | positions |
| `brackets` | members joined with `+` | x0, x1, y |
| `axis`, `eraLabels` | era year | the y of the year; the label |

It is written one item per line, sorted by id, so a git diff of the lock reads like the report.

**Comparing and accepting.** `npm run build:chart -- <chart.json> --lock` lays the chart out from scratch and names what moved against the lock (`diffLock()`): sections added and removed, items changed, changed warnings or canvas. Moves under 0.5 px (`TOL`) don't count, and four or more items moved by the same amount are one line, so a re-flowed branch reads as one move. `--update-lock` writes the new lock whole (a temporary file, renamed), and is refused while the check finds errors.

**Frozen mode: the lock wins.** `--frozen` lays the chart out from its lock (`compose(doc, env, header, lock)`, which calls `freeze()`):

- every box the lock holds stays exactly where it is, and so do the notes, crowns, pills and headers that hang from it;
- the era years keep their y;
- each line takes its locked level when that level is still in range and clear of boxes, era lines and obstacles; otherwise it routes as usual;
- a person the lock lacks keeps their automatic place relative to their nearest locked ancestor (a spouse moves with their partner). If that lands on a box, they slide sideways in their row to the nearest clear place. The build names them;
- a person removed leaves a gap;
- adjustments don't move anyone the lock holds.

Unchanged content gives back the lock exactly, and the same page. A plain build ignores the lock, so to draw what the editor shows, build with `--frozen`.

**How the lock is kept.**

- **The editor** lays out from the lock whenever a chart has one. Moving a card shifts that card's lock records (`shiftLock()` in `packages/ops`), so nothing else moves. A chart without a lock gets one with "Keep this layout". Re-layout is on request: the whole chart, a branch, a house or a row, shown with where the cards were and accepted as one undo step. Save writes the lock only when it changed. See [EDITOR.md](EDITOR.md).
- **The `crownline` tools** lay out from the lock too. After a batch that passes the check, the lock is updated as checked, so new people stay where they were placed and removed people leave it. A batch saved with new errors only drops the removed, so a known collision is not pinned. The lock change is part of the batch, so `undo` restores it. See [AI.md](AI.md).
- **`npm run check`** checks the lock against its schema and the document, and warns about people with no locked position.

## 16. Operations

Every change to a document is a **named operation** in `packages/ops`. An operation reads the document and returns an `Op`: a `label` for the undo menu, a `patch`, `notes` saying what else changed, and the `id` an add made. It changes nothing itself.

- **Patches** (`patch.ts`): a list of `set` and `del` steps. Applying a patch gives back its exact inverse, so undo is never written by hand. Key order is kept, so a saved file is not reordered.
- **Operations** (`ops.ts`, `adjust.ts`): `addPerson`, `addChild`, `addSpouse`, `addParent`, `addDescent`, `addUnion`, `deletePerson`, `deleteUnion`, `deleteDescent`, `addNote`, `deleteNote`, `setField`, `setText`, `setAdjustment`, `clearAdjustment`, `removeAdjustment`, `nudge`, `together` (several as one), and helpers such as `below()` (who is drawn under a person) and `shiftLock()`. They keep the document valid where they can: deleting a person removes their lines, marriages, notes, pills, brackets, tour steps and adjustments, and says so. `newId()` makes ids in the documents' style.
- **History** (`history.ts`): applies each operation and keeps the inverse. One gesture is one step (a drag), and consecutive edits of one field merge.

The editor's buttons and undo, the `crownline` command line and the MCP tools all change charts through these. The tools name them in their own registry (`packages/cli/src/registry.ts`: `add_child`, `add_spouse`, `marry`, `move_person`, `adjust` and so on); `npm run crownline -- ops` lists them with examples.

## 17. The surfaces: app, viewer, command line

- **The app** (`packages/app`, `npm run dev`, http://127.0.0.1:5180): one address with three screens. The library lists the charts in `charts/`, makes a new chart, or opens a folder on this computer. `?chart=<id>` shows a chart in the viewer; `?chart=<id>&edit` opens it in the editor at the same place. The app's local server (`vite.config.ts`) reads and saves `chart.json` and `layout.lock.json`, refusing a save made against a file that changed on disk since it was read, and builds PNG, PDF or the static site through the engine's command line. See [EDITOR.md](EDITOR.md).
- **The demo site** (`npm run build:site`, `tools/build_site.py`, in `release/site/`): the same app as static files that any host can serve, at any path. It is built with `vite build --mode site`, so the app starts with `SiteStore` (`packages/editor/src/store.ts`) instead of the local server. That store reads the charts from `repo/` beside the page, and `repo/files.json` lists them. The charts are copied with their locks, and the assets with them are the ones the public repository holds (`tools/public-files.txt`): the open fonts, the map data and the public pictures. The portraits' sources are left out (only cropping needs them), apart from each set's `crops.json`. A change made on the site is kept in the browser (IndexedDB) and survives a reload. Save also downloads the chart's folder as `<id>.zip`, laid out as a project (`charts/<id>/…`). The library's **Forget my changes** brings the published charts back. Opening or uploading a folder works as in the app. PNG and PDF need the app on your own computer: on the site, Export offers the chart page only. It has a picture-credits page (`credits.html`) made from the media records, linked from the library. The build runs the public repository's leak checks over every file it writes. `npm run test:site` tries the site in Chrome, WebKit and Firefox, served under a sub-path.
- **The public repository** (https://github.com/Almer113/crownline) is built from this one by `npm run public-repo` (`tools/public_repo.py`), from the allowlist in `tools/public-files.txt`, with the same leak checks. A release adds one commit over its published history (`--keep-history --verify -m "…"`, then `git push` in `release/public`); `--verify` builds every chart in the copy and runs every test suite there, as its CI does. Its Pages workflow (`.github/workflows/pages.yml`) builds the demo site and deploys it to https://almer113.github.io/crownline/.
- **The viewer** (`packages/viewer`): `<crownline-viewer src="chart.html" layout="chart.layout.json">` shows the engine's page as it is, with pan, zoom, minimap, search, the person panel, the time slider, glossary and tours. On the web it is part of the demo site (above); `npm run demo` serves its own demo page for working on it.
- **The command line and MCP server** (`packages/cli`): `npm run crownline -- <command>`: `charts`, `describe`, `find`, `read`, `check`, `apply`, `ops`, `render`, `diff`, `history`, `undo`, `build`, `guide` and `mcp`. A batch of operations is all or nothing, validated and laid out before it is saved, and journalled so it can be undone. The MCP server offers the same as ten tools (`crownline_describe`, `crownline_apply` and so on). See [AI.md](AI.md) and [AI_GUIDE.md](AI_GUIDE.md) (written by `npm run guide`).

## 18. Recipes

These are about the document and the engine. The editor ([EDITOR.md](EDITOR.md)) and the `crownline` tools ([AI.md](AI.md)) do the same through operations, with undo and the lock kept for you.

**Add a person**

1. Add a record to `people` with a sensible `show.year` (not for a spouse placed `beside`, who takes the partner's year). Put it after anyone it is drawn `beside`.
2. Add a `descents` record that places them: from a `parent`, or from a `union` for a couple's child. For a spouse, use `show.beside`.
3. Optionally add a portrait: crop it ([§14](#14-portraits-emblems-and-fonts)), add a `media` record `{"kind": "portrait", "file": "assets/portraits/<id>.jpg", "of": "<person id>", "credit": {…}}` (with `"private": "<reason>"` if it may not be published), and set the person's `portrait` to its id.
4. Optionally add a note.
5. Run `npm run check`, then `npm run build:chart -- <chart.json> --frozen --lock`. The new person is placed by their locked relatives and named.

**Add a marriage with children.** Place the spouse with `show.beside`. Add a `unions` record (`partners: [left, right]` as drawn, `kind: "marriage"`, `show.colour`: the incoming spouse's house). Add one descent per child with `union` set (`show.line: "dot"` for a daughter). Make sure the children have no other placing descent.

**Connect someone across houses without moving them.** Add a descent with a `parent` (and `union`, if it hangs from a couple's line), `show.hop: true` and usually `show.line: "dot"`. Add `show.break` if generations are skipped, and a `shareBus` adjustment if the parent already has a line the child should continue.

**Fix a collision without re-flowing.** In rough order of preference:

1. Move a note: `side`, `width`, or a `noteOffset` adjustment.
2. Move a break mark (`breakAt`) or a note letter (`markerTop`).
3. Lift a label (`textLift`), or set a line's `drop`.
4. Share a line (`shareBus`).
5. `nudge` the smallest branch that solves it.

Give the adjustment its reason, then run `--lock` and check that only what you meant moved.

**Accept a layout.** When the moves are the ones you meant, run `npm run build:chart -- <chart.json> --update-lock` (add `--frozen` to keep everything else where the lock had it), and read the lock's diff before committing.

**Update facts and the "as of" date.** Edit the text, notes or caveats, and update both `meta.asOf.edtf` and `meta.asOf.text` (the footer prints the text). Word facts that are still changing with dates.

**Render and check.** Run `npm run build:chart -- <chart.json> --png --pdf`, look at the PNG at full size, section by section, then commit.

## 19. The rules of the style

The rules the charts follow (layout, lines, boxes and colour, text conventions) are in [STYLE.md](STYLE.md).
In short: lines leave the bottom of a parent's box and enter the top of a child's, and defects are fixed without re-flowing the chart.

## 20. The Python reference engine

The original engine, in Python at the repository root (`chartfile.py`, `chartdoc.py`, `textmeasure.py`, `model.py`, `compose.py`, `build.py`, `layout_export.py`, `maps.py`, `render.py`), is kept as the reference the TypeScript engine is tested against. Each TypeScript module names the Python code it follows. Both give the same page to the character, a layout file with the same values and the same check report. Only the TypeScript engine has frozen mode.

- `python build.py` builds and checks; `python render.py` (with `--preview` or `--force`) renders. `CHART_DOC` names the chart, `CHART_PUBLIC=1` makes a public build and `CHART_HEADER=column,800` tries another header card.
- `python tests/layout_snapshot.py` compares a build with the lock (`--all`, `--update`), as `--lock` and `--update-lock` do.
- `npm run fixtures` (`tools/engine_fixtures.py`) runs the Python engine on every chart's public build and on six small per-feature charts in `packages/engine/tests/charts/` (a family, a couple, a shared line, a break mark, houses, labels), and writes the reference data to `packages/engine/tests/fixtures/`: text widths, boxes, tree, rows, columns, canvas, lines, the page and the layout file. `--check` says whether they are up to date.
- `npm run test:port` runs the engine's tests, which compare each step with that data, so a failure points at one step or one feature.

Run `npm run fixtures` after a change to the Python engine or a chart, and commit the result with the change.

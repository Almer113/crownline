---
name: crownline
description: Edit a Crownline royal genealogy chart (charts/<id>/chart.json) - add people, marriages and notes, fix layout collisions without re-flowing, look at regions and compare positions - through the crownline command line or MCP tools. Use for any change to a chart in charts/.
---

# Working on a Crownline chart

Crownline draws large royal genealogy charts in the style of UsefulCharts: cards for people on a time axis, lines from parents to children, marriage lines between couples, house colours, notes, and a header card with the title, key and glossary. A chart is a folder: `charts/<id>/chart.json` (everything a person decides) and, when its layout is kept, `layout.lock.json` (where everything was accepted to be). You change a chart only through the operations below; each batch is checked before it is saved.

## The tools

The same tools exist as MCP tools and as commands (`npm run crownline -- <command> <chart> …`; add `--json` for JSON). On the command line the options are spelled as flags: `dry_run` is `--dry-run`, `expected_hash` is `--expect`, `allow_errors` is `--allow-errors`, and a batch is a JSON file (`apply <chart> batch.json --reason "…"`); `crownline help` lists them all.

| MCP tool | Command | What it does |
|---|---|---|
| `crownline_describe` | `crownline describe` | the chart in brief: title, counts, houses, eras, the check's totals, and its hash |
| `crownline_find` | `crownline find` | people by words of their name, title or id; by house or year |
| `crownline_read` | `crownline read` | one person: facts, parents (with the line ids), marriages (union ids), children, notes, adjustments, issues, and their box |
| `crownline_check` | `crownline check` | the layout check: errors and warnings, each with the people involved, a box, and fixes to try |
| `crownline_apply` | `crownline apply` | change the chart: a batch of operations, all or nothing, validated and laid out before it is saved |
| `crownline_render` | `crownline render` | look: a region as a picture, around people or by box, issues outlined in red |
| `crownline_diff` | `crownline diff` | what moved: since the last batch (from: last) or a git version (from: HEAD) |
| `crownline_history` | `crownline history` | the batches applied |
| `crownline_undo` | `crownline undo` | undo the last batch |
| `crownline_ops` | `crownline ops` | the operations, with examples (and one's full schema) |

A chart is named by its id (`wangsa-mataram`, `tokugawa`), its folder, or its `chart.json`.

## The working loop

1. **Look before changing.** `describe` the chart; `find` the people you need and `read` them. Use the ids these return; never guess an id. A child of a couple hangs from the couple's *union*: `read` the parent to get the union id.
2. **Change with one batch.** `apply` the operations together, with a `reason`. Try it first with `dry_run: true`: you see the new errors and what moved without saving anything. Pass the `hash` from `describe` (or the last `apply`) as `expected_hash`, so a chart changed meanwhile (by the editor, or a person) is not overwritten.
3. **Look at the batch before saving it.** `render` with `ops` (the command line's `--ops batch.json`) draws the batch without saving it, with its issues outlined in red and numbered.
4. **Check.** `apply` reports `new_errors`, `fixed_errors`, `new_warnings` and `new_issues` (each with the people, a box and fixes to try). A batch that adds layout errors is **not saved**; fix the cause in the same batch and apply again. A later operation in a batch can refer to what an earlier one made: the ids are predictable (a note on `hb2` is `n_hb2`, or `n_hb2_2` when he has one already; a marriage is `u_<left>_<right>` as the couple stands on the page, so `ratu_contoh` added on `hb2`'s right makes `u_hb2_ratu_contoh`), or give the id yourself (`add_note` and the `add_*` operations take `id`; an id already in use is refused, and the marriage or line made with a person is named from their id). `apply` lists every id it made, by kind, under `made`.
5. **Look at the result.** `render` around the people you changed (their inline notes come with them; the margin is 300 px, more to judge free space). Read the picture: is the note clear of the cards and lines, does each line read as parent above to child below?
6. **Compare.** `diff` with `from: "last"` (before your last batch) or `from: "HEAD"` (the last commit; a chart not committed yet falls back to `last`): only the people you meant to move should have moved. If others moved, undo and fix it another way.

Report what you changed, the check's totals, and the before and after pictures.

## The rules of the style

**Stability first.** A polished chart must not shuffle when something small changes. When a chart has a kept layout (`describe` says `kept_layout: true`), everything in the lock stays where it is; people you add are placed by their relatives (`placed_by_relatives`), and once the batch passes the check they are kept there too (a batch saved with `allow_errors` and new errors is not kept: fix it, and the fix is). Never lay the whole chart out again, and never remove the lock: that re-flows the chart, and only its owner decides that.

**Fix collisions locally**, in this order, and give every adjustment its reason:

1. Move the note: `move_note` (dx, dy), or change its side (`set notes.<id>.show.side` to r, l, b or t) or its width (`show.width`: 240, 300, 360, 440 or 560). An inline note can also become a lettered marker (`show.inline` false).
2. Move a break mark (`adjust breakAt`) or a note's letter (`adjust markerTop`).
3. Lift a label (`adjust textLift`).
4. Share a line (`adjust shareBus`): one parent's children hang off one horizontal line.
5. Only then move a card: `move_person` the smallest branch that solves it.

**Lines.**

- A line leaves the bottom of a parent's card and enters the top of a child's card.
- At a crossing, solid lines go over dotted and grey ones.
- All of one parent's descendants hang off one horizontal line. A grandchild shown through an omitted child continues the parent's line, with a break mark (`show.break: "grandson"`) and a `shareBus` adjustment.
- When both parents are on the chart, the child's line comes down from the couple's marriage line (`add_child` with `union`), never from one parent alone. A child hangs from one parent only when the other parent is not on the chart.
- Line styles: solid is father to son. Dot is through a daughter or by marriage (a daughter's line is `dot`). Grey is outside the dynasty, legend is claimed by the chronicles, and adopt is an adoption.

**People and cards.**

- A person appears in exactly one place in the tree: one line places them, or they are drawn beside a partner.
- A spouse is drawn beside their partner (`add_spouse`) as a `text` card unless they have a public role. `side` puts them left or right of the partner. An inline note on the same side as a spouse lands on the spouse's card: put the note on the other side, or move it past the spouse (`move_note` by about the spouse's width).
- A spouse on the chart should earn their place: children drawn from the couple, or a reason stated on the chart (a note, or their caption). `read` the partner first: their `unions` say whether this is a first or a further marriage on the chart.
- A marriage line takes the colour of the incoming spouse's birth house. Set `unions.<id>.show.colour` to that house's id; without it the line is grey, for a spouse from outside the courts.
- A card's colour is the person's birth house (`house`). A person with no house is drawn grey, which reads as "outside the courts": give a house when the person was born into one of the chart's houses (`describe` lists them), and never invent one.
- Card kinds: `ruler` (portrait and crown) for those who reigned, `heir` for heirs, `minor` (the ordinary card) for other notable people, `neutral` (grey) for public figures outside the courts, `text` (a name with no card) for a spouse with no public role.
- A note is 240 px wide unless `width` says otherwise. The engine draws notes at 240, 300, 360, 440 or 560 px, and the check warns about any other width.
- `show.year` places a person on the time axis: the year they began to reign or became notable. A child added with `add_child` gets the parent's year plus 30; set the real one.

**Facts.**

- Facts carry their uncertainty: "per chronicles", "disputed", "identity uncertain".
- A reign is written "r. 1755 – 1792" (a spaced en dash). Several reigns use shortened years and no spaces: "r. 1810–11, 1812–14".
- Titles keep their own form (GKR, KGPAA, Shōgun). Each word of a title should be a glossary term; the check warns when one is missing.
- Never invent facts. A note says what the sources say, and when.

## The operations

`apply` takes a list of these (`ops` gives each one's full schema):

- **add_child**: Add a new person as the child of a parent, or of a couple (union): a line from them places the child.
  `{"op":"add_child","parent":"hb2","union":"u_hb2_kencana","name":"Pangeran Contoh","box":"minor","year":1790,"sex":"m"}`
- **add_spouse**: Add a new person married to someone, drawn beside them (side r or l).
  `{"op":"add_spouse","of":"hb2","name":"Ratu Contoh","side":"r","sex":"f"}`
- **add_parent**: Add a new person as the parent of someone who has no line into them yet.
  `{"op":"add_parent","child":"hb2","name":"Ayah Contoh","sex":"m"}`
- **add_person**: Add a person connected to no one (connect them with connect_child or marry in the same batch, or the check fails).
  `{"op":"add_person","name":"Someone","box":"minor","year":1800,"house":"mataram"}`
- **connect_child**: Draw a parent-child line between two people already on the chart: from a parent, or from a couple (union).
  `{"op":"connect_child","child":"someone","union":"u_hb2_kencana"}`
- **marry**: Marry two people already on the chart; partners as drawn, left then right.
  `{"op":"marry","left":"hb2","right":"someone"}`
- **remove**: Remove a person (with their lines, marriages, notes and adjustments), a union, a line (descent), a note or an adjustment, by id.
  `{"op":"remove","id":"someone"}`
- **set_text**: Set a text field in one language (a name, a bio, a title, a caption); empty text removes an optional field.
  `{"op":"set_text","path":"people.hb2.bio","text":"Ruled twice, deposed by the British in 1812."}`
- **set**: Set any field of the document to a JSON value (null removes it): show.year, reigns, born, sources, display, panels… Anything the schema allows; the batch is validated.
  `{"op":"set","path":"people.hb2.show.year","value":1792}`
- **add_note**: Add a note to a person: inline (shown in full beside the card, on side r, l, b or t) or a lettered marker with the text in the Notes list.
  `{"op":"add_note","anchor":"hb2","text":"Ruled three times: 1792–1810, 1811–1812 and 1826–1828.","inline":true,"side":"l","width":240}`
- **move_note**: Move a note by dx, dy px from where it is now (the first local fix for a note that collides).
  `{"op":"move_note","note":"n_hb2","dy":-40,"reason":"clear of Kencana's card"}`
- **move_person**: Move a person's card sideways by dx px: with everyone drawn below them (branch, the default) or alone. With a kept layout (a lock) the lock moves too, so nothing else shifts. The last resort for a collision: prefer note moves and line adjustments.
  `{"op":"move_person","id":"someone","dx":60,"reason":"clear of the note on hb2"}`
- **adjust**: A named layout adjustment, the local fixes: breakAt (where a line's break mark sits, 0..1; target: a line), shareBus (a line hangs off the parent's existing line), drop (px from the parent to the line; target: the first line), textLift (lift a label, px), markerTop (the note letter at the box's top right), headerLeft (the house header left of the pill), coupleSide (-1, 0, 1: which side a couple's children go; target: a union), nudge (dy: a person's row).
  `{"op":"adjust","kind":"breakAt","target":"d_hb1_hb2","at":0.3,"reason":"the mark clear of the era label"}`
- **clear_adjustment**: Remove the adjustment of a kind for a target (back to the automatic layout for it).
  `{"op":"clear_adjustment","kind":"noteOffset","target":"n_hb2"}`

`set` reaches any field the schema allows (reigns, born, died, sources, display, panels, unions.<id>.show.colour, …). The batch is validated as a whole, and a mistake comes back with what is wrong and where.

## A worked example

Add a consort and a note for a ruler, fix the collision the note causes, and show it (a trial run on a copy of Mataram):

1. `describe` gives the hash. `find "hamengkubuwana ii"` gives `hb2`; `read hb2` shows no marriages on the chart, and his box. `render` around `["hb2"]` is the before picture.
2. `apply` with `dry_run: true` and the hash, reason "a consort on his right, and a note":
   `[{"op":"add_spouse","of":"hb2","name":"Ratu Contoh","side":"r","sex":"f","box":"minor"},{"op":"add_note","anchor":"hb2","id":"n_hb2","text":"…","inline":true,"side":"r"}]`.
   Nothing is saved: two new errors, `line u_hb2_ratu_contoh runs through note:hb2` and `note:hb2 overlaps box ratu_contoh`, each with a box and fixes to try. Nobody moved.
3. `render` with the batch as `ops` shows the note printed over her card and the marriage line.
4. The note should stay on his right, so the first fix is `move_note` past her card, in the same batch: add `{"op":"move_note","note":"n_hb2","dx":170,"reason":"clear of her card, still on his right"}` (the error's box says how far). A dry run gives no new errors, and `moved` is empty.
5. `apply` without `dry_run`. `render` around `["hb2","ratu_contoh"]` for the after picture, and `diff` with `from: "last"`: no card moved; `ratu_contoh` and `n_hb2` were added. Report the before, the clash and the after.

If moving the note is not enough, change its side or width, then try the line adjustments, and only last `move_person`.

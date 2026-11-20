# The Crownline editor

This guide is for people who edit a chart by hand, in the browser. It names every control as the editor shows it. For how a chart is stored, see [FORMAT.md](FORMAT.md); for the rules of the style, [STYLE.md](STYLE.md); for what happens behind the screen, [HOW_IT_WORKS.md](HOW_IT_WORKS.md); for editing through a model, [AI.md](AI.md). To install and start the app, see [GETTING_STARTED.md](GETTING_STARTED.md).

## Contents

- [Open a chart](#open-a-chart)
- [The screen](#the-screen)
- [Edit a person](#edit-a-person)
- [Add and connect people](#add-and-connect-people)
- [Delete](#delete)
- [Notes](#notes)
- [The kept layout](#the-kept-layout)
- [Move a card](#move-a-card)
- [Fix a problem](#fix-a-problem)
- [The Chart tab](#the-chart-tab)
- [The Style tab](#the-style-tab)
- [Portraits and emblems](#portraits-and-emblems)
- [Undo, redo and save](#undo-redo-and-save)
- [Changes made outside the editor](#changes-made-outside-the-editor)
- [Export](#export)
- [Keyboard and mouse](#keyboard-and-mouse)

## Open a chart

Start the app with `npm run dev` and open http://127.0.0.1:5180. The first screen is the library: one card for each chart in `charts/`.

### A chart in this repository

1. Click a chart's card to read it. This is the view, the same viewer a reader gets.
2. Click **Edit** at the top right. The editor opens at the same place, with the same person selected.

The small **Edit** link on a card in the library opens the editor directly.

In the editor, **Done** goes back to the view at the place you were looking at, and **Crownline** goes back to the library. If you have unsaved changes, the app asks first ("Unsaved changes"): **Save them**, **Discard them** or **Cancel** (stay in the editor). Closing the browser tab with unsaved changes also asks.

### A new chart

1. In the library, click **New chart…**.
2. Fill in the **Title**. The **Id (the folder's name)** follows the title; you can change it. It must be lowercase words joined by `-`, starting with a letter.
3. Give **The first house**, **Its colour**, **Its first ruler**, and a year for them under **Where on the time axis (a year in their reign)**.
4. Click **Make the chart**.

The chart is written at once (`charts/<id>/chart.json`) and opens in the editor. Add everyone else from there.

### A chart folder on this computer

A project folder is one that holds `charts/` (each chart in its own folder) and `assets/`. The library offers two ways in:

- **Open a folder…** (Chrome and Edge only). The browser asks for permission to edit the folder. **Save** writes back into the folder, in place.
- **Upload a folder…** (any browser; in Chrome and Edge it is called **Upload a folder instead…**). The browser reads a copy. **Save** cannot write to your folder, so it downloads the changed files instead: put them back in the chart's folder yourself. If a save removes a file (for example the kept layout, after you undo **Keep this layout**), the status line tells you which file to delete.

The library then lists the folder's charts. **Back to this repository's charts** returns to the repository. A folder is open only in this page: reloading the page takes you back to the library.

What Save does is also shown in the status line after each save: "Saved to the repository", "Saved to the folder …", "Downloaded (an uploaded folder cannot be written to)", or on the demo site "Kept in this browser, and downloaded as <id>.zip".

### On the demo site

The demo site is this same app with no server behind it. Its charts can be edited, and a change is kept in your browser: it is still there after a reload, on this computer and in this browser only. **Save** also downloads the chart's folder as `<id>.zip`, laid out as a project (`charts/<id>/chart.json` and its kept layout, with any pictures you imported). Unzip it into a project folder to open it in Crownline on your own computer, or open it on the site with **Open a folder…**. The library lists the files you have changed under **Your changes**. **Forget my changes…** brings back the charts as the site published them. Export makes only the chart page there: PNG and PDF need the app on your own computer ([GETTING_STARTED.md](GETTING_STARTED.md)).

## The screen

The editor has four parts.

- **The top bar:** **Crownline**, **Done**, the chart's file, **Undo**, **Redo**, **Save**, **Export…**, the **Keep the layout** checkbox, **Re-layout…** (or **Keep this layout**, for a chart without a kept layout), and the status line.
- **The left side:** six tabs. **People**, **Problems**, **Moves**, **Adjusted**, **Chart** and **Style**. **Problems** and **Moves** show a count when there is something to look at.
- **The chart in the middle:** the chart as it will be printed, redrawn after every change. The line under it is a reminder: "Drag the selected card to move it · drag a note to move it · Alt-drag between cards to connect".
- **The inspector on the right:** the selected person.

### Select a person

Click a card on the chart, or use the **People** tab:

1. Type in **Find a person** (a name, a title or an id; accents do not matter).
2. Narrow it with the house menu (**All houses**, **No house**, or one house) if you like.
3. Click a name. The person is selected and the chart flies to them.

The list is in time order. It shows at most 400 people: narrow the search to see the rest.

In the inspector, **Show on chart** flies back to the selected person.

### The status line

The status line at the end of the top bar says two things.

- Whether there is anything to save: "No changes", "Unsaved changes", or what the last save did. A save that failed says "Not saved:" and why.
- The drawing: "Drawing…" while the chart is redrawn, then "Drawn in N ms". If the chart cannot be drawn, it says "Not redrawn: the document has errors". The last good drawing stays on screen; the **Problems** tab says what is wrong.

## Edit a person

Select the person. The inspector shows their fields. Each change redraws the chart; typing in one field is one undo step, not one per letter.

- **Name** and **Title** (the title is printed above the name; each word of it should be in the glossary).
- **House**.
- **Card**: **Ruler (portrait, crown)**, **Heir (portrait)**, **Royal, did not reign**, **Public figure**, **Spouse (name only)** or **Legendary ancestor**.
- **Year**: when they began to reign or became notable. It decides their row on the time axis. A person drawn beside a partner has no year of their own: the partner's row decides.
- **Line under the name**: dates or reign as printed, for example `r. 1755 – 1792` for Hamengkubuwana I.
- **Sex**.
- **Drawn beside**: for someone married to a person on the chart, **Left of …** or **Right of …** that partner, or **(their own place in the tree)**.
- **Rival or unrecognised claimant (hatched)**.
- **Biography**: shown in the viewer's panel, not on the card.

Below the fields are the portrait (see [Portraits and emblems](#portraits-and-emblems)) and the person's relations: **Parents**, **Spouses** and **Children**. Click a name to go to that person. Each marriage under **Spouses** has a menu for its line's colour: the incoming spouse's birth house (**Brackwater line**), or **Grey line** for a spouse from outside the courts.

### Change a line's style

Each line under **Parents** and **Children** has a menu: **Solid**, **Dotted**, **Grey**, **Legend** or **Adoption (long dashes)**. The style's meanings are in [STYLE.md](STYLE.md): solid is father to son, dotted is through a daughter or by marriage.

## Add and connect people

### Add a child

1. Select the parent, for example Hamengkubuwana II (`hb2`).
2. Click **Add child**.
3. Type the **Name** as it should be printed.
4. If the parent is married on the chart, choose **Their other parent**. Choose the mother when she is on the chart: the line then comes down from the couple's marriage line. Choose **None shown** only when the other parent is not on the chart.
5. Click **Add**.

The new person is selected, so you can fill in their year, house and card next.

### Add a spouse

1. Select the person and click **Add spouse**.
2. Type the name and choose **Drawn**: **Right of …** or **Left of …**.
3. Click **Add**.

The spouse is drawn beside their partner. To change the side later, use **Drawn beside**.

### Add a parent

**Add parent** appears only for someone with no line into them. It adds one parent above them.

### Add a person with no relations yet

With no one selected (press Esc on the chart), the inspector offers **Add a person**. Choose a name and a **Card**. A person with no line into them cannot be placed on the tree until you connect them, and the **Problems** tab will say so.

### Connect two people who are already on the chart

Either:

- hold **Alt** and drag from one card to the other (a line follows the pointer), or
- select one person, click **Connect to…**, then click the other person. Esc or **Cancel** stops.

The editor asks "How are they related?" and offers only the relations that fit: a child of one of them, a child of a couple one of them is in, or a marriage (drawn on the right or on the left). Two people who are already married cannot be connected again.

### Remove a marriage or a line

Each spouse, parent and child in the inspector has a **×** button. It removes that marriage or that line, not the person.

## Delete

Select the person and click **Delete** (or press the Delete key when you are not typing in a field). The editor says what else goes with them: their notes, marriages and lines, and anyone left with no parents (who must then be connected again before the chart can be drawn). Click **Delete** to confirm. Undo brings everything back.

## Notes

A note is a short text beside a card. An inline note is printed in full beside the card, on its right, left, bottom or top, with a width. A lettered note puts a small letter on the card and its text in the chart's Notes list.

Select the person; their notes are in the **Notes** section of the inspector.

- **Add a note:** click **Add a note**, type the text and click **Add**. A new note is printed in full on the right of the card, 240 px wide.
- **Change it:** edit the text in place. **Shown** chooses **In full beside the card** or **As a letter (text in the Notes list)**; the side is **Right**, **Left**, **Below** or **Above**; the width is 240, 300, 360, 440 or 560 px (the engine draws notes at these widths only).
- **Delete it:** **×** beside the note. Any move recorded for it goes with it.

A person has at most one lettered note. Where a note sits is often the first thing to change when it runs into something: try another side before dragging it.

On the chart:

- **Move a note:** drag it to where it should be. The editor asks "Move this note" with a **Reason**; click **Move**. The move is an adjustment, listed in the **Adjusted** tab. Dragging it again adds to the same adjustment.
- **Move the note letter:** for someone with lettered notes, the inspector has **Note letter at the top right of the card** (under **Parents**). Off, the letter sits at the bottom.

## The kept layout

A polished chart has a kept layout: `layout.lock.json`, beside `chart.json`, records where every card, line and header was accepted to be. With it, a small edit moves only what it must. Without it, every change lays the chart out again from scratch, and a small change can shuffle cards far away.

### Keep the layout

The **Keep the layout** checkbox is on when a chart has a kept layout. An edit then moves only what it must: a longer name makes the card grow in place, a new person is placed by their relatives and slid clear of other cards.

Turn it off to see the automatic layout, the chart as it would be laid out from nothing. This does not change any file; turn it back on to return to the kept layout. The checkbox cannot be used on a chart without a kept layout.

Export follows the checkbox: with it off, the export is the automatic layout.

### Keep this layout

A chart without a kept layout (a new chart, for example) shows **Keep this layout** in the top bar. Click it when the chart looks right: the layout on screen becomes the kept layout, and **Keep the layout** turns on. **Save** writes `layout.lock.json`. It can be undone like any edit.

### The Moves tab

**Moves** lists every card that has moved since the chart was opened or last saved, and by how much ("12 px right, 4 px down"), biggest first. New and deleted people are listed too. Click a name to fly to the card. **Outline where they were** draws red outlines at the old places.

Under the kept layout only what you changed should move. If the list surprises you, undo and fix it another way.

### Re-layout…

**Re-layout…** lays part of the chart out again, automatically. It is shown only for a chart with a kept layout.

1. Select a person if you want to re-lay out part of the chart around them.
2. Click **Re-layout…** and choose what: **The whole chart**, **… and everyone below** (their branch), **Everyone in the house of …**, or **…'s row (everyone level with them)**.
3. The proposal is drawn, with red outlines where cards were. The bar above the chart says how many cards move and which moves most (click it to fly there), and whether the proposal has drawing errors.
4. Click **Accept** to take it, or **Cancel** to leave the chart as it was.

A part is placed so that its first person stays where they are; the rest of the chart keeps its place. Accepting is one undo step. Any edit while the proposal is shown cancels it.

Re-lay out a polished chart rarely, and never the whole of it without a reason. Every card that moves is work someone accepted, and the fixes made by hand may need doing again. Prefer the local fixes in [Fix a problem](#fix-a-problem), and re-lay out the smallest part that solves it.

## Move a card

1. Select the card.
2. Drag it sideways. It snaps to the line of its parent and of its siblings; a guide shows where.
3. When you let go, the editor asks:
   - what moves, if the person has people below them: **… and everyone below (N more)**, or **Only …** (the card alone, and anyone drawn beside them);
   - under the kept layout, **Keep this move after a re-layout (records an adjustment)**;
   - a **Reason**.
4. Click **Move**.

Under the kept layout the move changes the kept layout. If you also tick the keep box, it is recorded as an adjustment, so a later **Re-layout…** keeps it. Without the kept layout, a move is always an adjustment. Moving a card alone leaves their children where they were.

A spouse drawn beside a partner cannot be dragged: move the partner. Wait for "Drawing…" to finish before dragging; during a redraw the drag pans the chart instead.

Moving cards is the last resort for a collision (see below).

## Fix a problem

### The Problems tab

**Problems** lists what is wrong, in two groups:

- **In the document:** errors in the chart itself, such as a missing house or a person with no line into them. While there are errors the chart is not redrawn.
- **In the drawing:** cards that overlap, lines that run through cards, and the like.

Click a problem to fly to the person or the place. The tab's count shows the errors, or the warnings if there are no errors.

### Fix collisions in this order

When a note, label or line runs into something, fix it as close to the trouble as you can, in this order. Give every adjustment a reason in the **Adjusted** tab.

1. **Move the note.** Change its side or width in the inspector, or make an inline note a lettered one (see [Notes](#notes)). If that is not enough, drag it clear.
2. **Move a break mark or a note letter.** For a line with omitted generations, select the child, open **Line controls** under **Parents**, and move **Break mark along the line**. For the note letter, tick **Note letter at the top right of the card**.
3. **Lift a label.** The editor has no control for this yet: use the tools' `adjust textLift` (see [AI.md](AI.md)). The lift then appears in **Adjusted**.
4. **Share a line.** Select the child, open **Line controls**, and tick **Hangs off the parent's existing line**: one parent's children then hang off one horizontal line. **Level below the parent (px)** sets how far below the parent that line runs (empty is automatic).
5. **Only then move a card**, and move the smallest branch that solves it (see [Move a card](#move-a-card)).

**Line controls** appear only on a line from one parent, as the check allows. They never bend a line by hand: the router still chooses the path.

### The Adjusted tab

**Adjusted** lists every adjustment the chart makes to the automatic layout: moves, notes moved, break marks, note letters, labels lifted, shared lines, line levels, and the rest. Each row shows what kind it is, who it is about, its amounts, and its **Reason**.

- Type in **Find an adjustment** to filter the list.
- Click the name to fly to the person it is about.
- Type a reason where it is missing ("Why?"). A reason should say what the adjustment avoids, for example "clears Hamengkubuwana II's note".
- **×** removes the adjustment.

## The Chart tab

**Chart** edits everything that is not a person. Each part opens and closes.

- **Title:** the **Title**, **Subtitle**, **As of** (the date the chart describes, such as `2025` or `2025-06`) and how it is **Written as**, and the **Introduction** (on the header card and in the viewer's opening panel).
- **Header card:** its **Arrangement** (**Top left, the tree beside it**, **Down the left side, with the notes and sources**, or **Across the top**), its **x**, **y**, **Width** and **Height**, and the **Glossary heading**.
- **Houses:** each house's colour, **Name** and id. **Add a house** asks for a name and a colour; the id comes from the name. **×** removes a house no one uses (while people, reigns or lines name it, the button says how often). Give a person a house in their own panel.
- **Eras and episodes:** eras start at a year and are drawn as lines across the chart; episodes span years and are drawn as bands. Change the years and names, **Add an era**, **Add an episode**, **×** to remove one, and **⤢** to see it on the time axis.
- **Key:** the **House of the examples** and **A second house (the contrast)**.
- **Glossary:** the terms by group (**Term**, **In full**, **Meaning**). The group's heading is a field: renaming it renames the group for each of its terms. **Add a term to …** and **Add a group**. Each title on a card should be a term here: the **Problems** tab lists the missing ones.
- **Caveats and printed sources:** the caveats, and the sources as printed on the chart (some have a wording **In a public build** and one **In a private build**).
- **Bibliography:** the works that records cite: kind, title, author, year, link and the date it was read, with how often each is cited. A work that is still cited cannot be removed.
- **Map panel** (only on a chart with a map): its title, **Map width**, **Columns** and **Panel height**. The engine places the panel.

## The Style tab

**Style** sets the look. Each change redraws the chart.

- **Houses:** each house's colour.
- **Palette:** the background, era bands, text, notes, muted and faint text, public figures' cards, grey lines.
- **Fonts:** the **Text font**, the **Script font (house headers)** and the **Second script (the title's)**. Fonts marked "not for public builds" may not be published.
- **Type sizes (px):** titles, names, reigns, notes, captions and small print.

Larger type makes cards bigger. Under the kept layout they grow in place and may then collide: use **Re-layout…** on the part that needs room.

If a font cannot draw the chart's text (a missing letter, for example), the chart is not redrawn and **Problems** says why.

## Portraits and emblems

Only ruler and heir cards show a portrait.

### Import a portrait

1. Select the person. Under **Portrait**, click **Import…** (or **Replace…**).
2. Choose a JPEG, PNG or WebP file.
3. In the crop dialog, drag the square over the face and size it with **Size** or the mouse wheel. The dot is where the middle of the face goes. Tick **Stretch the tones (a faded photograph)** for a pale photograph.
4. Fill in the credit. **Title** is required; give the **Source page**, **File URL**, **Author**, **Licence**, **Changes** and a **Note** where you know them.
5. Click **Use this portrait**.

The picture files are written at once, not on Save: the source to `assets/portraits_src/…`, the 400 × 400 crop to `assets/portraits/…`, and the crop's numbers to that set's `crops.json`. If the files already exist, the editor asks before replacing them. Undo takes the portrait off the chart but does not bring an old picture back. (In an uploaded folder, each file is downloaded as it is made.)

**Remove** takes the portrait off the person; the files stay.

### Import a house emblem

For the person who heads a house header, the inspector also shows **House header emblem**.

1. Click **Import…** and choose the picture.
2. Compare **As imported** with **White made transparent**, and keep **Make the white background transparent** ticked if the emblem was on white.
3. Fill in the **Title**, **Source page**, **Author** and **Licence**.
4. Click **Use this emblem**.

The emblem is written to `assets/emblems/`. A new emblem never overwrites another house's file.

## Undo, redo and save

**Undo** and **Redo** step back and forward through every change: an edit, a move, a re-layout, a change brought in from disk. Hover over them to see what they will undo or redo. One gesture is one step.

**Save** writes `chart.json` exactly as the repository keeps it (only what you changed differs), and `layout.lock.json` when the kept layout changed. **Save** is greyed out when there is nothing to save.

## Changes made outside the editor

A chart can change while it is open: a model working through the crownline tools, or someone editing `chart.json` by hand. In this repository the editor notices at once.

- **With no unsaved changes,** the change comes in as one step, "Changed outside the editor". The status line says "Changed outside the editor: Undo takes it back".
- **With unsaved changes,** the editor asks "The chart changed on disk":
  - **Take the version on disk:** the change comes in. Your changes are not lost: they stay in the history, and Undo brings them back.
  - **Keep mine (Save writes over it):** your version stays. The status line says "Kept yours: the file on disk differs until you save". Your next **Save** replaces the file on disk.
  - **Cancel:** decide later. The status line says "The chart changed on disk: Save asks which version to keep".

### When Save is refused

Save never writes over a file that changed on disk without asking. If the file changed since the editor last read it, **Save** asks the same question first.

- If you take the version on disk, nothing is written, and the status line says "Not saved: the chart had changed on disk: that version is now open (Undo brings yours back), and nothing was written". Look at the change, then Undo if you want yours back, and save again.
- If you cancel, the status line says "Not saved: the chart changed on disk: choose which version to keep". Save again to answer.

The same check works for a folder opened in Chrome or Edge when you save, but only the repository's charts are noticed while they are open. An uploaded folder is a copy, so nothing outside changes it.

## Export

**Export…** builds the chart as saved. If there are unsaved changes, it offers **Save and export** first.

Choose what to make:

- **PNG:** the chart as a picture, at twice its size.
- **PDF:** one page, for printing.
- **The chart page:** `<id>.html` and its layout file, the chart drawn for the browser.

Tick **A public build: leave out the media marked private (the open fonts only)** for anything you will publish.

The files are made at the repository's root; the result lists them to download. If the build fails, **The build's report** says why. (To put the charts on the web with the viewer and the editor, build the demo site: `npm run build:site`, see [HOW_IT_WORKS.md](HOW_IT_WORKS.md#17-the-surfaces-app-viewer-command-line).)

PNG and PDF need the local server, so for a folder opened in the browser, and on the demo site, only **The chart page** is offered. It is written into the folder beside `charts/` (or downloaded, for an uploaded folder): put it there so it finds its pictures.

## Keyboard and mouse

In the editor:

| Key or gesture | Does |
| --- | --- |
| Ctrl+Z | Undo |
| Ctrl+Shift+Z, Ctrl+Y | Redo |
| Ctrl+S | Save |
| Delete | Delete the selected person (asks first; not while typing in a field) |
| Esc | Stop **Connect to…**; otherwise clear the selection |
| Alt-drag from card to card | Connect two people |
| Drag the selected card | Move it sideways |
| Drag a note | Move the note |

On a Mac, use Cmd for Ctrl.

On the chart, as in the viewer:

| Key or gesture | Does |
| --- | --- |
| Drag (not on the selected card or a note) | Pan |
| Scroll or pinch | Zoom |
| Shift-drag | Zoom to the box you draw |
| Click a card | Select the person |
| Double-click | Fly to a card; on empty space, zoom in |
| Arrow keys (Shift for bigger steps) | Pan |
| + and - | Zoom in and out |
| 0 or Home | Fit the whole chart |
| Enter | Fly to the selected person |
| M | Show or hide the map |
| / or Ctrl+F | Search the chart |

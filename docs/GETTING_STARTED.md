# Getting started

This page installs Crownline, opens the app, and makes a small chart from nothing: a made-up royal house of nine people over two generations, with a marriage into a second house, a note and two eras. The finished chart is in the repository as [`charts/tutorial/`](../charts/tutorial/chart.json), so you can compare yours with it at any step.

It takes about twenty minutes. Nothing here needs you to write JSON.

## 1. Install

You need:

- **Node 22** or later, with npm.
- **Google Chrome or Microsoft Edge**, for exporting a PNG or PDF (the export prints the chart in it). Another Chromium browser works if you name it in `CHART_BROWSER`.
- Python 3 only if you work on the reference engine or the scripts in `tools/`. You don't need it for this page.

In the repository's folder, run once:

```bash
npm install
```

## 2. Open the app

```bash
npm run dev
```

Open http://127.0.0.1:5180. (If another program already uses that port, start it with `npm run dev -w @crownline/app -- --port 5181` and open that port instead.) This is the **library**: a card for each chart in `charts/`. Click a card to read the chart. Its **Edit** link opens the chart in the editor.

The app only listens on your own computer. It saves into the repository's `charts/` folder.

## 3. Make the chart

Click **New chart…** and fill in:

| Field | Type |
|---|---|
| Title | The House of Aldermere (or a name of your own: the finished example already has this one, and the library tells two charts with the same title apart only by their folders) |
| Id (the folder's name) | made from the title until you change it; any free name |
| The first house | Aldermere |
| Its colour | keep the gold |
| Its first ruler | Edric the Founder |
| Where on the time axis | 1600 |

Click **Make the chart**. The editor opens on the new `charts/<id>/chart.json`, with Edric on the chart beside the title card.

The editor has three columns:

- **on the left**, the tabs: **People**, **Problems**, **Moves**, **Adjusted**, **Chart** and **Style**;
- **in the middle**, the chart, drawn again after every change;
- **on the right**, the inspector for the selected person.

The top bar has **Done** (back to reading the chart), **Undo**, **Redo**, **Save**, **Export…**, and the controls for the kept layout ([§12](#12-keep-the-layout)). [EDITOR.md](EDITOR.md) describes every control.

## 4. The first ruler

Click **Edric the Founder** in the **People** list (or on the chart). In the inspector:

- **Title:** `King`
- **Line under the name:** `r. 1600 – 1632`
- **Sex:** Male

The card is a **Ruler** card: portrait frame, house colour and title. With no portrait it shows a silhouette.

## 5. A family

Each **Add …** button opens a small dialog; type the name and click **Add**. The new person is selected, so fill in their fields straight away.

1. With Edric selected, click **Add spouse**: `Queen Maud`, **Drawn** right of Edric. A spouse gets a **Spouse (name only)** card beside the partner, joined by the marriage line. Set **Sex** to Female.
2. Select Edric again and click **Add child**: `Edmund II`. For **Their other parent** keep Queen Maud, so the line comes down from the couple. Set **Title** `King`, **Card** Ruler, **Year** `1632`, **Line under the name** `r. 1632 – 1660`, **Sex** Male.
3. From Edric again, **Add child**: `Princess Alys`, from the couple. Set **Card** to **Royal, did not reign**, **Line under the name** `1606 – 1671`, **Sex** Female.
4. From Edric, **Add parent**: `Aldric the Elder`. Set **Card** to **Legendary ancestor**: a dashed outline, for a founder known only from the chronicles.
5. Select Edmund II, **Add spouse**: `Lady Ceinwen`, on the right. **Sex** Female.
6. From Edmund II, **Add child**: `Prince Edwin`, from Edmund and Ceinwen. Set **Card** to **Heir**, **Year** `1655`, **Line under the name** `1640 – 1659`, **Sex** Male: an heir who died before he could reign.

The **People** list is sorted by year, so names move in it as you add people.

Click **Save**. The status line on the right of the top bar says **Saved to the repository**.

The **Year** is the row a person is drawn on: when they began to reign or became notable. A child added with **Add child** starts 30 years after the parent. A spouse drawn beside a partner has no year of their own.

## 6. A second house

Princess Alys marries into another house. First make the house:

1. Open the **Chart** tab, then **Houses**.
2. Click **Add a house**: name `Brackwater`, a blue colour. Click **Add**.

Then the marriage:

1. In **People**, select Princess Alys and click **Add spouse**: `Lord Osric`, on the right.
2. Set his **House** to Brackwater and his **Card** to **Public figure** (a grey card for someone outside the courts). Set **Line under the name** to `Lord of Brackwater`.
   Select Princess Alys again. Under **Spouses**, set Lord Osric's marriage menu to **Brackwater line**: a marriage line takes the incoming spouse's birth-house colour. Queen Maud's and Lady Ceinwen's stay grey, as wives from outside the chart's houses.
3. Select Princess Alys, **Add child**: `Rowena`, from Alys and Osric. Set her **House** to Brackwater, **Card** to **Royal, did not reign**, and **Year** to `1640`.
4. Rowena descends through her mother. Under **Parents** in Rowena's inspector, set the line's menu to **Dotted**: the style's mark for a line through a daughter or by marriage. The line takes Brackwater's colour from her.

## 7. Eras

The time axis runs down both sides of the chart. Eras mark its sections.

1. In the **Chart** tab, open **Eras and episodes** and click **Add an era** twice. Each comes in as "New era", at the chart's first year or ten years after the last era.
2. Type over them: set the first to `1600`, `The founding`, and the second to `1650`, `The long peace`.

Each era's name is printed across the chart at its year. Click **⤢** beside an era to see it on the axis.

## 8. A note

1. Select Edmund II. Under **Notes**, click **Add a note** and type: `Edmund kept the peace with Brackwater for twenty years, sealed by his sister's marriage.` Click **Add**.
2. The note is printed in full on the right of his card, 240 px wide.

Click **Save**.

## 9. Fix the problems

The **Problems** tab now shows a count. Open it. The count is of the errors (in red) while there are any, and of the warnings once the errors are fixed, so the list can be longer than the count. It is in two parts: problems in the document and problems in the drawing. You should see something like this:

- **title word "King" is not in the glossary**, once for each king. Every word of a title should be explained in the glossary on the header card.
- **line … runs through note:edmund_ii** and **note:edmund_ii overlaps box lady_ceinwen.** The note sits where Lady Ceinwen's card and the marriage line are.
- **the column card's content … is taller than the card**: the header card needs more height.
- Perhaps **header overlaps era label 1650**: it goes away when the note moves.

Click a problem to see where it is. Then fix them in this order. It is the order the style asks for: move what is closest to the trouble first, and move cards last.

1. **The note.** Select Edmund II and set the note's side to **Left**. The note now has space to itself. (Dragging it would also work. A drag is recorded as an adjustment, with a reason.)
2. **The glossary.** In **Chart → Glossary**, click **Add a group**. Rename the group heading to `Titles`. Set the term to `King` and the meaning to `the ruler of Aldermere`. (**In full** is for a term that is an abbreviation; leave it empty.)
3. **The header card.** In **Chart → Header card**, set **Height** to `1400`. The problem names the height the content needs. Adding the glossary made the content taller, so check the tab again after the change.

When **Problems** says **No problems.**, click **Save**.

## 10. Read it

Click **Done**. The chart opens in the viewer at the same place:

- Click a person to see them in the side panel.
- **Year** in the toolbar opens the time slider; the search box is at the top left (press `/`).
- Click **Crownline** at the top left to go back to the library, where your chart now has a card.

## 11. Export it

Back in the editor (**Edit** from the view, or from the library card), click **Export…**:

- **PNG**: the chart as a picture, at twice its size;
- **PDF**: one page, for printing;
- **The chart page**: an HTML page of the chart and its layout file.

Tick **A public build** to leave out pictures marked private (this chart has none). The files are written at the repository's root, named after the chart's id (`<id>.png` and so on), and the dialog links to them. From the command line, the same export is (with your chart's id):

```bash
npm run build:chart -- charts/<id>/chart.json --png --pdf
```

## 12. Keep the layout

The engine lays the chart out on its own each time. Once it looks right, you can keep it that way:

- Click **Keep this layout**, then **Save**: the save writes `layout.lock.json` beside the chart. **Keep the layout** is ticked for you, and the button becomes **Re-layout…**.
- From then on a change moves only what it must, and the **Moves** tab lists what moved. (Before there is a kept layout, **Moves** compares the chart with how it was last saved, so it can list cards moved by a change such as the note's side.)

This matters most on a large chart that people have checked by eye. [EDITOR.md](EDITOR.md#the-kept-layout) explains it.

## Where next

- [EDITOR.md](EDITOR.md): every control in the editor.
- [STYLE.md](STYLE.md): the rules a chart follows (what the lines, cards and colours mean, and how to fix a collision).
- [FORMAT.md](FORMAT.md): every field of `chart.json`, for writing or reviewing a chart by hand.
- [AI.md](AI.md): editing a chart through a language model, with the `crownline` command line or its MCP server.
- [HOW_IT_WORKS.md](HOW_IT_WORKS.md): the engine, the lock, the tools and the build.

A folder of charts kept elsewhere on your computer can be opened from the library: **Open a folder…** in Chrome or Edge saves to it in place, and **Upload a folder…** works in any browser and downloads the changed files.

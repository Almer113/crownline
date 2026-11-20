# The Crownline style

These are the rules a Crownline chart follows. They come from making the Wangsa Mataram chart, and the check, the editor and the tools for language models all hold to them. [AI_GUIDE.md](AI_GUIDE.md) states the same rules for a model, in terms of its operations. [FORMAT.md](FORMAT.md) names the fields.

## Stability first

A chart that people have checked by eye must not shuffle when something small changes.

- **Fix a defect where it is.** Move a note, a label or a line before you move a card. Never lay the whole chart out again to fix one place.
- **A change that would re-flow the chart is an experiment.** Try it on a copy, show it, and let the chart's owner decide.
- **Keep the layout.** Once a chart is right, keep its layout (`layout.lock.json`: in the editor, **Keep this layout** and **Keep the layout**). Then a change moves only what it must, and the **Moves** tab, or `npm run build:chart -- <chart.json> --lock`, names everything that moved. Only the people you meant to move should be on that list.
- **Every hand adjustment has a reason** ("clears Hamengkubuwana II's note"). The editor's **Adjusted** tab lists the adjustments with their reasons.

## Fixing a collision

When a note, label or line runs into something, try these in order. Stop at the first that works.

1. **Move the note.** Change its side (right, left, below, above) or its width (240, 300, 360, 440 or 560 px), or drag it clear. An inline note can become a lettered one: a letter on the card, with the text in the Notes list.
2. **Move a break mark or a note letter** along its line or to the top of the card.
3. **Lift a label** a few pixels.
4. **Share a line.** Let one parent's children hang off one horizontal line.
5. **Only then move a card**, and move the smallest branch that solves it.

A note on the same side as a spouse lands on the spouse's name. Put it on the other side.

## Lines

1. **A line leaves the bottom of a parent's card and enters the top of a child's card.** Turns along the way are fine. A child drawn level with the parent gets a hook. A row of legendary ancestors joined side to side is the one deliberate exception.
2. **When both parents are on the chart, the child's line comes down from their marriage line.** It never comes from one parent alone. A child hangs from one parent only when the other is not shown.
3. **All of one parent's descendants hang off one horizontal line.** Two parallel lines under one parent read as two sets of siblings. A grandchild shown without the child in between continues the parent's line, with a break mark ("grandson").
4. **A couple's line need not drop from the middle of the marriage line.** If a child stands under the marriage line, the line goes straight down into that child. A drop from the middle that jogs back reads as wonky.
5. **Every crossing is drawn over and under,** with a gap in the line beneath. Solid lines go over dotted and grey ones.
6. **Lines keep their distance.** They stay at least 22 px from era lines and 30 px from other parallel lines. They never pass through a card or text.

What the line styles mean:

| Line | Meaning |
|---|---|
| Solid | Father to son, within the dynasty |
| Dotted | Through a daughter, or by marriage |
| Grey | Outside the dynasty: a marriage, a descent or patronage |
| Legend | Claimed by the chronicles |
| Long dashes | Adoption |

A line takes the colour of the house of the person it leads to, and changes colour at a house pill.

## Cards and colour

- **A card's colour is the person's birth house.** A princess who married into another house keeps her birth colour. A person with no house is drawn grey, which reads as "outside the courts". So give a house whenever the person was born into one of the chart's houses, and never invent one.
- **A marriage line takes the incoming spouse's birth-house colour.** It is grey for a spouse from outside the chart's houses.
- **The card kinds:**

  | Card | For |
  |---|---|
  | Ruler | someone who reigned: portrait, house colour, crown |
  | Heir | an heir to the throne: portrait, pale house colour |
  | Royal, did not reign | other members of a house |
  | Public figure | someone notable outside the courts: a grey card |
  | Spouse (name only) | a spouse with no public role: the name beside the partner |
  | Legendary ancestor | known only from legend: a dashed outline |

- **Hatched** marks a rival or unrecognised claimant. A dashed outline on a pale fill marks someone known only from the chronicles.
- **A crown** shows the order of reign within each court.
- **Each person appears once.** One line places them, or they are drawn beside a partner.
- **A spouse on the chart earns their place:** children drawn from the couple, or a reason stated on the chart (a note, or a caption).

## The time axis

- A person is drawn at the row of **the year they began to reign or became notable**. A spouse drawn beside a partner shares the partner's row.
- Eras are marked across the chart at their first year. Episodes (a war, a regency) span years. Half-century bands stretch where many reigns fall close together.

## Writing

- **A single reign** is written with a spaced en dash: "r. 1755 – 1792". **Several reigns** use shortened years and no spaces: "r. 1810–11, 1812–14". A reign still going ends in "present".
- **A lifespan** reads "1921 – 2015". **A marriage** reads "m. 1974, div. 1984".
- **Separate facts on one line** are joined with " · ": "presumed heir · renamed 2015".
- **Titles keep their own form** (GKR, KGPAA, Shōgun). Each word of a title is explained in the glossary, and the check warns when one is missing.
- **Facts carry their uncertainty** where they appear ("per chronicles", "identity uncertain", "by tradition"), and the caveats explain it.
- **Never invent a fact.** A note says what the sources say, and when.
- **A chart is true as of a stated date** (`meta.asOf`, printed in the footer). Word facts that are still changing so they stay true, with the latest dated development.

## Pictures and fonts

- Every picture has its credit: what it is, where it came from, its author and licence, and what was changed. The credits page prints them.
- A picture that may not be published is marked private. A public build leaves it out without moving anything.
- A public build uses the open fonts only (Gantari and Felipa). A proprietary font is never in a public build.

# Asset audit for public release

Done in Phase 0 of the project. Before the repository is public, each asset is checked against one question: may it be redistributed in an open repository and on a public demo site?

Audit date: 17 November 2026. Sources were the credit files under `assets/` (since Phase 4, the `media` records in the chart document) and the fonts' own embedded licence fields. This is a careful reading, not legal advice.

**Status key**

| Status | Meaning |
|---|---|
| ✅ Free | Public domain, CC0, CC BY or CC BY-SA. May be published with the credit (and, for BY-SA, under the same licence). |
| ⚠️ Doubtful | Tagged free, but the tag is questionable (unclear origin, or a palace or official image tagged public domain by an uploader). Publishable with care; better replaced when a cleaner source exists. |
| ❓ Unknown | No source recorded. Must be traced before publishing. |
| ⛔ Not free | Copyrighted with no licence (press photos, palace and house websites) or proprietary. Must not be published. |

## Summary

| Group | ✅ | ⚠️ | ❓ | ⛔ |
|---|---|---|---|---|
| Portraits (85) | 62 | 14 | 0 | 9 |
| Fonts (4) | 0 | 0 | 0 | 4 |
| Emblems (5 used) | 4 | 0 | 0 | 1 |
| Brand marks (2 used) | 1 | 0 | 1 | 0 |
| Map data | all | | | |

Portrait counts are as of 18 November 2026, after the steps below: the nine unknown sources were traced, `hb2` became private, and the doubtful ones are the uploader-claimed licences listed in step 7. On 20 November five of those (the clearly modern works) were made private too (step 9), so 14 portraits are now private in all.

**The blockers:**

1. ~~**All four fonts.**~~ None may be redistributed. Done: replaced with open fonts (see [Fonts](#fonts)).
2. **Nine portraits** come from press photos or house and palace websites. Resolved for the public build: they become silhouettes (step 5).
3. ~~**Nine Mangkunegaran portraits**~~ have no recorded source. Resolved: all traced to Commons. Most came from the original PowerPoint draft.
4. ~~**The Mangkualaman emblem**~~ has no licence. Resolved: left out of the public build (an empty space of the same size).
5. ~~**The FANMADECHART logo**~~ has unknown terms. Resolved: left out of the public build.

The licence conflict is resolved (see [Licences](#licences)): the chart moved from CC BY-NC-SA to CC BY-SA 4.0 so that it fits the CC BY-SA portraits.

## Fonts

| Font | Use | Embedded licence | Status |
|---|---|---|---|
| Alte Haas Grotesk (regular, bold) | All text | "Copyright (c) 2007 by Yann Le Coroller. All rights reserved." No licence field. Widely shared as freeware, but no written permission to redistribute was found. | ⛔ |
| Apple Chancery | House names | © Apple; trademark of Apple; embedding flag set to *restricted* (fsType 1), meaning it may not even be embedded in documents. | ⛔ |
| `javatext.ttf` (Javanese Text) | Aksara Jawa title | © Microsoft, made by Tiro Typeworks. Licence field allows use only under the terms of the Microsoft product it came with. | ⛔ |

**Consequences**

- None of the font files can be in the public repository.
- The PDF probably embeds Apple Chancery despite its restricted flag. The current PDF shouldn't be published either.
- The PNG is less of a concern (fonts in a raster image), but the chart should switch fonts anyway so the public build is reproducible.

**Replacements chosen** (all under the SIL Open Font License, in `assets/fonts/open/` with their licence files):

| Role | Replaces | Open font | Notes |
|---|---|---|---|
| Main text | Alte Haas Grotesk | Gantari | Closest of 27 grotesques tried on widths, x-height and letter shapes. Shipped as static regular (400) and bold (700) cuts of the variable font; Gantari has no Reserved Font Name, so modified versions may keep the name. |
| House names | Apple Chancery | Felipa | Shipped unmodified (its licence reserves the name "Felipa"). Drawn at 1.21× to match Apple Chancery's width. |
| Aksara Jawa | Javanese Text | Noto Sans Javanese | Designed with Tiro Typeworks, the maker of Javanese Text. |
| Japanese (Tokugawa title) | (none) | Noto Sans JP, subset | Added 18 November 2026; SIL OFL, `OFL-notosansjp.txt`. |

The switch was a reviewed re-flow: every box keeps its row, boxes move sideways by at most 33 px, the canvas narrows from 9220 to 9189 px, and the layout check still gives 0 errors and the same 2 accepted warnings. Both PDFs now embed only these three fonts.

## Portraits

### ⛔ Not free (9): replace or drop

| Id | Person | Current source | Free alternative |
|---|---|---|---|
| `hb1` | Hamengkubuwana I | Kraton Yogyakarta website (sketch on horseback) | None. Commons `Raden_Mas_Sujono.jpg` ("CC BY-SA 4.0, own work") turned out to be a low-quality photo of a print of the same Kraton sketch, so its free licence is doubtful; not used |
| `hb2` | Hamengkubuwana II | Kraton Yogyakarta website (the original; Commons hosts a crop tagged public domain) | None found |
| `pa4` | Paku Alam IV | mangkualaman.org | None found |
| `pa6` | Paku Alam VI | mangkualaman.org (painting) | None found (jv.wikipedia has a 92 px image with an unclear licence) |
| `anglingkusumo` | Mangku Alam I | mangkualaman.org | None found; silhouette |
| `tedjowulan` | KGPA Tedjowulan | detik.com news photo | Commons `Gusti_Tedjowulan_2026.jpg` (public domain, Ministry of Culture), but only 244 px |
| `paundrakarna` | GPH Paundrakarna | suara.com news photo | None found |
| `ancilla` | GRAj. Ancillasura Marina | RCTI+/iNews news photo | None found |
| `bimantoro` | BPH Kusumo Bimantoro | tirto.id press photo | None found |

### ❓ Unknown source (9): trace before publishing

Resolved (17 November 2026): all traced to Commons (step 4). The table is kept as the record of what was found.

| Ids | Note |
|---|---|
| `mn1`–`mn3`, `mn5`–`mn9` | Taken from the original *Wangsa Mataram.pptx* draft; no source recorded. `mn1` matches Commons `Mangkunagara_I.jpg` (public domain), so it can probably be credited to that. The others need a reverse image search, likely Commons, KITLV or Tropenmuseum for the older ones. |
| `mn10` | See ⚠️ below. |
| `wiroyudho` | Cropped from Commons `KGPAA_Mangku_Alam_II&Pernaisuri.jpg` (CC BY-SA 4.0), recorded as the `mangkualaman` source. Free, but the credit file lists it under the wrong id. Fix the record. |

`mn4` is a re-crop of Commons `Portrait_of_Mangkunegara_IV.jpg` (CC BY-SA 3.0) and is ✅.

### ⚠️ Doubtful tags: publishable with care

The first audit found these eight. The current list of 14 is in step 7 below.

| Id | Why |
|---|---|
| `senapati` | Modern painting from the Paguyuban Pakoe Boewono website, tagged public domain by the uploader. |
| `pb1`, `pb2` | Engraving-style portraits uploaded in 2023 with no documented origin. |
| `pb5` | "Kraton Solo" official painting under CC BY-SA, licence claimed by an uploader. |
| `hb2` | Kraton Yogyakarta official portrait. Commons hosts a crop tagged public domain. Now private: the file used is the Kraton original (step 7). |
| `pa9` | Official portrait, public domain claimed by an uploader. |
| `pb14h` | CC0, uploaded as the subject's own work. |
| `mn10` | Public domain tag questioned in the notes; the photo comes from the Pura Mangkunegaran website. |

### ✅ Free (62)

All other portraits come from Wikimedia Commons and fall into four groups:

- **Museum collections:** Tropenmuseum, KITLV/Leiden, Rijksmuseum (CC BY, CC BY-SA, CC0).
- **Old works:** 19th-century photographs and lithographs (public domain).
- **Indonesian government images:** Pemda DIY, KPU, the State Secretariat, ministries and the national archives (public domain as Indonesian government works).
- **Contributor photos:** CC BY-SA.

Each is credited in its `media` record in `charts/wangsa-mataram/chart.json`, the current record (until Phase 4 it was `assets/portraits/CREDITS.tsv`). The older `SOURCES.txt` and `sources_batch*.txt` files are kept only as history.

**Cropping counts as adapting.** Every cropped CC BY-SA portrait is itself CC BY-SA, and the credit must say it was cropped.

## The Tokugawa chart's portraits

Checked 20 November 2026 (PLAN 9d), each against its Commons page through the API. All 18 are public. 17 carry a public-domain tag and one CC BY-SA:

- **16 public domain:** old Japanese paintings and photographs (`PD-Japan`, `PD-Japan-oldphoto`, `PD-old`, `PD-Art`), among them `iemasa`, a photograph tagged `PD-Japan-oldphoto`.
- **`iehiro`, CC BY-SA 4.0:** a recent photograph, credited by name. Commons adds a personality-rights warning: it may be published, but not used to imply that he endorses anything.
- ⚠️ **`yoshimune`, doubtful:** a painting by Kanō Tadanobu, dated 1929, held by the Tokugawa Memorial Foundation and tagged `PD-Art`. Japanese copyright runs 70 years from the painter's death, and no date of death is recorded on Commons, Wikidata or Wikipedia, so the tag can't be confirmed. A clean replacement exists: the Kawamura Kiyoo portrait of Yoshimune (1892; Kawamura died in 1934; `PD-Japan`, `PD-Art|PD-old-auto`), also from the Foundation. A ruler card's size is fixed, so swapping the picture moves nothing. **Kept as it is** (the owner's decision, 20 November 2026).

## Emblems, flags and brand marks

| Asset | Source | Status |
|---|---|---|
| Surakarta, Yogyakarta emblems | Gunawan Kartapranata, Commons, CC BY-SA 3.0 / GFDL | ✅ (royal insignia may carry non-copyright restrictions; fine for an educational chart) |
| Pakualaman, Mangkunegaran emblems | RaFaDa20631, Commons, CC BY-SA 4.0 | ✅ (same note) |
| Mangkualaman emblem | royalhouseofmangkualaman.com, no licence | ⛔ Omitted in the public build (marked `private` in the document's media, with its source `mangkualaman.jpg`). |
| `assets/flags/*` | Commons (CC0 and CC BY-SA) | Not used by any code. Removed (17 November 2026). |
| CC BY-SA badge | Creative Commons (cut from CC's BY-NC-SA button) | ✅ CC's licence buttons are meant to be used this way. |
| FANMADECHART logo | r/UsefulCharts community mark; no terms found | ❓ Keep it out of the public repository, and add it only to builds you post to r/UsefulCharts, unless the subreddit says it may be shared. |

## Map data

| Asset | Source | Status |
|---|---|---|
| `java_adm2`, `java_adm1`, `detail_adm3`, `detail_adm4` | geoBoundaries gbOpen, CC BY 3.0 IGO | ✅ with the credit (geoBoundaries, CC BY 3.0 IGO) shown on the chart itself |
| `java_outline.geojson` | From the original preparation (Natural Earth land, public domain) | ✅, but unused. Removed (17 November 2026). |
| `stages.json` | Own work, citing Ricklefs, Carey, Houben, Cribb and Wikipedia | ✅ |

## Licences

**Code: MIT** (decided). This covers the scripts, and later the engine, viewer and editor.

**Chart content and data: CC BY-SA 4.0** (decided 17 November 2026). The chart used to carry CC BY-NC-SA. The problem: the chart is built from about 25 CC BY-SA portraits and emblems, cropped. CC BY-SA requires adaptations to be shared under the same licence, so a chart that adapts them arguably has to be CC BY-SA, without the NC (non-commercial) term. Whether a chart is an adaptation or only a collection of the images isn't settled, so the chart moved to CC BY-SA. The two options that were weighed:

| Option | What it means |
|---|---|
| **CC BY-SA 4.0** (chosen) | Compatible with every free asset used. Anyone may reuse the chart, commercially too, if they credit it and share alike. |
| Keep CC BY-NC-SA | Then the CC BY-SA images would need replacing with public-domain, CC0 or CC BY ones, which isn't possible for many of them. |

**Asset credits** are recorded in the chart document's `media` records (they replaced `assets/portraits/CREDITS.tsv` and `assets/emblems/CREDITS.tsv` in Phase 4). `tools/build_site.py` (`npm run build:site`) turns them into the demo site's `credits.html`, listing every picture the site shows, chart by chart. (Until 20 November 2026 `tools/publish.py` made the credits page of a viewer-only site; it was retired.)

## What to do, in order

1. ~~**Choose the licences.**~~ Done: CC BY-SA 4.0 for the chart, MIT for the code (`LICENSE`, `LICENSE-CONTENT.md`).
2. ~~**Replace the fonts.**~~ Done: Gantari, Felipa and Noto Sans Javanese (17 November 2026).
3. ~~**Swap `hb1`** to the Commons image.~~ Not done: the Commons image is a photo of the same non-free sketch (see the table above). `hb1` stays a silhouette in the public build.
4. ~~**Trace the nine unknown portraits.**~~ Done: the seven still open (`mn2`, `mn3`, `mn5`–`mn9`) are all on Commons. Five are Tropenmuseum photos (CC BY-SA 3.0), `mn8` is from Leiden/KITLV (CC BY 4.0), and `mn9` is a 2004 election photo tagged public domain as a government work (medium confidence). All seven are public again; details in their media records.
5. ~~**Decide the eight ⛔ portraits.**~~ Done: they stay in the private build and become silhouettes in the public build (`CHART_PUBLIC=1`, listed by the `private` reason on their media records). The unknown `mn` portraits were on the same list until they were traced (step 4); they are public again.
6. ~~**Replace the Mangkualaman emblem.**~~ Done: the emblem and the FANMADECHART logo are left out of the public build and marked `private` in their media records, so the release leaves those files out. `assets/flags/`, `java_outline.geojson`, the old CC BY-NC-SA badge and the unused black logo are deleted.
7. ~~**Fix the credit records.**~~ Done: the credits table (now the document's `media` records) is the single current record, one entry per portrait, checked against the Commons API (size, licence, author). It notes every crop, and corrects `wiroyudho` (filed as `mangkualaman`), `mn4` (filed as `am4`), and `mn1` and `mn10` (from Commons, not the pptx). `hb2` turned out to be the Kraton original and is now private.
   **Uploader-claimed licences (kept public for now, decided 18 November 2026; revisit before release).** These are marked public, but the free licence was given by a Commons uploader who probably doesn't hold the rights. Each has a "doubtful" note in its credit:
   - `hb3`, `hb4`, `hb5`: the same Kraton portrait series as `hb1` and `hb2`, tagged public domain
   - `agung`: a 2008 painting by Basuki Bawono, licensed by the person who photographed it
   - `senapati`: a modern painting from a 2012 blog, tagged public domain
   - `mn10`, `pa9`, `pb12`: official or modern portraits uploaded as "own work"
   - `pb1`, `pb2`, `pb3`, `pb5`, `pb14h`, `haryomataram`: one uploader, origins not documented
   - Milder: `pb13`, `pb14p`, `nyihajar`, `pa8`, `wiroyudho`, `notosoeroto`, and the Indonesian-government public-domain claims
8. ~~**Start the public repository fresh**~~, from a commit made after these changes. Done in PLAN 9d (20 November 2026): `npm run public-repo` builds it in `release/public`, with a history of one commit, from the allowlist in `tools/public-files.txt`. Pictures follow their media records, so a private one can't get in. The build fails if a proprietary font, a private picture (under any name), a local path or a personal detail would go in. The working history stays private.
9. ~~**Decide the doubtful ones before publishing.**~~ Decided by the owner, 20 November 2026:
   - **Private now** (silhouettes in the public build; nothing moves): the clearly modern works `agung` (a 2008 painting), `senapati` (a modern painting), `pb12` (a photo of a modern painted portrait), `mn10` (a 2022 photo) and `pa9` (a 2012 official portrait). Each media record gives the reason.
   - **Kept public, with their "doubtful" notes:** the rest of step 7's list (`hb3`–`hb5`, `pb1`–`pb3`, `pb5`, `pb14h`, `haryomataram`, `nyihajar`, `mn9` and the milder ones), and `yoshimune`.

# Wangsa Mataram: notes for maintainers

The Mataram chart: the Mataram dynasty and the four royal houses that came out of it (Surakarta, Yogyakarta, Pakualaman and Mangkunegaran). This file holds what is particular to this chart: its special placements and adjustments, its accepted warnings, how its map data was made, its portraits, its versions and its open items. How Crownline itself works is in [docs/HOW_IT_WORKS.md](../../docs/HOW_IT_WORKS.md); the rules of the style are in [docs/STYLE.md](../../docs/STYLE.md).

**Contents**

1. [Building it](#1-building-it)
2. [Houses and colours](#2-houses-and-colours)
3. [Special placement](#3-special-placement)
4. [Adjustments in use](#4-adjustments-in-use)
5. [The accepted warnings](#5-the-accepted-warnings)
6. [The maps](#6-the-maps)
7. [Portraits](#7-portraits)
8. [Safety in the workflow](#8-safety-in-the-workflow)
9. [Versions and the archive](#9-versions-and-the-archive)
10. [The review pattern](#10-the-review-pattern)
11. [Open items](#11-open-items)

---

## 1. Building it

```bash
npm run check -- charts/wangsa-mataram/chart.json
npm run build:chart -- charts/wangsa-mataram/chart.json            # wangsa-mataram.html and .layout.json
npm run build:chart -- charts/wangsa-mataram/chart.json --lock     # what moved against layout.lock.json
npm run build:chart -- charts/wangsa-mataram/chart.json --png --pdf
```

The chart builds with **0 errors and 2 warnings**, both accepted ([§5](#5-the-accepted-warnings)). The page is 9169 × 4368 CSS px; the 2× PNG is 18338 × 8736 px.

## 2. Houses and colours

| House | Colour |
|---|---|
| Mataram | `#EFC239` (yellow) |
| Surakarta | `#80C3E1` (blue) |
| Yogyakarta | `#F26654` (red) |
| Pakualaman | `#96BC96` (green) |
| Mangkunegaran | `#EF953A` (orange) |

| Other colour (`theme.palette`) | Value |
|---|---|
| Background | `#EDE8D8` |
| Alternate half-century band | `#E6E0CD` |
| Grey boxes | `#D5D1C3` |
| Grey lines | `#C2BBA8` |

Mataram itself has no emblem: the dynasty used no fixed heraldic emblem (the caveats say so). The Mangkualaman pill is drawn `disputed`. Tien and Suharto's line uses `childColour` with Mangkunegaran orange, since neither has a house colour.

## 3. Special placement

- **The legendary row** (`display.rows`): Brawijaya V, Bondan Kejawan, Getas Pandawa and Sela run left to right on Enis's row (`lg_enis`), joined side to side. The chronicle line bends down at Enis. This is the one deliberate exception to "lines leave the bottom of a box". Brawijaya V (`lg_brawijaya`) is the chart's root.
- **`follow` adjustments**: these people are placed relative to someone else, not by the tree:
  - Sukarno follows his daughter Sukmawati.
  - Pangeran Benawa follows his daughter Banawati.
  - Trunajaya and Untung Surapati stand beside the kings they fought or sheltered (Amangkurat II and III).
- **The historicity scale** (`panels.scale`) runs beside the Mataram trunk: LEGENDARY along the legendary row, COURT TRADITION (dashed) down to Hanyakrawati, then DOCUMENTED (solid, with an arrow at the first ruler in VOC records, 1613–14).
- **The time axis** starts with the 1556 era, which has a title but no line. The 1700 year tick is hidden because it is within 45 px of the 1677 era year.
- **The viewer** opens its time slider at 1755, the split (`panels.viewer.year`).

## 4. Adjustments in use

| Kind | Uses |
|---|---|
| `nudge` | Kencana (`ratuibu`) +80 and Kyai Maja +40 make room for the line from HB II to Kencana. Asih Winarni +36 and Prisca +50 put their child under the marriage line. GKR Maduretno +266 and Sentot −274 put Sentot under Ronggo. HB IX `dy` +10 keeps his crown clear of a line. Alit (`alit_am1`) +2380 stands him beside his brother's queen. |
| `follow` | Sukarno, Benawa, Trunajaya, Surapati ([§3](#3-special-placement)). |
| `coupleSide` | Hamengkubuwana I and Ratu Ageng (`u_ratuageng_hb1`, 0): HB II under the couple, Paku Alam I to his left. Paku Alam II and Hayu (`u_pa2_hayu_pa2`, −1): Paku Alam III and Nataningprang to the left of Paku Alam V. |
| `shareBus` | Kyai Maja and Kencana under HB II (`d_hb2_kyaimaja`, `d_hb2_ratuibu`); Nyi Hajar under Paku Alam III (`d_pa3_nyihajar`). |
| `breakAt` | Kencana 0.8 (below Kyai Maja's card); Bagong 0.3 (above the dotted line it crosses). |
| `drop` | Pakubuwana X to Mooryati (90); Pakubuwana III to Alit (110). |
| `markerTop` | Amangkurat IV (`am4`). |
| `textLift` | Ratnaningrum and Purnamaningrum, lifted 8 px off the 1942 era line. |
| `headerLeft` | Pakualaman (`pa1`), where a cross-house line passes where the header would sit. |
| `noteOffset` | 42 notes, each fitted by hand. |

## 5. The accepted warnings

Both are long-standing compromises, recorded in the lock:

- **`line d_purbaya_p_hemas_pb2 could not find a clear level`**: the dotted line from Pangeran Purbaya to his daughter Hemas, who stands beside Pakubuwana II.
- **`line u_hb4_ratuibu could not find a clear level`**: the Hamengkubuwana IV and Kencana line down to their sons.

## 6. The maps

The "How Mataram split" panel has six maps, three across, each 820 px wide.

| Stage | From | Title | View |
|---|---|---|---|
| S1 | 1625 | c. 1640 · Mataram at its height | All of Java (`java`) |
| S2 | 1743 | 1743–49 · The coast lost | All of Java |
| S3 | 1755 | 1755–57 · Giyanti and Salatiga | All of Java |
| S4 | 1812 | 1812–13 · British rule (the box marks the detail area) | All of Java |
| S5 | 1830 | 1830–1942 · After the Java War | Surakarta–Yogyakarta (`detail`) |
| S6 | 1950 | Since 1950 · In the Republic | Surakarta–Yogyakarta |

Pre-1830 extents are approximate, because the courts' lands were intermixed field by field. From 1830 the maps are good at regency level. The panel's note says so. Partial areas (Adikarto, the Mangkunegaran half of Solo, the enclaves) are drawn over the regencies; the enclaves are outlined in white, and Jagalan and Singosaren, too small to draw, are shown as a dot.

### 6.1 The data

In `assets/maps/`:

| File | Contents |
|---|---|
| `java_adm2.geojson` | The 131 regencies (kabupaten and kota) of Java, plus Bali, which `leaveOut` drops. From **geoBoundaries gbOpen IDN ADM2** (Dec 2023 build, CC BY 3.0 IGO). |
| `stages.json` | For every stage, which polity each regency belongs to (`adm2`), units only partly belonging (`adm2_part`), a confidence level, notes and sources (Ricklefs, Carey, Houben, Cribb and Wikipedia pages). The document's `map_stages` media. |
| `detail_adm3.geojson` | ADM3 districts for Adikarto, the Pakualaman's south-western lands (Temon, Wates, Panjatan, Galur). |
| `detail_adm4.geojson` | ADM4 villages for the Mangkunegaran half of Solo (`solo_mn`), the Kasunanan enclaves of Kotagede and Imogiri (`sk_enclaves`), and the Mangkunegaran enclave of Ngawen (`ngawen_mn`). |
| `java_adm1.geojson` | Provinces. The coastline is drawn from the regencies themselves; the old outline file (`java_outline.geojson`) is no longer kept. |
| `wangsa-mataram-shapes.json` | The merged shapes the engine draws (about 1.2 MB), made by `tools/map_shapes.py`. |

### 6.2 Rebuilding the regencies

`java_adm2.geojson` is built by `rebuild_adm2.py` from the full-resolution download:

```bash
python -I assets/maps/rebuild_adm2.py <geoBoundaries-IDN-ADM2.geojson> assets/maps/java_adm2.geojson 0.003
```

It keeps the regencies already in the file (matched by `shapeID`, keeping their names, provinces and kinds) and replaces only the geometry. It simplifies all of them **as one coverage** (`shapely.coverage_simplify`, tolerance 0.003°), so neighbouring regencies keep exactly the same shared border. It drops islets and holes under 0.00005 deg² and rounds coordinates to 4 decimal places. It reports whether the coverage is valid before and after; both should be `True`.

This fixed the white streaks and slivers on the detail maps (v42). The earlier file had been simplified regency by regency, so shared borders no longer met. The raw download is about 159 MB and isn't kept in the project; download it again from geoBoundaries to rebuild.

`extract_adm3.py` and `extract_adm4.py` cut the detail units out of the geoBoundaries ADM3 and ADM4 downloads. `prepare_geodata.py` is the original preparation script (Java, Madura and Bali from ADM2 and ADM1).

### 6.3 Updating the map data

1. Download geoBoundaries IDN ADM2 into a fresh folder of its own and run `rebuild_adm2.py` as above.
2. The ownership in `stages.json` is keyed by regency name: check those still match.
3. For partial areas, re-run `extract_adm3.py` or `extract_adm4.py`.
4. Remake the shapes file: `CHART_DOC=charts/wangsa-mataram/chart.json python tools/map_shapes.py`, then `--check`.

## 7. Portraits

- Sources are in `assets/portraits_src/`, crops in `assets/portraits/`, cut by `python crop_portraits.py` from its `CROPS` table (with the editor's crops in `assets/portraits_src/crops.json` winning over it, when that file exists).
- **Framing:** photographs are framed alike, the face about half the square wide with 42% headroom. Paintings and drawings are framed by hand.
- The early Mataram rulers are later artistic depictions. Portraits that looked AI-generated were rejected.
- The `media` records in `chart.json` are the current record of every picture's source and licence. The older `assets/portraits/SOURCES.txt`, `assets/emblems/SOURCES.txt` and `assets/portraits_src/sources_batch*.txt` files are kept as history, including the rejections.
- Some portraits have doubtful licences. They are kept public until release, then reviewed.

## 8. Safety in the workflow

- Downloaded data is untrusted. Keep it in its own folder, and run the scripts that read it with `python -I`.
- When downloading, identify as `wangsa-mataram-chart/1.0`, not with a personal email address.

## 9. Versions and the archive

Versions are git tags now. `v43` is the last version from before git, and the baseline commit. Newer changes are commits; tag a version when it is accepted.

Before git, each accepted version was copied to `archive/vNN/`: all the `.py` files, the PNG and the PDF, and the map data when it changed. Some have a `vNN_base` snapshot taken before a risky change. The folder is still kept locally but is not in git (it is about 1.3 GB).

| Version | Change |
|---|---|
| v12 | The layout engine still in use (the user rejected a later rework with a strict time axis). |
| v41 | Before the map rebuild; holds the old `java_adm2.geojson`. |
| v42 | Coverage-simplified regency borders; clean detail maps. |
| v43 | Bagong's break mark moved above the crossing, and the 1700 tick hidden. The bracket label change tried in this round was reverted at the user's request. |

## 10. The review pattern

1. Review: look at every part of the chart at full size and list the issues.
2. The user picks the recommendations to apply.
3. Apply them, and check for 0 errors and that the lock diff (`--lock`) shows only the intended moves.
4. Render, look again, commit and tag.

## 11. Open items

- **Ancillasura Marina's title:** she married on 6 November 2026. Check whether reports give her married title (GRAj., unmarried, may become GRAy.) and update her box.
- **Surakarta succession:** both Pakubuwana XIV claimants remain on the chart as disputed. Update the note and caveat when the dispute moves.
- **Optional ideas offered, not yet requested:**
  - A grandson line from Hamengkubuwana I to Ronggo III (attested by only one source).
  - Trimming Pangeran Blitar's and Mangkubumi's notes.

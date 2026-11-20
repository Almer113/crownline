# Changelog

What changes from one release to the next. Versions follow [semantic versioning](https://semver.org/): while the version starts with 0, a minor release (0.2.0) may change what a chart document looks like, and its notes say how to bring a chart up to date.

A chart document carries its own format number (`"format": 1`), separate from the version of the software. A newer release reads every older format and brings a document up to date with `npm run check -- migrate <chart.json>`.

## 0.1.0 (20 November 2026)

The first release.

**Charts**

- Wangsa Mataram: the Mataram dynasty and the four royal houses of Central Java that came out of it, from the legendary ancestors to the present day, with six maps of how the kingdom split.
- The Tokugawa Shoguns: the fifteen shoguns of Edo and the heads of the house since 1868.
- The tutorial chart, a made-up house of nine people, built step by step in [GETTING_STARTED.md](docs/GETTING_STARTED.md).

**The chart format (format 1)**

- One JSON document per chart: people, marriages and descents, houses, notes, eras, panels, a glossary, tours, maps and media records with credits. Its schema is `packages/schema/chart.schema.json`, and every field is described in [FORMAT.md](docs/FORMAT.md).
- A kept layout beside it (`layout.lock.json`), so that an edit moves only what it must.
- `npm run check`: the schema, the references, the tree rules and the lock.

**The engine**

- Lays a chart out on a time axis, routes the lines, checks for collisions, and draws the chart as one HTML page, a PNG at twice its size and a PDF.
- Public builds: pictures marked private become silhouettes, and the emblems and logos marked private leave an empty space, so the layout does not move.
- The original Python engine stays as the reference that the TypeScript engine is tested against.

**The app** (`npm run dev`)

- A library of the charts, the interactive viewer, and the editor, at one address. The viewer pans, zooms, searches, shows each person's details and their kinship, and has a time slider, a glossary and guided tours.
- The editor changes people, marriages, notes, houses, eras, the glossary and portraits; it shows what moved, keeps the layout, and saves with undo. It also opens a chart folder on your own computer.
- The demo site (`npm run build:site`): the same app as static files. Changes stay in the browser, and Save downloads the chart's folder.

**For language models**

- The `crownline` command line and an MCP server: describe a chart, find people, apply a batch of operations (all or nothing, with undo), check, draw and compare. See [AI.md](docs/AI.md).

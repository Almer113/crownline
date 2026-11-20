<h1><picture><source media="(prefers-color-scheme: dark)" srcset="docs/images/wordmark-dark.svg"><img src="docs/images/wordmark.svg" alt="Crownline" height="64"></picture></h1>

Crownline makes large royal family-tree charts. Cards for people sit on a time axis, lines run from parents to children and marriage lines join couples, coloured by house, with notes, eras and a header card holding the title, key and glossary. A chart is one JSON document. Crownline lays it out, routes the lines, checks for collisions, and gives a print-size PNG and PDF and an interactive viewer for the web. You edit it in the browser, by hand in the file, or through a language model.

It comes with two charts:

- **[Wangsa Mataram](charts/wangsa-mataram/chart.json):** the Mataram dynasty and the four royal houses of Central Java that came out of it (Surakarta, Yogyakarta, the Pakualaman and the Mangkunegaran), from the legendary ancestors in the Babad Tanah Jawi to the present day, with six maps of how the kingdom split. The chart that Crownline was made from; its own notes are in [charts/wangsa-mataram/NOTES.md](charts/wangsa-mataram/NOTES.md).
- **[The Tokugawa Shoguns](charts/tokugawa/chart.json):** the fifteen shoguns of Edo and the heads of the house since 1868.

There is also [the tutorial chart](charts/tutorial/chart.json), a made-up house of nine people that [GETTING_STARTED.md](docs/GETTING_STARTED.md) builds step by step.

## Start

You need Node 22 and npm, and Google Chrome or Microsoft Edge for PNG and PDF.

```bash
npm install
npm run dev          # the app at http://127.0.0.1:5180: the library, the viewer and the editor
```

The app opens on the library, with a card for each chart in `charts/`. Open a chart to read it, **Edit** to change it at the same place, and **Done** to go back. The editor saves to the chart's `chart.json`. Changes made outside the app, by hand or by a model, appear in it as they are saved.

From the command line:

```bash
npm run check                                              # every chart: schema, references and tree rules
npm run build:chart -- charts/tutorial/chart.json --png --pdf   # tutorial.html, .png (2x) and .pdf
npm run build:chart -- --public                            # the public builds, without the files that may not be published
npm run crownline -- help                                  # the tools for language models (and `crownline mcp`)
```

## Documentation

| Document | For |
|---|---|
| [GETTING_STARTED.md](docs/GETTING_STARTED.md) | Install, open the app, make a small chart from nothing, export it |
| [EDITOR.md](docs/EDITOR.md) | Every control in the editor |
| [STYLE.md](docs/STYLE.md) | The rules a chart follows: lines, cards, colours, writing, and how to fix a collision |
| [FORMAT.md](docs/FORMAT.md) | Every field of `chart.json` and `layout.lock.json`, made from the schema |
| [AI.md](docs/AI.md) | Editing through a language model: the MCP server, the command line, setup |
| [AI_GUIDE.md](docs/AI_GUIDE.md) | The guide written for the model itself |
| [HOW_IT_WORKS.md](docs/HOW_IT_WORKS.md) | The engine, the layout, the lock, the operations, the build and every option |
| [ASSET_AUDIT.md](docs/ASSET_AUDIT.md) | Which fonts, portraits and marks may be published |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Corrections, new charts and code: the rules and the checks |
| [CHANGELOG.md](CHANGELOG.md) | What changed in each release |


## The pieces

An npm workspace of seven packages:

| Package | What it is |
|---|---|
| `packages/schema` | The chart format: its schema, the check, migrations, the layout lock |
| `packages/engine` | The layout engine: lays a chart out, routes the lines, checks it, draws it, prints PNG and PDF |
| `packages/ops` | The operations every change goes through, with undo |
| `packages/viewer` | `<crownline-viewer>`, the interactive viewer, a web component any page can embed |
| `packages/editor` | The editor, as a library the app loads when you edit |
| `packages/app` | The app: library, view and editor at one address, and its local server |
| `packages/cli` | The `crownline` command line and MCP server |

The original engine, in Python at the repository root, stays as the reference the TypeScript engine is tested against ([HOW_IT_WORKS.md §20](docs/HOW_IT_WORKS.md#20-the-python-reference-engine)).

## Tests

```bash
npm run typecheck       # all seven packages
npm run test:schema     # the format and the check
npm run test:port       # the engine against the Python engine and the small test charts
npm test -w @crownline/ops
npm run test:cli
npm run build:chart -- charts/wangsa-mataram/chart.json --lock   # what moved, compared with the kept layout
python -m pytest        # the Python engine, the layout lock, assets, font coverage (pip install -r requirements-dev.txt)
```

The viewer has its own checks: `npm run test:browsers` (Chrome, Firefox and WebKit with Playwright), `npm run test:engine` (the engine's text layout against Chrome's) and `npm run smoke`. `npm run demo` serves the viewer's demo page at http://localhost:5173.

`npm run build:site` builds the demo site in `release/site/`: the whole app (library, view and editor) as static files, with the charts, only the files they may publish, and a picture-credits page. On the site, changes stay in the browser, and Save downloads the chart's folder as a .zip. `npm run test:site` tries it in Chrome, WebKit and Firefox. The demo is published from this repository to GitHub Pages: https://almer113.github.io/crownline/.

The tests run on every push (`.github/workflows/tests.yml`).

## Status

Phases 0 to 8 are done: the research, the viewer, the chart format, the engine in TypeScript, a second chart, the editor, and the tools for language models. Version 0.1.0 is the first release (20 November 2026): the app, the documentation, and the demo at https://almer113.github.io/crownline/. Firefox is still to be tested. The Mataram chart is current as of November 2026.

## Public and private builds

Some portraits, one emblem and the FANMADECHART logo may not be published (see the asset audit). Their `media` records in the chart document say why (`private`). A public build swaps them for silhouettes and empty space of the same size, so the layout does not move. This repository is built without them, so its charts draw the same way in every build (`npm run public-repo` makes it, from `tools/public-files.txt`).

## Fonts

The charts use open fonts, kept in `assets/fonts/open/` with their SIL Open Font Licences:

- Gantari for all text;
- Felipa for house names;
- Noto Sans Javanese for the aksara Jawa title;
- Noto Sans JP, cut to the characters used, for the Tokugawa chart's Japanese title.


A chart picks its fonts in `theme.fonts`. A public build (`--public`) and the demo site refuse the proprietary ones. A different main font changes the widths of the cards, so the layout re-flows: run the layout check afterwards.

## Licence

- **Code:** MIT, see [LICENSE](LICENSE).
- **Charts and data:** CC BY-SA 4.0, see [LICENSE-CONTENT.md](LICENSE-CONTENT.md).
- **Assets** keep their own licences. Credits for portraits and emblems are in each chart's `media` records and on the published credits page. The map data (geoBoundaries, CC BY 3.0 IGO) is credited on the chart.



# Contributing to Crownline

Thank you for helping. There are three kinds of contribution, and each has its own rules: corrections to a chart, new charts, and changes to the code.

By contributing, you agree that your code is published under the MIT licence ([LICENSE](LICENSE)) and your chart content under CC BY-SA 4.0 ([LICENSE-CONTENT.md](LICENSE-CONTENT.md)).

## Corrections to a chart

A wrong date, a missing child, a misspelt name: open an issue with the **Chart correction** form, or send a pull request that changes the chart's `chart.json`.

- **Every fact needs a source.** Name a book, an article or a page, precise enough for someone else to find the statement. When sources disagree, say so; the chart's notes can carry both versions.
- **Write names as the chart already does.** Each chart has its own conventions for spelling and titles, described in its `NOTES.md` or `research.md` where it has one.
- **Leave the layout alone unless the change needs it.** Edit with the layout kept (the editor's default, or the `crownline` tools), so that only the cards your change touches move. `npm run build:chart -- charts/<id>/chart.json --lock` lists what moved.

## A new chart

Put it in `charts/<id>/`, with its `chart.json` and, once you are happy with its layout, its `layout.lock.json`. [GETTING_STARTED.md](docs/GETTING_STARTED.md) shows how to start one, and [STYLE.md](docs/STYLE.md) gives the rules a chart follows. Before you send it:

- `npm run check` passes, and the chart builds without errors (`npm run build:chart -- charts/<id>/chart.json`).
- The facts have sources, in the chart's notes or in a `research.md` beside it.
- **Pictures:** use only pictures that may be published openly: public domain, CC0, CC BY or CC BY-SA. Give each one a media record with its source, author and licence. A picture you may use privately but not publish gets a `private` reason: public builds then leave it out without moving anything. [ASSET_AUDIT.md](docs/ASSET_AUDIT.md) shows how the charts here were checked.
- **Fonts:** only fonts under an open licence (such as the SIL Open Font Licence), in `assets/fonts/open/` with their licence file.

## Changes to the code

You need Node 22, npm, and Python 3.13 for the reference engine and its tests. Google Chrome or Microsoft Edge are needed for PNG and PDF.

```bash
npm install
pip install -r requirements-dev.txt
npm run dev            # the app at http://127.0.0.1:5180
```

[HOW_IT_WORKS.md](docs/HOW_IT_WORKS.md) explains the engine, the layout, the lock and the packages.

**Before you send a pull request,** run what applies to your change:

```bash
npm run typecheck
npm run check
npm run test:schema
npm run test:port
npm test -w @crownline/ops
npm run test:cli
python -m pytest
ruff check .
```

The browser checks (`npm run test:browsers`, `npm run test:site` after `npm run build:site`) need Playwright's browsers (`npx playwright install`).

**Some rules the code keeps:**

- **An edit moves only what it must.** A change to the engine must not move the cards of an existing chart unless that is its purpose. `npm run build:chart -- charts/<id>/chart.json --lock` reports every card that moved, for each chart. If cards move on purpose, say so in the pull request, with before-and-after pictures.
- **The two engines agree.** The TypeScript engine is tested against the Python reference engine (`npm run test:port`). A change to the layout goes into both, and `npm run fixtures` updates the expected output.
- **The lines follow the style.** A line enters a child's card at its top and leaves a parent's card at its bottom; where lines cross, a solid line passes over a dotted one; the children of two shown parents drop from the couple. [STYLE.md](docs/STYLE.md) has the rest.
- **Every change to a chart goes through the operations** (`packages/ops`), so that it can be undone, whether it comes from the editor, the command line or a model.

## Reporting a problem

Use the **Bug report** form, with the chart, what you did, what you expected, and what happened. A screenshot helps with a drawing problem, and so does the output of `npm run check` and the browser's console for an error.

Everyone taking part is expected to follow the [code of conduct](CODE_OF_CONDUCT.md).

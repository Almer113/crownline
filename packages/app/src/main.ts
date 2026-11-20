// The Crownline app (PLAN 9a): one address with three screens.
//   ./                              the library: the charts in this repository, a new chart, a folder from this computer
//   ?chart=<id>#@x,y,zoom&p=<id>     a chart to read, at a place (the viewer's address)
//   ?chart=<id>&edit#…               the same chart in the editor, at the same place
//   ?folder&chart=<path>             a chart in a folder opened in this page (gone after a reload: the library then)
// The same app is the demo site (PLAN 9e), built as static files: then the charts are the site's.
// Switching screens keeps the place: the view and the selected person go across. The editor's code is loaded
// only when a chart is edited.
import "./app.css";
import type { HashState } from "@crownline/viewer";
import { hashOf, readHash } from "@crownline/viewer/url";
import { h, render, textOf } from "@crownline/editor/dom";
import { ServerStore, SiteStore, type Store } from "@crownline/editor/store";
import { choose } from "@crownline/editor/dialog";
import { library } from "./library.ts";
import { viewScreen } from "./view.ts";

/** what is on screen: it can be asked to let go (unsaved changes), then is taken down */
export interface Screen {
  /** may the app leave this screen? (false: the reader chose to stay) */
  leave(): Promise<boolean>;
  close(): void;
  /** where the reader is in the chart, to open the next screen there */
  where?(): HashState | null;
}

interface Route { local: boolean; chart: string | null; edit: boolean }

const app = document.getElementById("app")!;
/** the charts the app starts with: this repository's through the local server, or (the demo site, built with
 *  `vite build --mode site`) the published ones, changed only in this browser */
const server: Store = import.meta.env.MODE === "site" ? new SiteStore() : new ServerStore();
/** a folder opened or uploaded in this page */
let local: Store | null = null;
let screen: Screen | null = null;
let shown: Route = { local: false, chart: null, edit: false };

const ID = /^charts\/([a-z][a-z0-9]*(?:-[a-z0-9]+)*)\/chart\.json$/;
/** a chart in the address: its id for a chart in charts/, else its path */
const chartParam = (path: string) => ID.exec(path)?.[1] ?? path;
const chartPath = (p: string) => (p.includes("/") || p.endsWith(".json") ? p : `charts/${p}/chart.json`);
const same = (a: Route, b: Route) => a.local === b.local && a.chart === b.chart && a.edit === b.edit;

function readRoute(): Route {
  const q = new URLSearchParams(location.search), c = q.get("chart");
  return { local: q.has("folder"), chart: c ? chartPath(c) : null, edit: c !== null && q.has("edit") };
}

function href(r: Route, hash = ""): string {
  const parts: string[] = [];
  if (r.local) parts.push("folder");
  if (r.chart) parts.push(`chart=${encodeURIComponent(chartParam(r.chart)).replace(/%2F/g, "/")}`);
  if (r.chart && r.edit) parts.push("edit");
  return `${location.pathname}${parts.length ? "?" + parts.join("&") : ""}${hash}`;
}

/** show a route. `start`: the place to open at (from the screen before); without it, the address's own.
 *  `push`: a new history step (false: the address is already there, Back or Forward) */
async function go(r: Route, start: HashState | null = null, push = true): Promise<boolean> {
  if (screen && !(await screen.leave())) return false;
  screen?.close(); screen = null;
  if (r.local && !local) r = { local: false, chart: null, edit: false };    // the folder is not open in this page
  const keepHash = !push && same(r, readRoute());
  // opened from the address (a link, a reload): its place, which the editor's viewer does not read itself
  if (!start && keepHash && r.chart) start = readHash();
  const url = href(r, start && r.chart ? `#${hashOf(start)}` : keepHash && r.chart ? location.hash : "");
  if (push && url !== location.pathname + location.search + location.hash) history.pushState(null, "", url);
  else history.replaceState(null, "", url);
  shown = r;
  const store = r.local ? local! : server;
  const back = { local: r.local, chart: null, edit: false };
  try {
    if (!r.chart) {
      screen = await library(app, {
        store,
        href: (p, edit) => href({ local: r.local, chart: p, edit }),
        go: (p, edit) => void go({ local: r.local, chart: p, edit }),
        opened: st => { local = st; void go({ local: true, chart: null, edit: false }); },
        again: () => void go(r, null, false),
        back: r.local ? () => void go({ local: false, chart: null, edit: false }) : undefined,
      });
    } else if (r.edit) {
      app.replaceChildren(h("p", { class: "loading" }, "Opening the editor…"));
      const { mountEditor } = await import("@crownline/editor/mount");
      const m = await mountEditor(app, store, r.chart, {
        start, address: true,
        done: () => void go({ ...r, edit: false }, m.where()),
        home: () => void go(back),
      });
      document.title = `${textOf(m.ed.doc.meta.title, m.ed.lang) || r.chart} · Crownline editor`;
      screen = {
        where: m.where, close: m.close,
        leave: async () => {
          if (!m.ed.history.dirty) return true;
          const c = await choose("Unsaved changes", "This chart has changes that are not saved yet.",
            [["save", "Save them"], ["discard", "Discard them"]]);
          if (c === "save") { await m.save(); return !m.ed.history.dirty; }
          return c === "discard";
        },
      };
      if (import.meta.env.DEV) Object.assign(window, { crownline: { ed: m.ed, viewer: m.viewer } });   // for tests in the browser
    } else {
      const v = await viewScreen(app, store, r.chart, {
        start,
        edit: where => void go({ ...r, edit: true }, where),
        home: () => void go(back),
      });
      screen = v;
      if (import.meta.env.DEV) Object.assign(window, { crownline: { view: v, viewer: v.viewer } });
    }
  } catch (err) {
    render(app, h("main", { class: "library" }, h("p", { class: "loading" }, `Could not open ${r.chart ?? "the library"}: ${(err as Error).message}`),
      h("button", { type: "button", onclick: () => void go(back) }, "Back to the library")));
    screen = { leave: async () => true, close: () => {} };
  }
  return true;
}

// Back and Forward: a step between screens (a step inside the viewer, a person chosen, changes only the hash)
addEventListener("popstate", () => {
  const r = readRoute();
  if (same(r, shown)) return;
  const at = shown.chart ? screen?.where?.() : null, was = href(shown, at ? `#${hashOf(at)}` : "");
  void go(r, null, false).then(ok => { if (!ok) history.pushState(null, "", was); });   // stayed: the address back
});

if (import.meta.env.DEV) Object.assign(window, { crownlineGo: (r: Route) => go(r), crownlineOpenLocal: (st: Store, chart: string | null = null, edit = false) => { local = st; return go({ local: true, chart, edit }); } });
void go(readRoute(), null, false);

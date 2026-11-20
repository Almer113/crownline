// The view screen: a chart to read, drawn by the engine in a worker from the chart as saved (its kept layout, as
// the editor opens it), so it always shows the latest save or a model's latest batch without a separate build.
// The editor's code is not loaded here; Edit loads it.
import type { CrownlineViewer, HashState } from "@crownline/viewer";
import "@crownline/viewer";
import type { Layout } from "@crownline/viewer/layout";
import { h, render, textOf } from "@crownline/editor/dom";
import { Drawing } from "@crownline/editor/load";
import { showPage, type Store } from "@crownline/editor/store";
import type { Screen } from "./main.ts";

export interface ViewOptions {
  start: HashState | null;
  edit: (where: HashState | null) => void;
  home: () => void;
}

export interface ViewScreen extends Screen {
  viewer: CrownlineViewer;
  /** how long the last drawing took in the engine, in ms */
  ms: number;
}

export async function viewScreen(app: HTMLElement, store: Store, chartPath: string, o: ViewOptions): Promise<ViewScreen> {
  render(app, h("p", { class: "loading" }, "Opening the chart…"));
  const d = await Drawing.open(store, chartPath);
  const meta = d.loaded.doc.meta;
  const title = textOf(meta.title, meta.defaultLang) || chartPath;
  document.title = `${title} · Crownline`;

  const viewer = document.createElement("crownline-viewer") as CrownlineViewer;
  viewer.setAttribute("manual", "");
  if (o.start) viewer.start = o.start;
  const status = h("span", { class: "status", role: "status" });
  const edit = h("button", { type: "button", class: "primary", onclick: () => o.edit(viewer.where() ?? o.start),
    title: "Open this chart in the editor, at this place" }, "Edit");
  const titleEl = h("h1", {}, title);
  render(app, h("div", { class: "view" },
    h("header", { class: "bar" },
      h("button", { type: "button", class: "home", onclick: o.home, title: "Back to the library of charts" },
        h("img", { src: "./crownline-wordmark.svg", alt: "Crownline", height: "22", style: "display:block" })),
      titleEl,
      h("span", { class: "hint" }, "Drag to move · scroll or pinch to zoom · double-click a card to fly to it · / searches"),
      status, edit),
    viewer));

  const screen: ViewScreen = {
    viewer, ms: 0,
    where: () => viewer.where(),
    leave: async () => true,
    close: () => { d.close(); off(); },
  };

  /** draw the chart as saved and show it (again: in place, the view kept) */
  const show = async () => {
    const m = await d.draw();
    if (m.type === "built") {
      screen.ms = m.ms;
      status.textContent = "";
      await showPage(viewer, store, m.html, m.layout as Layout);
    } else {
      status.textContent = m.problems.some(p => p.level === "error")
        ? "The chart has errors, so it cannot be drawn: Edit shows them" : `The chart could not be drawn: ${m.message}`;
    }
  };
  await show();

  // the chart changed on disk (a save in another tab, a model's batch): drawn again where the reader is
  let off = () => {};
  if (import.meta.hot && store.kind === "server") {
    const hot = import.meta.hot;
    let pending: Promise<unknown> = Promise.resolve();
    const onFile = ({ path }: { path: string }) => {
      if (path !== d.chartPath && path !== d.lockPath) return;
      pending = pending.then(async () => { await d.reload(); await show(); })
        .catch(err => { status.textContent = `Could not read the change: ${(err as Error).message}`; });
    };
    hot.on("crownline:file", onFile);
    off = () => hot.off("crownline:file", onFile);
  }
  return screen;
}

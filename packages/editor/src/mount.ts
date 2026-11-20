// The editor: the top bar, the people and problems on the left, the live chart in the middle and the selected
// person on the right, mounted in an element of the app (packages/app), which also has the library of charts and
// the view screen.
import type { CrownlineViewer, HashState } from "@crownline/viewer";
import "@crownline/viewer";
import "./style.css";
import { h, render, textOf } from "./dom.ts";
import { Editor } from "./editor.ts";
import { Inspector } from "./inspector.ts";
import { link } from "./link.ts";
import { PeopleList } from "./people.ts";
import { ProblemsPanel } from "./problems.ts";
import { AdjustmentsPanel } from "./adjustments.ts";
import { bindMoves } from "./move.ts";
import { MovesPanel } from "./moves.ts";
import { bindRelayout } from "./relayout.ts";
import { StylePanel } from "./style.ts";
import { ChartPanel } from "./chartpanel.ts";
import { showPage, type Store } from "./store.ts";
import { bindExport } from "./export.ts";
import { choose } from "./dialog.ts";

export interface EditorOptions {
  /** where to open: the view and the selected person (from the view screen) */
  start?: HashState | null;
  /** keep the address's view up to date (the app's server charts, so a reload opens at the same place) */
  address?: boolean;
  /** the top bar's Done: back to the view screen */
  done?: () => void;
  /** the top bar's Crownline: back to the library */
  home?: () => void;
}

export interface MountedEditor {
  ed: Editor;
  viewer: CrownlineViewer;
  /** save, reporting a failure in the status line; resolves either way (ed.history.dirty says whether it saved) */
  save: () => Promise<void>;
  /** where the view is now, to open the view screen there */
  where: () => HashState | null;
  /** take the editor down: its listeners and its engine (the element is left for the next screen) */
  close: () => void;
}

/** open a chart in the editor, inside `app` */
export async function mountEditor(app: HTMLElement, store: Store, path: string, opts: EditorOptions = {}): Promise<MountedEditor> {
  render(app, h("p", { class: "loading" }, `Opening ${path}…`));
  const ed = await Editor.open(store, path);
  const ctl = new AbortController(), signal = ctl.signal;
  app.classList.add("cl-editor");
  const viewer = document.createElement("crownline-viewer") as CrownlineViewer;
  viewer.setAttribute("editor", "");
  // the address follows the view (the app opens the view screen at the same place); history is left alone
  if (opts.address) { viewer.setAttribute("address", ""); viewer.setAttribute("history", "replace"); }
  if (opts.start) { viewer.start = opts.start; if (opts.start.person && ed.doc.people[opts.start.person]) ed.select(opts.start.person); }
  // fly to a person; one just added is not drawn yet: fly when the page with them arrives
  let flyLater: string | null = null;
  const fly = (id: string) => { if (ed.result.layout?.people[id]) void viewer.flyToPerson(id); else flyLater = id; };
  let picking: string | null = null;
  const banner = h("div", { class: "banner", hidden: true });
  const startPick = (from: string) => {
    picking = from;
    banner.hidden = false;
    render(banner, `Click the person to connect to ${textOf(ed.doc.people[from]?.name, ed.lang) || from}, or Esc`,
      h("button", { type: "button", onclick: () => endPick() }, "Cancel"));
  };
  const endPick = () => { picking = null; banner.hidden = true; };
  const inspector = new Inspector(ed, { fly, connect: startPick });
  const people = new PeopleList(ed, fly);
  const problems = new ProblemsPanel(ed, { fly, flyRect: r => void viewer.flyToRect(r) });
  const adjustments = new AdjustmentsPanel(ed, fly);
  bindMoves(ed, viewer, () => viewer.focus({ preventScroll: true }));

  // the chart: each new page replaces the old one in place
  // The editor's selection leads; the viewer follows. Telling the viewer makes it report back, and it cannot
  // select someone its page does not have yet (a person just added): those reports are not the reader's.
  let telling = false;
  const tell = () => { telling = true; try { viewer.select(ed.selected, false); } finally { telling = false; } };
  let shownHtml = "";
  ed.on(what => {
    if (what !== "result" || !ed.result.html || !ed.result.layout) return;
    if (ed.result.html !== shownHtml) {
      shownHtml = ed.result.html;
      viewer.preview(null);                               // outlines belong to the page they were drawn on
      telling = true;
      void showPage(viewer, store, ed.result.html, ed.result.layout).finally(() => {
        telling = false; tell();
        if (flyLater && ed.result.layout?.people[flyLater]) { void viewer.flyToPerson(flyLater); flyLater = null; }
      });
    }
  });
  viewer.addEventListener("select", e => {
    if (telling) return;
    const id = (e as CustomEvent<{ id: string | null }>).detail.id;
    if (picking && id && id !== picking) { const from = picking; endPick(); void link(ed, from, id); tell(); return; }
    ed.select(id);
  });
  ed.on(what => { if (what === "select") tell(); });

  // Alt-drag from card to card: a rubber line, then the question
  const rubber = h("div", { class: "rubber", hidden: true });
  let start: [number, number] | null = null;
  viewer.addEventListener("linkdrag", e => {
    const d = (e as CustomEvent<{ from: string; x: number; y: number; over: string | null }>).detail;
    if (!start) start = [d.x, d.y];
    const [x0, y0] = start, dx = d.x - x0, dy = d.y - y0;
    Object.assign(rubber.style, { left: `${x0}px`, top: `${y0}px`, width: `${Math.hypot(dx, dy)}px`,
      transform: `rotate(${Math.atan2(dy, dx)}rad)` });
    rubber.hidden = false;
    rubber.classList.toggle("on", !!d.over && d.over !== d.from);
  });
  viewer.addEventListener("link", e => {
    const d = (e as CustomEvent<{ from: string; to: string | null }>).detail;
    rubber.hidden = true; start = null;
    if (d.to) void link(ed, d.from, d.to);
  });

  // the top bar
  const undo = h("button", { type: "button", onclick: () => ed.history.undo() }, "Undo");
  const redo = h("button", { type: "button", onclick: () => ed.history.redo() }, "Redo");
  const save = h("button", { type: "button", class: "primary", onclick: () => void doSave() }, "Save");
  const status = h("span", { class: "status", role: "status" });
  const keep = h("input", { type: "checkbox", checked: ed.frozen, disabled: !ed.lock,
    onchange: (e: Event) => ed.setFrozen((e.target as HTMLInputElement).checked) });
  let saveError = "";
  /** the last change brought in from disk, for the status line until the next edit */
  let outside = "";
  const doSave = async () => {
    if (!ed.history.dirty) return;                        // nothing to write (Ctrl+S with no changes)
    try { await ed.save(); saveError = ""; } catch (err) { saveError = `Not saved: ${(err as Error).message}`; bar(); }
  };
  const exportBtn = bindExport(ed, doSave);
  let savedOnce = false;
  // a save writes over the file on disk: "kept yours" no longer holds (a reload also says "saved", and keeps its word)
  ed.on(w => { if (w === "saved") { savedOnce = true; if (outside.startsWith("Kept") || outside.startsWith("The chart changed")) outside = ""; } });
  ed.history.on(why => { if (why !== "do" || ed.history.undoLabel !== "Changed outside the editor") outside = ""; });
  // re-layout (with a lock) or keeping the layout drawn now (without one)
  const relayoutBar = h("div", { class: "banner relayout", hidden: true });
  const relayout = bindRelayout(ed, viewer, relayoutBar, fly);
  const relayBtn = h("button", { type: "button", onclick: () => void relayout.start(),
    title: "Lay out again automatically (the whole chart, a branch, a house or a row), and see what moves first" }, "Re-layout…");
  const lockBtn = h("button", { type: "button", onclick: () => ed.makeLock(),
    title: "Take the layout on screen as this chart's lock, so edits move only what they must" }, "Keep this layout");
  const bar = () => {
    keep.checked = ed.frozen; keep.disabled = !ed.lock;
    relayBtn.hidden = !ed.lock; lockBtn.hidden = !!ed.lock || !ed.result.lock;
    undo.disabled = !ed.history.canUndo; undo.title = ed.history.undoLabel ? `Undo: ${ed.history.undoLabel} (Ctrl+Z)` : "Nothing to undo";
    redo.disabled = !ed.history.canRedo; redo.title = ed.history.redoLabel ? `Redo: ${ed.history.redoLabel} (Ctrl+Shift+Z)` : "Nothing to redo";
    save.disabled = !ed.history.dirty;
    const r = ed.result;
    status.textContent = [saveError || outside || (ed.history.dirty ? "Unsaved changes" : savedOnce ? store.saves : "No changes"),
      ed.building ? "Drawing…" : r.failed ? (r.problems.some(p => p.level === "error") ? "Not redrawn: the document has errors" : `Not redrawn: ${r.failed}`) : r.html ? `Drawn in ${r.ms} ms` : ""].filter(Boolean).join(" · ");
  };
  ed.on(bar);

  // left: tabs for the people and the problems
  const tabs = h("div", { class: "tabs", role: "tablist" });
  const moves = new MovesPanel(ed, { fly, show: ms => viewer.preview({ ids: [], dx: 0,
    ghosts: ms.map(m => m.was).filter((r): r is NonNullable<typeof r> => !!r) }) });
  const style = new StylePanel(ed);
  const chart = new ChartPanel(ed, r => void viewer.flyToRect(r));
  const panes: Record<string, HTMLElement> = { chart: chart.el, people: people.el, problems: problems.el, moves: moves.el, adjustments: adjustments.el, style: style.el };
  const tab = (k: string) => {
    for (const b of tabs.children) b.setAttribute("aria-selected", String((b as HTMLElement).dataset.tab === k));
    for (const [n, el] of Object.entries(panes)) el.hidden = n !== k;
  };
  tabs.append(h("button", { role: "tab", "data-tab": "people", onclick: () => tab("people") }, "People"),
    h("button", { role: "tab", "data-tab": "problems", onclick: () => tab("problems") }, "Problems ", problems.badge),
    h("button", { role: "tab", "data-tab": "moves", onclick: () => tab("moves") }, "Moves ", moves.badge),
    h("button", { role: "tab", "data-tab": "adjustments", onclick: () => tab("adjustments") }, "Adjusted"),
    h("button", { role: "tab", "data-tab": "chart", onclick: () => tab("chart") }, "Chart"),
    h("button", { role: "tab", "data-tab": "style", onclick: () => tab("style") }, "Style"));
  tab("people");

  render(app,
    h("header", { class: "top" },
      opts.home ? h("button", { type: "button", class: "home", onclick: opts.home, title: "Back to the library of charts" }, "Crownline")
        : h("a", { href: "./", class: "home", title: "Choose another chart" }, "Crownline"),
      opts.done ? h("button", { type: "button", onclick: opts.done, title: "Back to reading the chart" }, "Done") : null,
      h("strong", {}, store.kind === "server" || store.kind === "site" ? path : `${store.name} / ${path}`),
      undo, redo, save, exportBtn,
      h("label", { class: "check", title: "Lay the chart out from its lock: an edit moves only what it must. Off: the automatic layout" },
        keep, "Keep the layout"),
      relayBtn, lockBtn,
      status),
    h("aside", { class: "left" }, tabs, people.el, problems.el, moves.el, adjustments.el, chart.el, style.el),
    h("div", { class: "chart" }, viewer, banner, relayoutBar,
      h("p", { class: "chart-hint" }, "Drag the selected card to move it · drag a note to move it · Alt-drag between cards to connect")),
    h("aside", { class: "right" }, inspector.el),
    rubber);
  bar();

  addEventListener("keydown", e => {
    const mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
    if (document.querySelector("dialog[open]")) return;
    if (mod && k === "z") { e.preventDefault(); if (e.shiftKey) ed.history.redo(); else ed.history.undo(); }
    else if (mod && k === "y") { e.preventDefault(); ed.history.redo(); }
    else if (mod && k === "s") { e.preventDefault(); void doSave(); }
    else if (e.key === "Escape" && picking) endPick();
    else if (e.key === "Delete" && ed.selected && !(e.target instanceof Element && e.target.closest("input, textarea, select"))) {
      e.preventDefault(); void inspector.remove(ed.selected);
    }
  }, { signal });
  addEventListener("beforeunload", e => { if (ed.history.dirty) e.preventDefault(); }, { signal });

  // changes made outside the editor (a model through the crownline tools, or a person): one undoable step
  // asked by a change on disk, and by Save when the file on disk changed since (Cancel: decide later)
  ed.ask = async () => {
    const c = await choose("The chart changed on disk",
      "It was changed outside the editor (by a model, or by hand), and you have unsaved changes. Take the version on disk? Your changes stay in the history: Undo brings them back.",
      [["theirs", "Take the version on disk"], ["mine", "Keep mine (Save writes over it)"]]);
    return c === null ? null : c === "theirs";
  };
  const OUTSIDE = { loaded: "Changed outside the editor: Undo takes it back", kept: "Kept yours: the file on disk differs until you save",
    deferred: "The chart changed on disk: Save asks which version to keep" } as const;
  if (import.meta.hot && store.kind === "server") {
    let pending: Promise<unknown> = Promise.resolve();
    const hot = import.meta.hot;
    const onFile = ({ path: changed }: { path: string }) => {
      if (changed !== ed.chartPath && changed !== ed.lockPath) return;
      pending = pending.then(async () => {
        const r = await ed.reload(ed.ask!);
        // read now; and a save refused for an earlier change on disk is old news next to this one
        if (/^(Could not read the change|Not saved: the chart)/.test(saveError)) saveError = "";
        if (r !== "same") outside = OUTSIDE[r];
        bar();
      }).catch(err => { saveError = `Could not read the change on disk: ${(err as Error).message}`; bar(); });
    };
    hot.on("crownline:file", onFile);
    signal.addEventListener("abort", () => hot.off("crownline:file", onFile));
  }
  return {
    ed, viewer, save: doSave,
    where: () => viewer.where() ?? opts.start ?? null,
    close: () => { ctl.abort(); ed.close(); app.classList.remove("cl-editor"); },
  };
}


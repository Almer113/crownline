// The library: the charts as cards (this repository's, or a folder's opened from this computer), a new chart, and
// opening a folder. A card opens the chart to read; its Edit link opens it in the editor.
import { h, render } from "@crownline/editor/dom";
import { canOpenFolders, FolderStore, SiteStore, UploadStore, type ChartEntry, type Store } from "@crownline/editor/store";
import { choose } from "@crownline/editor/dialog";
import { summarise } from "./summary.ts";
import type { Screen } from "./main.ts";

export interface LibraryOptions {
  /** the charts shown: this repository's (the local server), or a folder's */
  store: Store;
  /** the address of a chart's view and of its editor, for the links */
  href: (path: string, edit: boolean) => string;
  go: (path: string, edit: boolean) => void;
  /** a folder was opened or uploaded: show its charts */
  opened: (store: Store) => void;
  /** show the library again (its charts changed) */
  again: () => void;
  /** a folder's library: back to this repository's */
  back?: () => void;
}

export async function library(app: HTMLElement, o: LibraryOptions): Promise<Screen> {
  render(app, h("p", { class: "loading" }, "Opening the library…"));
  const local = o.store.kind === "folder" || o.store.kind === "upload", site = o.store instanceof SiteStore ? o.store : null;
  const charts = await o.store.charts().catch(() => null);
  const edited = site ? await site.edited() : [];
  document.title = local ? `${o.store.name} · Crownline` : "Crownline";

  const fail = (err: unknown) => void choose("Could not open the folder", (err as Error).message, [["ok", "OK"]]);
  const folder = async (pick: () => Promise<Store | null>) => { try { const st = await pick(); if (st) o.opened(st); } catch (e) { fail(e); } };
  const newOne = async () => {
    const { newChart } = await import("@crownline/editor/newchart");      // the schema comes with it: only when asked
    const p = await newChart(o.store, charts ?? []);
    if (p) o.go(p, true);
  };

  render(app, h("main", { class: "library" },
    h("header", {},
      h("h1", {}, local ? o.store.name : h("img", { src: "./crownline-wordmark.svg", alt: "Crownline", height: "40", style: "display:block" })),
      h("p", { class: "lead" }, local ? "The charts in this folder." : "Royal family trees as charts to explore. Open one to read it; edit it from there."),
      site ? h("p", { class: "note" }, "This is the demo: the editor runs in your browser, and what you change stays in this browser. Save also downloads the chart’s folder as a .zip, to keep or to open in Crownline on your own computer. ",
        h("a", { href: "credits.html" }, "Picture credits"), " · ", h("a", { href: "https://github.com/Almer113/crownline" }, "The code on GitHub")) : null),
    charts === null ? h("p", { class: "empty" }, "The charts could not be listed.")
      : charts.length === 0 ? h("p", { class: "empty" }, local ? "There are no charts in this folder (no charts/<id>/chart.json)." : "There are no charts yet.")
      : h("ul", { class: "cards" }, ...charts.map(c => card(c, o, charts.filter(d => d.title === c.title).length > 1))),
    h("div", { class: "row wrap actions" },
      charts !== null ? h("button", { type: "button", class: "primary", onclick: () => void newOne() }, "New chart…") : null,
      o.back ? h("button", { type: "button", onclick: o.back }, "Back to this repository's charts") : null),
    edited.length ? h("section", { class: "edited" },
      h("h2", {}, "Your changes"),
      h("p", {}, `${edited.length === 1 ? "One file has" : `${edited.length} files have`} changed in this browser: `,
        ...edited.flatMap((f, i) => [i ? ", " : "", h("code", {}, f)]), "."),
      h("button", { type: "button", onclick: async () => {
        const c = await choose("Forget your changes?", "The charts go back to how this site published them. Anything you have not downloaded is lost.",
          [["forget", "Forget them"], ["keep", "Keep them"]]);
        if (c === "forget") { await site!.forget(); o.again(); }
      } }, "Forget my changes…")) : null,
    local ? null : h("section", { class: "folders" },
      h("h2", {}, "A chart folder on this computer"),
      h("p", {}, "Open a project folder: the one holding charts/ (each chart in its own folder) and assets/."),
      h("div", { class: "row wrap" },
        canOpenFolders() ? h("button", { type: "button", onclick: () => folder(FolderStore.pick) }, "Open a folder…") : null,
        h("button", { type: "button", onclick: () => folder(UploadStore.pick) }, canOpenFolders() ? "Upload a folder instead…" : "Upload a folder…")),
      h("small", {}, canOpenFolders() ? "Opened, the folder is saved to in place. Uploaded, Save downloads the changed files for you to put back."
        : "This browser cannot write to folders: Save downloads the changed files for you to put back (Chrome and Edge can)."))));
  return { leave: async () => true, close: () => {} };
}

/** a chart's card: filled in once its document is read */
/** `same`: another chart has the same title, so the card names its folder too */
function card(c: ChartEntry, o: LibraryOptions, same = false): HTMLLIElement {
  const go = (edit: boolean) => (e: MouseEvent) => {
    if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;    // a new tab: the link's own
    e.preventDefault(); o.go(c.path, edit);
  };
  const pic = h("div", { class: "pic" }), facts = h("p", { class: "facts" }), swatches = h("div", { class: "swatches" });
  const sub = h("p", { class: "sub" });
  const title = h("strong", {}, c.title);
  const li = h("li", { class: "card" },
    h("a", { class: "open", href: o.href(c.path, false), onclick: go(false) }, pic, h("span", { class: "text" }, title,
      same ? h("code", { class: "id" }, c.path.replace(/\/chart\.json$/, "")) : null, sub, facts, swatches)),
    h("a", { class: "edit", href: o.href(c.path, true), onclick: go(true), title: `Open ${c.title} in the editor` }, "Edit"));
  summarise(o.store, c.path).then(s => {
    title.textContent = s.title;
    sub.textContent = s.subtitle;
    facts.textContent = [`${s.people} ${s.people === 1 ? "person" : "people"}`, !s.years ? "" : s.years[0] === s.years[1] ? String(s.years[0]) : `${s.years[0]} – ${s.years[1]}`,
      `${s.houses.length} ${s.houses.length === 1 ? "house" : "houses"}`].filter(Boolean).join(" · ");
    render(swatches, ...s.houses.slice(0, 14).map(x => h("span", { style: `background:${x.colour}`, title: x.name })));
    if (s.picture) pic.append(s.picture); else pic.classList.add("none");
  }, () => { sub.textContent = "This chart cannot be read."; pic.classList.add("none"); });
  return li;
}

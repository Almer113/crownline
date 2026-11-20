// Export (PLAN 7f): the saved chart as a PNG, a PDF or the chart page. The local server builds them with the
// engine's command line (in the installed Chrome or Edge), as `npm run build:chart` does. A folder opened in the
// browser, and the demo site, can take the chart page only. (The whole app as a site: npm run build:site.)
import { modal, choose } from "./dialog.ts";
import { h } from "./dom.ts";
import type { Editor } from "./editor.ts";
import { download } from "./store.ts";

type What = "png" | "pdf" | "page";
const WHAT: [What, string, string][] = [
  ["png", "PNG", "the chart as a picture, at twice its size"],
  ["pdf", "PDF", "one page, for printing"],
  ["page", "The chart page", "<id>.html and its layout file: the chart, drawn, for the browser"],
];
interface Answer { what: What; pub: boolean }
interface Exported { ok: boolean; log: string; files: string[]; error?: string }

function ask(server: boolean, site: boolean): Promise<Answer | null> {
  return modal<Answer>(done => {
    const pub = h("input", { type: "checkbox" });
    const pick = (what: What) => done({ what, pub: pub.checked });
    return [
      h("div", { class: "choices export" }, ...WHAT.filter(([w]) => server || w === "page").map(([w, l, d]) =>
        h("button", { type: "button", class: w === "png" ? "primary" : "", onclick: () => pick(w) }, h("strong", {}, l), h("small", {}, d)))),
      server ? h("label", { class: "check" }, pub, "A public build: leave out the media marked private (the open fonts only)") :
        h("p", { class: "hint" }, site ? "PNG and PDF are made by the app on your own computer (npm run dev, see Getting started): this site can give the chart page only."
          : "PNG and PDF are made by the local server (npm run dev), which this folder is not opened through."),
      h("div", { class: "row end" }, h("button", { type: "button", onclick: () => done(null) }, "Cancel")),
    ];
  }, "Export");
}

/** the Export button: asks what, saves first if needed, builds, offers the result */
export function bindExport(ed: Editor, save: () => Promise<void>): HTMLElement {
  const btn = h("button", { type: "button", title: "Make a PNG, a PDF or the chart page from the saved chart" }, "Export…") as HTMLButtonElement;
  btn.addEventListener("click", async () => {
    const server = ed.store.kind === "server";
    const a = await ask(server, ed.store.kind === "site");
    if (!a) return;
    if (ed.history.dirty) {
      const go = await choose("Save first?", "Export builds the chart as saved. Save the changes now?", [["save", "Save and export"]]);
      if (go !== "save") return;
      await save();
      if (ed.history.dirty) return;                       // the save failed: the top bar says why
    }
    if (!server) { await pageHere(ed); return; }
    btn.disabled = true;
    const was = btn.textContent;
    btn.textContent = "Exporting…";
    try {
      const r = await fetch(`/api/export?chart=${encodeURIComponent(ed.chartPath)}&what=${a.what}${a.pub ? "&public=1" : ""}${ed.frozen ? "&frozen=1" : ""}`,
        { method: "POST", headers: { "X-Crownline": "save" } });
      const x = (await r.json()) as Exported;
      await result(x);
    } catch (e) { await choose("Export failed", (e as Error).message, [["ok", "OK"]]); }
    finally { btn.disabled = false; btn.textContent = was; }
  });
  return btn;
}

/** what the export made, to download or open; or why it failed */
function result(x: Exported): Promise<unknown> {
  return modal<boolean>(done => ([
    x.ok ? h("p", {}, "Made at the repository's root:") : h("p", { class: "warn" }, x.error ?? "The export failed; the build said:"),
    x.files.length ? h("ul", {}, ...x.files.map(f => h("li", {}, h("a", { href: `/api/output?name=${encodeURIComponent(f)}`, download: f }, f)))) : null,
    x.log.trim() ? h("details", { open: !x.ok }, h("summary", {}, "The build's report"), h("pre", { class: "log" }, x.log.trim().slice(-6000))) : null,
    h("div", { class: "row end" }, h("button", { type: "button", class: "primary", onclick: () => done(true) }, "Close")),
  ] as (HTMLElement | null)[]).filter((e): e is HTMLElement => !!e), x.ok ? "Exported" : "Not exported");
}

/** a folder opened in the browser: the chart page as the editor drew it, written beside charts/ (or downloaded) */
async function pageHere(ed: Editor): Promise<void> {
  const { html, layout, failed } = ed.result;
  if (!html || !layout || failed) { await choose("Not exported", "The chart is not drawn: fix its problems first.", [["ok", "OK"]]); return; }
  const id = ed.doc.meta.id, lay = JSON.stringify(layout);
  if (ed.store.kind === "folder") {
    await ed.store.write(`${id}.html`, html);
    await ed.store.write(`${id}.layout.json`, lay);
    await choose("Exported", `${id}.html and ${id}.layout.json are in ${ed.store.name}, beside charts/ and assets/ (the page finds its pictures from there).`, [["ok", "OK"]]);
  } else {
    download(html, `${id}.html`); download(lay, `${id}.layout.json`);
    await choose("Exported", `Put ${id}.html and ${id}.layout.json in the project folder, beside charts/ and assets/: the page finds its pictures from there.`, [["ok", "OK"]]);
  }
}

// The chart as a whole (PLAN 7e): its title and introduction, the header card's place, the time axis's eras and
// episodes, the key, the glossary, caveats and printed sources, the bibliography, and the map panel's size.
import { newId, setField, setText, type Op } from "@crownline/ops";
import type { ChartDoc } from "@crownline/schema";
import { confirm, modal } from "./dialog.ts";
import { h, render, textOf } from "./dom.ts";
import type { Editor } from "./editor.ts";

type Path = (string | number)[];
const KINDS = ["chronicle", "colonial", "scholarship", "news", "decree", "court", "other"];

export class ChartPanel {
  readonly el = h("section", { class: "chartpanel", "aria-label": "Chart" });
  private open = new Set<string>(["Title"]);

  constructor(private readonly ed: Editor, private readonly flyRect: (r: [number, number, number, number]) => void) {
    // typing in a field keeps it: the panel is redrawn once the field is left
    let stale = false;
    ed.on(what => {
      if (what !== "doc") return;
      const a = document.activeElement;
      if (a && this.el.contains(a) && a.matches("input, textarea")) stale = true; else this.fill();
    });
    this.el.addEventListener("focusout", () => { if (stale) { stale = false; queueMicrotask(() => this.fill()); } });
    // undo and redo are not typing: the field shows what the document now says (the focus is kept)
    ed.history.on(why => { if (why !== "do") { stale = false; this.fill(); } });
    this.fill();
  }

  fill(): void {
    const ed = this.ed, doc = ed.doc, get = (p: Path) => p.reduce<any>((o, k) => o?.[k], doc);
    const run = (op: Op, key?: string) => ed.run(op, key);
    const key = (p: Path) => p.join(".");
    // fields
    const text = (label: string, p: Path, o: { area?: boolean; hint?: string; required?: boolean } = {}) => {
      const k = key(p), v = textOf(get(p), ed.lang);
      const i = o.area ? h("textarea", { rows: 3, "data-key": k }) : h("input", { type: "text", value: v, "data-key": k });
      if (o.area) (i as HTMLTextAreaElement).value = v;
      i.addEventListener("input", () => {
        const val = (i as HTMLInputElement).value;
        run(setText(doc, p as string[], val, ed.lang, `${!val && !o.required ? "Clear" : "Change"} ${label.toLowerCase()}`, o.required), k);
      });
      return h("label", { class: "field" }, h("span", {}, label), i, o.hint ? h("small", {}, o.hint) : null);
    };
    const plain = (label: string, p: Path, o: { hint?: string; optional?: boolean } = {}) => {
      const k = key(p), i = h("input", { type: "text", value: get(p) ?? "", "data-key": k });
      i.addEventListener("input", () => run(setField(p as string[], i.value === "" && o.optional ? undefined : i.value, `Change ${label.toLowerCase()}`), k));
      return h("label", { class: "field" }, h("span", {}, label), i, o.hint ? h("small", {}, o.hint) : null);
    };
    const num = (label: string, p: Path, o: { optional?: boolean; int?: boolean } = {}) => {
      const k = key(p), i = h("input", { type: "number", value: get(p) ?? "", step: o.int ? 1 : "any", "data-key": k });
      i.addEventListener("change", () => {
        const v = i.value === "" ? undefined : o.int ? Math.round(Number(i.value)) : Number(i.value);
        if (v === undefined && !o.optional) return;
        run(setField(p as string[], v, `Change ${label.toLowerCase()}`));
      });
      return h("label", { class: "inline" }, label, i);
    };
    const pick = (label: string, p: Path, options: [string, string][], blank?: string) => h("label", { class: "field" }, h("span", {}, label),
      h("select", { onchange: (e: Event) => { const v = (e.target as HTMLSelectElement).value; run(setField(p as string[], v || undefined, `Change ${label.toLowerCase()}`)); } },
        blank !== undefined ? h("option", { value: "" }, blank) : null,
        ...options.map(([v, l]) => h("option", { value: v, selected: get(p) === v }, l))));
    const x = (title: string, onclick: () => void) => h("button", { type: "button", class: "x", title, "aria-label": title, onclick }, "×");
    const del = (p: Path, label: string): Op => ({ label, patch: [{ op: "del", path: p }] });
    const section = (title: string, ...body: (HTMLElement | null)[]) => {
      const d = h("details", { open: this.open.has(title) }, h("summary", {}, title), ...body);
      d.addEventListener("toggle", () => { if (d.open) this.open.add(title); else this.open.delete(title); });
      return d;
    };
    const houses: [string, string][] = Object.entries(doc.houses).map(([k, v]) => [k, textOf(v.name, ed.lang)]);
    const eras = doc.timeline?.eras ?? [], episodes = doc.timeline?.episodes ?? [];
    // the lock's axis has the eras' years; another year lies between them
    const axisY = (year: number) => {
      const pts = Object.entries((ed.result.lock?.axis ?? {}) as Record<string, number>).map(([k, v]) => [Number(k), v]).sort((a, b) => a[0] - b[0]);
      if (!pts.length) return undefined;
      let i = pts.findIndex(p => p[0] >= year);
      if (i < 0) i = pts.length - 1; else if (i === 0) return pts[0][1];
      const [y0, v0] = pts[Math.max(0, i - 1)], [y1, v1] = pts[i];
      return y1 === y0 ? v1 : v0 + (v1 - v0) * Math.min(1.5, (year - y0) / (y1 - y0));
    };
    // the axis at the left and where the era starts, not the whole width (on a small chart that is the whole chart)
    const flyYear = (year: number) => { const y = axisY(year), W = Math.min(ed.result.layout?.canvas[0] ?? 0, 1400); if (y !== undefined) this.flyRect([0, y - 250, W, y + 250]); };
    // the time axis is made with its first era or episode (it needs both lists)
    const addToTimeline = (list: "eras" | "episodes", value: unknown, label: string): Op => doc.timeline
      ? { label, patch: [{ op: "set", path: ["timeline", list, doc.timeline[list].length], value }] }
      : { label, patch: [{ op: "set", path: ["timeline"], value: { eras: list === "eras" ? [value] : [], episodes: list === "episodes" ? [value] : [] } }] };
    const firstYear = () => { const ys = Object.values(doc.people).flatMap(p => p.show.year ?? []); return ys.length ? Math.min(...ys) : 1600; };
    const sorted = <T,>(list: T[], by: (t: T) => number) => list.map((t, i) => [t, i] as const).sort((a, b) => by(a[0]) - by(b[0]));
    const uses = (sid: string) => JSON.stringify(doc).split(`"source":"${sid}"`).length - 1;
    const glossary = Object.entries(doc.glossary ?? {});
    const groups = [...new Set(glossary.map(([, t]) => t.group))];
    const P = doc.panels as NonNullable<ChartDoc["panels"]>;
    // a glossary group's heading: renaming it renames it on each of its terms
    const groupName = (g: string) => {
      const k = `group:${g}`, i = h("input", { type: "text", value: g, "data-key": k, "aria-label": "Group heading", class: "group-name" }) as HTMLInputElement;
      i.addEventListener("change", () => {
        const v = i.value.trim();
        if (!v || v === g) { i.value = g; return; }
        run({ label: `Rename the glossary group ${g}`, patch: glossary.filter(([, t]) => t.group === g).map(([id]) => ({ op: "set" as const, path: ["glossary", id, "group"], value: v })) });
      });
      return i;
    };


    render(this.el,
      section("Title",
        text("Title", ["meta", "title"], { required: true }),
        text("Subtitle", ["meta", "subtitle"]),
        h("div", { class: "grid2" },
          plain("As of", ["meta", "asOf", "edtf"], { hint: "The date the chart describes: 2025, 2025-06" }),
          plain("Written as", ["meta", "asOf", "text"], { optional: true, hint: "June 2025" })),
        text("Introduction", ["panels", "intro"], { area: true, hint: "On the header card and in the viewer's opening panel." })),
      section("Header card",
        pick("Arrangement", ["panels", "header", "arrange"], [["row", "Top left, the tree beside it"], ["column", "Down the left side, with the notes and sources"], ["top", "Across the top"]], "(row)"),
        h("div", { class: "grid2" }, num("x", ["panels", "header", "x"]), num("y", ["panels", "header", "y"]), num("Width", ["panels", "header", "width"]), num("Height", ["panels", "header", "height"])),
        text("Glossary heading", ["panels", "glossaryTitle"])),
      section("Houses",
        h("p", { class: "hint" }, "A house gives its people's cards and lines their colour. Give a person a house in their own panel; colours are also in the Style tab."),
        h("ul", { class: "rows houses" }, ...Object.entries(doc.houses).map(([k, v]) => {
          const n = houseUses(doc, k), colour = h("input", { type: "color", value: v.colour, "aria-label": "Colour", onchange: (e: Event) =>
            run(setField(["houses", k, "colour"], (e.target as HTMLInputElement).value.toUpperCase(), `Change the colour of ${textOf(v.name, ed.lang)}`)) });
          return h("li", {}, colour, text("Name", ["houses", k, "name"], { required: true }), h("code", { title: "The house's id in the document" }, k),
            n ? h("button", { type: "button", class: "x", disabled: true, title: `Used ${n} ${n === 1 ? "time" : "times"}: give those people another house first` }, "×")
              : x("Remove this house", () => run(del(["houses", k], `Remove the house ${textOf(v.name, ed.lang)}`))));
        })),
        h("button", { type: "button", onclick: () => void addHouse(ed) }, "Add a house")),
      section("Eras and episodes",
        h("p", { class: "hint" }, "Eras start at a year and are drawn as lines across the chart; episodes span years and are drawn as bands. Click ⤢ to see one on the time axis."),
        h("h4", {}, "Eras"),
        h("ul", { class: "rows" }, ...sorted(eras, e => e.year).map(([e, i]) => h("li", {},
          h("input", { type: "number", step: 1, value: e.year, "aria-label": "Year", class: "year", onchange: (ev: Event) =>
            run(setField(["timeline", "eras", i, "year"] as unknown as string[], Math.round(Number((ev.target as HTMLInputElement).value)), "Change an era's year")) }),
          (() => { const k = `era:${i}`, inp = h("input", { type: "text", value: textOf(e.name, ed.lang), "data-key": k, "aria-label": "Name" });
            inp.addEventListener("input", () => run(setText(doc, ["timeline", "eras", i, "name"] as unknown as string[], inp.value, ed.lang, "Rename an era"), k)); return inp; })(),
          h("button", { type: "button", class: "x", title: "Show on the axis", onclick: () => flyYear(e.year) }, "⤢"),
          x("Remove this era", () => run(del(["timeline", "eras", i], "Remove an era")))))),
        h("button", { type: "button", onclick: () => run(addToTimeline("eras", { year: eras.length ? eras.at(-1)!.year + 10 : firstYear(), name: "New era" }, "Add an era")) }, "Add an era"),
        h("h4", {}, "Episodes"),
        h("ul", { class: "rows" }, ...sorted(episodes, e => e.from).map(([e, i]) => h("li", {},
          h("input", { type: "number", step: 1, value: e.from, "aria-label": "From", class: "year", onchange: (ev: Event) =>
            run(setField(["timeline", "episodes", i, "from"] as unknown as string[], Math.round(Number((ev.target as HTMLInputElement).value)), "Change an episode")) }),
          h("input", { type: "number", step: 1, value: e.to, "aria-label": "To", class: "year", onchange: (ev: Event) =>
            run(setField(["timeline", "episodes", i, "to"] as unknown as string[], Math.round(Number((ev.target as HTMLInputElement).value)), "Change an episode")) }),
          (() => { const k = `ep:${i}`, inp = h("input", { type: "text", value: textOf(e.name, ed.lang), "data-key": k, "aria-label": "Name" });
            inp.addEventListener("input", () => run(setText(doc, ["timeline", "episodes", i, "name"] as unknown as string[], inp.value, ed.lang, "Rename an episode"), k)); return inp; })(),
          h("button", { type: "button", class: "x", title: "Show on the axis", onclick: () => flyYear(e.from) }, "⤢"),
          x("Remove this episode", () => run(del(["timeline", "episodes", i], "Remove an episode")))))),
        h("button", { type: "button", onclick: () => { const y = episodes.length ? episodes.at(-1)!.to + 5 : firstYear();
          run(addToTimeline("episodes", { from: y, to: y + 5, name: "New episode" }, "Add an episode")); } }, "Add an episode")),
      section("Key",
        pick("House of the examples", ["panels", "key", "house"], houses, "(the first house)"),
        pick("A second house (the contrast)", ["panels", "key", "contrast"], houses, "(the second house)")),
      section("Glossary",
        h("p", { class: "hint" }, "Each title on a card should be a term here: the check says which are missing."),
        ...groups.map(g => h("div", { class: "group" }, groupName(g),
          h("ul", { class: "rows terms" }, ...glossary.filter(([, t]) => t.group === g).map(([k, t]) => h("li", {},
            plain("Term", ["glossary", k, "term"]), plain("In full", ["glossary", k, "expansion"], { optional: true }), text("Meaning", ["glossary", k, "gloss"], { required: true }),
            x("Remove this term", () => run(del(["glossary", k], `Remove the term ${t.term}`)))))),
          h("button", { type: "button", onclick: () => { const id = newId(doc, "new term");
            run({ label: "Add a term", patch: [{ op: "set", path: ["glossary", id], value: { group: g, term: "New term", gloss: "" } }] }); } }, `Add a term to ${g}`))),
        h("button", { type: "button", onclick: () => { const id = newId(doc, "new term");
          run({ label: "Add a glossary group", patch: [{ op: "set", path: ["glossary", id], value: { group: "New group", term: "New term", gloss: "" } }] }); } }, "Add a group")),
      section("Caveats and printed sources",
        h("h4", {}, "Caveats"),
        h("ul", { class: "rows" }, ...(P.caveats ?? []).map((_, i) => h("li", {}, text(`Caveat ${i + 1}`, ["panels", "caveats", i], { area: true, required: true }),
          x("Remove this caveat", () => run(del(["panels", "caveats", i], "Remove a caveat")))))),
        h("button", { type: "button", onclick: () => run({ label: "Add a caveat", patch: [{ op: "set", path: ["panels", "caveats", (P.caveats ?? []).length], value: "New caveat" }] }) }, "Add a caveat"),
        h("h4", {}, "Sources (as printed on the chart)"),
        h("ul", { class: "rows" }, ...(P.sources ?? []).map((s, i) => h("li", {},
          typeof s === "string" ? plain(`Source ${i + 1}`, ["panels", "sources", i])
            : h("div", {}, plain("In a public build", ["panels", "sources", i, "public"], { optional: true }), plain("In a private build", ["panels", "sources", i, "private"], { optional: true })),
          x("Remove this source", () => run(del(["panels", "sources", i], "Remove a printed source")))))),
        h("button", { type: "button", onclick: () => run({ label: "Add a printed source", patch: [{ op: "set", path: ["panels", "sources", (P.sources ?? []).length], value: "New source" }] }) }, "Add a source")),
      section("Bibliography",
        h("p", { class: "hint" }, "The works that records cite (their \"sources\")."),
        h("ul", { class: "rows" }, ...Object.entries(doc.sources ?? {}).map(([k, s]) => h("li", { class: "source" },
          h("code", {}, k), pick("Kind", ["sources", k, "kind"], KINDS.map(v => [v, v])),
          text("Title", ["sources", k, "title"], { required: true }), plain("Author", ["sources", k, "author"], { optional: true }),
          num("Year", ["sources", k, "year"], { optional: true, int: true }), plain("Link", ["sources", k, "url"], { optional: true, hint: "https://…" }),
          plain("Read on", ["sources", k, "accessed"], { optional: true, hint: "YYYY-MM-DD" }),
          h("small", {}, `cited ${uses(k)} time${uses(k) === 1 ? "" : "s"}`),
          x("Remove this source", async () => {
            if (uses(k)) { await confirm("Still cited", [`${textOf(s.title, ed.lang)} is cited ${uses(k)} times; remove those citations first.`], "OK"); return; }
            run(del(["sources", k], "Remove a source"));
          })))),
        h("button", { type: "button", onclick: () => { const id = newId(doc, "new source", "s_");
          run({ label: "Add a work", patch: [{ op: "set", path: ["sources", id], value: { kind: "scholarship", title: "New source" } }] }); } }, "Add a work")),
      P.map ? section("Map panel",
        plain("Title", ["panels", "map", "title"]),
        h("div", { class: "grid2" }, num("Map width", ["panels", "map", "width"]), num("Columns", ["panels", "map", "columns"], { optional: true, int: true }), num("Panel height", ["panels", "map", "height"])),
        h("p", { class: "hint" }, "The engine places the panel and keeps the tree clear of it.")) : null,
    );
  }
}

/** how many times a house is named elsewhere in the document (people, reigns, line colours, pills, the key): ids are unique, so
 *  a value equal to its id is a use of it */
export function houseUses(doc: ChartDoc, id: string): number {
  const { houses: _, ...rest } = doc as ChartDoc & Record<string, unknown>;
  return JSON.stringify(rest).split(`:"${id}"`).length - 1;
}

/** ask for a new house's name and colour; its id comes from the name */
async function addHouse(ed: Editor): Promise<void> {
  const a = await modal<{ name: string; colour: string }>(done => {
    const name = h("input", { type: "text", required: true, placeholder: "House name" }) as HTMLInputElement;
    const colour = h("input", { type: "color", value: "#3E6E8E" }) as HTMLInputElement;
    return [h("form", { method: "dialog", onsubmit: (e: Event) => { e.preventDefault(); if (name.value.trim()) done({ name: name.value.trim(), colour: colour.value.toUpperCase() }); } },
      h("label", {}, "Name", name), h("label", {}, "Colour", colour),
      h("div", { class: "row end" }, h("button", { type: "button", onclick: () => done(null) }, "Cancel"), h("button", { class: "primary", type: "submit" }, "Add")))];
  }, "A new house");
  if (!a) return;
  const id = newId(ed.doc, a.name);
  ed.run({ label: `Add the house ${a.name}`, id, patch: [{ op: "set", path: ["houses", id], value: { name: a.name, colour: a.colour } }] });
}

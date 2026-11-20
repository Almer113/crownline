// Everyone in the document: search by name, title or id, filter by house; a click selects and flies there.
import { h, render, textOf } from "./dom.ts";
import type { Editor } from "./editor.ts";

const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

export class PeopleList {
  readonly el = h("section", { class: "people", "aria-label": "People" });
  private query = "";
  private house = "";
  private list = h("ul", { class: "list" });
  private count = h("small", { class: "count" });

  constructor(private readonly ed: Editor, private readonly fly: (id: string) => void) {
    const search = h("input", { type: "search", placeholder: "Find a person", "aria-label": "Find a person",
      oninput: (e: Event) => { this.query = (e.target as HTMLInputElement).value; this.fill(); } });
    const houses = h("select", { "aria-label": "House", onchange: (e: Event) => { this.house = (e.target as HTMLSelectElement).value; this.fill(); } });
    const fillHouses = () => {
      const cur = this.house;
      render(houses, h("option", { value: "" }, "All houses"), h("option", { value: "-" }, "No house"),
        ...Object.entries(ed.doc.houses).map(([k, v]) => h("option", { value: k, selected: k === cur }, textOf(v.name, ed.lang))));
    };
    fillHouses();
    this.el.append(h("div", { class: "row" }, search, houses), this.count, this.list);
    ed.on(what => { if (what === "doc") fillHouses(); if (what !== "result") this.fill(); });
    this.fill();
  }

  private fill(): void {
    const ed = this.ed, q = fold(this.query.trim());
    const rows = Object.entries(ed.doc.people).filter(([id, p]) => {
      if (this.house === "-" ? p.house : this.house && p.house !== this.house) return false;
      if (!q) return true;
      return [id, textOf(p.name, ed.lang), textOf(p.title, ed.lang)].some(s => fold(s).includes(q));
    }).sort((a, b) => (a[1].show.year ?? 9999) - (b[1].show.year ?? 9999) || textOf(a[1].name, ed.lang).localeCompare(textOf(b[1].name, ed.lang)));
    const total = Object.keys(ed.doc.people).length;
    this.count.textContent = rows.length === total ? `${total} people` : `${rows.length} of ${total} people`;
    const shown = rows.slice(0, 400);
    render(this.list, ...shown.map(([id, p]) => h("li", { class: id === ed.selected ? "on" : "" },
      h("button", { type: "button", onclick: () => { ed.select(id); this.fly(id); } },
        h("span", {}, textOf(p.name, ed.lang) || id),
        h("small", {}, [textOf(p.title, ed.lang), p.show.year ?? ""].filter(Boolean).join(" · "))))),
      rows.length > shown.length ? h("li", { class: "more" }, `${rows.length - shown.length} more: narrow the search`) : null);
  }
}

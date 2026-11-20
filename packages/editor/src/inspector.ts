// The selected person: their fields, their relationships, and the actions on them. Every change is an
// operation (@crownline/ops), so it can be undone.
import { addChild, addNote, addParent, addPerson, addSpouse, clearAdjustment, deleteDescent, deleteNote, deletePerson, deleteUnion, findAdjustment, NOTE_WIDTHS, put, setAdjustment, setField, setText, type NewPerson, type Op } from "@crownline/ops";
import type { ChartDoc } from "@crownline/schema";
import { assetBase, plainPath } from "@crownline/engine";
import { importEmblem, importPortrait } from "./assets.ts";
import { askPerson, choose, confirm, modal } from "./dialog.ts";
import { h, render, textOf } from "./dom.ts";
import type { Editor } from "./editor.ts";

const BOXES: [string, string][] = [
  ["ruler", "Ruler (portrait, crown)"], ["heir", "Heir (portrait)"], ["minor", "Royal, did not reign"],
  ["neutral", "Public figure"], ["text", "Spouse (name only)"], ["legend", "Legendary ancestor"],
];
const SIDES: [string, string][] = [["r", "Right"], ["l", "Left"], ["b", "Below"], ["t", "Above"]];
const LINES: [string, string][] = [["solid", "Solid"], ["dot", "Dotted"], ["grey", "Grey"], ["legend", "Legend"], ["adopt", "Adoption (long dashes)"]];

export interface InspectorHooks {
  fly: (id: string) => void;
  connect: (from: string) => void;
}

export class Inspector {
  readonly el = h("section", { class: "inspector", "aria-label": "Selected person" });

  constructor(private readonly ed: Editor, private readonly hooks: InspectorHooks) {
    ed.on(what => { if (what !== "result" || !this.el.contains(document.activeElement)) this.render(); });
    this.render();
  }

  private name(id: string): string {
    return textOf(this.ed.doc.people[id]?.name, this.ed.lang) || id;
  }

  private shownId: string | null = null;

  render(): void {
    const ed = this.ed, doc = ed.doc, id = ed.selected, p = id ? doc.people[id] : null;
    if (id !== this.shownId) { this.shownId = id; this.el.parentElement?.scrollTo(0, 0); }
    if (!id || !p) {
      render(this.el, h("p", { class: "empty" }, "Select a person on the chart or in the list."),
        h("p", { class: "hint" }, "Alt-drag from one card to another to connect two people."),
        h("button", { onclick: () => this.addLoose() }, "Add a person"));
      return;
    }
    const base = ["people", id];
    const run = (op: Op, key?: string) => ed.run(op, key);
    const field = (label: string, key: string, input: HTMLElement, hint?: string) =>
      h("label", { class: "field" }, h("span", {}, label), input, hint ? h("small", {}, hint) : null);
    const text = (label: string, path: string[], opts: { hint?: string; area?: boolean } = {}) => {
      const k = `${id}:${path.join(".")}`, v = textOf(path.reduce<any>((o, x) => o?.[x], p), ed.lang);
      const input = opts.area ? h("textarea", { "data-key": k, rows: 3 }) : h("input", { type: "text", "data-key": k, value: v });
      if (opts.area) (input as HTMLTextAreaElement).value = v;
      input.addEventListener("input", () => run(setText(doc, [...base, ...path], (input as HTMLInputElement).value, ed.lang,
        `Change ${label.toLowerCase()} of ${this.name(id)}`), k));
      return field(label, k, input, opts.hint);
    };
    const select = (label: string, path: string[], options: [string, string][], blank?: string) => {
      const k = `${id}:${path.join(".")}`, cur = path.reduce<any>((o, x) => o?.[x], p) ?? "";
      const sel = h("select", { "data-key": k, onchange: (e: Event) => {
        const v = (e.target as HTMLSelectElement).value;
        run(setField([...base, ...path], v === "" ? undefined : v, `Change ${label.toLowerCase()} of ${this.name(id)}`));
      } }, blank !== undefined ? h("option", { value: "" }, blank) : null,
        ...options.map(([v, l]) => h("option", { value: v, selected: v === cur }, l)));
      return field(label, k, sel);
    };
    const houses: [string, string][] = Object.entries(doc.houses).map(([k, v]) => [k, textOf(v.name, ed.lang)]);
    const beside = p.show.beside;
    const yearKey = `${id}:show.year`;
    const year = h("input", { type: "number", step: 1, "data-key": yearKey, value: p.show.year ?? "", disabled: !!beside });
    year.addEventListener("change", () => {
      const v = year.value === "" ? undefined : Math.round(Number(year.value));
      run(setField([...base, "show", "year"], v, `Change the year of ${this.name(id)}`));
    });

    render(this.el,
      h("header", {},
        h("h2", {}, this.name(id)),
        h("code", { title: "The person's id in the document" }, id),
        h("div", { class: "row" },
          h("button", { onclick: () => this.hooks.fly(id) }, "Show on chart"),
          h("button", { class: "danger", onclick: () => void this.remove(id) }, "Delete"))),
      h("div", { class: "fields" },
        text("Name", ["name"]),
        text("Title", ["title"], { hint: "As printed above the name; each word should be in the glossary." }),
        select("House", ["house"], houses, "(none)"),
        select("Card", ["show", "box"], BOXES),
        field("Year", yearKey, year, beside ? "Drawn beside a partner: their row decides." : "When they began to reign or became notable: their row."),
        text("Line under the name", ["show", "sub"], { hint: "Dates or reign, as printed (r. 1749 – 1788)." }),
        select("Sex", ["sex"], [["m", "Male"], ["f", "Female"], ["u", "Unknown"]], "(not given)"),
        this.besideField(id),
        h("label", { class: "check" }, h("input", { type: "checkbox", checked: !!p.show.hatch, onchange: (e: Event) =>
          run(setField([...base, "show", "hatch"], (e.target as HTMLInputElement).checked || undefined, `Mark ${this.name(id)} as a rival claimant`)) }),
          "Rival or unrecognised claimant (hatched)"),
        text("Biography", ["bio"], { area: true })),
      this.notes(id),
      this.pictures(id),
      this.relations(id),
    );
  }

  private besideField(id: string): HTMLElement {
    const ed = this.ed, doc = ed.doc, p = doc.people[id];
    const partners = Object.values(doc.unions ?? {}).filter(u => u.partners.includes(id)).map(u => u.partners.find(x => x !== id)!);
    const cur = p.show.beside;
    const sel = h("select", { "data-key": `${id}:beside`, onchange: () => {
      const [of, side] = sel.value.split(":");
      ed.run(setField(["people", id, "show", "beside"], of ? { of, side } : undefined, `Place ${this.name(id)} beside a partner`));
    } }, h("option", { value: "" }, "(their own place in the tree)"),
      ...partners.flatMap(q => (["l", "r"] as const).map(s => h("option", { value: `${q}:${s}`, selected: cur?.of === q && cur.side === s },
        `${s === "l" ? "Left" : "Right"} of ${this.name(q)}`))));
    return h("label", { class: "field" }, h("span", {}, "Drawn beside"), sel,
      partners.length ? null : h("small", {}, "Married to no one on the chart."));
  }

  /** the person's notes: the text, how each is shown (in full beside the card, or a letter on it with the text
   *  in the Notes list), its side and width; add and delete. Dragging a note on the chart moves it */
  private notes(id: string): HTMLElement {
    const ed = this.ed, doc = ed.doc;
    const mine = Object.entries(doc.notes ?? {}).filter(([, n]) => n.anchor === id);
    const pick = (k: string, what: string, cur: string, options: [string, string][], set: (v: string) => Op) =>
      h("select", { "aria-label": what, "data-key": `${k}:${what}`, onchange: (e: Event) => ed.run(set((e.target as HTMLSelectElement).value)) },
        ...options.map(([v, l]) => h("option", { value: v, selected: v === cur }, l)));
    const one = ([k, n]: [string, NonNullable<ChartDoc["notes"]>[string]]) => {
      const key = `${k}:text`, area = h("textarea", { "data-key": key, rows: 3, "aria-label": "The note's text" }) as HTMLTextAreaElement;
      area.value = textOf(n.text, ed.lang);
      area.addEventListener("input", () => ed.run(setText(doc, ["notes", k, "text"], area.value, ed.lang, `Change a note on ${this.name(id)}`, true), key));
      const show = ["notes", k, "show"];
      return h("li", { class: "note" }, area,
        h("div", { class: "row wrap" },
          pick(k, "Shown", n.show.inline ? "inline" : "letter", [["inline", "In full beside the card"], ["letter", "As a letter (text in the Notes list)"]],
            v => setField([...show, "inline"], v === "inline" ? true : undefined, v === "inline" ? "Show a note in full" : "Show a note as a letter")),
          pick(k, "Side", n.show.side, SIDES, v => setField([...show, "side"], v, "Move a note to another side")),
          pick(k, "Width", String(n.show.width), [...new Set([...NOTE_WIDTHS, n.show.width])].map(w => [String(w), `${w} px`]),
            v => setField([...show, "width"], Number(v), "Change a note's width")),
          h("button", { class: "x", title: "Delete this note", "aria-label": "Delete this note", onclick: () => ed.run(deleteNote(doc, k)) }, "×")));
    };
    return h("div", { class: "notes" },
      h("h3", {}, "Notes"),
      mine.length ? h("ul", {}, ...mine.map(one)) : h("p", { class: "hint" }, "None. Drag a note on the chart to move it."),
      this.markerControl(id),
      h("button", { type: "button", onclick: () => void this.addNoteTo(id) }, "Add a note"));
  }

  private async addNoteTo(id: string): Promise<void> {
    const text = await modal<string>(done => {
      const area = h("textarea", { rows: 4, required: true, "aria-label": "The note's text", placeholder: "What the sources say, and when" }) as HTMLTextAreaElement;
      const form = h("form", { method: "dialog", onsubmit: (e: Event) => { e.preventDefault(); if (area.value.trim()) done(area.value.trim()); } },
        h("label", {}, "Text", area),
        h("small", {}, "Shown in full to the right of the card, 240 px wide; change that under Notes."),
        h("div", { class: "row end" }, h("button", { type: "button", onclick: () => done(null) }, "Cancel"),
          h("button", { class: "primary", type: "submit" }, "Add")));
      queueMicrotask(() => area.focus());
      return [form];
    }, `A note on ${this.name(id)}`);
    if (text) this.ed.run(addNote(this.ed.doc, id, { text, inline: true }));
  }

  /** the person's portrait (import, crop and credit; or remove) and, for the first of a house, its emblem */
  private pictures(id: string): HTMLElement {
    const ed = this.ed, doc = ed.doc, p = doc.people[id], m = p.portrait ? doc.media?.[p.portrait] : undefined;
    const fail = (err: unknown) => void choose("Could not import", (err as Error).message, [["ok", "OK"]]);
    const src = m ? plainPath(`${assetBase(doc, ed.chartPath)}/${m.file}`) : null;
    const header = doc.display?.headers?.[id] as { emblem?: string; name?: string } | undefined;
    const em = header?.emblem ? doc.media?.[header.emblem] : undefined;
    const emSrc = em ? plainPath(`${assetBase(doc, ed.chartPath)}/${em.file}`) : null;
    // the store gives the URL (a blob for a folder opened in the browser)
    const thumb = (path: string, cls: string) => { const i = h("img", { alt: "", class: cls }) as HTMLImageElement;
      void ed.store.url(path).then(u => { i.src = u.startsWith("/") ? `${u}?v=${Date.now() >> 12}` : u; }); return i; };
    const shows = ["ruler", "heir"].includes(p.show.box);
    return h("div", { class: "pictures" },
      h("h3", {}, "Portrait"),
      h("div", { class: "row" },
        src ? thumb(src, "thumb") : h("div", { class: "thumb none" }, "none"),
        h("div", { class: "grow" },
          m?.credit ? h("small", {}, [m.credit.title, m.credit.author, m.credit.licence].filter(Boolean).join(" · ")) : null,
          shows ? null : h("small", {}, "Only ruler and heir cards show a portrait."),
          h("div", { class: "row wrap" },
            h("button", { type: "button", onclick: () => importPortrait(ed, id).catch(fail) }, m ? "Replace…" : "Import…"),
            m ? h("button", { type: "button", class: "danger", onclick: () => ed.run({ label: "Remove a portrait", patch: [
              { op: "del", path: ["people", id, "portrait"] }, { op: "del", path: ["media", p.portrait!] }] }) }, "Remove") : null))),
      header ? h("h3", {}, "House header emblem") : null,
      header ? h("div", { class: "row" },
        emSrc ? thumb(emSrc, "thumb checker") : h("div", { class: "thumb none" }, "none"),
        h("div", { class: "grow row wrap" },
          h("button", { type: "button", onclick: () => importEmblem(ed, id).catch(fail) }, em ? "Replace…" : "Import…"),
          em ? h("button", { type: "button", class: "danger", onclick: () => ed.run({ label: "Remove an emblem", patch: [
            { op: "del", path: ["display", "headers", id, "emblem"] }] }) }, "Remove") : null)) : null);
  }

  /** a line's hand controls (adjustments, each listed with a reason): share the parent's line, the line's
   *  level, where the break mark sits. Never free waypoints: the router keeps choosing the path. */
  private lineControls(k: string): HTMLElement | null {
    const ed = this.ed, doc = ed.doc, d = doc.descents?.[k];
    // (the check allows them only on a line from one parent: a couple's line is placed from the couple)
    if (!d || !d.parent || d.show?.hop || d.show?.branch || d.show?.row) return null;
    // a line's level belongs to its first descent: the one the parent's line to these children starts from
    const first = Object.entries(doc.descents ?? {}).find(([, o]) => o.parent === d.parent && o.union === d.union
      && !o.show?.hop && !o.show?.branch && !o.show?.row)?.[0] ?? k;
    const share = findAdjustment(doc, "shareBus", k);
    const drop = findAdjustment(doc, "drop", first)?.[1] as { drop: number } | undefined;
    const brk = findAdjustment(doc, "breakAt", k)?.[1] as { at: number } | undefined;
    const level = h("input", { type: "number", step: 2, min: 8, placeholder: "auto", value: drop?.drop ?? "", "aria-label": "Line level", "data-key": `${k}:drop` });
    level.addEventListener("change", () => {
      const v = level.value === "" ? null : Math.round(Number(level.value));
      ed.run(v === null ? clearAdjustment(doc, "drop", first, "Line level back to automatic")
        : setAdjustment(doc, "drop", first, { drop: v }, undefined, "Set a line's level"));
    });
    const at = h("input", { type: "range", min: 0, max: 1, step: 0.05, value: brk?.at ?? 0.5, "aria-label": "Break mark position", "data-key": `${k}:brk` });
    at.addEventListener("change", () => ed.run(setAdjustment(doc, "breakAt", k, { at: Number(at.value) }, undefined, "Move a break mark"), `${k}:brk`));
    return h("li", { class: "linectl" }, h("details", { open: !!(share || drop || brk) },
      h("summary", {}, "Line controls"),
      h("label", { class: "check" }, h("input", { type: "checkbox", checked: !!share, onchange: (e: Event) => ed.run((e.target as HTMLInputElement).checked
        ? setAdjustment(doc, "shareBus", k, {}, undefined, "Share the parent's line") : clearAdjustment(doc, "shareBus", k, "Stop sharing the parent's line")) }),
        "Hangs off the parent's existing line"),
      h("label", { class: "inline" }, "Level below the parent (px)", level),
      d.generations ? h("label", { class: "inline" }, "Break mark along the line", at) : null,
      h("small", {}, "Each is an adjustment: see the Adjusted tab to give a reason.")));
  }

  /** the note letter's corner (only for someone with lettered notes) */
  private markerControl(id: string): HTMLElement | null {
    const ed = this.ed, notes = ed.result.layout?.people[id]?.notes ?? [];
    if (!notes.some(n => n.letter)) return null;
    const top = findAdjustment(ed.doc, "markerTop", id);
    return h("label", { class: "check" }, h("input", { type: "checkbox", checked: !!top, onchange: (e: Event) => ed.run((e.target as HTMLInputElement).checked
      ? setAdjustment(ed.doc, "markerTop", id, {}, undefined, "Note letter to the top") : clearAdjustment(ed.doc, "markerTop", id, "Note letter back to the bottom")) }),
      "Note letter at the top right of the card");
  }

  private relations(id: string): HTMLElement {
    const ed = this.ed, doc = ed.doc;
    const unions = Object.entries(doc.unions ?? {}).filter(([, u]) => u.partners.includes(id));
    const uids = new Set(unions.map(([k]) => k));
    const descents = Object.entries(doc.descents ?? {});
    const into = descents.filter(([, d]) => d.child === id);
    const out = descents.filter(([, d]) => d.parent === id || (d.union && uids.has(d.union) && !d.parent));
    const from = (d: NonNullable<ChartDoc["descents"]>[string]) => d.union
      ? (doc.unions?.[d.union]?.partners ?? []).map(x => this.name(x)).join(" & ") + (d.parent ? ` (drawn from ${this.name(d.parent)})` : "")
      : this.name(d.parent!);
    const lineSel = (k: string, cur: string | undefined) => h("select", { "aria-label": "Line style", onchange: (e: Event) => {
      const v = (e.target as HTMLSelectElement).value;
      ed.run({ label: "Change a line's style", patch: [put(["descents", k, "show", "line"], v === "solid" ? undefined : v)] });
    } }, ...LINES.map(([v, l]) => h("option", { value: v, selected: (cur ?? "solid") === v }, l)));
    // a marriage line takes the incoming spouse's birth-house colour; none is grey (a spouse from outside the courts)
    const marriageColour = (k: string, cur: string | undefined) => h("select", { "aria-label": "Marriage line colour", title: "The marriage line's colour: the incoming spouse's birth house", onchange: (e: Event) => {
      const v = (e.target as HTMLSelectElement).value;
      ed.run({ label: "Change a marriage line's colour", patch: [put(["unions", k, "show", "colour"], v || undefined)] });
    } }, h("option", { value: "" }, "Grey line"),
      ...Object.entries(doc.houses).map(([hk, hv]) => h("option", { value: hk, selected: cur === hk }, `${textOf(hv.name, ed.lang)} line`)));
    const item = (label: HTMLElement | string, go: string | null, extra: HTMLElement | null, onRemove: () => void, what: string) =>
      h("li", {}, go ? h("a", { href: "#", onclick: (e: Event) => { e.preventDefault(); ed.select(go); this.hooks.fly(go); } }, label) : label,
        extra, h("button", { class: "x", title: `Remove ${what}`, "aria-label": `Remove ${what}`, onclick: onRemove }, "×"));
    return h("div", { class: "relations" },
      h("h3", {}, "Parents"),
      into.length ? h("ul", {}, ...into.flatMap(([k, d]) => [item(from(d), d.parent ?? doc.unions?.[d.union!]?.partners[0] ?? null,
        lineSel(k, d.show?.line), () => ed.run(deleteDescent(doc, k)), "this line"), this.lineControls(k)])) : h("p", { class: "hint" }, "No line comes into them."),
      h("h3", {}, "Spouses"),
      unions.length ? h("ul", {}, ...unions.map(([k, u]) => { const q = u.partners.find(x => x !== id)!;
        return item(this.name(q), q, marriageColour(k, u.show?.colour), () => ed.run(deleteUnion(doc, k)), "this marriage"); }))
        : h("p", { class: "hint" }, "None on the chart."),
      h("h3", {}, "Children"),
      out.length ? h("ul", {}, ...out.map(([k, d]) => item(this.name(d.child), d.child, lineSel(k, d.show?.line),
        () => ed.run(deleteDescent(doc, k)), "this line"))) : h("p", { class: "hint" }, "None on the chart."),
      h("div", { class: "row wrap" },
        h("button", { onclick: () => void this.add("child", id) }, "Add child"),
        h("button", { onclick: () => void this.add("spouse", id) }, "Add spouse"),
        into.length ? null : h("button", { onclick: () => void this.add("parent", id) }, "Add parent"),
        h("button", { onclick: () => this.hooks.connect(id), title: "Then click the other person (or Alt-drag between cards)" }, "Connect to…")));
  }

  private async add(kind: "child" | "spouse" | "parent", id: string): Promise<void> {
    const ed = this.ed, doc = ed.doc, who = this.name(id);
    let op: Op | null = null;
    if (kind === "child") {
      const unions = Object.entries(doc.unions ?? {}).filter(([, u]) => u.partners.includes(id));
      const a = await askPerson(`A child of ${who}`, unions.length ? { label: "Their other parent", options: [
        ...unions.map(([k, u]) => [k, `${this.name(u.partners.find(x => x !== id)!)} (the line comes down from the couple)`] as [string, string]),
        ["", `None shown (the line comes from ${who})`]] } : undefined);
      if (a) op = addChild(doc, id, { name: a.name }, a.choice || undefined);
    } else if (kind === "spouse") {
      const a = await askPerson(`A spouse of ${who}`, { label: "Drawn", options: [["r", `Right of ${who}`], ["l", `Left of ${who}`]] });
      if (a) op = addSpouse(doc, id, { name: a.name }, a.choice as "l" | "r");
    } else {
      const a = await askPerson(`A parent of ${who}`);
      if (a) op = addParent(doc, id, { name: a.name });
    }
    if (!op) return;
    ed.run(op);
    ed.select(op.id ?? null);
    if (op.id) this.hooks.fly(op.id);
  }

  private async addLoose(): Promise<void> {
    const a = await askPerson("A new person", { label: "Card", options: BOXES });
    if (!a) return;
    const op = addPerson(this.ed.doc, { name: a.name, box: a.choice as NewPerson["box"] });
    this.ed.run(op);
    this.ed.select(op.id ?? null);
    if (op.id) this.hooks.fly(op.id);
  }

  async remove(id: string): Promise<void> {
    const op = deletePerson(this.ed.doc, id);
    const ok = await confirm(`Delete ${this.name(id)}?`, [
      ...(op.notes?.length ? [`This also removes ${op.notes.filter(n => !n.includes(" left with ")).join(", ") || "nothing else"}.`,
        ...op.notes.filter(n => n.includes(" left with ")).map(n => n[0].toUpperCase() + n.slice(1) + ".")] : ["Nothing else names them."]),
      "You can undo this (Ctrl+Z)."], "Delete");
    if (ok) { this.ed.run(op); this.ed.select(null); }
  }
}

// A chart from nothing (PLAN 7f): a name, a first house and its first person. The rest is added in the editor.
import { FORMAT, type ChartDoc } from "@crownline/schema";
import { newId } from "@crownline/ops";
import { modal } from "./dialog.ts";
import { h } from "./dom.ts";
import type { ChartEntry, Store } from "./store.ts";

export interface NewChart { id: string; title: string; house: string; colour: string; person: string; year: number }

/** the chart's id from its title: lowercase words joined by - (its folder's name) */
export const slug = (t: string): string => t.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase()
  .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").replace(/^(?=[0-9])/, "c-") || "chart";

/** the document: one house, one ruler, the open fonts, the house style's colours and sizes */
export function newChartDoc(c: NewChart): ChartDoc {
  const doc = { format: FORMAT, meta: { id: c.id, title: c.title, asOf: { edtf: String(new Date().getFullYear()) }, languages: ["en"],
      defaultLang: "en", assetRoot: "../.." },
    people: {}, houses: {}, descents: {}, unions: {},
    panels: { header: { x: 140, y: 130, width: 800, height: 1050, arrange: "column" } },
    theme: {
      palette: { background: "#EDE8D8", band: "#E6E0CD", ink: "#1F1F1F", noteInk: "#3A372F", muted: "#5E5848", faint: "#857D68",
        neutral: "#D5D1C3", greyLine: "#C2BBA8" },
      type: { title: 14, name: 21, reign: 15, name2: 17, sub2: 14, note: 17, cap: 15, small: 14 },
      fonts: { sans: "gantari", script: "felipa" },
    },
  } as unknown as ChartDoc;
  const hid = newId(doc, c.house);
  doc.houses[hid] = { name: c.house, colour: c.colour };
  const pid = newId(doc, c.person);
  doc.people[pid] = { name: c.person, house: hid, show: { box: "ruler", year: c.year } } as ChartDoc["people"][string];
  return doc;
}

/** ask for the new chart; write it; its path, or null */
export async function newChart(store: Store, taken: ChartEntry[]): Promise<string | null> {
  const c = await modal<NewChart>(done => {
    const title = h("input", { type: "text", required: true, placeholder: "The House of …" });
    const id = h("input", { type: "text", required: true, pattern: "[a-z][a-z0-9]*(-[a-z0-9]+)*" });
    const house = h("input", { type: "text", required: true, placeholder: "House name" });
    const colour = h("input", { type: "color", value: "#C9A227" });
    const person = h("input", { type: "text", required: true, placeholder: "Name as printed" });
    const year = h("input", { type: "number", required: true, step: 1, value: 1600 });
    const msg = h("p", { class: "warn" });
    let typed = false;
    id.addEventListener("input", () => { typed = true; });
    title.addEventListener("input", () => { if (!typed) id.value = slug(title.value); });
    const form = h("form", { method: "dialog", onsubmit: (e: Event) => {
      e.preventDefault();
      const v = { id: id.value.trim(), title: title.value.trim(), house: house.value.trim(), colour: colour.value.toUpperCase(),
        person: person.value.trim(), year: Math.round(Number(year.value)) };
      if (taken.some(t => t.id === v.id || t.path === `charts/${v.id}/chart.json`)) { msg.textContent = `There is already a chart called ${v.id}.`; return; }
      if (!/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(v.id)) { msg.textContent = "The id is lowercase words joined by -, starting with a letter."; return; }
      done(v);
    } },
      h("label", {}, "Title", title),
      h("label", {}, "Id (the folder's name)", id),
      h("label", {}, "The first house", house),
      h("label", {}, "Its colour", colour),
      h("label", {}, "Its first ruler", person),
      h("label", {}, "Where on the time axis (a year in their reign)", year),
      msg,
      h("div", { class: "row end" }, h("button", { type: "button", onclick: () => done(null) }, "Cancel"),
        h("button", { class: "primary", type: "submit" }, "Make the chart")));
    return [form];
  }, "A new chart");
  if (!c) return null;
  const path = `charts/${c.id}/chart.json`;
  await store.write(path, JSON.stringify(newChartDoc(c), null, 2) + "\n");
  return path;
}

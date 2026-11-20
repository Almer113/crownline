// What a library card says about a chart: its title and subtitle, how many people, the years it covers, its
// houses' colours, and a small picture of the chart drawn from its kept layout (every card and note where the
// lock has it, coloured by house), so the library needs no built image.
import type { Store } from "@crownline/editor/store";
import { textOf } from "@crownline/editor/dom";

export interface Summary {
  title: string;
  subtitle: string;
  people: number;
  years: [number, number] | null;
  houses: { name: string; colour: string }[];
  /** the picture, or null for a chart without a kept layout */
  picture: SVGSVGElement | null;
}

/** a person with no house: grey, as the chart draws them */
const NO_HOUSE = "#B9B3A3";

interface Doc {
  meta?: { title?: unknown; subtitle?: unknown; defaultLang?: string };
  people?: Record<string, { house?: string; show?: { year?: number; box?: string } }>;
  houses?: Record<string, { name?: unknown; colour?: string }>;
}
interface Lock { canvas?: [number, number]; boxes?: Record<string, number[]>; notes?: Record<string, number[]>; headers?: Record<string, number[]> }

const SVG = "http://www.w3.org/2000/svg";
/** a subtitle as plain text (the documents allow a line break written as <br>) */
const plain = (s: string) => s.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();

export async function summarise(store: Store, chartPath: string): Promise<Summary> {
  const doc = JSON.parse(await (await store.read(chartPath)).text()) as Doc;
  let lock: Lock | null = null;
  try { lock = JSON.parse(await (await store.read(chartPath.replace(/chart\.json$/, "layout.lock.json"))).text()) as Lock; }
  catch { lock = null; }                                  // no kept layout
  const lang = doc.meta?.defaultLang ?? "en";
  const people = doc.people ?? {}, houses = doc.houses ?? {};
  const years = Object.values(people).map(p => p.show?.year).filter((y): y is number => typeof y === "number");
  const colourOf = (id: string) => houses[people[id]?.house ?? ""]?.colour ?? NO_HOUSE;
  return {
    title: textOf(doc.meta?.title, lang) || chartPath,
    subtitle: plain(textOf(doc.meta?.subtitle, lang)),
    people: Object.keys(people).length,
    years: years.length ? [Math.min(...years), Math.max(...years)] : null,
    houses: Object.values(houses).map(h => ({ name: textOf(h.name, lang), colour: h.colour ?? NO_HOUSE })),
    picture: lock?.canvas && lock.boxes ? picture(lock, colourOf) : null,
  };
}

function picture(lock: Lock, colourOf: (id: string) => string): SVGSVGElement {
  const [W, H] = lock.canvas!;
  const svg = document.createElementNS(SVG, "svg");
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  svg.setAttribute("aria-hidden", "true");
  const rect = (r: number[], fill: string, opacity = 1) => {
    const [l, t, rr, b] = r;
    if (![l, t, rr, b].every(Number.isFinite)) return;
    const el = document.createElementNS(SVG, "rect");
    el.setAttribute("x", String(l)); el.setAttribute("y", String(t));
    el.setAttribute("width", String(Math.max(rr - l, 1))); el.setAttribute("height", String(Math.max(b - t, 1)));
    el.setAttribute("rx", "8"); el.setAttribute("fill", fill);
    if (opacity < 1) el.setAttribute("opacity", String(opacity));
    svg.append(el);
  };
  for (const r of Object.values(lock.notes ?? {})) rect(r, "#FBFAF6", 0.8);
  for (const [id, r] of Object.entries(lock.headers ?? {})) rect(r, colourOf(id), 0.6);
  for (const [id, r] of Object.entries(lock.boxes ?? {})) rect(r, colourOf(id));
  return svg;
}

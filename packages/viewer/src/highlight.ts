// Highlighting (PLAN Phase 3, items 2, 3, 5, 6): a set of people stays lit and the rest of the chart sinks
// behind a veil in the paper colour. Lineage, a relationship path, filters, the time slider and tour steps all
// produce such a set. The chart itself is not touched: the lit cards, crowns, letter markers and line paths
// are cloned above the veil, so they look exactly as drawn (dashes, colours, gaps at crossings). The layer and
// its clones take no pointer events, so clicks and hovers reach the original cards underneath.
// A second, lighter layer marks a hovered line and the people it joins, without a veil.
import type { Layout, Line, Person } from "./layout";

export interface HighlightStyle { veil: string }
export const STYLES: Record<string, HighlightStyle> = {
  strong: { veil: "rgba(237, 232, 216, 0.82)" },
  soft: { veil: "rgba(237, 232, 216, 0.6)" },
};

/** the people lit for `id`: itself, its spouses, every ancestor and every descendant */
export function lineage(layout: Layout, id: string): Set<string> {
  const lit = new Set([id]);
  const walk = (start: string, dir: "parents" | "children") => {
    const todo = [start];
    while (todo.length) {
      const k = todo.pop()!;
      for (const r of layout.people[k]?.family?.[dir] ?? []) if (!r.via && !lit.has(r.id)) { lit.add(r.id); todo.push(r.id); }
    }
  };
  walk(id, "parents");
  walk(id, "children");
  for (const r of layout.people[id]?.family?.spouses ?? []) lit.add(r.id);
  return lit;
}

/** a line stays lit when it joins lit people: a parent (or couple) to a lit child, or a lit couple */
export function litLine(l: Line, lit: Set<string>): boolean {
  if (l.style === "legend" && !lit.has(l.to[0])) return false;
  const from = l.from.filter(k => lit.has(k)).length, to = l.to.filter(k => lit.has(k)).length;
  return from > 0 && (to > 0 || (from === l.from.length && l.from.length > 1));
}

const SVGNS = "http://www.w3.org/2000/svg";

export class Highlight {
  private readonly layer: HTMLDivElement;
  private readonly veil: HTMLDivElement;
  private readonly cards: HTMLDivElement;
  private readonly svg: SVGSVGElement;
  private readonly hover: HTMLDivElement;
  private readonly hoverSvg: SVGSVGElement;
  lit: Set<string> | null = null;
  /** original portrait -> its copy above the veil, so the copy sharpens when the original does */
  private pics = new Map<HTMLImageElement, HTMLImageElement>();
  private key = "";

  constructor(private readonly chart: HTMLElement, private readonly layout: Layout, style = STYLES.strong) {
    const [W, H] = layout.canvas;
    const sheet = (cls: string) => {
      const d = document.createElement("div");
      d.className = cls;
      d.style.cssText = `position:absolute;left:0;top:0;width:${W}px;height:${H}px;pointer-events:none;display:none`;
      return d;
    };
    const svg = () => {
      const s = document.createElementNS(SVGNS, "svg");
      s.setAttribute("class", "layer"); s.setAttribute("width", String(W)); s.setAttribute("height", String(H));
      return s;
    };
    this.layer = sheet("cl-highlight");
    this.veil = document.createElement("div");
    this.veil.style.cssText = `position:absolute;inset:0;background:${style.veil}`;
    this.svg = svg();
    this.cards = document.createElement("div");
    this.layer.append(this.veil, this.svg, this.cards);
    this.hover = sheet("cl-highlight cl-hover");
    this.hoverSvg = svg();
    this.hover.append(this.hoverSvg);
    chart.append(this.layer, this.hover);   // inside #chart, so the page's own CSS applies to the clones
    new MutationObserver(recs => {
      for (const r of recs) { const c = this.pics.get(r.target as HTMLImageElement); if (c) c.src = (r.target as HTMLImageElement).src; }
    }).observe(chart, { subtree: true, attributes: true, attributeFilter: ["src"] });
  }

  setStyle(style: HighlightStyle): void { this.veil.style.background = style.veil; }

  /** light `lit` (null: nothing dimmed) and lift `extras` (e.g. a map cell) above the veil too */
  show(lit: Set<string> | null, extras: HTMLElement[] = []): void {
    const key = lit ? [...lit].sort().join(",") + "|" + extras.map(e => e.dataset.stage ?? "x").join(",") : "";
    if (key === this.key) return;            // nothing changed (the time slider asks every frame)
    this.key = key;
    this.svg.replaceChildren(); this.cards.replaceChildren(); this.pics.clear();
    this.lit = lit;
    if (!lit) { this.layer.style.display = "none"; return; }
    const owners = new Set(this.layout.lines.filter(l => litLine(l, lit)).map(l => l.owner));
    for (const p of Array.from(this.chart.querySelectorAll<SVGPathElement>("path[data-owner]")))
      if (!p.closest(".cl-highlight") && owners.has(p.dataset.owner ?? "")) this.svg.appendChild(p.cloneNode(true));
    for (const el of Array.from(this.chart.querySelectorAll<HTMLElement>("[data-id], [data-for]"))) {
      if (el.closest(".cl-highlight")) continue;
      if (!lit.has(el.dataset.id ?? el.dataset.for ?? "")) continue;
      const copy = el.cloneNode(true) as HTMLElement;
      const orig = el.querySelectorAll("img"), dup = copy.querySelectorAll("img");
      orig.forEach((img, i) => this.pics.set(img, dup[i]));
      this.cards.appendChild(copy);
    }
    for (const el of extras) this.cards.appendChild(this.lift(el));
    this.layer.style.display = "";
  }

  /** a copy of `el` placed where it sits on the chart (for elements laid out by their parent, like map cells) */
  private lift(el: HTMLElement): HTMLElement {
    let x = 0, y = 0;
    for (let n: HTMLElement | null = el; n && n !== this.chart; n = n.offsetParent as HTMLElement | null) { x += n.offsetLeft; y += n.offsetTop; }
    const box = document.createElement("div");
    box.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:${el.offsetWidth}px;height:${el.offsetHeight}px;`
      + "background:#EFEBDD;box-shadow:0 0 0 8px #EFEBDD";
    box.appendChild(el.cloneNode(true));
    return box;
  }

  /** mark a hovered line and the people it joins (null clears) */
  hoverLine(owner: string | null): void {
    this.hoverSvg.replaceChildren();
    if (!owner) { this.hover.style.display = "none"; return; }
    for (const p of Array.from(this.chart.querySelectorAll<SVGPathElement>(`path[data-owner="${CSS.escape(owner)}"]`))) {
      if (p.closest(".cl-highlight")) continue;
      const halo = p.cloneNode(true) as SVGPathElement, w = parseFloat(getComputedStyle(p).strokeWidth) || 4;
      // inline styles: the chart's CSS for .ln would override presentation attributes
      Object.assign(halo.style, { stroke: "#FFFFFF", strokeOpacity: "0.95", strokeDasharray: "none", strokeWidth: `${w + 9}px` });
      this.hoverSvg.append(halo, p.cloneNode(true));
    }
    const line = this.layout.lines.find(l => l.owner === owner);
    for (const id of line ? [...line.from, ...line.to] : []) {
      const r = this.layout.people[id]?.rect;
      if (!r) continue;
      const rect = document.createElementNS(SVGNS, "rect");
      Object.entries({ x: r[0] - 6, y: r[1] - 6, width: r[2] - r[0] + 12, height: r[3] - r[1] + 12, rx: 8,
                       fill: "none", stroke: "#1F1F1F", "stroke-width": 3, "stroke-dasharray": "8 5" })
        .forEach(([k, v]) => rect.setAttribute(k, String(v)));
      this.hoverSvg.append(rect);
    }
    this.hover.style.display = "";
  }
}

/** the line under a chart point, within `tol` chart px (for hovering) */
export function lineAt(layout: Layout, x: number, y: number, tol: number): Line | null {
  let best: Line | null = null, bestD = tol;
  for (const l of layout.lines) {
    if (l.style === "legend") continue;
    const pts = l.points;
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1], [bx, by] = pts[i], dx = bx - ax, dy = by - ay;
      const len = dx * dx + dy * dy, t = len ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len)) : 0;
      const d = Math.hypot(x - (ax + t * dx), y - (ay + t * dy));
      if (d < bestD) { bestD = d; best = l; }
    }
  }
  return best;
}

/** the people a line joins, for its tooltip */
export function lineEnds(layout: Layout, l: Line): { a: Person[]; b: Person[] } {
  const ps = (ids: string[]) => ids.map(i => layout.people[i]).filter(Boolean);
  return { a: ps(l.from), b: ps(l.to) };
}

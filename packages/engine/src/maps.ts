// The map panel (panels.map of the chart document; the Python maps.py): a grid of small maps, one per
// stage, with a legend. The document says what each map shows (its view, title, caption, note, the colour
// of each polity, the areas drawn over it, its marks); the shapes come ready merged from the data file
// panels.map.shapes names (tools/map_shapes.py makes it). This only projects and draws them.
//
// A colour is "#RRGGBB", "house:<id>", "house:<id>+0.6" (that house's colour tinted), "palette:<key>", or a
// name from panels.map.colours; "a/b" is diagonal stripes of a over b.
import type { Doc, Env } from "./doc.ts";
import { escape as e, pyFixed } from "./py.ts";
import { tint } from "./render.ts";

export const PAD = 16, GAP = 25;

type LonLat = [number, number];
type View = [number, number, number, number];
type Geom = { type: "Polygon"; coordinates: LonLat[][] } | { type: "MultiPolygon"; coordinates: LonLat[][][] };
interface Shapes { land: Geom; areas: Record<string, { onLand?: Geom; whole?: Geom }>; maps: Record<string, [string, Geom][]> }

/** the panel's size [width, height], or null for a chart without one */
export function mapSize(doc: Doc): [number, number] | null {
  const spec = doc.panels?.map;
  if (!spec) return null;
  const cols = spec.columns ?? 3;
  return [cols * spec.width + (cols - 1) * GAP + 2 * PAD, spec.height];
}

const f1 = (x: number) => pyFixed(x, 1);

/** the map panel's CSS and its HTML at (x, y) */
export function mapPanel(doc: Doc, env: Env, x: number, y: number): { css: string; html: string } {
  const spec = doc.panels!.map!;
  const pal = (doc.theme as any).palette as Record<string, string>;
  const { ink: INK, muted: MUTED, noteInk: NOTE_INK } = pal;
  const HOUSE = Object.fromEntries(Object.entries(doc.houses).map(([h, v]) => [h, (v as any).colour as string]));
  const MAP_W: number = spec.width, COLS: number = spec.columns ?? 3;
  const [PANEL_W, PANEL_H] = mapSize(doc)!;
  const VIEWS = spec.views as Record<string, View>;
  const named: Record<string, string> = spec.colours ?? {};
  const SHAPES = env.readJson(doc.media![spec.shapes].file) as Shapes;

  const colour = (ref: string): string => {
    ref = named[ref] ?? ref;
    if (ref.startsWith("#")) return ref;
    const i = ref.indexOf(":"), kind = ref.slice(0, i), rest = ref.slice(i + 1);
    const j = rest.indexOf("+"), name = j < 0 ? rest : rest.slice(0, j), k = j < 0 ? "" : rest.slice(j + 1);
    const c = kind === "house" ? HOUSE[name] : pal[name];
    if (c === undefined) throw new Error(`panels.map: no colour "${ref}"`);
    return k ? tint(c, Number(k)) : c;
  };
  const fillSpec = (tok: string) => tok.split("/").map(colour).join("/");
  const SEA = colour(named.sea ?? "#F6F3EA"), COAST = colour(named.coast ?? "#A9A08A");

  const proj = (view: View, w: number) => {
    const [lon0, lon1, lat0, lat1] = view, k = w / (lon1 - lon0);
    return { P: (lon: number, lat: number): LonLat => [(lon - lon0) * k, (lat1 - lat) * k], h: (lat1 - lat0) * k };
  };
  const pathD = (geom: Geom, P: (lon: number, lat: number) => LonLat) => {
    const polys = geom.type === "Polygon" ? [geom.coordinates] : geom.coordinates;
    const out: string[] = [];
    for (const poly of polys)
      for (const ring of poly)
        out.push("M" + ring.map(([lon, lat]) => { const [px, py] = P(lon, lat); return `${f1(px)},${f1(py)}`; }).join("L") + "Z");
    return out.join("");
  };
  const fillOf = (s: string, uid: string) => {
    if (!s.includes("/")) return s;
    const [a, b] = s.split("/");
    return `url(#${uid}_${a.slice(1)}_${b.slice(1)})`;
  };
  const pattern = (uid: string, s: string) => {
    const [a, b] = s.split("/");
    return `<pattern id="${uid}_${a.slice(1)}_${b.slice(1)}" width="8" height="8" patternUnits="userSpaceOnUse" `
      + `patternTransform="rotate(45)"><rect width="8" height="8" fill="${b}"/>`
      + `<rect width="4" height="8" fill="${a}"/></pattern>`;
  };
  const label = (x: number, y: number, text: string, where: string) => {
    if (where === "below") return `<text x="${f1(x + 5)}" y="${f1(y + 15)}" class="mlab">${e(text)}</text>`;
    if (where === "left") return `<text x="${f1(x - 6)}" y="${f1(y - 5)}" class="mlab" text-anchor="end">${e(text)}</text>`;
    if (where === "right-below") return `<text x="${f1(x + 6)}" y="${f1(y + 14)}" class="mlab">${e(text)}</text>`;
    return `<text x="${f1(x + 6)}" y="${f1(y - 5)}" class="mlab">${e(text)}</text>`;
  };
  const markSvg = (mk: any, P: (lon: number, lat: number) => LonLat) => {
    const [x, y] = mk.at ? P(mk.at[0], mk.at[1]) : [0, 0];
    if (mk.kind === "place") return `<circle cx="${f1(x)}" cy="${f1(y)}" r="3" fill="${INK}"/>` + label(x, y, mk.label, mk.position ?? "above");
    if (mk.kind === "dot")
      return `<circle cx="${f1(x)}" cy="${f1(y)}" r="${mk.r}" fill="${colour(mk.fill)}" stroke="#FFFFFF" `
        + `stroke-width="${mk.stroke ?? 1}"/>`;
    if (mk.kind === "ring")
      return `<circle cx="${f1(x)}" cy="${f1(y)}" r="11" fill="none" stroke="${INK}" stroke-width="1.4"/>`
        + `<text x="${f1(x - 14)}" y="${f1(y + 26)}" class="mlab">${e(mk.label)}</text>`;
    const v = VIEWS[mk.view];          // frame: the box of a detail view
    const [x0, y0] = P(v[0], v[3]), [x1, y1] = P(v[1], v[2]);
    return `<rect x="${f1(x0)}" y="${f1(y0)}" width="${f1(x1 - x0)}" height="${f1(y1 - y0)}" fill="none" `
      + `stroke="${INK}" stroke-width="1.2" stroke-dasharray="4 3"/>`;
  };
  const mapSvg = (m: any) => {
    const { P, h } = proj(VIEWS[m.view], MAP_W);
    const uid = `m${m.id}`;
    const pats = [...new Set((Object.values(m.fills) as string[]).filter(t => t.includes("/")).map(fillSpec))].sort();
    // one shape per colour, cut to the land; fills go under the coastline, marks above it
    const paths = SHAPES.maps[m.id].map(([tok, geom]) => {
      const fill = fillOf(fillSpec(tok), uid);
      return `<path d="${pathD(geom, P)}" fill="${fill}" stroke="${fill}" stroke-width="0.6"/>`;
    });
    const fills = (m.overlays ?? []).map((ov: any) => {      // parts of regencies, from districts or villages
      const c = colour(ov.fill);
      const geom = SHAPES.areas[ov.area][ov.outline ? "whole" : "onLand"]!;
      const ring = ov.outline ? ' stroke="#FFFFFF" stroke-width="1.6"' : ` stroke="${c}" stroke-width="0.6"`;
      return `<path d="${pathD(geom, P)}" fill="${c}"${ring}/>`;
    });
    const coast = `<path d="${pathD(SHAPES.land, P)}" fill="none" stroke="${COAST}" stroke-width="0.7"/>`;
    const extra = (m.marks ?? []).map((mk: any) => markSvg(mk, P));
    const defs = pats.map(s => pattern(uid, s)).join("");
    const clip = `<clipPath id="${uid}_frame"><rect width="${MAP_W}" height="${f1(h)}"/></clipPath>`;
    return `<svg width="${MAP_W}" height="${pyFixed(h, 0)}" viewBox="0 0 ${MAP_W} ${f1(h)}" class="map">`
      + `<defs>${defs}${clip}</defs><rect width="${MAP_W}" height="${f1(h)}" fill="${SEA}"/>`
      + `<g clip-path="url(#${uid}_frame)">${paths.join("")}${fills.join("")}${coast}`
      + `${extra.join("")}</g></svg>`;
  };
  const legendHtml = () => {
    const sw = (fill: string) => {
      if (fill.includes("/")) {
        const [a, b] = fill.split("/");
        fill = `repeating-linear-gradient(135deg, ${a} 0 4px, ${b} 4px 8px)`;
      }
      return `<span class="msw" style="background:${fill}"></span>`;
    };
    const dot = (c: string) => `<span class="msw" style="background:none;display:inline-flex;align-items:center;`
      + `justify-content:center"><svg width="12" height="12"><circle cx="6" cy="6" r="4.5" fill="${c}" `
      + `stroke="#fff" stroke-width="1.2"/></svg></span>`;
    const items = (spec.legend ?? []).map(it => ["dot" in it ? dot(colour(it.dot)) : sw(fillSpec(it.fill)), it.label]);
    return '<div class="mleg">' + items.map(([s, t]: string[]) => `<span class="mli">${s}${e(t)}</span>`).join("") + "</div>";
  };

  const cells = spec.maps.map(m => {
    const extra = m.note ? `<div class="mnote">${m.note}</div>` : "";     // markup, like the other notes
    return `<div class="mcell" data-stage="${m.id}"><div class="mt">${e(m.title)}</div>${mapSvg(m)}`
      + `<div class="mc">${e(m.caption)}</div>${extra}</div>`;
  });
  const html = `<div class="mpanel" style="left:${x}px;top:${f1(y)}px;width:${PANEL_W}px;height:${PANEL_H}px">`
    + `<div class="mh">${e(spec.title)}</div><div class="mgrid">${cells.join("")}</div>`
    + `${legendHtml()}</div>`;
  const css = `
.mpanel { position: absolute; background: #EFEBDD; border: 1px solid #CFC8B3; padding: ${PAD}px; }
.mh { font-weight: 700; font-size: 15px; letter-spacing: 1.4px; text-transform: uppercase; margin-bottom: 10px; }
.mgrid { display: grid; grid-template-columns: repeat(${COLS}, ${MAP_W}px); column-gap: ${GAP}px; row-gap: 14px; }
.mt { font-weight: 700; font-size: 16px; margin-bottom: 5px; }
.mc { font-size: 15px; line-height: 1.3; color: ${NOTE_INK}; margin-top: 5px; }
.map { display: block; }
.mlab { font: 700 13px 'AHG'; fill: ${INK}; paint-order: stroke; stroke: #FFFFFF; stroke-width: 3px; }
.mleg { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px 14px; margin-top: 12px; font-size: 14px;
  line-height: 1.15; }
.mli { display: inline-flex; align-items: center; gap: 6px; }
.msw { display: inline-block; width: 20px; height: 13px; flex: none; }
.mnote { font-size: 14px; line-height: 1.35; color: ${MUTED}; margin-top: 8px; }
`;
  return { css, html };
}

// The renderer (PLAN Phase 5, step 11; the drawing and page assembly of the Python build.py): the finished
// layout as one HTML page with SVG layers, the same to the character as the Python engine's. The page
// references its fonts, portraits and emblems by path (as the build does); PNG and PDF are made from it.
// A chart's map panel is drawn from panels.map and its shapes file (maps.ts).
import { type Box, dispTitle, left, right } from "./boxes.ts";
import { type Doc, type Env, privateMedia, text } from "./doc.ts";
import type { Composed } from "./compose.ts";
import { type Note, type Rect } from "./columns.ts";
import { GUTTER } from "./canvas.ts";
import { check, issue, type Issue, type Report } from "./checks.ts";
import { sourcesText, succession, titleScript } from "./content.ts";
import { crossings, type Patch } from "./crossings.ts";
import { BAND_YEARS, type Labels, placeLabels } from "./labels.ts";
import { escape as e, pyFixed, pyLen } from "./py.ts";
import { CORNER, LINE, pyRound, route, type Routing, type Seg } from "./routing.ts";
import { P } from "./boxes.ts";
import { mapPanel as drawMap } from "./maps.ts";


export interface Page {
  html: string;
  routing: Routing;
  patches: Patch[];
  labels: Labels;
  /** the historicity scale's label rects */
  hist: Rect[];
  report: Report;
  /** the line segments in drawing order (later ones on top) */
  lines: Seg[];
  /** the lettered notes in letter order (top to bottom, then left to right) */
  lettered: Note[];
}

const f1 = (v: number) => pyFixed(v, 1), f0 = (v: number) => pyFixed(v, 0);
/** str(float) in Python: an integral float keeps its ".0" */
const pyFloat = (v: number) => (Number.isInteger(v) ? `${v}.0` : String(v));
const top = (b: Box) => b.cy! - b.h / 2;
const bottom = (b: Box) => b.cy! + b.h / 2;
const range = (a: number, b: number, step: number) => { const o: number[] = []; for (let v = a; v < b; v += step) o.push(v); return o; };

export function tint(hex: string, k = 0.55): string {
  const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  return "#" + c.map(v => pyRound(v + (255 - v) * k).toString(16).toUpperCase().padStart(2, "0")).join("");
}
export const hatch = (c: string) => `repeating-linear-gradient(135deg, ${c} 0 9px, ${tint(c, 0.6)} 9px 15px)`;

const SILHOUETTE = '<svg viewBox="0 0 88 88" width="100%" height="100%"><rect width="88" height="88" fill="#DDD8C9"/>'
  + '<circle cx="44" cy="34" r="16" fill="#B8B2A2"/>'
  + '<path d="M14 88 C14 64 28 56 44 56 C60 56 74 64 74 88 Z" fill="#B8B2A2"/></svg>';
const CROWN_SVG = (c: string) => `<svg width="26" height="19" viewBox="0 0 22 16"><path d="M2 14 L1 3 L6.5 8 L11 1 L15.5 8 L21 3 `
  + `L20 14 Z" fill="${c}" stroke="#7A5A1E" stroke-width="1.2" stroke-linejoin="round"/></svg>`;
const LOGO_W = 320;      // licence badge and logo at the right of the footer
const TOL = 0.5;

/** a, b, … z, then aa, ab, … (never more than two letters) */
export function letter(i: number): string {
  const ab = "abcdefghijklmnopqrstuvwxyz";
  return i < 26 ? ab[i] : ab[Math.floor((i - 26) / 26)] + ab[(i - 26) % 26];
}

const sgn = (v: number) => (Math.abs(v) < TOL ? 0 : v > 0 ? 1 : -1);

/** a polyline with rounded elbows */
export function roundedPath(pts: [number, number][], r = CORNER): string {
  let d = `M${f1(pts[0][0])},${f1(pts[0][1])}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
    const l1 = Math.abs(x1 - x0) + Math.abs(y1 - y0), l2 = Math.abs(x2 - x1) + Math.abs(y2 - y1);
    const rr = Math.min(r, l1 / 2, l2 / 2);
    if (rr < 1 || (Math.abs(x0 - x1) < TOL && Math.abs(x1 - x2) < TOL) || (Math.abs(y0 - y1) < TOL && Math.abs(y1 - y2) < TOL)) {
      d += ` L${f1(x1)},${f1(y1)}`;
      continue;
    }
    const ax = x1 - rr * sgn(x1 - x0), ay = y1 - rr * sgn(y1 - y0), bx = x1 + rr * sgn(x2 - x1), by = y1 + rr * sgn(y2 - y1);
    d += ` L${f1(ax)},${f1(ay)} Q${f1(x1)},${f1(y1)} ${f1(bx)},${f1(by)}`;
  }
  return d + ` L${f1(pts[pts.length - 1][0])},${f1(pts[pts.length - 1][1])}`;
}

export function render(doc: Doc, env: Env, c: Composed): Page {
  const { boxes, ties, tables: t, geometry: g, axis, rows, canvas } = c;
  const N = (id: string) => boxes.get(id)!, Y = axis.Y, ns = [...boxes.values()];
  const FS = doc.theme.type as Record<string, number>;
  const pal = (doc.theme as any).palette as Record<string, string>;
  const { background: BG, band: BAND, ink: INK, noteInk: NOTE_INK, muted: MUTED, faint: FAINT, neutral: NEUTRAL, greyLine: GREYLINE } = pal;
  const HOUSE = new Map(Object.entries(doc.houses).map(([h, v]) => [h, (v as any).colour as string]));
  const houseOr = (h: string | null | undefined, fallback: string) => (h != null && HOUSE.has(h) ? HOUSE.get(h)! : fallback);
  const textW = (s: string, size: number, isBold = true) => (isBold ? env.fonts.sans.bold : env.fonts.sans.regular).width(s, size);
  const disp = (doc.display ?? {}) as Record<string, any>, panels = (doc.panels ?? {}) as Record<string, any>;
  const priv = privateMedia(doc, env);
  // a picture a public build leaves out, or whose file is absent (a private one in the public repository), is left out:
  // its space stays, so nothing moves (model.published)
  const published = (path: string | null) => (!path || (env.public && priv.files.has(path)) || !env.exists(path) ? null : path);
  const media = (doc.media ?? {}) as Record<string, any>;
  const headers = (disp.headers ?? {}) as Record<string, any>;
  const disputedPills = new Set(Object.entries(disp.pills ?? {}).filter(([, v]: [string, any]) => v.disputed).map(([k]) => k));
  const { W, HGT, FOOT_Y, NOTES_H, MAP_X, MAP_Y, NOTE_COLS } = canvas, hd = canvas.header, ARRANGE = hd.arrange;
  const eras: [number, string][] = (doc.timeline?.eras ?? []).map((x: any) => [x.year, text(doc, x.name)]);
  const episodes: [number, number, string][] = (doc.timeline?.episodes ?? []).map((x: any) => [x.from, x.to, text(doc, x.name)]);
  const TITLE = text(doc, doc.meta.title as any), JAVANESE = titleScript(doc);
  const SUBTITLE = text(doc, (doc.meta as any).subtitle ?? ""), TITLE_TEXT = text(doc, panels.intro ?? "");
  const CAVEATS: string[] = (panels.caveats ?? []).map((x: any) => text(doc, x));
  const asOf = (doc.meta as any).asOf, AS_OF = asOf.text || asOf.edtf;
  const BADGES: string[] = (panels.badges ?? []).map((m: string) => env.asset(media[m].file));
  const SUCC = succession(doc);
  const houseIds = Object.keys(doc.houses), keyP = panels.key ?? {};
  const KEY = { house: keyP.house ?? houseIds[0], contrast: keyP.contrast ?? (houseIds.length > 1 ? houseIds[1] : houseIds[0]),
                labels: Object.fromEntries(Object.entries(keyP.labels ?? {}).map(([k, v]) => [k, text(doc, v as any)])) as Record<string, string> };
  const GLOSSARY: [string, string, string, string][] = Object.values((doc.glossary ?? {}) as Record<string, any>)
    .map(x => [x.group, x.term, x.expansion ?? "", text(doc, x.gloss)]);
  const GLOSSARY_TITLE = text(doc, panels.glossaryTitle ?? "Titles and honorifics");
  const warnings: Issue[] = [];
  const card = (message: string) => warnings.push(issue("warning", "card-too-small", message, { blocks: ["header"], box: [hd.x, hd.y, hd.x + hd.width, hd.y + hd.height] }));

  const routing = route(doc, boxes, ties, t, g, axis, c.lock?.lines ?? null);
  const patches = crossings(routing.segs, t);
  const labels = placeLabels(doc, env, boxes, t, g, axis, rows, canvas, routing);
  const { bgAt } = labels;
  const numbered = g.notes.filter((_, i) => !g.inline.has(i));
  const inline = g.notes.filter((_, i) => g.inline.has(i));

  // ---------------------------------------------------------------- background
  const backgroundSvg = () => {
    const out: string[] = [];
    range(rows.year0, rows.year1, BAND_YEARS).forEach((yr, i) => {
      const y0 = Y(yr), y1 = Y(Math.min(yr + BAND_YEARS, rows.year1));
      if (i % 2) out.push(`<rect x="0" y="${f1(y0)}" width="${W}" height="${f1(y1 - y0)}" fill="${BAND}"/>`);
    });
    for (const [a, b, lab] of episodes) {
      const y0 = Y(a), y1 = Y(b);
      out.push(`<rect x="${GUTTER}" y="${f1(y0)}" width="${W - 2 * GUTTER}" height="${f1(y1 - y0)}" fill="url(#stripes)"/>`);
      const [tx, ty, r] = labels.epiLabel(a, b, lab);
      if (labels.epiLeft.has(lab)) out.push(`<text x="${f0(r[0])}" y="${f1(ty)}" class="epi halo" style="stroke:${bgAt(ty)}">${e(tx)}</text>`);
      else out.push(`<text x="${W - GUTTER - 14}" y="${f1(ty)}" class="epi halo" text-anchor="end" style="stroke:${bgAt(ty)}">${e(tx)}</text>`);
    }
    const eraYears = new Set(eras.slice(1).map(([yr]) => yr));
    for (let yr = rows.year0; yr < rows.year1 + 1; yr += BAND_YEARS) {
      const y = Y(yr);
      if ([...eraYears].some(ey => Math.abs(Y(ey) - y) < 45)) continue;    // an era year label sits here already
      const cls = yr % 100 === 0 ? "yrc" : "yr";
      out.push(`<text x="${GUTTER - 16}" y="${f1(y + 5)}" class="${cls}" text-anchor="end">${yr}</text>`
        + `<text x="${W - GUTTER + 16}" y="${f1(y + 5)}" class="${cls}">${yr}</text>`
        + `<line x1="${GUTTER - 8}" y1="${f1(y)}" x2="${GUTTER}" y2="${f1(y)}" class="tick"/>`
        + `<line x1="${W - GUTTER}" y1="${f1(y)}" x2="${W - GUTTER + 8}" y2="${f1(y)}" class="tick"/>`);
    }
    eras.forEach(([yr, lab], i) => {
      const y = Y(yr);
      if (i) out.push(`<line x1="${GUTTER}" y1="${f1(y)}" x2="${W - GUTTER}" y2="${f1(y)}" class="era"/>`
        + `<text x="${GUTTER - 16}" y="${f1(y + 5)}" class="yre" text-anchor="end">${yr}</text>`
        + `<text x="${W - GUTTER + 16}" y="${f1(y + 5)}" class="yre">${yr}</text>`);
      const [x, anc, r] = labels.eraLabels.get(yr)!;
      out.push(`<text x="${f1(x)}" y="${f1(r[3] - 6)}" class="eralab halo" text-anchor="${anc}" style="stroke:${bgAt(r[1] + 16)}">${e(lab.toUpperCase())}</text>`);
    });
    return out;
  };

  // ---------------------------------------------------------------- lines
  const rank = (s: Seg) => {
    const skip = t.desc[parseInt(s.owner.slice(1), 10)];
    return [Number(s.style === "solid"), Number(s.hop), Number(!(s.owner[0] === "d" && Object.keys(skip.brk).length)), s.order];
  };
  const byRank = (a: Seg, b: Seg) => { const p = rank(a), q = rank(b); for (let i = 0; i < 4; i++) if (p[i] !== q[i]) return p[i] - q[i]; return 0; };
  const segSvg = (s: Seg) => {
    let dash = s.style === "dot" || s.style === "grey" ? ' stroke-dasharray="4.5 5.5"' : "";
    if (s.style === "adopt") dash = ' stroke-dasharray="16 7"';
    if (s.style === "legend") dash = ' stroke-dasharray="1.5 7" stroke-linecap="round" stroke-width="3"';
    const gaps = patches.filter(([o]) => o === s.order).map(([, r]) => r);
    const path = (mask: string) => `<path class="ln" data-owner="${s.owner}" d="${roundedPath(s.pts)}" stroke="${s.col}"${dash}${mask}/>`;
    if (!gaps.length) return path("");
    const cut = gaps.map(([x, y, w, h]) => `<rect x="${f1(x)}" y="${f1(y)}" width="${f1(w)}" height="${f1(h)}" fill="black"/>`).join("");
    const xs = s.pts.map(p => p[0]), ys = s.pts.map(p => p[1]);
    const bx = Math.min(...xs) - 20, by = Math.min(...ys) - 20, bw = Math.max(...xs) - Math.min(...xs) + 40, bh = Math.max(...ys) - Math.min(...ys) + 40;
    return `<mask id="gap${s.order}" maskUnits="userSpaceOnUse" x="${f0(bx)}" y="${f0(by)}" width="${f0(bw)}" height="${f0(bh)}">`
      + `<rect x="${f0(bx)}" y="${f0(by)}" width="${f0(bw)}" height="${f0(bh)}" fill="white"/>${cut}</mask>` + path(` mask="url(#gap${s.order})"`);
  };
  const pillSvg = (k: string) => {
    const [label, house] = t.pills.get(k)!, [x, cy] = g.pillPos(k), w = g.pillW(k), h = 38, dsp = disputedPills.has(k);
    return `<rect x="${f1(x - w / 2)}" y="${f1(cy - h / 2)}" width="${f1(w)}" height="${h}" rx="${pyFloat(h / 2)}" `
      + `fill="${dsp ? "url(#hatchpill)" : "#FFFFFF"}" stroke="${HOUSE.get(house)}" stroke-width="7"${dsp ? ' stroke-dasharray="11 6"' : ""}/>`
      + `<text x="${f1(x)}" y="${f1(cy + 6)}" class="pill">${e(label)}</text>`;
  };
  const labelled = new Set<string>();     // the mask is numbered by the bracket labels so far (a split one counts twice)
  const bracketSvg = (i: number) => {
    const { x0, x1, y, runs, pieces } = labels.brackets[i], mid = `brk${labelled.size}`;
    pieces.forEach((_, j) => labelled.add(g.brackets[i][1] + (j ? ` (${j + 1})` : "")));
    const cut = runs.map(vx => `<rect x="${f1(vx - 8)}" y="${f1(y - 5)}" width="16" height="10" fill="black"/>`).join("");
    const txt = pieces.map(([x, a, tx, r]) => `<text class="brktx" x="${f1(x)}" y="${f1(r[3] - 3)}" style="text-anchor:${a}">${e(tx)}</text>`).join("");
    const bx = x0 - 10, by = y - 10, bw = x1 - x0 + 20, bh = 30;
    return `<mask id="${mid}" maskUnits="userSpaceOnUse" x="${f0(bx)}" y="${f0(by)}" width="${f0(bw)}" height="${f0(bh)}">`
      + `<rect x="${f0(bx)}" y="${f0(by)}" width="${f0(bw)}" height="${f0(bh)}" fill="white"/>${cut}</mask>`
      + `<path d="M${f1(x0)},${f1(y + 7)} V${f1(y)} H${f1(x1)} V${f1(y + 7)}" class="brkt" mask="url(#${mid})"/>` + txt;
  };
  // a scale beside a trunk (panels.scale): legend -> court tradition -> documented, bending like the line it follows
  const hist: Rect[] = [];
  const historicitySvg = () => {
    const SCALE = panels.scale;
    if (!SCALE) return [];
    const [lg0, lg1] = SCALE.row.map(N), han = N(SCALE.documented);
    const x = Math.min(...SCALE.trunk.map((i: string) => left(N(i)))) - 46, x0 = left(lg0), yh = bottom(lg1) + 22;
    const y2 = top(han) + 10, y3 = bottom(han) + 10, X = pyFloat;
    const out = [`<line x1="${f1(x0)}" y1="${f1(yh)}" x2="${f1(x)}" y2="${f1(yh)}" class="hist" stroke-dasharray="2 6"/>`,
      `<line x1="${X(x)}" y1="${f1(yh)}" x2="${X(x)}" y2="${f1(y2)}" class="hist" stroke-dasharray="10 6"/>`,
      `<line x1="${X(x)}" y1="${f1(y2)}" x2="${X(x)}" y2="${f1(y3 - 10)}" class="hist"/>`,
      `<line x1="${f1(x0)}" y1="${f1(yh - 9)}" x2="${f1(x0)}" y2="${f1(yh + 9)}" class="hist"/>`,
      `<line x1="${X(x - 9)}" y1="${f1(y2)}" x2="${X(x + 9)}" y2="${f1(y2)}" class="hist"/>`,
      `<path d="M${X(x - 7)},${f1(y3 - 12)} L${X(x)},${f1(y3 + 2)} L${X(x + 7)},${f1(y3 - 12)} Z" fill="${MUTED}"/>`];
    const st = SCALE.stages;
    const labs: [number, number | null, string, string, string[]][] = [[x0, yh + 30, "start", st[0].head, st[0].lines],
      [x - 18, null, "end", st[1].head, st[1].lines], [x - 18, null, "end", st[2].head, st[2].lines]];
    const mids = [null, (yh + y2) / 2, (y2 + y3) / 2];
    labs.forEach(([tx, ty0, anc, head, lines], i) => {
      const ty = ty0 ?? mids[i]! - (lines.length * 18 + 20) / 2 + 14;
      out.push(`<text x="${f1(tx)}" y="${f1(ty)}" class="histh" text-anchor="${anc}">${head}</text>`);
      lines.forEach((l, j) => out.push(`<text x="${f1(tx)}" y="${f1(ty + 20 + j * 18)}" class="histt" text-anchor="${anc}">${e(l)}</text>`));
      const w = Math.max(...[...lines, head].map(l => textW(l, 15, false))) + 10, lft = anc === "end" ? tx - w : tx - 4;
      hist.push([lft, ty - 15, lft + w + 4, ty + 6 + lines.length * 18]);
    });
    return out;
  };

  // ---------------------------------------------------------------- people, headers, crowns, notes
  const nodeHtml = (n: Box) => {
    const col = houseOr(n.house, NEUTRAL);
    const ti = n.title ? `<div class="t">${e(dispTitle(n.title))}</div>` : "", tag = n.tag ? `<div class="tag">${e(n.tag)}</div>` : "";
    const hcls = n.hatch ? " hatched" : "";
    if (n.kind === "legend") {
      const s = n.sub ? `<div class="s2">${e(n.sub)}</div>` : "";
      return `<div class="legendbox" style="left:${f1(n.x - n.lw / 2)}px;top:${f1(top(n))}px;width:${f1(n.lw)}px;`
        + `height:${n.h}px;border-color:${col}">${ti}<div class="n2">${e(n.name)}</div>${s}</div>`;
    }
    const trad = n.trad ? `;background:${tint(col, 0.5)};outline:2.5px dashed ${col};outline-offset:-2.5px` : "";
    if (n.kind === "ruler" || n.kind === "heir") {
      const img = n.pic ? `<img src="${n.pic}">` : SILHOUETTE;
      const bg = n.hatch ? hatch(col) : n.kind === "heir" ? tint(col) : col;
      return `<div class="ruler" style="left:${f1(left(n))}px;top:${f1(top(n))}px"><div class="pic">${img}</div>`
        + `<div class="lab${hcls}" style="width:${f1(n.lw)}px;background:${bg}${trad}">${ti}`
        + `<div class="n">${e(n.name)}</div><div class="s">${e(n.sub)}</div>${tag}</div></div>`;
    }
    let pic = n.pic ? `<img class="npic" src="${n.pic}" style="left:${f1(left(n))}px;top:${f1(top(n))}px;width:${n.h}px;height:${n.h}px">` : "";
    if (n.pw && !n.pic) pic = `<div class="npic" style="left:${f1(left(n))}px;top:${f1(top(n))}px;width:${n.h}px;height:${n.h}px;overflow:hidden">${SILHOUETTE}</div>`;
    const lx = n.x - n.lw / 2, sub = n.kind === "neutral" ? n.sub : e(n.sub), s = n.sub ? `<div class="s2">${sub}</div>` : "";
    if (n.kind === "minor") {
      const bg = n.hatch ? hatch(col) : col;
      return pic + `<div class="minor${hcls}" style="left:${f1(lx)}px;top:${f1(top(n))}px;width:${f1(n.lw)}px;`
        + `height:${n.h}px;background:${bg}${trad}">${ti}<div class="n2">${e(n.name)}</div>${s}${tag}</div>`;
    }
    if (n.kind === "neutral") return pic + `<div class="neutral" style="left:${f1(lx)}px;top:${f1(top(n))}px;width:${f1(n.lw)}px;`
      + `height:${n.h}px">${ti}<div class="n2">${e(n.name)}</div>${s}</div>`;
    return `<div class="txt" style="left:${f1(lx)}px;top:${f1(top(n) - (t.textLift.get(n.id) ?? 0))}px;width:${f1(n.lw)}px;`
      + `height:${n.h}px"><div class="n2">${e(n.name)}</div>${s}</div>`;
  };
  const houseHeaderHtml = (k: string) => {
    const h = headers[k], img = h.emblem ? env.asset(media[h.emblem].file) : null, [x0, y0, x1] = g.headerRect(k);
    const flip = t.headerLeft.has(k) ? ";flex-direction:row-reverse;text-align:right" : "";
    const emblem = img && published(img) ? `<img src="${img}">` : img ? '<span style="width:90px;height:74px;flex:none"></span>' : "";
    return `<div class="hhead" style="left:${f1(x0)}px;top:${f1(y0)}px;width:${f1(x1 - x0)}px;height:118px${flip}">`
      + `${emblem}<div><div class="kind">${e(h.kind)}</div><div class="hname">${e(h.name)}</div>`
      + `<div class="facts"><b>${e(h.years)}</b> · ${e(h.seat)}<br><i>${e(h.founded)}</i></div></div></div>`;
  };
  const crownHtml = (k: string) => {
    const [x0, y0] = g.crownRect(k), col = houseOr(N(k).house, "#EFC239");
    return `<div class="crown" data-for="${k}" style="left:${f1(x0)}px;top:${f1(y0)}px;background:${bgAt(y0 + 12)}">`
      + `${CROWN_SVG(col)}<span>${e(t.crowns.get(k)!)}</span></div>`;
  };
  const noteHtml = (nt: typeof g.notes[number]) => {
    const [x, y, w] = g.noteRect(nt), side = nt[1];
    const al = side === "l" ? "right" : side === "b" || side === "t" ? "center" : "left";
    return `<div class="note" style="left:${f1(x)}px;top:${f1(y)}px;width:${w}px;text-align:${al}">${g.nt.nobreak(nt[5])}</div>`;
  };
  // markers are numbered top to bottom, then left to right
  const order = numbered.map((nt, i) => [nt, i] as const).sort(([p, i], [q, j]) =>
    pyRound(N(p[0]).cy! / 60) - pyRound(N(q[0]).cy! / 60) || N(p[0]).x - N(q[0]).x || i - j).map(([nt]) => nt);
  const markerHtml = (k: string, i: number) => {
    const n = N(k), col = houseOr(n.house, NEUTRAL), tp = t.markerTop.has(k) ? top(n) - 13 : bottom(n) - 13;
    return `<div class="marker" data-for="${k}" style="left:${f1(right(n) - 13)}px;top:${f1(tp)}px;`
      + `background:${tint(col, 0.35)};border-color:${col}">${letter(i)}</div>`;
  };
  const notesItems = () => order.map((nt, i) => {
    const col = houseOr(N(nt[0]).house, NEUTRAL);
    return `<li><span class="no" style="background:${tint(col, 0.35)};border-color:${col}">${letter(i)}</span> ${g.nt.nobreak(nt[5])}</li>`;
  }).join("");

  // ---------------------------------------------------------------- the header card: title, key, glossary, succession
  const disputedHouse = () => [...t.pills].find(([k]) => disputedPills.has(k))?.[1][1] ?? KEY.house;
  const keyRows = [0, 0, 0];
  const keyHtml = () => {
    const hc = HOUSE.get(KEY.house)!, hc2 = HOUSE.get(KEY.contrast)!;
    const styles = new Set([...t.desc.flatMap(d => Object.values(d.styles)), ...t.marr.flatMap(m => Object.values(m.kidStyles)), ...t.marr.map(m => m.style)]);
    const first = (pred: (n: Box) => boolean) => ns.find(n => pred(n) && n.house !== null && HOUSE.has(n.house))?.house ?? KEY.house;
    const legendC = HOUSE.get(first(n => n.kind === "legend"))!, tradC = HOUSE.get(first(n => n.trad))!, disputedC = HOUSE.get(disputedHouse())!;
    const sw = (style: string, col = hc, brk = false, cap = false) => {
      let dash = style !== "solid" ? ' stroke-dasharray="4.5 5.5"' : "";
      if (style === "legend") dash = ' stroke-dasharray="1.5 7" stroke-linecap="round"';
      if (style === "adopt") dash = ' stroke-dasharray="16 7"';
      const mark = brk ? `<rect x="29" y="0" width="16" height="16" fill="${BG}"/>`
        + `<line x1="22" y1="9" x2="36" y2="2" stroke="${col}" stroke-width="${LINE}"/>`
        + `<line x1="38" y1="14" x2="52" y2="7" stroke="${col}" stroke-width="${LINE}"/>` : "";
      if (cap) return `<svg width="74" height="30"><line x1="12" y1="0" x2="12" y2="30" stroke="${col}" `
        + `stroke-width="${LINE}"${dash}/><text x="22" y="20" class="cap">note</text></svg>`;
      return `<svg width="74" height="16"><line x1="2" y1="8" x2="72" y2="8" stroke="${col}" stroke-width="${LINE}"${dash}/>${mark}</svg>`;
    };
    const box = (bg: string, h = 22, extra = "") => `<span class="kbox" style="background:${bg};height:${h}px;${extra}"></span>`;
    const hop = `<svg width="74" height="22"><line x1="2" y1="11" x2="28" y2="11" stroke="${hc2}" `
      + `stroke-width="${LINE}" stroke-dasharray="4.5 5.5"/><line x1="47" y1="11" x2="72" y2="11" `
      + `stroke="${hc2}" stroke-width="${LINE}" stroke-dasharray="4.5 5.5"/>`
      + `<line x1="37" y1="0" x2="37" y2="22" stroke="${hc}" stroke-width="${LINE}"/></svg>`;
    const pill = (dsp = false) => `<svg width="74" height="26"><rect x="3" y="3" width="68" height="20" rx="10" fill="${dsp ? "url(#hatchpill)" : "#fff"}" `
      + `stroke="${dsp ? disputedC : hc}" stroke-width="5"${dsp ? ' stroke-dasharray="7 4"' : ""}/><text x="37" y="17.5" class="kpill">HOUSE</text></svg>`;
    const sil = `<span class="kbox" style="width:30px;height:30px;margin-left:22px;margin-right:22px">${SILHOUETTE}</span>`;
    const brkt = `<svg width="74" height="20"><path d="M3,18 V6 H71 V18" fill="none" stroke="${MUTED}" stroke-width="1.8"/></svg>`;
    const lines: [string, boolean, string, string][] = [
      ["solid", true, sw("solid"), "Father to son"],
      ["dot", styles.has("dot"), sw("dot"), "Through a daughter, or by marriage"],
      ["adopt", styles.has("adopt"), sw("adopt"), "Adopted as heir"],
      ["grey", styles.has("grey"), sw("grey", GREYLINE), "Marriage, descent or patronage outside the dynasty"],
      ["omitted", t.desc.some(d => Object.keys(d.brk).length), sw("solid", hc, true), "Generations omitted"],
      ["chronicle", styles.has("legend"), sw("legend", legendC), "Descent claimed by the chronicles"],
      ["caption", t.desc.some(d => Object.keys(d.caption).length), sw("dot", hc, false, true), "Relationship noted on the line"],
      ["crossing", patches.length > 0, hop, "Where lines cross, solid passes over dotted"],
      ["house", [...t.pills.keys()].some(k => !disputedPills.has(k)), pill(), "Founding of a royal house"],
      ["houseDisputed", disputedPills.size > 0, pill(true), "Self-proclaimed, unrecognised house"],
      ["bracket", g.brackets.length > 0, brkt, "Rival claimants or a disputed group"],
      ["event", t.events.size > 0, '<span class="kev">EVENT · 1677</span>', "Event on the line"],
    ];
    const kinds = new Set(ns.map(n => n.kind));
    const boxesK: [string, boolean, string, string][] = [
      ["ruler", kinds.has("ruler"), box(hc), "Ruler"],
      ["heir", kinds.has("heir"), box(tint(hc)), "Heir to the throne"],
      ["rival", ns.some(n => n.hatch), box(hatch(hc)), "Rival or unrecognised claimant"],
      ["traditional", ns.some(n => n.trad), box(tint(tradC, 0.5), 22, `outline:2.5px dashed ${tradC};outline-offset:-2.5px`), "Known only from court chronicles"],
      ["legendary", kinds.has("legend"), box("transparent", 22, `border:2.5px dashed ${legendC};border-radius:5px`), "Legendary ancestor"],
      ["minor", kinds.has("minor"), box(hc, 16, "width:52px;margin:0 11px"), "Royal family member who did not reign"],
      ["marriedIn", [...ties.keys()].some(k => N(k).kind === "minor" && N(k).house), box(hc2, 16, "width:52px;margin:0 11px"), "Princess married in (birth-house colour)"],
      ["neutral", kinds.has("neutral"), box(NEUTRAL), "Public figure outside the courts"],
      ["text", kinds.has("text"), '<span class="ktext">Name</span>', "Spouse from outside the dynasty"],
      ["noPortrait", ns.some(n => n.pw && !n.pic), sil, "No known portrait"],
      ["tag", ns.some(n => n.tag), '<span class="ktag">disputed</span>', "Status disputed"],
      ["crown", t.crowns.size > 0, `<span class="kcrown">${CROWN_SVG(hc)}<b>2 · 4</b></span>`, "Order of reign (one number per reign)"],
      ["letter", numbered.length > 0, `<span class="kmark" style="background:${tint(hc, 0.35)};border-color:${hc}">a</span>`, "See the lettered Notes below"],
    ];
    const lab = (k: string, d: string) => KEY.labels[k] ?? d;
    keyRows[0] = lines.filter(r => r[1]).length;
    keyRows[1] = boxesK.filter(r => r[1]).length;
    keyRows[2] = Math.max(...[...lines, ...boxesK].filter(r => r[1]).map(([k, , , b]) => 88 + textW(lab(k, b), 16, false)));
    const col = (rs: typeof lines) => rs.filter(r => r[1]).map(([k, , a, b]) => `<div class="krow">${a}<span>${lab(k, b)}</span></div>`).join("");
    const houses = [...HOUSE].map(([h, cc]) => `<div class="hk"><span style="background:${cc}"></span>${e(text(doc, (doc.houses as any)[h].name))}</div>`).join("");
    let bgrow = `<div class="kbg"><span class="kbox" style="background:${BAND};height:22px;width:54px;border:1px solid #D8D1BC"></span>${lab("band", "Half-century band")}`;
    if (eras.length > 1) bgrow += `<svg width="60" height="12"><line x1="0" y1="6" x2="60" y2="6" class="era"/></svg>${lab("era", "Start of an era")}`;
    if (episodes.length) bgrow += `<span class="kbox kstripe"></span>${lab("episode", "War, rebellion or foreign rule")}`;
    bgrow += "</div>";
    const note = lab("axis", "People are placed near the year they began to reign; half-century bands "
                           + "stretch where many reigns fall close together.");
    return `<div class="key"><div class="gh">Key</div><div class="kcols"><div>${col(lines)}</div>`
      + `<div>${col(boxesK)}</div></div><div class="houses">${houses}</div>${bgrow}<div class="kn">${note}</div></div>`;
  };
  const groupsOf = () => [...new Set(GLOSSARY.map(([grp]) => grp))];
  const glossaryHtml = () => {
    if (!GLOSSARY.length) return "";                  // a chart without terms (yet): no heading over nothing
    const out = groupsOf().map(grp => {
      let rws = `<tr><td colspan="3" class="gg">${e(grp)}</td></tr>`;
      for (const [gg, ab, full, en] of GLOSSARY) if (gg === grp)
        rws += `<tr><td class="ab">${e(ab)}</td><td class="en">${e(en)}</td><td class="full">${e(full)}</td></tr>`;
      return `<table>${rws}</table>`;
    });
    return `<div class="gloss"><div class="gh">${e(GLOSSARY_TITLE)}</div><div class="gcols">${out.join("")}</div></div>`;
  };
  const glossWidths = () => groupsOf().map(grp => {
    const rs = GLOSSARY.filter(r => r[0] === grp);
    return [Math.max(...rs.map(r => textW(r[1], 16, true) + textW(r[3], 16, false) + Math.min(textW(r[2], 14, false), 240) + 60)), rs.length + 1];
  });
  const footerHtml = (span: number | null = null) => {
    const cav = CAVEATS.map(x => `<div>${x}</div>`).join("");
    const src = sourcesText(doc, env.public) + `<b>Information as of ${AS_OF}.</b>`;
    const badges = BADGES.map((b, i) => [b, i] as const).filter(([b]) => published(b))
      .map(([b, i]) => `<img class="${i === 0 ? "cc" : "fm"}" src="${b}">`).join("");
    if (span === null) return `<div class="caveats">${cav}</div><div class="sources">${src}</div><div class="footer">${badges}</div>`;
    const cavW = Math.trunc(span * 0.6), srcX = GUTTER + 40 + cavW + 60, ty = FOOT_Y + NOTES_H;
    return `<div class="caveats" style="left:${GUTTER + 40}px;top:${ty}px;width:${cavW}px">${cav}</div>`
      + `<div class="sources" style="left:${srcX}px;top:${ty}px;width:${span - cavW - 120}px">` + src + "</div>"
      + `<div class="footer" style="right:${GUTTER + 40}px;top:${ty}px">${badges}</div>`;
  };
  const successionHtml = () => {
    const [title, rs] = SUCC!;
    const trs = rs.map(([n, nm, yrs, how, div]) => (div !== null ? `<tr class="sdiv"><td colspan="4">${div}</td></tr>` : "")
      + `<tr><td class="sn">${n}</td><td class="snm">${e(nm)}</td><td class="sy">${e(yrs)}</td><td class="sh">${e(how)}</td></tr>`).join("");
    return `<div class="succ"><div class="gh">${e(title)}</div><table>${trs}</table></div>`;
  };
  const successionH = (width: number) =>
    28 + SUCC![1].reduce((s, r) => s + g.nt.wrapLines(e(r[3]), width - 260, 15) * 21 + 4 + (r[4] !== null ? 34 : 0), 0);
  /** the column card's content height and the succession table's, from the same measurement the notes use */
  const columnEstimate = (inner: number): [number, number] => {
    const wl = g.nt.wrapLines, sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
    const title = wl(`<b>${e(TITLE)}</b>`, inner, 150) * 142.5 + (JAVANESE ? 78 : 0)
      + 22 + sum(SUBTITLE.split("<br>").map(s => wl(s, inner, 36))) * 43.2 + 22 + wl(TITLE_TEXT, inner, 19) * 27.6;
    keyHtml();
    const perRow = Math.max(1, Math.trunc(Math.floor((inner + 22) / 190)));
    const sideBySide = 2 * keyRows[2] + 40 <= inner;
    const key = 30 + 28 + (sideBySide ? Math.max(keyRows[0], keyRows[1]) : keyRows[0] + keyRows[1]) * 32 + 10
      + Math.ceil(HOUSE.size / perRow) * 30 + 32 + 2 * 20.3 + 8;
    let gloss = 26 + 28, lineW = 0, lineH = 0;
    for (const [w, n] of glossWidths()) {        // tables wrap into lines of the column's width
      if (lineW && lineW + 40 + w > inner) { gloss += lineH + 14; lineW = 0; lineH = 0; }
      lineW = lineW + (lineW ? 40 : 0) + w; lineH = Math.max(lineH, n * 24.5);
    }
    gloss += lineH;
    const notes = numbered.length ? 26 + 28 + sum(numbered.map(nt => wl(g.nt.nobreak(nt[5]), inner - 30, 15) * 20.25 + 7)) : 0;
    const succ = SUCC ? 26 + successionH(inner) : 0;
    const foot = 30 + sum(CAVEATS.map(x => wl(x, inner, 15) * 21.75 + 8))
      + 14 + wl(sourcesText(doc, env.public) + `<b>Information as of ${AS_OF}.</b>`, inner, 15) * 21.75 + 26 + 120;
    return [48 + title + key + gloss + notes + foot, succ];
  };
  const headerHtml = () => {
    const box = `left:${hd.x}px;top:${f1(hd.y)}px;width:${hd.width}px;height:${hd.height}px`;
    const title = `<div class="title"><h1>${e(TITLE)}</h1><div class="jawa">${JAVANESE}</div><h2>${SUBTITLE}</h2><p>${TITLE_TEXT}</p></div>`;
    if (ARRANGE === "column") {
      const [body, succ] = columnEstimate(hd.width - 58);
      let extra = "";
      if (numbered.length) extra += `<div class="fnotes"><div class="gh">Notes</div><ol>${notesItems()}</ol></div>`;
      if (SUCC && body + succ <= hd.height) extra += successionHtml();
      else if (SUCC) card(`no room for the succession table in the column card (needs about ${Math.trunc(body + succ - hd.height)} px more)`);
      if (body > hd.height) card(`the column card's content (about ${Math.trunc(body)} px) is taller than the card (${hd.height} px): give it a height of at least ${Math.trunc(body) + 1}`);
      return `<div class="header column" style="${box}">${title}${keyHtml()}${glossaryHtml()}${extra}<div class="cfoot">${footerHtml()}</div></div>`;
    }
    if (ARRANGE === "top") {
      const key = keyHtml();
      const gw = glossWidths().map(([w]) => w);
      const free = hd.width - 56 - 1250 - Math.max(2 * keyRows[2] + 40, 830) - (gw.length ? Math.max(...gw) : 0) - 3 * 70;
      let extra = "";
      if (SUCC && free >= 600 && successionH(free) <= hd.height - 48) extra = successionHtml();
      else if (SUCC) card("no room for the succession table in the top card");
      return `<div class="header top" style="${box}"><div class="hrow">${title}${key}${glossaryHtml()}${extra}</div></div>`;
    }
    return `<div class="header" style="${box}"><div class="hrow">${title}${keyHtml()}</div>${glossaryHtml()}</div>`;
  };

  // ---------------------------------------------------------------- the page
  const mapPanel = canvas.map ? drawMap(doc, env, MAP_X!, MAP_Y) : null;
  const css = pageCss({ env, FS, pal, W, HGT, NOTE_COLS, arrange: ARRANGE, succession: SUCC !== null, mapCss: mapPanel?.css ?? null });
  const defs = `<defs><pattern id="stripes" width="22" height="22" patternUnits="userSpaceOnUse" `
    + `patternTransform="rotate(45)"><rect width="7" height="22" fill="#DCD5BF" opacity=".5"/></pattern>`
    + `<pattern id="hatchpill" width="12" height="12" patternUnits="userSpaceOnUse" `
    + `patternTransform="rotate(45)"><rect width="12" height="12" fill="#FFFFFF"/>`
    + `<rect width="5" height="12" fill="${tint(HOUSE.get(disputedHouse())!, 0.45)}"/></pattern></defs>`;
  const bg = [`<svg class="layer" width="${W}" height="${HGT}">`, defs, ...backgroundSvg(), "</svg>"];
  const brackets = g.brackets.map((_, i) => bracketSvg(i));
  const lines = [`<svg class="layer" width="${W}" height="${HGT}">`, ...historicitySvg(), ...brackets,
    ...[...routing.segs].sort(byRank).map(segSvg), ...labels.marks, ...[...t.pills.keys()].map(pillSvg), "</svg>"];
  const body = ['<div id="chart">', bg.join(""), lines.join(""), headerHtml()];
  // each person's elements in an unstyled wrapper carrying their id, for the viewer
  body.push(...ns.map(n => `<div data-id="${n.id}">${nodeHtml(n)}</div>`));
  body.push(...Object.keys(headers).map(houseHeaderHtml), ...[...t.crowns.keys()].map(crownHtml), ...inline.map(noteHtml));
  body.push(...order.map((nt, i) => markerHtml(nt[0], i)));
  if (order.length && ARRANGE !== "column")
    body.push(`<div class="fnotes" style="left:${GUTTER + 40}px;top:${FOOT_Y}px;width:${W - 2 * GUTTER - 80}px">`
      + `<div class="gh">Notes</div><ol>${notesItems()}</ol></div>`);
  if (mapPanel) body.push(mapPanel.html);
  if (ARRANGE !== "column") body.push(footerHtml(W - 2 * GUTTER - 80 - LOGO_W));
  body.push("</div>");
  const lang = doc.meta.defaultLang ?? "en";
  const html = `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><title>${e(TITLE)}</title>`
    + `<style>${css}</style></head><body>${body.join("")}</body></html>`;
  const report = check(doc, boxes, t, g, axis, canvas, routing, labels, hist, [...routing.warnings, ...labels.warnings, ...warnings]);
  void P; void pyLen;
  return { html, routing, patches, labels, hist, report, lines: [...routing.segs].sort(byRank), lettered: order };
}

interface CssIn {
  env: Env; FS: Record<string, number>; pal: Record<string, string>; W: number; HGT: number; NOTE_COLS: number;
  arrange: string; succession: boolean; mapCss: string | null;
}

/** the page's style sheet (fonts by path, as the build writes them) */
function pageCss({ env, FS, pal, W, HGT, NOTE_COLS, arrange, succession, mapCss }: CssIn): string {
  const { background: BG, ink: INK, noteInk: NOTE_INK, muted: MUTED, faint: FAINT, neutral: NEUTRAL } = pal;
  const f = env.fonts, scale = f.scriptScale ?? 1;
  let ARRANGE_CSS = ({ row: "", column: `.header.column { display: flex; flex-direction: column; }
.header.column .title { width: auto; }
.header.column .cfoot { margin-top: auto; padding-top: 30px; }
.header.column .caveats, .header.column .sources, .header.column .footer { position: static; }
.header.column .sources { margin-top: 14px; }
.header.column .footer { margin-top: 26px; }
.header.column .key { margin-top: 30px; }
.header.column .kn { width: auto; }
.header.column .kcols { flex-wrap: wrap; column-gap: 40px; }
.header.column .gcols { flex-wrap: wrap; gap: 14px 40px; }
.header.column .fnotes { position: static; margin-top: 26px; }
.header.column .fnotes ol { columns: 1; }
`, top: `.header.top .hrow { gap: 70px; }
.header.top .gloss { margin-top: 0; }
.header.top .gcols { flex-direction: column; gap: 6px; }
.header.top .succ { margin-top: 0; flex: 1 1 0; min-width: 0; }
` } as Record<string, string>)[arrange];
  if (arrange !== "row" && succession) ARRANGE_CSS += `.succ { margin-top: 26px; font-size: 15px; }
.succ table { border-collapse: collapse; width: 100%; }
.succ td { padding: 2px 14px 2px 0; line-height: 1.4; vertical-align: top; }
.succ td.sn { font-weight: 700; color: #5A4520; text-align: right; width: 34px; }
.succ td.snm { font-weight: 700; white-space: nowrap; }
.succ td.sy { color: ${MUTED}; white-space: nowrap; }
.succ td.sh { color: ${NOTE_INK}; }
.succ tr.sdiv td { border-top: 1.5px solid #CFC8B3; padding: 8px 0 4px; font-weight: 700; font-size: 13px;
  letter-spacing: 1.2px; text-transform: uppercase; color: ${MUTED}; }
`;
  const jawa = f.files.secondScript ? `@font-face { font-family: 'Jawa'; src: url('${f.files.secondScript}'); }\n` : "";
  return `
@font-face { font-family: 'AHG'; src: url('${f.files.regular}'); font-weight: 400; }
@font-face { font-family: 'AHG'; src: url('${f.files.bold}'); font-weight: 700; }
@font-face { font-family: 'Chancery'; src: url('${f.files.script}'); }
${jawa}@page { size: ${W}px ${HGT}px; margin: 0; }
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { background: ${BG}; }
body { width: ${W}px; height: ${HGT}px; font-family: 'AHG', Helvetica, Arial, sans-serif; color: ${INK};
  -webkit-print-color-adjust: exact; print-color-adjust: exact; }
#chart { position: relative; width: ${W}px; height: ${HGT}px; overflow: hidden; background: ${BG}; }
svg.layer { position: absolute; left: 0; top: 0; }
svg.layer path.ln { fill: none; stroke-width: ${LINE}; stroke-linejoin: round; stroke-linecap: butt; }
.halo { paint-order: stroke; stroke-width: 7px; stroke-linejoin: round; }
.pill { font: 700 17px 'AHG'; text-anchor: middle; fill: ${INK}; letter-spacing: .3px; }
.yr { font: 400 17px 'AHG'; fill: ${FAINT}; }
.yrc { font: 700 19px 'AHG'; fill: ${FAINT}; }
.yre { font: 700 19px 'AHG'; fill: ${MUTED}; }
.tick { stroke: ${FAINT}; stroke-width: 1.5; }
.era { stroke: #D2CAB4; stroke-width: 5; stroke-dasharray: 18 10; }
.eralab { font: 700 30px 'AHG'; fill: #9A9078; letter-spacing: 6px; }
.epi { font: 700 17px 'AHG'; fill: ${MUTED}; letter-spacing: 1.5px; }
.cap { font: 700 13px 'AHG'; fill: ${MUTED}; letter-spacing: 1.2px; }
.brkt { fill: none; stroke: ${MUTED}; stroke-width: 1.8; }
.brktx { font: 700 ${FS.small}px 'AHG'; fill: ${MUTED}; text-anchor: middle; letter-spacing: 1.2px; }
.ruler { position: absolute; display: flex; height: ${P}px; }
.ruler .pic { width: ${P}px; height: ${P}px; overflow: hidden; background: #DDD8C9; border-radius: 9px 0 0 9px; }
.ruler .pic img { width: 100%; height: 100%; object-fit: cover; display: block; }
.lab { position: relative; height: ${P}px; border-radius: 0 9px 9px 0; display: flex; flex-direction: column; justify-content: center;
  align-items: center; text-align: center; }
.hatched { text-shadow: 0 0 3px #FFFFFF, 0 0 3px #FFFFFF, 0 0 5px rgba(255,255,255,.8); }
.t { font-weight: 700; font-size: ${FS.title}px; letter-spacing: .4px; line-height: 1.1; }
.n { font-weight: 700; font-size: ${FS.name}px; line-height: 1.12; margin-top: 2px; white-space: nowrap; }
.s { font-size: ${FS.reign}px; line-height: 1.2; margin-top: 3px; white-space: nowrap; }
.tag { position: absolute; right: -10px; top: -26px; font-weight: 700; font-size: 14px; letter-spacing: 1px;
  text-transform: uppercase; color: ${MUTED}; background: ${BG}; border: 1.5px solid ${MUTED}; padding: 1px 6px;
  text-shadow: none; }
.minor, .txt, .neutral { position: absolute; display: flex; flex-direction: column; justify-content: center;
  align-items: center; text-align: center; }
.n2 { font-weight: 700; font-size: ${FS.name2}px; line-height: 1.15; white-space: nowrap; }
.s2 { font-size: ${FS.sub2}px; line-height: 1.2; margin-top: 1px; white-space: nowrap; }
.txt { text-shadow: 0 0 3px ${BG}, 0 0 3px ${BG}, 0 0 6px ${BG}, 0 0 6px ${BG}; }
.neutral { background: ${NEUTRAL}; }
.minor, .neutral { border-radius: 7px; }
.legendbox { position: absolute; display: flex; flex-direction: column; justify-content: center; align-items: center;
  text-align: center; border: 2.5px dashed; border-radius: 7px; background: rgba(255,255,255,.25); color: ${MUTED}; }
.legendbox .n2 { font-style: italic; }
.hist { stroke: ${MUTED}; stroke-width: 2.5; }
.histh { font: 700 14px 'AHG'; fill: ${INK}; letter-spacing: 1.3px; }
.histt { font: 400 15px 'AHG'; fill: ${NOTE_INK}; }
.npic { border-radius: 7px 0 0 7px; }
.npic { position: absolute; object-fit: cover; }
.note { position: absolute; font-size: ${FS.note}px; line-height: 1.3; color: ${NOTE_INK};
  text-shadow: 0 0 3px #EAE4D3, 0 0 3px #EAE4D3, 0 0 5px #EAE4D3, 0 0 5px #EAE4D3; }
.note b { color: ${INK}; }
.hhead { position: absolute; display: flex; align-items: center; gap: 16px; }
.hhead img { height: 74px; width: 90px; object-fit: contain; flex: none; }
.hhead .hname { font-size: ${pyFixed(40 * scale, 1)}px; line-height: 1.05; margin-top: 0; }
.hhead .facts { font-size: 14.5px; line-height: 1.3; margin-top: 2px; white-space: nowrap; }
.crown { position: absolute; display: flex; align-items: center; justify-content: center; gap: 5px;
  font: 700 18px 'AHG'; color: #5A4520; }
.crown svg { display: block; }
.marker { position: absolute; min-width: 26px; padding: 0 4px; height: 26px; border-radius: 13px; border: 2px solid; color: ${INK};
  font: italic 700 15px/22px 'AHG'; text-align: center; box-shadow: 0 0 0 2.5px ${BG}; }
.event { font: 700 14px 'AHG'; fill: ${INK}; letter-spacing: 1.3px; }
.fnotes { position: absolute; font-size: 15px; line-height: 1.35; color: ${NOTE_INK}; }
.fnotes ol { list-style: none; columns: ${NOTE_COLS}; column-gap: 46px; }
.fnotes li { break-inside: avoid; margin-bottom: 7px; }
.fnotes li .no { display: inline-block; min-width: 22px; height: 22px; border-radius: 11px; border: 2px solid;
  color: ${INK}; font-size: 13px; font-weight: 700; font-style: italic; line-height: 18px; text-align: center;
  margin-right: 6px; }
.jawa { font-family: 'Jawa', serif; font-size: 40px; color: ${MUTED}; margin-top: 4px; line-height: 1.2; margin-bottom: 26px; }
.kind { font-weight: 700; font-size: 14px; letter-spacing: 1.4px; text-transform: uppercase; }
.hname { font-family: 'Chancery', serif; font-size: ${pyFixed(46 * scale, 1)}px; line-height: 1.15; margin-top: 2px; }
.facts { font-size: 15px; line-height: 1.35; margin-top: 4px; }
.header { position: absolute; background: #EFEBDD; border: 1px solid #CFC8B3; padding: 24px 28px; }
.hrow { display: flex; gap: 40px; }
.title { width: 1250px; flex: none; }
.title h1 { font-weight: 700; font-size: 150px; line-height: .95; letter-spacing: -3px; }
.title h2 { font-weight: 400; font-size: 36px; line-height: 1.2; margin-top: 22px; }
.title p { font-size: 19px; line-height: 1.45; margin-top: 22px; color: ${NOTE_INK}; }
.gloss { font-size: 16px; margin-top: 26px; }
.gh { font-weight: 700; font-size: 15px; letter-spacing: 1.4px; text-transform: uppercase; margin-bottom: 10px; }
.gcols { display: flex; gap: 40px; align-items: flex-start; }
.gloss td { padding: 2px 18px 2px 0; line-height: 1.25; white-space: nowrap; }
.gloss td.ab { font-weight: 700; }
.gloss td.en { font-style: italic; }
.gloss td.full { color: ${MUTED}; font-size: 14px; white-space: normal; max-width: 240px; }
.gloss td.gg { font-weight: 700; font-size: 13px; letter-spacing: 1.2px; text-transform: uppercase; color: ${MUTED};
  padding-top: 6px; }
.key { font-size: 16px; }
.kcols { display: flex; gap: 40px; }
.kev { display: inline-block; width: 74px; font: 700 10.5px 'AHG'; letter-spacing: .6px; white-space: nowrap; }
.kcrown { display: inline-flex; align-items: center; gap: 4px; width: 74px; font: 700 15px 'AHG'; color: #5A4520; }
.kmark { display: inline-block; width: 26px; height: 26px; margin: 0 24px; border-radius: 13px; border: 2px solid;
  font: italic 700 15px/22px 'AHG'; text-align: center; }
.krow { display: flex; align-items: center; gap: 14px; height: 32px; white-space: nowrap; }
.kbox { display: inline-block; width: 74px; overflow: hidden; flex: none; }
.kstripe { height: 22px; width: 54px; background: repeating-linear-gradient(135deg, #DCD5BF 0 5px, ${BG} 5px 15px); }
.ktext { display: inline-block; width: 74px; text-align: center; font-weight: 700; }
.ktag { display: inline-block; width: 74px; text-align: center; font-weight: 700; font-size: 13px;
  letter-spacing: .5px; text-transform: uppercase; color: ${MUTED}; border: 1.5px solid ${MUTED}; padding: 1px 0; }
.kpill { font: 700 12px 'AHG'; text-anchor: middle; fill: ${INK}; letter-spacing: .5px; }
.houses { display: flex; flex-wrap: wrap; gap: 8px 22px; margin-top: 10px; }
.hk { display: flex; align-items: center; gap: 8px; font-weight: 700; }
.hk span { width: 22px; height: 22px; display: inline-block; }
.kbg { display: flex; align-items: center; gap: 12px; margin-top: 10px; white-space: nowrap; }
.kbg svg, .kbg .kbox { margin-left: 12px; }
.kn { font-size: 15px; color: ${MUTED}; margin-top: 8px; line-height: 1.35; width: 830px; }
${ARRANGE_CSS}.footer { position: absolute; display: flex; align-items: center; gap: 26px; }
.footer img.fm { height: 120px; }
.footer img.cc { height: 36px; }
.sources, .caveats { position: absolute; font-size: 15px; line-height: 1.45; color: ${NOTE_INK}; }
.caveats { columns: 2; column-gap: 50px; }
.caveats div { break-inside: avoid; margin-bottom: 3px; }
${mapCss ?? ""}
`;
}

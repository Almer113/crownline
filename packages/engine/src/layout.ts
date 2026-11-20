// The layout file (the Python layout_export.py): the contract between the engine and everything that
// draws or reads the chart. Every person box, every line with the people it joins, notes, house headers,
// crowns, the glossary, eras, map stages and tours, in chart pixels (the page's own coordinates);
// rectangles are [left, top, right, bottom]. The viewer uses it for clicking, searching, the panel, the time
// slider, tours and linking. Format 1: fields are only ever added. See layout_export.py for each field.
import { type Box, dispTitle, left, right } from "./boxes.ts";
import type { Composed } from "./compose.ts";
import { type Doc, type Env, privateMedia, text } from "./doc.ts";
import { pyFixed } from "./py.ts";
import { letter, type Page } from "./render.ts";

export const FORMAT = 1;

const r1 = (v: number) => Number(pyFixed(v, 1));          // round(v, 1)
const rect = (x0: number, y0: number, x1: number, y1: number) => [r1(x0), r1(y0), r1(x1), r1(y1)];

// a year, with an optional short end: "1647/48" (one or the other) or "1810–11" (a range)
const YEAR = /(?<!\p{Nd})(1[0-9]{3}|20[0-9]{2})(?:\/(\p{Nd}{2})|\s*[–-]\s*(\p{Nd}{2})(?!\p{Nd}))?(?!\p{Nd})/gu;
// words after which a year marks an event in a life, not its end: a marriage, a divorce, a new name
// (ı and İ are in the class as Python's re.I matches them against a-z; JavaScript's case folding does not)
const EVENT = /(?<![a-zİı])(m\.|div\.|divorced|renamed)/iu;
const BORN = /(?<![a-zİı])b\.\s*(?:c\.\s*)?$/iu;
export const GUESS = 30;      // years a person is assumed present when the card gives no end
export const OLDEST = 100;    // a birth year with no death runs to the present, but no longer than this

/** [from, to, guessed]: the years a person is shown as present, from the dates printed on the card. A birth
 *  year with no death runs to the present (at most OLDEST years); years after "m.", "div." or "renamed" are
 *  events that only stretch the guess; "present", "today" and "since" run to the present. */
export function span(rowYear: number | null, txt: string, now: number): [number, number, boolean] {
  const life: number[] = [], events: number[] = [], born: number[] = [];
  for (const seg of txt.split("·")) {
    const ev = EVENT.exec(seg);
    for (const m of seg.matchAll(YEAR)) {
      const ys = [Number(m[1]), ...[m[2], m[3]].filter(Boolean).map(e => Number(m[1].slice(0, 2) + e))];
      if (ev && ev.index < m.index!) events.push(...ys);
      else if (BORN.test(seg.slice(0, m.index))) born.push(...ys);
      else life.push(...ys);
    }
  }
  const every = [...life, ...events, ...born];
  const lo = rowYear ? Math.min(rowYear, ...every) : every.length ? Math.min(...every) : 0;
  if (/present|today|since/.test(txt)) return [lo, now, false];
  if (born.length && !life.length) {
    const b = Math.min(...born);
    return now - b <= OLDEST ? [lo, now, false] : [lo, b + OLDEST, true];
  }
  const hi = life.length ? Math.max(...life) : null;
  if (hi === null || hi <= lo) return [lo, Math.min(now, Math.max(lo + GUESS, ...events)), true];
  return [lo, hi, false];
}

/** markup to plain text; a line break becomes a space ("son of<br>Sultan" -> "son of Sultan") */
export function plain(s: string | null | undefined): string {
  s = (s ?? "").replace(/\s*<br\s*\/?>\s*/g, " ");
  return s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

export function ordinal(n: number): string {
  return `${n}${n % 100 >= 10 && n % 100 <= 20 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th"}`;
}

const AND: Record<string, string> = { en: " and ", id: " dan " };

/** the panel's words for a person's reigns, by language, from their court's `reign` template; null when the
 *  court has none (the viewer then says "Ruler {n} of" the court's header) */
export function reignText(doc: Doc, rec: any): Record<string, string> | null {
  const reigns: any[] = rec.reigns ?? [];
  if (!reigns.length) return null;
  const courts = new Map<string, number[]>();      // reigns in two courts are named court by court
  for (const r of reigns) { if (!courts.has(r.court)) courts.set(r.court, []); courts.get(r.court)!.push(r.n); }
  const raw = [...courts.keys()].map(c => (doc.houses as any)?.[c]?.reign);
  if (!raw.every(Boolean)) return null;
  const def = doc.meta.defaultLang ?? "en";
  const tpls: Record<string, string>[] = raw.map(t => (typeof t === "object" ? t : { [def]: t }));
  const join = (xs: (string | number)[], lang: string) => {
    const s = xs.map(String);
    return s.length === 1 ? s[0] : s.slice(0, -1).join(", ") + (AND[lang.slice(0, 2)] ?? ", ") + s[s.length - 1];
  };
  const langs = [...new Set(tpls.flatMap(t => Object.keys(t)))];
  const ns = [...courts.values()];
  const out: Record<string, string> = {};
  for (const lang of langs)
    out[lang] = tpls.map((t, i) => (t[lang] || t[def] || Object.values(t)[0])
      .replaceAll("{nth}", join(ns[i].map(ordinal), lang)).replaceAll("{n}", join(ns[i], lang))).join("; ");
  return out;
}

/** the document's tours with their text in the default language, checked: a tour that names someone not on
 *  the chart, or a map stage the chart lacks, is an error */
export function tours(doc: Doc, people: Record<string, unknown>, stages: Set<string>): any[] {
  const data = Object.entries((doc as any).tours ?? {}).map(([tid, t]: [string, any]) => {
    const steps = t.steps.map((st: any) => ({ ...st, ...Object.fromEntries(["title", "caption"].filter(f => f in st).map(f => [f, text(doc, st[f])])) }));
    return { id: tid, ...t, ...Object.fromEntries(["title", "summary"].filter(f => f in t).map(f => [f, text(doc, t[f])])), steps };
  });
  const bad: string[] = [];
  for (const tr of data)
    tr.steps.forEach((st: any, j: number) => {
      const i = j + 1;
      if (!st.caption) bad.push(`${tr.id} step ${i}: no caption`);
      const focus: string[] = st.focus === "all" ? [] : st.focus ?? [];
      const ids = [...focus.filter(f => !f.startsWith("map:")), ...(st.light ?? []), ...(st.lineage ? [st.lineage] : [])];
      const maps = [...focus.filter(f => f.startsWith("map:")).map(f => f.slice(4)), ...(st.stage ? [st.stage] : [])];
      bad.push(...ids.filter(k => !(k in people)).map(k => `${tr.id} step ${i}: no person "${k}"`));
      bad.push(...maps.filter(k => !stages.has(k)).map(k => `${tr.id} step ${i}: no map stage "${k}"`));
    });
  if (bad.length) throw new Error("tours: " + bad.join("; "));
  return data;
}

interface Link { id: string; gap: string | null; via?: string }

/** the layout file's content (JSON.stringify it to write the file) */
export function layoutFile(doc: Doc, env: Env, c: Composed, page: Page): Record<string, unknown> {
  const { boxes, tables: t, geometry: g, canvas } = c;
  const pal = (doc.theme as any).palette as Record<string, string>;
  const HOUSE = Object.fromEntries(Object.entries(doc.houses).map(([h, v]) => [h, (v as any).colour as string]));
  const panels = (doc.panels ?? {}) as Record<string, any>, disp = (doc.display ?? {}) as Record<string, any>;
  const top = (b: Box) => b.cy! - b.h / 2, bottom = (b: Box) => b.cy! + b.h / 2;

  const family = new Map<string, Record<"parents" | "spouses" | "children", Link[]>>(
    [...boxes.keys()].map(k => [k, { parents: [], spouses: [], children: [] }]));
  const link = (group: "parents" | "spouses" | "children", a: string, b: string, gap: string | null = null, via?: string) => {
    const f = family.get(a);
    if (f && boxes.has(b) && f[group].every(x => x.id !== b)) f[group].push({ id: b, gap, ...(via ? { via } : {}) });
  };
  for (const d of t.desc)
    for (const kid of d.kids) {
      if (kid in d.caption) continue;        // a captioned link ("court poet", "son-in-law"): not parent and child
      const gap = d.brk[kid] ?? null;
      for (const par of d.couple_of ?? [d.parent]) { link("children", par, kid, gap); link("parents", kid, par, gap); }
    }
  // an adoption kept in the data but not drawn (show.drawn false): listed in the panel, marked "adoptive",
  // and not followed by the relationship finder, which goes by birth and marriage
  for (const d of Object.values((doc as any).descents ?? {}) as any[])
    if (d.show?.drawn === false && d.kind === "adoptive" && d.parent) {
      link("children", d.parent, d.child, null, "adoptive");
      link("parents", d.child, d.parent, null, "adoptive");
    }
  for (const m of t.marr) {
    link("spouses", m.a, m.b);
    link("spouses", m.b, m.a);
    for (const kid of m.kids) for (const par of [m.a, m.b]) { link("children", par, kid); link("parents", kid, par); }
  }

  const inline = g.notes.filter((_, i) => g.inline.has(i));
  const notesOf = new Map<string, { text: string; letter: string | null }[]>([...boxes.keys()].map(k => [k, []]));
  const addNote = (k: string, n: { text: string; letter: string | null }) => { if (!notesOf.has(k)) notesOf.set(k, []); notesOf.get(k)!.push(n); };
  for (const nt of inline) addNote(nt[0], { text: plain(nt[5]), letter: null });
  page.lettered.forEach((nt, i) => addNote(nt[0], { text: plain(nt[5]), letter: letter(i) }));

  const asOf = (doc.meta as any).asOf, AS_OF: string = asOf.text || asOf.edtf;
  const now = Number([...AS_OF.matchAll(/\p{Nd}{4}/gu)].at(-1)![0]);
  const people: Record<string, any> = {};
  for (const n of boxes.values()) {
    const sub = plain(n.sub);
    const [lo, hi, guess] = span(n.year, sub, now);
    const p: Record<string, any> = {
      kind: n.kind, house: n.house, colour: (n.house != null && HOUSE[n.house]) || pal.neutral,
      title: n.title ? dispTitle(n.title) : "", name: n.name, sub, year: n.year, rect: rect(left(n), top(n), right(n), bottom(n)),
      portrait: n.pic, hatch: Boolean(n.hatch), traditional: Boolean(n.trad), tag: n.tag,
      family: family.get(n.id), crown: t.crowns.get(n.id) ?? null, notes: notesOf.get(n.id) ?? [],
      span: [lo, hi], spanGuess: guess,
    };
    const rec = (doc.people as any)[n.id] ?? {};
    const reign = reignText(doc, rec);
    if (reign) p.reign = reign;
    if (rec.bio) p.bio = plain(text(doc, rec.bio));
    const other: string[] = [...(rec.aka ?? []).flatMap((a: any) => (a && typeof a === "object" ? Object.values(a) : [a])), ...(rec.variants ?? [])];
    if (other.length) p.aka = other.map(plain);
    for (const f of ["born", "died"]) if (rec[f]?.length) p[f] = rec[f].map((c: any) => claim(doc, c));
    if (rec.sources?.length) p.sources = rec.sources.map(cite);
    people[n.id] = p;
  }
  const cited = new Set<string>();
  for (const p of Object.values(people)) {
    for (const c of p.sources ?? []) cited.add(c.source);
    for (const f of ["born", "died"]) for (const cl of p[f] ?? []) for (const c of cl.sources) cited.add(c.source);
  }
  const registry: Record<string, any> = (doc as any).sources ?? {};
  const sources: Record<string, any> = {};
  for (const k of [...cited].sort()) {
    if (!registry[k]) continue;
    const s: Record<string, any> = {};
    for (const f of ["kind", "title", "author", "year", "url"])
      if (f in registry[k]) s[f] = ["kind", "year", "url"].includes(f) ? registry[k][f] : plain(text(doc, registry[k][f]));
    sources[k] = s;
  }

  /** the people a line joins, from its owner id: d<i> = a descent, m<i> = a marriage */
  const who = (owner: string) => {
    const i = Number(owner.slice(1));
    if (owner[0] === "d") { const d = t.desc[i]; return { type: "descent", from: [d.parent], to: [...d.kids] }; }
    const m = t.marr[i];
    return { type: "marriage", from: [m.a, m.b], to: [...m.kids] };
  };
  const lines = page.lines.map(s => ({ owner: s.owner, ...who(s.owner), points: s.pts.map(([x, y]) => [r1(x), r1(y)]),
                                       colour: s.col, style: s.style, hop: Boolean(s.hop) }));
  const notes = inline.map(nt => {
    const [x, y, w, h] = g.noteRect(nt);
    return { anchor: nt[0], rect: rect(x, y, x + w, y + h), text: plain(nt[5]) };
  });
  const priv = privateMedia(doc, env);
  const headers = Object.fromEntries(Object.entries((disp.headers ?? {}) as Record<string, any>).map(([k, v]) => {
    const emblem = v.emblem ? env.asset((doc.media as any)[v.emblem].file) : null;
    return [k, { rect: rect(...g.headerRect(k)), name: v.name, kind: v.kind, years: v.years, seat: v.seat, founded: v.founded,
                 emblem: !emblem || (env.public && priv.files.has(emblem)) || !env.exists(emblem) ? null : emblem }];
  }));
  const crowns = Object.fromEntries([...t.crowns.keys()].map(k => [k, { rect: rect(...g.crownRect(k)) }]));
  const maps: any[] = panels.map?.maps ?? [];
  const viewer = panels.viewer ?? {};

  return {
    format: FORMAT,
    chart: doc.meta.id,
    public: env.public,
    canvas: [canvas.W, canvas.HGT],
    people,
    lines,
    notes,
    headers,
    crowns,
    glossary: Object.values((doc.glossary ?? {}) as Record<string, any>)
      .map(x => ({ group: x.group, term: x.term, full: x.expansion ?? "", meaning: text(doc, x.gloss) })),
    eras: (doc.timeline?.eras ?? []).map((x: any) => ({ year: x.year, name: text(doc, x.name) })),
    episodes: (doc.timeline?.episodes ?? []).map((x: any) => ({ from: x.from, to: x.to, name: text(doc, x.name) })),
    stages: maps.map(m => ({ id: m.id, from: m.from, title: m.title })),
    tours: tours(doc, people, new Set(maps.map(m => m.id))),
    title: plain(text(doc, doc.meta.title as any)),
    intro: plain(text(doc, panels.intro ?? "")),
    asOf: AS_OF,
    ...(viewer.languages ? { interface: viewer.languages } : {}),
    ...(viewer.year ? { startYear: viewer.year } : {}),
    ...(Object.keys(sources).length ? { sources } : {}),
  };
}

/** a citation for the panel: the source's id and where in it */
function cite(c: any): Record<string, string> {
  return { source: c.source, ...(c.where ? { where: c.where } : {}) };
}

/** a birth or death claim for the panel, as plain text: the date as written, place, note, certainty, sources */
function claim(doc: Doc, c: any): Record<string, any> {
  const out: Record<string, any> = {};
  if (c.date) out.date = c.date.text || c.date.edtf;
  for (const f of ["place", "note"]) if (c[f]) out[f] = plain(text(doc, c[f]));
  if (c.certainty) out.certainty = c.certainty;
  out.sources = (c.sources ?? []).map(cite);
  return out;
}

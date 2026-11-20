// The second pass (PLAN Phase 4, item 4): what JSON Schema cannot say. Run after the schema check passes.
//   references   every id a record names exists, and is the right kind of thing
//   tree         the tree the engine builds (compose.py), checked the same way: each person placed once,
//                one root, everyone reachable from it, no one their own ancestor, no loops of ties or follows
//   text         only <b>, <i> and <br> markup; titles made of glossary terms (a warning)
//   ids          unique across the whole document
// Messages name the record and the field ("descents.d_hb2_hb3: parent "hb22" is not a person").
// checkLock compares a layout lock with its document.
import type { ChartDoc } from "./chart.ts";
import type { LockT } from "./lock.ts";

export interface Problem { level: "error" | "warning"; at: string; message: string }

type Rec = Record<string, unknown>;

/** the interface languages the viewer has (packages/viewer/src/i18n.ts) */
const VIEWER_LANGS = ["en", "id"];
/** the widths the engine draws notes at (compose.NOTE_WIDTHS); other widths are drawn at the nearest */
export const NOTE_WIDTHS = [240, 300, 360, 440, 560];

export function check(doc: ChartDoc): Problem[] {
  const out: Problem[] = [];
  const err = (at: string, message: string) => out.push({ level: "error", at, message });
  const warn = (at: string, message: string) => out.push({ level: "warning", at, message });

  const people = doc.people, unions = doc.unions ?? {}, descents = doc.descents ?? {}, houses = doc.houses;
  const notes = doc.notes ?? {}, media = doc.media ?? {}, glossary = doc.glossary ?? {}, sources = doc.sources ?? {};
  const isPerson = (id: string) => id in people;
  const needPerson = (at: string, field: string, id: string | undefined) => {
    if (id !== undefined && !isPerson(id)) err(at, `${field} "${id}" is not a person`);
  };
  const needHouse = (at: string, field: string, id: string | undefined) => {
    if (id !== undefined && !(id in houses)) err(at, `${field} "${id}" is not a house`);
  };
  const needMedia = (at: string, field: string, id: string | undefined, kind?: string) => {
    if (id === undefined) return;
    if (!(id in media)) err(at, `${field} "${id}" is not in media`);
    else if (kind && media[id].kind !== kind) err(at, `${field} "${id}" is a ${media[id].kind}, not a ${kind}`);
  };
  const needSources = (at: string, cites: { source: string }[] | undefined) =>
    (cites ?? []).forEach((c, i) => { if (!(c.source in sources)) err(`${at}.sources[${i}]`, `source "${c.source}" is not in sources`); });
  const adjustments = Object.entries(doc.adjustments ?? {});
  const rowMembers = new Set((doc.display?.rows ?? []).flatMap(r => r.members));

  // ---------------------------------------------------------------- ids unique across the document
  const seen = new Map<string, string>();
  const sections: [string, Rec | undefined][] = [["people", people], ["unions", unions], ["descents", descents],
    ["houses", houses], ["sources", sources], ["glossary", glossary], ["notes", notes], ["tours", doc.tours],
    ["media", media], ["adjustments", doc.adjustments], ["acceptedWarnings", doc.acceptedWarnings]];
  for (const [name, sec] of sections) for (const id of Object.keys(sec ?? {})) {
    if (seen.has(id)) err(`${name}.${id}`, `the id is also used in ${seen.get(id)}; ids must be unique across the document`);
    else seen.set(id, name);
  }

  // ---------------------------------------------------------------- people
  for (const [id, p] of Object.entries(people)) {
    const at = `people.${id}`;
    needHouse(at, "house", p.house);
    needSources(at, p.sources);
    for (const [i, r] of (p.reigns ?? []).entries()) { needHouse(`${at}.reigns[${i}]`, "court", r.court); needSources(`${at}.reigns[${i}]`, r.sources); }
    for (const ev of ["born", "died"] as const) (p[ev] ?? []).forEach((c, i) => needSources(`${at}.${ev}[${i}]`, c.sources));
    needMedia(at, "portrait", p.portrait, "portrait");
    if (p.portrait && media[p.portrait] && media[p.portrait].of !== id)
      err(at, `portrait "${p.portrait}" is the portrait of ${media[p.portrait].of ?? "no one"}`);
    if (p.show.beside) {
      needPerson(at, "show.beside.of", p.show.beside.of);
      if (p.show.beside.of === id) err(at, "is drawn beside themselves");
      const ids = Object.keys(people);
      if (isPerson(p.show.beside.of) && ids.indexOf(p.show.beside.of) > ids.indexOf(id))
        err(at, `show.beside.of "${p.show.beside.of}" must come before "${id}" in the file`);
      if (p.show.year !== undefined) warn(at, "show.year is not used for a person drawn beside a partner");
    } else if (p.show.year === undefined && !rowMembers.has(id)) err(at, "show.year is needed (or show.beside)");
    if (["ruler", "heir"].includes(p.show.box) && !p.house) err(at, `a ${p.show.box} box needs a house`);
    for (const [i, r] of (p.reigns ?? []).entries())
      if (p.house && r.court !== p.house) warn(`${at}.reigns[${i}]`, `court "${r.court}" differs from the person's house "${p.house}"`);
  }
  // crowns: no two reigns with the same number in one court
  const crowns = new Map<string, string>();
  for (const [id, p] of Object.entries(people)) for (const r of p.reigns ?? []) {
    const k = `${r.court} ${r.n}`;
    if (crowns.has(k)) err(`people.${id}`, `reign ${r.n} of ${r.court} is also given to ${crowns.get(k)}`);
    else crowns.set(k, id);
  }

  // ---------------------------------------------------------------- unions and descents
  for (const [id, u] of Object.entries(unions)) {
    const at = `unions.${id}`;
    u.partners.forEach((p, i) => needPerson(at, `partners[${i}]`, p));
    needSources(at, u.sources);
    if (u.partners[0] === u.partners[1]) err(at, "a union needs two different people");
    // partners are [left, right] as drawn: a spouse placed beside the other must be on the matching side
    const [l, r] = u.partners;
    if (people[r]?.show.beside?.of === l && people[r].show.beside.side === "l")
      warn(at, `partners are [left, right], but ${r} is drawn on the left of ${l}`);
    if (people[l]?.show.beside?.of === r && people[l].show.beside.side === "r")
      warn(at, `partners are [left, right], but ${l} is drawn on the right of ${r}`);
    needHouse(at, "show.colour", u.show?.colour);
    needHouse(at, "show.childColour", u.show?.childColour);
  }
  for (const [id, d] of Object.entries(descents)) {
    const at = `descents.${id}`;
    if (d.parent === undefined && d.union === undefined) err(at, "needs a parent, a union, or both");
    needPerson(at, "parent", d.parent);
    needPerson(at, "child", d.child);
    needSources(at, d.sources);
    if (d.union !== undefined && !(d.union in unions)) err(at, `union "${d.union}" is not a union`);
    if (d.parent === d.child) err(at, "a person cannot be their own parent");
    const u = d.union ? unions[d.union] : undefined;
    if (u?.partners.includes(d.child)) err(at, `the child "${d.child}" is a partner in ${d.union}`);
    if (u && d.parent !== undefined && !u.partners.includes(d.parent))
      err(at, `parent "${d.parent}" is not a partner in ${d.union}`);
    (d.through ?? []).forEach((t, i) => needPerson(at, `through[${i}]`, t));
    if (d.show?.drawn === false && !d.show?.hop) err(at, "show.drawn false needs show.hop: a line that is not drawn cannot place the child");
    // a couple's child (union only) is drawn with the marriage: only its line style is read
    if (d.parent === undefined && d.union !== undefined) {
      const extra = (["hop", "branch", "row", "break", "caption", "group"] as const).filter(k => d.show?.[k] !== undefined);
      if (extra.length) err(at, `show.${extra.join(", show.")} needs a parent: a couple's child (union only) takes only show.line; add "parent" (and keep "union" to hang it from the couple's line)`);
    }
  }

  // ---------------------------------------------------------------- the tree, built as compose.py builds it
  // ties: a person drawn beside a partner, or in a side-by-side row, stands on someone else's row
  const TIES = new Map<string, string>();
  for (const [id, p] of Object.entries(people)) if (p.show.beside && isPerson(p.show.beside.of)) TIES.set(id, p.show.beside.of);
  for (const r of doc.display?.rows ?? []) for (const m of r.members) if (isPerson(r.anchor)) TIES.set(m, r.anchor);
  for (const [id, to] of TIES) if (TIES.has(to))
    err(`people.${id}`, `is drawn beside ${to}, who is drawn beside ${TIES.get(to)}; draw them beside someone who stands on their own row`);
  const anchor = (k: string) => { for (let n = 0; TIES.has(k) && n < 50; n++) k = TIES.get(k)!; return k; };
  // follows: placed relative to someone else, not by the tree
  const FOLLOW = new Map<string, string>();
  for (const [id, a] of adjustments) if (a.kind === "follow") {
    if (a.target === a.of) err(`adjustments.${id}`, `${a.target} cannot follow themselves`);
    else FOLLOW.set(a.target, a.of);
  }
  for (const start of FOLLOW.keys()) {
    const path = [start];
    for (let k = FOLLOW.get(start); k !== undefined; k = FOLLOW.get(k)) {
      if (k === start) { err(`people.${start}`, `follows in a loop: ${[...path, k].join(" → ")}`); break; }
      if (path.includes(k) || path.length > 50) break;
      path.push(k);
    }
  }
  // groups of children under each anchor, and each child's tree parent
  const groups = new Map<string, string[]>(), treeParent = new Map<string, string>(), placedBy = new Map<string, string[]>();
  const place = (descId: string, kid: string, under: string) => {
    placedBy.set(kid, [...(placedBy.get(kid) ?? []), descId]);
    if (!treeParent.has(kid)) treeParent.set(kid, under);
    groups.set(under, [...(groups.get(under) ?? []), kid]);
    if (FOLLOW.has(under)) err(`descents.${descId}`, `${under} is placed by a follow adjustment, so their children would not be drawn; give this line show.hop, or place ${kid} elsewhere`);
  };
  for (const [id, d] of Object.entries(descents)) {
    if (!isPerson(d.child)) continue;
    if (d.parent !== undefined) {
      if (!isPerson(d.parent) || d.show?.hop || d.show?.branch || d.show?.row || TIES.has(d.child)) continue;
      place(id, d.child, anchor(d.parent));
    } else if (d.union && unions[d.union]) {
      const [a, b] = unions[d.union].partners;
      const anc = TIES.get(a) === b ? b : a;             // the partner the couple's line hangs from
      if (TIES.has(d.child)) {
        err(`descents.${id}`, `${d.child} is drawn beside ${TIES.get(d.child)}, so cannot also hang from the couple's line; give this descent a "parent" and show.hop`);
        continue;
      }
      if (TIES.has(anc)) {
        err(`descents.${id}`, `the couple's line hangs from ${anc}, who is drawn beside ${TIES.get(anc)} (not ${anc === a ? b : a}); its children would not be placed`);
        continue;
      }
      place(id, d.child, anc);
    }
  }
  for (const [child, ds] of placedBy)
    if (ds.length > 1) err(`people.${child}`, `is placed by two descents (${ds.join(", ")}); mark all but one with show.hop or show.branch`);
  const roots = Object.keys(people).filter(k => !TIES.has(k) && !FOLLOW.has(k) && !placedBy.has(k));
  if (roots.length !== 1)
    err("people", roots.length ? `the tree needs one root; ${roots.length} people have no placing parent: ${roots.join(", ")}`
                               : "the tree has no root (everyone has a parent)");
  // no one is their own ancestor (through the people they stand beside, as the engine sees it)
  const state = new Map<string, 1 | 2>();
  let cycles = 0;
  const visit = (k: string, path: string[]): void => {
    if (state.get(k) === 2) return;
    if (state.get(k) === 1) { cycles++; err(`people.${k}`, `is their own ancestor: ${[...path, k].join(" → ")}`); return; }
    state.set(k, 1);
    const up = treeParent.get(anchor(k));
    if (up !== undefined) visit(up, [...path, k]);
    state.set(k, 2);
  };
  for (const k of Object.keys(people)) visit(k, []);
  // everyone reachable from the root, as compose.subtree walks it
  if (roots.length === 1 && !cycles) {
    const reached = new Set<string>();
    const walk = (a: string) => {
      const members = [a, ...[...TIES].filter(([, p]) => p === a).map(([s]) => s)];
      members.push(...[...FOLLOW].filter(([, lead]) => members.includes(lead)).map(([f]) => f));
      members.forEach(m => reached.add(m));
      for (const k of groups.get(a) ?? []) if (!reached.has(k)) walk(k);
    };
    walk(roots[0]);
    const lost = Object.keys(people).filter(k => !reached.has(k) && !FOLLOW.has(k));
    if (lost.length) err("people", `not connected to the tree from ${roots[0]}: ${lost.join(", ")}`);
  }

  // ---------------------------------------------------------------- notes, media, display, panels, tours, timeline
  const lettered = new Map<string, string>();
  for (const [id, n] of Object.entries(notes)) {
    needPerson(`notes.${id}`, "anchor", n.anchor);
    needSources(`notes.${id}`, n.sources);
    if (!NOTE_WIDTHS.includes(n.show.width)) {
      const near = NOTE_WIDTHS.reduce((a, b) => Math.abs(b - n.show.width) < Math.abs(a - n.show.width) ? b : a);
      warn(`notes.${id}.show.width`, `${n.show.width} is drawn as ${near}; use one of ${NOTE_WIDTHS.join(", ")}`);
    }
    // a lettered note puts its letter on the box's corner: two would sit on top of each other
    if (!n.show.inline) {
      if (lettered.has(n.anchor)) err(`notes.${id}`, `${n.anchor} already has a lettered note (${lettered.get(n.anchor)}); their letters would overlap. Merge them, or make one inline`);
      else lettered.set(n.anchor, id);
    }
  }
  for (const [id, m] of Object.entries(media)) {
    if (m.kind === "portrait" && !m.of) err(`media.${id}`, "a portrait needs \"of\" (the person)");
    needPerson(`media.${id}`, "of", m.of);
  }
  const disp = doc.display ?? {};
  for (const [i, r] of (disp.rows ?? []).entries()) {
    needPerson(`display.rows[${i}]`, "anchor", r.anchor);
    r.members.forEach((m, j) => needPerson(`display.rows[${i}]`, `members[${j}]`, m));
  }
  for (const [id, pl] of Object.entries(disp.pills ?? {})) { needPerson("display.pills", "key", id); needHouse(`display.pills.${id}`, "house", pl.house); }
  for (const [id, h] of Object.entries(disp.headers ?? {})) { needPerson("display.headers", "key", id); needMedia(`display.headers.${id}`, "emblem", h.emblem, "emblem"); }
  for (const [i, b] of (disp.brackets ?? []).entries()) b.members.forEach((m, j) => needPerson(`display.brackets[${i}]`, `members[${j}]`, m));
  for (const id of Object.keys(disp.events ?? {})) needPerson("display.events", "key", id);
  const pan = doc.panels;
  (pan.badges ?? []).forEach((b, i) => needMedia("panels.badges", `[${i}]`, b));
  if (pan.key) { needHouse("panels.key", "house", pan.key.house); needHouse("panels.key", "contrast", pan.key.contrast); }
  if (pan.succession) needHouse("panels", "succession.court", pan.succession.court);
  // a succession table needs reigns in its court
  if (pan.succession && !Object.values(doc.people).some((p: any) => (p.reigns ?? []).some((r: any) => r.court === pan.succession!.court)))
    warn("panels.succession", `no one reigns in "${pan.succession.court}", so the table would be empty`);
  // one marriage line per couple: a second union of the same two people would be drawn on top of the first
  const pairs = new Map<string, string>();
  for (const [uid, u] of Object.entries<any>(doc.unions ?? {})) {
    const k = [...u.partners].sort().join(" ");
    if (pairs.has(k)) err(`unions.${uid}`, `${u.partners.join(" and ")} are already a couple in ${pairs.get(k)}; the engine draws one line per couple, so give their children to that union`);
    else pairs.set(k, uid);
  }
  // the viewer's interface languages (packages/viewer/src/i18n.ts, LANGS)
  for (const l of pan.viewer?.languages ?? [])
    if (!VIEWER_LANGS.includes(l.slice(0, 2).toLowerCase())) warn("panels.viewer.languages", `the viewer has no "${l}" interface; it offers ${VIEWER_LANGS.join(", ")}`);
  // fonts the engine has (model.py SANS, SCRIPT, JAVANESE); CHART_FONTS_EXTRA can add sans and script fonts
  const FONTS: Record<string, string[]> = { sans: ["gantari", "altehaas"], script: ["felipa", "chancery"],
    secondScript: ["noto", "noto-jp", "javatext"], javanese: ["noto", "noto-jp", "javatext"] };
  for (const [k, known] of Object.entries(FONTS)) {
    const v = (doc.theme?.fonts as Record<string, string> | undefined)?.[k];
    if (v !== undefined && !known.includes(v))
      (k === "sans" || k === "script" ? warn : err)(`theme.fonts.${k}`, `the engine has no font "${v}"; it knows ${known.join(", ")}`);
  }
  for (const [hid, h] of Object.entries(doc.houses ?? {}))
    for (const v of typeof h.reign === "string" ? [h.reign] : Object.values(h.reign ?? {}))
      if (!/\{n(th)?\}/.test(v)) warn(`houses.${hid}.reign`, `"${v}" has no {n} or {nth}, so every reign reads the same`);
  if (pan.scale) [...pan.scale.row, ...pan.scale.trunk, pan.scale.documented].forEach(k => needPerson("panels.scale", "person", k));
  // the map panel: its data in media, and every view, colour and area it names
  const mapIds = new Set<string>();
  if (pan.map) {
    const m = pan.map, at = "panels.map";
    for (const [f, id] of Object.entries(m.boundaries)) needMedia(at, `boundaries.${f}`, id, "data");
    needMedia(at, "assignments", m.assignments, "data");
    needMedia(at, "shapes", m.shapes, "data");
    const houseIds = new Set(Object.keys(doc.houses ?? {}));
    const palette = new Set(Object.keys((doc.theme as any)?.palette ?? {}));
    const colourOk = (ref: string, depth = 0): boolean => {
      if (/^#[0-9A-Fa-f]{6}$/.test(ref)) return true;
      const h = /^house:([a-z][a-z0-9_]*)(\+(0(\.\d+)?|1))?$/.exec(ref);
      if (h) return houseIds.has(h[1]);
      const p = /^palette:(\w+)$/.exec(ref);
      if (p) return palette.has(p[1]);
      return depth === 0 && ref in m.colours && colourOk(m.colours[ref], 1);
    };
    for (const [k, v] of Object.entries(m.colours)) if (!colourOk(v, 1)) err(`${at}.colours.${k}`, `"${v}" is not a colour (#RRGGBB, house:<id>, house:<id>+0.6, palette:<key>)`);
    const needFill = (where: string, f: string) => {
      const parts = f.split("/");
      if (parts.length > 2 || !parts.every(x => colourOk(x))) err(where, `"${f}" is not a fill: a colour or "a/b", each a colour or a name in panels.map.colours`);
    };
    for (const [i, mp] of m.maps.entries()) {
      const w = `${at}.maps[${i}]`;
      if (mapIds.has(mp.id)) err(w, `map "${mp.id}" appears twice`);
      mapIds.add(mp.id);
      if (!(mp.view in m.views)) err(w, `view "${mp.view}" is not in panels.map.views`);
      needFill(`${w}.default`, mp.default);
      for (const [k, f] of Object.entries(mp.fills)) needFill(`${w}.fills.${k}`, f);
      for (const [k, f] of Object.entries(mp.regions ?? {})) needFill(`${w}.regions.${k}`, f);
      (mp.overlays ?? []).forEach((o, j) => {
        if (!(o.area in (m.areas ?? {}))) err(`${w}.overlays[${j}]`, `area "${o.area}" is not in panels.map.areas`);
        needFill(`${w}.overlays[${j}]`, o.fill);
      });
      (mp.marks ?? []).forEach((mk, j) => {
        if (mk.kind === "dot") needFill(`${w}.marks[${j}]`, mk.fill);
        if (mk.kind === "frame" && !(mk.view in m.views)) err(`${w}.marks[${j}]`, `view "${mk.view}" is not in panels.map.views`);
      });
    }
    (m.legend ?? []).forEach((it, i) => needFill(`${at}.legend[${i}]`, "fill" in it ? it.fill : it.dot));
  }
  for (const [tid, tour] of Object.entries(doc.tours ?? {})) tour.steps.forEach((st, i) => {
    const at = `tours.${tid}.steps[${i}]`;
    if (Array.isArray(st.focus)) st.focus.filter(f => !f.startsWith("map:")).forEach(f => needPerson(at, "focus", f));
    const stages = [...(Array.isArray(st.focus) ? st.focus.filter(f => f.startsWith("map:")).map(f => f.slice(4)) : []), ...(st.stage ? [st.stage] : [])];
    for (const s of stages) if (!mapIds.has(s)) err(at, `map stage "${s}" is not in panels.map.maps`);
    (st.light ?? []).forEach(f => needPerson(at, "light", f));
    needPerson(at, "lineage", st.lineage);
  });
  const eraYears = new Map<number, number>();
  for (const [i, e] of (doc.timeline?.eras ?? []).entries()) {
    if (eraYears.has(e.year)) err(`timeline.eras[${i}]`, `another era (eras[${eraYears.get(e.year)}]) starts in ${e.year}`);
    else eraYears.set(e.year, i);
  }
  for (const [i, e] of (doc.timeline?.episodes ?? []).entries())
    if (e.to < e.from) err(`timeline.episodes[${i}]`, `ends (${e.to}) before it starts (${e.from})`);

  // ---------------------------------------------------------------- adjustments: the target is the right kind
  const kindOf: Record<string, [string, Rec]> = {
    nudge: ["person", people], follow: ["person", people], markerTop: ["person", people], textLift: ["person", people],
    headerLeft: ["person", people], coupleSide: ["union", unions], shareBus: ["descent", descents],
    breakAt: ["descent", descents], drop: ["descent", descents], noteOffset: ["note", notes],
  };
  for (const [id, a] of adjustments) {
    const at = `adjustments.${id}`;
    const kind = kindOf[a.kind];
    if (!kind) continue;                                  // refused by the schema
    if (!(a.target in kind[1])) err(at, `target "${a.target}" is not a ${kind[0]}`);
    if (a.kind === "follow") needPerson(at, "of", a.of);
    if (a.kind === "shareBus" || a.kind === "breakAt" || a.kind === "drop") {
      const d = descents[a.target];
      if (d && d.parent === undefined) err(at, `target "${a.target}" is a couple's child; ${a.kind} needs a line from one parent`);
    }
    if ((a.kind === "nudge" || a.kind === "noteOffset") && !a.dx && !a.dy) warn(at, "moves nothing (no dx or dy)");
  }
  const nudged = new Map<string, string>();
  for (const [id, a] of adjustments) {
    const k = `${a.kind} ${a.target}`;
    if (nudged.has(k)) err(`adjustments.${id}`, `${a.target} already has a ${a.kind} adjustment (${nudged.get(k)})`);
    else nudged.set(k, id);
  }

  // ---------------------------------------------------------------- text
  // any "<" must open an allowed tag: an unclosed "<img …" would become live HTML in the page
  const MARKUP = /<(?!(?:\/?[bi]|br\s*\/?)>)/i;
  const texts = (v: unknown): string[] => typeof v === "string" ? [v] : v && typeof v === "object" ? Object.values(v as Rec).flatMap(texts) : [];
  const markup = (at: string, v: unknown) => {
    for (const s of texts(v)) {
      const m = MARKUP.exec(s);
      if (m) err(at, `markup "${s.slice(m.index, m.index + 24)}" is not allowed; use <b>, <i> or <br> (write a plain < as &lt;)`);
    }
  };
  for (const [id, p] of Object.entries(people)) { markup(`people.${id}.name`, p.name); markup(`people.${id}.show.sub`, p.show.sub); }
  for (const [id, n] of Object.entries(notes)) markup(`notes.${id}.text`, n.text);
  markup("panels.intro", pan.intro);
  markup("panels.caveats", pan.caveats);
  markup("panels.sources", pan.sources);
  markup("meta.title", doc.meta.title);
  markup("meta.subtitle", doc.meta.subtitle);

  // text by language: the languages are the document's (a script form such as jv-Java is a transcription)
  const langs = new Set(doc.meta.languages);
  const langCheck = (at: string, v: unknown) => {
    if (!v || typeof v !== "object" || Array.isArray(v)) return;
    for (const tag of Object.keys(v as Rec))
      if (!langs.has(tag) && !/-[A-Z][a-z]{3}(-|$)/.test(tag)) warn(at, `text in "${tag}", which is not in meta.languages (${[...langs].join(", ")})`);
  };
  for (const [id, p] of Object.entries(people)) { langCheck(`people.${id}.name`, p.name); langCheck(`people.${id}.show.sub`, p.show.sub); }
  for (const [id, n] of Object.entries(notes)) langCheck(`notes.${id}.text`, n.text);
  for (const [id, g] of Object.entries(glossary)) langCheck(`glossary.${id}.gloss`, g.gloss);
  langCheck("meta.title", doc.meta.title);
  langCheck("meta.subtitle", doc.meta.subtitle);
  langCheck("panels.intro", pan.intro);

  // titles: each word should be explained by the glossary (longest terms first: "Ki Ageng" before "Ki")
  const terms = Object.values(glossary).map(g => g.term.toLowerCase().replace(/\.$/, "").split(/\s+/))
    .sort((a, b) => b.length - a.length);
  for (const [id, p] of Object.entries(people)) {
    if (!p.title) continue;
    const words = p.title.toLowerCase().split(/\s+/).map(w => w.replace(/\.$/, ""));
    for (let i = 0; i < words.length;) {
      const hit = terms.find(t => t.every((w, k) => words[i + k] === w));
      if (!hit) { warn(`people.${id}`, `title word "${p.title.split(/\s+/)[i]}" is not in the glossary`); break; }
      i += hit.length;
    }
  }
  // the default language is one of the document's languages
  if (!doc.meta.languages.includes(doc.meta.defaultLang)) err("meta", `defaultLang "${doc.meta.defaultLang}" is not in languages`);
  return out;
}

/** a layout lock against its document: the same chart, and no positions for people or notes it lacks */
export function checkLock(lock: LockT, doc: ChartDoc): Problem[] {
  const out: Problem[] = [];
  if (lock.chart !== doc.meta.id) out.push({ level: "error", at: "lock.chart", message: `"${lock.chart}" is not this document's chart ("${doc.meta.id}")` });
  const unknown = (sec: string, keys: string[], known: Record<string, unknown>, what: string) => {
    const bad = keys.filter(k => !(k in known));
    if (bad.length) out.push({ level: "error", at: `lock.${sec}`, message: `${bad.length} not in the document's ${what}: ${bad.slice(0, 10).join(", ")}${bad.length > 10 ? ", ..." : ""}` });
  };
  unknown("boxes", Object.keys(lock.boxes), doc.people, "people");
  unknown("notes", Object.keys(lock.notes), doc.notes ?? {}, "notes");
  unknown("letters", Object.keys(lock.letters), doc.notes ?? {}, "notes");
  const missing = Object.keys(doc.people).filter(k => !(k in lock.boxes));
  if (missing.length) out.push({ level: "warning", at: "lock.boxes", message: `${missing.length} people have no locked position (accept the layout: npm run build:chart -- <chart.json> --update-lock, or Keep this layout in the editor): ${missing.slice(0, 10).join(", ")}` });
  return out;
}

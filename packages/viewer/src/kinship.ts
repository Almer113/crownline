// Relationship finder (PLAN Phase 3, item 3): the shortest family path between two people on the chart and a
// plain-language description of it. Terms are gender-neutral ("grandchild", "sibling's child"): the chart
// records titles, not sex, and guessing from a title would sometimes be wrong. Where the chart skips
// generations ("grandson", "descendant" gaps) the count includes them; "descendant" gaps are of unknown
// length, so a run through one is named only as "descendant", "ancestor" or "blood relative".
import type { Kin, Layout } from "./layout";
import type { Lang } from "./i18n";

export type StepKind = "up" | "down" | "spouse";
export interface Step { from: string; to: string; kind: StepKind; gens: number; unsure: boolean }
/** a sentence as text and person references, so names can be drawn as links */
export type Phrase = (string | { id: string })[];
export interface Relation { path: string[]; steps: Step[]; summary: Phrase[]; unsure: boolean }

const GENS: Record<string, number> = { grandson: 2, granddaughter: 2, descendant: 2 };

function edges(layout: Layout, id: string): Step[] {
  const f = layout.people[id]?.family;
  if (!f) return [];
  const mk = (list: Kin[], kind: StepKind): Step[] => list.filter(k => layout.people[k.id] && !k.via).map(k => ({
    from: id, to: k.id, kind, gens: kind === "spouse" ? 0 : (k.gap ? GENS[k.gap] ?? 2 : 1), unsure: k.gap === "descendant" }));
  return [...mk(f.parents, "up"), ...mk(f.children, "down"), ...mk(f.spouses, "spouse")];
}

/** a marriage step counts a little over two blood steps: a blood tie wins unless it is more than one step
 *  longer (hb1 to mn1 reads "nephew", not "father of his wife") */
const SPOUSE_COST = 2.1;

/** the closest family path, by the costs above */
export function findPath(layout: Layout, a: string, b: string): Step[] | null {
  if (a === b) return [];
  const cost = new Map<string, number>([[a, 0]]), via = new Map<string, Step>();
  let frontier = [a];
  while (frontier.length) {
    const next: string[] = [];
    for (const id of frontier) for (const e of edges(layout, id)) {
      const c = cost.get(id)! + (e.kind === "spouse" ? SPOUSE_COST : 1);
      if (c < (cost.get(e.to) ?? Infinity)) { cost.set(e.to, c); via.set(e.to, e); next.push(e.to); }
    }
    frontier = next;
  }
  if (!via.has(b)) return null;
  const steps: Step[] = [];
  for (let k = b; k !== a; k = via.get(k)!.from) steps.unshift(via.get(k)!);
  return steps;
}

const great = (n: number) => "great-".repeat(n);
const ORD = ["", "first", "second", "third", "fourth", "fifth", "sixth"];
const TIMES = ["", "once", "twice", "three times", "four times"];

/** what `b` is to `a`, `up` generations from a to the shared ancestor and `down` from there to b: the term
 *  and a qualifier that Indonesian puts after the name ("sepupu Agung (selisih 1 generasi)") */
function term(lang: Lang, up: number, down: number, half: boolean, unsure: boolean): [string, string] {
  if (lang === "id") {
    if (unsure) return [up === 0 ? "keturunan" : down === 0 ? "leluhur" : "kerabat sedarah", ""];
    if (up === 0) return down <= 4 ? [["", "anak", "cucu", "cicit", "piut"][down], ""] : ["keturunan", ` (${down} generasi)`];
    if (down === 0) return up <= 4 ? [["", "orang tua", "kakek atau nenek", "buyut", "orang tua buyut"][up], ""] : ["leluhur", ` (${up} generasi)`];
    if (up === 1 && down === 1) return [half ? "saudara tiri" : "saudara", ""];
    if (up === 1) return down === 2 ? ["keponakan", ""] : down === 3 ? ["cucu saudara", ""] : ["keturunan saudara", ` (${down - 1} generasi)`];
    if (down === 1) return up === 2 ? ["paman atau bibi", ""] : up === 3 ? ["saudara kakek atau nenek", ""] : ["saudara leluhur", ` (${up - 1} generasi ke atas)`];
    const deg = Math.min(up, down) - 1, rem = Math.abs(up - down);
    const KALI = ["", "", "dua kali", "tiga kali", "empat kali", "lima kali"];
    return [`sepupu${deg > 1 ? " " + (KALI[deg] ?? `${deg} kali`) : ""}`, rem ? ` (selisih ${rem} generasi)` : ""];
  }
  if (unsure) return [up === 0 ? "descendant" : down === 0 ? "ancestor" : "blood relative", ""];
  if (up === 0) return [down === 1 ? "child" : down <= 5 ? `${great(down - 2)}grandchild` : `descendant (${down} generations)`, ""];
  if (down === 0) return [up === 1 ? "parent" : up <= 5 ? `${great(up - 2)}grandparent` : `ancestor (${up} generations)`, ""];
  if (up === 1 && down === 1) return [half ? "half-sibling" : "sibling", ""];
  if (up === 1) return [down === 2 ? "nephew or niece" : down <= 6 ? `${great(down - 3)}grandnephew or grandniece`
    : `descendant of a sibling (${down - 1} generations)`, ""];
  if (down === 1) return [up === 2 ? "uncle or aunt" : up <= 6 ? `${great(up - 2)}uncle or aunt`
    : `sibling of an ancestor (${up - 1} generations up)`, ""];
  const deg = Math.min(up, down) - 1, rem = Math.abs(up - down);
  return [`${ORD[deg] ?? `${deg}th`} cousin${rem ? ` ${TIMES[rem] ?? `${rem} times`} removed` : ""}`, ""];
}

const TPL: Record<Lang, { is: string; spouse: string; via: string; and: string }> = {
  en: { is: "{b} is {a}'s {term}{q}", spouse: "{b} is {a}'s spouse", via: ", through ", and: " and " },
  id: { is: "{b} adalah {term} {a}{q}", spouse: "{b} adalah pasangan {a}", via: ", melalui ", and: " dan " },
};

function phrase(tpl: string, a: string, b: string, [termText, q]: [string, string] = ["", ""]): Phrase {
  return tpl.split(/(\{a\}|\{b\}|\{term\}|\{q\})/).filter(Boolean)
    .map(p => (p === "{a}" ? { id: a } : p === "{b}" ? { id: b } : p === "{term}" ? termText : p === "{q}" ? q : p))
    .filter(p => p !== "");
}

function isHalf(layout: Layout, a: string, b: string): boolean {
  const pa = layout.people[a]?.family?.parents.filter(k => !k.via).map(k => k.id) ?? [], pb = layout.people[b]?.family?.parents.filter(k => !k.via).map(k => k.id) ?? [];
  return pa.length === 2 && pb.length === 2 && pa.filter(x => pb.includes(x)).length === 1;
}

/** a person's name, with the first part of their card's line (or title) when another person shares it */
export function label(layout: Layout, id: string): string {
  const p = layout.people[id];
  if (!p) return id;
  const same = Object.values(layout.people).filter(q => q.name === p.name);
  if (same.length < 2) return p.name;
  const sub = p.sub.split("·")[0].trim();
  const extra = sub && same.filter(q => q.sub.split("·")[0].trim() === sub).length === 1 ? sub : p.title || sub;
  return extra ? `${p.name} (${extra})` : p.name;
}

export function relate(layout: Layout, a: string, b: string, lang: Lang): Relation | null {
  const steps = findPath(layout, a, b);
  if (!steps) return null;
  const path = [a, ...steps.map(s => s.to)];
  const tp = TPL[lang], summary: Phrase[] = [];
  // split the path into blood runs (up..., then down...) separated by marriages
  let i = 0;
  while (i < steps.length) {
    const s = steps[i];
    if (s.kind === "spouse") { summary.push(phrase(tp.spouse, s.from, s.to)); i++; continue; }
    const start = s.from;
    let up = 0, down = 0, j = i;
    while (j < steps.length && steps[j].kind === "up" && down === 0) up += steps[j++].gens;
    while (j < steps.length && steps[j].kind === "down") down += steps[j++].gens;
    const end = steps[j - 1].to, run = steps.slice(i, j);
    const ph = phrase(tp.is, start, end,
      term(lang, up, down, up === 1 && down === 1 && isHalf(layout, start, end), run.some(r => r.unsure)));
    // a straight line up or down: name who it passes through (up to three people)
    const mids = run.slice(0, -1).map(r => r.to);
    if ((up === 0 || down === 0) && mids.length && mids.length <= 3) {
      ph.push(tp.via);
      mids.forEach((m, k) => { if (k) ph.push(k === mids.length - 1 ? tp.and : ", "); ph.push({ id: m }); });
    }
    summary.push(ph);
    i = j;
  }
  return { path, steps, summary, unsure: steps.some(s => s.unsure) };
}

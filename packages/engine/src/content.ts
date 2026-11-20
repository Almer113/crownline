// What the page prints from the document beyond the boxes (the Python chartdoc.py): the title and its
// second script, the succession table worked out from the reigns and descents, the sources text.
import { type Doc, text } from "./doc.ts";

/** a row of the succession table: number, name, years, how they came to rule, a divider above it (or null) */
export type SuccRow = [number, string, string, string, string | null];

const NUMERAL = /^([IVXLC]+|\d+)$/;

/** names without a family name most of them share ("Tokugawa Ietsuna" -> "Ietsuna"); only when more than
 *  half the names start with it, and never leaving a bare regnal number ("Pakubuwana II" stays) */
export function shortNames(names: string[]): (n: string) => string {
  const first = names.filter(n => n.includes(" ")).map(n => n.split(" ")[0]);
  const count = (w: string) => first.filter(f => f === w).length;
  let common: string | null = null;
  for (const w of new Set(first)) if (common === null || count(w) > count(common)) common = w;   // ties: the first seen
  if (!common || count(common) * 2 <= names.length) return n => n;
  const c = common;
  return n => {
    const rest = n.slice(n.indexOf(" ") + 1);
    return n.startsWith(c + " ") && !NUMERAL.test(rest) ? rest : n;
  };
}

/** rows of the succession table (panels.succession): son, brother, grandson, adopted heir or named successor
 *  of the one before, a restored reign, and the birth father with his house when it is another house */
export function succession(doc: Doc): [string, SuccRow[]] | null {
  const panels = (doc.panels ?? {}) as Record<string, any>, spec = panels.succession;
  if (!spec) return null;
  const people = doc.people as Record<string, any>, unions = (doc.unions ?? {}) as Record<string, any>;
  const reigns = Object.entries(people).flatMap(([pid, p]) => (p.reigns ?? []).filter((r: any) => r.court === spec.court)
    .map((r: any) => [r.n as number, pid, r] as const));
  reigns.sort((a, b) => a[0] - b[0]);                 // stable, as Python's sorted
  const name = (pid: string) => text(doc, people[pid].name);
  const sex = (pid: string) => people[pid]?.sex;
  const short = shortNames(reigns.map(([, pid]) => name(pid)));
  const word = (pid: string, m: string, f: string, x: string) => (sex(pid) === "m" ? m : sex(pid) === "f" ? f : x);
  const birth = new Map<string, string[]>(), links = new Map<string, [string, string]>();
  for (const d of Object.values((doc.descents ?? {}) as Record<string, any>)) {
    let ps: string[] = d.union ? [...unions[d.union].partners] : [];
    if (d.parent) ps = [d.parent, ...ps.filter(x => x !== d.parent)];
    if ((d.kind ?? "birth") === "birth") {
      const have = birth.get(d.child) ?? [];
      birth.set(d.child, [...have, ...ps.filter(x => !have.includes(x))]);
    } else for (const x of ps) links.set(`${x} ${d.child}`, [d.kind, text(doc, d.show?.caption ?? "")]);
  }
  const house = (pid: string) => people[pid]?.house;
  const houses = doc.houses as Record<string, any>;
  const rows: SuccRow[] = [];
  let prev: string | null = null;
  const seen = new Set<string>();
  for (const [n, pid, r] of reigns) {
    const parents = birth.get(pid) ?? [];
    // the father: a parent recorded as male; else the parent the line comes from, when it names one
    const f = parents.find(p => sex(p) === "m") ?? (parents.length === 1 ? parents[0] : null);
    const child = word(pid, "son", "daughter", "child");
    let born = "";
    if (f) {
      born = `${child} of ${short(name(f))}`;
      const hn = house(f) in houses ? text(doc, houses[house(f)].name) : "";
      if (hn && house(f) !== house(pid) && !name(f).includes(hn)) born += ` (${hn})`;
    } else if (parents.length) born = `${child} of ` + parents.slice(0, 2).map(p => short(name(p))).join(" and ");
    let how = born;
    if (seen.has(pid) && prev !== pid) how = "restored";
    else if (prev && prev !== pid) {
      const p = short(name(prev)), pv = prev;
      if (parents.includes(pv)) how = `${child} of ${p}`;
      else if (parents.some(x => (birth.get(x) ?? []).includes(pv)))
        how = `${word(pid, "grandson", "granddaughter", "grandchild")} of ${p}` + (born ? `; ${born}` : "");
      else if (parents.length && parents.some(x => (birth.get(pv) ?? []).includes(x)))
        how = `${word(pid, "brother", "sister", "sibling")} of ${p}`
          + (links.get(`${pv} ${pid}`)?.[0] === "adoptive" ? `, adopted as ${word(pv, "his", "her", "their")} heir` : "");
      else if (links.has(`${pv} ${pid}`)) {
        const [kind, cap] = links.get(`${pv} ${pid}`)!;
        how = (kind === "adoptive" ? `adopted heir of ${p}` : `${cap || "successor"} of ${p}`) + (born ? `; ${born}` : "");
      }
    }
    // a new section where the kind of box changes, headed by that kind's wording in the Key
    const box = people[pid].show?.box ?? "ruler";
    let div: string | null = null;
    if (prev && box !== (people[prev].show?.box ?? "ruler")) div = text(doc, panels.key?.labels?.[box] ?? "");
    const when = r.when ?? {};
    rows.push([n, short(name(pid)), when.text || (when.edtf ?? "").split("/").join(" – "), how, div]);
    prev = pid;
    seen.add(pid);
  }
  return [text(doc, spec.title ?? "The succession"), rows];
}

/** the title in a second script (a language tag with a script subtag, such as jv-Java), or "" */
export function titleScript(doc: Doc): string {
  const t = doc.meta.title as unknown;
  if (!t || typeof t !== "object") return "";
  return Object.entries(t as Record<string, string>).find(([k]) => /^[a-z]{2,3}-[A-Z][a-z]{3}$/.test(k))?.[1] ?? "";
}

/** the footer's sources text for a public or a private build */
export function sourcesText(doc: Doc, isPublic: boolean): string {
  return (((doc.panels as any).sources ?? []) as any[])
    .map(part => (typeof part === "string" ? part : part[isPublic ? "public" : "private"] ?? "")).join("");
}

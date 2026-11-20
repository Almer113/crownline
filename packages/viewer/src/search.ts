// Search (PLAN Phase 3, item 4): people by name, title or house. Javanese names have many spellings
// (Hamengkubuwono / Hamengkubuwana, Djokjakarta / Yogyakarta, Soerakarta / Surakarta), so both the query and the
// chart text are folded to one spelling before matching; reign numbers match as Roman or Arabic numerals
// ("HB 9", "hamengkubuwono ix"). Per-person aliases can be added to the layout file later (`aliases`).
import type { Layout, Person } from "./layout";

/** one spelling for the many: lower case, no accents, old Dutch-era spellings to modern; a/e/o and j/y merged
 *  (Mangkunegara / Mangkunagara, Hamengkubuwono / Hamengkubuwana, Djokja / Jogja / Yogya) */
export function fold(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[‘’“”"'`.]/g, "")
    .replace(/oe/g, "u").replace(/dj/g, "j").replace(/tj/g, "c").replace(/ch/g, "c")
    .replace(/y/g, "j").replace(/[oe]/g, "a").replace(/kh/g, "k").replace(/kj/g, "gj").replace(/(.)\1/g, "$1");
}

const ROMAN: Record<string, number> = { i: 1, v: 5, x: 10, l: 50 };
function roman(s: string): number | null {
  if (!/^[ivxl]{1,6}$/.test(s)) return null;
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    const v = ROMAN[s[i]], w = ROMAN[s[i + 1]] ?? 0;
    n += v < w ? -v : v;
  }
  return n > 0 && n < 60 ? n : null;
}

/** common short forms of the reigning names */
const ABBR: Record<string, string> = {
  hb: "hamengkubuwana", pb: "pakubuwana", mn: "mangkunegara", pa: "pakualam", am: "amangkurat",
  jogja: "jogjakarta", solo: "surakarta", sala: "surakarta", kiai: "kyai",
};

/** words a reader may add that the card need not carry ("Sunan Pakubuwana", "Prince Diponegoro"): they count
 *  when they match and are skipped when they do not */
const SOFT = new Set(["sunan", "susuhunan", "sultan", "prince", "princess", "king", "queen", "kanjeng", "gusti",
  "raden", "pangeran", "ratu", "sri", "the", "of", "and"].map(fold));

/** other names a person is known by, until the chart document carries them (Phase 4) */
const ALIASES: Record<string, string[]> = {
  senapati: ["Sutawijaya", "Danang Sutawijaya"],
  agung: ["Hanyakrakusuma", "Mas Rangsang"],
  pb14h: ["Hangabei", "Hangabehi"],
};

interface Entry { id: string; p: Person; name: string; title: string; all: string; notes: string; num: number | null }

export interface Hit { id: string; person: Person }

export class Search {
  private readonly entries: Entry[] = [];

  constructor(private readonly layout: Layout) {
    const houseName: Record<string, string> = {};
    for (const [hid, h] of Object.entries(layout.headers)) {
      const house = layout.people[hid]?.house;
      if (house) houseName[house] = `${h.name} ${house}`;
    }
    for (const [id, p] of Object.entries(layout.people)) {
      const words = p.name.split(/\s+/), last = words[words.length - 1].toLowerCase();
      const num = words.length > 1 ? roman(last) : null;
      const name = fold(num ? words.slice(0, -1).join("") : p.name).replace(/\s+/g, "");
      const aliases = [...(p.aliases ?? []), ...(p.aka ?? []), ...(ALIASES[id] ?? [])].join(" ");
      const all = fold([p.title, p.name, p.sub, aliases, houseName[p.house] ?? ""].join(" ")).replace(/\s+/g, "");
      // the notes too ("Sambernyawa", "Ratu Kidul"), ranked below matches on the card itself
      const notes = fold((p.notes ?? []).map(n => n.text).join(" ")).replace(/\s+/g, "");
      this.entries.push({ id, p, name, title: fold(p.title ?? "").replace(/\s+/g, ""), all, notes, num });
    }
  }

  find(query: string, limit = 8): Hit[] {
    const raw = query.toLowerCase().replace(/([a-z])(\d)/g, "$1 $2").split(/[\s,]+/).filter(Boolean);
    let num: number | null = null;
    const words: string[] = [];
    for (const w of raw) {
      const n = /^\d+$/.test(w) ? Number(w) : raw.length > 1 ? roman(w) : null;
      if (n !== null) num = n; else words.push(fold(ABBR[w] ?? w));
    }
    if (!words.length && num === null) return [];
    const scored: { e: Entry; score: number }[] = [];
    for (const e of this.entries) {
      if (num !== null && e.num !== num) continue;
      // a soft word that matches nothing is dropped, unless it is all the reader typed
      const need = words.filter(w => !SOFT.has(w) || e.all.includes(w) || words.every(x => SOFT.has(x)));
      if (!need.length && num === null) continue;
      const onCard = need.every(w => e.all.includes(w));
      if (!onCard && !need.every(w => e.all.includes(w) || e.notes.includes(w))) continue;
      let score = onCard ? 0 : -3;
      // the name counts most, then the title; a word found only in the card's line or house counts least
      for (const w of need) score += e.name.startsWith(w) ? 4 : e.name.includes(w) ? 2 : e.title.includes(w) ? 1 : -1;
      if (e.p.kind === "ruler") score += 1.5;
      score -= e.name.length / 100;
      scored.push({ e, score });
    }
    scored.sort((a, b) => b.score - a.score || a.e.p.year - b.e.p.year);
    return scored.slice(0, limit).map(({ e }) => ({ id: e.id, person: e.p }));
  }
}

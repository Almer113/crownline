// Glossary on demand (PLAN Phase 3, item 8): the meaning of the titles on a card ("SRI SULTAN", "KGPAA") or at
// the start of a name ("KRAy. Winari"), from the chart's own glossary. Longest match first, so "Ki Ageng" wins
// over "Ki" and "Ratu Ageng" over "Ratu".
import type { Layout } from "./layout";

export interface Gloss { term: string; full: string; meaning: string }

export class Glossary {
  private readonly terms: { words: string[]; g: Gloss }[];

  constructor(layout: Layout) {
    const norm = (s: string) => s.toLowerCase().replace(/\.$/, "");
    this.terms = (layout.glossary ?? []).map(g => ({ words: g.term.split(/\s+/).map(norm),
                                                      g }))
      .sort((a, b) => b.words.length - a.words.length);
  }

  /** the glossary entries for the leading title words of `text`; stops at the first word that is not a title */
  lookup(text: string): Gloss[] {
    const words = text.trim().split(/\s+/).map(w => w.toLowerCase().replace(/\.$/, ""));
    const out: Gloss[] = [];
    let i = 0;
    while (i < words.length) {
      const hit = this.terms.find(t => t.words.every((w, k) => words[i + k] === w));
      if (!hit) break;
      out.push(hit.g);
      i += hit.words.length;
    }
    return out;
  }
}

// Text width from the font file (PLAN Phase 5, step 1): unrounded advance widths plus GPOS 'kern' pair
// adjustments, every kern lookup adding to the total, as Chrome (HarfBuzz) lays Latin text out. The same
// arithmetic as the Python engine's textmeasure.py, in the same order, so the two agree exactly.
import { parseFont, type Font } from "./font.ts";

export class Measure {
  private readonly font: Font;
  private readonly units = new Map<string, number>();

  constructor(bytes: Uint8Array, readonly name = "font") {
    this.font = parseFont(bytes);
  }

  get unitsPerEm(): number { return this.font.unitsPerEm; }

  /** the pair adjustment between two glyphs, in font units */
  kern(a: number, b: number): number {
    let total = 0;
    for (const subs of this.font.kern) {              // lookups add up
      for (const s of subs) {                         // within one, the first subtable that covers the pair
        if (!s.cover.has(a)) continue;
        if (s.kind === "pair") {
          const v = s.pairs.get(a * 65536 + b);
          if (v === undefined) continue;
          total += v;
          break;
        }
        total += s.recs[s.c1.get(a) ?? 0]?.[s.c2.get(b) ?? 0] ?? 0;
        break;
      }
    }
    return total;
  }

  /** width of `text` in font units; a character the font lacks is an error (Chrome would use another font) */
  textUnits(text: string): number {
    const hit = this.units.get(text);
    if (hit !== undefined) return hit;
    const chars = [...text], missing = [...new Set(chars.filter(c => !this.font.cmap.has(c.codePointAt(0)!)))];
    if (missing.length) throw new Error(`${this.name} has no glyph for ${JSON.stringify(missing.sort())} in ${JSON.stringify(text)}`);
    const gs = chars.map(c => this.font.cmap.get(c.codePointAt(0)!)!);
    let adv = 0, kern = 0;
    for (const g of gs) adv += this.font.advance(g);
    for (let i = 1; i < gs.length; i++) kern += this.kern(gs[i - 1], gs[i]);
    const u = adv + kern;
    this.units.set(text, u);
    return u;
  }

  /** advance width of `text` at `size` px, unrounded */
  width(text: string, size: number): number {
    return (this.textUnits(text) * size) / this.font.unitsPerEm;
  }
}

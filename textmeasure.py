"""Text width read from the font file, the way Chrome (HarfBuzz) lays text out: unrounded advance widths
plus GPOS 'kern' pair adjustments, with every kern lookup adding to the total.

Matches Chrome within 0.015 px (docs/research/1.7-text-measurement.md), the same on every platform, and
the same numbers the browser editor will get from the same font files. Pillow measured about 3 px wide.
Not modelled: ligatures and other substitutions (fi/fl in Gantari differ by 1/1000 em), lookup flags, and
contextual kerning (lookup type 8). They do not matter for the chart's fonts; check a new font with
`npm run test:engine`. A character missing from the font raises an error: Chrome would draw it in another
font, so the width would be wrong.
"""
import os
from functools import lru_cache

from fontTools.ttLib import TTFont


class Measure:
    def __init__(self, path):
        self.path = path
        f = TTFont(path, lazy=True)
        self.cmap, self.hmtx, self.upem = f.getBestCmap(), f["hmtx"].metrics, f["head"].unitsPerEm
        self.lookups = []                          # each: list of subtables (first that applies wins)
        if "GPOS" in f:
            g = f["GPOS"].table
            idx = sorted({i for fr in g.FeatureList.FeatureRecord if fr.FeatureTag == "kern"
                          for i in fr.Feature.LookupListIndex})
            for i in idx:
                lk, subs = g.LookupList.Lookup[i], []
                for st in lk.SubTable:
                    kind = lk.LookupType
                    if kind == 9:                  # extension lookup: unwrap
                        kind, st = st.ExtensionLookupType, st.ExtSubTable
                    if kind != 2:                  # only pair adjustment changes widths between letters
                        continue
                    if st.Format == 1:
                        d = {}
                        for a, ps in zip(st.Coverage.glyphs, st.PairSet):
                            for pv in ps.PairValueRecord:
                                d[(a, pv.SecondGlyph)] = (getattr(pv.Value1, "XAdvance", 0) or 0) if pv.Value1 else 0
                        subs.append(("pair", set(st.Coverage.glyphs), d))
                    else:
                        subs.append(("class", set(st.Coverage.glyphs),
                                     (st.ClassDef1.classDefs, st.ClassDef2.classDefs, st.Class1Record)))
                self.lookups.append(subs)
        self._units = lru_cache(maxsize=None)(self._units_uncached)

    def kern(self, a, b):
        total = 0
        for subs in self.lookups:                  # lookups add up
            for kind, cov, data in subs:
                if a not in cov:
                    continue
                if kind == "pair":
                    if (a, b) in data:
                        total += data[(a, b)]
                        break
                    continue
                c1, c2, recs = data
                r = recs[c1.get(a, 0)].Class2Record[c2.get(b, 0)]
                total += (getattr(r.Value1, "XAdvance", 0) or 0) if r.Value1 else 0
                break
        return total

    def _units_uncached(self, text):
        missing = {c for c in text if ord(c) not in self.cmap}
        if missing:
            raise ValueError(f"{os.path.basename(self.path)} has no glyph for {sorted(missing)} in {text!r}")
        gs = [self.cmap[ord(c)] for c in text]
        return sum(self.hmtx[g][0] for g in gs) + sum(self.kern(a, b) for a, b in zip(gs, gs[1:]))

    def width(self, text, size):
        """advance width of `text` at `size` px, unrounded"""
        return self._units(text) * size / self.upem


@lru_cache(maxsize=None)
def measure(path):
    return Measure(path)

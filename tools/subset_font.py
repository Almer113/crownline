"""Cut a large CJK font down to what the charts print.

    python tools/subset_font.py <full font> <out.ttf> --tag ja-Jpan [--weight 400] [charts ...]

Noto Sans JP is 9.6 MB; the charts only need the characters in their text for that language
(every value under a key such as "ja-Jpan", plus kana and Japanese punctuation, so a small edit
still renders). A variable font is first fixed at one weight. Run it again after adding text in
that script; `tools/subset_font.py --check <font> --tag ja-Jpan` lists characters the font lacks.

The OFL allows subsetting; the result keeps the font's own name (Noto Sans JP has no Reserved
Font Name; its Adobe RFN is "Source", which the subset does not use).
"""
import argparse
import glob
import json
import os
import sys

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ALWAYS = ([chr(c) for c in range(0x3000, 0x3040)]      # CJK punctuation
          + [chr(c) for c in range(0x3040, 0x3100)]    # hiragana, katakana
          + [chr(c) for c in range(0xFF01, 0xFF5F)]    # full-width forms
          + [chr(c) for c in range(0x20, 0x7F)])


def chart_text(paths, tag):
    """every character in a value keyed by the language tag, anywhere in the documents"""
    found = set()

    def walk(v):
        if isinstance(v, dict):
            for k, x in v.items():
                if k == tag and isinstance(x, str):
                    found.update(x)
                walk(x)
        elif isinstance(v, list):
            for x in v:
                walk(x)
    for p in paths:
        with open(p, encoding="utf-8") as f:
            walk(json.load(f))
    return found


def main():
    sys.stdout.reconfigure(encoding="utf-8")         # the missing characters are CJK; the Windows console is not
    ap = argparse.ArgumentParser()
    ap.add_argument("font")
    ap.add_argument("out", nargs="?")
    ap.add_argument("charts", nargs="*")
    ap.add_argument("--tag", required=True)
    ap.add_argument("--weight", type=float, default=400)
    ap.add_argument("--check", action="store_true", help="only list characters the font lacks")
    a = ap.parse_args()
    charts = a.charts or sorted(glob.glob(os.path.join(ROOT, "charts/*/chart.json")))
    if a.check:
        charts = ([a.out] if a.out else []) + a.charts or charts
    if not a.check and not a.out:
        ap.error("give the output file (or --check)")
    need = chart_text(charts, a.tag)
    if a.check:
        have = set(chr(c) for c in TTFont(a.font).getBestCmap())
        lack = sorted(c for c in need if not c.isspace() and c not in have)
        print("missing:", "".join(lack) if lack else "none")
        sys.exit(1 if lack else 0)
    font = TTFont(a.font)
    if "fvar" in font:
        from fontTools.varLib import instancer
        font = instancer.instantiateVariableFont(font, {"wght": a.weight}, updateFontNames=True)
    opts = subset.Options()
    opts.layout_features = ["*"]
    opts.name_IDs = ["*"]
    opts.name_languages = ["*"]
    opts.notdef_outline = True
    s = subset.Subsetter(opts)
    s.populate(text="".join(sorted(need | set(ALWAYS))))
    s.subset(font)
    font.save(a.out)
    print(f"{len(need)} characters from the charts; {os.path.getsize(a.out) // 1024} KB")


if __name__ == "__main__":
    main()

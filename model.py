"""Shared model for the Wangsa Mataram chart: palette, type scale, boxes.

Box kinds
  ruler    portrait + coloured label (title / name / reign)
  heir     same, label in a light tint of the house colour
  minor    small coloured box: a royal who did not reign (optional portrait)
  neutral  grey box: a public figure outside the courts (optional portrait); descent lines into
           one keep the colour of the house they come from
  text     plain text: a spouse from outside the dynasty with no public role
  legend   outlined box: a legendary ancestor known only from the chronicles
Flag trad=True marks a ruler known only from court chronicles (babad), dates traditional.
Flags: hatch=True marks a rival or unrecognised claimant; tag="..." adds a small badge.
"""
import json
import os
import re

import chartfile
import textmeasure

ROOT = os.path.dirname(os.path.abspath(__file__))
# fonts: the main sans (regular + bold), the script for house names, and the aksara Jawa font.
# The defaults are the open fonts in assets/fonts/open/ (SIL OFL). CHART_SANS, CHART_SCRIPT and
# CHART_JAVANESE can pick the original proprietary fonts. They are kept in this private working
# repository only and must never be published (see docs/ASSET_AUDIT.md).
SANS = {"gantari": ("assets/fonts/open/Gantari-Regular.ttf", "assets/fonts/open/Gantari-Bold.ttf"),
        "altehaas": ("assets/fonts/AlteHaasGroteskRegular.ttf", "assets/fonts/AlteHaasGroteskBold.ttf")}
SCRIPT = {"felipa": ("assets/fonts/open/Felipa-Regular.ttf", 1.21),     # (file, size relative to Apple Chancery)
          "chancery": ("assets/fonts/Apple Chancery.ttf", 1.0)}
# the title's second script (theme.fonts.secondScript; "javanese" is its older name)
JAVANESE = {"noto": "assets/fonts/open/NotoSansJavanese-Regular.ttf", "javatext": "assets/fonts/javatext.ttf",
            "noto-jp": "assets/fonts/open/NotoSansJP-Regular-subset.ttf"}   # cut by tools/subset_font.py
# CHART_FONTS_EXTRA names a JSON file of extra fonts to try, without listing them here:
# {"sans": {name: [regular, bold]}, "script": {name: [file, scale]}}, paths relative to ROOT
if os.environ.get("CHART_FONTS_EXTRA"):
    _extra_path = os.environ["CHART_FONTS_EXTRA"]
    if not os.path.isabs(_extra_path) and not os.path.exists(_extra_path):
        _extra_path = os.path.join(ROOT, _extra_path)
    with open(_extra_path, encoding="utf-8") as _f:
        _extra = json.load(_f)
    SANS.update({k: tuple(v) for k, v in _extra.get("sans", {}).items()})
    SCRIPT.update({k: tuple(v) for k, v in _extra.get("script", {}).items()})
_THEME = chartfile.DOC["theme"]
SANS_NAME = os.environ.get("CHART_SANS", _THEME["fonts"]["sans"])
SCRIPT_NAME = os.environ.get("CHART_SCRIPT", _THEME["fonts"]["script"])
JAVANESE_NAME = os.environ.get("CHART_JAVANESE", _THEME["fonts"].get("secondScript", _THEME["fonts"].get("javanese")))
for _what, _name, _known in (("sans", SANS_NAME, SANS), ("script", SCRIPT_NAME, SCRIPT),
                             ("secondScript", JAVANESE_NAME, JAVANESE)):
    if _name and _name not in _known:
        raise SystemExit(f'theme.fonts.{_what}: no font "{_name}"; the engine knows {", ".join(_known)}')
FONT_REL_R, FONT_REL_B = SANS[SANS_NAME]
SCRIPT_REL, SCRIPT_SCALE = SCRIPT[SCRIPT_NAME]
JAVANESE_REL = JAVANESE[JAVANESE_NAME] if JAVANESE_NAME else None
FONT_R, FONT_B = (os.path.join(ROOT, p) for p in (FONT_REL_R, FONT_REL_B))
PORTRAIT_DIR = os.path.join(ROOT, "assets/portraits")

# a public build (CHART_PUBLIC=1) leaves out the assets that may not be published (the media records
# marked "private" in the chart document)
PUBLIC = os.environ.get("CHART_PUBLIC") == "1"
PRIVATE = chartfile.private_assets()
PRIVATE_FILES = chartfile.private_files()
if PUBLIC:
    for _p in (FONT_REL_R, FONT_REL_B, SCRIPT_REL, JAVANESE_REL):
        if _p and not _p.replace("\\", "/").startswith("assets/fonts/open/"):
            raise SystemExit(f"a public build may only use the open fonts in assets/fonts/open/, not {_p}")


def published(path):
    """the asset path, or None when a public build must leave it out or the file is absent (a private picture in
    the public repository): its space stays, so nothing moves"""
    if path and PUBLIC and path in PRIVATE_FILES:
        return None
    if path and not os.path.exists(os.path.join(ROOT, path)):
        return None
    return path

# ---------------------------------------------------------------- palette and type (the document's theme)
_PAL = _THEME["palette"]
BG = _PAL["background"]
BAND = _PAL["band"]           # alternate half-century band
INK = _PAL["ink"]
NOTE_INK = _PAL["noteInk"]
MUTED = _PAL["muted"]
FAINT = _PAL["faint"]
NEUTRAL = _PAL["neutral"]
GREYLINE = _PAL["greyLine"]
HOUSE = {h: v["colour"] for h, v in chartfile.DOC["houses"].items()}

# type scale (px at 1x)
FS = dict(_THEME["type"])

# ---------------------------------------------------------------- box geometry
P = 88            # ruler portrait / box height
MINOR_H = 62      # every minor box has the same height
LMIN = 214        # min ruler label width


def tint(hexc, k=0.55):
    r, g, b = (int(hexc[i:i + 2], 16) for i in (1, 3, 5))
    return "#%02X%02X%02X" % tuple(round(c + (255 - c) * k) for c in (r, g, b))


def hatch(c):
    return f"repeating-linear-gradient(135deg, {c} 0 9px, {tint(c, .6)} 9px 15px)"


def text_w(s, size, bold=True):
    """width of `s` in the sans font as Chrome lays it out, read from the font file (textmeasure.py)"""
    return textmeasure.measure(FONT_B if bold else FONT_R).width(s, size)


def disp_title(t):
    """Word titles are set in capitals; abbreviations with lower case (GRAy., BRAy., GRAj.)
    keep their case so that Ay / Aj stay distinguishable."""
    return t if re.search(r"[A-Z][a-z]+\.", t) else t.upper()


def portrait(id_):
    """the person's portrait file from the document's media, if the file is present"""
    f = chartfile.portrait_file(id_)
    return f if f and os.path.exists(os.path.join(ROOT, f)) else None


NODES = {}
TIES = {}          # spouse id -> partner id (always drawn on the partner's row)


class Node:
    def __init__(self, id_, kind, house, year, title="", name="", sub="",
                 hatch=False, tag=None, w=None, trad=False, slot=False):
        if id_ in NODES:
            raise ValueError(f"duplicate node id {id_}")
        self.id, self.kind, self.house, self.x, self.year = id_, kind, house, 0.0, year   # x: set by the layout
        self.title, self.name, self.sub, self.hatch, self.tag = title, name, sub, hatch, tag
        self.trad = trad          # known only from court chronicles (babad); dates traditional
        self.pic = portrait(id_)
        # a portrait the document names keeps its frame when the file is absent (a private picture in the
        # public repository, a file not copied yet): the layout never depends on which files are present
        slot = slot or chartfile.portrait_file(id_) is not None
        if PUBLIC and (id_ in PRIVATE["portraits"] or chartfile.portrait_file(id_) in PRIVATE_FILES):
            # a silhouette in the same frame, so the layout does not move. Decided by the list alone,
            # not by whether the file exists: the files are absent from the public repository
            self.pic, slot = None, True
        tw = text_w(disp_title(title), FS["title"]) * 1.06 + 24 if title else 0
        if kind in ("ruler", "heir"):
            self.lw = max(LMIN, text_w(name, FS["name"]) + 30, text_w(sub, FS["reign"], False) + 26, tw)
            self.h = P
            self.pw = P
        elif kind == "minor":
            self.lw = max(text_w(name, FS["name2"]) + 28, text_w(sub, FS["sub2"], False) + 24, tw, 130)
            self.h = MINOR_H
            self.pw = self.h if (self.pic or slot) else 0      # slot: an empty portrait frame
        elif kind == "neutral":
            lines = [l for l in re.split(r"<br>", sub)]
            self.lw = w or max(text_w(name, FS["name2"]) + 28,
                               max(text_w(l, FS["sub2"], False) for l in lines) + 24, 150)
            self.h = 88 if title else 76
            self.pw = self.h if (self.pic or slot) else 0
        elif kind == "legend":
            self.lw = max(text_w(name, FS["name2"]) + 32, text_w(sub, FS["sub2"], False) + 28,
                          text_w(disp_title(title), FS["title"]) * 1.06 + 28, 150)
            self.h = 62
            self.pw = 0
            self.pic = None
        else:  # text
            self.lw = max(text_w(name, FS["name2"]), text_w(sub, FS["sub2"], False), 60) + 16
            self.h = 54 if sub else 42
            self.pw = 0
            self.pic = None
        self.cy = None
        NODES[id_] = self

    # horizontal extents (a portrait sits on the left of the label)
    l = property(lambda s: s.x - s.lw / 2 - s.pw)
    r = property(lambda s: s.x + s.lw / 2)
    top = property(lambda s: s.cy - s.h / 2)
    bottom = property(lambda s: s.cy + s.h / 2)
    T = property(lambda s: (s.x, s.top))
    B = property(lambda s: (s.x, s.bottom))

    def rect(self, pad=0):
        return (self.l - pad, self.top - pad, self.r + pad, self.bottom + pad)


def ruler(id_, house, year, title, name, reign, **kw):
    return Node(id_, "ruler", house, year, title, name, reign, **kw)


def heir(id_, house, year, title, name, sub, **kw):
    return Node(id_, "heir", house, year, title, name, sub, **kw)


def legend(id_, house, year, title, name, sub="", **kw):
    """a legendary ancestor from the court chronicles (outlined, no portrait)"""
    return Node(id_, "legend", house, year, title, name, sub, **kw)


def minor(id_, house, year, title, name, sub="", **kw):
    return Node(id_, "minor", house, year, title, name, sub, **kw)


def text(id_, year, name, sub="", **kw):
    return Node(id_, "text", None, year, "", name, sub, **kw)


def neutral(id_, year, name, sub, w=None, title="", **kw):
    return Node(id_, "neutral", None, year, title, name, sub, w=w, **kw)


GAP_X = 46        # partner <-> spouse gap


def beside(partner, side, node):
    """Place an already-created spouse node next to `partner`, on the partner's row."""
    p = NODES[partner]
    node.year = p.year
    node.x = p.r + GAP_X + node.pw + node.lw / 2 if side == "r" else p.l - GAP_X - node.lw / 2
    TIES[node.id] = partner
    return node

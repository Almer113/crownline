"""Reads the chart document into the tables the layout and drawing code use (compose.py, build.py).

The document (charts/<chart>/chart.json) is the source of the chart's content; these tables are a view of
it. Order matters and is kept: people are created in document order, descents and unions are drawn in
document order, and consecutive descents from one parent with the same options form one line.
"""
import os
import re

import chartfile
from model import NODES, TIES, Node, beside

DOC = chartfile.DOC
_people = DOC["people"]
_adj = list(DOC.get("adjustments", {}).values())


def _adjust(kind):
    return [a for a in _adj if a["kind"] == kind]


# ================================================================ people
_rows = [dict(r) for r in DOC.get("display", {}).get("rows", [])]


def _place_rows():
    """a side-by-side row: members stand left of the anchor on its row, joined left to right"""
    for r in _rows:
        if r.get("done") or not all(k in NODES for k in [r["anchor"], *r["members"]]):
            continue
        right = NODES[r["anchor"]].l
        for k in reversed(r["members"]):
            n = NODES[k]
            n.x, n.year = right - r["gap"] - n.lw / 2, NODES[r["anchor"]].year
            TIES[k] = r["anchor"]
            right = n.l
        r["done"] = True


for _pid, _p in _people.items():
    _s = _p["show"]
    _kind = _s["box"]
    Node(_pid, _kind, _p.get("house") if _kind not in ("neutral", "text") else None, _s.get("year", 0),
         _p.get("title", ""), chartfile.text(_p["name"]), chartfile.text(_s.get("sub", "")),
         hatch=_s.get("hatch", False), tag=_s.get("tag"), w=_s.get("width"),
         trad=_p.get("basis") == "traditional", slot=_s.get("portraitFrame", False))
    if "beside" in _s:
        beside(_s["beside"]["of"], _s["beside"]["side"], NODES[_pid])
    _place_rows()


# ================================================================ relationships
_drops = {a["target"]: a["drop"] for a in _adjust("drop")}
DESC = []   # descents: parent -> kids (one line each)
MARR = []   # marriages: (a, b, house|None, style, couple_kids, kid_styles)
DESC_IDS = []   # the document's descent ids drawn by each DESC line (the lock file names lines by these)
MARR_IDS = []   # the union id of each MARR entry
COUPLE_LINE = {}
_unions = DOC.get("unions", {})

_key = None
for _did, _d in DOC.get("descents", {}).items():
    if "parent" not in _d:
        continue                                   # a child of a couple: drawn with the marriage below
    _s = _d.get("show", {})
    if _s.get("drawn") is False:
        continue                                   # kept in the data, not drawn on the chart
    # both parents on the chart: the line always comes down from the couple's marriage line
    _couple = tuple(_unions[_d["union"]]["partners"]) if _d.get("union") else None
    key = (_d["parent"], _d.get("union"), _s.get("hop", False), _s.get("branch", False), _s.get("row", False), _s.get("group"))
    if key != _key:
        DESC.append(dict(parent=_d["parent"], kids=[], styles={}, brk={}, hop=key[2], caption={}, branch=key[3],
                         drop=None, row=key[4], couple_of=_couple, union=_d.get("union")))
        DESC_IDS.append([])
        _key = key
    DESC_IDS[-1].append(_did)
    g, k = DESC[-1], _d["child"]
    g["kids"].append(k)
    if _s.get("line"):
        g["styles"][k] = _s["line"]
    if _s.get("break"):
        g["brk"][k] = _s["break"]
    if _s.get("caption"):
        g["caption"][k] = chartfile.text(_s["caption"])
    if _did in _drops:
        g["drop"] = _drops[_did]

_kids = {}
for _d in DOC.get("descents", {}).values():
    if "parent" not in _d:
        _kids.setdefault(_d["union"], []).append(_d)
for _uid, _u in _unions.items():
    a, b = _u["partners"]
    house = _u.get("show", {}).get("colour")
    ks = _kids.get(_uid, [])
    MARR_IDS.append(_uid)
    MARR.append((a, b, house, "grey" if house is None else "dot", [d["child"] for d in ks],
                 {d["child"]: d["show"]["line"] for d in ks if d.get("show", {}).get("line")}))
    if _u.get("show", {}).get("childColour"):
        COUPLE_LINE[(a, b)] = _u["show"]["childColour"]

# ================================================================ adjustments
NUDGE = {a["target"]: (a.get("dx", 0), a.get("dy", 0)) for a in _adjust("nudge")}
FOLLOW = {a["target"]: a["of"] for a in _adjust("follow")}
FOLLOW_DX = {a["target"]: a.get("dx", 0) for a in _adjust("follow")}
# keyed by the document id they target (a union, a descent), not by person or partner pair, so a child
# with two lines, or a couple married twice, keeps them apart
COUPLE_SIDE = {a["target"]: a["side"] for a in _adjust("coupleSide")}
SHARE_BUS = {a["target"] for a in _adjust("shareBus")}
BREAK_AT = {a["target"]: a["at"] for a in _adjust("breakAt")}
MARKER_TOP = {a["target"] for a in _adjust("markerTop")}
TEXT_LIFT = {a["target"]: a["dy"] for a in _adjust("textLift")}
HEADER_LEFT = {a["target"] for a in _adjust("headerLeft")}

# ================================================================ notes
_offsets = {a["target"]: (a.get("dx", 0), a.get("dy", 0)) for a in _adjust("noteOffset")}
NOTES = []
INLINE_NOTES = set()      # positions in NOTES of the notes drawn in full beside their person (per note)
for _nid, _n in DOC.get("notes", {}).items():
    dx, dy = _offsets.get(_nid, (0, 0))
    NOTES.append((_n["anchor"], _n["show"]["side"], dx, dy, _n["show"]["width"], chartfile.text(_n["text"])))
    if _n["show"].get("inline"):
        INLINE_NOTES.add(len(NOTES) - 1)

# ================================================================ crowns (from the reign records)
_house_order = list(DOC["houses"])
CROWNS = {pid: " · ".join(str(r["n"]) for r in p["reigns"])
          for pid, p in sorted(((k, v) for k, v in _people.items() if v.get("reigns")),
                               key=lambda kv: (_house_order.index(kv[1]["reigns"][0]["court"]), kv[1]["reigns"][0]["n"]))}

# ================================================================ display, timeline, panels
_disp = DOC.get("display", {})
PILLS = {k: (v["label"], v["house"]) for k, v in _disp.get("pills", {}).items()}
DISPUTED_PILLS = {k for k, v in _disp.get("pills", {}).items() if v.get("disputed")}
BRACKETS = [(b["members"], b["label"]) for b in _disp.get("brackets", [])]
EVENTS = dict(_disp.get("events", {}))
HEADERS = {k: (chartfile.asset(DOC["media"][v["emblem"]]["file"]) if v.get("emblem") else None, v["kind"], v["name"], v["years"],
               v["seat"], v["founded"]) for k, v in _disp.get("headers", {}).items()}

ERAS = [(e["year"], chartfile.text(e["name"])) for e in DOC.get("timeline", {}).get("eras", [])]
EPISODES = [(e["from"], e["to"], chartfile.text(e["name"])) for e in DOC.get("timeline", {}).get("episodes", [])]
GLOSSARY = [(g["group"], g["term"], g.get("expansion", ""), chartfile.text(g["gloss"])) for g in DOC.get("glossary", {}).values()]

_panels = DOC.get("panels", {})
CHART_ID = DOC["meta"]["id"]
TITLE = chartfile.text(DOC["meta"]["title"])
# the title in a second script (a language tag with a script subtag, such as jv-Java), printed under the title
_title = DOC["meta"]["title"] if isinstance(DOC["meta"]["title"], dict) else {}
TITLE_SCRIPT = next((v for k, v in _title.items() if re.fullmatch(r"[a-z]{2,3}-[A-Z][a-z]{3}", k)), "")
LANG = DOC["meta"].get("defaultLang", "en")
# names printed before a regnal number ("Pakubuwana II"); a note keeps the two on one line
KEEP_TOGETHER = DOC.get("display", {}).get("keepTogether", [])
TIME_ORDER = DOC.get("display", {}).get("timeOrder", False)
SUBTITLE = chartfile.text(DOC["meta"].get("subtitle", ""))
AS_OF = DOC["meta"]["asOf"].get("text") or DOC["meta"]["asOf"]["edtf"]
NOW = int(DOC["meta"]["asOf"]["edtf"][:4])     # the year the chart's information is current to
TITLE_TEXT = chartfile.text(_panels.get("intro", ""))
CAVEATS = [chartfile.text(c) for c in _panels.get("caveats", [])]
HEADER_PANEL = _panels["header"]
# how the header card sits: "row" (top left, the tree beside it), "column" (down the left side, holding the
# notes too), "top" (across the top, the tree below it); CHART_HEADER overrides it, to compare
# ("column,1310": a column card 1310 px wide; "top,760": a top card 760 px tall)
HEADER_ARRANGE = HEADER_PANEL.get("arrange", "row")
if os.environ.get("CHART_HEADER"):
    HEADER_ARRANGE, *_size = os.environ["CHART_HEADER"].split(",")
    HEADER_PANEL = dict(HEADER_PANEL, arrange=HEADER_ARRANGE)
    if _size:
        HEADER_PANEL["height" if HEADER_ARRANGE == "top" else "width"] = int(_size[0])


_NUMERAL = re.compile(r"^([IVXLC]+|\d+)$")


def _short(names):
    """names without a family name most of them share ("Tokugawa Ietsuna" -> "Ietsuna"); the word is dropped
    only when more than half the names start with it, and never when only a regnal number would be left
    ("Pakubuwana II" stays)"""
    first = [n.split(" ")[0] for n in names if " " in n]
    common = max(dict.fromkeys(first), key=first.count) if first else None   # ties: the first seen
    if not common or first.count(common) * 2 <= len(names):
        return lambda n: n
    return lambda n: (n.split(" ", 1)[1] if n.startswith(common + " ") and not _NUMERAL.match(n.split(" ", 1)[1])
                      else n)


def _succession(spec):
    """rows of the succession table (panels.succession): number, name, years, how each came to rule, worked
    out from the reigns and the descents: son, brother, grandson, adopted heir or named successor of the one
    before, a restored reign, and the birth father with his house when it is another house"""
    court = spec["court"]
    reigns = sorted(((r["n"], pid, r) for pid, p in _people.items() for r in p.get("reigns", [])
                     if r["court"] == court), key=lambda t: t[0])
    name = lambda pid: chartfile.text(_people[pid]["name"])  # noqa: E731
    sex = lambda pid: _people.get(pid, {}).get("sex")  # noqa: E731
    short = _short([name(pid) for _n, pid, _r in reigns])

    def word(pid, m, f, x):
        return {"m": m, "f": f}.get(sex(pid), x)
    birth = {}                         # child -> birth parents (the descent's parent first)
    links = {}                         # (parent, child) -> (kind, caption) of any other link
    for d in DOC.get("descents", {}).values():
        ps = list(_unions[d["union"]]["partners"]) if d.get("union") else []
        if d.get("parent"):
            ps = [d["parent"]] + [x for x in ps if x != d["parent"]]
        if d.get("kind", "birth") == "birth":
            birth.setdefault(d["child"], []).extend(x for x in ps if x not in birth.get(d["child"], []))
        else:
            for x in ps:
                links[(x, d["child"])] = (d["kind"], chartfile.text(d.get("show", {}).get("caption", "")))
    house = lambda pid: _people.get(pid, {}).get("house")  # noqa: E731
    rows, prev, seen = [], None, set()
    for n, pid, r in reigns:
        parents = birth.get(pid, [])
        # the father: a parent recorded as male; else the parent the line comes from, when it names one
        f = next((p for p in parents if sex(p) == "m"), parents[0] if len(parents) == 1 else None)
        child = word(pid, "son", "daughter", "child")
        born = ""
        if f:
            born = f"{child} of {short(name(f))}"
            hn = chartfile.text(DOC["houses"][house(f)]["name"]) if house(f) in DOC["houses"] else ""
            if hn and house(f) != house(pid) and hn not in name(f):
                born += f" ({hn})"
        elif parents:
            born = f"{child} of " + " and ".join(short(name(p)) for p in parents[:2])
        how = born
        if pid in seen and prev != pid:
            how = "restored"
        elif prev and prev != pid:
            p = short(name(prev))
            if prev in parents:
                how = f"{child} of {p}"
            elif any(prev in birth.get(x, []) for x in parents):
                how = f"{word(pid, 'grandson', 'granddaughter', 'grandchild')} of {p}" + (f"; {born}" if born else "")
            elif parents and set(parents) & set(birth.get(prev, [])):
                how = f"{word(pid, 'brother', 'sister', 'sibling')} of {p}" + (
                    f", adopted as {word(prev, 'his', 'her', 'their')} heir"
                    if links.get((prev, pid), ("",))[0] == "adoptive" else "")
            elif (prev, pid) in links:
                kind, cap = links[(prev, pid)]
                how = (f"adopted heir of {p}" if kind == "adoptive" else f"{cap or 'successor'} of {p}") + (f"; {born}" if born else "")
        # a new section where the kind of box changes (Tokugawa: the shoguns, then the heads of the house),
        # headed by that kind's wording in the Key
        box = _people[pid].get("show", {}).get("box", "ruler")
        div = None
        if prev and box != _people[prev].get("show", {}).get("box", "ruler"):
            div = chartfile.text(_panels.get("key", {}).get("labels", {}).get(box, ""))
        when = r.get("when") or {}             # dates are optional: an empty cell
        rows.append((n, short(name(pid)), when.get("text") or when.get("edtf", "").replace("/", " – "), how, div))
        prev = pid
        seen.add(pid)
    return rows


_succ = _panels.get("succession")
SUCCESSION = (chartfile.text(_succ.get("title", "The succession")), _succession(_succ)) if _succ else None
SCALE = _panels.get("scale")
_key = _panels.get("key", {})
_house_ids = list(DOC["houses"])
KEY = {"house": _key.get("house", _house_ids[0]),                       # the colour the key's examples use
       "contrast": _key.get("contrast", _house_ids[1] if len(_house_ids) > 1 else _house_ids[0]),
       "labels": {k: chartfile.text(v) for k, v in _key.get("labels", {}).items()}}
HOUSE_NAMES = {k: chartfile.text(v["name"]) for k, v in DOC["houses"].items()}
GLOSSARY_TITLE = chartfile.text(_panels.get("glossaryTitle", "Titles and honorifics"))
MAP = _panels.get("map")       # the map panel (drawn by maps.py from the document and its shapes), or None


def map_module():
    """the module that draws the map panel (maps.py, from panels.map), or None when there is no map"""
    if not MAP:
        return None
    import maps
    return maps


BADGES = [chartfile.asset(DOC["media"][m]["file"]) for m in _panels.get("badges", [])]


def sources_text(public):
    """the footer's sources text for a public or a private build"""
    out = ""
    for part in _panels.get("sources", []):
        if isinstance(part, str):
            out += part
        else:
            out += part.get("public" if public else "private", "")
    return out




def _tour(tid, t):
    """a tour with its text in the default language (the viewer's chart text is one language for now)"""
    steps = [{**st, **{f: chartfile.text(st[f]) for f in ("title", "caption") if f in st}} for st in t["steps"]]
    return {"id": tid, **t, **{f: chartfile.text(t[f]) for f in ("title", "summary") if f in t}, "steps": steps}


TOURS = [_tour(k, v) for k, v in DOC.get("tours", {}).items()]

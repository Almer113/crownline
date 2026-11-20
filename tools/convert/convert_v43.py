"""One-time conversion of the Python chart content (data_v43.py, the v43 data.py) to the chart document
charts/wangsa-mataram/chart.json (PLAN Phase 4, item 3).

    python tools/convert/convert_v43.py [--out PATH]

It ran once (18 November 2026). From then on the document is the source: chartdoc.py reads it, and the Python
build produced the same chart as v43, byte for byte. The files it read that are now gone (tours.json,
assets/private.json, the two CREDITS.tsv) are taken from git history (commit cd444f1), so it still runs.
It does not depend on the document it writes: the v43 theme, houses and portrait files are pinned here
(from cd444f1), and CHART_DOC is ignored. (model.py still needs a document to import, any valid one.)

Old and new names
  ruler()/minor()/...      people.<id>          box kind, year, card line, width -> show.*
  trad=True                basis "traditional"  (legend boxes: basis "legendary")
  descend(parent, kids)    descents.<id>        one per child; the order in the file is the drawing order
  marry(a, b, couple=...)  unions.<id> + descents with "union"
  CROWNS                   people.<id>.reigns   (the crown is the list of reign numbers)
  NUDGE, FOLLOW_DX, ...    adjustments.<id>     each with a reason
  LEGEND_ROW               display.rows
  CREDITS.tsv, private.json  media.<id>
"""
import csv
import io
import json
import subprocess
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, ROOT)
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "charts", "wangsa-mataram", "chart.json")
os.environ.pop("CHART_DOC", None)       # model.py loads a document on import; use the repository's

import model  # noqa: E402

# ---------------------------------------------------------------- v43 values, pinned (model.py at cd444f1)
V43_HOUSE = {"mataram": "#EFC239", "surakarta": "#80C3E1", "yogyakarta": "#F26654", "pakualaman": "#96BC96",
             "mangkunegaran": "#EF953A"}
V43_FS = {"title": 14, "name": 21, "reign": 15, "name2": 17, "sub2": 14, "note": 17, "cap": 15, "small": 14}
V43_PALETTE = {"background": "#EDE8D8", "band": "#E6E0CD", "ink": "#1F1F1F", "noteInk": "#3A372F",
               "muted": "#5E5848", "faint": "#857D68", "neutral": "#D5D1C3", "greyLine": "#C2BBA8"}


def _v43_portraits():
    """person id -> portrait file, as v43 found them (assets/portraits/<id>.jpg|png|webp at cd444f1)"""
    names = subprocess.run(["git", "ls-tree", "--name-only", "cd444f1", "assets/portraits/"], cwd=ROOT,
                           capture_output=True, text=True, check=True).stdout.split()
    out = {}
    for ext in ("jpg", "png", "webp"):              # v43's order of preference
        for n in names:
            stem, e = os.path.splitext(os.path.basename(n))
            if e == "." + ext:
                out.setdefault(stem, n)
    return out


V43_PORTRAITS = _v43_portraits()

# record every node's constructor arguments and every beside() call, as data_v43 makes them
ARGS, BESIDE = {}, {}
_init = model.Node.__init__


def _rec_init(self, id_, kind, house, year, title="", name="", sub="", hatch=False, tag=None, w=None,
              trad=False, slot=False, **kw):
    ARGS[id_] = dict(kind=kind, house=house, year=year, title=title, name=name, sub=sub, hatch=hatch, tag=tag,
                     w=w, trad=trad, slot=slot)
    _init(self, id_, kind, house, year, title, name, sub, hatch=hatch, tag=tag, w=w, trad=trad, slot=slot, **kw)


model.Node.__init__ = _rec_init
_beside = model.beside


def _rec_beside(partner, side, node):
    BESIDE[node.id] = (partner, side)
    return _beside(partner, side, node)


model.beside = _rec_beside
import data_v43 as D  # noqa: E402

# v43 values that lived in compose.py and build.py
HEADER_LEFT = {"pa1"}
NOTE_WIDTHS = (240, 300, 360, 440, 560)     # compose.NOTE_WIDTHS: v43 snapped every note width to one of these


def snap(w):
    """the width the note was drawn at (v43 kept the unsnapped number it was given)"""
    return min(NOTE_WIDTHS, key=lambda c: abs(c - w))


HEADER = {"x": 140, "y": 130, "width": 2190, "height": 950}
JAVANESE = "ꦮꦁꦱ\u200bꦩꦠꦫꦩ꧀"
AS_OF = "November 2026"
FANMADE = "assets/brand/fanmade-logo-brown.png"


def compact(d):
    """drop empty and default values, so the document stays short"""
    return {k: v for k, v in d.items() if v not in (None, False, "", [], {})}


# ---------------------------------------------------------------- reigns from the crown numbers
RANGE = re.compile(r"(c\. )?(\d{4})\s*[–-]\s*(present|\d{4}|\d{2})(?!\d)")


def reigns(pid):
    crown = D.CROWNS.get(pid)
    if not crown:
        return []
    ns = [int(x) for x in crown.split(" · ")]
    sub = ARGS[pid]["sub"]
    found = []
    for m in RANGE.finditer(sub):
        a, b = m[2], m[3]
        b = ".." if b == "present" else (a[:2] + b if len(b) == 2 else b)
        found.append({"edtf": f"{a}{'~' if m[1] else ''}/{b}", "text": m[0]})
    if len(found) != len(ns):
        years = re.findall(r"\b\d{4}\b", sub)
        found = [{"edtf": years[0], "text": sub}] if len(ns) == 1 and len(years) == 1 else [None] * len(ns)
    house = ARGS[pid]["house"]
    return [compact({"court": house, "n": n, "when": w}) for n, w in zip(ns, found)]


# ---------------------------------------------------------------- people
def person(pid):
    a = ARGS[pid]
    show = {"box": a["kind"]}
    if pid in BESIDE:
        show["beside"] = {"of": BESIDE[pid][0], "side": BESIDE[pid][1]}
    else:
        show["year"] = a["year"]
    show.update(compact({"sub": a["sub"], "hatch": a["hatch"], "tag": a["tag"], "width": a["w"],
                         "portraitFrame": a["slot"]}))
    basis = "legendary" if a["kind"] == "legend" else "traditional" if a["trad"] else None
    return compact({"name": a["name"], "title": a["title"], "house": a["house"], "basis": basis,
                    "reigns": reigns(pid), "portrait": f"p_{pid}" if pid in PORTRAITS else None, "show": show})


# ---------------------------------------------------------------- media (replaces CREDITS.tsv and private.json)
V43 = "cd444f1"


def old(path):
    """a v43 input file: from disk if still there, else from git history"""
    full = os.path.join(ROOT, path)
    if os.path.exists(full):
        with open(full, encoding="utf-8") as f:
            return f.read()
    return subprocess.run(["git", "show", f"{V43}:{path}"], cwd=ROOT, capture_output=True, check=True,
                          encoding="utf-8").stdout


PRIVATE = json.loads(old("assets/private.json"))
PORTRAIT_ROWS = list(csv.DictReader(io.StringIO(old("assets/portraits/CREDITS.tsv")), delimiter="\t"))
EMBLEM_ROWS = {r["file"]: r for r in csv.DictReader(io.StringIO(old("assets/emblems/CREDITS.tsv")), delimiter="\t")}
PORTRAITS = {r["id"]: r for r in PORTRAIT_ROWS}


def media():
    out = {}
    for r in PORTRAIT_ROWS:
        pid = r["id"]
        assert (r["public"] == "no") == (pid in PRIVATE["portraits"]), pid
        out[f"p_{pid}"] = compact({
            "kind": "portrait", "file": V43_PORTRAITS.get(pid), "of": pid,
            "credit": compact({"title": r["person"], "source": r["source_page"], "fileUrl": r["file_url"],
                               "author": r["author"], "licence": r["licence"], "changes": r["changes"],
                               "note": r["note"]}),
            "private": PRIVATE["portraits"].get(pid)})
    emb = sorted({h[0] for h in D.HEADERS.values() if h[0]} | set(PRIVATE["emblems"]),
                 key=lambda p: [h[0] for h in D.HEADERS.values()].index(p) if p in [h[0] for h in D.HEADERS.values()] else 99)
    for path in emb:
        r = EMBLEM_ROWS.get(path)
        stem = os.path.splitext(os.path.basename(path))[0]
        mid = f"e_{stem}" if path.endswith(".png") else f"e_{stem}_source"
        out[mid] = compact({
            "kind": "emblem" if path.endswith(".png") else "source", "file": path,
            "credit": compact({"title": r["name"], "source": r["source_page"], "author": r["author"],
                               "licence": r["licence"], "changes": r["changes"]}) if r else None,
            "private": PRIVATE["emblems"].get(path)})
    out["b_cc_by_sa"] = {"kind": "badge", "file": "assets/brand/cc-by-sa-icon.png",
                         "credit": {"title": "CC BY-SA licence badge", "source": "https://creativecommons.org/about/downloads/"}}
    out["b_fanmade"] = compact({"kind": "badge", "file": FANMADE,
                                "private": PRIVATE["brand"].get(FANMADE)})
    return out


def media_id(path):
    for k, v in MEDIA.items():
        if v["file"] == path:
            return k
    raise KeyError(path)


# ---------------------------------------------------------------- relationships
def uid(a, b):
    return f"u_{a}_{b}"


def descents_and_unions():
    descents, unions, adjust = {}, {}, {}
    prev_key = None
    for d in D.DESC:
        union = uid(*d["couple_of"]) if d.get("couple_of") else None
        key = (d["parent"], union, d["hop"], d["branch"], d["row"])
        # consecutive groups from one parent with the same options would read back as one line: label them
        group = d["kids"][0] if key == prev_key else None
        prev_key = key
        for k in d["kids"]:
            did = f"d_{d['parent']}_{k}"
            assert did not in descents, did
            cap = d["caption"].get(k)
            kind = {"court poet": "other", "son-in-law": "in-law"}.get(cap, "birth")
            brk = d["brk"].get(k)
            gens = {"grandson": 2, "granddaughter": 2, "descendant": "several"}.get(brk, None)
            descents[did] = compact({
                "parent": d["parent"], "union": union, "child": k, "kind": kind if kind != "birth" else None,
                "generations": gens,
                "show": compact({"line": d["styles"].get(k), "break": brk, "caption": cap, "hop": d["hop"],
                                 "branch": d["branch"], "row": d["row"], "group": group})})
            if d["drop"] is not None and k == d["kids"][0]:
                adjust[f"drop_{did}"] = {"kind": "drop", "target": did, "drop": d["drop"],
                                         "reason": "the line runs lower, leaving room for the lines above it"}
    kid_desc = {}
    for a, b, house, style, couple, kid_styles in D.MARR:
        u = uid(a, b)
        assert u not in unions, u
        assert style == ("grey" if house is None else "dot")
        unions[u] = {"partners": [a, b], "kind": "marriage",
                     "show": compact({"colour": house, "childColour": D.COUPLE_LINE.get((a, b))})}
        if not unions[u]["show"]:
            del unions[u]["show"]
        for k in couple:
            did = f"d_{u}_{k}"
            kid_desc[did] = compact({"union": u, "child": k, "show": compact({"line": kid_styles.get(k)})})
            if not kid_desc[did].get("show"):
                kid_desc[did].pop("show", None)
    for k, v in descents.items():
        if not v.get("show"):
            v.pop("show", None)
    descents.update(kid_desc)
    return descents, unions, adjust


def descent_of(kid):
    """the descent into `kid` that a per-child table (SHARE_BUS, BREAK_AT) means: its own line"""
    hits = [k for k, v in DESCENTS.items() if v["child"] == kid and "parent" in v]
    assert len(hits) == 1, (kid, hits)
    return hits[0]


# ---------------------------------------------------------------- adjustments, each with its reason
NUDGE_WHY = {
    "ratuibu": "room for the line from Hamengkubuwana II down to Kencana",
    "kyaimaja": "room for the line from Hamengkubuwana II down to Kencana",
    "asihwinarni": "her child stands under the marriage line: a straight drop",
    "prisca": "her child stands under the marriage line: a straight drop",
    "gkrmaduretno": "Sentot under his father Ronggo, clear of the line to his half-sister",
    "sentot": "under his father Ronggo, clear of the line to his half-sister",
    "hb9": "his crown clear of the line from Pakubuwana X to Retno Puwoso",
    "alit_am1": "beside his brother's queen rather than far out on the left",
}
FOLLOW_WHY = {
    "sukarno": "drawn beside his daughter Sukmawati and moves with her",
    "benawa": "drawn over his daughter Banawati and moves with her",
    "trunajaya": "an outside figure beside the king he fought",
    "surapati": "an outside figure beside the king he sheltered",
}
COUPLE_SIDE_WHY = {
    ("ratuageng", "hb1"): "the centre group: Hamengkubuwana II under the couple, Paku Alam I to his left",
    ("pa2", "hayu_pa2"): "Paku Alam III and Nataningprang left of Paku Alam V",
}
BREAK_WHY = {"ratuibu": "the break mark below Kyai Maja's card", "bagong": "the break mark above the dotted line it crosses"}


def adjustments(extra):
    out = {}
    for k, (dx, dy) in D.NUDGE.items():
        out[f"nudge_{k}"] = compact({"kind": "nudge", "target": k, "dx": dx, "dy": dy, "reason": NUDGE_WHY[k]})
        out[f"nudge_{k}"].setdefault("reason", "")
    for k, lead in D.FOLLOW.items():
        out[f"follow_{k}"] = {"kind": "follow", "target": k, "of": lead, "dx": D.FOLLOW_DX[k], "reason": FOLLOW_WHY[k]}
    for (a, b), side in D.COUPLE_SIDE.items():
        out[f"couple_side_{uid(a, b)}"] = {"kind": "coupleSide", "target": uid(a, b), "side": side,
                                           "reason": COUPLE_SIDE_WHY[(a, b)]}
    for k in sorted(D.SHARE_BUS, key=list(model.NODES).index):
        did = descent_of(k)
        out[f"share_bus_{did}"] = {"kind": "shareBus", "target": did,
                                   "reason": "hangs off the parent's existing line; the break mark tells the generation"}
    for k, at in D.BREAK_AT.items():
        did = descent_of(k)
        out[f"break_at_{did}"] = {"kind": "breakAt", "target": did, "at": at, "reason": BREAK_WHY[k]}
    for k in sorted(D.MARKER_TOP):
        out[f"marker_top_{k}"] = {"kind": "markerTop", "target": k,
                                  "reason": "the letter marker at the top right, clear of a line under the box"}
    for k, dy in D.TEXT_LIFT.items():
        out[f"text_lift_{k}"] = {"kind": "textLift", "target": k, "dy": dy, "reason": "the label lifted off an era line"}
    for k in sorted(HEADER_LEFT):
        out[f"header_left_{k}"] = {"kind": "headerLeft", "target": k,
                                   "reason": "a cross-house line passes where the header would sit on the right"}
    for nt in D.NOTES:
        if nt[2] or nt[3]:
            out[f"note_offset_n_{nt[0]}"] = compact({"kind": "noteOffset", "target": f"n_{nt[0]}", "dx": nt[2], "dy": nt[3]})
            out[f"note_offset_n_{nt[0]}"]["reason"] = ""
    out.update(extra)
    return out


# ---------------------------------------------------------------- the rest
def slug(term):
    return re.sub(r"[^a-z0-9]+", "_", term.lower()).strip("_")


def sources_parts():
    """the footer's sources text, with the parts only one kind of build shows"""
    return [
        "<b>Sources.</b> Reign dates follow the courts' chronologies; early dates vary by source. "
        "Portraits: Wikimedia Commons (Tropenmuseum, KITLV, Rijksmuseum, Kraton Yogyakarta and Surakarta "
        "collections; CC BY, CC BY-SA and public domain), Pemda DIY",
        {"private": ", Kraton Yogyakarta and press photos"},
        "; early Mataram rulers are later artistic depictions. Emblems: Wikimedia Commons (Gunawan Kartapranata, "
        "RaFaDa20631; CC BY-SA)",
        {"private": " and the Mangkualaman"},
        ". Maps: geoBoundaries (CC BY 3.0 IGO); historical extents after Ricklefs, Cribb and Hakim. Full picture credits: ",
        {"public": "the credits page. ", "private": "the media list of charts/wangsa-mataram/chart.json. "},
    ]


def tours():
    return {t["id"]: {k: v for k, v in t.items() if k != "id"} for t in json.loads(old("tours.json"))["tours"]}


MEDIA = media()
DESCENTS, UNIONS, DROP_ADJ = descents_and_unions()


def document():
    people = {pid: person(pid) for pid in model.NODES}
    lg = list(D.LEGEND_ROW)
    anchor = model.TIES[lg[-1]]
    doc = {
        "$schema": "../../packages/schema/chart.schema.json",
        "format": 1,
        "meta": {
            "id": "wangsa-mataram",
            "title": {"en": "Wangsa Mataram", "jv-Java": JAVANESE},
            "subtitle": "The royal family tree of the Mataram dynasty<br>and the four courts of Central Java",
            "asOf": {"edtf": "2026-11", "text": AS_OF},
            "languages": ["en"], "defaultLang": "en",
            "assetRoot": "../..",
        },
        "people": people,
        "unions": UNIONS,
        "descents": DESCENTS,
        "houses": {h: {"name": h.capitalize(), "colour": c} for h, c in V43_HOUSE.items()},
        "glossary": {slug(t): compact({"group": g, "term": t, "expansion": full, "gloss": en})
                     for g, t, full, en in D.GLOSSARY},
        "timeline": {"eras": [{"year": y, "name": n} for y, n in D.ERAS],
                     "episodes": [{"from": a, "to": b, "name": n} for a, b, n in D.EPISODES]},
        "notes": {f"n_{nt[0]}": {"anchor": nt[0], "text": nt[5],
                                 "show": compact({"side": nt[1], "width": snap(nt[4]), "inline": nt[0] in D.INLINE_NOTES})}
                  for nt in D.NOTES},
        "panels": {
            "header": HEADER,
            "intro": D.TITLE_TEXT,
            "caveats": D.CAVEATS,
            "sources": sources_parts(),
            "badges": ["b_cc_by_sa", "b_fanmade"],
            "scale": {
                "row": [lg[0], anchor], "trunk": ["senapati", "hanyakrawati"], "documented": "hanyakrawati",
                "stages": [
                    {"head": "LEGENDARY", "lines": ["Ancestry from the court chronicle Babad Tanah Jawi"]},
                    {"head": "COURT TRADITION", "lines": ["Known from chronicles", "written mostly in the 1700s;", "dates traditional"]},
                    {"head": "DOCUMENTED", "lines": ["In Dutch VOC records", "from 1613–14"]},
                ]},
            "map": {"kind": "embedded", "generator": "maps.py"},
        },
        "media": MEDIA,
        "display": {
            "rows": [{"anchor": anchor, "members": lg, "gap": D.ROW_GAP}],
            "pills": {k: compact({"label": lab, "house": h, "disputed": k in D.DISPUTED_PILLS}) for k, (lab, h) in D.PILLS.items()},
            "headers": {k: compact({"emblem": media_id(v[0]) if v[0] else None, "kind": v[1], "name": v[2],
                                    "years": v[3], "seat": v[4], "founded": v[5]}) for k, v in D.HEADERS.items()},
            "brackets": [{"members": m, "label": lab} for m, lab in D.BRACKETS],
            "events": dict(D.EVENTS),
        },
        "adjustments": adjustments(DROP_ADJ),
        "tours": tours(),
        "theme": {
            "palette": dict(V43_PALETTE),
            "type": dict(V43_FS),
            "fonts": {"sans": "gantari", "script": "felipa", "javanese": "noto"},
        },
    }
    return doc


def dumps(doc):
    return json.dumps(doc, ensure_ascii=False, indent=2) + "\n"


if __name__ == "__main__":
    out = sys.argv[sys.argv.index("--out") + 1] if "--out" in sys.argv else OUT
    text = dumps(document())
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    with open(out, "w", encoding="utf-8", newline="\n") as f:
        f.write(text)
    print("wrote", out, f"{len(text) // 1024} KB")

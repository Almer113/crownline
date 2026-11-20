"""Composed layout for the Wangsa Mataram chart.

The family is laid out as a tree, the way the chart would be drawn by hand:
  * rows: each generation is one regular step below its parent; brothers and sisters whose dates are
    close share a row; a row is pushed further down only when its people's dates require it
    (a soft time axis, RATE px per year);
  * columns: a tidy-tree packing - a parent sits straight over its main successor (the child with by
    far the largest branch) or centred over its children; every branch is packed as close to its
    neighbours as its own outline allows. Each person's notes, crown, house header and the line into
    them are part of that outline, so nothing collides;
  * the background time axis is then fitted to where people actually are (a monotone fit), so the
    half-century bands and era lines stay a faithful but gentle guide.
Hand adjustments are the "adjustments" of the chart document (read by chartdoc.py).
"""
import bisect
import re

from data import (KEEP_TOGETHER, TIME_ORDER, NOW, SHARE_BUS, BRACKETS, COUPLE_SIDE, FOLLOW_DX, CROWNS, DESC, DESC_IDS, ERAS, EVENTS, FOLLOW, HEADER_LEFT, HEADER_PANEL,
                  HEADER_ARRANGE, HEADERS, INLINE_NOTES, MARR, MARR_IDS, NOTES, NUDGE, PILLS)
from model import FS, NODES, TIES, text_w
import chartdoc

maps = chartdoc.map_module()     # the map panel's module, or None: a chart without a map panel

# ---------------------------------------------------------------- parameters
BUS = 30            # parent bottom -> horizontal line into the children
MINDROP = 50        # that line -> child top
HDR_ROOM = 205      # extra drop for the first member of a house (pill and house header)
CAP_ROOM = 40       # extra drop when a label sits on the line into a child
RATE = 4.6          # soft time axis, px per year
T_TOP = 330         # y of the first era's year (T_BASE) on the soft axis
SIB_YEARS = 20      # siblings whose dates are this close share a row
GAP = 44            # horizontal gap between neighbouring outlines
PILL_UP = 100       # pill centre above its member's top
GUTTER = 120
# the time axis: from the half-century before the first era (or the earliest person) to the decade after "as of"
T_BASE = ERAS[0][0] if ERAS else min(n.year for n in NODES.values() if n.year)
YEAR0 = T_BASE // 50 * 50
YEAR1 = (NOW // 10 + 1) * 10
HEADER_X, HEADER_Y, HEADER_W, HEADER_H = (HEADER_PANEL[k] for k in ("x", "y", "width", "height"))
# the card's arrangement: "row" (top left, the tree beside it), "column" (down the left side, as tall as
# the tree, holding the notes), "top" (across the top, as wide as the tree, the tree below it)
ARRANGE = HEADER_ARRANGE
TOP_GAP = 150       # "top": from the card's bottom to the first row
if ARRANGE == "top":
    T_TOP += HEADER_H + TOP_GAP
FOOT_H = 170        # caveats, sources and logos below the notes band

WARNINGS = []

SPOUSE_DX = {s: NODES[s].x - NODES[p].x for s, p in TIES.items()}


def anchor(nid):
    while nid in TIES:
        nid = TIES[nid]
    return nid


def members(a):
    """a person plus the spouses drawn beside them and anyone placed relative to those"""
    out = [a] + [s for s, p in TIES.items() if p == a]
    out += [f for f, lead in FOLLOW.items() if lead in out]
    return out


# ---------------------------------------------------------------- tree
GROUPS = {n: [] for n in NODES}      # anchor -> [dict(src, kids, side)]
TREE_PARENT = {}
CAP_KIDS = set(EVENTS)
for _i, _d in enumerate(DESC):
    for _k in list(_d["brk"]) + list(_d["caption"]):
        if _k in TIES and DESC_IDS[_i][_d["kids"].index(_k)] in SHARE_BUS:
            continue    # a spouse reached along an existing line: its break label fits beside the drop
        CAP_KIDS.add(_k)
    if _d["hop"] or _d["branch"] or _d["row"]:
        continue
    _kids = [k for k in _d["kids"] if k not in TIES]
    if not _kids:
        continue
    if _d.get("couple_of"):
        # a child of the parent and a spouse on the chart: hangs from the couple, on the spouse's side
        # (coupleSide 0: in file order among the parent's other children)
        _a, _b = _d["couple_of"]
        _side = COUPLE_SIDE.get(_d["union"], -1 if _d["parent"] == _b else 1)
        GROUPS[anchor(_d["parent"])].append(dict(src=("m", _a, _b), kids=_kids, side=_side))
    else:
        GROUPS[anchor(_d["parent"])].append(dict(src=("d", _d["parent"]), kids=_kids, side=0))
    for _k in _kids:
        if _k in TREE_PARENT:
            raise SystemExit(f"{_k} is a child in two places")
        TREE_PARENT[_k] = anchor(_d["parent"])
for _mi, (_a, _b, _h, _s, _couple, _ks) in enumerate(MARR):
    if not _couple:
        continue
    _anc = _b if TIES.get(_a) == _b else _a
    _side = COUPLE_SIDE.get(MARR_IDS[_mi], -1 if _anc == _b else 1)
    GROUPS[_anc].append(dict(src=("m", _a, _b), kids=list(_couple), side=_side, centre=_side == 0))
    for _k in _couple:
        if _k in TREE_PARENT:
            raise SystemExit(f"{_k} is a child in two places (of {TREE_PARENT[_k]} and {_anc})")
        TREE_PARENT[_k] = _anc
ROOTS = [n for n in NODES if n not in TIES and n not in FOLLOW and n not in TREE_PARENT]
if len(ROOTS) != 1:
    raise SystemExit(f"expected one root of the family tree, found {ROOTS}")
ROOT = ROOTS[0]
for _k in NUDGE:
    if _k not in NODES:
        raise SystemExit(f"NUDGE names an unknown person: {_k}")


def kids_of(a):
    return [k for g in GROUPS[a] for k in g["kids"]]


def subtree(a):
    out = []
    for m in members(a):
        out.append(m)
    for k in kids_of(a):
        out += subtree(k)
    return out


_lost = set(NODES) - set(subtree(ROOT)) - set(FOLLOW)
if _lost:
    raise SystemExit(f"not connected to the family tree: {sorted(_lost)}")

SIZE = {}


def size(a):
    if a not in SIZE:
        SIZE[a] = len(members(a)) + sum(size(k) for k in kids_of(a))
    return SIZE[a]


# ---------------------------------------------------------------- rows
def T(year):
    return T_TOP + RATE * (year - T_BASE)


def unit_bottom(a):
    return max(NODES[m].bottom for m in members(a) if m not in FOLLOW)


def set_row(a, cy):
    for m in members(a):
        if m in FOLLOW:
            continue
        NODES[m].cy = cy
    for f, lead in FOLLOW.items():
        if lead in members(a):
            ln, fn = NODES[lead], NODES[f]
            fn.cy = ln.top - 60 - fn.h / 2


def need_above(k):
    """distance from a parent's bottom to the top of child k"""
    if NODES[k].kind == "legend":
        return BUS + 26
    extra = (HDR_ROOM if k in PILLS else 0) + (CAP_ROOM if k in CAP_KIDS else 0)
    return BUS + MINDROP + extra


FLOOR = {}      # display.timeOrder: the lowest row anyone with an earlier year is on
ERA_ROOM = 70   # display.timeOrder: the gap between the rows either side of an era line


def crown_room(k):
    return 34 if k in CROWNS else 0


def place_rows(a):
    kids = sorted(kids_of(a), key=lambda k: NODES[k].year)
    clusters = []
    for k in kids:
        if clusters and NODES[k].year - NODES[clusters[-1][0]].year <= SIB_YEARS:
            clusters[-1].append(k)
        else:
            clusters.append([k])
    base = unit_bottom(a)
    for cl in clusters:
        y = max(T(NODES[cl[0]].year), max(base + need_above(k) + NODES[k].h / 2 for k in cl))
        for k in cl:
            set_row(k, max(y, FLOOR.get(k, 0)) + NUDGE.get(k, (0, 0))[1])
            place_rows(k)


# ---------------------------------------------------------------- soft time axis
YEARS, YMAP = [], {}


def fit_axis():
    """monotone (isotonic) fit of row position against year, through the people on the chart"""
    pts = {}
    for n in NODES.values():
        if n.id in TIES or n.id in FOLLOW or n.kind in ("text", "legend"):
            continue
        pts.setdefault(n.year, []).append(n.cy)
    xs = sorted(pts)
    blocks = [[sum(pts[x]) / len(pts[x]), len(pts[x]), [x]] for x in xs]
    i = 0
    while i < len(blocks) - 1:          # pool adjacent violators
        if blocks[i][0] > blocks[i + 1][0]:
            v0, w0, x0 = blocks[i]
            v1, w1, x1 = blocks[i + 1]
            blocks[i] = [(v0 * w0 + v1 * w1) / (w0 + w1), w0 + w1, x0 + x1]
            del blocks[i + 1]
            i = max(i - 1, 0)
        else:
            i += 1
    fit = {}
    for v, _w, yrs in blocks:
        lo, hi = min(yrs), max(yrs)
        for yr in yrs:                  # spread a pooled block over its years
            fit[yr] = v if hi == lo else v - 40 + 80 * (yr - lo) / (hi - lo)
    era_years = [yr for yr, _ in ERAS]
    for yr in era_years + [YEAR0, YEAR1]:
        if yr not in fit:                # anchor era years on the fitted curve
            lo = max((x for x in fit if x < yr), default=None)
            hi = min((x for x in fit if x > yr), default=None)
            if lo is not None and hi is not None:
                fit[yr] = fit[lo] + (fit[hi] - fit[lo]) * (yr - lo) / (hi - lo)
            elif lo is not None:
                fit[yr] = fit[lo] + RATE * (yr - lo)
            else:
                fit[yr] = fit[hi] - RATE * (hi - yr)
    YEARS[:] = sorted(fit)
    prev = None
    for yr in YEARS:
        y = fit[yr]
        if prev is not None:
            y = max(y, YMAP[prev] + 1.5 * (yr - prev))
            if yr in era_years:          # consecutive era lines stay at least 90 px apart
                last = max((e for e in era_years if e < yr), default=None)
                if last is not None and last in YMAP:
                    y = max(y, YMAP[last] + 90)
        YMAP[yr] = y
        prev = yr


def Y(year):
    if year <= YEARS[0]:
        return YMAP[YEARS[0]] - RATE * (YEARS[0] - year)
    if year >= YEARS[-1]:
        return YMAP[YEARS[-1]] + RATE * (year - YEARS[-1])
    i = bisect.bisect_left(YEARS, year)
    if YEARS[i] == year:
        return YMAP[year]
    a, b = YEARS[i - 1], YEARS[i]
    return YMAP[a] + (YMAP[b] - YMAP[a]) * (year - a) / (b - a)


# ---------------------------------------------------------------- notes
NBSP = " "
MONTHS = "Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec"
NOTE_WIDTHS = (240, 300, 360, 440, 560)


def nobreak(h):
    """keep dates, numbered titles and the last two words of a note together"""
    h = re.sub(rf"(\d) ({MONTHS})\b", rf"\1{NBSP}\2", h)
    h = re.sub(rf"\b({MONTHS}) (\d{{4}})", rf"\1{NBSP}\2", h)
    if KEEP_TOGETHER:
        h = re.sub(rf"({'|'.join(map(re.escape, KEEP_TOGETHER))}) ([IVX]+|\d+)\b", rf"\1{NBSP}\2", h)
    h = h.replace("d. c. ", f"d.{NBSP}c.{NBSP}")
    i = h.rfind(" ")
    if i > 0 and len(re.sub(r"<[^>]+>", "", h[i:])) < 14:
        h = h[:i] + NBSP + h[i + 1:]
    return h


def snap_width(w):
    return min(NOTE_WIDTHS, key=lambda c: abs(c - w))


def html_w(html_text, size):
    """width of a run of note text, with <b> parts measured in the bold face"""
    total, bold = 0.0, False
    for part in re.split(r"(<[^>]+>)", html_text):
        if part.startswith("<"):
            bold = {"<b>": True, "</b>": False}.get(part, bold)
        elif part:
            total += text_w(part.replace(NBSP, " "), size, bold)
    return total


def wrap_lines(html_text, width, size=FS["note"]):
    """lines the browser will need for this note: greedy breaks at spaces, after a hyphen inside a word
    (government-|appointed) and after an en dash (1729–|30), as Chrome does. Measurement matches Chrome
    closely (textmeasure.py), so only a half-pixel allowance is kept."""
    pieces = []                                    # (text, space before it)
    for w_ in (w_ for w_ in html_text.split(" ") if w_):
        for j, part in enumerate(re.split(r"(?<=[A-Za-z]-)(?=[A-Za-z])|(?<=–)(?=\w)", w_)):
            pieces.append((part, j == 0))
    lines, cur, bold = 0, "", False
    for part, space in pieces:
        trial = (cur + (" " if space and cur else "") + part)
        if html_w(("<b>" if bold else "") + trial, size) > width - 0.5 and cur:
            lines += 1
            if "<b>" in cur or "</b>" in cur:
                bold = cur.rfind("<b>") > cur.rfind("</b>")
            cur = part
        else:
            cur = trial
    return lines + (1 if cur else 0)


INLINE = [nt for i, nt in enumerate(NOTES) if i in INLINE_NOTES]
NUMBERED = [nt for i, nt in enumerate(NOTES) if i not in INLINE_NOTES]


def note_rect(anchor_id, side, dx, dy, w, h):
    n = NODES[anchor_id]
    w = snap_width(w)
    height = wrap_lines(nobreak(h), w) * FS["note"] * 1.3
    if side == "r":
        x, y = n.r + 26 + dx, n.top + dy
    elif side == "l":
        x, y = n.l - 26 - w + dx, n.top + dy
    elif side == "t":       # above the box, over the line into it; may sit on an era line
        cx = n.x
        for ids, _lab in BRACKETS:      # centred on the bracket the person belongs to, if any
            if anchor_id in ids:
                ns = [NODES[i] for i in ids]
                cx = (min(m.l for m in ns) + max(m.r for m in ns)) / 2
        return cx - w / 2 + dx, n.top + dy - height, w, height
    else:
        x, y = n.x - w / 2 + dx, n.bottom + 10 + dy
    era_ys = [Y(yr) for yr, _ in ERAS[1:]]
    for o in sorted(range(-160, 161, 2), key=lambda o: (abs(o), o < 0 if side == "b" else 0)):
        if side == "b" and o < 0:
            continue
        if all(not (y + o - 10 < ey < y + o + height + 10) for ey in era_ys):
            y += o
            break
    return x, y, w, height


# ---------------------------------------------------------------- house headers, crowns
HDR_H = 118


def hdr_w(k):
    """house header width measured from its contents"""
    import os
    import model
    import textmeasure
    script = textmeasure.measure(os.path.join(model.ROOT, model.SCRIPT_REL))
    img, kind, name, years, seat, founded = HEADERS[k]
    text = max(script.width(name, 40 * model.SCRIPT_SCALE), text_w(f"{years} · {seat}", 14.5, False) + 10,
               text_w(founded, 14.5, False) + 10, text_w(kind.upper(), 14) * 1.12)
    return (90 + 16 if img else 0) + text + 12


def pill_w(k):
    return text_w(PILLS[k][0], 17) + 44


def pill_pos(k):
    n = NODES[k]
    return n.x, n.top - PILL_UP


def header_rect(k):
    """the house header block sits to the right of the pill (left for those in HEADER_LEFT)"""
    x, cy = pill_pos(k)
    x0 = x + pill_w(k) / 2 + 18
    if k in HEADER_LEFT:
        x0 = x - pill_w(k) / 2 - 18 - hdr_w(k)
    return (x0, cy + 19 - HDR_H, x0 + hdr_w(k), cy + 19)      # bottom-aligned with the pill


def crown_w(k):
    return 31 + text_w(CROWNS[k], 18)


def crown_rect(k):
    n = NODES[k]
    cx = n.l + n.pw / 2 if n.pw else n.x               # centred over the portrait, clear of the line in
    x0 = cx - crown_w(k) / 2
    up = BRACKET_LIFT if k in BRACKETED else 0          # sits above the bracket over the box
    return (x0, n.top - 31 - up, x0 + crown_w(k), n.top - 7 - up)


BRACKETED = {i for ids, _ in BRACKETS for i in ids}
BRACKET_LIFT = 14


# ---------------------------------------------------------------- outlines and packing
def own_rects(a):
    rs = []
    for m in members(a):
        n = NODES[m]
        rs.append(n.rect(0))
        if m in CROWNS:
            rs.append(crown_rect(m))
        if n.tag:
            rs.append((n.r - 110, n.top - 30, n.r + 12, n.top))
        if m in PILLS:
            px, py = pill_pos(m)
            w = pill_w(m)
            rs.append((px - w / 2, py - 19, px + w / 2, py + 19))
            if m in HEADERS:
                rs.append(header_rect(m))
        if m in CAP_KIDS:
            rs.append((n.x + 8, n.top - MINDROP - CAP_ROOM + 4, n.x + 30 + 230, n.top - 6))
        for nt in INLINE:
            if nt[0] == m:
                x, y, w, h = note_rect(*nt)
                rs.append((x, y, x + w, y + h))
    return rs


def rects(a):
    rs = own_rects(a)
    yb = unit_bottom(a) + BUS
    for k in kids_of(a):
        kn = NODES[k]
        rs.append((kn.x - 8, yb, kn.x + 8, kn.top))      # the line down into the child
        rs += rects(k)
    return rs


def shift(a, dx):
    for nid in subtree(a):
        NODES[nid].x += dx


def yov(r, p):
    return r[1] < p[3] and p[1] < r[3]


def push_right(rs, placed):
    need = [p[2] + GAP - r[0] for r in rs for p in placed if yov(r, p)]
    return max(need) if need else None


def push_left(rs, placed):
    need = [p[0] - GAP - r[2] for r in rs for p in placed if yov(r, p)]
    return min(need) if need else None


def origin(a, g):
    if g["src"][0] == "d":
        return NODES[a].x
    _m, l, r = g["src"]
    if NODES[l].x > NODES[r].x:
        l, r = r, l
    return (NODES[l].r + NODES[r].l) / 2


def place_right(k, prev, placed):
    """put k's branch just right of what is placed, never left of its elder sibling"""
    p, n = NODES[prev], NODES[k]
    shift(k, p.r + GAP + n.pw + n.lw / 2 - n.x)      # at least side by side with prev
    dx = push_right(rects(k), placed)
    if dx is not None and dx > 0:
        shift(k, dx)


def place_left(k, prev, placed):
    p, n = NODES[prev], NODES[k]
    shift(k, p.l - GAP - n.lw / 2 - n.x)
    dx = push_left(rects(k), placed)
    if dx is not None and dx < 0:
        shift(k, dx)


def layout_x(a):
    """lay out a's branch with a at its current x; children are packed below"""
    for m in members(a):
        if m in TIES:
            NODES[m].x = NODES[TIES[m]].x + SPOUSE_DX[m]
    for f, lead in FOLLOW.items():
        if lead in members(a):
            NODES[f].x = NODES[lead].x + FOLLOW_DX.get(f, 0)
    groups = sorted(GROUPS[a], key=lambda g: (g["side"], g.get("centre", False)))
    if not groups:
        return
    for g in groups:
        for k in g["kids"]:
            NODES[k].x = 0
            layout_x(k)
    allkids = [k for g in groups for k in g["kids"]]
    sizes = sorted((size(k) for k in allkids), reverse=True)
    spine = None
    if len(allkids) == 1:
        spine = allkids[0]
    elif sizes[0] >= max(4, 2 * sizes[1]):
        spine = max(allkids, key=size)

    def arrange(g):
        o = origin(a, g)
        ks = g["kids"]
        if spine in ks:
            i = ks.index(spine)
            shift(spine, o - NODES[spine].x)
            placed = rects(spine)
            prev = spine
            for k in ks[i + 1:]:
                place_right(k, prev, placed)
                placed += rects(k)
                prev = k
            prev = spine
            for k in reversed(ks[:i]):
                place_left(k, prev, placed)
                placed += rects(k)
                prev = k
        else:
            shift(ks[0], o - NODES[ks[0]].x)
            placed = rects(ks[0])
            for prev, k in zip(ks, ks[1:]):
                place_right(k, prev, placed)
                placed += rects(k)
            mid = (NODES[ks[0]].x + NODES[ks[-1]].x) / 2
            for k in ks:
                shift(k, o - mid)

    for g in groups:
        arrange(g)
    centre = next((i for i, g in enumerate(groups) if g.get("centre")), None)
    if centre is None:
        centre = next((i for i, g in enumerate(groups) if spine in g["kids"]), None)
    if centre is None:
        centre = min(range(len(groups)), key=lambda i: abs(groups[i]["side"]))
    placed = own_rects(a) + [r for k in groups[centre]["kids"] for r in rects(k)]
    for g in groups[centre + 1:]:
        rs = [r for k in g["kids"] for r in rects(k)]
        dx = push_right(rs, placed)
        if dx and dx > 0:
            for k in g["kids"]:
                shift(k, dx)
        placed += [r for k in g["kids"] for r in rects(k)]
    for g in reversed(groups[:centre]):
        rs = [r for k in g["kids"] for r in rects(k)]
        dx = push_left(rs, placed)
        if dx and dx < 0:
            for k in g["kids"]:
                shift(k, dx)
        placed += [r for k in g["kids"] for r in rects(k)]


# ---------------------------------------------------------------- run
place_rows_root_y = HEADER_Y + 40 + (HEADER_H + TOP_GAP if ARRANGE == "top" else 0)
set_row(ROOT, place_rows_root_y)
place_rows(ROOT)
if TIME_ORDER:
    # nobody is drawn above a person with an earlier year, in any branch: lower each row to the
    # lowest earlier-dated row and lay the tree out again, until nothing moves; an era line (after the
    # first) gets a gap of its own: everyone from its year on is drawn below everyone before it
    _dated = [n for n in NODES.values() if n.year and n.id not in TIES and n.id not in FOLLOW
              and n.kind not in ("text", "legend")]
    _below = {n.id: set(subtree(n.id)) for n in _dated}     # a person's own descendants don't count
    for _ in range(len(_dated)):
        _moved = False
        for _n in _dated:
            _low = max((m.cy for m in _dated if m.year < _n.year and m.id not in _below[_n.id]), default=0)
            for _e, _ in ERAS[1:]:
                _before = [m.bottom for m in _dated if m.year < _e <= _n.year and m.id not in _below[_n.id]]
                if _before:
                    _low = max(_low, max(_before) + ERA_ROOM + crown_room(_n.id) + _n.h / 2)
            if _low > FLOOR.get(_n.id, 0) + 0.5:
                FLOOR[_n.id], _moved = _low, True
        if not _moved:
            break
        set_row(ROOT, place_rows_root_y)
        place_rows(ROOT)
fit_axis()
if TIME_ORDER:
    # each era line (after the first) halfway across the gap kept for it, the axis bent to match
    for _e, _ in ERAS[1:]:
        _up = max((m.bottom for m in _dated if m.year < _e), default=None)
        _dn = min((m.top - crown_room(m.id) for m in _dated if m.year >= _e), default=None)
        if _up is None or _dn is None or _up >= _dn:
            continue
        YMAP[_e] = (_up + _dn) / 2
        for _yr in YEARS:
            if _yr < _e:
                YMAP[_yr] = min(YMAP[_yr], YMAP[_e] - 1.5 * (_e - _yr))
            elif _yr > _e:
                YMAP[_yr] = max(YMAP[_yr], YMAP[_e] + 1.5 * (_yr - _e))
YMAP_FIT = dict(YMAP)       # the axis as fitted, before the canvas lifts its end (tools/golden.py records it)
NODES[ROOT].x = 0
layout_x(ROOT)
for _nid, (_dx, _dy) in NUDGE.items():
    if _dx:
        shift(_nid, _dx)
X_COLUMNS = {k: n.x for k, n in NODES.items()}     # before the canvas moves the tree (tools/golden.py records it)

# place the whole tree on the canvas, clear of the header (top left) and the map panel (top right)
ALL = rects(ROOT)
_hdr = (HEADER_X, HEADER_Y, HEADER_X + HEADER_W, 1e9 if ARRANGE == "column" else HEADER_Y + HEADER_H)
_dx = max([GUTTER + 40 - min(r[0] for r in ALL)]
          + [_hdr[2] + 60 - r[0] for r in ALL if yov(r, _hdr)])
shift(ROOT, _dx)
ALL = rects(ROOT)
MAP_Y = HEADER_Y + (HEADER_H + TOP_GAP if ARRANGE == "top" else 0)   # the map stays clear of a top card
if maps:
    _map_rows = (0, MAP_Y, 0, MAP_Y + maps.PANEL_H)
    W = int(max([max(r[2] for r in ALL) + 60 + GUTTER]
                + [r[2] + 60 + maps.PANEL_W + GUTTER + 20 for r in ALL if yov(r, _map_rows)]))
    MAP_X = W - GUTTER - 20 - maps.PANEL_W
else:
    W = int(max([max(r[2] for r in ALL) + 60 + GUTTER, HEADER_X + HEADER_W + GUTTER]))
    MAP_X = None
TREE_BOTTOM = max(r[3] for r in ALL)
# a row card taller than the tree pushes the footer down too
FOOT_Y = int(max(TREE_BOTTOM, HEADER_Y + HEADER_H if ARRANGE == "row" else 0) + 70)
if ARRANGE == "top":
    HEADER_W = W - 2 * HEADER_X                # as wide as the chart
elif ARRANGE == "column":
    HEADER_H = int(max(TREE_BOTTOM - HEADER_Y, HEADER_H))     # as tall as the tree, or its own height if taller


NOTE_COLS = max(1, min(5, (W - 2 * GUTTER - 80 + 46) // (440 + 46)))   # columns of the Notes band (at most 5)


def notes_band_h():
    """height of the lettered notes band: five balanced columns of wrapped notes (15 px type)"""
    cw = (W - 2 * GUTTER - 80 - (NOTE_COLS - 1) * 46) / NOTE_COLS - 30
    hs = [wrap_lines(nobreak(nt[5]), cw, 15) * 20.25 + 7 for nt in NUMBERED]
    if not hs:
        return 0                     # no lettered notes: no band
    per = -(-len(hs) // NOTE_COLS)
    return 34 + max(sum(hs[i:i + per]) for i in range(0, len(hs), per)) + 40


NOTES_H = 0 if ARRANGE == "column" else int(notes_band_h())     # a column card holds the notes
HGT = int(FOOT_Y + NOTES_H + FOOT_H)
if ARRANGE == "column":                  # the card holds the caveats, sources and badges too: no footer band
    HGT = FOOT_Y = int(max(TREE_BOTTOM, HEADER_Y + HEADER_H) + 130)
if Y(YEAR1) < TREE_BOTTOM + 30:          # the bands reach below the last person
    _lift = TREE_BOTTOM + 30 - Y(YEAR1)
    for _yr in YEARS:
        if _yr >= NOW:
            YMAP[_yr] += _lift * min(1, (_yr - (NOW - 1)) / (YEAR1 - (NOW - 1)))


def header_panel_rect():
    return (HEADER_X, HEADER_Y, HEADER_X + HEADER_W, HEADER_Y + HEADER_H)


def map_rect():
    """the map panel's rectangle, or None when the chart has no map panel"""
    return (MAP_X, MAP_Y, MAP_X + maps.PANEL_W, MAP_Y + maps.PANEL_H) if maps else None

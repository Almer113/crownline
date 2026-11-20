"""Wangsa Mataram family tree, UsefulCharts style.

    python build.py            -> wangsa-mataram.html (+ layout check report)
    python render.py           -> PNG + PDF (refuses to render if the check finds errors)

Layout lives in compose.py (a tidy family tree on generation rows with a soft time axis);
content in the chart document charts/wangsa-mataram/chart.json (read by chartdoc.py); box types in model.py;
maps in maps.py.
"""
import html
import os

from compose import maps
from compose import (FOOT_Y, GUTTER, HEADER_LEFT, NOTES_H, HDR_H, HEADER_H, HEADER_W, HEADER_X, HEADER_Y, HGT, INLINE,
                     MAP_X, MAP_Y, NOTE_COLS, NUMBERED, W, WARNINGS, YEAR0, YEAR1, Y, crown_rect, header_panel_rect,
                     header_rect, map_rect, nobreak, note_rect, pill_pos, pill_w, wrap_lines, ARRANGE)
from model import (PUBLIC, BAND, BG, FAINT, FS, GREYLINE, HOUSE, INK, MUTED, NEUTRAL, NODES, NOTE_INK, P,
                   ROOT, TIES, disp_title, hatch, published, text_w, tint)
import data
import model
from data import (AS_OF, BADGES, BRACKETS, CAVEATS, COUPLE_LINE, CROWNS, DESC, DISPUTED_PILLS, EPISODES, ERAS,
                  EVENTS, GLOSSARY, HEADERS, MARR, PILLS, SCALE, SUBTITLE, TITLE, TITLE_SCRIPT, TITLE_TEXT,
                  sources_text)

LINE = 4.5
BUS = 30          # preferred drop from a parent to the horizontal line
BAND_YEARS = 50
BUS_GAP = 30      # minimum distance between two parallel horizontal lines
ERA_CLEAR = 22    # lines keep this far from era lines
CORNER = 14       # radius of rounded line elbows
JAVANESE = TITLE_SCRIPT   # the title in a second script (aksara Jawa for Mataram), or ""


def anchor_of(a, b):
    """the partner the other was placed beside (the one who carries the line)"""
    return b if TIES.get(a) == b else a


# ================================================================ drawing state
SEGS = []         # dict(pts, col, style, hop, owner, order)
PATCHES = []      # (order of the line underneath, gap rect x, y, w, h)
MARKS = []
DROPS = {}        # (line owner, kid) -> (x, y_from, y_to, colour); a child can have more than one line
PILLPOS = {}      # kid -> (x, cy)
HRUNS = []        # (y, x0, x1, owner) horizontal runs already used
FALLBACKS = []    # buses that could not find a clear level
ERA_LABELS = {}   # era year -> (x, anchor, rect)
BRACKET_LABELS = {}


def e(s):
    return html.escape(s)


def bg_at(y):
    """background colour at height y (alternate bands are darker)"""
    for i, yr in enumerate(range(YEAR0, YEAR1, BAND_YEARS)):
        if Y(yr) <= y < Y(min(yr + BAND_YEARS, YEAR1)):
            return BAND if i % 2 else BG
    return BG


def node_col(n, fallback_house):
    h = n.house if n.house in HOUSE else fallback_house
    return HOUSE.get(h, GREYLINE)


def add_seg(pts, col, style, hop, owner):
    SEGS.append(dict(pts=pts, col=col, style=style, hop=hop, owner=owner, order=len(SEGS)))


def boxes_hit_h(y, x0, x1, exclude, pad=10):
    lo, hi = min(x0, x1), max(x0, x1)
    return [n.id for n in NODES.values() if n.id not in exclude and
            n.top - pad < y < n.bottom + pad and n.l - pad < hi and lo < n.r + pad]


def boxes_hit_v(x, y0, y1, exclude, pad=6):
    lo, hi = min(y0, y1), max(y0, y1)
    return [n.id for n in NODES.values() if n.id not in exclude and
            n.l - pad < x < n.r + pad and n.top - pad < hi and lo < n.bottom + pad]


OBST = []      # text blocks a horizontal line must not cross (house headers, inline notes)


def hits_obst(y, x0, x1, pad=8):
    lo, hi = min(x0, x1), max(x0, x1)
    return any(r[1] - pad < y < r[3] + pad and r[0] - pad < hi and lo < r[2] + pad for r in OBST)


SOURCE = {}       # line owner -> the point its line leaves the parent
SHARED = set()    # lines that share the level of another line from the same parent


def free_bus(sx, sy, xs, kid_tops, exclude, owner, ceiling=None, pref_drop=None, floor=None):
    """Choose the y of a horizontal bus: as close as possible to the preferred level, not through
    any box, not near another bus or an era line, with clear drops to the children."""
    SOURCE[owner] = (round(sx), round(sy))
    ylo = max(sy + 22, floor or 0)    # floor: keep clear of the bottoms of the boxes it leaves
    yhi = min(kid_tops + ([ceiling] if ceiling else [])) - 30
    pref = sy + (pref_drop or BUS)
    cands = sorted(range(int(ylo), int(max(ylo, yhi)) + 1, 3), key=lambda y: abs(y - pref))
    x0, x1 = min(xs + [sx]), max(xs + [sx])
    era_ys = [Y(yr) for yr, _ in ERAS[1:]]
    usable = []
    for y in cands:
        if any(abs(y - ey) < ERA_CLEAR for ey in era_ys):
            continue
        if boxes_hit_h(y, x0, x1, exclude) or hits_obst(y, x0, x1):
            continue
        if boxes_hit_v(sx, sy, y, exclude):
            continue
        if any(boxes_hit_v(x, y, t, exclude) for x, t in zip(xs, kid_tops)):
            continue
        near = [abs(y - hy) for hy, hx0, hx1, o in HRUNS
                if min(x1, hx1) - max(x0, hx0) > 30 and o != owner]
        if all(d >= BUS_GAP for d in near):
            return y
        usable.append((min(near), y))
    shared = [hy for hy, _a, _b, o in HRUNS if SOURCE.get(o) == SOURCE[owner] and ylo <= hy <= yhi]
    if shared:                       # no room for a level of its own: share the parent's existing line
        SHARED.add(owner)
        return shared[0]
    FALLBACKS.append(owner)
    if usable:                       # best compromise: as far as possible from the other lines
        return max(usable)[1]
    return min(max(pref, ylo), max(ylo, yhi))


def pill_geom(kid):
    x, cy = pill_pos(kid)
    return x, cy, pill_w(kid), 38


def draw_kid(k, x0, bus, house_col, kid_col, style, hop, owner):
    """bus run + drop into child k; colour switches at a house pill"""
    if k.id in PILLS:
        px, pcy = pill_pos(k.id)
        PILLPOS[k.id] = (px, pcy)
        add_seg([(x0, bus), (k.x, bus), (k.x, pcy)], house_col, style, hop, owner)
        add_seg([(k.x, pcy), k.T], kid_col, style, hop, owner)
    else:
        add_seg([(x0, bus), (k.x, bus), k.T], kid_col, style, hop, owner)
    DROPS[(owner, k.id)] = (k.x, bus, k.top, kid_col)


def draw_descend(d, idx):
    p = NODES[d["parent"]]
    sx, sy = p.B
    if d.get("couple_of"):          # leave from the middle of the parents' marriage line
        ca, cb = sorted((NODES[i] for i in d["couple_of"]), key=lambda n: n.x)   # whichever stands on the left
        sx, sy = (ca.r + cb.l) / 2, ca.cy
        floor = max(ca.bottom, cb.bottom) + 14   # not hugging the bottom of either partner's box
    else:
        floor = None
    kids = [NODES[k] for k in d["kids"]]
    styles = d["styles"]
    owner = f"d{idx}"
    pcol = HOUSE.get(p.house, GREYLINE)

    def col(k):
        st = styles.get(k.id, "solid")
        return GREYLINE if st == "grey" else node_col(k, p.house)

    if d["row"]:              # side by side on one row: a straight line from left to right
        k = kids[0]
        add_seg([(p.r, p.cy), (k.l, k.cy)], col(k), styles.get(k.id, "solid"), False, owner)
        return
    if len(kids) == 1 and abs(kids[0].x - sx) < 1 and not d["branch"] and not d["drop"]:
        k = kids[0]
        draw_kid(k, sx, sy, pcol, col(k), styles.get(k.id, "solid"), d["hop"], owner)
        return
    exclude = {p.id} | {k.id for k in kids}
    ceiling = None
    if d["branch"]:
        straight = [c for dd in DESC if dd["parent"] == p.id and not dd["branch"]
                    for c in dd["kids"] if abs(NODES[c].x - p.x) < 1]
        if not straight:
            raise SystemExit(f"branch from {p.id} needs a straight line below the parent")
        ceiling = min(NODES[c].top for c in straight)
    if len(kids) == 1 and kids[0].top < sy + 60:
        k = kids[0]           # the child sits level with the parent: a hook into the top of its box
        st = styles.get(k.id, "solid")
        y0 = max(p.bottom, k.bottom) + 12
        pts = hook(k, sx, sy, range(int(y0), int(y0) + 420, 3), exclude)
        if pts is None:       # no clean route: the box's "daughter of ..." line carries the link
            WARNINGS.append(f"no clean line from {p.id} to {k.id}; relying on its label")
            return
        (_, yb), (xv, _), _, (_, yt), _ = pts
        HRUNS.append((yb, min(sx, xv), max(sx, xv), owner))
        HRUNS.append((yt, min(xv, k.x), max(xv, k.x), owner))
        add_seg([(sx, sy)] + pts, col(k), st, d["hop"], owner)
        DROPS[(owner, k.id)] = (k.x, yt, k.top, col(k))
        return
    src = (round(sx), round(sy))
    runs = [r for r in HRUNS if SOURCE.get(r[3]) == src and r[3] != owner]
    if runs and all(did in data.SHARE_BUS for did in data.DESC_IDS[idx]):    # continue the parent's existing line
        bus = runs[0][0]
        hx0 = min(r[1] for r in runs if r[0] == bus)
        hx1 = max(r[2] for r in runs if r[0] == bus)
        SOURCE[owner] = src
        for k in kids:
            x0 = hx1 if k.x > hx1 else hx0 if k.x < hx0 else k.x
            HRUNS.append((bus, min(x0, k.x), max(x0, k.x), owner))
            draw_kid(k, x0, bus, pcol, col(k), styles.get(k.id, "solid"), d["hop"], owner)
        return
    level = {k.id for k in kids if k.top < sy + 60}     # reached by a hook from the bus
    bus = free_bus(sx, sy, [k.x for k in kids], [k.bottom + 44 if k.id in level else k.top for k in kids],
                   exclude, owner, ceiling=None if level else ceiling, pref_drop=d["drop"], floor=floor)
    xs = [sx] + [k.x for k in kids]
    HRUNS.append((bus, min(xs), max(xs), owner))
    if not d["branch"]:
        trunk_st = "solid"
        if all(styles.get(k.id) in ("dot", "grey", "legend", "adopt") for k in kids):
            trunk_st = styles.get(kids[0].id)
        tcol = GREYLINE if trunk_st == "grey" else pcol
        add_seg([(sx, sy), (sx, bus)], tcol, trunk_st, d["hop"], owner)
    for k in kids:
        if k.id in level:
            st = styles.get(k.id, "solid")
            pts = hook(k, sx, sy, [bus], exclude)
            if pts is None:
                WARNINGS.append(f"no clean line from {p.id} to {k.id}; relying on its label")
                continue
            HRUNS.append((pts[3][1], min(pts[2][0], k.x), max(pts[2][0], k.x), owner))
            add_seg(pts, col(k), st, d["hop"], owner)
            DROPS[(owner, k.id)] = (k.x, pts[3][1], k.top, col(k))
        else:
            draw_kid(k, sx, bus, pcol, col(k), styles.get(k.id, "solid"), d["hop"], owner)


def runs_clear(y, x0, x1, gap=18):
    lo, hi = min(x0, x1), max(x0, x1)
    return all(abs(y - hy) >= gap or min(hi, hx1) - max(lo, hx0) <= 30 for hy, hx0, hx1, _o in HRUNS)


def obst_v(x, y0, y1, pad=8):
    lo, hi = min(y0, y1), max(y0, y1)
    return any(r[0] - pad < x < r[2] + pad and r[1] - pad < hi and lo < r[3] + pad for r in OBST)


def hook(k, sx, sy, ybs, exclude):
    """A child level with its parent is entered from the top like every other child: down from the
    parent (or along its bus), across to a gap beside the child, up past it, over and down into it.
    ybs: candidate levels for the lower run (nearest first). Returns the points from (sx, yb) on."""
    sides = sorted((1, -1), key=lambda sd: abs((k.r + 30 if sd > 0 else k.l - 30) - sx))
    tops = []                                  # (side, d, yt) whose upper part is clear
    for sd in sides:
        for dd in range(26, 160, 4):
            xv = k.r + dd if sd > 0 else k.l - dd
            for yt in range(int(k.top) - 24, int(k.top) - 64, -3):
                if boxes_hit_h(yt, xv, k.x, exclude) or hits_obst(yt, xv, k.x) or not runs_clear(yt, xv, k.x):
                    continue
                if boxes_hit_v(k.x, yt, k.top, exclude) or boxes_hit_v(xv, yt, k.bottom, exclude, pad=14):
                    continue
                tops.append((xv, yt))
                break
    for yb in ybs:
        if boxes_hit_v(sx, sy, yb, exclude):
            continue
        for xv, yt in tops:
            if boxes_hit_h(yb, sx, xv, exclude) or hits_obst(yb, sx, xv) or not runs_clear(yb, sx, xv):
                continue
            if boxes_hit_v(xv, yt, yb, exclude, pad=14) or obst_v(xv, yt, yb):
                continue
            return [(sx, yb), (xv, yb), (xv, yt), (k.x, yt), (k.x, k.top)]
    return None


def draw_marriage(a, b, house, style, couple, kid_styles, idx):
    A, Bn = NODES[a], NODES[b]
    y = A.cy
    owner = f"m{idx}"
    mcol = HOUSE.get(house, GREYLINE)
    if not couple:
        add_seg([(A.r, y), (Bn.l, y)], mcol, style, False, owner)
        return
    jx = (A.r + Bn.l) / 2
    kids = [NODES[k] for k in couple]
    # a child standing under the marriage line takes the drop straight down into its box,
    # rather than the drop falling at the middle and the line doubling back to the child
    under = [k for k in kids if A.r + 12 <= k.x <= Bn.l - 12]
    if under:
        jx = min(under, key=lambda k: abs(k.x - jx)).x
    anchor = NODES[anchor_of(a, b)]
    other = Bn if anchor is A else A
    override = COUPLE_LINE.get((a, b))
    if override:
        h, royal = override, anchor
    else:
        kh = kids[0].house
        h = kh if kh in (A.house, Bn.house) else (anchor.house or other.house)
        royal = anchor if anchor.house == h else (other if other.house == h else None)
    pcol = HOUSE.get(h, GREYLINE)
    trunk = "solid" if any(kid_styles.get(k.id, "solid") == "solid" for k in kids) else kid_styles[kids[0].id]
    tcol = GREYLINE if trunk == "grey" else pcol
    # the children's line leaves the line-carrying parent, runs to the middle of the marriage
    # line and drops from there; the other half is the marriage line itself
    if royal is Bn:
        add_seg([(A.r, y), (jx, y)], mcol, style, False, owner)
        add_seg([(Bn.l, y), (jx, y)], tcol, trunk, False, owner)
    elif royal is A:
        add_seg([(A.r, y), (jx, y)], tcol, trunk, False, owner)
        add_seg([(jx, y), (Bn.l, y)], mcol, style, False, owner)
    else:
        add_seg([(A.r, y), (Bn.l, y)], mcol, style, False, owner)

    def col(k):
        st = kid_styles.get(k.id, "solid")
        return GREYLINE if st == "grey" else HOUSE.get(k.house or h, GREYLINE)

    if len(kids) == 1 and abs(kids[0].x - jx) < 2:
        k = kids[0]
        draw_kid(k, jx, y, pcol, col(k), kid_styles.get(k.id, "solid"), False, owner)
        return
    exclude = {a, b} | {k.id for k in kids}
    bus = free_bus(jx, max(A.bottom, Bn.bottom), [k.x for k in kids], [k.top for k in kids], exclude, owner)
    xs = [jx] + [k.x for k in kids]
    HRUNS.append((bus, min(xs), max(xs), owner))
    add_seg([(jx, y), (jx, bus)], tcol, trunk, False, owner)
    for k in kids:
        draw_kid(k, jx, bus, pcol, col(k), kid_styles.get(k.id, "solid"), False, owner)


def segments_of(s):
    return list(zip(s["pts"], s["pts"][1:]))


def rank(s):
    """which of two crossing lines goes over: solid (father to son) over dotted or grey, then a
    cross-house line over a tree line, then the later-drawn line"""
    return (s["style"] == "solid", s["hop"], s["owner"] not in SKIP_OWNERS, s["order"])


# lines across omitted generations (a GRANDSON-type break) pass under direct lines of the same kind
SKIP_OWNERS = {f"d{i}" for i, d in enumerate(DESC) if d["brk"]}


def hop_patches():
    """Every crossing of two lines is drawn as one passing over the other: the line underneath
    gets a small gap, cut out with a mask so the background shows through."""
    seen = set()
    for i, s in enumerate(SEGS):
        for t in SEGS[i + 1:]:
            if t["owner"] == s["owner"]:
                continue
            over, under = (s, t) if rank(s) > rank(t) else (t, s)
            for (a1, a2) in segments_of(over):
                for (b1, b2) in segments_of(under):
                    hor_a = abs(a1[1] - a2[1]) < .5
                    hor_b = abs(b1[1] - b2[1]) < .5
                    if hor_a == hor_b:
                        continue
                    h1, h2, v1, v2 = (a1, a2, b1, b2) if hor_a else (b1, b2, a1, a2)
                    hy, vx = h1[1], v1[0]
                    m = CORNER + 4         # never patch inside a rounded elbow or a junction
                    if not (min(h1[0], h2[0]) + m < vx < max(h1[0], h2[0]) - m and
                            min(v1[1], v2[1]) + m < hy < max(v1[1], v2[1]) - m):
                        continue
                    key = (round(vx), round(hy))
                    if key in seen:
                        continue
                    seen.add(key)
                    if hor_a:   # gap in the vertical run underneath
                        r = (vx - 2 * LINE, hy - 10, 4 * LINE, 20)
                    else:       # gap in the horizontal run underneath
                        r = (vx - 10, hy - 2 * LINE, 20, 4 * LINE)
                    PATCHES.append((under["order"], r))


TOL = 0.5


def sgn(v):
    return 0 if abs(v) < TOL else (1 if v > 0 else -1)


def rounded_path(pts, r=CORNER):
    """polyline with rounded elbows"""
    d = f"M{pts[0][0]:.1f},{pts[0][1]:.1f}"
    for i in range(1, len(pts) - 1):
        (x0, y0), (x1, y1), (x2, y2) = pts[i - 1], pts[i], pts[i + 1]
        l1 = abs(x1 - x0) + abs(y1 - y0)
        l2 = abs(x2 - x1) + abs(y2 - y1)
        rr = min(r, l1 / 2, l2 / 2)
        if rr < 1 or (abs(x0 - x1) < TOL and abs(x1 - x2) < TOL) or (abs(y0 - y1) < TOL and abs(y1 - y2) < TOL):
            d += f" L{x1:.1f},{y1:.1f}"
            continue
        ax, ay = x1 - rr * sgn(x1 - x0), y1 - rr * sgn(y1 - y0)
        bx, by = x1 + rr * sgn(x2 - x1), y1 + rr * sgn(y2 - y1)
        d += f" L{ax:.1f},{ay:.1f} Q{x1:.1f},{y1:.1f} {bx:.1f},{by:.1f}"
    d += f" L{pts[-1][0]:.1f},{pts[-1][1]:.1f}"
    return d


def seg_svg(s):
    dash = ' stroke-dasharray="4.5 5.5"' if s["style"] in ("dot", "grey") else ""
    if s["style"] == "adopt":
        dash = ' stroke-dasharray="16 7"'
    if s["style"] == "legend":
        dash = ' stroke-dasharray="1.5 7" stroke-linecap="round" stroke-width="3"'
    gaps = [r for o, r in PATCHES if o == s["order"]]
    mask = ""
    if gaps:
        cut = "".join(f'<rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" fill="black"/>'
                      for x, y, w, h in gaps)
        xs = [p[0] for p in s["pts"]]
        ys = [p[1] for p in s["pts"]]
        bx, by, bw, bh = min(xs) - 20, min(ys) - 20, max(xs) - min(xs) + 40, max(ys) - min(ys) + 40
        out = (f'<mask id="gap{s["order"]}" maskUnits="userSpaceOnUse" x="{bx:.0f}" y="{by:.0f}" '
               f'width="{bw:.0f}" height="{bh:.0f}"><rect x="{bx:.0f}" y="{by:.0f}" width="{bw:.0f}" '
               f'height="{bh:.0f}" fill="white"/>{cut}</mask>')
        mask = f' mask="url(#gap{s["order"]})"'
        return out + f'<path class="ln" data-owner="{s["owner"]}" d="{rounded_path(s["pts"])}" stroke="{s["col"]}"{dash}{mask}/>'
    return f'<path class="ln" data-owner="{s["owner"]}" d="{rounded_path(s["pts"])}" stroke="{s["col"]}"{dash}/>'


def drop_of(kid):
    """the drop into a child from the line that places it (tree lines are drawn first), or None"""
    return next((v for (_o, k), v in DROPS.items() if k == kid), None)


def left_out(kid, what, label):
    """a label that needs a line coming down into the person, when none does (the root, a row line)"""
    WARNINGS.append(f"no line comes down into {kid}, so its {what} \"{label}\" is left out")


def break_mark(owner, kid, label, at=0.5):
    if (owner, kid) not in DROPS:
        return left_out(kid, "break mark", label)
    x, y0, y1, col = DROPS[(owner, kid)]
    ym = y0 + (y1 - y0) * at
    MARKS.append(
        f'<rect x="{x - 14:.1f}" y="{ym - 9:.1f}" width="28" height="18" fill="{bg_at(ym)}"/>'
        f'<line x1="{x - 13:.1f}" y1="{ym - 1:.1f}" x2="{x + 13:.1f}" y2="{ym - 10:.1f}" stroke="{col}" '
        f'stroke-width="{LINE}"/>'
        f'<line x1="{x - 13:.1f}" y1="{ym + 10:.1f}" x2="{x + 13:.1f}" y2="{ym + 1:.1f}" stroke="{col}" '
        f'stroke-width="{LINE}"/>'
        f'<text x="{x + 22:.1f}" y="{ym + 5:.1f}" class="cap halo" style="stroke:{bg_at(ym)}">{e(label.upper())}</text>')


def caption(kid, label, cls="cap", owner=None):
    drop = DROPS.get((owner, kid)) if owner else drop_of(kid)
    if not drop:
        return left_out(kid, "caption" if cls == "cap" else "event", label)
    x, y0, y1, _ = drop
    ym = max((y0 + y1) / 2, y1 - 40)
    MARKS.append(f'<text x="{x + 14:.1f}" y="{ym + 5:.1f}" class="{cls} halo" style="stroke:{bg_at(ym)}">'
                 f'{e(label)}</text>')


def pill_svg(kid):
    label, house = PILLS[kid]
    x, cy, w, h = pill_geom(kid)
    disp = kid in DISPUTED_PILLS
    fill = "url(#hatchpill)" if disp else "#FFFFFF"
    dash = ' stroke-dasharray="11 6"' if disp else ""
    return (f'<rect x="{x - w / 2:.1f}" y="{cy - h / 2:.1f}" width="{w:.1f}" height="{h}" rx="{h / 2}" '
            f'fill="{fill}" stroke="{HOUSE[house]}" stroke-width="7"{dash}/>'
            f'<text x="{x:.1f}" y="{cy + 6:.1f}" class="pill">{e(label)}</text>')


def vertical_runs():
    for s in SEGS:
        for (a, b) in segments_of(s):
            if abs(a[0] - b[0]) < .5:
                yield a[0], min(a[1], b[1]), max(a[1], b[1])


BRACKET_DY = 10     # the bracket line runs this far above the tops of the boxes it groups


def bracket_geom(ids, label):
    """A bracket hugs the tops of the boxes it groups; its label sits just above the line, in a gap
    between the lines passing down through it. A label too wide for any gap is split in two, one half
    either side of the line nearest the middle; failing that it wraps onto two lines.
    Returns x0, x1, y, runs and the label pieces as [(x, anchor, text, rect)]."""
    ns = [NODES[i] for i in ids]
    x0, x1 = min(n.l for n in ns) - 8, max(n.r for n in ns) + 8
    y = min(n.top for n in ns) - BRACKET_DY
    runs = sorted(vx for vx, va, vb in vertical_runs() if x0 < vx < x1 and va < y < vb)
    blocks = [crown_rect(i) for i in ids if i in CROWNS]
    tw = lambda t: text_w(t, FS["small"]) * 1.12          # letter-spaced width
    top = y - 20

    def free(r, skip=None):
        return (x0 <= r[0] and r[2] <= x1 and not any(ov(r, bk) for bk in blocks)
                and all(vx == skip or vx < r[0] - 8 or vx > r[2] + 8 for vx in runs))

    best = None
    for c in range(int(x0 + 10), int(x1 - 10) + 1, 4):        # 1. one line in a gap
        w = tw(label) + 16
        r = (c - w / 2, top, c + w / 2, y - 3)
        if free(r) and (best is None or abs(c - (x0 + x1) / 2) < best[0]):
            best = (abs(c - (x0 + x1) / 2), [(c, "middle", label, r)])
    if best:
        return x0, x1, y, runs, best[1]
    words = label.split()
    for vx in sorted(runs, key=lambda v: abs(v - (x0 + x1) / 2)):   # 2. split either side of a line
        for k in range(1, len(words)):
            a, b = " ".join(words[:k]), " ".join(words[k:])
            ra = (vx - 12 - tw(a), top, vx - 12, y - 3)
            rb = (vx + 12, top, vx + 12 + tw(b), y - 3)
            if free(ra, vx) and free(rb, vx):
                cand = (abs(tw(a) - tw(b)), [(vx - 12, "end", a, ra), (vx + 12, "start", b, rb)])
                if best is None or cand[0] < best[0]:
                    best = cand
        if best:
            return x0, x1, y, runs, best[1]
    half = (len(words) + 1) // 2                                 # 3. two lines
    lines = [" ".join(words[:half]), " ".join(words[half:])]
    w = max(tw(t) for t in lines) + 16
    c = (x0 + x1) / 2
    r = (c - w / 2, top - 17, c + w / 2, y - 3)
    return x0, x1, y, runs, [(c, "middle", lines[0], (r[0], r[1], r[2], r[1] + 17)),
                             (c, "middle", lines[1], (r[0], r[1] + 17, r[2], r[3]))]


def bracket_svg(ids, label):
    """drawn beneath the family lines: where a line passes down through the bracket, the bracket
    has the gap (a mask), so the lines stay whole"""
    x0, x1, y, runs, pieces = bracket_geom(ids, label)
    mid = f"brk{len(BRACKET_LABELS)}"
    for i, (_x, _a, _t, r) in enumerate(pieces):
        BRACKET_LABELS[label + (f" ({i + 1})" if i else "")] = r
    cut = "".join(f'<rect x="{vx - 8:.1f}" y="{y - 5:.1f}" width="16" height="10" fill="black"/>' for vx in runs)
    text = "".join(f'<text class="brktx" x="{x:.1f}" y="{r[3] - 3:.1f}" style="text-anchor:{a}">{e(t)}</text>'
                   for x, a, t, r in pieces)
    bx, by, bw, bh = x0 - 10, y - 10, x1 - x0 + 20, 30
    return (f'<mask id="{mid}" maskUnits="userSpaceOnUse" x="{bx:.0f}" y="{by:.0f}" width="{bw:.0f}" '
            f'height="{bh:.0f}"><rect x="{bx:.0f}" y="{by:.0f}" width="{bw:.0f}" height="{bh:.0f}" '
            f'fill="white"/>{cut}</mask>'
            f'<path d="M{x0:.1f},{y + 7:.1f} V{y:.1f} H{x1:.1f} V{y + 7:.1f}" class="brkt" mask="url(#{mid})"/>'
            + text)


# ================================================================ notes
def note_html(note):
    _anchor, side, _dx, _dy, _w, h = note
    x, y, w, _ = note_rect(*note)
    al = "right" if side == "l" else ("center" if side in ("b", "t") else "left")
    return (f'<div class="note" style="left:{x:.1f}px;top:{y:.1f}px;width:{w}px;text-align:{al}">'
            f'{nobreak(h)}</div>')


# ================================================================ background
def era_label_w(lab):
    return text_w(lab.upper(), 30) + 6 * len(lab)


def place_era_labels(obstacles):
    """Each era label goes on the left if free, otherwise at the first clear alternative."""
    ERA_LABELS.clear()
    for yr, lab in ERAS:
        y = Y(yr)
        w = era_label_w(lab)
        cands = [(GUTTER + 14, "start"), (W - GUTTER - 14, "end")]
        if ARRANGE == "column":                       # beside the card before the far right
            cands.insert(1, (HEADER_X + HEADER_W + 44, "start"))
        cands += [(x, "start") for x in range(GUTTER + 214, int(W - GUTTER - w), 100)]
        chosen = None
        for dy in ((14, 48), (-42, -8)):              # below the line, else above it
            for x, anc in cands:
                x0 = x if anc == "start" else x - w
                r = (x0, y + dy[0], x0 + w, y + dy[1])
                rr = (r[0] - 30, r[1], r[2] + 30, r[3])    # keep clear of panels and boxes beside it
                if not any(ov(rr, o) for o in obstacles) and not any(ov(r, q[2]) for q in ERA_LABELS.values()):
                    chosen = (x, anc, r)
                    break
            if chosen:
                break
        if chosen is None:
            x0 = GUTTER + 14
            chosen = (x0, "start", (x0, y + 14, x0 + w, y + 48))
        ERA_LABELS[yr] = chosen


def epi_label(a, b, lab, side=None):
    """an episode's label: text, baseline y and rect; at the right edge of the band, or at the left when the
    right is blocked (EPI_LEFT, decided once the lines are drawn)"""
    y0, y1 = Y(a), Y(b)
    era_ys = [Y(yr) for yr, _ in ERAS[1:]]
    ty = next((t for t in (y0 + 19, y1 - 6, y0 - 8, y1 + 19)
               if not any(t - 20 < ey < t + 10 for ey in era_ys)), y0 + 19)
    t = f"{lab} · {a}–{str(b)[2:]}".upper()
    w = text_w(t, 17) + 1.5 * len(t)
    if (side or ("l" if lab in EPI_LEFT else "r")) == "l":
        x0 = EPI_X.get(lab, GUTTER + 14)
        hr = header_panel_rect()
        if lab not in EPI_X and ov((x0, ty - 13, x0 + w, ty + 3), hr):     # not under the card: just right of it
            x0 = hr[2] + 44
        return t, ty, (x0, ty - 13, x0 + w, ty + 3)
    return t, ty, (W - GUTTER - 14 - w, ty - 13, W - GUTTER - 14, ty + 3)


EPI_LEFT = set()     # episodes whose label goes at the left edge (a line or box is in the way on the right)
EPI_X = {}           # ... or further in, at the first clear place, when both edges are blocked


def place_episode_labels(obstacles):
    EPI_LEFT.clear()
    EPI_X.clear()
    for a, b, lab in EPISODES:
        r = epi_label(a, b, lab, "r")[2]
        if any(ov(r, o) for o in obstacles):
            rl = epi_label(a, b, lab, "l")[2]
            if not any(ov(rl, o) for o in obstacles):
                EPI_LEFT.add(lab)
                continue
            w = rl[2] - rl[0]
            for x in range(int(rl[0]) + 100, int(W - GUTTER - 14 - w), 100):
                if not any(ov((x, rl[1], x + w, rl[3]), o) for o in obstacles):
                    EPI_X[lab] = x
                    EPI_LEFT.add(lab)
                    break


def background_svg():
    out = []
    for i, yr in enumerate(range(YEAR0, YEAR1, BAND_YEARS)):
        y0, y1 = Y(yr), Y(min(yr + BAND_YEARS, YEAR1))
        if i % 2:
            out.append(f'<rect x="0" y="{y0:.1f}" width="{W}" height="{y1 - y0:.1f}" fill="{BAND}"/>')
    for a, b, lab in EPISODES:
        y0, y1 = Y(a), Y(b)
        out.append(f'<rect x="{GUTTER}" y="{y0:.1f}" width="{W - 2 * GUTTER}" height="{y1 - y0:.1f}" '
                   f'fill="url(#stripes)"/>')
        t, ty, _r = epi_label(a, b, lab)
        if lab in EPI_LEFT:
            out.append(f'<text x="{_r[0]:.0f}" y="{ty:.1f}" class="epi halo" '
                       f'style="stroke:{bg_at(ty)}">{e(t)}</text>')
        else:
            out.append(f'<text x="{W - GUTTER - 14}" y="{ty:.1f}" class="epi halo" text-anchor="end" '
                       f'style="stroke:{bg_at(ty)}">{e(t)}</text>')
    era_years = {yr for yr, _ in ERAS[1:]}
    for yr in range(YEAR0, YEAR1 + 1, BAND_YEARS):
        y = Y(yr)
        if any(abs(Y(ey) - y) < 45 for ey in era_years):
            continue    # an era year label sits here already
        cls = "yrc" if yr % 100 == 0 else "yr"
        out.append(f'<text x="{GUTTER - 16}" y="{y + 5:.1f}" class="{cls}" text-anchor="end">{yr}</text>'
                   f'<text x="{W - GUTTER + 16}" y="{y + 5:.1f}" class="{cls}">{yr}</text>'
                   f'<line x1="{GUTTER - 8}" y1="{y:.1f}" x2="{GUTTER}" y2="{y:.1f}" class="tick"/>'
                   f'<line x1="{W - GUTTER}" y1="{y:.1f}" x2="{W - GUTTER + 8}" y2="{y:.1f}" class="tick"/>')
    for i, (yr, lab) in enumerate(ERAS):
        y = Y(yr)
        if i:
            out.append(f'<line x1="{GUTTER}" y1="{y:.1f}" x2="{W - GUTTER}" y2="{y:.1f}" class="era"/>'
                       f'<text x="{GUTTER - 16}" y="{y + 5:.1f}" class="yre" text-anchor="end">{yr}</text>'
                       f'<text x="{W - GUTTER + 16}" y="{y + 5:.1f}" class="yre">{yr}</text>')
        x, anc, r = ERA_LABELS[yr]
        out.append(f'<text x="{x:.1f}" y="{r[3] - 6:.1f}" class="eralab halo" text-anchor="{anc}" '
                   f'style="stroke:{bg_at(r[1] + 16)}">{e(lab.upper())}</text>')
    return out


# ================================================================ html pieces
SILHOUETTE = (
    '<svg viewBox="0 0 88 88" width="100%" height="100%"><rect width="88" height="88" fill="#DDD8C9"/>'
    '<circle cx="44" cy="34" r="16" fill="#B8B2A2"/>'
    '<path d="M14 88 C14 64 28 56 44 56 C60 56 74 64 74 88 Z" fill="#B8B2A2"/></svg>')


def node_html(n):
    c = HOUSE.get(n.house, NEUTRAL)
    t = f'<div class="t">{e(disp_title(n.title))}</div>' if n.title else ""
    tag = f'<div class="tag">{e(n.tag)}</div>' if n.tag else ""
    hcls = " hatched" if n.hatch else ""
    if n.kind == "legend":
        s = f'<div class="s2">{e(n.sub)}</div>' if n.sub else ""
        return (f'<div class="legendbox" style="left:{n.x - n.lw / 2:.1f}px;top:{n.top:.1f}px;width:{n.lw:.1f}px;'
                f'height:{n.h}px;border-color:{c}">{t}<div class="n2">{e(n.name)}</div>{s}</div>')
    trad = f";background:{tint(c, .5)};outline:2.5px dashed {c};outline-offset:-2.5px" if n.trad else ""
    if n.kind in ("ruler", "heir"):
        img = f'<img src="{n.pic}">' if n.pic else SILHOUETTE
        bg = hatch(c) if n.hatch else (tint(c) if n.kind == "heir" else c)
        return (f'<div class="ruler" style="left:{n.l:.1f}px;top:{n.top:.1f}px">'
                f'<div class="pic">{img}</div>'
                f'<div class="lab{hcls}" style="width:{n.lw:.1f}px;background:{bg}{trad}">{t}'
                f'<div class="n">{e(n.name)}</div><div class="s">{e(n.sub)}</div>{tag}</div></div>')
    pic = (f'<img class="npic" src="{n.pic}" style="left:{n.l:.1f}px;top:{n.top:.1f}px;'
           f'width:{n.h}px;height:{n.h}px">') if n.pic else ""
    if n.pw and not n.pic:
        pic = (f'<div class="npic" style="left:{n.l:.1f}px;top:{n.top:.1f}px;width:{n.h}px;height:{n.h}px;'
               f'overflow:hidden">{SILHOUETTE}</div>')
    left = n.x - n.lw / 2
    sub = n.sub if n.kind == "neutral" else e(n.sub)
    s = f'<div class="s2">{sub}</div>' if n.sub else ""
    if n.kind == "minor":
        bg = hatch(c) if n.hatch else c
        return pic + (f'<div class="minor{hcls}" style="left:{left:.1f}px;top:{n.top:.1f}px;width:{n.lw:.1f}px;'
                      f'height:{n.h}px;background:{bg}{trad}">{t}<div class="n2">{e(n.name)}</div>{s}{tag}</div>')
    if n.kind == "neutral":
        return pic + (f'<div class="neutral" style="left:{left:.1f}px;top:{n.top:.1f}px;width:{n.lw:.1f}px;'
                      f'height:{n.h}px">{t}<div class="n2">{e(n.name)}</div>{s}</div>')
    return (f'<div class="txt" style="left:{left:.1f}px;top:{n.top - data.TEXT_LIFT.get(n.id, 0):.1f}px;width:{n.lw:.1f}px;'
            f'height:{n.h}px"><div class="n2">{e(n.name)}</div>{s}</div>')


def house_header_html(k):
    img, kind, name, years, seat, founded = HEADERS[k]
    x0, y0, x1, _y1 = header_rect(k)
    flip = ";flex-direction:row-reverse;text-align:right" if k in HEADER_LEFT else ""
    if img and published(img):
        emblem = f'<img src="{img}">'
    elif img:          # left out of a public build: keep its space so the header does not move
        emblem = '<span style="width:90px;height:74px;flex:none"></span>'
    else:
        emblem = ""
    return (f'<div class="hhead" style="left:{x0:.1f}px;top:{y0:.1f}px;width:{x1 - x0:.1f}px;height:{HDR_H}px{flip}">'
            f'{emblem}<div><div class="kind">{e(kind)}</div><div class="hname">{e(name)}</div>'
            f'<div class="facts"><b>{e(years)}</b> · {e(seat)}<br><i>{e(founded)}</i></div></div></div>')


CROWN_SVG = ('<svg width="26" height="19" viewBox="0 0 22 16"><path d="M2 14 L1 3 L6.5 8 L11 1 L15.5 8 L21 3 '
             'L20 14 Z" fill="{c}" stroke="#7A5A1E" stroke-width="1.2" stroke-linejoin="round"/></svg>')


def crown_html(k):
    x0, y0, _x1, _y1 = crown_rect(k)
    c = HOUSE.get(NODES[k].house, "#EFC239")
    return (f'<div class="crown" data-for="{k}" style="left:{x0:.1f}px;top:{y0:.1f}px;background:{bg_at(y0 + 12)}">'
            f'{CROWN_SVG.format(c=c)}'
            f'<span>{e(CROWNS[k])}</span></div>')


def numbered_order():
    """markers are numbered top to bottom, then left to right"""
    return sorted(NUMBERED, key=lambda nt: (round(NODES[nt[0]].cy / 60), NODES[nt[0]].x))


def letter(i):
    """a, b, … z, then aa, ab, … az, ba, … (never more than two letters)"""
    ab = "abcdefghijklmnopqrstuvwxyz"
    if i < 26:
        return ab[i]
    i -= 26
    return ab[i // 26] + ab[i % 26]


def marker_html(k, i):
    n = NODES[k]
    c = HOUSE.get(n.house, NEUTRAL)
    top = n.top - 13 if k in data.MARKER_TOP else n.bottom - 13
    return (f'<div class="marker" data-for="{k}" style="left:{n.r - 13:.1f}px;top:{top:.1f}px;'
            f'background:{tint(c, .35)};border-color:{c}">{letter(i)}</div>')


def glossary_html():
    if not GLOSSARY:
        return ""                    # a chart without terms (yet): no heading over nothing
    cols = [[g] for g in dict.fromkeys(grp for grp, *_rest in GLOSSARY)]     # one column per group, in file order
    out = []
    for groups_ in cols:
        rows = ""
        for g in groups_:
            rows += f'<tr><td colspan="3" class="gg">{e(g)}</td></tr>'
            for grp, ab, full, en in GLOSSARY:
                if grp != g:
                    continue
                rows += (f'<tr><td class="ab">{e(ab)}</td><td class="en">{e(en)}</td>'
                         f'<td class="full">{e(full)}</td></tr>')     # one column per kind: no zig-zag
        out.append(f"<table>{rows}</table>")
    return f'<div class="gloss"><div class="gh">{e(data.GLOSSARY_TITLE)}</div><div class="gcols">{"".join(out)}</div></div>'


def key_html():
    """the Key: one row per kind of line, box and mark the chart actually uses; colours from panels.key
    (house: the examples' colour; contrast: a second house), wording overridable by entry id (panels.key.labels)"""
    hc = HOUSE[data.KEY["house"]]
    hc2 = HOUSE[data.KEY["contrast"]]
    ns = list(NODES.values())
    styles = {st for d in DESC for st in d["styles"].values()} | {st for m in MARR for st in m[5].values()}
    styles |= {m[3] for m in MARR}
    first = lambda pred: next((n.house for n in ns if pred(n) and n.house in HOUSE), data.KEY["house"])  # noqa: E731
    legend_c = HOUSE[first(lambda n: n.kind == "legend")]
    trad_c = HOUSE[first(lambda n: n.trad)]
    disputed_c = HOUSE[disputed_house()]

    def sw(style, col=hc, brk=False, cap=False):
        dash = ' stroke-dasharray="4.5 5.5"' if style != "solid" else ""
        if style == "legend":
            dash = ' stroke-dasharray="1.5 7" stroke-linecap="round"'
        if style == "adopt":
            dash = ' stroke-dasharray="16 7"'
        mark = ""
        if brk:
            mark = (f'<rect x="29" y="0" width="16" height="16" fill="{BG}"/>'
                    f'<line x1="22" y1="9" x2="36" y2="2" stroke="{col}" stroke-width="{LINE}"/>'
                    f'<line x1="38" y1="14" x2="52" y2="7" stroke="{col}" stroke-width="{LINE}"/>')
        if cap:
            return (f'<svg width="74" height="30"><line x1="12" y1="0" x2="12" y2="30" stroke="{col}" '
                    f'stroke-width="{LINE}"{dash}/><text x="22" y="20" class="cap">note</text></svg>')
        return (f'<svg width="74" height="16"><line x1="2" y1="8" x2="72" y2="8" stroke="{col}" '
                f'stroke-width="{LINE}"{dash}/>{mark}</svg>')

    def box(bg, h=22, extra=""):
        return f'<span class="kbox" style="background:{bg};height:{h}px;{extra}"></span>'

    # a dotted line passes under a solid one: the dotted line has the gap
    hop = (f'<svg width="74" height="22"><line x1="2" y1="11" x2="28" y2="11" stroke="{hc2}" '
           f'stroke-width="{LINE}" stroke-dasharray="4.5 5.5"/><line x1="47" y1="11" x2="72" y2="11" '
           f'stroke="{hc2}" stroke-width="{LINE}" stroke-dasharray="4.5 5.5"/>'
           f'<line x1="37" y1="0" x2="37" y2="22" stroke="{hc}" stroke-width="{LINE}"/></svg>')

    def pill(disputed=False):
        fill = "url(#hatchpill)" if disputed else "#fff"
        dash = ' stroke-dasharray="7 4"' if disputed else ""
        c = disputed_c if disputed else hc
        return (f'<svg width="74" height="26"><rect x="3" y="3" width="68" height="20" rx="10" fill="{fill}" '
                f'stroke="{c}" stroke-width="5"{dash}/><text x="37" y="17.5" class="kpill">HOUSE</text></svg>')

    sil = ('<span class="kbox" style="width:30px;height:30px;margin-left:22px;margin-right:22px">'
           f'{SILHOUETTE}</span>')
    brkt = (f'<svg width="74" height="20"><path d="M3,18 V6 H71 V18" fill="none" stroke="{MUTED}" '
            f'stroke-width="1.8"/></svg>')
    # (entry id, shown when, swatch, default wording)
    lines = [
        ("solid", True, sw("solid"), "Father to son"),
        ("dot", "dot" in styles, sw("dot"), "Through a daughter, or by marriage"),
        ("adopt", "adopt" in styles, sw("adopt"), "Adopted as heir"),
        ("grey", "grey" in styles, sw("grey", GREYLINE), "Marriage, descent or patronage outside the dynasty"),
        ("omitted", any(d["brk"] for d in DESC), sw("solid", brk=True), "Generations omitted"),
        ("chronicle", "legend" in styles, sw("legend", legend_c), "Descent claimed by the chronicles"),
        ("caption", any(d["caption"] for d in DESC), sw("dot", cap=True), "Relationship noted on the line"),
        ("crossing", bool(PATCHES), hop, "Where lines cross, solid passes over dotted"),
        ("house", any(k not in DISPUTED_PILLS for k in PILLS), pill(), "Founding of a royal house"),
        ("houseDisputed", bool(DISPUTED_PILLS), pill(True), "Self-proclaimed, unrecognised house"),
        ("bracket", bool(BRACKETS), brkt, "Rival claimants or a disputed group"),
        ("event", bool(EVENTS), '<span class="kev">EVENT · 1677</span>', "Event on the line"),
    ]
    kinds = {n.kind for n in ns}
    boxes = [
        ("ruler", "ruler" in kinds, box(hc), "Ruler"),
        ("heir", "heir" in kinds, box(tint(hc)), "Heir to the throne"),
        ("rival", any(n.hatch for n in ns), box(hatch(hc)), "Rival or unrecognised claimant"),
        ("traditional", any(n.trad for n in ns),
         box(tint(trad_c, .5), 22, f"outline:2.5px dashed {trad_c};outline-offset:-2.5px"), "Known only from court chronicles"),
        ("legendary", "legend" in kinds, box("transparent", 22, f"border:2.5px dashed {legend_c};border-radius:5px"),
         "Legendary ancestor"),
        ("minor", "minor" in kinds, box(hc, 16, "width:52px;margin:0 11px"), "Royal family member who did not reign"),
        ("marriedIn", any(NODES[k].kind == "minor" and NODES[k].house for k in TIES),
         box(hc2, 16, "width:52px;margin:0 11px"), "Princess married in (birth-house colour)"),
        ("neutral", "neutral" in kinds, box(NEUTRAL), "Public figure outside the courts"),
        ("text", "text" in kinds, '<span class="ktext">Name</span>', "Spouse from outside the dynasty"),
        ("noPortrait", any(n.pw and not n.pic for n in ns), sil, "No known portrait"),
        ("tag", any(n.tag for n in ns), '<span class="ktag">disputed</span>', "Status disputed"),
        ("crown", bool(CROWNS), f'<span class="kcrown">{CROWN_SVG.format(c=hc)}<b>2 · 4</b></span>',
         "Order of reign (one number per reign)"),
        ("letter", bool(NUMBERED), f'<span class="kmark" style="background:{tint(hc, .35)};border-color:{hc}">a</span>',
         "See the lettered Notes below"),
    ]

    def lab(k, default):
        return data.KEY["labels"].get(k, default)

    KEY_ROWS[:] = [sum(1 for r in lines if r[1]), sum(1 for r in boxes if r[1]),
                   max(88 + text_w(lab(k, b), 16, bold=False) for k, show, a, b in lines + boxes if show)]
    col1 = "".join(f'<div class="krow">{a}<span>{lab(k, b)}</span></div>' for k, show, a, b in lines if show)
    col2 = "".join(f'<div class="krow">{a}<span>{lab(k, b)}</span></div>' for k, show, a, b in boxes if show)
    houses = "".join(f'<div class="hk"><span style="background:{HOUSE[h]}"></span>{e(data.HOUSE_NAMES[h])}</div>'
                     for h in HOUSE)
    bgrow = (f'<div class="kbg"><span class="kbox" style="background:{BAND};height:22px;width:54px;'
             f'border:1px solid #D8D1BC"></span>{lab("band", "Half-century band")}')
    if len(ERAS) > 1:
        bgrow += (f'<svg width="60" height="12"><line x1="0" y1="6" x2="60" y2="6" class="era"/></svg>'
                  f'{lab("era", "Start of an era")}')
    if EPISODES:
        bgrow += f'<span class="kbox kstripe"></span>{lab("episode", "War, rebellion or foreign rule")}'
    bgrow += "</div>"
    note = lab("axis", "People are placed near the year they began to reign; half-century bands "
                       "stretch where many reigns fall close together.")
    return (f'<div class="key"><div class="gh">Key</div><div class="kcols"><div>{col1}</div>'
            f'<div>{col2}</div></div><div class="houses">{houses}</div>{bgrow}'
            f'<div class="kn">{note}</div></div>')


def disputed_house():
    """the house a disputed pill belongs to (its colour hatches the pill), else the key's house"""
    return next((PILLS[k][1] for k in PILLS if k in DISPUTED_PILLS), data.KEY["house"])


def footer_html(span=None):
    """the caveats, the sources and the badges: placed below the notes band (span: its width), or in the
    flow of a column card (no span)"""
    cav = "".join(f"<div>{c}</div>" for c in CAVEATS)
    src = sources_text(PUBLIC) + f'<b>Information as of {AS_OF}.</b>'
    # badges: the first is the licence badge, the others logos (left out of a public build when private)
    badges = "".join(f'<img class="{"cc" if i == 0 else "fm"}" src="{b}">' for i, b in enumerate(BADGES) if published(b))
    if span is None:
        return f'<div class="caveats">{cav}</div><div class="sources">{src}</div><div class="footer">{badges}</div>'
    cav_w = int(span * .6)                       # caveats take three fifths, sources the rest
    src_x = GUTTER + 40 + cav_w + 60
    return (f'<div class="caveats" style="left:{GUTTER + 40}px;top:{FOOT_Y + NOTES_H}px;width:{cav_w}px">{cav}</div>'
            f'<div class="sources" style="left:{src_x}px;top:{FOOT_Y + NOTES_H}px;width:{span - cav_w - 120}px">'
            + src + '</div>'
            f'<div class="footer" style="right:{GUTTER + 40}px;top:{FOOT_Y + NOTES_H}px">{badges}</div>')


KEY_ROWS = [0, 0]      # rows in the Key's two columns (for the column card's height estimate)


def notes_items():
    return "".join(f'<li><span class="no" style="background:{tint(HOUSE.get(NODES[nt[0]].house, NEUTRAL), .35)};'
                   f'border-color:{HOUSE.get(NODES[nt[0]].house, NEUTRAL)}">{letter(i)}</span> '
                   f'{nobreak(nt[5])}</li>' for i, nt in enumerate(numbered_order()))


def succession_html():
    title, rows = data.SUCCESSION
    # the divider is the Key's wording, so it is set the same way (the document's markup is checked)
    trs = "".join((f'<tr class="sdiv"><td colspan="4">{div}</td></tr>' if div is not None else "")
                  + f'<tr><td class="sn">{n}</td><td class="snm">{e(nm)}</td><td class="sy">{e(yrs)}</td>'
                  f'<td class="sh">{e(how)}</td></tr>' for n, nm, yrs, how, div in rows)
    return f'<div class="succ"><div class="gh">{e(title)}</div><table>{trs}</table></div>'


def gloss_widths():
    """(width, rows) of each glossary group's table"""
    out = []
    for g in dict.fromkeys(g for g, *_r in GLOSSARY):
        rows = [r for r in GLOSSARY if r[0] == g]
        out.append((max(text_w(r[1], 16, bold=True) + text_w(r[3], 16, bold=False)
                        + min(text_w(r[2], 14, bold=False), 240) + 60 for r in rows), len(rows) + 1))
    return out


def succession_h(width):
    """the succession table's height at this width"""
    return 28 + sum(wrap_lines(e(r[3]), width - 260, 15) * 21 + 4 + (34 if r[4] is not None else 0)
                    for r in data.SUCCESSION[1])


def column_estimate(inner):
    """the column card's content height (px), and the succession table's: from the same text measurement
    the notes use, so a full column is caught before it spills"""
    title = (wrap_lines(f"<b>{e(TITLE)}</b>", inner, 150) * 142.5 + (78 if JAVANESE else 0)
             + 22 + sum(wrap_lines(s, inner, 36) for s in SUBTITLE.split("<br>")) * 43.2
             + 22 + wrap_lines(TITLE_TEXT, inner, 19) * 27.6)
    key_html()
    houses_per_row = max(1, int((inner + 22) // 190))
    side_by_side = 2 * KEY_ROWS[2] + 40 <= inner        # else the Key's two columns stack
    key = 30 + 28 + (max(KEY_ROWS[:2]) if side_by_side else sum(KEY_ROWS[:2])) * 32 + 10 + -(-len(HOUSE) // houses_per_row) * 30 + 32 + 2 * 20.3 + 8
    widths = gloss_widths()
    gloss, line_w, line_h = 26 + 28, 0, 0
    for w_, n in widths:                         # tables wrap into lines of the column's width
        if line_w and line_w + 40 + w_ > inner:
            gloss, line_w, line_h = gloss + line_h + 14, 0, 0
        line_w, line_h = line_w + (40 if line_w else 0) + w_, max(line_h, n * 24.5)
    gloss += line_h
    notes = 0
    if NUMBERED:
        notes = 26 + 28 + sum(wrap_lines(nobreak(nt[5]), inner - 30, 15) * 20.25 + 7 for nt in NUMBERED)
    succ = 0
    if data.SUCCESSION:
        succ = 26 + succession_h(inner)
    foot = (30 + sum(wrap_lines(c, inner, 15) * 21.75 + 8 for c in CAVEATS)
            + 14 + wrap_lines(sources_text(PUBLIC) + f"<b>Information as of {AS_OF}.</b>", inner, 15) * 21.75 + 26 + 120)
    return 48 + title + key + gloss + notes + foot, succ


def header_html():
    box = f'left:{HEADER_X}px;top:{HEADER_Y:.1f}px;width:{HEADER_W}px;height:{HEADER_H}px'
    title = (f'<div class="title"><h1>{e(TITLE)}</h1><div class="jawa">{JAVANESE}</div>'
             f'<h2>{SUBTITLE}</h2><p>{TITLE_TEXT}</p></div>')
    if ARRANGE == "column":
        body, succ = column_estimate(HEADER_W - 58)
        extra = ""
        if NUMBERED:
            extra += f'<div class="fnotes"><div class="gh">Notes</div><ol>{notes_items()}</ol></div>'
        if data.SUCCESSION and body + succ <= HEADER_H:
            extra += succession_html()
        elif data.SUCCESSION:
            WARNINGS.append(f"no room for the succession table in the column card (needs about "
                            f"{int(body + succ - HEADER_H)} px more)")
        if body > HEADER_H:
            WARNINGS.append(f"the column card's content (about {int(body)} px) is taller than the card ({HEADER_H} px): give it a height of at least {int(body) + 1}")
        return (f'<div class="header column" style="{box}">{title}{key_html()}{glossary_html()}{extra}'
                f'<div class="cfoot">{footer_html()}</div></div>')
    if ARRANGE == "top":
        key = key_html()
        # the succession table goes in the room left at the right, if there is enough
        free = (HEADER_W - 56 - 1250 - max(2 * KEY_ROWS[2] + 40, 830) - max((w for w, _n in gloss_widths()), default=0) - 3 * 70)
        extra = ""
        if data.SUCCESSION and free >= 600 and succession_h(free) <= HEADER_H - 48:
            extra = succession_html()
        elif data.SUCCESSION:
            WARNINGS.append("no room for the succession table in the top card")
        return f'<div class="header top" style="{box}"><div class="hrow">{title}{key}{glossary_html()}{extra}</div></div>'
    return (f'<div class="header" style="{box}"><div class="hrow">{title}{key_html()}</div>{glossary_html()}</div>')


# ================================================================ layout check
def ov(r1, r2):
    return r1[0] < r2[2] and r2[0] < r1[2] and r1[1] < r2[3] and r2[1] < r1[3]


def seg_rect(a, b, pad=2):
    return (min(a[0], b[0]) - pad, min(a[1], b[1]) - pad, max(a[0], b[0]) + pad, max(a[1], b[1]) + pad)


def ends_at_box(a, b, n):
    """the segment a-b starts or ends on the edge of box n and leaves it"""
    for p, q in ((a, b), (b, a)):
        if abs(p[1] - q[1]) < .5:      # horizontal
            if n.top <= p[1] <= n.bottom and (abs(p[0] - n.l) < 2 and q[0] <= n.l + 1 or
                                              abs(p[0] - n.r) < 2 and q[0] >= n.r - 1):
                return True
        else:                           # vertical
            if n.l <= p[0] <= n.r and (abs(p[1] - n.top) < 2 and q[1] <= n.top + 1 or
                                       abs(p[1] - n.bottom) < 2 and q[1] >= n.bottom - 1):
                return True
    return False


def text_rects():
    """every placed text block or panel: name -> rect"""
    rects = {"header": header_panel_rect()}
    if maps:
        rects["map panel"] = map_rect()
    for k in HEADERS:
        rects[f"house header {k}"] = header_rect(k)
    for nt in INLINE:
        x, y, w, h = note_rect(*nt)
        rects[f"note:{nt[0]}"] = (x, y, x + w, y + h)
    for yr, (_x, _a, r) in ERA_LABELS.items():
        rects[f"era label {yr}"] = r
    for a, b, lab in EPISODES:
        rects[f"episode {lab}"] = epi_label(a, b, lab)[2]
    for lab, r in BRACKET_LABELS.items():
        rects[f"bracket label {lab}"] = r
    for k in PILLS:
        x, cy, w, h = pill_geom(k)
        rects[f"pill {k}"] = (x - w / 2, cy - h / 2, x + w / 2, cy + h / 2)
    rects["footer"] = (GUTTER, FOOT_Y, W - GUTTER, HGT)
    for i, r in enumerate(HIST):
        rects[f"historicity label {i}"] = r
    for k in CROWNS:
        rects[f"crown {k}"] = crown_rect(k)
    return rects


TOP_NOTES = {f"note:{nt[0]}" for nt in INLINE if nt[1] == "t"}


def line_name(owner):
    """a line's name in the chart document: its first descent's id (d<i>) or its union's id (m<i>)"""
    i = int(owner[1:])
    return data.DESC_IDS[i][0] if owner[0] == "d" else data.MARR_IDS[i]


def lint():
    """Geometric sanity checks. Returns (errors, warnings)."""
    errs, warns = [], list(WARNINGS)
    ns = list(NODES.values())
    for i, a in enumerate(ns):
        for b in ns[i + 1:]:
            if ov(a.rect(2), b.rect(2)):
                errs.append(f"boxes overlap: {a.id} / {b.id}")
    for s in SEGS:
        for (a, b) in segments_of(s):
            if abs(a[1] - b[1]) < .5:
                hit = boxes_hit_h(a[1], a[0], b[0], set(), pad=-1)
            else:
                hit = boxes_hit_v(a[0], a[1], b[1], set(), pad=-1)
            for hid in hit:
                if not ends_at_box(a, b, NODES[hid]):
                    errs.append(f"line {line_name(s['owner'])} passes through box {hid}")
    # parallel lines lying on each other
    hs = [(a[1], min(a[0], b[0]), max(a[0], b[0]), s["owner"]) for s in SEGS for a, b in segments_of(s)
          if abs(a[1] - b[1]) < .5]
    for i, (y1, a1, b1, o1) in enumerate(hs):
        for (y2, a2, b2, o2) in hs[i + 1:]:
            if o1 != o2 and abs(y1 - y2) < 18 and min(b1, b2) - max(a1, a2) > 20 and not (
                    abs(y1 - y2) < .5 and {o1, o2} & SHARED and SOURCE.get(o1) == SOURCE.get(o2)):
                errs.append(f"lines {o1} and {o2} lie on top of each other at y={y1:.0f}")
    rects = text_rects()
    keys = list(rects)
    pill_keys = {f"pill {k}" for k in PILLS}
    for i, k1 in enumerate(keys):
        for k2 in keys[i + 1:]:
            if ov(rects[k1], rects[k2]):
                errs.append(f"{k1} overlaps {k2}")
        for n in ns:
            if ov(rects[k1], n.rect(4)):
                errs.append(f"{k1} overlaps box {n.id}")
        if k1 in pill_keys or k1 == "footer":
            continue
        inner = (rects[k1][0] + 3, rects[k1][1] + 3, rects[k1][2] - 3, rects[k1][3] - 3)
        for s in SEGS:
            for (a, b) in segments_of(s):
                if ov(inner, seg_rect(a, b)):
                    errs.append(f"line {line_name(s['owner'])} runs through {k1}")
                    break
        if not k1.startswith(("era", "yr", "footer", "header", "map", "crown", "bracket"))                 and k1 not in TOP_NOTES:   # these mask the line, or (notes above a line) may sit on it
            for yr, _ in ERAS[1:]:
                if rects[k1][1] - 4 < Y(yr) < rects[k1][3] + 4:
                    errs.append(f"era line {yr} runs through {k1}")
    for owner in FALLBACKS:
        warns.append(f"line {line_name(owner)} could not find a clear level")
    return sorted(set(errs)), sorted(set(warns))


# ================================================================ css
# extra rules for the "column" and "top" cards (none for "row", so a row chart's page is unchanged)
ARRANGE_CSS = {"row": "", "column": """.header.column { display: flex; flex-direction: column; }
.header.column .title { width: auto; }
.header.column .cfoot { margin-top: auto; padding-top: 30px; }
.header.column .caveats, .header.column .sources, .header.column .footer { position: static; }
.header.column .sources { margin-top: 14px; }
.header.column .footer { margin-top: 26px; }
.header.column .key { margin-top: 30px; }
.header.column .kn { width: auto; }
.header.column .kcols { flex-wrap: wrap; column-gap: 40px; }
.header.column .gcols { flex-wrap: wrap; gap: 14px 40px; }
.header.column .fnotes { position: static; margin-top: 26px; }
.header.column .fnotes ol { columns: 1; }
""", "top": """.header.top .hrow { gap: 70px; }
.header.top .gloss { margin-top: 0; }
.header.top .gcols { flex-direction: column; gap: 6px; }
.header.top .succ { margin-top: 0; flex: 1 1 0; min-width: 0; }
"""}[ARRANGE]
if ARRANGE != "row" and data.SUCCESSION:
    ARRANGE_CSS += f""".succ {{ margin-top: 26px; font-size: 15px; }}
.succ table {{ border-collapse: collapse; width: 100%; }}
.succ td {{ padding: 2px 14px 2px 0; line-height: 1.4; vertical-align: top; }}
.succ td.sn {{ font-weight: 700; color: #5A4520; text-align: right; width: 34px; }}
.succ td.snm {{ font-weight: 700; white-space: nowrap; }}
.succ td.sy {{ color: {MUTED}; white-space: nowrap; }}
.succ td.sh {{ color: {NOTE_INK}; }}
.succ tr.sdiv td {{ border-top: 1.5px solid #CFC8B3; padding: 8px 0 4px; font-weight: 700; font-size: 13px;
  letter-spacing: 1.2px; text-transform: uppercase; color: {MUTED}; }}
"""

CSS = f"""
@font-face {{ font-family: 'AHG'; src: url('{model.FONT_REL_R}'); font-weight: 400; }}
@font-face {{ font-family: 'AHG'; src: url('{model.FONT_REL_B}'); font-weight: 700; }}
@font-face {{ font-family: 'Chancery'; src: url('{model.SCRIPT_REL}'); }}
{"@font-face { font-family: 'Jawa'; src: url('" + model.JAVANESE_REL + "'); }" + chr(10) if model.JAVANESE_REL else ""}@page {{ size: {W}px {HGT}px; margin: 0; }}
* {{ box-sizing: border-box; margin: 0; padding: 0; }}
html, body {{ background: {BG}; }}
body {{ width: {W}px; height: {HGT}px; font-family: 'AHG', Helvetica, Arial, sans-serif; color: {INK};
  -webkit-print-color-adjust: exact; print-color-adjust: exact; }}
#chart {{ position: relative; width: {W}px; height: {HGT}px; overflow: hidden; background: {BG}; }}
svg.layer {{ position: absolute; left: 0; top: 0; }}
svg.layer path.ln {{ fill: none; stroke-width: {LINE}; stroke-linejoin: round; stroke-linecap: butt; }}
.halo {{ paint-order: stroke; stroke-width: 7px; stroke-linejoin: round; }}
.pill {{ font: 700 17px 'AHG'; text-anchor: middle; fill: {INK}; letter-spacing: .3px; }}
.yr {{ font: 400 17px 'AHG'; fill: {FAINT}; }}
.yrc {{ font: 700 19px 'AHG'; fill: {FAINT}; }}
.yre {{ font: 700 19px 'AHG'; fill: {MUTED}; }}
.tick {{ stroke: {FAINT}; stroke-width: 1.5; }}
.era {{ stroke: #D2CAB4; stroke-width: 5; stroke-dasharray: 18 10; }}
.eralab {{ font: 700 30px 'AHG'; fill: #9A9078; letter-spacing: 6px; }}
.epi {{ font: 700 17px 'AHG'; fill: {MUTED}; letter-spacing: 1.5px; }}
.cap {{ font: 700 13px 'AHG'; fill: {MUTED}; letter-spacing: 1.2px; }}
.brkt {{ fill: none; stroke: {MUTED}; stroke-width: 1.8; }}
.brktx {{ font: 700 {FS['small']}px 'AHG'; fill: {MUTED}; text-anchor: middle; letter-spacing: 1.2px; }}
.ruler {{ position: absolute; display: flex; height: {P}px; }}
.ruler .pic {{ width: {P}px; height: {P}px; overflow: hidden; background: #DDD8C9; border-radius: 9px 0 0 9px; }}
.ruler .pic img {{ width: 100%; height: 100%; object-fit: cover; display: block; }}
.lab {{ position: relative; height: {P}px; border-radius: 0 9px 9px 0; display: flex; flex-direction: column; justify-content: center;
  align-items: center; text-align: center; }}
.hatched {{ text-shadow: 0 0 3px #FFFFFF, 0 0 3px #FFFFFF, 0 0 5px rgba(255,255,255,.8); }}
.t {{ font-weight: 700; font-size: {FS['title']}px; letter-spacing: .4px; line-height: 1.1; }}
.n {{ font-weight: 700; font-size: {FS['name']}px; line-height: 1.12; margin-top: 2px; white-space: nowrap; }}
.s {{ font-size: {FS['reign']}px; line-height: 1.2; margin-top: 3px; white-space: nowrap; }}
.tag {{ position: absolute; right: -10px; top: -26px; font-weight: 700; font-size: 14px; letter-spacing: 1px;
  text-transform: uppercase; color: {MUTED}; background: {BG}; border: 1.5px solid {MUTED}; padding: 1px 6px;
  text-shadow: none; }}
.minor, .txt, .neutral {{ position: absolute; display: flex; flex-direction: column; justify-content: center;
  align-items: center; text-align: center; }}
.n2 {{ font-weight: 700; font-size: {FS['name2']}px; line-height: 1.15; white-space: nowrap; }}
.s2 {{ font-size: {FS['sub2']}px; line-height: 1.2; margin-top: 1px; white-space: nowrap; }}
.txt {{ text-shadow: 0 0 3px {BG}, 0 0 3px {BG}, 0 0 6px {BG}, 0 0 6px {BG}; }}
.neutral {{ background: {NEUTRAL}; }}
.minor, .neutral {{ border-radius: 7px; }}
.legendbox {{ position: absolute; display: flex; flex-direction: column; justify-content: center; align-items: center;
  text-align: center; border: 2.5px dashed; border-radius: 7px; background: rgba(255,255,255,.25); color: {MUTED}; }}
.legendbox .n2 {{ font-style: italic; }}
.hist {{ stroke: {MUTED}; stroke-width: 2.5; }}
.histh {{ font: 700 14px 'AHG'; fill: {INK}; letter-spacing: 1.3px; }}
.histt {{ font: 400 15px 'AHG'; fill: {NOTE_INK}; }}
.npic {{ border-radius: 7px 0 0 7px; }}
.npic {{ position: absolute; object-fit: cover; }}
.note {{ position: absolute; font-size: {FS['note']}px; line-height: 1.3; color: {NOTE_INK};
  text-shadow: 0 0 3px #EAE4D3, 0 0 3px #EAE4D3, 0 0 5px #EAE4D3, 0 0 5px #EAE4D3; }}
.note b {{ color: {INK}; }}
.hhead {{ position: absolute; display: flex; align-items: center; gap: 16px; }}
.hhead img {{ height: 74px; width: 90px; object-fit: contain; flex: none; }}
.hhead .hname {{ font-size: {40 * model.SCRIPT_SCALE:.1f}px; line-height: 1.05; margin-top: 0; }}
.hhead .facts {{ font-size: 14.5px; line-height: 1.3; margin-top: 2px; white-space: nowrap; }}
.crown {{ position: absolute; display: flex; align-items: center; justify-content: center; gap: 5px;
  font: 700 18px 'AHG'; color: #5A4520; }}
.crown svg {{ display: block; }}
.marker {{ position: absolute; min-width: 26px; padding: 0 4px; height: 26px; border-radius: 13px; border: 2px solid; color: {INK};
  font: italic 700 15px/22px 'AHG'; text-align: center; box-shadow: 0 0 0 2.5px {BG}; }}
.event {{ font: 700 14px 'AHG'; fill: {INK}; letter-spacing: 1.3px; }}
.fnotes {{ position: absolute; font-size: 15px; line-height: 1.35; color: {NOTE_INK}; }}
.fnotes ol {{ list-style: none; columns: {NOTE_COLS}; column-gap: 46px; }}
.fnotes li {{ break-inside: avoid; margin-bottom: 7px; }}
.fnotes li .no {{ display: inline-block; min-width: 22px; height: 22px; border-radius: 11px; border: 2px solid;
  color: {INK}; font-size: 13px; font-weight: 700; font-style: italic; line-height: 18px; text-align: center;
  margin-right: 6px; }}
.jawa {{ font-family: 'Jawa', serif; font-size: 40px; color: {MUTED}; margin-top: 4px; line-height: 1.2; margin-bottom: 26px; }}
.kind {{ font-weight: 700; font-size: 14px; letter-spacing: 1.4px; text-transform: uppercase; }}
.hname {{ font-family: 'Chancery', serif; font-size: {46 * model.SCRIPT_SCALE:.1f}px; line-height: 1.15; margin-top: 2px; }}
.facts {{ font-size: 15px; line-height: 1.35; margin-top: 4px; }}
.header {{ position: absolute; background: #EFEBDD; border: 1px solid #CFC8B3; padding: 24px 28px; }}
.hrow {{ display: flex; gap: 40px; }}
.title {{ width: 1250px; flex: none; }}
.title h1 {{ font-weight: 700; font-size: 150px; line-height: .95; letter-spacing: -3px; }}
.title h2 {{ font-weight: 400; font-size: 36px; line-height: 1.2; margin-top: 22px; }}
.title p {{ font-size: 19px; line-height: 1.45; margin-top: 22px; color: {NOTE_INK}; }}
.gloss {{ font-size: 16px; margin-top: 26px; }}
.gh {{ font-weight: 700; font-size: 15px; letter-spacing: 1.4px; text-transform: uppercase; margin-bottom: 10px; }}
.gcols {{ display: flex; gap: 40px; align-items: flex-start; }}
.gloss td {{ padding: 2px 18px 2px 0; line-height: 1.25; white-space: nowrap; }}
.gloss td.ab {{ font-weight: 700; }}
.gloss td.en {{ font-style: italic; }}
.gloss td.full {{ color: {MUTED}; font-size: 14px; white-space: normal; max-width: 240px; }}
.gloss td.gg {{ font-weight: 700; font-size: 13px; letter-spacing: 1.2px; text-transform: uppercase; color: {MUTED};
  padding-top: 6px; }}
.key {{ font-size: 16px; }}
.kcols {{ display: flex; gap: 40px; }}
.kev {{ display: inline-block; width: 74px; font: 700 10.5px 'AHG'; letter-spacing: .6px; white-space: nowrap; }}
.kcrown {{ display: inline-flex; align-items: center; gap: 4px; width: 74px; font: 700 15px 'AHG'; color: #5A4520; }}
.kmark {{ display: inline-block; width: 26px; height: 26px; margin: 0 24px; border-radius: 13px; border: 2px solid;
  font: italic 700 15px/22px 'AHG'; text-align: center; }}
.krow {{ display: flex; align-items: center; gap: 14px; height: 32px; white-space: nowrap; }}
.kbox {{ display: inline-block; width: 74px; overflow: hidden; flex: none; }}
.kstripe {{ height: 22px; width: 54px; background: repeating-linear-gradient(135deg, #DCD5BF 0 5px, {BG} 5px 15px); }}
.ktext {{ display: inline-block; width: 74px; text-align: center; font-weight: 700; }}
.ktag {{ display: inline-block; width: 74px; text-align: center; font-weight: 700; font-size: 13px;
  letter-spacing: .5px; text-transform: uppercase; color: {MUTED}; border: 1.5px solid {MUTED}; padding: 1px 0; }}
.kpill {{ font: 700 12px 'AHG'; text-anchor: middle; fill: {INK}; letter-spacing: .5px; }}
.houses {{ display: flex; flex-wrap: wrap; gap: 8px 22px; margin-top: 10px; }}
.hk {{ display: flex; align-items: center; gap: 8px; font-weight: 700; }}
.hk span {{ width: 22px; height: 22px; display: inline-block; }}
.kbg {{ display: flex; align-items: center; gap: 12px; margin-top: 10px; white-space: nowrap; }}
.kbg svg, .kbg .kbox {{ margin-left: 12px; }}
.kn {{ font-size: 15px; color: {MUTED}; margin-top: 8px; line-height: 1.35; width: 830px; }}
{ARRANGE_CSS}.footer {{ position: absolute; display: flex; align-items: center; gap: 26px; }}
.footer img.fm {{ height: 120px; }}
.footer img.cc {{ height: 36px; }}
.sources, .caveats {{ position: absolute; font-size: 15px; line-height: 1.45; color: {NOTE_INK}; }}
.caveats {{ columns: 2; column-gap: 50px; }}
.caveats div {{ break-inside: avoid; margin-bottom: 3px; }}
{maps.CSS if maps else ""}
"""

DEFS = (f'<defs><pattern id="stripes" width="22" height="22" patternUnits="userSpaceOnUse" '
        f'patternTransform="rotate(45)"><rect width="7" height="22" fill="#DCD5BF" opacity=".5"/></pattern>'
        f'<pattern id="hatchpill" width="12" height="12" patternUnits="userSpaceOnUse" '
        f'patternTransform="rotate(45)"><rect width="12" height="12" fill="#FFFFFF"/>'
        f'<rect width="5" height="12" fill="{tint(HOUSE[disputed_house()], .45)}"/></pattern></defs>')


# ================================================================ assemble
def draw_all():
    for lst in (SEGS, PATCHES, MARKS, FALLBACKS):
        lst.clear()
    for dct in (DROPS, PILLPOS, ERA_LABELS, BRACKET_LABELS):
        dct.clear()
    HRUNS.clear()
    SOURCE.clear()
    SHARED.clear()
    OBST[:] = [header_rect(k) for k in HEADERS] + [crown_rect(k) for k in CROWNS] + [
        (x - w / 2, cy - h / 2, x + w / 2, cy + h / 2) for x, cy, w, h in (pill_geom(k) for k in PILLS)] + [
        (x, y, x + w, y + h) for x, y, w, h in (note_rect(*nt) for nt in INLINE)]
    for i, d in enumerate(DESC):          # tree lines first, then marriages,
        if not d["hop"]:
            draw_descend(d, i)
    for i, m in enumerate(MARR):
        draw_marriage(*m, i)
    for i, d in enumerate(DESC):          # then the cross-house lines that hop over them
        if d["hop"]:
            draw_descend(d, i)
    hop_patches()
    for i, d in enumerate(DESC):
        for k, lab in d["brk"].items():
            break_mark(f"d{i}", k, lab, data.BREAK_AT.get(data.DESC_IDS[i][d["kids"].index(k)], 0.5))
        for k, lab in d["caption"].items():
            caption(k, lab.upper(), owner=f"d{i}")
    for k, lab in EVENTS.items():
        caption(k, lab, "event")
    # era labels avoid boxes, panels, notes, legends and lines
    obstacles = [n.rect(6) for n in NODES.values()] + [header_panel_rect()] + ([map_rect()] if maps else [])
    obstacles += [(x, y, x + w, y + h) for x, y, w, h in (note_rect(*nt) for nt in INLINE)]
    obstacles += [header_rect(k) for k in HEADERS]
    obstacles += [seg_rect(a, b, 6) for s in SEGS for a, b in segments_of(s)]
    place_episode_labels(obstacles)
    obstacles += [epi_label(a, b, lab)[2] for a, b, lab in EPISODES if lab in EPI_LEFT]
    place_era_labels(obstacles)


HIST = []      # rects of the historicity scale labels (for the layout check)
def historicity_svg():
    """a scale beside a trunk (the chart document's "scale" panel): legend -> court tradition -> documented.
    Like the chronicle line it follows, the scale bends: it runs along under the legendary row,
    turns down at the trunk and ends in an arrow at the first ruler documented by the VOC."""
    HIST.clear()
    if not SCALE:
        return []
    lg0, lg1 = (NODES[k] for k in SCALE["row"])
    han = NODES[SCALE["documented"]]
    x = min(NODES[i].l for i in SCALE["trunk"]) - 46
    x0, yh = lg0.l, lg1.bottom + 22
    y2, y3 = han.top + 10, han.bottom + 10
    out = [f'<line x1="{x0:.1f}" y1="{yh:.1f}" x2="{x:.1f}" y2="{yh:.1f}" class="hist" stroke-dasharray="2 6"/>',
           f'<line x1="{x}" y1="{yh:.1f}" x2="{x}" y2="{y2:.1f}" class="hist" stroke-dasharray="10 6"/>',
           f'<line x1="{x}" y1="{y2:.1f}" x2="{x}" y2="{y3 - 10:.1f}" class="hist"/>',
           f'<line x1="{x0:.1f}" y1="{yh - 9:.1f}" x2="{x0:.1f}" y2="{yh + 9:.1f}" class="hist"/>',
           f'<line x1="{x - 9}" y1="{y2:.1f}" x2="{x + 9}" y2="{y2:.1f}" class="hist"/>',
           f'<path d="M{x - 7},{y3 - 12:.1f} L{x},{y3 + 2:.1f} L{x + 7},{y3 - 12:.1f} Z" fill="{MUTED}"/>']
    st = SCALE["stages"]
    labels = [(x0, yh + 30, "start", st[0]["head"], st[0]["lines"]),
              (x - 18, None, "end", st[1]["head"], st[1]["lines"]),
              (x - 18, None, "end", st[2]["head"], st[2]["lines"])]
    mids = [None, (yh + y2) / 2, (y2 + y3) / 2]
    for (tx, ty, anc, head, lines), ym in zip(labels, mids):
        if ty is None:
            ty = ym - (len(lines) * 18 + 20) / 2 + 14
        out.append(f'<text x="{tx:.1f}" y="{ty:.1f}" class="histh" text-anchor="{anc}">{head}</text>')
        for i, t in enumerate(lines):
            out.append(f'<text x="{tx:.1f}" y="{ty + 20 + i * 18:.1f}" class="histt" text-anchor="{anc}">{e(t)}</text>')
        w = max(text_w(t, 15, False) for t in lines + [head]) + 10
        left = tx - w if anc == "end" else tx - 4
        HIST.append((left, ty - 15, left + w + 4, ty + 6 + len(lines) * 18))
    return out


def lines_svg():
    """lines in over/under order (see rank); lines underneath carry their gaps as masks"""
    return [seg_svg(s) for s in sorted(SEGS, key=rank)]


LOGO_W = 320       # licence badge and logo at the right of the footer
CHART_ID = data.CHART_ID
OUT_NAME = CHART_ID + ("-public" if PUBLIC else "")   # a public build never overwrites the private one
OUT_NAME = os.environ.get("CHART_OUT") or OUT_NAME      # another name or an absolute path (tests building a changed copy)


_COMPOSE_WARNINGS = list(WARNINGS)   # the layout's own; drawing adds more, so a second build starts again from these


def build(report=True):
    WARNINGS[:] = _COMPOSE_WARNINGS
    draw_all()
    bg = [f'<svg class="layer" width="{W}" height="{HGT}">', DEFS] + background_svg() + ["</svg>"]
    brackets = [bracket_svg(*b) for b in BRACKETS]
    lines = ([f'<svg class="layer" width="{W}" height="{HGT}">'] + historicity_svg() + brackets + lines_svg()
             + MARKS + [pill_svg(k) for k in PILLS] + ["</svg>"])
    body = ['<div id="chart">', "".join(bg), "".join(lines), header_html()]
    # each person's elements in an unstyled wrapper carrying their id, for the viewer (draws nothing itself)
    body += [f'<div data-id="{n.id}">{node_html(n)}</div>' for n in NODES.values()]
    body += [house_header_html(k) for k in HEADERS]
    body += [crown_html(k) for k in CROWNS]
    body += [note_html(n) for n in INLINE]
    order = numbered_order()
    body += [marker_html(nt[0], i) for i, nt in enumerate(order)]
    items = notes_items()
    if order and ARRANGE != "column":                    # the Notes band (a column card holds the notes)
        body.append(f'<div class="fnotes" style="left:{GUTTER + 40}px;top:{FOOT_Y}px;width:{W - 2 * GUTTER - 80}px">'
                    f'<div class="gh">Notes</div><ol>{items}</ol></div>')
    if maps:
        body.append(maps.panel_html(MAP_X, MAP_Y))
    if ARRANGE != "column":                              # a column card holds these itself
        body.append(footer_html(span=W - 2 * GUTTER - 80 - LOGO_W))
    body.append("</div>")
    doc = (f'<!doctype html><html lang="{data.LANG}"><head><meta charset="utf-8"><title>{e(TITLE)}</title>'
           f'<style>{CSS}</style></head><body>{"".join(body)}</body></html>')
    out = os.path.join(ROOT, OUT_NAME + ".html")
    with open(out, "w", encoding="utf-8") as f:
        f.write(doc)
    import sys
    import layout_export
    layout_path = layout_export.write(sys.modules[__name__], OUT_NAME)
    errs, warns = lint()
    if report:
        print("wrote", out, W, "x", HGT)
        print("wrote", layout_path)
        for m in errs:
            print("  ERROR", m)
        for m in warns:
            print("  warn ", m)
        print(f"  check: {len(errs)} errors, {len(warns)} warnings")
    return errs, warns


if __name__ == "__main__":
    build()

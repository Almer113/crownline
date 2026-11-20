"""The map panel (panels.map of the chart document): a grid of small maps, one per stage, with a legend.

What each map shows comes from the document: its view (a longitude and latitude box), title, caption and
note, which colour each polity gets, the areas drawn over it, the marks on it (places, dots, a ring, the
frame of a detail view). The shapes come ready merged from panels.map.shapes, which tools/map_shapes.py
makes from the boundary data (geoBoundaries, CC BY 3.0 IGO) and the assignment of every modern regency to
a polity at each stage (panels.map.assignments, with confidence notes and sources). This module only
projects and draws them, so the TypeScript engine can do the same.

A colour is "#RRGGBB", "house:<id>", "house:<id>+0.6" (that house's colour tinted), "palette:<key>", or a
name from panels.map.colours; "a/b" is diagonal stripes of a over b.
"""
import html
import json
import os

import chartfile
from model import HOUSE, INK, MUTED, NOTE_INK, _PAL, tint

SPEC = chartfile.DOC["panels"]["map"]
MAP_W = SPEC["width"]                           # every map is this wide
COLS = SPEC.get("columns", 3)
PAD, GAP = 16, 25
PANEL_W = COLS * MAP_W + (COLS - 1) * GAP + 2 * PAD
PANEL_H = SPEC["height"]                        # rendered height (checked against the render)
VIEWS = {k: tuple(v) for k, v in SPEC["views"].items()}
MAPS = SPEC["maps"]
with open(os.path.join(chartfile.ROOT, chartfile.asset(chartfile.DOC["media"][SPEC["shapes"]]["file"])), encoding="utf-8") as f:
    SHAPES = json.load(f)


def colour(ref):
    ref = SPEC.get("colours", {}).get(ref, ref)
    if ref.startswith("#"):
        return ref
    kind, _, rest = ref.partition(":")
    name, _, k = rest.partition("+")
    c = HOUSE[name] if kind == "house" else _PAL[name]
    return tint(c, float(k)) if k else c


def fill_spec(tok):
    """a fill as hex colours: "#RRGGBB" or "#RRGGBB/#RRGGBB" (stripes)"""
    return "/".join(colour(p) for p in tok.split("/"))


SEA, COAST = colour(SPEC["colours"].get("sea", "#F6F3EA")), colour(SPEC["colours"].get("coast", "#A9A08A"))


def proj(view, w):
    lon0, lon1, lat0, lat1 = view
    k = w / (lon1 - lon0)
    h = (lat1 - lat0) * k
    return (lambda lon, lat: ((lon - lon0) * k, (lat1 - lat) * k)), h


def path_d(geom, P):
    polys = [geom["coordinates"]] if geom["type"] == "Polygon" else geom["coordinates"]
    out = []
    for poly in polys:
        for ring in poly:
            pts = [P(lon, lat) for lon, lat in ring]
            out.append("M" + "L".join(f"{x:.1f},{y:.1f}" for x, y in pts) + "Z")
    return "".join(out)


def fill_of(spec, uid):
    if "/" in spec:
        a, b = spec.split("/")
        return f"url(#{uid}_{a[1:]}_{b[1:]})"
    return spec


def pattern(uid, spec):
    a, b = spec.split("/")
    return (f'<pattern id="{uid}_{a[1:]}_{b[1:]}" width="8" height="8" patternUnits="userSpaceOnUse" '
            f'patternTransform="rotate(45)"><rect width="8" height="8" fill="{b}"/>'
            f'<rect width="4" height="8" fill="{a}"/></pattern>')


def label(x, y, text, where):
    if where == "below":
        return f'<text x="{x + 5:.1f}" y="{y + 15:.1f}" class="mlab">{html.escape(text)}</text>'
    if where == "left":
        return f'<text x="{x - 6:.1f}" y="{y - 5:.1f}" class="mlab" text-anchor="end">{html.escape(text)}</text>'
    if where == "right-below":
        return f'<text x="{x + 6:.1f}" y="{y + 14:.1f}" class="mlab">{html.escape(text)}</text>'
    return f'<text x="{x + 6:.1f}" y="{y - 5:.1f}" class="mlab">{html.escape(text)}</text>'


def mark_svg(mk, P):
    x, y = P(*mk["at"]) if "at" in mk else (0, 0)
    if mk["kind"] == "place":
        return f'<circle cx="{x:.1f}" cy="{y:.1f}" r="3" fill="{INK}"/>' + label(x, y, mk["label"], mk.get("position", "above"))
    if mk["kind"] == "dot":
        return (f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{mk["r"]}" fill="{colour(mk["fill"])}" stroke="#FFFFFF" '
                f'stroke-width="{mk.get("stroke", 1)}"/>')
    if mk["kind"] == "ring":
        return (f'<circle cx="{x:.1f}" cy="{y:.1f}" r="11" fill="none" stroke="{INK}" stroke-width="1.4"/>'
                f'<text x="{x - 14:.1f}" y="{y + 26:.1f}" class="mlab">{html.escape(mk["label"])}</text>')
    v = VIEWS[mk["view"]]           # frame: the box of a detail view
    x0, y0 = P(v[0], v[3])
    x1, y1 = P(v[1], v[2])
    return (f'<rect x="{x0:.1f}" y="{y0:.1f}" width="{x1 - x0:.1f}" height="{y1 - y0:.1f}" fill="none" '
            f'stroke="{INK}" stroke-width="1.2" stroke-dasharray="4 3"/>')


def map_svg(m):
    P, h = proj(VIEWS[m["view"]], MAP_W)
    uid = f'm{m["id"]}'
    pats = sorted({fill_spec(t) for t in m["fills"].values() if "/" in t})
    # one shape per colour, cut to the land; fills go under the coastline, marks above it
    paths = []
    for tok, geom in SHAPES["maps"][m["id"]]:
        fill = fill_of(fill_spec(tok), uid)
        paths.append(f'<path d="{path_d(geom, P)}" fill="{fill}" stroke="{fill}" stroke-width="0.6"/>')
    fills = []
    for ov in m.get("overlays", []):       # parts of regencies, from districts or villages
        c = colour(ov["fill"])
        geom = SHAPES["areas"][ov["area"]]["whole" if ov.get("outline") else "onLand"]
        ring = ' stroke="#FFFFFF" stroke-width="1.6"' if ov.get("outline") else f' stroke="{c}" stroke-width="0.6"'
        fills.append(f'<path d="{path_d(geom, P)}" fill="{c}"{ring}/>')
    coast = f'<path d="{path_d(SHAPES["land"], P)}" fill="none" stroke="{COAST}" stroke-width="0.7"/>'
    extra = [mark_svg(mk, P) for mk in m.get("marks", [])]
    defs = "".join(pattern(uid, s) for s in pats)
    clip = f'<clipPath id="{uid}_frame"><rect width="{MAP_W}" height="{h:.1f}"/></clipPath>'
    return (f'<svg width="{MAP_W}" height="{h:.0f}" viewBox="0 0 {MAP_W} {h:.1f}" class="map">'
            f'<defs>{defs}{clip}</defs><rect width="{MAP_W}" height="{h:.1f}" fill="{SEA}"/>'
            f'<g clip-path="url(#{uid}_frame)">{"".join(paths)}{"".join(fills)}{coast}'
            f'{"".join(extra)}</g></svg>')


def legend_html():
    def sw(fill):
        if "/" in fill:
            a, b = fill.split("/")
            fill = f"repeating-linear-gradient(135deg, {a} 0 4px, {b} 4px 8px)"
        return f'<span class="msw" style="background:{fill}"></span>'

    def dot(c):
        return (f'<span class="msw" style="background:none;display:inline-flex;align-items:center;'
                f'justify-content:center"><svg width="12" height="12"><circle cx="6" cy="6" r="4.5" fill="{c}" '
                f'stroke="#fff" stroke-width="1.2"/></svg></span>')
    items = [(dot(colour(it["dot"])) if "dot" in it else sw(fill_spec(it["fill"])), it["label"]) for it in SPEC.get("legend", [])]
    return '<div class="mleg">' + "".join(f'<span class="mli">{s}{html.escape(t)}</span>' for s, t in items) + "</div>"


def panel_html(x, y):
    cells = []
    for m in MAPS:
        extra = f'<div class="mnote">{m["note"]}</div>' if m.get("note") else ""   # markup, like the other notes
        cells.append(f'<div class="mcell" data-stage="{m["id"]}"><div class="mt">{html.escape(m["title"])}</div>{map_svg(m)}'
                     f'<div class="mc">{html.escape(m["caption"])}</div>{extra}</div>')
    return (f'<div class="mpanel" style="left:{x}px;top:{y:.1f}px;width:{PANEL_W}px;height:{PANEL_H}px">'
            f'<div class="mh">{html.escape(SPEC["title"])}</div><div class="mgrid">{"".join(cells)}</div>'
            f'{legend_html()}</div>')


CSS = f"""
.mpanel {{ position: absolute; background: #EFEBDD; border: 1px solid #CFC8B3; padding: {PAD}px; }}
.mh {{ font-weight: 700; font-size: 15px; letter-spacing: 1.4px; text-transform: uppercase; margin-bottom: 10px; }}
.mgrid {{ display: grid; grid-template-columns: repeat({COLS}, {MAP_W}px); column-gap: {GAP}px; row-gap: 14px; }}
.mt {{ font-weight: 700; font-size: 16px; margin-bottom: 5px; }}
.mc {{ font-size: 15px; line-height: 1.3; color: {NOTE_INK}; margin-top: 5px; }}
.map {{ display: block; }}
.mlab {{ font: 700 13px 'AHG'; fill: {INK}; paint-order: stroke; stroke: #FFFFFF; stroke-width: 3px; }}
.mleg {{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px 14px; margin-top: 12px; font-size: 14px;
  line-height: 1.15; }}
.mli {{ display: inline-flex; align-items: center; gap: 6px; }}
.msw {{ display: inline-block; width: 20px; height: 13px; flex: none; }}
.mnote {{ font-size: 14px; line-height: 1.35; color: {MUTED}; margin-top: 8px; }}
"""

"""Reference data for the TypeScript engine port (PLAN Phase 5): the Python engine's results at every stage.

    python tools/golden.py [out_dir]          (default .scratch/golden; CHART_PUBLIC picks the build)

Writes <out_dir>/<chart id>-<private|public>.json with
  measure    every text width the engine asked for: [font file, text, size, width]
  boxes      each person's box straight from the document (before the layout): kind, lw, pw, h, x, year
  layout     after compose.py: x, cy per person, the fitted time axis, canvas size, bands
  lines      after drawing: segments, gaps, drops, horizontal runs, fallbacks, era and bracket labels, marks
  check      the errors and warnings
and <out_dir>/<chart id>-<private|public>.html and .layout.json: the page and the layout file.
Floats are written with repr, so they read back exactly.
"""
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
OUT = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, ".scratch", "golden"))
os.makedirs(OUT, exist_ok=True)
KIND = "public" if os.environ.get("CHART_PUBLIC") == "1" else "private"
sys.path.insert(0, ROOT)
import chartfile  # noqa: E402
STEM = f"{chartfile.CHART_ID}-{KIND}"             # one set per chart: wangsa-mataram-public.json, tokugawa-private.html
os.environ["CHART_OUT"] = os.path.join(OUT, STEM)

import textmeasure  # noqa: E402

MEASURED = {}
_width = textmeasure.Measure.width


def width(self, text, size):
    w = _width(self, text, size)
    MEASURED[(os.path.relpath(self.path, ROOT).replace("\\", "/"), text, size)] = w
    return w


textmeasure.Measure.width = width

import chartdoc  # noqa: E402
import model  # noqa: E402

# the document read into the engine's tables (chartdoc.py): lines, marriages, adjustments, display
tables = dict(
    desc=[dict(d, couple_of=list(d["couple_of"]) if d["couple_of"] else None) for d in chartdoc.DESC],
    desc_ids=chartdoc.DESC_IDS,
    marr=[list(m) for m in chartdoc.MARR],
    marr_ids=chartdoc.MARR_IDS,
    couple_line=[[a, b, c] for (a, b), c in chartdoc.COUPLE_LINE.items()],
    nudge=chartdoc.NUDGE, follow=chartdoc.FOLLOW, follow_dx=chartdoc.FOLLOW_DX, couple_side=chartdoc.COUPLE_SIDE,
    share_bus=sorted(chartdoc.SHARE_BUS), break_at=chartdoc.BREAK_AT, marker_top=sorted(chartdoc.MARKER_TOP),
    text_lift=chartdoc.TEXT_LIFT, header_left=sorted(chartdoc.HEADER_LEFT),
    crowns=chartdoc.CROWNS, pills=chartdoc.PILLS, events=chartdoc.EVENTS,
)
boxes = {k: dict(kind=n.kind, house=n.house, lw=n.lw, pw=n.pw, h=n.h, x=n.x, year=n.year, pic=n.pic)
         for k, n in model.NODES.items()}

import compose  # noqa: E402

layout = dict(
    root=compose.ROOT,
    nodes={k: dict(x=n.x, cy=n.cy, year=n.year) for k, n in model.NODES.items()},
    years=[[y, compose.YMAP[y]] for y in compose.YEARS],
    x_columns=compose.X_COLUMNS,
    years_fit=[[y, compose.YMAP_FIT[y]] for y in compose.YEARS],
    W=compose.W, HGT=compose.HGT, FOOT_Y=compose.FOOT_Y, NOTES_H=compose.NOTES_H, MAP_X=compose.MAP_X,
    TREE_BOTTOM=compose.TREE_BOTTOM, MAP_Y=compose.MAP_Y, HEADER_W=compose.HEADER_W, HEADER_H=compose.HEADER_H,
    NOTE_COLS=compose.NOTE_COLS,
    groups={k: [dict(src=list(g["src"]), kids=g["kids"], side=g["side"], centre=g.get("centre", False)) for g in v]
            for k, v in compose.GROUPS.items() if v},
    tree_parent=compose.TREE_PARENT,
    size=compose.SIZE,
    cap_kids=sorted(compose.CAP_KIDS),
    notes=[list(compose.note_rect(*nt)) for nt in chartdoc.NOTES],
)

import build  # noqa: E402

errs, warns = build.build(report=False)
lines = dict(
    segs=[dict(pts=s["pts"], col=s["col"], style=s["style"], hop=s["hop"], owner=s["owner"]) for s in build.SEGS],
    patches=build.PATCHES,
    drops=[[owner, kid, *v] for (owner, kid), v in build.DROPS.items()],   # (line, child): a child may have two
    hruns=build.HRUNS,
    fallbacks=build.FALLBACKS,
    shared=sorted(build.SHARED),
    source={k: list(v) for k, v in build.SOURCE.items()},
    era_labels=[[yr, *v] for yr, v in build.ERA_LABELS.items()],
    bracket_labels=build.BRACKET_LABELS,
    epi_left=sorted(build.EPI_LEFT), epi_x=build.EPI_X,
    epi_labels=[list(build.epi_label(a, b, lab)) for a, b, lab in build.EPISODES],
    marks=build.MARKS,
    hist=build.HIST,
)
out = dict(kind=KIND, tables=tables, measure=[[*k, v] for k, v in MEASURED.items()], boxes=boxes, layout=layout, lines=lines,
           check=dict(errors=errs, warnings=warns))
NAME = STEM + ".json"
with open(os.path.join(OUT, NAME), "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False)
print(f"wrote {os.path.join(OUT, NAME)}: {len(MEASURED)} widths, {len(boxes)} boxes, "
      f"{len(build.SEGS)} lines, {len(errs)} errors, {len(warns)} warnings")

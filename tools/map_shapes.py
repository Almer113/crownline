"""The map panel's shapes (panels.map.shapes), made once from the boundary data so the engines only draw.

    CHART_DOC=charts/wangsa-mataram/chart.json python tools/map_shapes.py           # write the shapes file
    CHART_DOC=charts/wangsa-mataram/chart.json python tools/map_shapes.py --check   # is it up to date?

Reads panels.map (which colour each polity gets on each map, the areas drawn over them) with the
boundaries it names (geoBoundaries regencies, districts and villages, in media) and the assignment of
every modern regency to a polity at each stage (panels.map.assignments). Writes, in longitude and
latitude, the outline of the land, each map's regencies merged by colour (in the order they first
appear), and each area drawn over a map. Needs shapely; run it again after changing a map's colours,
areas or the boundary data.

The merging: the regencies share their borders exactly (one coverage, see assets/maps/rebuild_adm2.py);
a colour's regencies are one shape, its inner seams closed, grown by SEAM into its neighbours (they overlap
instead of leaving a gap at anti-aliasing) and cut back to the coast; holes smaller than HOLE (reservoirs,
data gaps) are filled in.
"""
import json
import os
import sys

from shapely.geometry import MultiPolygon, Polygon, mapping, shape
from shapely.ops import unary_union

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
import chartfile  # noqa: E402

SEAM = 0.0004     # deg (~45 m): only covers anti-aliasing between neighbouring shapes
HOLE = 0.003      # deg²


def no_holes(g):
    polys = [Polygon(p.exterior, [r for r in p.interiors if Polygon(r).area >= HOLE])
             for p in getattr(g, "geoms", [g]) if p.geom_type == "Polygon"]
    return MultiPolygon(polys) if len(polys) > 1 else polys[0]


def shapes(doc):
    spec = doc["panels"]["map"]
    load = lambda mid: json.load(open(os.path.join(ROOT, chartfile.asset(doc["media"][mid]["file"])), encoding="utf-8"))  # noqa: E731
    leave = spec.get("leaveOut", {})
    features = [ft for ft in load(spec["boundaries"]["adm2"])["features"]
                if not any(ft["properties"].get(k) in v for k, v in leave.items())]
    districts = {ft["properties"]["name"]: ft for ft in load(spec["boundaries"]["adm3"])["features"]} if "adm3" in spec["boundaries"] else {}
    villages = load(spec["boundaries"]["adm4"])["features"] if "adm4" in spec["boundaries"] else []
    stages = {s["id"]: s for s in load(spec["assignments"])["stages"]}

    u = unary_union([shape(ft["geometry"]).buffer(0) for ft in features])
    land = no_holes(u.buffer(SEAM, join_style="mitre").buffer(-SEAM, join_style="mitre"))

    def on_land(geom):
        return mapping(shape(geom).buffer(SEAM, join_style="mitre").intersection(land))

    def fitted(geoms):
        u = unary_union([shape(g).buffer(0) for g in geoms])
        return on_land(mapping(no_holes(u.buffer(SEAM, join_style="mitre").buffer(-SEAM, join_style="mitre"))))

    merged = {}

    def area(name):
        """one shape for an area made of several districts or villages, filled and outlined as a whole"""
        if name not in merged:
            a = spec["areas"][name]
            geoms = ([districts[n]["geometry"] for n in a["adm3"]] if "adm3" in a
                     else [v["geometry"] for v in villages if v["properties"]["group"] == a["adm4"]])
            u = unary_union([shape(g).buffer(0) for g in geoms])
            u = u.buffer(0.0008, join_style="mitre").buffer(-0.0008, join_style="mitre")   # close seams
            merged[name] = mapping(unary_union([p for p in getattr(u, "geoms", [u]) if p.area > 2e-6]))
        return merged[name]

    out = {"land": mapping(land), "areas": {}, "maps": {}}
    for m in spec["maps"]:
        owner = {name: pol["id"] for pol in stages[m["id"]]["polities"] for name in pol.get("adm2", [])}
        groups = {}
        for ft in features:
            name = ft["properties"]["name"]
            pid = owner.get(name)
            tok = m["fills"].get(pid, m["default"]) if pid else m["default"]
            tok = m.get("regions", {}).get(name, tok)
            groups.setdefault(tok, []).append(ft["geometry"])
        out["maps"][m["id"]] = [[tok, fitted(geoms)] for tok, geoms in groups.items()]
        for ov in m.get("overlays", []):
            which = "whole" if ov.get("outline") else "onLand"
            out["areas"].setdefault(ov["area"], {})
            if which not in out["areas"][ov["area"]]:
                out["areas"][ov["area"]][which] = area(ov["area"]) if which == "whole" else on_land(area(ov["area"]))
    return json.loads(json.dumps(out))      # tuples to lists, as the file holds them


def close(a, b, tol=1e-9):
    """the same shapes, to within tol degrees (about 0.1 mm): GEOS builds can differ in the last bit"""
    if isinstance(a, dict):
        return isinstance(b, dict) and a.keys() == b.keys() and all(close(a[k], b[k], tol) for k in a)
    if isinstance(a, list):
        return isinstance(b, list) and len(a) == len(b) and all(close(x, y, tol) for x, y in zip(a, b))
    if isinstance(a, float) or isinstance(b, float):
        return isinstance(a, (int, float)) and isinstance(b, (int, float)) and abs(a - b) <= tol
    return a == b


def main():
    doc = chartfile.DOC
    if not doc.get("panels", {}).get("map"):
        raise SystemExit("this chart has no map panel")
    path = os.path.join(ROOT, chartfile.asset(doc["media"][doc["panels"]["map"]["shapes"]]["file"]))
    got = shapes(doc)
    if "--check" in sys.argv:
        with open(path, encoding="utf-8") as f:
            if not close(json.load(f), got):
                raise SystemExit(f"{os.path.relpath(path, ROOT)} is out of date: run tools/map_shapes.py")
        print(f"{os.path.relpath(path, ROOT)} is up to date")
        return
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        json.dump(got, f, separators=(",", ":"))
        f.write("\n")
    print(f"wrote {os.path.relpath(path, ROOT)}: {len(got['maps'])} maps, {len(got['areas'])} areas, {os.path.getsize(path)} bytes")


if __name__ == "__main__":
    main()

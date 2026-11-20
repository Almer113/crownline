"""Rebuild java_adm2.geojson from the full-resolution geoBoundaries IDN ADM2, simplified as one coverage
so that neighbouring regencies keep sharing exactly the same border (no slivers or gaps between them).

    python -I rebuild_adm2.py <geoBoundaries-IDN-ADM2.geojson> <java_adm2.geojson> [tolerance]

The regencies kept, and their names, provinces and kinds, are taken from the existing java_adm2.geojson
(matched by shapeID); only the geometry is replaced. Same source build (gbOpen IDN ADM2, Dec 2023).
"""
import json
import sys

import shapely
from shapely.geometry import mapping, shape

src, dst = sys.argv[1], sys.argv[2]
TOL = float(sys.argv[3]) if len(sys.argv) > 3 else 0.003   # deg
MIN_AREA = 0.00005   # deg² (~0.6 km²): drop tiny islets, as before

old = json.load(open(dst, encoding="utf-8"))
want = {f["properties"]["shapeID"]: f["properties"] for f in old["features"]}
raw = json.load(open(src, encoding="utf-8"))
feats = [f for f in raw["features"] if f["properties"]["shapeID"] in want]
missing = set(want) - {f["properties"]["shapeID"] for f in feats}
if missing:
    sys.exit(f"shapeIDs not found in the source: {sorted(missing)[:5]} ...")

geoms = [shapely.make_valid(shape(f["geometry"])) for f in feats]
geoms = [g if g.geom_type in ("Polygon", "MultiPolygon") else
         shapely.union_all([p for p in getattr(g, "geoms", []) if p.geom_type in ("Polygon", "MultiPolygon")])
         for g in geoms]
print("coverage valid before:", bool(shapely.coverage_is_valid(geoms)))
simp = shapely.coverage_simplify(geoms, TOL)

def clean(g):
    ps = [p for p in getattr(g, "geoms", [g]) if p.geom_type == "Polygon" and not p.is_empty]
    big = max(ps, key=lambda p: p.area)
    ps = [p for p in ps if p is big or p.area >= MIN_AREA]
    ps = [shapely.Polygon(p.exterior, [r for r in p.interiors if shapely.Polygon(r).area >= MIN_AREA]) for p in ps]
    g = shapely.MultiPolygon(ps) if len(ps) > 1 else ps[0]
    return shapely.set_precision(g, 0.0001)   # 4 dp (~11 m), shared vertices stay shared

out_feats, nv = [], 0
for f, g in zip(feats, simp):
    g = clean(g)
    nv += shapely.get_num_coordinates(g)
    out_feats.append({"type": "Feature", "properties": want[f["properties"]["shapeID"]], "geometry": mapping(g)})
order = {sid: i for i, sid in enumerate(want)}
out_feats.sort(key=lambda f: order[f["properties"]["shapeID"]])
print("coverage valid after:", bool(shapely.coverage_is_valid([shape(f["geometry"]) for f in out_feats])))
meta = dict(old.get("metadata", {}))
meta["source"] = "geoBoundaries gbOpen IDN ADM2 (full resolution), build Dec 2023; upstream BPS/WFP/OCHA ROAP via HDX"
meta["processing"] = (f"simplified as one coverage (shapely.coverage_simplify, tolerance {TOL} deg), so shared "
                      f"borders stay shared; coordinates to 4 dp; islets and holes < {MIN_AREA} deg² dropped")
json.dump({"type": "FeatureCollection", "metadata": meta, "features": out_feats},
          open(dst, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print(f"{len(out_feats)} regencies, {nv} vertices")

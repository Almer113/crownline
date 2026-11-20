"""Keep only the districts the detail maps need: Adikarto = Temon, Wates, Panjatan, Galur (name + bbox
centre test to disambiguate). Usage: python -I extract_adm3.py <IDN-ADM3_simplified.geojson> detail_adm3.geojson"""
import json, sys
src, dst = sys.argv[1], sys.argv[2]
WANT = {  # name: (lon range, lat range) the district's bbox centre must fall in
    "Temon": ((109.9, 110.2), (-8.0, -7.8)), "Wates": ((110.0, 110.2), (-8.0, -7.8)),
    "Panjatan": ((110.0, 110.25), (-8.0, -7.8)), "Galur": ((110.1, 110.3), (-8.0, -7.85)),
}
def bbox(g):
    xs, ys = [], []
    def walk(c):
        if isinstance(c[0], (int, float)): xs.append(c[0]); ys.append(c[1]); return
        for e in c: walk(e)
    walk(g["coordinates"]); return min(xs), min(ys), max(xs), max(ys)
def rnd(c):
    if isinstance(c[0], (int, float)): return [round(c[0], 4), round(c[1], 4)]
    return [rnd(e) for e in c]
out = []
for f in json.load(open(src, encoding="utf-8"))["features"]:
    n = f["properties"]["shapeName"]
    if n in WANT:
        x0, y0, x1, y1 = bbox(f["geometry"]); cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        (a, b), (c, d) = WANT[n]
        if a < cx < b and c < cy < d:
            out.append({"type": "Feature", "properties": {"name": n},
                        "geometry": {"type": f["geometry"]["type"], "coordinates": rnd(f["geometry"]["coordinates"])}})
found = sorted(f["properties"]["name"] for f in out)
assert found == sorted(WANT), found
json.dump({"type": "FeatureCollection", "source": "geoBoundaries IDN ADM3 (gbHumanitarian, OCHA ROAP / BPS 2019), CC BY 3.0 IGO",
           "features": out}, open(dst, "w", encoding="utf-8"))
print(len(out), "districts")

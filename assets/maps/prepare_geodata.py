"""Reduce geoBoundaries IDN ADM2/ADM1 + Natural Earth land to Java/Madura/Bali.
Usage: python -I build_geo.py <maps_dir>
"""
import json, sys, os, math

MAPS = sys.argv[1]
RAW = os.path.join(MAPS, 'raw')
KEEP_PROV = {'Banten', 'West Java', 'Jakarta Special Capital Region', 'Central Java',
             'Special Region of Yogyakarta', 'East Java', 'Bali'}
TOL = 0.005
NONADMIN = {'Hutan', 'Wadung Kedungombo', 'Waduk Cirata'}
MIN_AREA = 0.00005  # deg^2 (~0.6 km^2): drop tiny islets


def rdp(pts, eps):
    if len(pts) < 3:
        return pts
    keep = [False] * len(pts)
    keep[0] = keep[-1] = True
    stack = [(0, len(pts) - 1)]
    while stack:
        s, e = stack.pop()
        ax, ay = pts[s]; bx, by = pts[e]
        dx, dy = bx - ax, by - ay
        L = math.hypot(dx, dy)
        dmax, idx = -1, -1
        for i in range(s + 1, e):
            px, py = pts[i]
            if L == 0:
                d = math.hypot(px - ax, py - ay)
            else:
                d = abs(dy * px - dx * py + bx * ay - by * ax) / L
            if d > dmax:
                dmax, idx = d, i
        if dmax > eps:
            keep[idx] = True
            stack.append((s, idx)); stack.append((idx, e))
    return [p for p, k in zip(pts, keep) if k]


def area(r):
    a = 0
    for i in range(len(r) - 1):
        a += r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1]
    return a / 2


def simp_ring(r):
    # closed ring: split in two halves to keep RDP stable on closed rings
    if r[0] != r[-1]:
        r = r + [r[0]]
    n = len(r)
    if n < 8:
        out = r
    else:
        m = n // 2
        a = rdp(r[:m + 1], TOL); b = rdp(r[m:], TOL)
        out = a[:-1] + b
    out = [[round(x, 3), round(y, 3)] for x, y in out]
    ded = [out[0]]
    for p in out[1:]:
        if p != ded[-1]:
            ded.append(p)
    if len(ded) < 4:
        return None
    return ded


def polys(geom):
    if geom['type'] == 'Polygon':
        return [geom['coordinates']]
    return geom['coordinates']


def simp_geom(geom, min_area=MIN_AREA):
    out = []
    ps = polys(geom)
    biggest = max(ps, key=lambda p: abs(area(p[0])))
    for p in ps:
        if p is not biggest and abs(area(p[0])) < min_area:
            continue
        outer = simp_ring(p[0])
        if outer is None:
            if p is biggest:
                outer = [[round(x, 3), round(y, 3)] for x, y in p[0]]
            else:
                continue
        holes = []
        for h in p[1:]:
            if abs(area(h)) < min_area:
                continue
            sh = simp_ring(h)
            if sh:
                holes.append(sh)
        out.append([outer] + holes)
    if len(out) == 1:
        return {'type': 'Polygon', 'coordinates': out[0]}
    return {'type': 'MultiPolygon', 'coordinates': out}


def pip(x, y, ring):
    ins = False
    j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i]; xj, yj = ring[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            ins = not ins
        j = i
    return ins


def in_geom(x, y, geom):
    for p in polys(geom):
        if pip(x, y, p[0]) and not any(pip(x, y, h) for h in p[1:]):
            return True
    return False


def sample_points(geom):
    """A few interior-ish points: vertices of the largest ring nudged toward centroid."""
    p = max(polys(geom), key=lambda p: abs(area(p[0])))[0]
    cx = sum(v[0] for v in p) / len(p); cy = sum(v[1] for v in p) / len(p)
    pts = [(cx, cy)]
    step = max(1, len(p) // 40)
    for v in p[::step]:
        pts.append((v[0] + (cx - v[0]) * 0.02, v[1] + (cy - v[1]) * 0.02))
    return pts


adm1 = json.load(open(os.path.join(RAW, 'idn_adm1_simpl.geojson'), encoding='utf-8'))
adm2 = json.load(open(os.path.join(RAW, 'idn_adm2_simpl.geojson'), encoding='utf-8'))
provs = [(f['properties']['shapeName'], f['geometry']) for f in adm1['features']]

feats = []
names = []
for f in adm2['features']:
    g = f['geometry']
    # quick bbox prefilter: Java/Bali roughly lon 105-116, lat -9 to -5
    allpts = [v for p in polys(g) for v in p[0]]
    xs = [v[0] for v in allpts]; ys = [v[1] for v in allpts]
    if max(xs) < 104.5 or min(xs) > 117.5 or max(ys) < -9.5 or min(ys) > -4.0:
        continue
    votes = {}
    for x, y in sample_points(g):
        for pn, pg in provs:
            if in_geom(x, y, pg):
                votes[pn] = votes.get(pn, 0) + 1
                break
    if not votes:
        if f['properties']['shapeName'] == 'Kepulauan Seribu':
            votes = {'Jakarta Special Capital Region': 1}  # offshore islands, centroid misses ADM1 polygon
        else:
            print('NO PROVINCE:', f['properties']['shapeName']); continue
    prov = max(votes, key=votes.get)
    if prov not in KEEP_PROV:
        continue
    name = f['properties']['shapeName']
    sg = simp_geom(g)
    feats.append({'type': 'Feature', 'properties': {'name': name, 'province': prov,
                  'shapeID': f['properties']['shapeID'],
                  'kind': 'non-admin (forest/reservoir polygon in source)' if name in NONADMIN else 'regency' if not name.startswith('Kota ') else 'city'},
                  'geometry': sg})
    names.append((prov, name, len(votes) > 1 and votes))

out = {'type': 'FeatureCollection',
       'metadata': {'source': 'geoBoundaries gbOpen IDN ADM2 (simplified), build Dec 2023; upstream BPS/WFP/OCHA ROAP via HDX',
                    'licence': 'CC BY 3.0 IGO (ADM2). Province attribute derived by point-in-polygon against geoBoundaries IDN ADM1 (OSM/Wambacher, ODbL 1.0).',
                    'processing': 'Douglas-Peucker tol 0.005 deg, coords rounded to 3 dp, islets < 0.00005 deg2 dropped'},
       'features': feats}
p = os.path.join(MAPS, 'java_adm2.geojson')
json.dump(out, open(p, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print('features', len(feats), 'size', os.path.getsize(p))
names.sort()
with open(os.path.join(MAPS, 'java_adm2_names.txt'), 'w', encoding='utf-8') as fh:
    for prov, name, v in names:
        note = '\t(non-admin polygon in source: forest/reservoir)' if name in NONADMIN else ''
        fh.write(f'{prov}\t{name}{note}\n')
        if v:
            print('mixed vote', name, v)

# provinces (ADM1) for Java+Bali
pf = [{'type': 'Feature', 'properties': {'name': n}, 'geometry': simp_geom(g, 0.0002)} for n, g in provs if n in KEEP_PROV]
p = os.path.join(MAPS, 'java_adm1.geojson')
json.dump({'type': 'FeatureCollection', 'metadata': {'source': 'geoBoundaries gbOpen IDN ADM1 simplified (OSM, ODbL 1.0)'}, 'features': pf},
          open(p, 'w', encoding='utf-8'), separators=(',', ':'))
print('adm1 size', os.path.getsize(p))

# Natural Earth 10m land outline, Java+Madura+Bali (+ nearby islets)
ne = json.load(open(os.path.join(RAW, 'ne_10m_land.geojson'), encoding='utf-8'))
land = []
for f in ne['features']:
    for poly in polys(f['geometry']):
        r = poly[0]
        xs = [v[0] for v in r]; ys = [v[1] for v in r]
        if min(xs) >= 104.8 and max(xs) <= 116.0 and min(ys) >= -9.2 and max(ys) <= -5.0 and abs(area(r)) > 0.0005:
            sr = simp_ring(r)
            if sr:
                land.append([sr])
p = os.path.join(MAPS, 'java_outline.geojson')
json.dump({'type': 'FeatureCollection', 'metadata': {'source': 'Natural Earth 10m land (public domain), clipped to Java/Madura/Bali by polygon bbox'},
           'features': [{'type': 'Feature', 'properties': {'name': 'Java, Madura, Bali (land)'},
                         'geometry': {'type': 'MultiPolygon', 'coordinates': land}}]},
          open(p, 'w', encoding='utf-8'), separators=(',', ':'))
print('outline polys', len(land), 'size', os.path.getsize(p))

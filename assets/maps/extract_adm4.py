"""Keep only the villages (geoBoundaries IDN ADM4) that make up the partial areas on the detail maps.

    python -I extract_adm4.py <geoBoundaries-IDN-ADM4_simplified.geojson> detail_adm4.geojson

Groups (sources in stages.json):
  solo_mn      Mangkunegaran part of Kota Surakarta: kecamatan Banjarsari + Mojosongo (Jebres)
               + Karangasem, Jajar, Kerten (Laweyan)
  sk_enclaves  Kasunanan enclaves in Bantul: Kotagede SK (Segoroyoso, Bawuran, Wonolelo, Terong,
               Jatimulyo; Jagalan and Singosaren are drawn as a dot) and Imogiri SK (Imogiri, Girirejo,
               Karangtalun, Karangtengah, Kebonagung, Dlingo, Mangunan, Muntuk, Temuwuh)
  ngawen_mn    Mangkunegaran enclave in Gunungkidul: Beji, Jurangjero, Kampung, Sambirejo, Tancep, Watusigar
"""
import json
import sys

GROUPS = {
    "solo_mn": ((110.76, -7.60, 110.88, -7.51), [
        "Banyuanyar", "Gilingan", "Kadipiro", "Kestalan", "Keprabon", "Ketelan", "Manahan", "Mangkubumen",
        "Nusukan", "Punggawan", "Setabelan", "Sumber", "Timuran", "Mojosongo", "Karangasem", "Jajar", "Kerten"]),
    "sk_enclaves": ((110.36, -7.99, 110.52, -7.80), [
        "Segoroyoso", "Bawuran", "Wonolelo", "Terong", "Jatimulyo", "Imogiri", "Girirejo", "Karangtalun",
        "Karang Tengah", "Kebon Agung", "Dlingo", "Mangunan", "Muntuk", "Temuwuh"]),
    "ngawen_mn": ((110.62, -7.92, 110.78, -7.77), [
        "Beji", "Jurang Jero", "Kampung", "Sambirejo", "Tancep", "Watu Sigar"]),
}


def bbox(g):
    xs, ys = [], []

    def walk(c):
        if isinstance(c[0], (int, float)):
            xs.append(c[0]); ys.append(c[1]); return
        for e in c:
            walk(e)
    walk(g["coordinates"])
    return min(xs), min(ys), max(xs), max(ys)


def rnd(c):
    if isinstance(c[0], (int, float)):
        return [round(c[0], 4), round(c[1], 4)]
    return [rnd(e) for e in c]


def main(src, dst):
    out, found = [], {g: [] for g in GROUPS}
    for f in json.load(open(src, encoding="utf-8"))["features"]:
        n = f["properties"]["shapeName"]
        x0, y0, x1, y1 = bbox(f["geometry"])
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        for g, ((a, b, c, d), names) in GROUPS.items():
            if n in names and a < cx < c and b < cy < d:
                out.append({"type": "Feature", "properties": {"name": n, "group": g},
                            "geometry": {"type": f["geometry"]["type"], "coordinates": rnd(f["geometry"]["coordinates"])}})
                found[g].append(n)
    for g, (_, names) in GROUPS.items():
        assert sorted(found[g]) == sorted(names), (g, sorted(set(names) - set(found[g])), found[g])
    json.dump({"type": "FeatureCollection",
               "source": "geoBoundaries IDN ADM4 (gbHumanitarian, OCHA ROAP / BPS 2019), CC BY 3.0 IGO",
               "features": out}, open(dst, "w", encoding="utf-8"))
    print(len(out), "villages")


if __name__ == "__main__":
    main(*sys.argv[1:3])

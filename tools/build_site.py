"""Build the demo site (PLAN 9e): the app as static files, with the charts and the files they may publish.

    python tools/build_site.py [--out DIR]          (npm run build:site; default release/site)

The app is built with `vite build --mode site`: the library, the view and the editor, all in the browser. Beside
it, under repo/, go the charts (chart.json and layout.lock.json) and the assets the public repository holds
(tools/public-files.txt, through tools/public_repo.py): the open fonts, the map data and the public pictures, so
nothing marked private can be on the site. The portraits' sources stay out (they are large, and only cropping
needs them), except each set's crops.json. repo/files.json lists the files, as the local server's /api/files does.
credits.html lists every picture the site shows, chart by chart, from the charts' media records (author, licence,
source, changes), with the fonts and the map data; the library links to it.

The same checks as the public repository's then run over everything written: no proprietary font, no private
picture under any name, no local path, no personal detail. Any static host can serve the folder, at any path.
"""
import argparse
import html
import json
import os
import shutil
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import public_repo as P  # noqa: E402

ROOT = P.ROOT
OUT = os.path.join(ROOT, "release", "site")


def site_files(files):
    """the public files the site serves: the charts' documents and the assets, without the portraits' sources"""
    out = []
    for f in files:
        if f.startswith("charts/") and f.rsplit("/", 1)[-1] in ("chart.json", "layout.lock.json"):
            out.append(f)
        elif f.startswith("assets/portraits_src/"):
            if f.endswith("/crops.json"):
                out.append(f)
        elif f.startswith("assets/"):
            out.append(f)
    return sorted(out)


def title_of(value):
    return value if isinstance(value, str) else (value.get("en") or next(iter(value.values()), "")) if value else ""


def credits_page(repo):
    """the picture credits for everything on the site: CC BY and CC BY-SA ask for them"""
    e, shown = html.escape, set(repo)
    link = lambda url: f'<a href="{e(url)}">source</a>' if str(url).startswith("https://") else ""  # noqa: E731
    parts = []
    for path in sorted(p for p in repo if p.endswith("/chart.json")):
        doc = json.load(open(os.path.join(ROOT, path), encoding="utf-8"))
        rows = [m for m in doc.get("media", {}).values()
                if m.get("credit") and not m.get("private") and m.get("file") in shown and m.get("kind") != "source"]
        if not rows:
            continue
        trs = "".join(f"<tr><td>{e(title_of(m['credit'].get('title', '')))}</td><td>{e(m['credit'].get('author', ''))}</td>"
                      f"<td>{e(m['credit'].get('licence', ''))}</td><td>{link(m['credit'].get('source', ''))}</td>"
                      f"<td>{e(m['credit'].get('changes', ''))}</td></tr>"
                      for m in sorted(rows, key=lambda m: (m["kind"] != "portrait", title_of(m["credit"].get("title", "")))))
        parts.append(f"<h2>{e(title_of(doc['meta']['title']))} ({len(rows)})</h2>\n<div class=\"wrap\"><table><tr><th>Picture</th>"
                     f"<th>Author</th><th>Licence</th><th>Source</th><th>Changes</th></tr>{trs}</table></div>")
    names = {"NotoSansJavanese": "Noto Sans Javanese", "NotoSansJP": "Noto Sans JP"}
    families = sorted({names.get(f, f) for f in (os.path.basename(p).split("-")[0] for p in repo
                                                  if p.startswith("assets/fonts/open/") and p.endswith((".ttf", ".otf")))})
    maps = ("<h2>Map data</h2>\n<p>Administrative boundaries from <a href=\"https://www.geoboundaries.org/\">geoBoundaries</a> "
            "(Indonesia), CC BY 3.0 IGO, simplified and merged into historical regions.</p>"
            if any(p.startswith("assets/maps/") for p in repo) else "")
    return f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Picture credits · Crownline</title>
<style>
  body {{ margin: 0; padding: 24px 16px 48px; background: #EDE8D8; color: #1F1F1F; font: 15px/1.5 system-ui, sans-serif; }}
  main {{ max-width: 980px; margin: 0 auto; }}
  h1 {{ font-size: 24px; margin: 0 0 4px; }} h2 {{ font-size: 18px; margin: 32px 0 8px; }}
  .wrap {{ overflow-x: auto; }}
  table {{ border-collapse: collapse; width: 100%; font-size: 14px; }}
  th, td {{ text-align: left; vertical-align: top; padding: 6px 8px; border-bottom: 1px solid #D5CDB6; }}
  th {{ background: #E4DECB; }}
  a {{ color: #7A4B12; }}
</style></head><body><main>
<p><a href="./">← Back to the charts</a></p>
<h1>Picture credits</h1>
<p>Every picture these charts show, with its author, licence and source. Portraits are cropped to a square and
reduced in size. CC BY-SA pictures stay under their licence. Royal emblems are shown as illustrations; any rights in
the insignia themselves are not affected by the drawing's licence. Pictures that may not be published are left out of
this site: their cards show a silhouette.</p>
{chr(10).join(parts)}
{maps}
<h2>Fonts</h2>
<p>{e(", ".join(families))}, under the SIL Open Font License 1.1.</p>
</main></body></html>
"""


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--out", default=OUT, help="where to build it (default release/site)")
    out = os.path.abspath(ap.parse_args().out)
    if os.path.commonpath([out, ROOT]) == ROOT and not out.startswith(os.path.join(ROOT, "release")):
        raise SystemExit(f"{out}: build it under release/ or outside the repository")

    tracked = [f for f in P.git("ls-files", "-z").split("\0") if f and os.path.exists(os.path.join(ROOT, f))]
    files, _ = P.selection(tracked)
    repo = site_files(files)

    if os.path.exists(out):
        P.clear(out)
    vite = os.path.join(ROOT, "node_modules", "vite", "bin", "vite.js")
    r = subprocess.run(["node", vite, "build", "--mode", "site", "--outDir", out, "--emptyOutDir", "--logLevel", "warn"],
                       cwd=os.path.join(ROOT, "packages", "app"))
    if r.returncode:
        raise SystemExit("the app did not build")
    for rel in repo:
        dst = os.path.join(out, "repo", rel)
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copy2(os.path.join(ROOT, rel), dst)
    with open(os.path.join(out, "repo", "files.json"), "w", encoding="utf-8") as f:
        json.dump(repo, f, indent=0)
    with open(os.path.join(out, "credits.html"), "w", encoding="utf-8") as f:
        f.write(credits_page(repo))
    # the schemas at the address their $id names (schema/chart-<format>.json, on the site's GitHub Pages address)
    os.makedirs(os.path.join(out, "schema"), exist_ok=True)
    for kind in ("chart", "lock"):
        src = os.path.join(ROOT, "packages", "schema", f"{kind}.schema.json")
        name = json.load(open(src, encoding="utf-8"))["$id"].rsplit("/", 1)[-1]
        shutil.copy2(src, os.path.join(out, "schema", name))

    written = sorted(os.path.relpath(os.path.join(d, n), out).replace(os.sep, "/")
                     for d, _, ns in os.walk(out) for n in ns)
    # the checks read the files as written: a name under repo/ is checked as the repository's file it is
    _, private = P.media_files()
    bad = P.check([w[len("repo/"):] if w.startswith("repo/") else w for w in written],
                  lambda r: os.path.join(out, "repo", r) if os.path.exists(os.path.join(out, "repo", r)) else os.path.join(out, r),
                  private)
    for b in bad:
        print("  NOT PUBLISHABLE  " + b)
    if bad:
        print(f"{len(bad)} problems: this site may not be published")
        sys.exit(1)
    size = sum(os.path.getsize(os.path.join(out, w)) for w in written)
    print(f"wrote {out}: {len(written)} files, {size / 1e6:.1f} MB ({len(repo)} of them the charts and their assets)")
    print("checks: no proprietary font, no private picture, no local path, no personal detail")


if __name__ == "__main__":
    main()

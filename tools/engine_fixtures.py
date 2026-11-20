"""Reference data for the TypeScript engine's tests (PLAN Phase 5), from the Python engine.

    python tools/engine_fixtures.py           # write them
    python tools/engine_fixtures.py --check   # are the committed ones up to date? (CI runs this)

For each chart (charts/*/chart.json), runs tools/golden.py on the public build (open fonts only, so the
files can be published) and keeps what the port's tests compare against, in packages/engine/tests/fixtures/:
  <chart>-measure.json   every text width the engine measured: [font file, text, size, width]
  <chart>-boxes.json     each person's box before the layout (step 2): kind, house, lw, pw, h, x, year, pic
  <chart>-tree.json      the document's tables (lines, marriages, adjustments) and the tree (step 3): root,
                         groups, each child's parent in the tree, branch sizes, children with a label
  <chart>-rows.json      each person's row (step 4): cy (the columns and the axis fit leave it as it is)
  <chart>-columns.json   each person's x after the columns (step 5), before the canvas moves the tree
  <chart>-canvas.json    the canvas (step 6): its size, the footer, notes band, map and header card, each final x
  <chart>-lines.json     the drawing (steps 7-9): line segments, drops, runs, gaps at crossings, labels, marks,
                         and the check's errors and warnings
  <chart>-page.html.gz   the page (step 11), map panel and all
  <chart>-layout.json.gz the layout file for the viewer (layout_export.py)
  small/<name>.html, .layout.json, -check.json
                         the small per-feature charts (packages/engine/tests/charts/<name>): page, layout file, check
  wangsa-mataram-top.json  Mataram with a 760 px top card (CHART_HEADER=top,760): canvas, axis, x and cy
  <chart>-axis.json      the time axis [year, y]: as fitted to the rows (fit), and after the canvas (final)
Run it again after a change to the Python engine or a chart, and commit the result with that change.
"""
import filecmp
import glob
import gzip
import json
import os
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FIXTURES = os.path.join(ROOT, "packages", "engine", "tests", "fixtures")
OUT = FIXTURES          # where main() writes: a temporary folder for --check
CANVAS = ("W", "HGT", "FOOT_Y", "NOTES_H", "MAP_X", "MAP_Y", "TREE_BOTTOM", "HEADER_W", "HEADER_H", "NOTE_COLS")


def rel(path):
    """a path for the messages: relative to the repository when it can be"""
    try:
        return os.path.relpath(path, ROOT)
    except ValueError:      # another drive (Windows)
        return path


def main():
    os.makedirs(os.path.join(OUT, "small"), exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        for doc in sorted(glob.glob(os.path.join(ROOT, "charts", "*", "chart.json"))):
            chart = os.path.basename(os.path.dirname(doc))
            g = golden(doc, tmp)
            measure = sorted(g["measure"], key=lambda m: (m[0], m[1], m[2]))
            path = os.path.join(OUT, f"{chart}-measure.json")
            with open(path, "w", encoding="utf-8", newline="\n") as f:
                f.write("[\n" + ",\n".join(json.dumps(m, ensure_ascii=False) for m in measure) + "\n]\n")
            print(f"{rel(path)}: {len(measure)} widths")
            write(f"{chart}-boxes.json", g["boxes"])
            lay = g["layout"]
            write(f"{chart}-tree.json", dict(**g["tables"], root=lay["root"], groups=lay["groups"],
                                             tree_parent=lay["tree_parent"], size=lay["size"], cap_kids=lay["cap_kids"]))
            write(f"{chart}-rows.json", {k: n["cy"] for k, n in lay["nodes"].items()})
            write(f"{chart}-columns.json", lay["x_columns"])
            write(f"{chart}-canvas.json", dict({k: lay[k] for k in CANVAS}, x={k: n["x"] for k, n in lay["nodes"].items()}))
            write(f"{chart}-lines.json", dict(g["lines"], warnings=g["check"]["warnings"], errors=g["check"]["errors"]))
            page_fixture(f"{chart}-page.html.gz", g, os.path.join(tmp, f"{chart}-public.html"))
            write(f"{chart}-axis.json", dict(fit=lay["years_fit"], final=lay["years"]))


        # the small per-feature charts (packages/engine/tests/charts): the page, layout file and check report
        for doc in sorted(glob.glob(os.path.join(ROOT, "packages", "engine", "tests", "charts", "*", "chart.json"))):
            name = os.path.basename(os.path.dirname(doc))
            g = golden(doc, tmp)
            write(f"small/{name}-check.json", g["check"])
            stem = os.path.join(tmp, f"test-{name}-public")
            for ext in (".html", ".layout.json"):
                with open(stem + ext, "rb") as f:
                    data = f.read().replace(b"\r\n", b"\n")   # text mode: CRLF on Windows
                with open(os.path.join(OUT, "small", name + ext), "wb") as f:
                    f.write(data)

        # neither chart has a top card: Mataram with one, end to end (rows, columns, canvas)
        g = golden(os.path.join(ROOT, "charts", "wangsa-mataram", "chart.json"), tmp, header="top,760")
        lay = g["layout"]
        write("wangsa-mataram-top.json", dict({k: lay[k] for k in CANVAS}, years=lay["years"],
                                              nodes={k: [n["x"], n["cy"]] for k, n in lay["nodes"].items()},
                                              errors=g["check"]["errors"], warnings=g["check"]["warnings"]))
        page_fixture("wangsa-mataram-top-page.html.gz", g, os.path.join(tmp, "wangsa-mataram-public.html"))


def page_fixture(name, g, path):
    """the page, map panel and all, and the layout file the viewer reads (layout_export.py)"""
    with open(path, "rb") as f:
        page = f.read().replace(b"\r\n", b"\n")   # the build writes in text mode: CRLF on Windows
    gz(name, page)
    with open(path[:-len(".html")] + ".layout.json", "rb") as f:
        gz(name.replace("-page.html.gz", "-layout.json.gz"), f.read())


def golden(doc, tmp, header=None):
    """tools/golden.py's results for a chart's public build (header: a CHART_HEADER override)"""
    env = dict(os.environ, CHART_DOC=doc, CHART_PUBLIC="1", PYTHONIOENCODING="utf-8")
    for k in ("CHART_SANS", "CHART_SCRIPT", "CHART_JAVANESE", "CHART_FONTS_EXTRA", "CHART_HEADER"):
        env.pop(k, None)
    if header:
        env["CHART_HEADER"] = header
    subprocess.run([sys.executable, os.path.join(ROOT, "tools", "golden.py"), tmp], env=env, check=True,
                   cwd=ROOT, stdout=subprocess.DEVNULL)
    with open(doc, encoding="utf-8") as f:
        chart_id = json.load(f)["meta"]["id"]
    with open(os.path.join(tmp, f"{chart_id}-public.json"), encoding="utf-8") as f:
        return json.load(f)


def gz(name, data):
    """a large file, gzipped; mtime 0 so the same content gives the same bytes"""
    path = os.path.join(OUT, name)
    with open(path, "wb") as f:
        f.write(gzip.compress(data, mtime=0))
    print(f"{rel(path)}: {len(data)} bytes")


def write(name, rows):
    """one record per line, so a diff shows what changed"""
    path = os.path.join(OUT, name)
    body = ",\n".join(f"{json.dumps(k)}: {json.dumps(v, ensure_ascii=False)}" for k, v in rows.items())
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write("{\n" + body + "\n}\n")
    print(f"{rel(path)}: {len(rows)} records")


def check():
    """write the fixtures to a temporary folder and compare them with the committed ones (gzip by content)"""
    global OUT
    with tempfile.TemporaryDirectory() as out:
        OUT = out
        main()
        bad = []
        for dirpath, _, files in os.walk(out):
            for f in files:
                new = os.path.join(dirpath, f)
                old = os.path.join(FIXTURES, os.path.relpath(new, out))
                if not os.path.exists(old):
                    bad.append(f"missing: {os.path.relpath(old, ROOT)}")
                elif f.endswith(".gz"):
                    with gzip.open(new) as a, gzip.open(old) as b:
                        if a.read() != b.read():
                            bad.append(os.path.relpath(old, ROOT))
                elif not filecmp.cmp(new, old, shallow=False):
                    bad.append(os.path.relpath(old, ROOT))
    if bad:
        raise SystemExit("out of date (run python tools/engine_fixtures.py and commit them):\n  " + "\n  ".join(bad))
    print("the engine fixtures are up to date")


if __name__ == "__main__":
    check() if "--check" in sys.argv else main()

"""Checks run by `python -m pytest` and in CI.

Each build runs in its own process, because model.py reads CHART_PUBLIC and the font choice
once, when it is imported.

The private build needs the non-free files (fonts, and the portraits marked private in the chart document),
which the public repository does not have; its checks are skipped when they are missing.
"""
import atexit
import glob
import html
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile

import pytest
from fontTools.ttLib import TTFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
import chartfile  # noqa: E402

PRIVATE = chartfile.private_assets()      # from the chart document's media records


def private_files_present():
    pics = all(glob.glob(os.path.join(ROOT, "assets", "portraits", k + ".*")) for k in PRIVATE["portraits"])
    other = all(os.path.exists(os.path.join(ROOT, p)) for g in ("emblems", "brand") for p in PRIVATE[g])
    return pics and other


OUT = tempfile.mkdtemp(prefix="crownline-tests-")    # the builds' files: never the repository's own builds
atexit.register(shutil.rmtree, OUT, True)


def out_name(public):
    return os.path.join(OUT, "wangsa-mataram" + ("-public" if public else ""))


def run(args, public):
    env = dict(os.environ, CHART_PUBLIC="1" if public else "0", CHART_OUT=out_name(public))
    for k in ("CHART_SANS", "CHART_SCRIPT", "CHART_JAVANESE", "CHART_FONTS_EXTRA"):
        env.pop(k, None)               # always test the default (open) fonts
    return subprocess.run([sys.executable, *args], cwd=ROOT, env=env, capture_output=True, text=True,
                          encoding="utf-8")


def built_html(public):
    r = run(["-c", "import build; build.build(report=False)"], public)
    assert r.returncode == 0, r.stderr
    with open(out_name(public) + ".html", encoding="utf-8") as f:
        return f.read()


@pytest.mark.parametrize("public", [True, False], ids=["public", "private"])
def test_layout_matches_snapshot(public):
    """Everything sits where charts/wangsa-mataram/layout.lock.json says, with 0 errors. Both builds share
    one lock: the public build swaps assets but must not move anything."""
    if not public and not private_files_present():
        pytest.skip("private files not present")
    r = run(["tests/layout_snapshot.py"], public)
    assert r.returncode == 0, r.stdout + r.stderr


OTHER_CHARTS = sorted(d for d in os.listdir(os.path.join(ROOT, "charts"))
                      if d != "wangsa-mataram" and os.path.exists(os.path.join(ROOT, "charts", d, "chart.json")))


@pytest.mark.parametrize("chart", OTHER_CHARTS)
def test_other_charts_build_and_match_their_lock(chart, tmp_path):
    """Every other chart (Phase 6: the system is general) passes the document check, builds with 0 errors with
    the same engine and no chart-specific code, and sits where its own layout.lock.json says."""
    doc = os.path.join(ROOT, "charts", chart, "chart.json")
    if os.path.isdir(os.path.join(ROOT, "node_modules")):      # CI checks documents in its Node job (npm run check)
        npm = "npm.cmd" if os.name == "nt" else "npm"
        r = subprocess.run([npm, "run", "--silent", "check", "--", doc], cwd=ROOT, capture_output=True, text=True,
                           encoding="utf-8")
        assert r.returncode == 0, r.stdout + r.stderr
    env = dict(os.environ, CHART_PUBLIC="1", CHART_DOC=doc, CHART_OUT=str(tmp_path / "out"))
    for k in ("CHART_SANS", "CHART_SCRIPT", "CHART_JAVANESE", "CHART_FONTS_EXTRA"):
        env.pop(k, None)
    r = subprocess.run([sys.executable, "tests/layout_snapshot.py"], cwd=ROOT, env=env, capture_output=True,
                       text=True, encoding="utf-8")
    assert r.returncode == 0, r.stdout + r.stderr


def test_layout_diff_reports_a_move(tmp_path):
    """The diff tool names what moved: a copy of the document with one person nudged 40 px reports that
    person (and only the things that hang off them), and the original lock is untouched."""
    src = os.path.join(ROOT, "charts", "wangsa-mataram")
    with open(os.path.join(src, "chart.json"), encoding="utf-8") as f:
        doc = json.load(f)
    doc["adjustments"]["test_move"] = {"kind": "nudge", "target": "abubakar", "dx": 40, "reason": "test"}
    doc["meta"]["assetRoot"] = ROOT                 # the copy lives elsewhere: its media are still the repository's
    with open(tmp_path / "chart.json", "w", encoding="utf-8") as f:
        json.dump(doc, f)
    shutil.copy(os.path.join(src, "layout.lock.json"), tmp_path / "layout.lock.json")
    env = dict(os.environ, CHART_PUBLIC="1", CHART_DOC=str(tmp_path / "chart.json"), CHART_OUT=str(tmp_path / "out"))
    r = subprocess.run([sys.executable, "tests/layout_snapshot.py"], cwd=ROOT, env=env, capture_output=True,
                       text=True, encoding="utf-8")
    assert r.returncode == 1, r.stdout + r.stderr
    assert "abubakar: dx +40.0 dy +0.0" in r.stdout, r.stdout


def test_public_build_hides_a_private_picture_by_its_file(tmp_path):
    """A public build leaves out a private picture whoever it is attached to: here a second person points at
    agung's portrait, made private. (The check refuses such a document; the build must be safe anyway.)"""
    with open(os.path.join(ROOT, "charts", "wangsa-mataram", "chart.json"), encoding="utf-8") as f:
        doc = json.load(f)
    mid = doc["people"]["agung"]["portrait"]
    doc["media"][mid]["private"] = "test"
    doc["people"]["hanyakrawati"]["portrait"] = mid
    doc["meta"]["assetRoot"] = ROOT                 # the copy lives elsewhere: its media are still the repository's
    with open(tmp_path / "chart.json", "w", encoding="utf-8") as f:
        json.dump(doc, f)
    env = dict(os.environ, CHART_PUBLIC="1", CHART_DOC=str(tmp_path / "chart.json"), CHART_OUT=str(tmp_path / "out"))
    r = subprocess.run([sys.executable, "-c", "import build; build.build(report=False)"], cwd=ROOT, env=env,
                       capture_output=True, text=True, encoding="utf-8")
    assert r.returncode == 0, r.stderr
    page = (tmp_path / "out.html").read_text(encoding="utf-8")
    assert doc["media"][mid]["file"] not in page


def test_public_build_uses_no_private_asset():
    page = built_html(public=True)
    for g in ("emblems", "brand"):
        for p in PRIVATE[g]:
            assert p not in page, p
    for k in PRIVATE["portraits"]:
        assert not re.search(rf"assets/portraits/{re.escape(k)}\.\w+", page), k
    for f in re.findall(r"url\('([^']+\.(?:ttf|otf|woff2?))'\)", page):
        assert f.startswith("assets/fonts/open/"), f


def test_open_fonts_cover_every_character():
    """No character falls back to a system font, which would make the output machine-dependent
    and could embed a non-free font in the PDF."""
    page = built_html(public=True)
    page = re.sub(r"<style.*?</style>|<script.*?</script>|data:[^\"')]+", "", page, flags=re.S)
    text = html.unescape(re.sub(r"<[^>]+>", " ", page))
    fonts = ("Gantari-Regular.ttf", "Gantari-Bold.ttf", "NotoSansJavanese-Regular.ttf")
    covered = set()
    for f in fonts:
        covered |= set(TTFont(os.path.join(ROOT, "assets", "fonts", "open", f)).getBestCmap())
    missing = sorted({c for c in text if ord(c) > 32 and ord(c) not in covered})
    assert not missing, missing
    # house names are set in the script font, which must cover them on its own
    sys.path.insert(0, ROOT)
    from data import HEADERS
    script = set(TTFont(os.path.join(ROOT, "assets", "fonts", "open", "Felipa-Regular.ttf")).getBestCmap())
    names = "".join(h[2] for h in HEADERS.values())
    missing = sorted({c for c in names if ord(c) > 32 and ord(c) not in script})
    assert not missing, missing


def test_public_build_refuses_a_non_free_font():
    env = dict(os.environ, CHART_PUBLIC="1", CHART_SANS="altehaas")
    r = subprocess.run([sys.executable, "-c", "import model"], cwd=ROOT, env=env, capture_output=True, text=True)
    assert r.returncode != 0 and "open fonts" in r.stderr, r.stderr


def test_every_open_font_has_its_licence():
    d = os.path.join(ROOT, "assets", "fonts", "open")
    for f in glob.glob(os.path.join(d, "*.ttf")):
        family = re.sub(r"-.*", "", os.path.basename(f)).lower()
        assert os.path.exists(os.path.join(d, f"OFL-{family}.txt")), f


def test_layout_export_is_consistent():
    """The layout file (Phase 2 contract) names every person once, every line joins known people,
    and the public one carries no private portrait."""
    page = built_html(public=True)
    with open(out_name(True) + ".layout.json", encoding="utf-8") as f:
        lay = json.load(f)
    people = lay["people"]
    assert set(re.findall(r'data-id="([^"]+)"', page)) == set(people)
    W, H = lay["canvas"]
    for pid, p in people.items():
        l, t, r, b = p["rect"]
        assert 0 <= l < r <= W and 0 <= t < b <= H, pid
        assert not (p["portrait"] and pid in PRIVATE["portraits"]), pid
    for ln in lay["lines"]:
        assert set(ln["from"] + ln["to"]) <= set(people), ln["owner"]
        assert len(ln["points"]) >= 2
    for nt in lay["notes"]:
        assert nt["anchor"] in people and nt["text"]


def test_layout_export_explores():
    """What the Phase 3 viewer reads: date spans, map stages tagged in the page, checked tours, plain text."""
    page = built_html(public=True)
    with open(out_name(True) + ".layout.json", encoding="utf-8") as f:
        lay = json.load(f)
    people = lay["people"]
    for pid, p in people.items():
        a, b = p["span"]
        assert 1500 < a < b <= 2100, pid
        assert "<" not in p["sub"] and "  " not in p["sub"], pid       # markup gone, line breaks became spaces
    assert people["agung"]["span"] == [1613, 1645] and not people["agung"]["spanGuess"]
    assert people["alit_am1"]["span"] == [1646, 1648]                   # "killed 1647/48"
    assert people["hb10"]["span"][1] == int(re.findall(r"\d{4}", lay["asOf"])[-1])   # "– present"
    # a captioned descent ("court poet", "son-in-law") is a link on the chart, not parent and child
    assert all(r["id"] != "pb3" for r in people["yasadipura1"]["family"]["parents"])
    assert all(r["id"] != "anglingkusumo" for r in people["wiroyudho"]["family"]["parents"])
    stages = [s["id"] for s in lay["stages"]]
    assert stages and all(f'data-stage="{s}"' in page for s in stages)
    assert lay["tours"] and all(t["steps"] for t in lay["tours"])


def test_tours_are_checked(tmp_path):
    """A tour naming someone who is not on the chart stops the export."""
    import layout_export
    good = [{"id": "t", "title": "T", "steps": [{"caption": "x", "focus": ["agung"], "stage": "S1"}]}]
    wrong = [{"id": "t", "title": "T", "steps": [{"caption": "x", "focus": ["nobody"], "stage": "S9"}]}]
    assert layout_export.tours({"agung": {}}, {"S1": 1625}, good)
    with pytest.raises(ValueError, match="nobody.*S9|S9.*nobody|nobody"):
        layout_export.tours({"agung": {}}, {"S1": 1625}, wrong)


def test_span_reads_the_card_dates():
    import layout_export
    span = layout_export.span
    assert span(1613, "r. 1613 – 1645", 2026) == [1613, 1645, False]
    assert span(1556, "d. c. 1584", 2026) == [1556, 1584, False]
    assert span(1989, "r. 1989 – present", 2026) == [1989, 2026, False]
    assert span(1983, "b. 1983", 2026) == [1983, 2026, False]
    assert span(1726, "daughter of Pangeran Purbaya", 2026) == [1726, 1756, True]
    # short end years, several reigns
    assert span(1792, "r. 1792–1810, 1811–12, 1826–28", 2026) == [1792, 1828, False]
    assert span(1810, "regent 1810–11 · r. 1812–14", 2026) == [1810, 1814, False]
    assert span(1646, "killed 1647/48", 2026) == [1646, 1648, False]
    # marriages, divorces and new names are events, not the end of a life
    assert span(2015, "b. 1972 · presumed heir · renamed 2015", 2026) == [1972, 2026, False]
    assert span(1987, "m. 1974, div. 1984", 2026) == [1974, 2004, True]
    assert span(1757, "daughter of Hamengkubuwana I · m. c. 1746, div. 1763", 2026) == [1746, 1776, True]
    assert span(2010, "m. KPH F.X. Adimas Rosdian, 6 Nov 2026", 2026) == [2010, 2026, True]
    # a birth long ago with no death is not taken to run to today
    assert span(1925, "b. 1902", 2026) == [1902, 2002, True]
    # a guess never runs past the present
    assert span(2019, "eldest son · presumed heir", 2026) == [2019, 2026, True]



def test_a_child_with_two_lines_keeps_both(tmp_path):
    """A child reached by two drawn lines (birth, and a hop line from an adoptive father) gets a drop, a break
    mark and a lock entry for each; nothing keyed by the child alone is overwritten by the second line."""
    with open(os.path.join(ROOT, "charts", "tokugawa", "chart.json"), encoding="utf-8") as f:
        doc = json.load(f)
    adopt = doc["descents"]["d_ietsuna_tsunayoshi"]
    del adopt["show"]["drawn"]
    adopt["show"]["break"] = "adopted"
    doc["adjustments"]["test_break"] = {"kind": "breakAt", "target": "d_ietsuna_tsunayoshi", "at": 0.25,
                                        "reason": "test"}
    doc["meta"]["assetRoot"] = ROOT
    with open(tmp_path / "chart.json", "w", encoding="utf-8") as f:
        json.dump(doc, f)
    env = dict(os.environ, CHART_PUBLIC="1", CHART_DOC=str(tmp_path / "chart.json"), CHART_OUT=str(tmp_path / "out"))
    r = subprocess.run([sys.executable, "tests/layout_snapshot.py", "--update"], cwd=ROOT, env=env,
                       capture_output=True, text=True, encoding="utf-8")
    assert r.returncode == 0, r.stdout + r.stderr
    with open(tmp_path / "layout.lock.json", encoding="utf-8") as f:
        drops = json.load(f)["drops"]
    two = sorted(k for k in drops if k.startswith("tsunayoshi@"))
    assert two == ["tsunayoshi@d_iemitsu_tsunayoshi", "tsunayoshi@d_ietsuna_tsunayoshi"], sorted(drops)
    assert drops[two[0]] != drops[two[1]]
    page = (tmp_path / "out.html").read_text(encoding="utf-8")
    assert "ADOPTED" in page


def test_succession_and_top_card_on_unusual_documents(tmp_path):
    """Documents the schema allows that once crashed or read wrongly: a top card with no glossary, a reign
    with no dates, a caption given per language, a restored reign, a woman ruling."""
    with open(os.path.join(ROOT, "charts", "tokugawa", "chart.json"), encoding="utf-8") as f:
        doc = json.load(f)
    doc["glossary"] = {}
    for p in doc["people"].values():
        p.pop("title", None)
    doc["panels"]["header"]["arrange"] = "top"
    doc["panels"]["header"]["height"] = 610
    del doc["people"]["ietsuna"]["reigns"][0]["when"]
    doc["descents"]["d_yoshinobu_iesato"]["show"]["caption"] = {"en": "heir"}
    doc["people"]["ietsugu"]["sex"] = "f"                            # as a test only
    doc["people"]["ieyasu"]["reigns"].append({"court": "tokugawa", "n": 20, "sources": [{"source": "k_ieyasu"}]})
    doc["meta"]["assetRoot"] = ROOT
    with open(tmp_path / "chart.json", "w", encoding="utf-8") as f:
        json.dump(doc, f)
    env = dict(os.environ, CHART_PUBLIC="1", CHART_DOC=str(tmp_path / "chart.json"), CHART_OUT=str(tmp_path / "out"))
    env["PYTHONIOENCODING"] = "utf-8"
    r = subprocess.run([sys.executable, "-c", "import build, chartdoc; build.build(report=False)\n"
                        "for row in chartdoc.SUCCESSION[1]: print(row)"], cwd=ROOT, env=env,
                       capture_output=True, text=True, encoding="utf-8")
    assert r.returncode == 0, r.stderr
    rows = {int(x.split(",")[0].strip("(")): x for x in r.stdout.splitlines() if x.startswith("(")}
    assert "'', 'son of Iemitsu'" in rows[4]                          # no dates: an empty cell
    assert "'heir of Yoshinobu" in rows[16]                           # the caption's text, not a dict
    assert "'daughter of Ienobu'" in rows[7]
    assert "'restored'" in rows[20]


def test_map_shapes_are_up_to_date():
    """the map panel's shapes file matches the document's maps and the boundary data (tools/map_shapes.py)"""
    pytest.importorskip("shapely")
    env = dict(os.environ, CHART_DOC=os.path.join(ROOT, "charts", "wangsa-mataram", "chart.json"), PYTHONIOENCODING="utf-8")
    r = subprocess.run([sys.executable, os.path.join(ROOT, "tools", "map_shapes.py"), "--check"], cwd=ROOT, env=env,
                       capture_output=True, text=True, encoding="utf-8")
    assert r.returncode == 0, r.stdout + r.stderr


def test_whole_floats_and_an_event_on_the_root(tmp_path):
    """Found by the stress test: a whole number written as a float (15.0) builds the same page as 15, as in the
    TypeScript engine; an event on the root (no line comes down into them) is left out with a warning."""
    with open(os.path.join(ROOT, "packages", "engine", "tests", "charts", "family", "chart.json"), encoding="utf-8") as f:
        doc = json.load(f)
    doc["meta"]["assetRoot"] = ROOT
    doc["display"] = dict(doc.get("display", {}), events={"king": "founded the house"})
    pages = []
    for name, sizes in (("int", doc["theme"]["type"]), ("float", {k: float(v) for k, v in doc["theme"]["type"].items()})):
        doc["theme"]["type"] = sizes                    # json.dump writes the floats as 15.0
        with open(tmp_path / f"{name}.json", "w", encoding="utf-8") as f:
            json.dump(doc, f)
        env = dict(os.environ, CHART_PUBLIC="1", CHART_DOC=str(tmp_path / f"{name}.json"), CHART_OUT=str(tmp_path / name))
        r = subprocess.run([sys.executable, "-c", "import build; print(build.build(report=False))"], cwd=ROOT, env=env,
                           capture_output=True, text=True, encoding="utf-8")
        assert r.returncode == 0, r.stderr
        assert 'no line comes down into king, so its event "founded the house" is left out' in r.stdout, r.stdout
        pages.append((tmp_path / f"{name}.html").read_text(encoding="utf-8"))
    assert pages[0] == pages[1]

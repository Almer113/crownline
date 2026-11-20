"""The chart document on disk (PLAN Phase 4): charts/<chart>/chart.json, read once.

CHART_DOC names another document (a path, absolute or relative to the repository). Everything the engine
knows about a chart comes from here; the engine itself holds no chart content.
"""
import json
import os

ROOT = os.path.dirname(os.path.abspath(__file__))
PATH = os.environ.get("CHART_DOC") or os.path.join(ROOT, "charts", "wangsa-mataram", "chart.json")
if not os.path.isabs(PATH):
    PATH = os.path.join(ROOT, PATH)

with open(PATH, encoding="utf-8") as _f:
    # a whole number written 14.0 reads as 14, as JavaScript reads it: both engines then print "14px"
    DOC = json.load(_f, parse_float=lambda s: int(float(s)) if float(s).is_integer() else float(s))
if DOC.get("format") != 1:
    raise SystemExit(f"{PATH}: format {DOC.get('format')} is not supported; run the migration (packages/schema)")


CHART_ID = DOC["meta"]["id"]
# media paths start at meta.assetRoot (relative to the document); the engine works with paths relative to the
# repository, where the pages are written
ASSET_BASE = os.path.normpath(os.path.join(os.path.dirname(PATH), DOC["meta"].get("assetRoot", ".")))


def asset(file):
    """a media path from the document as a path relative to the repository (with / separators)"""
    path = os.path.join(ASSET_BASE, file)
    try:
        rel = os.path.relpath(path, ROOT)
    except ValueError:                       # another drive (Windows): keep it absolute
        rel = path
    if rel.startswith(".."):                 # outside the repository: keep it absolute
        rel = os.path.normpath(path)
    return rel.replace("\\", "/")


def private_files():
    """every file a public build must leave out, whatever its kind: {path: reason}"""
    return {asset(m["file"]): m["private"] for m in DOC.get("media", {}).values() if m.get("private")}


def private_assets():
    """what a public build must leave out, by kind (from the media records): portraits by person id,
    other files by path. (A portrait is also left out by its file: see private_files.)"""
    out = {"portraits": {}, "emblems": {}, "brand": {}}
    for m in DOC.get("media", {}).values():
        if not m.get("private"):
            continue
        if m["kind"] == "portrait":
            if m.get("of"):
                out["portraits"][m["of"]] = m["private"]
        elif m["kind"] == "badge":
            out["brand"][asset(m["file"])] = m["private"]
        else:
            out["emblems"][asset(m["file"])] = m["private"]
    return out


def portrait_file(pid):
    """the portrait file the document gives a person, or None"""
    mid = DOC["people"].get(pid, {}).get("portrait")
    m = DOC.get("media", {}).get(mid) if mid else None
    return asset(m["file"]) if m else None


def text(value, lang=None):
    """a text field: a plain string (the default language) or {BCP 47 tag: text}"""
    if isinstance(value, dict):
        lang = lang or DOC["meta"].get("defaultLang", "en")
        return value.get(lang) or value.get(DOC["meta"].get("defaultLang", "en")) or next(iter(value.values()), "")
    return value or ""

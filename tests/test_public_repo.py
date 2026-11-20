"""The public repository's file list and checks (tools/public_repo.py, PLAN 9d): nothing private is selected, and
each kind of leak is caught."""
import os
import shutil
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "tools"))
import public_repo as P  # noqa: E402


def tracked():
    return [f for f in P.git("ls-files", "-z").split("\0") if f and os.path.exists(os.path.join(ROOT, f))]


def test_the_selection_leaves_out_every_private_file_and_proprietary_font():
    files, left = P.selection(tracked())
    _, private = P.media_files()
    assert private, "the charts mark some media private"
    assert not set(files) & private
    assert not [f for f in files if f.startswith("assets/fonts/") and not f.startswith("assets/fonts/open/")]
    assert "assets/fonts/open/Gantari-Regular.ttf" in files and "charts/tutorial/chart.json" in files
    assert all(left[p] == "private" for p in private if p in left)


def test_the_selection_as_it_stands_passes_the_checks():
    files, _ = P.selection(tracked())
    _, private = P.media_files()
    assert P.check(files, lambda r: os.path.join(ROOT, r), private) == []


def test_each_kind_of_leak_is_caught(tmp_path):
    _, private = P.media_files()
    src = {}

    def add(rel, data=None, copy=None):
        p = tmp_path / rel.replace("/", "_")
        if copy:
            shutil.copy(os.path.join(ROOT, copy), p)
        else:
            p.write_text(data, encoding="utf-8")
        src[rel] = str(p)

    present = sorted(p for p in private if p.endswith(".jpg") and os.path.exists(os.path.join(ROOT, p)))
    font = "assets/fonts/AlteHaasGroteskRegular.ttf"
    have_font = os.path.exists(os.path.join(ROOT, font))      # neither is in the public repository itself
    if present:
        add("assets/portraits/renamed.jpg", copy=present[0])                   # a private picture under another name
    if have_font:
        add("assets/fonts/open/Fake.ttf", copy=font)                            # a proprietary font, moved
    add("docs/notes.md", "built in " + "C:" + "\\Users\\someone\\charts\n")   # a local path (put together, so this file passes)
    strings, name = P.personal()
    if name:
        add("docs/credits.md", f"made by {name}\n")                             # a name outside the licence files
        add("LICENSE", f"Copyright (c) 2026 {name}\n")                          # where it belongs
    bad = P.check(list(src), lambda r: src[r], private)
    text = "\n".join(bad)
    if present:
        assert "renamed.jpg: the same file as" in text
    if have_font:
        assert "Fake.ttf: the same file as assets/fonts/AlteHaasGroteskRegular.ttf" in text
    assert "docs/notes.md:1: a local path" in text
    if name:
        assert "docs/credits.md:1: a personal detail" in text
        assert not [b for b in bad if b.startswith("LICENSE")]


def test_private_blocks_are_left_out_of_markdown():
    text = "open\n<!-- private -->\nonly here\n<!-- /private -->\nopen again\n"
    assert P.strip_private(text) == "open\nopen again\n"


def test_only_the_public_addresses_may_name_the_owner(tmp_path):
    strings, name = P.personal()
    allowed = P.public_addresses()
    if not name or not allowed:
        return                                   # the public repository: no owner's name to look for
    _, private = P.media_files()
    ok, bad = tmp_path / "ok.md", tmp_path / "bad.md"
    ok.write_text(f"see https://{allowed[0]}/\n", encoding="utf-8")
    bad.write_text(f"see https://{allowed[0]}/ by {name}\n", encoding="utf-8")
    src = {"docs/ok.md": str(ok), "docs/bad.md": str(bad)}
    found = P.check(list(src), lambda r: src[r], private)
    assert found == ["docs/bad.md:1: a personal detail"]

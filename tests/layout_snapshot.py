"""The layout lock and its diff tool: where everything sits, compared with charts/<chart>/layout.lock.json.

    python tests/layout_snapshot.py           # compare the build with the lock file
    python tests/layout_snapshot.py --all     # the same, listing every changed item (no grouping)
    python tests/layout_snapshot.py --update  # accept the current layout: rewrite the lock file
                                              # (refused while the build has errors, unless --force)

The lock holds every accepted position (PLAN Phase 4, research 1.5): boxes, the line into each child
(its x and the level of its horizontal line), the levels of every line, inline notes and note letters,
pills, house headers, crowns, brackets, the era axis and era labels, and the canvas. Its schema is
packages/schema/lock.schema.json. One item per line, sorted by id, so a git diff reads like the report.

A change that is meant to move nobody (a fact, a note's wording, a colour) should report no moves.
A change that is meant to move someone should move only them. The build must stay at 0 errors.
"""
import contextlib
import io
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
os.chdir(ROOT)
TOL = 0.5     # px
FORMAT = 1


def lock_path():
    import chartfile
    return os.path.join(os.path.dirname(os.path.join(ROOT, chartfile.PATH)), "layout.lock.json")


def r1(v):
    return round(float(v), 1) + 0.0          # + 0.0: no "-0.0"


def rect(r):
    return [r1(v) for v in r]


def current():
    with contextlib.redirect_stdout(io.StringIO()):
        import build
        errs, warns = build.build(report=False)
    import chartdoc
    doc = chartdoc.DOC
    nodes = build.NODES

    owner_id = build.line_name       # a line is named by its first descent, a marriage line by its union
    levels = {}
    for s in build.SEGS:
        ys = levels.setdefault(owner_id(s["owner"]), set())
        for (x0, y0), (x1, y1) in zip(s["pts"], s["pts"][1:]):
            if abs(y0 - y1) < 0.01 and abs(x0 - x1) > TOL:   # a jog under TOL is not a level
                ys.add(r1(y0))
    note_ids = list(doc.get("notes", {}))
    by_note = dict(zip(map(id, chartdoc.NOTES), note_ids))
    letters = {by_note[id(nt)]: build.letter(i) for i, nt in enumerate(build.numbered_order())}
    inline = {}
    for nt in build.INLINE:
        x, y, w, h = build.note_rect(*nt)
        inline[by_note[id(nt)]] = rect((x, y, x + w, y + h))
    brackets = {}
    for ids, label in build.BRACKETS:
        x0, x1, y, *_rest = build.bracket_geom(ids, label)
        brackets["+".join(ids)] = [r1(x0), r1(x1), r1(y)]
    return {
        "format": FORMAT,
        "chart": doc["meta"]["id"],
        "canvas": [build.W, build.HGT],
        "errors": len(errs),
        "warnings": sorted(warns),
        "boxes": {n.id: rect((n.l, n.top, n.r, n.bottom)) for n in nodes.values()},
        "drops": drops(build, chartdoc),
        "lines": {k: sorted(v) for k, v in levels.items()},
        "notes": inline,
        "letters": letters,
        "pills": {k: [r1(x), r1(y)] for k, (x, y) in build.PILLPOS.items()},
        "headers": {k: rect(build.header_rect(k)) for k in build.HEADERS},
        "crowns": {k: rect(build.crown_rect(k)) for k in build.CROWNS},
        "brackets": brackets,
        "axis": {str(yr): r1(build.Y(yr)) for yr, _ in build.ERAS},
        "eraLabels": {str(yr): rect(v[2]) for yr, v in build.ERA_LABELS.items()},
    }


def drops(build, cd):
    """the line into each child, by person id; a child with more than one line gets "child@descent" for each"""
    def descent(owner, kid):
        i = int(owner[1:])
        if owner[0] == "d":
            return cd.DESC_IDS[i][cd.DESC[i]["kids"].index(kid)]
        uid = cd.MARR_IDS[i]
        return next(k for k, d in cd.DOC["descents"].items() if d.get("union") == uid and d["child"] == kid)
    many = {k for k in {k for _o, k in build.DROPS} if sum(1 for _o, c in build.DROPS if c == k) > 1}
    return {(f"{k}@{descent(o, k)}" if k in many else k): [r1(v[0]), r1(v[1])] for (o, k), v in build.DROPS.items()}


SECTIONS = ("boxes", "drops", "lines", "notes", "letters", "pills", "headers", "crowns", "brackets", "axis", "eraLabels")


def dumps(lock):
    """one item per line, sorted by id: a git diff of the lock reads like the report"""
    out = ['{', '"$schema": "../../packages/schema/lock.schema.json",']
    head = [k for k in lock if k not in SECTIONS]
    for k in head:
        out.append(f"{json.dumps(k)}: {json.dumps(lock[k], ensure_ascii=False)},")
    for i, sec in enumerate(SECTIONS):
        items = sorted(lock[sec].items(), key=lambda kv: (len(kv[0]) if sec in ("axis", "eraLabels") else 0, kv[0]))
        body = ",\n".join(f" {json.dumps(k)}: {json.dumps(v, ensure_ascii=False)}" for k, v in items)
        out.append(f"{json.dumps(sec)}: {{\n{body}\n}}" + ("," if i < len(SECTIONS) - 1 else ""))
    out.append("}")
    return "\n".join(out) + "\n"


def num(v):
    return isinstance(v, (int, float))


def moved(a, b):
    """the largest difference between two positions (lists of numbers or strings)"""
    if isinstance(a, str) or isinstance(b, str):
        return 0 if a == b else float("inf")
    if len(a) != len(b):
        return float("inf")
    return max((abs(x - y) for x, y in zip(a, b)), default=0)


def describe(sec, k, a, b):
    if sec in ("boxes", "notes", "headers", "crowns", "eraLabels") and len(a) == len(b) == 4:
        d = [r1(x - y) for x, y in zip(b, a)]
        return f"  {k}: dx {d[0]:+} dy {d[1]:+} (width {r1(d[2] - d[0]):+}, height {r1(d[3] - d[1]):+})"
    if sec == "lines":
        return f"  {k}: levels {a} -> {b}"
    if sec == "letters":
        return f"  {k}: letter {a} -> {b}"
    return f"  {k}: {a} -> {b}"


def diff(old, cur, every=False):
    """the differences between two locks, as report lines; empty when nothing moved"""
    problems = []
    if cur["errors"]:
        problems.append(f"layout check reports {cur['errors']} errors")
    if cur["warnings"] != old["warnings"]:
        problems.append(f"warnings changed: {old['warnings']} -> {cur['warnings']}")
    if cur["canvas"] != old["canvas"]:
        problems.append(f"canvas changed: {old['canvas']} -> {cur['canvas']}")
    for sec in SECTIONS:
        o, c = old.get(sec, {}), cur.get(sec, {})
        for label, items in (("added", sorted(set(c) - set(o))), ("removed", sorted(set(o) - set(c)))):
            if items:
                problems.append(f"{sec} {label}: {', '.join(items)}")
        keys = [k for k in sorted(set(o) & set(c))
                if moved([o[k]] if num(o[k]) else o[k], [c[k]] if num(c[k]) else c[k]) > TOL]
        if keys:
            problems.append(f"{sec}: {len(keys)} changed\n" + "\n".join(grouped(sec, keys, o, c, every)))
    return problems


GROUP = 4      # this many items moved by the same amount are reported on one line


def grouped(sec, keys, o, c, every=False):
    """report lines for the changed items of one section. Items that moved by the same amount (to the
    nearest px, same size) are one line: a re-flow that shifts a whole branch reads as one move."""
    if every:
        return [describe(sec, k, o[k], c[k]) for k in keys]
    groups = {}
    for k in keys:
        a, b = o[k], c[k]
        shape = isinstance(a, list) and isinstance(b, list) and len(a) == len(b) and len(a) in (2, 4) \
            and all(num(v) for v in a + b)
        d = tuple(round(y - x) for x, y in zip(a, b)) if shape else ("own", k)
        groups.setdefault(d, []).append(k)
    out, single = [], []
    for d, ks in sorted(groups.items(), key=lambda g: -len(g[1])):
        if len(ks) < GROUP or d[0] == "own":
            single += ks
            continue
        dx, dy = d[0], d[1]
        size = "" if len(d) == 2 or (d[2] == dx and d[3] == dy) else f", resized {d[2] - dx:+} x {d[3] - dy:+}"
        names = ", ".join(ks[:8]) + (f", ... (+{len(ks) - 8} more)" if len(ks) > 8 else "")
        out.append(f"  {len(ks)} moved together, dx {dx:+} dy {dy:+}{size}: {names}")
    return out + [describe(sec, k, o[k], c[k]) for k in sorted(single)]


def main():
    cur = current()
    path = lock_path()
    if "--update" in sys.argv:
        if cur["errors"] and "--force" not in sys.argv:
            print(f"not saved: the build has {cur['errors']} layout errors (python build.py lists them); "
                  "fix them, or add --force to accept the layout anyway")
            return 1
        with open(path, "w", encoding="utf-8", newline="\n") as f:
            f.write(dumps(cur))
        print(f"saved {path}: " + ", ".join(f"{len(cur[s])} {s}" for s in SECTIONS) + f", canvas {cur['canvas']}")
        return 0
    if not os.path.exists(path):
        print(f"no lock file at {path}; run with --update to accept the current layout")
        return 1
    with open(path, encoding="utf-8") as f:
        old = json.load(f)
    problems = diff(old, cur, every="--all" in sys.argv)
    if problems:
        print("\n".join(problems))
        return 1
    print(f"layout unchanged: {len(cur['boxes'])} boxes, {len(cur['lines'])} lines, {len(cur['drops'])} drops, "
          f"{len(cur['notes'])} notes, {len(cur['pills'])} pills, {cur['errors']} errors, {len(cur['warnings'])} warnings")
    return 0


if __name__ == "__main__":
    sys.exit(main())

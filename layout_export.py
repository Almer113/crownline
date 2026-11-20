"""Layout export (PLAN.md Phase 2, item 1): the contract between the engine and everything that draws.

build.build() calls write() after laying out the chart. It writes <OUT_NAME>.layout.json next to the HTML:
every person box, every line with the people it joins, notes, house headers, crowns, pills and the canvas.
The viewer uses it for clicking, searching and linking; a future renderer can draw from it.

Added for the interactive viewer (Phase 3, still format 1: fields are only ever added):
  people[id].family   parents / spouses / children, each [{"id", "gap"}]; gap names omitted generations;
                      "via": "adoptive" marks an adoption the chart does not draw
                      ("grandson", "descendant") when the chart skips them
  people[id].crown    the order of reign within the court ("2 · 4 · 8" for several reigns), or null
  people[id].notes    the person's notes as plain text: [{"text", "letter"}]; letter is set for the lettered
                      notes in the Notes band, null for notes printed beside the card
  headers[id]         also years, seat, founded and emblem (null when a public build leaves it out)
  glossary            titles and honorifics: [{"group", "term", "full", "meaning"}]
  eras, episodes      [{"year", "name"}] and [{"from", "to", "name"}] for the time bands
  intro, asOf         the chart's introduction (plain text) and the date its information is current to
  title               the chart's title (plain text), for the viewer page (added in Phase 6)
  people[id].bio      one or two sentences about the person (Phase 6; only when the document has one)
  people[id].aka      other names and spellings, every language and script (Phase 6; only when there are some)
  people[id].reign    the panel's words for the person's reigns, {language: text}, from the court's `reign`
                      template (only when the court has one)
  interface           the interface languages the viewer offers (panels.viewer.languages; only when set)
  people[id].span     [from, to] years the person is shown as present on the time slider, read from the card's
                      dates (a reign, "d. 1584", "since 2025"; "b. 1972" alone runs to the present) and the row year; spanGuess is true
                      when no end date is printed and the span is a 30-year guess
  stages              the map panel's stages: [{"id", "from", "title"}]; the map cells carry data-stage
  tours               guided tours from the chart document; every person and stage id is checked here
  people[id].born     the birth claims, the preferred first: [{"date", "place", "note", "certainty", "sources"}], each
  people[id].died     field only when given; date is the date as written; sources [{"source", "where"}] (Phase 9)
  people[id].sources  the person's own citations, [{"source", "where"}]
  sources             the works cited by anyone above: {id: {"kind", "title", "author", "year", "url"}} (only when some are)
Coordinates are chart pixels (the HTML page's own coordinates), rectangles are [left, top, right, bottom].
"""
import json
import os
import re

FORMAT = 1


def _r(v):
    return round(float(v), 1)


# a year, with an optional short end: "1647/48" (one or the other) or "1810–11" (a range)
_YEAR = re.compile(r"(?<!\d)(1[0-9]{3}|20[0-9]{2})(?:/(\d{2})|\s*[–-]\s*(\d{2})(?!\d))?(?!\d)")
# words after which a year marks an event in a life, not its end: a marriage, a divorce, a new name
_EVENT = re.compile(r"(?<![a-z])(m\.|div\.|divorced|renamed)", re.I)
_BORN = re.compile(r"(?<![a-z])b\.\s*(?:c\.\s*)?$", re.I)
GUESS = 30      # years a person is assumed present when the card gives no end
OLDEST = 100    # a birth year with no death runs to the present, but no longer than this


def span(row_year, text, now):
    """[from, to, guessed]: the years a person is shown as present, from the dates printed on the card.
    A birth year with no death runs to the present (at most OLDEST years); years after "m.", "div." or
    "renamed" are events that only stretch the guess; "present", "today" and "since" run to the present."""
    life, events, born = [], [], []
    for seg in text.split("·"):
        ev = _EVENT.search(seg)
        for m in _YEAR.finditer(seg):
            ys = [int(m[1])] + [int(m[1][:2] + e) for e in (m[2], m[3]) if e]
            if ev and ev.start() < m.start():
                events += ys
            elif _BORN.search(seg[:m.start()]):
                born += ys
            else:
                life += ys
    every = life + events + born
    lo = min([row_year] + every) if row_year else min(every, default=0)
    if re.search(r"present|today|since", text):
        return [lo, now, False]
    if born and not life:
        b = min(born)
        return [lo, now, False] if now - b <= OLDEST else [lo, b + OLDEST, True]
    hi = max(life, default=None)
    if hi is None or hi <= lo:
        return [lo, min(now, max([lo + GUESS] + events)), True]
    return [lo, hi, False]


def _rect(x0, y0, x1, y1):
    return [_r(x0), _r(y0), _r(x1), _r(y1)]


def _plain(s):
    """markup to plain text; a line break becomes a space ("son of<br>Sultan" -> "son of Sultan")"""
    s = re.sub(r"\s*<br\s*/?>\s*", " ", s or "")
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", s)).strip()


def tours(people, stages, data=None):
    """the guided tours of the chart document, checked: a tour that names someone not on the chart is an error"""
    if data is None:
        import chartdoc
        data = chartdoc.TOURS
    bad = []
    for tr in data:
        for i, st in enumerate(tr["steps"], 1):
            if not st.get("caption"):
                bad.append(f'{tr["id"]} step {i}: no caption')
            focus = st.get("focus", [])
            ids = ([] if focus == "all" else [f for f in focus if not f.startswith("map:")]) + st.get("light", [])
            ids += [st["lineage"]] if st.get("lineage") else []
            maps_ = [f[4:] for f in ([] if focus == "all" else focus) if f.startswith("map:")]
            maps_ += [st["stage"]] if st.get("stage") else []
            bad += [f'{tr["id"]} step {i}: no person "{k}"' for k in ids if k not in people]
            bad += [f'{tr["id"]} step {i}: no map stage "{k}"' for k in maps_ if k not in stages]
    if bad:
        raise ValueError("tours: " + "; ".join(bad))
    return data


def collect(build):
    import chartfile
    import model
    maps = build.maps
    nodes = build.NODES

    people = {}
    family = {k: {"parents": [], "spouses": [], "children": []} for k in nodes}

    def link(group, a, b, gap=None, via=None):
        if a in family and b in nodes and all(x["id"] != b for x in family[a][group]):
            family[a][group].append({"id": b, "gap": gap, **({"via": via} if via else {})})

    for d in build.DESC:
        for kid in d["kids"]:
            parents = list(d["couple_of"] or [d["parent"]])
            if kid in (d.get("caption") or {}):
                continue                  # a captioned link ("court poet", "son-in-law"): not parent and child
            gap = d["brk"].get(kid)
            for par in parents:
                link("children", par, kid, gap)
                link("parents", kid, par, gap)
    # an adoption kept in the data but not drawn (show.drawn false): listed in the panel, marked "adoptive",
    # and not followed by the relationship finder, which goes by birth and marriage
    for d in chartfile.DOC.get("descents", {}).values():
        if d.get("show", {}).get("drawn") is False and d.get("kind") == "adoptive" and d.get("parent"):
            link("children", d["parent"], d["child"], via="adoptive")
            link("parents", d["child"], d["parent"], via="adoptive")
    for m in build.MARR:
        a, b, kids = m[0], m[1], (m[4] if len(m) > 4 else []) or []
        link("spouses", a, b)
        link("spouses", b, a)
        for kid in kids:
            for par in (a, b):
                link("children", par, kid)
                link("parents", kid, par)

    notes_of = {k: [] for k in nodes}
    for nt in build.INLINE:
        notes_of.setdefault(nt[0], []).append({"text": _plain(nt[5]), "letter": None})
    for i, nt in enumerate(build.numbered_order()):
        notes_of.setdefault(nt[0], []).append({"text": _plain(nt[5]), "letter": build.letter(i)})

    now = int(re.findall(r"\d{4}", build.AS_OF)[-1])
    for n in nodes.values():
        lo, hi, guess = span(n.year, _plain(n.sub), now)
        people[n.id] = {
            "kind": n.kind, "house": n.house, "colour": model.HOUSE.get(n.house, model.NEUTRAL),
            "title": model.disp_title(n.title) if n.title else "", "name": n.name, "sub": _plain(n.sub),
            "year": n.year, "rect": _rect(n.l, n.top, n.r, n.bottom),
            "portrait": n.pic, "hatch": bool(n.hatch), "traditional": bool(n.trad), "tag": n.tag,
            "family": family[n.id], "crown": build.CROWNS.get(n.id), "notes": notes_of.get(n.id, []),
            "span": [lo, hi], "spanGuess": guess,
        }
        rec = chartfile.DOC["people"].get(n.id, {})
        reign = reign_text(rec)
        if reign:
            people[n.id]["reign"] = reign
        if rec.get("bio"):
            people[n.id]["bio"] = _plain(chartfile.text(rec["bio"]))
        other = [v for a in rec.get("aka", []) for v in (a.values() if isinstance(a, dict) else [a])]
        other += rec.get("variants", [])
        if other:
            people[n.id]["aka"] = [_plain(v) for v in other]
        for f in ("born", "died"):
            if rec.get(f):
                people[n.id][f] = [claim(c) for c in rec[f]]
        if rec.get("sources"):
            people[n.id]["sources"] = [cite(c) for c in rec["sources"]]

    cited = {c["source"] for p in people.values()
             for c in p.get("sources", []) + [c for f in ("born", "died") for cl in p.get(f, []) for c in cl.get("sources", [])]}
    registry = chartfile.DOC.get("sources", {})
    sources = {k: {f: registry[k][f] if f in ("kind", "year", "url") else _plain(chartfile.text(registry[k][f]))
                   for f in ("kind", "title", "author", "year", "url") if f in registry[k]}
               for k in sorted(cited) if k in registry}

    def who(owner):
        """the people a line joins, from its owner id: d<i> = a descent, m<i> = a marriage"""
        kind, i = owner[0], int(owner[1:])
        if kind == "d":
            d = build.DESC[i]
            return {"type": "descent", "from": [d["parent"]], "to": list(d["kids"])}
        a, b, *_rest = build.MARR[i]
        kids = build.MARR[i][4] if len(build.MARR[i]) > 4 else []
        return {"type": "marriage", "from": [a, b], "to": list(kids or [])}

    viewer = chartfile.DOC.get("panels", {}).get("viewer", {})

    lines = []
    for s in sorted(build.SEGS, key=build.rank):          # drawing order: later lines are on top
        lines.append({"owner": s["owner"], **who(s["owner"]), "points": [[_r(x), _r(y)] for x, y in s["pts"]],
                      "colour": s["col"], "style": s["style"], "hop": bool(s["hop"])})

    notes = []
    for nt in build.INLINE:
        x, y, w, h = build.note_rect(*nt)
        notes.append({"anchor": nt[0], "rect": _rect(x, y, x + w, y + h), "text": _plain(nt[5]) if len(nt) > 5 else ""})

    headers = {k: {"rect": _rect(*build.header_rect(k)), "name": v[2], "kind": v[1], "years": v[3], "seat": v[4],
                   "founded": v[5], "emblem": model.published(v[0])} for k, v in build.HEADERS.items()}
    crowns = {k: {"rect": _rect(*build.crown_rect(k))} for k in build.CROWNS}

    return {
        "format": FORMAT,
        "chart": build.CHART_ID,
        "public": bool(model.PUBLIC),
        "canvas": [build.W, build.HGT],
        "people": people,
        "lines": lines,
        "notes": notes,
        "headers": headers,
        "crowns": crowns,
        "glossary": [{"group": g, "term": t, "full": f, "meaning": m} for g, t, f, m in build.GLOSSARY],
        "eras": [{"year": y, "name": nm} for y, nm in build.ERAS],
        "episodes": [{"from": a, "to": b, "name": nm} for a, b, nm in build.EPISODES],
        "stages": [{"id": m["id"], "from": m["from"], "title": m["title"]} for m in maps.MAPS] if maps else [],
        "tours": tours(people, {m["id"]: m["from"] for m in maps.MAPS} if maps else {}),
        "title": _plain(build.TITLE),
        "intro": _plain(build.TITLE_TEXT),
        "asOf": build.AS_OF,
        **({"interface": viewer["languages"]} if viewer.get("languages") else {}),
        **({"startYear": viewer["year"]} if viewer.get("year") else {}),
        **({"sources": sources} if sources else {}),
    }


def cite(c):
    """a citation for the panel: the source's id and where in it"""
    return {"source": c["source"], **({"where": c["where"]} if c.get("where") else {})}


def claim(c):
    """a birth or death claim for the panel, as plain text: the date as written, place, note, certainty, sources"""
    import chartfile
    out = {}
    if c.get("date"):
        out["date"] = c["date"].get("text") or c["date"]["edtf"]
    for f in ("place", "note"):
        if c.get(f):
            out[f] = _plain(chartfile.text(c[f]))
    if c.get("certainty"):
        out["certainty"] = c["certainty"]
    out["sources"] = [cite(s) for s in c.get("sources", [])]
    return out


def ordinal(n):
    return f"{n}{'th' if 10 <= n % 100 <= 20 else {1: 'st', 2: 'nd', 3: 'rd'}.get(n % 10, 'th')}"


AND = {"en": " and ", "id": " dan "}


def reign_text(rec):
    """the panel's words for a person's reigns, by language, from their court's `reign` template; None
    when the court has none (the viewer then says "Ruler {n} of" the court's header)"""
    import chartfile
    reigns = rec.get("reigns") or []
    if not reigns:
        return None
    courts = {}                                    # reigns in two courts are named court by court
    for r in reigns:
        courts.setdefault(r["court"], []).append(r["n"])
    tpls = [chartfile.DOC.get("houses", {}).get(c, {}).get("reign") for c in courts]
    if not all(tpls):
        return None
    default = chartfile.DOC["meta"].get("defaultLang", "en")
    tpls = [t if isinstance(t, dict) else {default: t} for t in tpls]

    def join(xs, lang, sep=None):
        xs = [str(x) for x in xs]
        return xs[0] if len(xs) == 1 else ", ".join(xs[:-1]) + (sep or AND.get(lang[:2], ", ")) + xs[-1]
    langs = list(dict.fromkeys(lang for t in tpls for lang in t))
    out = {}
    for lang in langs:
        parts = [(t.get(lang) or t.get(default) or next(iter(t.values()))).replace(
            "{nth}", join([ordinal(n) for n in ns], lang)).replace("{n}", join(ns, lang))
            for t, ns in zip(tpls, courts.values())]
        out[lang] = "; ".join(parts)
    return out


def write(build, out_name):
    data = collect(build)
    import model
    path = os.path.join(model.ROOT, out_name + ".layout.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    return path

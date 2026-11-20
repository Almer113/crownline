// The real document passes; broken copies fail with a message that names the record and the problem.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { validate, validateLock, migrate, FormatError, type Migration } from "../src/index.ts";

const repo = fileURLToPath(new URL("../../../", import.meta.url));
const load = (p: string) => JSON.parse(readFileSync(repo + p, "utf8"));
const DOC = load("charts/wangsa-mataram/chart.json");
const fresh = () => structuredClone(DOC);

/** validate a changed copy and return its messages as "at: message" lines */
function problems(change: (d: any) => void, level: "errors" | "warnings" = "errors"): string[] {
  const d = fresh();
  change(d);
  return validate(d)[level].map(p => `${p.at}: ${p.message}`);
}
const has = (lines: string[], re: RegExp) => assert.ok(lines.some(l => re.test(l)), `expected ${re} in:\n${lines.join("\n")}`);

test("the Wangsa Mataram document passes with no errors and no warnings", () => {
  const r = validate(DOC);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.warnings, []);
});

test("its layout lock passes the lock schema", () => {
  assert.deepEqual(validateLock(load("charts/wangsa-mataram/layout.lock.json")).errors, []);
});

// ---------------------------------------------------------------- pass 1: the schema
test("an unknown field is refused, and extensions go under ext", () => {
  has(problems(d => { d.people.hb9.nickname = "x"; }), /^people\.hb9: unknown field "nickname"/);
  assert.deepEqual(problems(d => { d.people.hb9.ext = { nickname: "x" }; }), []);
});

test("a missing field and a bad value are named", () => {
  has(problems(d => { delete d.people.hb9.show; }), /^people\.hb9: show is missing/);
  has(problems(d => { d.people.hb9.show.box = "king"; }), /^people\.hb9\.show\.box: "king" must be one of "ruler", "heir"/);
  const house = Object.keys(DOC.houses)[0];
  has(problems(d => { d.houses[house].colour = "red"; }), new RegExp(`^houses\.${house}\.colour: "red" is not a colour`));
});

test("an adjustment is checked against its own kind only", () => {
  const lines = problems(d => { d.adjustments.x = { kind: "follow", target: "hb9", reason: "" }; });
  has(lines, /^adjustments\.x: of is missing/);
  has(lines, /^adjustments\.x: dx is missing/);
  assert.ok(lines.every(l => !/anyOf|nudge/.test(l)), lines.join("\n"));
  has(problems(d => { d.adjustments.x = { kind: "shove", target: "hb9", reason: "" }; }), /^adjustments\.x: kind "shove" must be one of nudge, follow/);
});

test("a union needs exactly two partners", () => {
  has(problems(d => { d.unions[Object.keys(d.unions)[0]].partners.push("hb9"); }), /^unions\.\w+\.partners: has more than 2 items/);
});

// ---------------------------------------------------------------- pass 2: references and tree rules
test("references must exist and be the right kind of thing", () => {
  has(problems(d => { d.people.hb9.house = "nowhere"; }), /^people\.hb9: house "nowhere" is not a house/);
  has(problems(d => { d.descents[Object.keys(d.descents)[0]].child = "nobody"; }), /child "nobody" is not a person/);
  has(problems(d => { d.adjustments.x = { kind: "coupleSide", target: "hb9", side: 1, reason: "" }; }), /^adjustments\.x: target "hb9" is not a union/);
  has(problems(d => { d.notes[Object.keys(d.notes)[0]].anchor = "nobody"; }), /anchor "nobody" is not a person/);
});

test("ids are unique across the document", () => {
  has(problems(d => { d.notes.hb9 = d.notes[Object.keys(d.notes)[0]]; }), /^notes\.hb9: the id is also used in people/);
});

test("a person placed twice is refused, with the fix", () => {
  const [id, desc] = Object.entries<any>(DOC.descents).find(([, x]) => x.parent && !x.show?.hop && !x.show?.branch && !x.show?.row)!;
  const lines = problems(d => { d.descents.extra = { parent: "hb9", child: desc.child }; });
  has(lines, new RegExp(`^people\\.${desc.child}: is placed by two descents \\(${id}, extra\\); mark all but one`));
});

test("someone with no placing parent makes a second root", () => {
  has(problems(d => { d.people.loner = { name: "Loner", show: { box: "text", year: 1900 } }; }),
      /^people: the tree needs one root; 2 people have no placing parent: .*loner/);
});

test("no one is their own ancestor", () => {
  // hb8's placing line comes from hb9 instead: hb9 descends from hb8
  const k = Object.keys(DOC.descents).find(k => DOC.descents[k].child === "hb8" && DOC.descents[k].parent)!;
  has(problems(d => { d.descents[k].parent = "hb9"; }), /is their own ancestor: .*hb8.*hb9|is their own ancestor: .*hb9.*hb8/);
});

test("only <b>, <i> and <br> markup", () => {
  has(problems(d => { d.notes[Object.keys(d.notes)[0]].text = "a <script>x</script>"; }), /markup "<script>x<\/script>" is not allowed/);
  assert.deepEqual(problems(d => { d.notes[Object.keys(d.notes)[0]].text = "<b>a</b><br><i>b</i>"; }), []);
});

test("a title word missing from the glossary is a warning, not an error", () => {
  const d = fresh();
  d.people.hb9.title = "Grand Vizier";
  const r = validate(d);
  assert.equal(r.ok, true);
  has(r.warnings.map(p => `${p.at}: ${p.message}`), /^people\.hb9: title word "Grand" is not in the glossary/);
});

test("the default language must be one of the languages", () => {
  has(problems(d => { d.meta.defaultLang = "fr"; }), /^meta: defaultLang "fr" is not in languages/);
});

// ---------------------------------------------------------------- migrations
test("the current format needs no migration", () => {
  const { doc, steps } = migrate(fresh());
  assert.deepEqual(steps, []);
  assert.deepEqual(doc, DOC);
});

test("migrations run in order, each one step, and leave ext alone", () => {
  // a made-up history: format 1 named it "folk", format 2 "people"; format 3 added meta.languages
  const table: Record<number, Migration> = {
    1: d => { const { folk, ...rest } = d as any; return { ...rest, people: folk, format: 2 }; },
    2: d => ({ ...d, meta: { ...(d.meta as object), languages: ["en"] }, format: 3 }),
  };
  const before = { format: 1, meta: { id: "x" }, folk: { a: {} }, ext: { keep: [1, 2] } };
  const { doc, steps } = migrate(before, 3, table);
  assert.deepEqual(steps, ["1 → 2", "2 → 3"]);
  assert.deepEqual(doc, { format: 3, meta: { id: "x", languages: ["en"] }, people: { a: {} }, ext: { keep: [1, 2] } });
  assert.equal((before as any).folk !== undefined, true, "the input is not changed");
});

test("a newer format, a gap, or a bad step is refused", () => {
  assert.throws(() => migrate({ format: 9 }, 1, {}), (e: Error) => e instanceof FormatError && /newer than/.test(e.message));
  assert.throws(() => migrate({ format: 1 }, 3, { 1: d => ({ ...d, format: 2 }) }), /no migration from format 2 to 3/);
  assert.throws(() => migrate({ format: 1 }, 2, { 1: d => d }), /did not set format 2/);
  assert.throws(() => migrate({ format: "1" }, 1, {}), /whole number/);
});

test("chart.schema.json and lock.schema.json are up to date (npm run emit)", async () => {
  const { Chart, Lock } = await import("../src/index.ts");
  for (const [file, schema] of [["chart.schema.json", Chart], ["lock.schema.json", Lock]] as const) {
    const onDisk = readFileSync(repo + `packages/schema/${file}`, "utf8").replace(/\r\n/g, "\n");
    const fresh = JSON.stringify({ $schema: "https://json-schema.org/draft/2020-12/schema", ...schema }, null, 1) + "\n";
    assert.equal(onDisk, fresh, `${file} is stale: run npm run emit`);
  }
});

test("docs/FORMAT.md is up to date (npm run emit)", async () => {
  const { reference } = await import("../src/reference.ts");
  const onDisk = readFileSync(repo + "docs/FORMAT.md", "utf8").replace(/\r\n/g, "\n");
  assert.equal(onDisk, reference(), "docs/FORMAT.md is stale: run npm run emit -w @crownline/schema");
});

// ---------------------------------------------------------------- review findings (18 November 2026)
const lines = (change: (d: any) => void) => {
  const d = fresh(); change(d);
  const r = validate(d);
  return [...r.errors, ...r.warnings].map(p => `${p.at}: ${p.message}`);
};
const only = (ls: string[], re: RegExp) => {
  assert.equal(ls.length, 1, `expected one line, got:\n${ls.join("\n")}`);
  has(ls, re);
};

test("a key that is not an id is refused, not skipped", () => {
  has(problems(d => { d.people.HB99 = 5; }), /^people: key "HB99" is not an id/);
  has(problems(d => { d.adjustments["Nudge-1"] = { kind: "shove" }; }), /^adjustments: key "Nudge-1" is not an id/);
  has(problems(d => { d.meta.title = { EN: "x" }; }), /^meta\.title: key "EN" is not a language tag/);
  has(problems(d => { d.houses.Kraton = { name: "K", colour: "#000000" }; }), /^houses: key "Kraton" is not an id/);
});

test("an unclosed tag is refused (it would become live HTML)", () => {
  has(problems(d => { d.meta.subtitle = "Royal tree <img src=x onerror=alert(1) "; }), /^meta\.subtitle: markup "<img src=x/);
  has(problems(d => { d.notes[Object.keys(d.notes)[0]].text = "a < b"; }), /markup "< b" is not allowed/);
});

test("tree shapes the engine cannot draw are refused, as the engine sees them", () => {
  const newp = (d: any, k: string, show: object) => { d.people[k] = { name: k, show: { box: "text", ...show } }; };
  // children of someone placed by a follow adjustment
  has(problems(d => { newp(d, "zz", { year: 1950 }); d.descents.d_zz = { parent: "trunajaya", child: "zz" }; }),
      /^descents\.d_zz: trunajaya is placed by a follow adjustment/);
  // beside someone who is beside someone else
  const tied = Object.entries<any>(DOC.people).find(([, p]) => p.show.beside)![0];
  has(problems(d => { newp(d, "zz", { beside: { of: tied, side: "r" } }); }), new RegExp(`^people\.zz: is drawn beside ${tied}, who is drawn beside`));
  // a cycle through a spouse
  has(problems(d => {
    newp(d, "zzwife", { beside: { of: "hb9", side: "r" } });
    const k = Object.keys(d.descents).find(k => d.descents[k].child === "hb8" && d.descents[k].parent)!;
    d.descents[k].parent = "zzwife";
  }), /is their own ancestor/);
  // a couple's child who is drawn beside someone
  const u = Object.keys(DOC.unions)[0];
  has(problems(d => { newp(d, "zz", { beside: { of: "hb10", side: "r" } }); d.descents.d_zz = { union: u, child: "zz" }; }),
      /^descents\.d_zz: zz is drawn beside hb10, so cannot also hang from the couple's line/);
  // following yourself, or in a loop
  const f = Object.entries<any>(DOC.adjustments).find(([, a]) => a.kind === "follow")!;
  has(problems(d => { d.adjustments[f[0]].of = f[1].target; }), /cannot follow themselves/);
  has(problems(d => { d.adjustments.zz_loop = { kind: "follow", target: f[1].of, of: f[1].target, dx: 0, reason: "" }; }), /follows in a loop/);
});

test("a row member needs no year of its own", () => {
  const m = DOC.display.rows[0].members[1];
  assert.deepEqual(problems(d => { delete d.people[m].show.year; }), []);
});

test("the Tokugawa document passes too", () => {
  const r = validate(load("charts/tokugawa/chart.json"));
  assert.deepEqual([r.errors, r.warnings], [[], []]);
});

test("an undrawn line must not place anyone; the removed show.couple switch is refused (the engine side: tests/test_chart.py)", () => {
  const [id] = Object.entries<any>(DOC.descents).find(([, x]) => x.parent && !x.show?.hop && !x.show?.branch && !x.show?.row)!;
  has(problems(d => { d.descents[id].show = { ...d.descents[id].show, drawn: false }; }), new RegExp(`^descents\.${id}: show\.drawn false needs show\.hop`));
  assert.ok(!problems(d => { d.descents[id].show = { ...d.descents[id].show, drawn: false, hop: true }; })
    .some(l => l.includes("drawn false")));
  has(problems(d => { d.descents[id].show = { ...d.descents[id].show, couple: false }; }),
      new RegExp(`^descents\.${id}\.show: unknown field "couple"`));
});

test("drop on a couple's child, unknown sources, bad dates, empty moves", () => {
  const cd = Object.entries<any>(DOC.descents).find(([, x]) => !x.parent)![0];
  has(problems(d => { d.adjustments.zz = { kind: "drop", target: cd, drop: 300, reason: "" }; }), /is a couple's child; drop needs a line from one parent/);
  has(problems(d => { d.people.hb9.sources = [{ source: "nosuch" }]; }), /^people\.hb9\.sources\[0\]: source "nosuch" is not in sources/);
  has(problems(d => { d.meta.asOf.edtf = "c. 1587"; }), /^meta\.asOf\.edtf: "c\. 1587" is not an EDTF date/);
  has(lines(d => { d.adjustments.zz = { kind: "nudge", target: "hb9", reason: "" }; }), /^adjustments\.zz: moves nothing/);
});

test("two lettered notes on one person are refused (their letters would overlap)", () => {
  has(problems(d => { d.notes.n_zz = { anchor: "pb6", text: "x", show: { side: "r", width: 300 } }; }), /pb6 already has a lettered note/);
});

test("required sections and keys the engine needs", () => {
  has(problems(d => { delete d.panels; }), /^\(document\): panels is missing/);
  has(problems(d => { delete d.theme.type.name; }), /^theme\.type: name is missing/);
});

test("one clear line per mistake", () => {
  const u = Object.keys(DOC.unions)[0];
  only(lines(d => { d.adjustments.zz = { kind: "coupleSide", target: u, side: 2, reason: "" }; }), /^adjustments\.zz\.side: 2 must be one of -1, 0, 1$/);
  const id = Object.keys(DOC.descents)[0];
  only(lines(d => { d.descents[id].generations = 0; }), /generations: must be at least 1$/);
  only(lines(d => { d.people.hb9.name = 5; }), /^people\.hb9\.name: must be text: a string, or \{language tag: string\}$/);
  only(lines(d => { d.people.hb9.name = {}; }), /^people\.hb9\.name: must not be empty$/);
  only(lines(d => { d.panels.sources[0] = { publik: "x" }; }), /^panels\.sources\[0\]: unknown field "publik"/);
  only(lines(d => { d.tours.split.steps[1].focus = ["HB9"]; }), /focus\[0\]: "HB9" is not a person id or map:<stage>$/);
  only(lines(d => { d.people.hb9.house = "Yogya"; }), /^people\.hb9\.house: "Yogya" is not an id/);
  only(lines(d => { d.adjustments.zz = "nudge hb10"; }), /^adjustments\.zz: must be an object with kind, target and reason$/);
  only(lines(d => { d.people.hb9.born = [{ date: "1912" }]; }), /born\[0\]\.date: must be an object$/);
});

test("the lock is checked against its document", async () => {
  const { checkLock } = await import("../src/check.ts");
  const lock = load("charts/wangsa-mataram/layout.lock.json");
  lock.chart = "some-other-chart";
  delete lock.boxes.hb9;
  lock.boxes.ghost = [0, 0, 1, 1];
  const ls = checkLock(lock, DOC).map(p => `${p.level} ${p.at}: ${p.message}`);
  has(ls, /^error lock\.chart: "some-other-chart" is not this document's chart/);
  has(ls, /^error lock\.boxes: 1 not in the document's people: ghost/);
  has(ls, /^warning lock\.boxes: 1 people have no locked position.*hb9/);
});

test("a succession table names a house; the card's arrangement is one of three", () => {
  has(problems(d => { d.panels.succession = { court: "nowhere" }; }), /^panels: succession\.court "nowhere" is not a house/);
  assert.ok(problems(d => { d.panels.header.arrange = "sideways"; }).some(l => l.startsWith("panels.header.arrange")));
  assert.deepEqual(problems(d => { d.panels.header.arrange = "column"; }), []);
});

test("a court's reign wording needs a number; the viewer's languages must be ones it has", () => {
  const h = Object.keys(DOC.houses)[0];
  const both = (c: (d: any) => void) => [...problems(c), ...problems(c, "warnings")];
  assert.deepEqual(both(d => { d.houses[h].reign = "{nth} ruler"; d.panels.viewer = { languages: ["en"] }; }), []);
  assert.deepEqual(both(d => { d.houses[h].reign = { en: "Ruler {n}", id: "Penguasa ke-{n}" }; }), []);
  has(problems(d => { d.houses[h].reign = "a ruler"; }, "warnings"), new RegExp(`^houses\.${h}\.reign: "a ruler" has no \{n\}`));
  has(problems(d => { d.panels.viewer = { languages: ["fr"] }; }, "warnings"), /^panels\.viewer\.languages: the viewer has no "fr" interface/);
  assert.ok(problems(d => { d.panels.viewer = { languages: [] }; }).some(l => l.startsWith("panels.viewer.languages")));
});

test("one union per couple; a succession table needs someone reigning in its court; known fonts", () => {
  const [uid, u] = Object.entries<any>(DOC.unions)[0];
  has(problems(d => { d.unions.u_again = { ...u, partners: [...u.partners].reverse() }; }),
      new RegExp(`^unions\.u_again: .* are already a couple in ${uid}`));
  has(problems(d => { d.houses.empty_court = { name: "Nobody", colour: "#123456" }; d.panels.succession = { court: "empty_court" }; }, "warnings"),
      /^panels\.succession: no one reigns in "empty_court"/);
  has(problems(d => { d.theme.fonts.secondScript = "noto-jv"; }), /^theme\.fonts\.secondScript: the engine has no font "noto-jv"/);
  has(problems(d => { d.theme.fonts.sans = "helvetica"; }, "warnings"), /^theme\.fonts\.sans: the engine has no font "helvetica"/);
});

test("the map panel names its data, views, colours and areas; tours name its maps", () => {
  const m0 = (d: any) => d.panels.map.maps[0];
  has(problems(d => { d.panels.map.shapes = "nothing"; }), /^panels\.map: shapes "nothing" is not in media/);
  has(problems(d => { d.panels.map.assignments = "p_agung"; }), /^panels\.map: assignments "p_agung" is a portrait, not a data/);
  has(problems(d => { m0(d).view = "moon"; }), /^panels\.map\.maps\[0\]: view "moon" is not in panels\.map\.views/);
  has(problems(d => { m0(d).default = "nocolour"; }), /^panels\.map\.maps\[0\]\.default: "nocolour" is not a fill/);
  has(problems(d => { m0(d).fills.x = "house:nowhere/other"; }), /^panels\.map\.maps\[0\]\.fills\.x: "house:nowhere\/other" is not a fill/);
  has(problems(d => { d.panels.map.colours.bad = "blue"; }), /^panels\.map\.colours\.bad: "blue" is not a colour/);
  has(problems(d => { m0(d).overlays = [{ area: "atlantis", fill: "other" }]; }), /^panels\.map\.maps\[0\]\.overlays\[0\]: area "atlantis" is not in panels\.map\.areas/);
  has(problems(d => { d.panels.map.maps.push({ ...m0(d) }); }), /^panels\.map\.maps\[6\]: map "S1" appears twice/);
  const tid = Object.keys(DOC.tours)[0];
  const bad = problems(d => { d.tours[tid].steps[0].focus = ["map:S9"]; });
  assert.ok(bad.includes(`tours.${tid}.steps[0]: map stage "S9" is not in panels.map.maps`), bad.join("\n"));
  assert.deepEqual(problems(d => { m0(d).fills.x = "house:mataram+0.6/#123456"; }), []);
});

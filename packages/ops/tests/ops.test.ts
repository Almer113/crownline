import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { format, validate, type ChartDoc } from "@crownline/schema";
import { addChild, addParent, addPerson, addSpouse, addUnion, apply, deleteDescent, deletePerson, deleteUnion, History,
         addNote, deleteNote, newId, setField, setText, setAdjustment, clearAdjustment, findAdjustment, nudge, below, treeChildren } from "../src/index.ts";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const read = (chart: string): ChartDoc => JSON.parse(readFileSync(`${ROOT}charts/${chart}/chart.json`, "utf8"));
const text = (d: unknown) => JSON.stringify(d, null, 2) + "\n";
const errors = (d: ChartDoc) => validate(d).errors.map(format);

test("a patch's inverse gives the document back byte for byte, key order included", () => {
  const doc = read("tokugawa") as any, before = text(doc);
  const undo = apply(doc, [
    { op: "set", path: ["people", "ieyasu", "name"], value: "Someone" },
    { op: "del", path: ["people", "hidetada", "title"] },
    { op: "set", path: ["people", "new_one"], value: { name: "x", show: { box: "minor" } } },
    { op: "set", path: ["ext", "a", "b"], value: 1 },                  // objects made on the way
    { op: "del", path: ["timeline", "eras", 0] },                      // an array item
    { op: "del", path: ["people", "ieyasu"] },
  ]);
  assert.notEqual(text(doc), before);
  apply(doc, undo);
  assert.equal(text(doc), before);
});

for (const chart of ["wangsa-mataram", "tokugawa"]) {
  test(`${chart}: deleting any one person leaves a valid document, and undo restores it exactly`, () => {
    const doc = read(chart), before = text(doc);
    for (const id of Object.keys(doc.people)) {
      const op = deletePerson(doc, id);
      const undo = apply(doc as any, op.patch);
      // what the schema check refuses, by reference: nothing may still name the person
      const named = errors(doc).filter(e => e.includes(`"${id}"`) || e.includes(` ${id}`));
      assert.deepEqual(named, [], `after deleting ${id}`);
      // and nothing else breaks, except children left with no parents (the tree's one root): the editor says so
      const left = errors(doc).filter(e => !/the tree needs one root/.test(e));
      assert.deepEqual(left, [], `after deleting ${id}`);
      if (errors(doc).length) assert.ok(op.notes?.some(n => n.includes("left with no parents")), `deleting ${id} warns of orphans`);
      apply(doc as any, undo);
      assert.equal(text(doc), before, `undo of deleting ${id}`);
    }
  });
}

test("adding a child, a spouse and a parent gives a valid document", () => {
  const doc = read("tokugawa") as any;
  for (const op of [addChild(doc, "ieyasu", { name: "Tokugawa Test" }), addSpouse(doc, "hidetada", { name: "Lady Test" }, "l")]) {
    apply(doc, op.patch);
    assert.ok(doc.people[op.id!], op.label);
  }
  const orphan = addPerson(doc, { name: "Root Test", box: "minor", year: 1500 });
  apply(doc, orphan.patch);
  apply(doc, addParent(doc, orphan.id!, { name: "Root Parent" }).patch);
  // the new root's parent is a second root: the tree check says so, the schema is otherwise happy
  assert.deepEqual(errors(doc).filter(e => !/root|tree|connected/i.test(e)), []);
  assert.equal(doc.people.lady_test.show.beside.of, "hidetada");
  assert.deepEqual(Object.values(doc.unions).at(-1), { partners: ["lady_test", "hidetada"], kind: "marriage" });
});

test("ids are readable, unique, and valid", () => {
  const doc = read("tokugawa");
  assert.equal(newId(doc, "Tokugawa Ieyasu"), "tokugawa_ieyasu");
  assert.equal(newId(doc, "Ieyasu"), "ieyasu_2");
  assert.equal(newId(doc, "Ōkubo Tadataka"), "okubo_tadataka");
  assert.equal(newId(doc, "1st son"), "p_1st_son");
  assert.match(newId(doc, "!!!"), /^[a-z][a-z0-9_]*$/);
});

test("a union and its children's lines; deleting lines takes their adjustments", () => {
  const doc = read("wangsa-mataram") as any;
  const withAdj = Object.entries(doc.adjustments).find(([, a]: any) => a.target in doc.descents)!;
  const target = (withAdj[1] as any).target;
  apply(doc, deleteDescent(doc, target).patch);
  assert.ok(!doc.descents[target] && !doc.adjustments[withAdj[0]]);
  const uid = Object.keys(doc.unions).find(u => Object.values(doc.descents).some((d: any) => d.union === u))!;
  apply(doc, deleteUnion(doc, uid).patch);
  assert.ok(!Object.values(doc.descents).some((d: any) => d.union === uid));
  assert.deepEqual(errors(doc).filter(e => e.includes(uid)), []);
  const u = addUnion(doc, "hb1", "pb1");
  assert.equal(u.id, "u_hb1_pb1");
});

test("text in another language keeps the default language's", () => {
  const doc = read("tokugawa") as any;
  apply(doc, setText(doc, ["people", "ieyasu", "name"], "徳川家康", "ja").patch);
  assert.deepEqual(doc.people.ieyasu.name, { en: "Tokugawa Ieyasu", ja: "徳川家康" });
  apply(doc, setText(doc, ["people", "ieyasu", "name"], "Ieyasu", "en").patch);
  assert.deepEqual(doc.people.ieyasu.name, { en: "Ieyasu", ja: "徳川家康" });
});

test("history: undo, redo, one step per gesture, typing merges, unsaved changes", () => {
  const doc = read("tokugawa"), before = text(doc), h = new History(doc);
  assert.equal(h.dirty, false);
  for (const name of ["I", "Ie", "Iey"]) h.run(setField(["people", "ieyasu", "name"], name, "Rename"), "name:ieyasu");
  assert.equal(h.undoLabel, "Rename");
  h.begin("Move");
  h.run(setField(["people", "ieyasu", "show", "year"], 1600));
  h.run(setField(["people", "ieyasu", "show", "year"], 1601));
  h.end();
  assert.equal(h.dirty, true);
  h.undo();
  assert.equal(doc.people.ieyasu.show.year, read("tokugawa").people.ieyasu.show.year);
  h.undo();
  assert.equal(text(doc), before, "the three keystrokes were one step");
  assert.equal(h.dirty, false);
  h.redo(); h.redo();
  assert.equal(doc.people.ieyasu.show.year, 1601);
  h.markSaved();
  assert.equal(h.dirty, false);
  h.undo(); assert.equal(h.dirty, true);
  h.run(setField(["meta", "title"], "Other"));             // the saved state can no longer be reached
  assert.equal(h.dirty, true);
  h.begin("Drag"); h.run(setField(["people", "hidetada", "show", "year"], 1700)); h.cancel();
  assert.equal(doc.people.hidetada.show.year, read("tokugawa").people.hidetada.show.year);
});

test("adjustments: ids as the documents write them, nudges add up, moving a card alone", () => {
  const doc = read("tokugawa") as any;
  const run = (op: { patch: any }) => apply(doc, op.patch);
  const share = setAdjustment(doc, "shareBus", "d_ieyasu_hidetada", {}, "test");
  run(share);
  assert.equal(share.id, "share_bus_d_ieyasu_hidetada");
  run(nudge(doc, "yorinobu", 40, "room"));
  run(nudge(doc, "yorinobu", -15));
  assert.deepEqual(doc.adjustments.nudge_yorinobu, { kind: "nudge", target: "yorinobu", dx: 25, reason: "room" });
  run(nudge(doc, "yorinobu", -25));
  assert.equal(doc.adjustments.nudge_yorinobu, undefined, "a nudge back to 0 goes");
  run(clearAdjustment(doc, "shareBus", "d_ieyasu_hidetada"));
  assert.equal(findAdjustment(doc, "shareBus", "d_ieyasu_hidetada"), null);
  assert.deepEqual(errors(doc), []);
  assert.ok(below(doc, "yorinobu").includes("yoshimune") && !below(doc, "yorinobu").includes("yorinobu"));
  assert.ok(treeChildren(doc, "yorinobu").length >= 1);
});

test("emptying a text field: an optional one goes in that language only; a required one or a list item stays", () => {
  const doc = read("tokugawa") as any;
  doc.meta.subtitle = { en: "Sub", "ja-Jpan": "副" };
  doc.panels.caveats = ["A", "B"];
  apply(doc, setText(doc, ["meta", "subtitle"], "", "en").patch);
  assert.deepEqual(doc.meta.subtitle, { "ja-Jpan": "副" });
  apply(doc, setText(doc, ["meta", "subtitle"], "", "ja-Jpan").patch);
  assert.equal(doc.meta.subtitle, undefined);
  doc.meta.subtitle = "Plain";
  apply(doc, setText(doc, ["meta", "subtitle"], "", "ja-Jpan").patch);
  assert.equal(doc.meta.subtitle, "Plain");
  doc.meta.subtitle = { en: "Sub", "ja-Jpan": "副" };
  apply(doc, setText(doc, ["meta", "subtitle"], "", "ja-Jpan").patch);
  assert.equal(doc.meta.subtitle, "Sub");
  apply(doc, setText(doc, ["panels", "caveats", 0], "").patch);
  assert.deepEqual(doc.panels.caveats, ["", "B"]);
  apply(doc, setText(doc, ["meta", "title"], "", "en", undefined, true).patch);
  assert.equal(doc.meta.title.en, "");
});

test("a save marks the document as it was when the save started: what is typed meanwhile stays unsaved", () => {
  const h = new History<any>({ a: "" });
  h.run({ label: "type", patch: [{ op: "set", path: ["a"], value: "x" }] }, "a");
  const at = h.seal();                                      // the save starts: "x" is written
  h.run({ label: "type", patch: [{ op: "set", path: ["a"], value: "xy" }] }, "a");    // typed during the write
  h.markSaved(at);
  assert.equal(h.dirty, true);
  h.undo();
  assert.equal(h.doc.a, "x");
  assert.equal(h.dirty, false);
});

test("diff: the patch from one version to another gives the second byte for byte, and its inverse the first", async () => {
  const { diff } = await import("../src/index.ts");
  const a = read("tokugawa") as any, b = structuredClone(a);
  b.people.ieyasu.bio = "changed";
  delete b.people.hidetada.title;
  b.people.newcomer = { name: "New", show: { box: "minor" } };
  b.timeline.eras.push({ year: 1900, name: "x" });
  b.notes = { first: { anchor: "ieyasu", text: "t", show: { side: "r", width: 100 } }, ...b.notes };    // a key put first
  const state = { doc: a }, before = text(a);
  const undo = apply(state as any, diff({ doc: a }, { doc: b }));
  assert.equal(text(state.doc), text(b));
  apply(state as any, undo);
  assert.equal(text(state.doc), before);
  assert.deepEqual(diff(a, structuredClone(a)), []);
});

test("a patch cannot reach Object.prototype", () => {
  const doc = { people: {} } as Record<string, unknown>;
  for (const path of [["__proto__", "x"], ["people", "constructor", "x"], ["people", "prototype"]])
    assert.throws(() => apply(doc, [{ op: "set", path, value: 1 }]), /not a field/);
  assert.equal(({} as Record<string, unknown>).x, undefined);
});

test("a note: added 240 px wide on the right, valid and without warnings; deleted with where it was moved to", () => {
  const orig = read("tokugawa"), doc = structuredClone(orig);
  const add = addNote(doc, "ieyasu", { text: "Founded the shogunate in 1603.", inline: true });
  assert.equal(add.id, "n_ieyasu_2");                     // he has one note already
  const u1 = apply(doc as any, add.patch);
  assert.deepEqual(doc.notes!.n_ieyasu_2, { anchor: "ieyasu", text: "Founded the shogunate in 1603.", show: { side: "r", width: 240, inline: true } });
  assert.deepEqual(errors(doc), []);
  assert.deepEqual(validate(doc).warnings.filter(w => w.at.startsWith("notes.n_ieyasu_2")), []);
  const u2 = apply(doc as any, setAdjustment(doc, "noteOffset", "n_ieyasu_2", { dx: 40 }, "clear of her card").patch);
  const u3 = apply(doc as any, deleteNote(doc, "n_ieyasu_2").patch);
  assert.equal(doc.notes!.n_ieyasu_2, undefined);
  assert.equal(findAdjustment(doc, "noteOffset", "n_ieyasu_2"), null);
  for (const u of [u3, u2, u1]) apply(doc as any, u);
  assert.deepEqual(doc, orig);
});

test("a set into a list that is not there yet makes a list, at any depth; undo removes what it made", () => {
  const doc: any = { panels: {} };
  const was = JSON.stringify(doc);
  const u1 = apply(doc, [{ op: "set", path: ["panels", "caveats", 0], value: "a" }]);
  assert.deepEqual(doc.panels.caveats, ["a"]);
  const u2 = apply(doc, [{ op: "set", path: ["timeline", "eras", 0], value: { year: 1600, name: "x" } }]);
  assert.ok(Array.isArray(doc.timeline.eras));
  apply(doc, u2); apply(doc, u1);
  assert.equal(JSON.stringify(doc), was);
});

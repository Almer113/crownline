import { test, after } from "node:test";
import assert from "node:assert/strict";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Value } from "@sinclair/typebox/value";
import { applyOps, build, check, Conflict, describe, diff, find, open, readPerson, ROOT, undo, UserError } from "../src/api.ts";
import { OPS } from "../src/registry.ts";
import { guide } from "../src/guide.ts";

// a copy of Tokugawa (with its lock) in charts/, removed afterwards: the real charts are never written
const ID = `_test_${process.pid}`, DIR = join(ROOT, "charts", ID);
cpSync(join(ROOT, "charts", "tokugawa", "chart.json"), join(DIR, "chart.json"));
cpSync(join(ROOT, "charts", "tokugawa", "layout.lock.json"), join(DIR, "layout.lock.json"));
after(() => rmSync(DIR, { recursive: true, force: true }));
const files = () => [readFileSync(join(DIR, "chart.json"), "utf8"), readFileSync(join(DIR, "layout.lock.json"), "utf8")];

test("every operation's example passes its own schema, and the guide names every operation", () => {
  for (const s of OPS) assert.ok(Value.Check(s.input, s.example), `${s.name}: ${[...Value.Errors(s.input, s.example)].map(e => e.message)}`);
  const g = guide();
  for (const s of OPS) assert.ok(g.includes(`**${s.name}**`), s.name);
});

test("the guide in docs and the skill is the one the registry makes (npm run guide)", () => {
  for (const f of ["docs/AI_GUIDE.md", ".claude/skills/crownline/SKILL.md"])
    assert.ok(readFileSync(join(ROOT, f), "utf8").includes(guide()), `${f} is out of date: run npm run guide`);
});

test("reading: describe, find, read, check", () => {
  const o = open(ID);
  const d = describe(o);
  assert.equal(d.counts.people, 52);
  assert.equal(d.kept_layout, true);
  assert.deepEqual(d.check, { errors: 0, warnings: 0, accepted: 0 });
  assert.equal(find(o, { query: "ieyasu" }).people[0].id, "ieyasu");
  assert.ok(readPerson(o, "ieyasu").children.length > 5);
  assert.equal(check(o).ok, true);
  assert.throws(() => open("../package.json"), UserError);
});

test("a batch that adds a layout error is not saved; a dry run never is", () => {
  const before = files(), o = open(ID);
  const r = applyOps(o, { reason: "test", ops: [{ op: "add_child", parent: "hidetada", name: "Test Child", year: 1640 }] });
  assert.equal(r.saved, false);
  assert.ok((r.check as { new_errors: string[] }).new_errors.length > 0);
  const dry = applyOps(o, { reason: "test", dry_run: true, ops: [{ op: "set_text", path: "people.ieyasu.bio", text: "x" }] });
  assert.equal(dry.saved, false);
  assert.deepEqual(files(), before);
});

test("mistakes come back as messages that say what to do", () => {
  const o = open(ID);
  assert.throws(() => applyOps(o, { reason: "t", ops: [{ op: "fly" }] }), /unknown op "fly"; the ops are/);
  assert.throws(() => applyOps(o, { reason: "t", ops: [{ op: "add_child", parent: "nobody", name: "X" }] }), /no person nobody/);
  assert.throws(() => applyOps(o, { reason: "t", ops: [{ op: "add_child", name: "X" }] }), /Example:/);
  assert.throws(() => applyOps(o, { reason: "", ops: [{ op: "remove", id: "ieyasu" }] }), /reason/);
  assert.throws(() => applyOps(o, { reason: "t", expected_hash: "000", ops: [{ op: "remove", id: "ieyasu" }] }), /changed since you read it/);
});

test("apply saves, moves only what it must, and undo gives the files back byte for byte", () => {
  const before = files(), o = open(ID);
  const r = applyOps(o, { reason: "test", expected_hash: o.hash, ops: [
    { op: "set_text", path: "people.hidetada.bio", text: "Test." },
    { op: "move_person", id: "iemitsu", dx: 40 },
  ] });
  assert.equal(r.saved, true);
  assert.notEqual(r.hash, o.hash);
  const moved = (r.moved as { id: string; dx: number }[]).map(m => m.id).sort();
  assert.deepEqual(moved, ["iemitsu", "ienobu", "ietsugu", "ietsuna", "tsunashige", "tsunayoshi"]);
  assert.equal((diff(open(ID), { from: "last" }) as { moved: unknown[] }).moved.length, 6);
  const u = undo(open(ID));
  assert.equal(u.restored, true);
  assert.deepEqual(files(), before);
  assert.throws(() => undo(open(ID)), /nothing to undo/);
  assert.ok(existsSync(join(DIR, ".crownline", "journal.json")));
});

test("an operation's defaults survive the fields left out; apply lists every id it made", () => {
  const o = open(ID);
  const r = applyOps(o, { ops: [
    { op: "add_child", parent: "ieyasu", name: "Test Child" },
    { op: "add_spouse", of: "ieyasu", name: "Test Spouse", side: "l" },
    { op: "add_note", anchor: "ieyasu", text: "A test note.", inline: true },
  ], reason: "test", dry_run: true });
  assert.equal(r.saved, false);
  assert.deepEqual(r.made, { people: ["test_child", "test_spouse"], unions: ["u_test_spouse_ieyasu"], descents: ["d_ieyasu_test_child"], notes: ["n_ieyasu_2"] });   // he has a note already
  // run again, saved this time, to read the records the defaults made
  const p = o.doc.people.ieyasu as { house?: string; show: { year: number } };
  const doc = JSON.parse(files()[0]);
  assert.equal(doc.people.test_child, undefined);           // the dry run wrote nothing
  const ok = applyOps(open(ID), { ops: [{ op: "add_child", parent: "ieyasu", name: "Test Child" }], reason: "test", allow_errors: true });
  const child = JSON.parse(files()[0]).people.test_child;
  assert.equal(child.show.year, p.show.year + 30);
  assert.equal(child.house, p.house);
  assert.ok(ok.saved);
  undo(open(ID));
  const sp = applyOps(open(ID), { ops: [{ op: "add_spouse", of: "ieyasu", name: "Test Spouse", side: "l" }], reason: "test", allow_errors: true });
  assert.equal(JSON.parse(files()[0]).people.test_spouse.show.box, "text");
  assert.ok(sp.saved);
  undo(open(ID));
});

test("the review's findings stay fixed: unsafe paths, taken ids, chosen ids, merged adjustments, where charts are", () => {
  const o = open(ID);
  // a path into Object.prototype is refused, even on a dry run, and pollutes nothing
  assert.throws(() => applyOps(o, { ops: [{ op: "set", path: "__proto__.polluted", value: "yes" }], reason: "t", dry_run: true }), UserError);
  assert.throws(() => applyOps(o, { ops: [{ op: "set", path: ["people", "constructor", "name"], value: "x" }], reason: "t", dry_run: true }), UserError);
  assert.equal(({} as Record<string, unknown>).polluted, undefined);
  assert.throws(() => readPerson(o, "constructor"), UserError);
  // a taken id is refused, never quietly replaced
  assert.throws(() => applyOps(o, { ops: [{ op: "add_person", id: "ieyasu", name: "New" }], reason: "t", dry_run: true }), /already used/);
  assert.throws(() => applyOps(o, { ops: [{ op: "add_note", id: "n_ieyasu", anchor: "ieyasu", text: "x" }], reason: "t", dry_run: true }), /already used/);
  // a chosen id names the marriage made with the person; nothing else takes it
  const r = applyOps(o, { ops: [{ op: "add_spouse", of: "ieyasu", name: "kazu", id: "kz", side: "l" }], reason: "t", dry_run: true });
  assert.deepEqual(r.made, { people: ["kz"], unions: ["u_kz_ieyasu"] });
  // a child of a marriage the parent is not in is refused, naming the parent's own
  assert.throws(() => applyOps(o, { ops: [{ op: "add_child", parent: "ieyasu", union: "u_iemochi_kazunomiya", name: "X" }], reason: "t", dry_run: true }), /ieyasu's marriages are/);
  // adjust changes the fields given and keeps the others
  const had = Object.values(o.doc.adjustments ?? {}).find(a => a.kind === "nudge" && a.target === "sadanobu") as { dx: number };
  applyOps(o, { ops: [{ op: "adjust", kind: "nudge", target: "sadanobu", dy: 10 }], reason: "t", allow_errors: true });
  const now = Object.values(JSON.parse(files()[0]).adjustments).find((a: any) => a.kind === "nudge" && a.target === "sadanobu") as { dx: number; dy: number };
  assert.equal(now.dx, had.dx);
  assert.equal(now.dy, 10);
  undo(open(ID));
  // only charts/<id>/chart.json opens
  assert.throws(() => open("packages/engine/tests/charts/family"), UserError);
});

test("a write never lands on files that changed meanwhile, and an unreadable journal stops it before writing", () => {
  const o = open(ID), before = files();
  // the editor (or another batch) changes the chart after it was read
  writeFileSync(join(DIR, "chart.json"), before[0].replace('"The Tokugawa Shoguns"', '"Changed meanwhile"'));
  assert.throws(() => applyOps(o, { ops: [{ op: "set_text", path: "people.ieyasu.bio", text: "x" }], reason: "t" }), Conflict);
  assert.ok(files()[0].includes("Changed meanwhile"));
  writeFileSync(join(DIR, "chart.json"), before[0]);
  // a journal that cannot be read: refused, and nothing written
  mkdirSync(join(DIR, ".crownline"), { recursive: true });
  writeFileSync(join(DIR, ".crownline", "journal.json"), "{ not json");
  assert.throws(() => applyOps(open(ID), { ops: [{ op: "set_text", path: "people.ieyasu.bio", text: "x" }], reason: "t" }), /cannot be read/);
  assert.deepEqual(files(), before);
  rmSync(join(DIR, ".crownline", "journal.json"));
  assert.ok(!existsSync(join(DIR, ".crownline", "writing")));
});

test("the kept layout follows a batch that passed: new people pinned, removed ones dropped, undo restores it", async () => {
  const { dumpLock } = await import("@crownline/engine");
  const start = files();
  const r = applyOps(open(ID), { ops: [{ op: "add_child", parent: "nobuyasu", name: "Pinned Child" }], reason: "t" });
  assert.ok(r.saved && !r.check.new_errors?.length);
  const lock = JSON.parse(files()[1]!);
  assert.ok(lock.boxes.pinned_child, "the new person is in the lock");
  // laid out again from the lock it kept, the chart gives back that very lock
  const o = open(ID), b = build(o, o.doc, o.lock);
  assert.equal(dumpLock(b.lock!), files()[1]);
  applyOps(open(ID), { ops: [{ op: "remove", id: "pinned_child" }], reason: "t" });
  assert.equal(JSON.parse(files()[1]!).boxes.pinned_child, undefined);
  undo(open(ID)); undo(open(ID));
  assert.deepEqual(files(), start);
});

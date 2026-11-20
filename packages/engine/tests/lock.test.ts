// Frozen mode (PLAN Phase 5; research 1.5): the layout lock. The lock of the automatic layout is the
// accepted lock (charts/<chart>/layout.lock.json, written by tests/layout_snapshot.py); a frozen layout of
// unchanged content gives back that lock and the very same page; and after an edit that would re-flow the
// automatic layout, the frozen one keeps everyone the lock holds where they were.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { compose, diffLock, dumpLock, headerPanel, lockOf, render, type Lock } from "../src/index.ts";
import { load } from "../src/node.ts";
import { format, validate } from "@crownline/schema";
import type { Doc } from "../src/doc.ts";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const plain = <T>(v: T): T => JSON.parse(JSON.stringify(v));
const lockFile = (chart: string): Lock => { const l = JSON.parse(readFileSync(`${ROOT}charts/${chart}/layout.lock.json`, "utf8")); delete l.$schema; return l; };

const build = (doc: Doc, env: ReturnType<typeof load>["env"], lock: Lock | null = null) => {
  const c = compose(doc, env, headerPanel(doc), lock), page = render(doc, env, c);
  return { c, page, lock: plain(lockOf(doc, c, page)) };
};

for (const chart of ["wangsa-mataram", "tokugawa"]) {
  const want = lockFile(chart);
  const { doc, env } = load(`charts/${chart}/chart.json`, { root: ROOT, public: false });

  test(`${chart}: the automatic layout's lock is the accepted lock, value for value`, () => {
    const got = build(doc, env).lock as any;
    for (const k of Object.keys(want)) assert.deepEqual(got[k], (want as any)[k], k);
  });

  test(`${chart}: frozen, unchanged content gives the lock back and the same page`, () => {
    const auto = build(doc, env), frozen = build(doc, env, want);
    assert.deepEqual(frozen.c.placed, []);
    assert.deepEqual(diffLock(want, frozen.lock), []);
    assert.ok(frozen.page.html === auto.page.html, "the frozen page is the automatic page");
  });
}

const tokugawa = () => {
  const { doc, env } = load("charts/tokugawa/chart.json", { root: ROOT, public: false });
  return { doc: structuredClone(doc) as Doc & Record<string, any>, env };
};

test("an adjustment re-flows the automatic layout; frozen, nobody moves", () => {
  const { doc, env } = tokugawa(), lock = lockFile("tokugawa");
  (doc.adjustments as any).nudge_test = { kind: "nudge", target: "hideyasu", dx: 400, reason: "test" };
  assert.ok(diffLock(lock, build(doc, env).lock).some(l => l.startsWith("boxes:")), "the automatic layout moves people");
  const frozen = build(doc, env, lock);
  assert.ok(!diffLock(lock, frozen.lock).some(l => l.startsWith("boxes")), diffLock(lock, frozen.lock).join("\n"));
});

test("frozen: a new person is placed by their locked parent, and nobody else moves", () => {
  const { doc, env } = tokugawa(), lock = lockFile("tokugawa");
  doc.people.newkid = { name: "Matsudaira Shinji", sex: "m", house: "matsudaira", show: { box: "minor", year: 1640, sub: "1620 – 1680" } } as any;
  doc.descents!.d_tadateru_newkid = { parent: "tadateru", child: "newkid" } as any;
  const frozen = build(doc, env, lock);
  assert.deepEqual(frozen.c.placed, ["newkid"]);
  const report = diffLock(lock, frozen.lock);
  assert.ok(report.includes("boxes added: newkid"), report.join("\n"));
  assert.ok(!report.some(l => l.startsWith("boxes:")), report.join("\n"));      // no locked box moved
  const kid = frozen.lock.boxes.newkid, parent = lock.boxes.tadateru;
  assert.ok(kid[1] > parent[3], "below its parent");
});

test("frozen: a new person who would land on a box slides clear of it; the locked boxes stay", () => {
  const { doc: d, env } = load("charts/wangsa-mataram/chart.json", { root: ROOT, public: false });
  const doc = structuredClone(d) as Doc & Record<string, any>, lock = lockFile("wangsa-mataram");
  doc.people.newkid = { name: "Pangeran Baru", house: "yogyakarta", show: { box: "minor", year: 1850, sub: "1830 – 1890" } } as any;
  doc.descents!.d_hb5_newkid = { parent: "hb5", child: "newkid" } as any;
  const frozen = build(doc, env, lock);
  assert.deepEqual(frozen.c.placed, ["newkid"]);
  assert.deepEqual(frozen.page.report.errors.filter(e => e.includes("newkid")), []);
  assert.ok(!diffLock(lock, frozen.lock).some(l => l.startsWith("boxes:")), "no locked box moved");
});

test("frozen: the canvas holds the frozen boxes, even when the automatic layout would be narrower", () => {
  const { doc, env } = tokugawa(), lock = lockFile("tokugawa");
  for (const id of ["hoshina", "tadayoshi", "ietsuna"]) delete doc.people[id];
  const gone = /"(hoshina|tadayoshi|ietsuna)"/;
  for (const sec of ["descents", "unions", "notes", "adjustments", "media"] as const)
    for (const [k, v] of Object.entries(doc[sec] ?? {})) if (gone.test(JSON.stringify(v))) delete (doc[sec] as any)[k];
  for (const sec of Object.values(doc.display ?? {}) as Record<string, unknown>[])
    for (const k of Object.keys(sec)) if (gone.test(`"${k}"`)) delete sec[k];
  for (const p of Object.values(doc.people) as any[]) if (p.portrait && !doc.media?.[p.portrait]) delete p.portrait;
  assert.deepEqual(validate(doc).errors.map(format), []);
  const frozen = build(doc, env, lock);
  const right = Math.max(...[...frozen.c.boxes.values()].map(b => b.x + b.lw / 2));
  assert.ok(right < frozen.c.canvas.W, `a box reaches ${right}, the canvas is ${frozen.c.canvas.W} wide`);
  assert.deepEqual(frozen.page.report.errors, []);
});

test("frozen: a box that grows keeps its centre, its spouses stay beside it, its lines stay straight", () => {
  const { doc, env } = tokugawa(), lock = lockFile("tokugawa");
  doc.people.ieyasu.name += " the Very Long Named";
  const frozen = build(doc, env, lock), b = (id: string) => frozen.c.boxes.get(id)!;
  assert.equal(b("ieyasu").x, lock.drops.ieyasu[0]);
  assert.deepEqual(frozen.page.report.errors.filter(e => /ieyasu \/ |\/ ieyasu|box ieyasu/.test(e)), []);
  const report = diffLock(lock, frozen.lock);
  assert.ok(!report.some(l => l.includes("d_hirotada_ieyasu")), report.join("\n"));   // no jog into the grown box
});

test("frozen: a person removed leaves a gap; nobody else moves", () => {
  const { doc, env } = tokugawa(), lock = lockFile("tokugawa");
  delete doc.people.tadateru;
  delete doc.descents!.d_ieyasu_tadateru;
  const report = diffLock(lock, build(doc, env, lock).lock);
  assert.ok(report.includes("boxes removed: tadateru"), report.join("\n"));
  assert.ok(!report.some(l => l.startsWith("boxes:")), report.join("\n"));
});

test("the lock diff names what moved, a branch moved together on one line", () => {
  const old = lockFile("tokugawa"), cur = plain(old);
  const ids = Object.keys(cur.boxes).slice(0, 5);
  for (const k of ids) cur.boxes[k] = cur.boxes[k].map((v, i) => v + (i % 2 ? 0 : 40));
  cur.boxes[ids[0]] = cur.boxes[ids[0]].map((v, i) => v + (i % 2 ? 12 : 0));
  delete cur.crowns[Object.keys(cur.crowns)[0]];
  const report = diffLock(old, cur);
  assert.equal(report[0], `boxes: 5 changed\n  4 moved together, dx +40 dy +0: ${ids.slice(1).join(", ")}\n  ${ids[0]}: dx +40.0 dy +12.0 (width +0.0, height +0.0)`);
  assert.ok(report.some(l => l.startsWith("crowns removed: ")));
  assert.deepEqual(diffLock(old, plain(old)), []);
});

test("the lock is written as the Python tool writes it, byte for byte", () => {
  for (const chart of ["wangsa-mataram", "tokugawa"]) {
    const text = readFileSync(`${ROOT}charts/${chart}/layout.lock.json`, "utf8");
    assert.ok(dumpLock(JSON.parse(text)) === text, chart);
  }
});

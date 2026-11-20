// Step 3 of the port: the document read into the engine's tables, and the family tree built from them,
// against the Python engine (tools/engine_fixtures.py). Exact. Plus the errors for a document whose people
// don't make one tree.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { buildTree, makeBoxes, readTables, TreeError } from "../src/index.ts";
import { load } from "../src/node.ts";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const FIX = fileURLToPath(new URL("./fixtures/", import.meta.url));
const obj = <V>(m: Map<string, V>) => Object.fromEntries(m);

for (const chart of ["wangsa-mataram", "tokugawa"]) {
  const want = JSON.parse(readFileSync(`${FIX}${chart}-tree.json`, "utf8"));
  const { doc, env } = load(`charts/${chart}/chart.json`, { root: ROOT, public: true });

  test(`${chart}: the document's tables match the Python engine`, () => {
    const t = readTables(doc);
    assert.deepEqual(t.desc, want.desc);
    assert.deepEqual(t.descIds, want.desc_ids);
    assert.deepEqual(t.marr.map(m => [m.a, m.b, m.house, m.style, m.kids, m.kidStyles]), want.marr);
    assert.deepEqual(t.marrIds, want.marr_ids);
    assert.deepEqual([...t.coupleLine].map(([k, v]) => [...k.split(" "), v]), want.couple_line);
    assert.deepEqual(obj(t.nudge), want.nudge);
    assert.deepEqual(obj(t.follow), want.follow);
    assert.deepEqual(obj(t.followDx), want.follow_dx);
    assert.deepEqual(obj(t.coupleSide), want.couple_side);
    assert.deepEqual([...t.shareBus].sort(), want.share_bus);
    assert.deepEqual(obj(t.breakAt), want.break_at);
    assert.deepEqual([...t.markerTop].sort(), want.marker_top);
    assert.deepEqual(obj(t.textLift), want.text_lift);
    assert.deepEqual([...t.headerLeft].sort(), want.header_left);
    assert.deepEqual([...t.crowns], Object.entries(want.crowns), "crowns, in their order");
    assert.deepEqual(obj(t.pills), want.pills);
    assert.deepEqual(obj(t.events), want.events);
  });

  test(`${chart}: the tree matches the Python engine`, () => {
    const { boxes, ties } = makeBoxes(doc, env);
    const tr = buildTree(boxes, ties, readTables(doc));
    assert.equal(tr.root, want.root);
    assert.deepEqual(Object.fromEntries([...tr.groups].filter(([, g]) => g.length)), want.groups);
    assert.deepEqual(obj(tr.treeParent), want.tree_parent);
    assert.deepEqual([...tr.capKids].sort(), want.cap_kids);
    for (const [k, n] of Object.entries<number>(want.size)) assert.equal(tr.size(k), n, `size of ${k}`);
  });
}

test("a document whose people don't make one tree is refused, saying why", () => {
  const { doc, env } = load("charts/tokugawa/chart.json", { root: ROOT, public: true });
  const tree = (change: (d: any) => void) => {
    const d = structuredClone(doc);
    change(d);
    const { boxes, ties } = makeBoxes(d, env);
    return () => buildTree(boxes, ties, readTables(d));
  };
  const [did, d0] = Object.entries<any>(doc.descents ?? {}).find(([, d]) => d.parent && !d.show?.hop && !d.union)!;
  assert.throws(tree(d => { delete d.descents[did]; }), (e: Error) => e instanceof TreeError && /one root/.test(e.message));
  assert.throws(tree(d => { d.descents.twice = { ...d0, show: {} }; }), /is a child in two places/);
  assert.throws(tree(d => { d.adjustments.x = { kind: "nudge", target: "nobody", dx: 1, reason: "t" }; }), /unknown person: nobody/);
});

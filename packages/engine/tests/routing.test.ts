// Steps 7 and 8 of the port: the lines and their crossings, against the Python engine (tools/engine_fixtures.py). Exact: every segment's
// points, colour and style, every drop, every horizontal run, the levels that had to compromise or share.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { compose, crossings, pyRound, route } from "../src/index.ts";
import { load } from "../src/node.ts";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const FIX = fileURLToPath(new URL("./fixtures/", import.meta.url));

for (const chart of ["wangsa-mataram", "tokugawa"]) {
  const want = JSON.parse(readFileSync(`${FIX}${chart}-lines.json`, "utf8"));
  const { doc, env } = load(`charts/${chart}/chart.json`, { root: ROOT, public: true });

  test(`${chart}: the lines match the Python engine`, () => {
    const c = compose(doc, env);
    const r = route(doc, c.boxes, c.ties, c.tables, c.geometry, c.axis);
    assert.equal(r.segs.length, want.segs.length, "number of segments");
    r.segs.forEach((s, i) => assert.deepEqual({ pts: s.pts, col: s.col, style: s.style, hop: s.hop, owner: s.owner }, want.segs[i], `segment ${i}`));
    assert.deepEqual([...r.drops].map(([k, v]) => [...k.split(" "), ...v]), want.drops);
    assert.deepEqual(r.hruns, want.hruns);
    assert.deepEqual(r.fallbacks, want.fallbacks);
    assert.deepEqual([...r.shared].sort(), want.shared);
    assert.deepEqual(Object.fromEntries(r.source), want.source);
    assert.deepEqual(r.warnings, want.warnings.filter((w: string) => w.startsWith("no clean line")));
    // step 8: a gap in the line underneath at every crossing
    assert.deepEqual(crossings(r.segs, c.tables), want.patches);
  });
}

test("Python's round: halves to the even neighbour", () => {
  assert.deepEqual([0.5, 1.5, 2.5, -0.5, -1.5, 2.4999, 2.5001, 7].map(pyRound), [0, 2, 2, 0, -2, 2, 3, 7]);
});

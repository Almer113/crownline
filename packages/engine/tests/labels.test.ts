// Step 9 of the port: the labels, against the Python engine (tools/engine_fixtures.py). Exact: the break marks
// and captions as drawn, the bracket labels, where each era and episode label goes.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { compose, placeLabels, pyFixed, route } from "../src/index.ts";
import { load } from "../src/node.ts";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const FIX = fileURLToPath(new URL("./fixtures/", import.meta.url));

for (const chart of ["wangsa-mataram", "tokugawa"]) {
  const want = JSON.parse(readFileSync(`${FIX}${chart}-lines.json`, "utf8"));
  const { doc, env } = load(`charts/${chart}/chart.json`, { root: ROOT, public: true });

  test(`${chart}: the labels match the Python engine`, () => {
    const c = compose(doc, env);
    const r = route(doc, c.boxes, c.ties, c.tables, c.geometry, c.axis);
    const l = placeLabels(doc, env, c.boxes, c.tables, c.geometry, c.axis, c.rows, c.canvas, r);
    assert.deepEqual(l.marks, want.marks);
    assert.deepEqual(Object.fromEntries(l.bracketLabels), want.bracket_labels);
    assert.deepEqual([...l.epiLeft].sort(), want.epi_left);
    assert.deepEqual(Object.fromEntries(l.epiX), want.epi_x);
    const eps = (doc.timeline?.episodes ?? []).map((e: any) => l.epiLabel(e.from, e.to, e.name));
    assert.deepEqual(eps, want.epi_labels);
    assert.deepEqual([...l.eraLabels].map(([yr, v]) => [yr, ...v]), want.era_labels);
  });
}

test("numbers are written as Python writes them: an exact half goes to the even digit", () => {
  assert.deepEqual([1.25, 1.35, 2.5, 0.05, 6046.25, 6046.75, -1.25, 3].map(x => pyFixed(x, 1)),
                   ["1.2", "1.4", "2.5", "0.1", "6046.2", "6046.8", "-1.2", "3.0"]);
  assert.deepEqual([2.5, 3.5, 0.5].map(x => pyFixed(x, 0)), ["2", "4", "0"]);
});

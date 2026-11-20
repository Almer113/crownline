// The time axis fitted to the rows (step 6, its first half), against the Python engine. Exact.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { buildTree, fitAxis, makeBoxes, placeRows, readTables } from "../src/index.ts";
import { load } from "../src/node.ts";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const FIX = fileURLToPath(new URL("./fixtures/", import.meta.url));

for (const chart of ["wangsa-mataram", "tokugawa"]) {
  const want = JSON.parse(readFileSync(`${FIX}${chart}-axis.json`, "utf8"));
  const { doc, env } = load(`charts/${chart}/chart.json`, { root: ROOT, public: true });

  test(`${chart}: the fitted time axis matches the Python engine`, () => {
    const { boxes, ties } = makeBoxes(doc, env);
    const t = readTables(doc);
    const rows = placeRows(doc, boxes, ties, t, buildTree(boxes, ties, t));
    const ax = fitAxis(boxes, ties, t, rows);
    assert.deepEqual(ax.years.map(y => [y, ax.ymap.get(y)]), want.fit);
    // between and beyond the fitted years: straight lines, RATE px a year outside
    const [y0, v0] = want.fit[0], [y1, v1] = want.fit[1];
    assert.equal(ax.Y(y0), v0);
    assert.equal(ax.Y(y0 - 10), v0 - 46);
    assert.ok(Math.abs(ax.Y((y0 + y1) / 2) - (v0 + v1) / 2) < 1e-9);
  });
}

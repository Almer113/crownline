// Step 4 of the port: each person's row (cy), against the Python engine (tools/engine_fixtures.py). Exact.
// Tokugawa has display.timeOrder and a column card; Mataram has neither.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { buildTree, headerPanel, makeBoxes, placeRows, readTables } from "../src/index.ts";
import { load } from "../src/node.ts";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const FIX = fileURLToPath(new URL("./fixtures/", import.meta.url));

const run = (doc: any, env: any, header = headerPanel(doc)) => {
  const { boxes, ties } = makeBoxes(doc, env);
  const t = readTables(doc);
  const rows = placeRows(doc, boxes, ties, t, buildTree(boxes, ties, t), header);
  return { boxes, rows };
};

for (const chart of ["wangsa-mataram", "tokugawa"]) {
  const want: Record<string, number> = JSON.parse(readFileSync(`${FIX}${chart}-rows.json`, "utf8"));
  const { doc, env } = load(`charts/${chart}/chart.json`, { root: ROOT, public: true });

  test(`${chart}: every row matches the Python engine`, () => {
    const { boxes } = run(doc, env);
    assert.equal(boxes.size, Object.keys(want).length);
    for (const [k, cy] of Object.entries(want)) assert.equal(boxes.get(k)!.cy, cy, `cy of ${k}`);
  });
}

test("a top card moves every row down by its height and gap", () => {
  const { doc, env } = load("charts/wangsa-mataram/chart.json", { root: ROOT, public: true });
  const row = run(doc, env).boxes, h = headerPanel(doc);
  const topped = run(doc, env, { ...h, arrange: "top", height: 500 }).boxes;
  for (const [k, b] of row) assert.ok(Math.abs(topped.get(k)!.cy! - (b.cy! + 650)) < 1e-9, `cy of ${k}`);
});

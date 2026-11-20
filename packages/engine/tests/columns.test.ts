// Step 5 of the port: each person's x after the columns, before the canvas moves the tree, against the
// Python engine (tools/engine_fixtures.py). Exact. Plus the note helpers on the cases they exist for.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { buildTree, fitAxis, geometry, makeBoxes, nobreak, NBSP, placeColumns, placeRows, readTables } from "../src/index.ts";
import { load } from "../src/node.ts";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const FIX = fileURLToPath(new URL("./fixtures/", import.meta.url));

for (const chart of ["wangsa-mataram", "tokugawa"]) {
  const want: Record<string, number> = JSON.parse(readFileSync(`${FIX}${chart}-columns.json`, "utf8"));
  const { doc, env } = load(`charts/${chart}/chart.json`, { root: ROOT, public: true });

  test(`${chart}: every column matches the Python engine`, () => {
    const { boxes, ties } = makeBoxes(doc, env);
    const spouseDx = new Map([...ties].map(([s, p]) => [s, boxes.get(s)!.x - boxes.get(p)!.x]));
    const t = readTables(doc), tree = buildTree(boxes, ties, t);
    const rows = placeRows(doc, boxes, ties, t, tree);
    const axis = fitAxis(boxes, ties, t, rows);
    placeColumns(boxes, ties, t, tree, geometry(doc, env, boxes, t, tree, axis), spouseDx);
    const wrong = Object.entries(want).filter(([k, x]) => boxes.get(k)!.x !== x).map(([k, x]) => `${k}: ${boxes.get(k)!.x} not ${x}`);
    assert.deepEqual(wrong, []);
  });
}

test("dates, numbered titles and a note's last two words don't break", () => {
  assert.equal(nobreak("born 12 Mar 1701 in Edo"), `born 12${NBSP}Mar${NBSP}1701 in${NBSP}Edo`);
  assert.equal(nobreak("Pakubuwana IV was crowned at last", ["Pakubuwana"]), `Pakubuwana${NBSP}IV was crowned at${NBSP}last`);
  assert.equal(nobreak("Marching through the long valley"), "Marching through the long valley".replace(/ (?=valley)/, NBSP));
  assert.equal(nobreak("12 March is the day it rained hard"), `12 March is the day it rained${NBSP}hard`, "a month's short name only as a word");
  assert.equal(nobreak("May 1701"), `May${NBSP}1701`);
});

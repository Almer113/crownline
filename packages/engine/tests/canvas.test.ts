// Step 6 of the port, its second half: the tree placed on the canvas, the canvas's size, the footer, notes
// band, map panel and header card, and the time axis's end, against the Python engine. Exact. Neither chart
// has a top card, so Mataram is also laid out with one (CHART_HEADER=top,760 in Python).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { compose, headerPanel, type Composed } from "../src/index.ts";
import { load } from "../src/node.ts";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const FIX = fileURLToPath(new URL("./fixtures/", import.meta.url));
const read = (name: string) => JSON.parse(readFileSync(`${FIX}${name}`, "utf8"));

const sizes = ({ canvas: c }: Composed) => ({ W: c.W, HGT: c.HGT, FOOT_Y: c.FOOT_Y, NOTES_H: c.NOTES_H, MAP_X: c.MAP_X,
  MAP_Y: c.MAP_Y, TREE_BOTTOM: c.TREE_BOTTOM, HEADER_W: c.header.width, HEADER_H: c.header.height, NOTE_COLS: c.NOTE_COLS });
const axis = ({ axis: a }: Composed) => a.years.map(y => [y, a.ymap.get(y)]);
const pick = (o: Record<string, unknown>, drop: string[]) => Object.fromEntries(Object.entries(o).filter(([k]) => !drop.includes(k)));

for (const chart of ["wangsa-mataram", "tokugawa"]) {
  const want = read(`${chart}-canvas.json`), axisWant = read(`${chart}-axis.json`);
  const { doc, env } = load(`charts/${chart}/chart.json`, { root: ROOT, public: true });

  test(`${chart}: the canvas matches the Python engine`, () => {
    const c = compose(doc, env);
    assert.deepEqual(sizes(c), pick(want, ["x"]));
    const wrong = Object.entries<number>(want.x).filter(([k, x]) => c.boxes.get(k)!.x !== x);
    assert.deepEqual(wrong, []);
    assert.deepEqual(axis(c), axisWant.final);
  });
}

test("wangsa-mataram with a top card matches the Python engine, end to end", () => {
  const want = read("wangsa-mataram-top.json");
  const { doc, env } = load("charts/wangsa-mataram/chart.json", { root: ROOT, public: true });
  const c = compose(doc, env, { ...headerPanel(doc), arrange: "top", height: 760 });
  assert.deepEqual(sizes(c), pick(want, ["x", "years", "nodes", "errors", "warnings"]));
  const wrong = Object.entries<[number, number]>(want.nodes).filter(([k, [x, cy]]) => c.boxes.get(k)!.x !== x || c.boxes.get(k)!.cy !== cy);
  assert.deepEqual(wrong, []);
  assert.deepEqual(axis(c), want.years);
});

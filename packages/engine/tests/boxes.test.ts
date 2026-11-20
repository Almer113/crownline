// Step 2 of the port: every box the Python engine makes before the layout (tools/engine_fixtures.py):
// size, kind, house, year, portrait, and the place of spouses and side-by-side rows. Exact.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { makeBoxes } from "../src/index.ts";
import { load } from "../src/node.ts";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const FIX = fileURLToPath(new URL("./fixtures/", import.meta.url));

for (const chart of ["wangsa-mataram", "tokugawa"]) {
  test(`every box of ${chart} (public build) matches the Python engine`, () => {
    const want = JSON.parse(readFileSync(`${FIX}${chart}-boxes.json`, "utf8")) as Record<string, any>;
    const { doc, env } = load(`charts/${chart}/chart.json`, { root: ROOT, public: true });
    const { boxes } = makeBoxes(doc, env);
    assert.deepEqual([...boxes.keys()], Object.keys(want), "the same people, in document order");
    const bad: string[] = [];
    for (const [id, w] of Object.entries(want)) {
      const b = boxes.get(id)!;
      for (const k of ["kind", "house", "lw", "pw", "h", "x", "year", "pic"] as const)
        if (b[k] !== w[k]) bad.push(`${id}.${k}: ${String(b[k])} vs ${String(w[k])}`);
    }
    assert.deepEqual(bad.slice(0, 12), [], `${bad.length} differences`);
  });
}

test("a portrait file that is absent keeps its frame: the boxes do not depend on which files are present", () => {
  // the public repository has no private pictures; its charts must still draw as their locks say
  const { doc, env } = load("charts/wangsa-mataram/chart.json", { root: ROOT });
  const all = makeBoxes(doc, env).boxes;
  const none = makeBoxes(doc, { ...env, exists: () => false }).boxes;
  const bad = [...all].filter(([id, b]) => { const n = none.get(id)!; return n.lw !== b.lw || n.pw !== b.pw || n.h !== b.h; }).map(([id]) => id);
  assert.deepEqual(bad, []);
  assert.equal(none.get("ancilla")!.pic, null, "no picture is drawn for the absent file");
});

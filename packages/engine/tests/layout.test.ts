// Phase 5: the layout file for the viewer (layout.ts), against the Python engine's (layout_export.py),
// value for value. Both charts, and Mataram with a top card. Python writes 12.0 where JSON.stringify writes
// 12, so the files are compared as parsed JSON, not byte for byte.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { compose, headerPanel, layoutFile, render, span, type HeaderPanel } from "../src/index.ts";
import { load } from "../src/node.ts";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const FIX = fileURLToPath(new URL("./fixtures/", import.meta.url));

const cases: [string, string, (h: HeaderPanel) => HeaderPanel][] = [
  ["wangsa-mataram", "wangsa-mataram", h => h],
  ["tokugawa", "tokugawa", h => h],
  ["wangsa-mataram with a top card", "wangsa-mataram-top", h => ({ ...h, arrange: "top", height: 760 })],
];

for (const [label, stem, header] of cases) {
  test(`${label}: the layout file matches the Python engine's`, () => {
    const { doc, env } = load(`charts/${stem.replace(/-top$/, "")}/chart.json`, { root: ROOT, public: true });
    const c = compose(doc, env, header(headerPanel(doc)));
    const got = JSON.parse(JSON.stringify(layoutFile(doc, env, c, render(doc, env, c))));
    const want = JSON.parse(gunzipSync(readFileSync(`${FIX}${stem}-layout.json.gz`)).toString("utf8"));
    for (const k of Object.keys(want)) assert.deepEqual(got[k], want[k], k);
    assert.deepEqual(Object.keys(got), Object.keys(want));
  });
}

test("span: the years a person is shown as present", () => {
  assert.deepEqual(span(1700, "r. 1726–1749", 2025), [1700, 1749, false]);
  assert.deepEqual(span(1900, "b. 1972", 2025), [1900, 2025, false]);
  assert.deepEqual(span(1600, "b. 1601", 2025), [1600, 1701, true]);
  assert.deepEqual(span(1800, "m. 1820", 2025), [1800, 1830, true]);
  assert.deepEqual(span(1990, "since 2025", 2025), [1990, 2025, false]);
  assert.deepEqual(span(1640, "d. 1647/48", 2025), [1640, 1648, false]);
});

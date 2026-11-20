// Step 11 of the port: the page, against the Python engine's (tools/engine_fixtures.py), to the character,
// and the layout check's errors and warnings with it (the map panel too). Both charts, and Mataram with a
// top card.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { compose, headerPanel, render, type HeaderPanel } from "../src/index.ts";
import { load } from "../src/node.ts";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const FIX = fileURLToPath(new URL("./fixtures/", import.meta.url));
const json = (name: string) => JSON.parse(readFileSync(`${FIX}${name}`, "utf8"));

/** the first place two texts differ, with some context */
function firstDiff(a: string, b: string): string {
  let i = 0;
  while (i < a.length && a[i] === b[i]) i++;
  return i === a.length && i === b.length ? "" : `at ${i}:\n  got  ${JSON.stringify(a.slice(i - 80, i + 120))}\n  want ${JSON.stringify(b.slice(i - 80, i + 120))}`;
}

const cases: [string, string, string, (h: HeaderPanel) => HeaderPanel][] = [
  ["wangsa-mataram", "wangsa-mataram", "wangsa-mataram-lines.json", h => h],
  ["tokugawa", "tokugawa", "tokugawa-lines.json", h => h],
  ["wangsa-mataram with a top card", "wangsa-mataram-top", "wangsa-mataram-top.json", h => ({ ...h, arrange: "top", height: 760 })],
];

for (const [label, stem, reportFile, header] of cases) {
  const chart = stem.replace(/-top$/, "");
  const want = gunzipSync(readFileSync(`${FIX}${stem}-page.html.gz`)).toString("utf8");
  const { doc, env } = load(`charts/${chart}/chart.json`, { root: ROOT, public: true });

  test(`${label}: the page matches the Python engine's, to the character`, () => {
    const page = render(doc, env, compose(doc, env, header(headerPanel(doc))));
    assert.equal(firstDiff(page.html, want), "");
    const r = json(reportFile);
    assert.deepEqual({ errors: page.report.errors, warnings: page.report.warnings }, { errors: r.errors, warnings: r.warnings });
  });
}

test("without the private files (the public repository), the private build draws no missing picture and the same layout", () => {
  const { doc, env } = load("charts/wangsa-mataram/chart.json", { root: ROOT });
  const priv = new Set(Object.values(doc.media ?? {}).filter((m: any) => m.private).map((m: any) => env.asset(m.file)));
  const absent = { ...env, exists: (p: string) => !priv.has(p) && env.exists(p) };
  const all = render(doc, env, compose(doc, env, headerPanel(doc)));
  const some = render(doc, absent, compose(doc, absent, headerPanel(doc)));
  for (const f of priv) assert.ok(!some.html.includes(`src="${f}"`), `${f} is still drawn`);
  assert.ok(all.html.includes('src="assets/brand/fanmade-logo-brown.png"'), "with the files, the badge is drawn");
  assert.deepEqual(some.report, all.report);
});

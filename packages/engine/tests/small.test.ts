// The small per-feature charts (tests/charts/<name>/chart.json): each shows one thing (a family, a couple's
// children dropping from their marriage line, a shared line, a break mark and a caption, a second house with
// its pill, header and a cross-house line, brackets, events and an episode). Each is laid out and drawn by
// the TypeScript engine and compared with the Python engine's page, layout file and check report
// (tools/engine_fixtures.py), so a failure points at one feature.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { compose, headerPanel, layoutFile, render } from "../src/index.ts";
import { load } from "../src/node.ts";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const CHARTS = fileURLToPath(new URL("./charts/", import.meta.url));
const FIX = fileURLToPath(new URL("./fixtures/small/", import.meta.url));

function firstDiff(a: string, b: string): string {
  let i = 0;
  while (i < a.length && a[i] === b[i]) i++;
  return i === a.length && i === b.length ? "" : `at ${i}:\n  got  ${JSON.stringify(a.slice(i - 80, i + 120))}\n  want ${JSON.stringify(b.slice(i - 80, i + 120))}`;
}

for (const name of readdirSync(CHARTS)) {
  test(`small chart "${name}": page, layout file and check match the Python engine's`, () => {
    const { doc, env } = load(`${CHARTS}${name}/chart.json`, { root: ROOT, public: true });
    const c = compose(doc, env, headerPanel(doc));
    const page = render(doc, env, c);
    const want = JSON.parse(readFileSync(`${FIX}${name}-check.json`, "utf8"));
    assert.deepEqual({ errors: page.report.errors, warnings: page.report.warnings }, want);
    assert.deepEqual(page.report.errors, [], "the small charts are laid out without errors");
    assert.equal(firstDiff(page.html, readFileSync(`${FIX}${name}.html`, "utf8")), "");
    assert.deepEqual(JSON.parse(JSON.stringify(layoutFile(doc, env, c, page))), JSON.parse(readFileSync(`${FIX}${name}.layout.json`, "utf8")));
  });
}

// found by the stress test of made-up charts (Python gives the same)
test("an event on the root, who has no line into them: left out with a warning, not a crash", () => {
  const { doc: d, env } = load(`${CHARTS}family/chart.json`, { root: ROOT, public: true });
  const doc = structuredClone(d) as any;
  doc.display = { ...doc.display, events: { king: "founded the house" } };
  const page = render(doc, env, compose(doc, env, headerPanel(doc)));
  assert.ok(page.report.warnings.includes('no line comes down into king, so its event "founded the house" is left out'));
  assert.ok(page.report.issues.some(i => i.code === "label-left-out" && i.people[0] === "king"));
});

test("a dotless ı before m. is a letter, as in Python: 'Hanım. 1700 – 1750' is a span, not a marriage", () => {
  const { doc: d, env } = load(`${CHARTS}family/chart.json`, { root: ROOT, public: true });
  const doc = structuredClone(d) as any;
  doc.people.sister.show.sub = "Hanım. 1700 – 1750";
  const c = compose(doc, env, headerPanel(doc)), lay = layoutFile(doc, env, c, render(doc, env, c)) as any;
  assert.deepEqual([lay.people.sister.span, lay.people.sister.spanGuess], [[1700, 1750], false]);
});

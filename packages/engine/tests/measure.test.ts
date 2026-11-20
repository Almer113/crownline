// Step 1 of the port: every width the Python engine measured for the two charts (tools/engine_fixtures.py)
// must come out the same here. Same font tables, same arithmetic in the same order, so "the same" means
// equal to the last bit; the plan's tolerance is 0.001 px.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Measure } from "../src/index.ts";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const FIX = fileURLToPath(new URL("./fixtures/", import.meta.url));
const fonts = new Map<string, Measure>();
const font = (rel: string) => {
  let m = fonts.get(rel);
  if (!m) { m = new Measure(readFileSync(ROOT + rel), rel.split("/").pop()); fonts.set(rel, m); }
  return m;
};

for (const file of readdirSync(FIX).filter(f => f.endsWith("-measure.json"))) {
  test(`every width the Python engine measured for ${file.replace("-measure.json", "")}`, () => {
    const rows = JSON.parse(readFileSync(FIX + file, "utf8")) as [string, string, number, number][];
    assert.ok(rows.length > 20, "the fixture should hold the chart's widths");
    let worst = 0, exact = 0;
    const bad: string[] = [];
    for (const [rel, text, size, want] of rows) {
      const got = font(rel).width(text, size), d = Math.abs(got - want);
      worst = Math.max(worst, d);
      if (d === 0) exact++;
      if (d > 0.001) bad.push(`${rel.split("/").pop()} ${size}px ${JSON.stringify(text)}: ${got} vs ${want}`);
    }
    assert.deepEqual(bad.slice(0, 10), [], `${bad.length} of ${rows.length} differ by more than 0.001 px`);
    assert.equal(exact, rows.length, `worst difference ${worst} px`);
  });
}

test("kerning: both of Gantari's kern lookups add up (SULTAN is narrower than its letters)", () => {
  const m = font("assets/fonts/open/Gantari-Bold.ttf");
  const letters = [..."SULTAN"].reduce((a, c) => a + m.width(c, 20), 0);
  assert.ok(m.width("SULTAN", 20) < letters - 2, `${m.width("SULTAN", 20)} vs ${letters}`);
});

test("a character the font lacks is an error, naming it", () => {
  assert.throws(() => font("assets/fonts/open/Gantari-Regular.ttf").width("Ṣāliḥ", 16), /no glyph for .*Ṣ.*ḥ/);
});

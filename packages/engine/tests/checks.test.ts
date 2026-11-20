// Step 10 of the port: the layout checks, against the Python engine (tools/engine_fixtures.py), and on a
// layout broken on purpose. The historicity scale's label rects come from the drawing: the Python ones
// are used here, and tests/render.test.ts checks the whole report with the port's own.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { check, compose, placeLabels, route } from "../src/index.ts";
import { load } from "../src/node.ts";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const FIX = fileURLToPath(new URL("./fixtures/", import.meta.url));

const run = (chart: string, breakIt?: (c: ReturnType<typeof compose>) => void) => {
  const want = JSON.parse(readFileSync(`${FIX}${chart}-lines.json`, "utf8"));
  const { doc, env } = load(`charts/${chart}/chart.json`, { root: ROOT, public: true });
  const c = compose(doc, env);
  breakIt?.(c);
  const r = route(doc, c.boxes, c.ties, c.tables, c.geometry, c.axis);
  const l = placeLabels(doc, env, c.boxes, c.tables, c.geometry, c.axis, c.rows, c.canvas, r);
  return { want, report: check(doc, c.boxes, c.tables, c.geometry, c.axis, c.canvas, r, l, want.hist, r.warnings) };
};

for (const chart of ["wangsa-mataram", "tokugawa"]) {
  test(`${chart}: the checks match the Python engine`, () => {
    const { want, report } = run(chart);
    assert.deepEqual({ errors: report.errors, warnings: report.warnings }, { errors: want.errors, warnings: want.warnings });
  });
}

test("a box moved onto another is reported", () => {
  const { report } = run("tokugawa", c => {
    const a = c.boxes.get("iemitsu")!, b = c.boxes.get("ietsuna")!;
    b.x = a.x + 30; b.cy = a.cy;
  });
  assert.ok(report.errors.some(e => /^boxes overlap: (iemitsu \/ ietsuna|ietsuna \/ iemitsu)$/.test(e)), report.errors.join("\n"));
});

test("each error and warning is also an issue: a code, who is involved, and where", () => {
  const { report } = run("tokugawa", c => {
    const a = c.boxes.get("iemitsu")!, b = c.boxes.get("ietsuna")!;
    b.x = a.x + 30; b.cy = a.cy;
  });
  assert.deepEqual(report.issues.filter(x => x.severity === "error").map(x => x.message), report.errors);
  assert.deepEqual(report.issues.filter(x => x.severity === "warning").map(x => x.message), report.warnings);
  const o = report.issues.find(x => x.code === "boxes-overlap")!;
  assert.deepEqual([...o.people].sort(), ["iemitsu", "ietsuna"]);
  const [x0, y0, x1, y1] = o.box!;
  assert.ok(x0 < x1 && y0 < y1, "the overlap is a real area");
  for (const x of report.issues) {
    assert.ok(x.box === null || (x.box[0] <= x.box[2] && x.box[1] <= x.box[3]), `${x.code}: box ${x.box}`);
    assert.ok(x.people.length + x.lines.length + x.blocks.length > 0, `${x.code}: names no one`);
  }
});

test("Mataram's two warnings name their lines and where they run", () => {
  const { report } = run("wangsa-mataram");
  assert.deepEqual(report.issues.map(x => [x.severity, x.code, x.lines]), [
    ["warning", "no-clear-level", ["d_purbaya_p_hemas_pb2"]],
    ["warning", "no-clear-level", ["u_hb4_ratuibu"]],
  ]);
  assert.ok(report.issues.every(x => x.box && x.box[2] > x.box[0]));
});

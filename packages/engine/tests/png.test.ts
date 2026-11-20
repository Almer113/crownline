// The build's PNG codec (png.ts) and tiling (print.ts): what is written reads back the same, every row
// filter is undone, and the tiles cover the page as render.py's do.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readPng, writePng, type Rgb } from "../src/png.ts";
import { splits, TILE } from "../src/print.ts";

test("a PNG written in bands reads back pixel for pixel", async () => {
  const w = 97, h = 61, data = Buffer.alloc(w * h * 3);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {       // flat areas, gradients and noise: every filter gets used
    const o = (y * w + x) * 3;
    data[o] = x < 40 ? 240 : (x * 7 + y) & 255; data[o + 1] = y * 4; data[o + 2] = (x * y * 2654435761) >>> 24;
  }
  const dir = mkdtempSync(join(tmpdir(), "png-"));
  try {
    const f = await writePng(join(dir, "a.png"), w, h);
    for (const [y0, y1] of [[0, 20], [20, 21], [21, 61]])
      await f.band({ width: w, height: y1 - y0, data: data.subarray(y0 * w * 3, y1 * w * 3) } as Rgb);
    await f.end();
    const back = readPng(readFileSync(join(dir, "a.png")));
    assert.equal(back.width, w); assert.equal(back.height, h);
    assert.ok(back.data.equals(data));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a band of the wrong width, or too few rows, is refused", async () => {
  const dir = mkdtempSync(join(tmpdir(), "png-"));
  try {
    const f = await writePng(join(dir, "b.png"), 4, 2);
    await assert.rejects(f.band({ width: 3, height: 1, data: Buffer.alloc(9) }), /3 px wide/);
    await f.band({ width: 4, height: 1, data: Buffer.alloc(12) });
    await assert.rejects(f.end(), /1 rows written, 2 expected/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("tiles: equal, no larger than TILE, edges rounded as Python rounds", () => {
  assert.deepEqual(splits(9169), [[0, 2292], [2292, 4584], [4584, 6877], [6877, 9169]]);   // 4584.5 rounds to even
  assert.deepEqual(splits(TILE), [[0, TILE]]);
  for (const n of [1, 2399, 2401, 4012, 8736]) {
    const s = splits(n);
    assert.equal(s[0][0], 0); assert.equal(s.at(-1)![1], n);
    assert.ok(s.every(([a, b], i) => b - a <= TILE && (i === 0 || s[i - 1][1] === a)));
  }
});

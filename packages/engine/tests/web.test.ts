// The browser editor's environment (web.ts): files handed over instead of read from disk. The page must be
// the one the command line makes, byte for byte.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { compose, dataFiles, fontChoice, headerPanel, plainPath, render, webEnv } from "../src/index.ts";
import { load } from "../src/node.ts";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));

test("paths are made plain as the Python engine makes them", () => {
  assert.equal(plainPath("charts/x/../../assets/a.jpg"), "assets/a.jpg");
  assert.equal(plainPath("./a//b/./c"), "a/b/c");
  assert.equal(plainPath("../a"), "../a");
});

for (const chart of ["wangsa-mataram", "tokugawa"]) for (const pub of [true, false]) {
  test(`${chart}${pub ? " (public)" : ""}: the browser environment gives the command line's page`, () => {
    const path = `charts/${chart}/chart.json`;
    const node = load(path, { root: ROOT, public: pub });
    const doc = JSON.parse(readFileSync(ROOT + path, "utf8"));
    const c = fontChoice(doc, pub), fonts = new Map<string, Uint8Array>();
    for (const f of [c.regular, c.bold, c.script, c.secondScript]) if (f) fonts.set(f, readFileSync(ROOT + f));
    const json = new Map(dataFiles(doc, path).map(f => [f, JSON.parse(readFileSync(ROOT + f, "utf8"))]));
    const env = webEnv(doc, path, { font: f => fonts.get(f)!, exists: f => existsSync(ROOT + f), json: f => json.get(f) }, pub);
    const a = render(doc, env, compose(doc, env, headerPanel(doc))).html;
    const b = render(node.doc, node.env, compose(node.doc, node.env, headerPanel(node.doc))).html;
    assert.ok(a === b, "the same page");
  });
}

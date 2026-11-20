#!/usr/bin/env node
// crownline-check: the chart document's tools.
//   check [chart.json …]      schema, then references and tree rules; exit 1 on any error (default: every charts/*/chart.json)
//                              (also checks layout.lock.json beside each document, if there is one,
//                              against its schema and against the document)
//   emit                       write chart.schema.json and lock.schema.json (for editors and other tools), and docs/FORMAT.md
//   migrate <chart.json>       bring a document up to the current format, in place (checked before writing)
import { readFileSync, writeFileSync, existsSync, renameSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Chart, FORMAT, type ChartDoc } from "./chart.ts";
import { Lock } from "./lock.ts";
import { reference } from "./reference.ts";
import { validate, validateLock, format } from "./validate.ts";
import { migrate, FormatError, type Doc } from "./migrate.ts";

const PKG = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REPO = resolve(PKG, "..", "..");
const DEFAULT = join(REPO, "charts", "wangsa-mataram", "chart.json");
/** every chart in the repository: charts/<id>/chart.json */
const ALL = () => readdirSync(join(REPO, "charts")).map(d => join(REPO, "charts", d, "chart.json")).filter(p => existsSync(p));

/** read a JSON file; on failure, a one-line reason instead of a stack trace */
function read(path: string): { ok: true; value: unknown; text: string } | { ok: false; why: string } {
  let text: string;
  try { text = readFileSync(path, "utf8"); } catch (e) { return { ok: false, why: `cannot read: ${(e as Error).message}` }; }
  try { return { ok: true, value: JSON.parse(text), text }; } catch (e) { return { ok: false, why: `not valid JSON: ${(e as Error).message}` }; }
}

/** the file's own indent (so a rewrite changes only what changed) */
const indentOf = (text: string) => /\n( +|\t)"/.exec(text)?.[1] ?? "  ";

function checkOne(path: string): boolean {
  const r0 = read(path);
  if (!r0.ok) { console.log(`${path}: ${r0.why}`); return false; }
  const doc = r0.value;
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) { console.log(`${path}: not a chart document (a JSON object)`); return false; }
  const f = (doc as { format?: unknown }).format;
  if (f !== FORMAT) { console.log(`${path}: format ${JSON.stringify(f)}; run "migrate" first (current format ${FORMAT})`); return false; }
  const r = validate(doc);
  for (const p of [...r.errors, ...r.warnings]) console.log(format(p));
  let ok = r.ok, lockNote = "";
  const lockPath = join(dirname(path), "layout.lock.json");
  if (existsSync(lockPath)) {
    const l0 = read(lockPath);
    if (!l0.ok) { console.log(`error  layout.lock.json: ${l0.why}`); ok = false; }
    else {
      const l = validateLock(l0.value, r.ok ? doc as ChartDoc : undefined);
      for (const p of [...l.errors, ...l.warnings]) console.log(format({ ...p, at: `layout.lock.json ${p.at}` }));
      ok &&= l.ok;
      lockNote = `; lock: ${l.errors.length} errors, ${l.warnings.length} warnings`;
    }
  }
  console.log(`${path}: ${r.errors.length} errors, ${r.warnings.length} warnings${lockNote}`);
  return ok;
}

const [cmd = "check", ...args] = process.argv.slice(2);
// paths are relative to where the command was typed (npm runs workspace scripts in the package folder; INIT_CWD is the original)
const HERE = process.env.INIT_CWD ?? process.cwd();
if (cmd === "check") {
  const ok = (args.length ? args.map(p => resolve(HERE, p)) : ALL()).map(p => checkOne(p)).every(Boolean);
  process.exit(ok ? 0 : 1);
} else if (cmd === "emit") {
  for (const [name, schema] of [["chart.schema.json", Chart], ["lock.schema.json", Lock]] as const) {
    const out = { $schema: "https://json-schema.org/draft/2020-12/schema", ...schema };
    writeFileSync(join(PKG, name), JSON.stringify(out, null, 1) + "\n");
    console.log(`wrote ${join(PKG, name)}`);
  }
  writeFileSync(join(REPO, "docs", "FORMAT.md"), reference());
  console.log(`wrote ${join(REPO, "docs", "FORMAT.md")}`);
} else if (cmd === "migrate") {
  const path = resolve(HERE, args[0] ?? DEFAULT);
  const r0 = read(path);
  if (!r0.ok) { console.log(`${path}: ${r0.why}`); process.exit(1); }
  try {
    const { doc, steps } = migrate(r0.value as Doc);
    if (!steps.length) { console.log(`${path}: already format ${FORMAT}`); process.exit(0); }
    const r = validate(doc);
    if (!r.ok) {
      for (const p of r.errors) console.log(format(p));
      console.log(`${path}: migrated (${steps.join(", ")}) but the result has ${r.errors.length} errors; the file was not changed`);
      process.exit(1);
    }
    const tmp = path + ".migrating";                     // write beside, then swap: never a half-written file
    writeFileSync(tmp, JSON.stringify(doc, null, indentOf(r0.text)) + "\n");
    renameSync(tmp, path);
    console.log(`${path}: migrated ${steps.join(", ")}`);
  } catch (e) {
    if (e instanceof FormatError) { console.log(`${path}: ${e.message}`); process.exit(1); }
    throw e;
  }
} else {
  console.log("usage: crownline-check [check [chart.json …] | emit | migrate <chart.json>]");
  process.exit(2);
}

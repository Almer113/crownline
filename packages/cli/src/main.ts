// The crownline command line (PLAN Phase 8.1): every command takes a chart (its id, folder or chart.json) and
// prints readable text, or JSON with --json. Exit codes: 0 done, 1 the chart has errors or the change was not
// saved, 2 a mistake in the command. `crownline mcp` starts the AI tool server on stdio (mcp.ts).
import { readFileSync } from "node:fs";
import {
  applyOps, check, Conflict, describe, diff, find, history, listCharts, open, opsList, readPerson, renderRegion, undo, UserError,
} from "./api.ts";
import { guide } from "./guide.ts";

const HELP = `crownline <command> [chart] [options]        (npm run crownline -- <command> …)

  charts                                   the charts in charts/
  describe <chart>                         title, counts, houses, eras, the check's totals, the hash
  find <chart> <words…> [--house H] [--year Y] [--limit N]
  read <chart> <person> [--depth 1-3]      a person: facts, parents, marriages, children, notes, adjustments, box
  check <chart> [--ids a,b] [--errors]     the layout check (exit 1 on errors)
  apply <chart> <file.json|-> --reason "…" [--dry-run] [--allow-errors] [--expect HASH]
                                           operations (a JSON list, or {"ops": […]}) as one batch: all or nothing
  ops [op]                                 the operations, with an example each (and the schema of one)
  render <chart> [--around a,b] [--margin PX] [--box x,y,w,h] [--scale S] [--highlight a,b] [--no-issues] [--name N]
         [--ops file.json]                 a region as a PNG (in <chart>/.crownline/renders/); prints its path;
                                           --ops: with a batch drawn in, not saved
  diff <chart> [--from HEAD|<git ref>|last]
                                           what moved since then (last: before the last applied batch)
  history <chart>                          the batches applied with these tools
  undo <chart>                             undo the last batch
  build [chart.json] [flags]               the page, layout file and images (as npm run build:chart)
  guide                                    the guide for AI models (the style, the working loop, the operations)
  mcp                                      the MCP server on stdio, for AI tools

  --json                                   JSON output, for scripts`;

/** values as indented text: what a person (or a model on the command line) reads */
export function text(v: unknown, indent = ""): string {
  if (v === null || v === undefined) return `${indent}-`;
  if (typeof v !== "object") return `${indent}${String(v)}`;
  if (Array.isArray(v)) {
    if (!v.length) return `${indent}(none)`;
    if (v.every(x => typeof x !== "object" || x === null)) return `${indent}${v.join(", ")}`;
    return v.map(x => (typeof x === "object" && x !== null && !Array.isArray(x)
      ? `${indent}- ${text(x, indent + "  ").trimStart()}` : `${indent}- ${text(x).trim()}`)).join("\n");
  }
  return Object.entries(v as Record<string, unknown>).map(([k, x]) => {
    if (x !== null && typeof x === "object" && !(Array.isArray(x) && x.every(y => typeof y !== "object" || y === null)))
      return `${indent}${k}:\n${text(x, indent + "  ")}`;
    return `${indent}${k}: ${text(x).trim()}`;
  }).join("\n");
}

/** a batch from a file (or - for stdin): a list of operations, or {"ops": […], "reason": "…"} */
function opsFile(src: string): { ops: unknown[]; reason?: string } {
  let parsed: unknown;
  try { parsed = JSON.parse(readFileSync(src === "-" ? 0 : src, "utf8")); } catch (e) { throw new UserError(`${src} is not JSON: ${(e as Error).message}`); }
  const p = parsed as { ops?: unknown[]; reason?: string };
  return Array.isArray(parsed) ? { ops: parsed } : { ops: p.ops ?? [], reason: p.reason };
}

export async function main(argv: string[]): Promise<number> {
  const json = argv.includes("--json");
  const args = argv.filter(a => a !== "--json");
  const flag = (n: string) => args.includes(n);
  const value = (n: string) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
  const VALUED = ["--house", "--year", "--limit", "--depth", "--ids", "--reason", "--expect", "--around", "--margin", "--box", "--scale", "--highlight", "--name", "--from", "--ops"];
  const FLAGS = ["--dry-run", "--allow-errors", "--errors", "--no-issues", "--help"];
  // build takes the engine's own options (--public, --png, --frozen…)
  if (argv[0] === "build") { const { main: build } = await import("@crownline/engine/cli"); return build(argv.slice(1)); }
  if (args.includes("--help") || args.includes("-h")) { console.log(HELP); return 0; }
  // an option this command line does not know is a mistake, not something to ignore (--dry_run would save)
  for (const [i, a] of args.entries()) {
    if (!a.startsWith("--") || VALUED.includes(args[i - 1]) || VALUED.includes(a) || FLAGS.includes(a)) continue;
    const near = a.replace(/_/g, "-"), alias = { "--dry-run": "--dry-run", "--expected-hash": "--expect", "--allow-errors": "--allow-errors" }[near];
    throw new UserError(`unknown option ${a}${alias ? `: did you mean ${alias}?` : ""} (crownline help lists them)`);
  }
  for (const v of VALUED) { const i = args.indexOf(v); if (i >= 0 && (i + 1 >= args.length || (args[i + 1].startsWith("--") && v !== "--reason"))) throw new UserError(`${v} needs a value`); }
  const pos = args.filter((a, i) => !a.startsWith("--") && !VALUED.includes(args[i - 1]));
  const [cmd, chart, ...rest] = pos;
  const out = (v: unknown) => console.log(json ? JSON.stringify(v, null, 2) : text(v));
  const list = (n: string) => value(n)?.split(",").map(s => s.trim()).filter(Boolean);
  const num = (n: string) => { const v = value(n); if (v === undefined) return undefined; const x = Number(v); if (!Number.isFinite(x)) throw new UserError(`${n} needs a number`); return x; };

  switch (cmd) {
    case undefined: case "help": case "--help": console.log(HELP); return 0;
    case "charts": out(listCharts()); return 0;
    case "guide": console.log(guide()); return 0;
    case "mcp": { const { serve } = await import("./mcp.ts"); await serve(); return -1; }
    case "build": { const { main: build } = await import("@crownline/engine/cli"); return build(argv.slice(1)); }
    case "ops": out(opsList(chart)); return 0;
  }
  if (!chart) throw new UserError(`${cmd}: which chart? (crownline charts lists them)`);
  const o = open(chart);
  switch (cmd) {
    case "describe": out(describe(o)); return 0;
    case "find": out(find(o, { query: rest.join(" "), house: value("--house"), year: num("--year"), limit: num("--limit") })); return 0;
    case "read": {
      if (!rest[0]) throw new UserError("read: which person? (find gives their id)");
      out(readPerson(o, rest[0], { depth: num("--depth") })); return 0;
    }
    case "check": { const r = check(o, { ids: list("--ids"), level: flag("--errors") ? "errors" : "all" }); out(r); return r.ok ? 0 : 1; }
    case "apply": {
      const src = rest[0];
      if (!src) throw new UserError("apply: give a file of operations, or - to read them from stdin");
      const { ops, reason } = opsFile(src);
      const r = applyOps(o, { ops, reason: value("--reason") ?? reason ?? "", dry_run: flag("--dry-run"), allow_errors: flag("--allow-errors"), expected_hash: value("--expect") });
      out(r);
      // 0: saved (or, on a dry run, would be) with no new errors and a valid document; 1 otherwise
      const c = r.check as { failed?: string[]; new_errors?: string[] };
      return !c.failed && !c.new_errors?.length && (r.saved || flag("--dry-run")) ? 0 : 1;
    }
    case "render": {
      const b = list("--box")?.map(Number);
      if (b && (b.length !== 4 || b.some(x => !Number.isFinite(x)))) throw new UserError("--box needs x,y,w,h");
      const { png: _png, ...r } = await renderRegion(o, { around: list("--around"), margin: num("--margin"), box: b ? { x: b[0], y: b[1], w: b[2], h: b[3] } : undefined,
        scale: num("--scale"), highlight: list("--highlight"), issues: !flag("--no-issues"), name: value("--name"),
        ops: value("--ops") ? opsFile(value("--ops")!).ops : undefined });
      out(r); return 0;
    }
    case "diff": out(diff(o, { from: value("--from") })); return 0;
    case "history": out(history(o)); return 0;
    case "undo": out(undo(o)); return 0;
  }
  throw new UserError(`unknown command ${cmd}\n\n${HELP}`);
}

if (process.argv[1] && /main\.ts$/.test(process.argv[1]))
  main(process.argv.slice(2)).then(code => { if (code >= 0) process.exitCode = code; }, err => {
    console.error(err instanceof UserError ? err.message : (err as Error).stack ?? err);
    process.exitCode = err instanceof Conflict ? 1 : 2;
  });

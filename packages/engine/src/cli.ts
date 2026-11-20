// The command line (PLAN Phase 5): build a chart with the TypeScript engine.
//
//   npm run build:chart                                                 every chart in charts/
//   npm run build:chart -- charts/wangsa-mataram/chart.json            page, layout file, check report
//   npm run build:chart -- charts/tokugawa/chart.json --public --png --pdf
//
//   --public           a public build (<id>-public.*): private media left out (the Python CHART_PUBLIC=1)
//   --out NAME         the output name, relative to the repository or absolute (default <id> or <id>-public)
//   --header A[,SIZE]  the header card's arrangement, and its width (or height for "top"), to compare
//   --png              a PNG at 2x;  --preview: a quick 1x PNG (<name>-preview.png) instead
//   --pdf              a one-page PDF
//   --force            make the PNG or PDF even when the layout check finds errors
//   --json             print the check report as JSON
//   --frozen           lay out from the lock beside the chart (layout.lock.json): everything it holds stays put
//   --lock             compare the layout with that lock: what moved (the exit code is 1 when something did);
//                      --all lists every item that moved, not just the first few of each kind
//   --update-lock      accept this layout: write the lock (refused while the check finds errors, unless --force)
//
// Files are written next to the repository's root, as the Python build writes them, so the page's paths to
// fonts, portraits and emblems resolve. The exit code is 1 when the check finds errors.
import { existsSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { format, validate, validateLock } from "@crownline/schema";
import { compose, diffLock, dumpLock, headerPanel, layoutFile, lockOf, render, type Lock } from "./index.ts";
import { load } from "./node.ts";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const FLAGS = ["--public", "--out", "--header", "--png", "--preview", "--pdf", "--force", "--json", "--frozen", "--lock", "--all",
               "--update-lock", "--help"];
const USAGE = "usage: npm run build:chart -- [chart.json] [--public] [--out NAME] [--header A[,SIZE]] [--png | --preview] [--pdf]\n" +
              "                                [--force] [--json] [--frozen] [--lock [--all]] [--update-lock]";

/** reports: when building every chart with --json, each chart's report is collected here by chart id */
export async function main(argv: string[], reports?: Record<string, unknown>): Promise<number> {
  const flags = new Set(argv.filter(a => a.startsWith("--")));
  const value = (name: string) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
  const docPath = argv.find((a, i) => !a.startsWith("--") && !["--out", "--header"].includes(argv[i - 1]));
  if (flags.has("--help")) { console.log(USAGE); return 0; }
  const bad = [...flags].filter(f => !FLAGS.includes(f));
  if (bad.length) { console.error(`unknown option ${bad.join(", ")}\n${USAGE}`); return 2; }
  for (const f of ["--out", "--header"])
    if (flags.has(f) && (!value(f) || value(f)!.startsWith("--"))) { console.error(`${f} needs a value\n${USAGE}`); return 2; }
  if (flags.has("--png") && flags.has("--preview")) { console.error("--png and --preview: choose one"); return 2; }
  if (flags.has("--all") && !flags.has("--lock")) { console.error("--all goes with --lock"); return 2; }
  if (!docPath) {                                   // every chart in charts/
    if (value("--out")) { console.error("--out needs a chart"); return 2; }
    let code = 0;
    const reports: Record<string, unknown> = {};
    for (const dir of readdirSync(join(ROOT, "charts")).sort())
      if (existsSync(join(ROOT, "charts", dir, "chart.json")))
        code = Math.max(code, await main([`charts/${dir}/chart.json`, ...argv], flags.has("--json") ? reports : undefined));
    if (flags.has("--json")) console.log(JSON.stringify(reports, null, 2));     // one document: the report by chart
    return code;
  }
  const t0 = performance.now();
  const cwd = process.env.INIT_CWD ?? process.cwd();          // npm runs this in the package: where the user typed it
  const show = (p: string) => relative(cwd, p) || p;
  const h = value("--header"), [arrange, size] = (h ?? "").split(",");
  if (h && (!["row", "column", "top"].includes(arrange) || (size !== undefined && !(Number(size) > 0)))) {
    console.error(`--header ${h}: row, column or top, then optionally a size in px (--header top,760)`);
    return 2;
  }
  // a chart path is taken from where the command was typed, else from the repository (charts/<id>/chart.json)
  const here = resolve(cwd, docPath);
  const { doc, env, path } = load(existsSync(here) ? here : docPath, { root: ROOT, public: flags.has("--public") });
  const valid = validate(doc);        // the engine lays out only a valid document (npm run check says the same)
  if (valid.errors.length) {
    console.error(`${show(path)}: the document has ${valid.errors.length} errors; fix them first\n  ${valid.errors.map(format).join("\n  ")}`);
    return 2;
  }
  const lockPath = join(dirname(path), "layout.lock.json");
  const readLock = (): Lock | null => {
    if (!existsSync(lockPath)) return null;
    const l = JSON.parse(readFileSync(lockPath, "utf8"));
    // its structure only: in frozen mode the lock may name people the document no longer has
    const bad = validateLock(l).errors.map(format);
    if (l.chart !== doc.meta.id) bad.push(`it is the lock of chart "${l.chart}", not "${doc.meta.id}"`);
    if (bad.length) throw new Error(`${show(lockPath)}:\n  ${bad.join("\n  ")}`);
    delete l.$schema;
    return l;
  };
  const lock = flags.has("--frozen") || flags.has("--lock") ? readLock() : null;
  if (!lock && (flags.has("--frozen") || flags.has("--lock"))) {
    console.error(`no lock file at ${lockPath}; run with --update-lock to accept the current layout`);
    return 2;
  }
  let header = headerPanel(doc);
  if (h) {
    header = { ...header, arrange: arrange as typeof header.arrange };
    if (size) header = { ...header, [arrange === "top" ? "height" : "width"]: Number(size) };
  }
  const c = compose(doc, env, header, flags.has("--frozen") ? lock : null);
  const page = render(doc, env, c);
  const name = value("--out") ?? doc.meta.id + (env.public ? "-public" : "");
  const base = isAbsolute(name) ? name : join(ROOT, name);
  writeFileSync(base + ".html", page.html, "utf8");
  writeFileSync(base + ".layout.json", JSON.stringify(layoutFile(doc, env, c, page)), "utf8");
  const { errors, warnings } = page.report;
  if (reports) reports[doc.meta.id + (env.public ? "-public" : "")] = page.report;
  else if (flags.has("--json")) console.log(JSON.stringify(page.report, null, 2));
  else {
    console.log(`wrote ${show(base + ".html")} ${c.canvas.W} x ${c.canvas.HGT}`);
    console.log(`wrote ${show(base + ".layout.json")}`);
    for (const m of errors) console.log("  ERROR", m);
    for (const m of warnings) console.log("  warn ", m);
    console.log(`  check: ${errors.length} errors, ${warnings.length} warnings (${Math.round(performance.now() - t0)} ms)`);
    if (c.placed.length) console.log(`  frozen: not in the lock, placed by their locked relatives: ${c.placed.join(", ")}`);
  }
  let moved = false;
  if (lock && flags.has("--lock")) {
    const report = diffLock(lock, lockOf(doc, c, page), flags.has("--all"));
    console.log(report.length ? report.join("\n") : `  layout unchanged against ${show(lockPath)}`);
    moved = report.length > 0;
  }
  if (flags.has("--update-lock")) {
    if (errors.length && !flags.has("--force")) {
      console.error(`lock not saved: the layout check found ${errors.length} errors; fix them, or add --force to accept the layout anyway`);
      return 1;
    }
    // whole or not at all: the editor watching the chart never reads half a lock
    writeFileSync(`${lockPath}.${process.pid}.tmp`, dumpLock(lockOf(doc, c, page)), "utf8");
    renameSync(`${lockPath}.${process.pid}.tmp`, lockPath);
    console.log(`wrote ${show(lockPath)}`);
  }
  const wantPng = flags.has("--png") || flags.has("--preview");
  if ((wantPng || flags.has("--pdf")) && errors.length && !flags.has("--force")) {
    console.error(`layout check found ${errors.length} errors; fix them or pass --force`);
    return 1;
  }
  if (wantPng || flags.has("--pdf")) {
    const { png, pdf } = await import("./print.ts");
    if (wantPng) {
      const preview = flags.has("--preview"), out = base + (preview ? "-preview.png" : ".png");
      await png(base + ".html", ROOT, out, c.canvas.W, c.canvas.HGT, preview ? 1 : 2);
      console.log("wrote", show(out));
    }
    if (flags.has("--pdf")) {
      await pdf(base + ".html", ROOT, base + ".pdf");
      console.log("wrote", show(base + ".pdf"));
    }
  }
  return errors.length || moved ? 1 : 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1])
  main(process.argv.slice(2)).then(code => { process.exitCode = code; }, err => { console.error(err.message ?? err); process.exitCode = 2; });

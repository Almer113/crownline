import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { closeSync, existsSync, watch, mkdirSync, openSync, readdirSync, readFileSync, renameSync, rmSync, statSync, unlinkSync, writeFileSync, createReadStream } from "node:fs";
import { dirname, extname, join, normalize, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Connect, type Plugin } from "vite";

// The app's local server (`npm run dev`, or `npm run edit`): the library, the view and the editor run in the
// browser and work on the chart folders in this repository, which this server reads and writes. (A folder on
// the reader's computer is opened and saved from the browser itself: packages/editor/src/store.ts.)
//
//   GET  /api/charts                 the charts: [{path, id, title}]
//   GET  /api/files                  every file under assets/ and charts/ (the engine asks whether portraits exist)
//   GET  /repo/<path>                a file under assets/ or charts/ (fonts, portraits, map data, the document)
//   PUT  /api/save?path=<file>       write a chart.json or layout.lock.json (header X-Crownline: save, so another site cannot).
//                                    With X-Crownline-Expect (the sha256 of the file as the editor last saw it, or
//                                    "absent"), refused with 409 when the file on disk is no longer that: changed
//                                    meanwhile by a model or a person. One writer at a time per chart, the same lock
//                                    the crownline tools take (<chart>/.crownline/writing); written whole (a
//                                    temporary file, renamed)
//   PUT  /api/asset?path=<file>      write an imported picture: a portrait, its source and crops.json, or an emblem
//   POST /api/export?chart=<chart.json>&what=png|pdf|page[&public=1][&frozen=1]
//                                    build the saved chart with the engine's command line: {ok, log, files}
//   GET  /api/output?name=<file>     a file the export wrote at the repository's root (<id>.png, …), to download
//   DELETE /api/save?path=<lock>     a chart's layout.lock.json, removed (its lock undone after a save); X-Crownline-Expect as for PUT
//   GET  /api/events                 (the built app, `vite preview`) the chart files that change on disk, as server-sent
//                                    events named "file", {path}; the dev server sends them over its own socket instead
//
// The built app is served by `vite preview` (npm run serve -w @crownline/app) with the same requests: a lasting local
// deployment rather than the dev server. CROWNLINE_ALLOWED_HOSTS (comma-separated) lets it answer to other host
// names, such as a tailnet name that `tailscale serve` passes on.
const REPO = normalize(fileURLToPath(new URL("../..", import.meta.url)));
const ASSET = /^assets\/(portraits|portraits_src|emblems)\/([a-z0-9][a-z0-9_-]*\/)?[a-z0-9][a-z0-9_.-]*\.(jpg|jpeg|png|webp|json)$/;
const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8", ".json": "application/json", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".png": "image/png", ".pdf": "application/pdf", ".js": "text/javascript", ".css": "text/css", ".woff2": "font/woff2", ".webp": "image/webp", ".svg": "image/svg+xml", ".ttf": "font/ttf", ".otf": "font/otf",
};
const READABLE = /^(assets|charts)\//;
const SAVABLE = /^charts\/[a-z][a-z0-9]*(-[a-z0-9]+)*\/(chart|layout\.lock)\.json$/;

/** a '/'-separated path under the repository, or null: no '..', no backslash (a separator on Windows), no
 *  drive or root, and still inside once resolved */
const inRepo = (rel: string): string | null => {
  if (!rel || /[\\\0:]/.test(rel) || rel.startsWith("/") || rel.split("/").some(p => p === ".." || p === ".")) return null;
  const full = normalize(join(REPO, rel));
  return full.startsWith(REPO) ? full : null;
};

const sha = (text: string) => createHash("sha256").update(text, "utf8").digest("hex");
const pause = (ms: number) => new Promise(res => setTimeout(res, ms));

/** one writer at a time per chart: the lock file the crownline tools take too (packages/cli/src/api.ts), waited for
 *  up to 15 s; one left by a process that died is taken over after a minute */
async function exclusive<T>(chartDir: string, fn: () => T | Promise<T>): Promise<T> {
  const dir = join(chartDir, ".crownline"), file = join(dir, "writing");
  mkdirSync(dir, { recursive: true });
  for (const until = Date.now() + 15_000; ;) {
    try { closeSync(openSync(file, "wx")); break; }
    catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
      try { if (Date.now() - statSync(file).mtimeMs > 60_000) { rmSync(file, { force: true }); continue; } } catch { continue; }
      if (Date.now() > until) throw new Error("another change to this chart is still being written: try again in a moment");
      await pause(50);
    }
  }
  try { return await fn(); } finally { rmSync(file, { force: true }); }
}

/** the file is still what the editor last saw (no expectation given: not checked) */
const asExpected = (full: string, expect: string | undefined) =>
  expect === undefined || (expect === "absent" ? !existsSync(full) : existsSync(full) && sha(readFileSync(full, "utf8")) === expect);

/** a file written whole: a temporary file beside it, renamed over it (tried again for a moment on Windows, where a
 *  file another program has open cannot be replaced) */
async function writeWhole(full: string, text: string): Promise<void> {
  const tmp = `${full}.${process.pid}.tmp`;
  writeFileSync(tmp, text, "utf8");
  for (let i = 0; ; i++) {
    try { renameSync(tmp, full); return; }
    catch (e) {
      const code = (e as NodeJS.ErrnoException).code;
      if (i < 40 && (code === "EPERM" || code === "EBUSY" || code === "EACCES")) { await pause(25); continue; }
      rmSync(tmp, { force: true });
      throw e;
    }
  }
}

function walk(dir: string, out: string[]): void {
  if (!existsSync(dir)) return;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else out.push(relative(REPO, full).split(sep).join("/"));
  }
}

function charts(): { path: string; id: string; title: string }[] {
  const out = [];
  for (const d of readdirSync(join(REPO, "charts")).sort()) {
    const path = `charts/${d}/chart.json`;
    if (!existsSync(join(REPO, path))) continue;
    try {
      const doc = JSON.parse(readFileSync(join(REPO, path), "utf8"));
      const t = doc.meta?.title, title = typeof t === "string" ? t : t?.[doc.meta?.defaultLang] ?? Object.values(t ?? {})[0] ?? d;
      out.push({ path, id: doc.meta?.id ?? d, title });
    } catch { out.push({ path, id: d, title: `${d} (cannot be read)` }); }
  }
  return out;
}

/** run a command in the repository; its output and exit code */
function run(cmd: string, args: string[], env: Record<string, string> = {}): Promise<{ code: number; log: string }> {
  return new Promise(resolve => {
    const p = spawn(cmd, args, { cwd: REPO, env: { ...process.env, ...env }, shell: false });
    let log = "";
    p.stdout.on("data", (d: Buffer) => { log += d.toString("utf8"); });
    p.stderr.on("data", (d: Buffer) => { log += d.toString("utf8"); });
    p.on("error", e => resolve({ code: -1, log: log + String(e) }));
    p.on("close", code => resolve({ code: code ?? -1, log }));
  });
}
const OUTPUT = /^[a-z][a-z0-9]*(-[a-z0-9]+)*(\.layout\.json|\.html|\.png|\.pdf|-preview\.png)$/;
let exporting = false;

async function exportChart(chart: string, what: string, pub: boolean, frozen: boolean): Promise<{ ok: boolean; log: string; files: string[] }> {
  const doc = JSON.parse(readFileSync(join(REPO, chart), "utf8")), name = doc.meta.id + (pub ? "-public" : "");
  const cli = (...a: string[]) => run(process.execPath, ["--import", "tsx", "packages/engine/src/cli.ts", chart, ...(pub ? ["--public"] : []), ...(frozen ? ["--frozen"] : []), ...a]);
  const b = await cli(...(what === "png" ? ["--png"] : what === "pdf" ? ["--pdf"] : []));
  const ext = what === "png" ? ".png" : what === "pdf" ? ".pdf" : ".html";
  const files = [name + ext, ...(what === "page" ? [name + ".layout.json"] : [])].filter(f => existsSync(join(REPO, f)));
  return { ok: b.code === 0 && files.length > 0, log: b.log, files };
}

function appFiles(): Plugin {
  return {
    name: "crownline-app-files",
    // (a page a tool writes under charts/, a render's .crownline/page.html, makes Vite log "page reload"; its
    // client reloads only a page at that very address, so the open editor is left alone)
    configureServer(server) {
      // a chart's files changed on disk (a model's batch through the crownline tools, or a person's edit): the
      // page is told, and brings the change in as a step it can undo (PLAN 8.5). Its own saves are told too;
      // it knows them by their content
      server.watcher.add(join(REPO, "charts"));
      const told = new Map<string, NodeJS.Timeout>();
      const tell = (file: string) => {
        const rel = relative(REPO, file).split(sep).join("/");
        if (!SAVABLE.test(rel)) return;
        clearTimeout(told.get(rel));
        told.set(rel, setTimeout(() => { told.delete(rel); server.ws.send({ type: "custom", event: "crownline:file", data: { path: rel } }); }, 150));
      };
      for (const ev of ["add", "change", "unlink"] as const) server.watcher.on(ev, tell);
      server.middlewares.use(api);
    },
    configurePreviewServer(server) {
      // the built app has no dev socket: the changes go out as server-sent events
      const clients = new Set<import("node:http").ServerResponse>();
      const told = new Map<string, NodeJS.Timeout>();
      const watcher = watch(join(REPO, "charts"), { recursive: true }, (_ev, name) => {
        if (!name) return;
        const rel = `charts/${String(name).split(sep).join("/")}`;
        if (!SAVABLE.test(rel)) return;
        clearTimeout(told.get(rel));
        told.set(rel, setTimeout(() => {
          told.delete(rel);
          for (const c of clients) c.write(`event: file\ndata: ${JSON.stringify({ path: rel })}\n\n`);
        }, 150));
      });
      server.httpServer.on("close", () => watcher.close());
      server.middlewares.use((req, res, next) => {
        if (req.url !== "/api/events" || req.method !== "GET") return next();
        res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
        res.write(": crownline\n\n");
        const ping = setInterval(() => res.write(": ping\n\n"), 25_000);        // kept open through proxies
        clients.add(res);
        req.on("close", () => { clearInterval(ping); clients.delete(res); });
      });
      server.middlewares.use(api);
    },
  };
}

/** the requests above, for the dev server and the built app alike */
const api: Connect.NextHandleFunction = (req, res, next) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  const json = (v: unknown, code = 200) => { res.statusCode = code; res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(v)); };
  if (url.pathname === "/api/charts" && req.method === "GET") return json(charts());
  if (url.pathname === "/api/files" && req.method === "GET") {
    const out: string[] = [];
    walk(join(REPO, "assets"), out); walk(join(REPO, "charts"), out);
    return json(out);
  }
  if (url.pathname.startsWith("/repo/") && req.method === "GET") {
    const rel = decodeURIComponent(url.pathname.slice("/repo/".length)), full = inRepo(rel);
    if (!full || !READABLE.test(rel) || !existsSync(full) || !statSync(full).isFile()) return json({ error: `no file ${rel}` }, 404);
    res.setHeader("Content-Type", TYPES[extname(full).toLowerCase()] ?? "application/octet-stream");
    res.setHeader("Cache-Control", "no-cache");
    createReadStream(full).pipe(res);
    return;
  }
  if (url.pathname === "/api/save" && req.method === "PUT") {
    const rel = url.searchParams.get("path") ?? "", full = inRepo(rel);
    if (req.headers["x-crownline"] !== "save") return json({ error: "missing X-Crownline header" }, 403);
    if (!full || !SAVABLE.test(rel)) return json({ error: `cannot save to ${rel}` }, 400);
    const parts: Buffer[] = [];
    req.on("data", (c: Buffer) => parts.push(c));
    const expect = req.headers["x-crownline-expect"] as string | undefined;
    req.on("end", () => {
      const body = Buffer.concat(parts).toString("utf8");
      try { JSON.parse(body); } catch { return json({ error: "not JSON" }, 400); }
      mkdirSync(dirname(full), { recursive: true });         // a new chart's folder
      // the check and the write under the chart's lock: nothing lands between them
      exclusive(dirname(full), () => {
        if (!asExpected(full, expect)) return false;
        return writeWhole(full, body).then(() => true);
      }).then(done => (done === false
        ? json({ error: `${rel} changed on disk since the editor read it`, changed: true }, 409)
        : json({ saved: rel, bytes: Buffer.byteLength(body) })))
        .catch(e => json({ error: (e as Error).message }, 500));
    });
    return;
  }
  if (url.pathname === "/api/save" && req.method === "DELETE") {
    // only a chart's lock (Keep this layout, undone after a save); its chart.json is never deleted here
    const rel = url.searchParams.get("path") ?? "", full = inRepo(rel);
    if (req.headers["x-crownline"] !== "save") return json({ error: "missing X-Crownline header" }, 403);
    if (!full || !SAVABLE.test(rel) || !rel.endsWith("/layout.lock.json")) return json({ error: `cannot delete ${rel}` }, 400);
    const expect = req.headers["x-crownline-expect"] as string | undefined;
    exclusive(dirname(full), () => {
      if (!asExpected(full, expect)) return false;
      if (existsSync(full)) unlinkSync(full);
      return true;
    }).then(done => (done ? json({ removed: rel }) : json({ error: `${rel} changed on disk since the editor read it`, changed: true }, 409)))
      .catch(e => json({ error: (e as Error).message }, 500));
    return;
  }
  if (url.pathname === "/api/export" && req.method === "POST") {
    const chart = url.searchParams.get("chart") ?? "", what = url.searchParams.get("what") ?? "";
    if (req.headers["x-crownline"] !== "save") return json({ error: "missing X-Crownline header" }, 403);
    if (!SAVABLE.test(chart) || !chart.endsWith("/chart.json") || !existsSync(join(REPO, chart))) return json({ error: `no chart ${chart}` }, 400);
    if (!["png", "pdf", "page"].includes(what)) return json({ error: `cannot export ${what}` }, 400);
    if (exporting) return json({ error: "an export is already running" }, 409);
    exporting = true;
    exportChart(chart, what, url.searchParams.get("public") === "1", url.searchParams.get("frozen") === "1")
      .then(r => json(r), e => json({ ok: false, log: String(e), files: [] }))
      .finally(() => { exporting = false; });
    return;
  }
  if (url.pathname === "/api/output" && req.method === "GET") {
    const name = url.searchParams.get("name") ?? "";
    if (!OUTPUT.test(name) || !existsSync(join(REPO, name))) return json({ error: `no output ${name}` }, 404);
    res.setHeader("Content-Type", TYPES[extname(name).toLowerCase()] ?? "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${name}"`);
    createReadStream(join(REPO, name)).pipe(res);
    return;
  }
  if (url.pathname === "/api/asset" && req.method === "PUT") {
    const rel = url.searchParams.get("path") ?? "", full = inRepo(rel);
    if (req.headers["x-crownline"] !== "save") return json({ error: "missing X-Crownline header" }, 403);
    if (!full || !ASSET.test(rel)) return json({ error: `cannot write ${rel}` }, 400);
    const parts: Buffer[] = [];
    req.on("data", (c: Buffer) => parts.push(c));
    req.on("end", () => {
      const body = Buffer.concat(parts);
      if (rel.endsWith(".json")) try { JSON.parse(body.toString("utf8")); } catch { return json({ error: "not JSON" }, 400); }
      mkdirSync(dirname(full), { recursive: true });
      writeFileSync(full, body);
      json({ saved: rel, bytes: body.length });
    });
    return;
  }
  next();
};

// `vite build --mode site` (npm run build:site): the demo site, static files that work from any folder of any host
export default defineConfig(({ mode }) => ({
  base: mode === "site" ? "./" : "/",
  plugins: [appFiles()],
  server: { port: 5180, strictPort: true, host: "127.0.0.1" },
  // the lasting deployment (app-server.ps1): its own port, so `npm run dev` keeps 5180
  preview: { port: 5190, strictPort: true, host: "127.0.0.1",
             allowedHosts: (process.env.CROWNLINE_ALLOWED_HOSTS ?? "").split(",").map(h => h.trim()).filter(Boolean) },
  build: { target: "es2022", assetsDir: mode === "site" ? "app" : "assets" },       // the site: apart from repo/assets
  worker: { format: "es" },
}));

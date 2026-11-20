// The demo site (PLAN 9e), in Chrome, WebKit and Firefox: the static files from `npm run build:site`, served under a
// sub-path as a host would, with no server behind them.
//   node packages/app/tests/site.mjs [--only chromium,webkit,firefox] [--headed]      (npm run test:site)
// Checks: the library lists the charts; each chart draws with every picture and font and no failed request; the
// editor changes a name, Save keeps it in the browser and downloads the chart's folder as a .zip; a reload keeps
// it; Forget brings the published chart back; a folder uploaded from this computer opens; at phone width the view
// fits the screen.
import { chromium, firefox, webkit } from "playwright";
import { createServer } from "node:http";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const only = args.includes("--only") ? args[args.indexOf("--only") + 1].split(",") : ["chromium", "webkit", "firefox"];
const REPO = fileURLToPath(new URL("../../../", import.meta.url));
const SITE = join(REPO, "release", "site");
if (!existsSync(join(SITE, "index.html"))) { console.error("no site: run npm run build:site first"); process.exit(2); }

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".svg": "image/svg+xml", ".ttf": "font/ttf", ".otf": "font/otf", ".geojson": "application/json" };
const BASE = "/demo/";                              // a sub-path, as a host such as GitHub Pages serves a project
const server = createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (!path.startsWith(BASE)) { res.statusCode = 404; return res.end(); }
  let file = normalize(join(SITE, path.slice(BASE.length)));
  if (!file.startsWith(SITE)) { res.statusCode = 403; return res.end(); }
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
  if (!existsSync(file)) { res.statusCode = 404; return res.end(); }
  res.setHeader("Content-Type", TYPES[extname(file).toLowerCase()] ?? "application/octet-stream");
  res.end(readFileSync(file));
});
await new Promise(r => server.listen(0, "127.0.0.1", r));
const URL_ = `http://127.0.0.1:${server.address().port}${BASE}`;

// a project folder to upload: the tutorial chart alone (its fonts come from the site)
const FOLDER = join(mkdtempSync(join(tmpdir(), "crownline-site-")), "my-charts");
cpSync(join(REPO, "charts", "tutorial", "chart.json"), join(FOLDER, "charts", "tutorial", "chart.json"));
cpSync(join(REPO, "charts", "tutorial", "layout.lock.json"), join(FOLDER, "charts", "tutorial", "layout.lock.json"));

const ENGINES = { chromium: [chromium, { channel: "chrome" }], webkit: [webkit, {}], firefox: [firefox, {}] };
const CHARTS = { "wangsa-mataram": 150, tokugawa: 40, tutorial: 9 };

async function run(name) {
  const [type, opts] = ENGINES[name];
  const browser = await type.launch({ ...opts, headless: !args.includes("--headed") });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [], results = [];
  page.on("pageerror", e => errors.push(String(e)));
  page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
  page.on("response", r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  page.on("requestfailed", r => { const t = r.failure()?.errorText ?? "";
    if (!/cancel|ERR_ABORTED|NS_BINDING_ABORTED|blob:/i.test(t + r.url())) errors.push(`failed: ${r.url()} ${t}`); });
  const check = (label, ok, detail = "") => results.push({ label, ok: !!ok, detail });
  /** the chart on screen, drawn, with its pictures and fonts loaded */
  const drawn = (min) => page.waitForFunction(min => {
    const v = document.querySelector("crownline-viewer"), sh = v?.shadowRoot;
    if (!sh || sh.querySelectorAll("[data-id]").length < min) return false;
    return [...sh.querySelectorAll("img")].every(i => i.complete && i.naturalWidth > 0);
  }, min, { timeout: 90000 });

  try {
    // the library
    await page.goto(URL_);
    await page.locator(".card").first().waitFor();
    await page.waitForFunction(() => [...document.querySelectorAll(".card .facts")].every(f => f.textContent));
    const titles = await page.locator(".card strong").allTextContents();
    check("the library lists the three charts", titles.length === 3, titles.join(", "));

    // each chart, read
    for (const [id, min] of Object.entries(CHARTS)) {
      await page.goto(`${URL_}?chart=${id}`);
      await drawn(min);
      const st = await page.evaluate(async () => {
        await document.fonts.ready;
        const sh = document.querySelector("crownline-viewer").shadowRoot;
        return { cards: sh.querySelectorAll("[data-id]").length, imgs: sh.querySelectorAll("img").length,
                 fonts: [...document.fonts].every(f => f.status !== "error") };
      });
      check(`${id}: drawn, with its pictures and fonts`, st.fonts, `${st.cards} cards, ${st.imgs} pictures`);
    }

    // the editor: a name changed and saved
    await page.goto(`${URL_}?chart=tutorial&edit`);
    await page.getByText("Aldric the Elder", { exact: true }).first().click();
    const field = page.locator("input[type=text]").filter({ visible: true });
    const n = await field.count();
    let nameField = null;
    for (let i = 0; i < n; i++) if ((await field.nth(i).inputValue()) === "Aldric the Elder") { nameField = field.nth(i); break; }
    await nameField.fill("Aldric the Old");
    await nameField.press("Tab");
    await page.waitForFunction(() => document.querySelector("header.top")?.textContent?.includes("Unsaved changes"));
    const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Save", exact: true }).click()]);
    const zipFile = await dl.path(), zip = readFileSync(zipFile);
    const entries = zip.readUInt16LE(zip.length - 22 + 10);
    check("Save downloads the chart's folder as a .zip", dl.suggestedFilename() === "tutorial.zip" && zip.readUInt32LE(0) === 0x04034b50
      && entries >= 1 && zip.includes("charts/tutorial/chart.json") && zip.includes("Aldric the Old"), `${dl.suggestedFilename()}, ${entries} files, ${zip.length} bytes`);
    await page.waitForFunction(() => document.querySelector("header.top")?.textContent?.includes("Kept in this browser"));

    // kept after a reload, in the view and the library; then forgotten
    await page.goto(`${URL_}?chart=tutorial`);
    await drawn(9);
    const kept = await page.evaluate(() => document.querySelector("crownline-viewer").shadowRoot.textContent.includes("Aldric the Old"));
    check("the change is kept in the browser after a reload", kept);
    await page.goto(URL_);
    await page.getByRole("button", { name: "Forget my changes…" }).click();
    await page.getByRole("button", { name: "Forget them" }).click();
    await page.locator(".edited").waitFor({ state: "detached" });
    await page.goto(`${URL_}?chart=tutorial`);
    await drawn(9);
    const back = await page.evaluate(() => document.querySelector("crownline-viewer").shadowRoot.textContent.includes("Aldric the Elder"));
    check("Forget brings the published chart back", back);

    // a folder from this computer, uploaded (any browser can)
    await page.goto(URL_);
    const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.getByRole("button", { name: /Upload a folder/ }).click()]);
    await chooser.setFiles(FOLDER);
    await page.getByRole("heading", { name: "my-charts" }).waitFor();
    await page.locator(".card a.open").first().click();
    await drawn(9);
    check("a folder uploaded from this computer opens and draws", true);

    // phone width: the view fits
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`${URL_}?chart=wangsa-mataram`);
    await drawn(150);
    const fit = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, w: innerWidth,
      v: document.querySelector("crownline-viewer").getBoundingClientRect().width }));
    check("at phone width the view fits the screen", fit.scroll <= fit.w && fit.v <= fit.w && fit.v > 300, `${fit.v}px viewer in ${fit.w}px`);
    await page.screenshot({ path: join(REPO, ".scratch", `site-${name}-phone.png`) });
  } catch (e) {
    check("ran to the end", false, String(e).split("\n")[0]);
  }
  check("no errors and no failed requests", errors.length === 0, errors.slice(0, 4).join(" | "));
  await browser.close();
  return results;
}

let failed = 0;
for (const name of only) {
  let results;
  try { results = await run(name); }
  catch (e) { console.log(`${name}: could not start: ${String(e).split("\n")[0]}`); failed++; continue; }
  console.log(name);
  for (const r of results) {
    console.log(`  ${r.ok ? "ok  " : "FAIL"}  ${r.label}${r.detail ? `: ${r.detail}` : ""}`);
    if (!r.ok) failed++;
  }
}
server.close();
rmSync(join(FOLDER, ".."), { recursive: true, force: true });
process.exit(failed ? 1 : 0);

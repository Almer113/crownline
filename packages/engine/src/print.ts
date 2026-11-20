// PNG and PDF from the built page, in the installed Chrome (or Edge) through Playwright: no browser
// download. Like the Python render.py: very large single screenshots come out blank, so the page is shot
// in tiles no larger than TILE (the chart shifted under a fixed window) and the tiles stitched (png.ts).
import { copyFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium, type Browser } from "playwright";
import { readPng, writePng, type Rgb } from "./png.ts";
import { pyRound } from "./routing.ts";

export const TILE = 2400;     // max CSS px per tile

/** equal-sized tiles no larger than TILE, as [start, end] */
export function splits(total: number): [number, number][] {
  const n = Math.ceil(total / TILE), edges = Array.from({ length: n + 1 }, (_, i) => pyRound((i * total) / n));
  return edges.slice(1).map((e, i) => [edges[i], e]);
}

async function launch(extra: string[] = []): Promise<Browser> {
  const args = ["--allow-file-access-from-files", "--hide-scrollbars", "--disable-gpu", ...extra];   // as render.py
  const exe = process.env.CHART_BROWSER;
  if (exe) return chromium.launch({ executablePath: exe, args });
  for (const channel of ["chrome", "msedge"])
    try { return await chromium.launch({ channel, args }); } catch { /* try the next */ }
  throw new Error("no Chrome or Edge found: install one, or set CHART_BROWSER to its executable");
}

/** the page's paths to fonts, portraits and emblems are relative to the repository (`root`): it is opened
 *  from a copy there, wherever it was written */
async function loaded(page: import("playwright").Page, html: string, root: string) {
  const copy = join(root, `_print_${process.pid}.html`);
  copyFileSync(html, copy);
  const interrupted = () => { rmSync(copy, { force: true }); process.exit(130); };   // Ctrl-C: no copy left behind
  process.once("SIGINT", interrupted);
  try {
    await page.goto(pathToFileURL(copy).href, { waitUntil: "load", timeout: 420_000 });
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
  } finally {
    process.off("SIGINT", interrupted);
    rmSync(copy, { force: true });
  }
}

/** the page as a PNG, `scale` device pixels per CSS pixel, W × H CSS px. The scale and the window size are
 *  the browser's own (--force-device-scale-factor, --window-size), as render.py sets them: an emulated
 *  scale (Playwright's deviceScaleFactor) snaps text to the pixel grid differently. So one browser per
 *  tile size, and the tiles kept compressed until their band is stitched. */
export async function png(html: string, root: string, out: string, W: number, H: number, scale: number): Promise<void> {
  const xs = splits(W), ys = splits(H), shots = new Map<string, Buffer>();
  const sizes = new Map<string, [number, number][]>();
  for (const [y0, y1] of ys) for (const [x0, x1] of xs) {
    const k = `${x1 - x0},${y1 - y0}`;
    if (!sizes.has(k)) sizes.set(k, []);
    sizes.get(k)!.push([x0, y0]);
  }
  for (const [size, tiles] of sizes) {
    const [tw, th] = size.split(",").map(Number);
    const browser = await launch([`--window-size=${tw},${th}`, `--force-device-scale-factor=${scale}`]);
    try {
      const page = await (await browser.newContext({ viewport: null })).newPage();
      await loaded(page, html, root);
      // the window keeps a frame: grow it until the page itself is the tile's size
      const cdp = await page.context().newCDPSession(page);
      const { windowId } = await cdp.send("Browser.getWindowForTarget");
      for (let i = 0; i < 3; i++) {
        const [iw, ih] = await page.evaluate(() => [innerWidth, innerHeight]);
        if (iw === tw && ih === th) break;
        const { bounds } = await cdp.send("Browser.getWindowBounds", { windowId });
        await cdp.send("Browser.setWindowBounds", { windowId, bounds: { width: bounds.width! + tw - iw, height: bounds.height! + th - ih } });
      }
      const [iw, ih] = await page.evaluate(() => [innerWidth, innerHeight]);
      if (iw !== tw || ih !== th) throw new Error(`the browser window would not take the tile's size: ${iw} × ${ih}, not ${tw} × ${th}`);
      for (const [x0, y0] of tiles) {
        await page.evaluate(([x, y, w, h]) => {
          const s = document.body.style, d = document.documentElement.style, c = document.getElementById("chart")!.style;
          s.width = d.width = `${w}px`; s.height = d.height = `${h}px`; s.overflow = d.overflow = "hidden";
          c.position = "absolute"; c.left = `${-x}px`; c.top = `${-y}px`;
        }, [x0, y0, tw, th]);
        shots.set(`${x0},${y0}`, await page.screenshot({ type: "png", animations: "disabled", caret: "initial" }));
      }
    } finally {
      await browser.close();
    }
  }
  // written beside the old image and renamed when complete: a failure leaves the last good PNG as it was
  const part = out + ".part", file = await writePng(part, W * scale, H * scale);
  try {
    for (const [y0, y1] of ys) {
      const band: Rgb = { width: W * scale, height: (y1 - y0) * scale, data: Buffer.alloc(W * scale * (y1 - y0) * scale * 3) };
      for (const [x0, x1] of xs) {
        const shot = readPng(shots.get(`${x0},${y0}`)!), tw = x1 - x0, th = y1 - y0;
        shots.delete(`${x0},${y0}`);
        if (shot.width !== tw * scale || shot.height !== th * scale)
          throw new Error(`tile ${x0},${y0}: got ${shot.width} × ${shot.height}, expected ${tw * scale} × ${th * scale}`);
        const rowBytes = shot.width * 3;
        for (let y = 0; y < shot.height; y++)
          shot.data.copy(band.data, (y * band.width + x0 * scale) * 3, y * rowBytes, (y + 1) * rowBytes);
      }
      await file.band(band);
    }
    await file.end();
  } catch (err) {
    file.abort();
    throw err;
  }
  renameSync(part, out);
}

/** the page as a one-page PDF, its size from the page's own @page rule */
export async function pdf(html: string, root: string, out: string): Promise<void> {
  const browser = await launch();
  try {
    const page = await browser.newPage();
    await loaded(page, html, root);
    await page.pdf({ path: out, preferCSSPageSize: true, printBackground: true });
  } finally {
    await browser.close();
  }
}

/** something drawn over a region's picture: an outline (an issue's box, a person to look at), maybe labelled */
export interface Mark { rect: [number, number, number, number]; colour: string; label?: string }

/** a region of the page as a PNG (what a model looks at): x, y, w, h in page px, `scale` device px per px,
 *  with outlines drawn over it. Written to `out`; the bytes are returned too. */
export async function region(html: string, root: string, out: string, r: { x: number; y: number; w: number; h: number },
                             scale: number, marks: Mark[] = []): Promise<Buffer> {
  const w = Math.ceil(r.w), h = Math.ceil(r.h);
  // a window has a smallest size: a larger one, and only the region kept
  const ww = Math.max(w, 640), wh = Math.max(h, 480);
  const browser = await launch([`--window-size=${ww},${wh}`, `--force-device-scale-factor=${scale}`]);
  try {
    const page = await (await browser.newContext({ viewport: null })).newPage();
    await loaded(page, html, root);
    const cdp = await page.context().newCDPSession(page);
    const { windowId } = await cdp.send("Browser.getWindowForTarget");
    for (let i = 0; i < 3; i++) {
      const [iw, ih] = await page.evaluate(() => [innerWidth, innerHeight]);
      if (iw >= w && ih >= h) break;
      const { bounds } = await cdp.send("Browser.getWindowBounds", { windowId });
      await cdp.send("Browser.setWindowBounds", { windowId, bounds: { width: bounds.width! + Math.max(0, w - iw), height: bounds.height! + Math.max(0, h - ih) } });
    }
    await page.evaluate(([x, y, marks]) => {
      const s = document.body.style, d = document.documentElement.style, chart = document.getElementById("chart")!;
      s.overflow = d.overflow = "hidden";
      Object.assign(chart.style, { position: "absolute", left: `${-x}px`, top: `${-y}px` });
      for (const m of marks as { rect: number[]; colour: string; label?: string }[]) {
        const [x0, y0, x1, y1] = m.rect, el = document.createElement("div");
        Object.assign(el.style, { position: "absolute", left: `${x0 - 3}px`, top: `${y0 - 3}px`, width: `${x1 - x0 + 6}px`, height: `${y1 - y0 + 6}px`,
          border: `3px solid ${m.colour}`, borderRadius: "4px", boxSizing: "border-box", zIndex: "9999", pointerEvents: "none" });
        if (m.label) {
          const t = document.createElement("span");
          t.textContent = m.label;
          Object.assign(t.style, { position: "absolute", left: "-3px", top: "-22px", background: m.colour, color: "#fff",
            font: "bold 13px sans-serif", padding: "1px 5px", borderRadius: "3px", whiteSpace: "nowrap" });
          el.append(t);
        }
        chart.append(el);
      }
    }, [r.x, r.y, marks] as const);
    const png = await page.screenshot({ type: "png", animations: "disabled", caret: "initial", clip: { x: 0, y: 0, width: w, height: h } });
    writeFileSync(out, png);
    return png;
  } finally {
    await browser.close();
  }
}

// Smoothness regression check (PLAN Phase 2.3; method from docs/research/1.1): pan, wheel-zoom and fly-to in a
// visible Chrome window, measuring frame times with requestAnimationFrame. A visible window is needed:
// headless and hidden pages throttle or skip drawing, so their numbers mean little.
//   node packages/viewer/tests/bench.mjs [URL] [--min-fps 45]
// Research 1.1 measured 59 fps for Prototype A's hybrid zoom on this machine.
// Known issue (18 Nov 2026): long fly-tos, especially zooming far out, can stall one frame for 100-500 ms in
// Chrome (re-drawing the cached bitmap). "worst" tracks it; it does not fail the run yet.
import { chromium } from "playwright";

const args = process.argv.slice(2);
const URL_ = args.find(a => /^https?:/.test(a)) ?? "http://localhost:5173/";
const MIN = Number(args.includes("--min-fps") ? args[args.indexOf("--min-fps") + 1] : 45);

const browser = await chromium.launch({ channel: "chrome", headless: false,
  args: ["--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--window-size=1440,900"] });
const page = await browser.newPage({ viewport: { width: 1400, height: 820 } });
await page.goto(URL_);
await page.waitForFunction(() => window.crownline?.hasAttribute("ready"), null, { timeout: 60000 });
await page.waitForTimeout(1000);

const record = (fn) => page.evaluate(async (src) => {
  const v = window.crownline, times = []; let last = 0, run = true;
  const tick = t => { if (last) times.push(t - last); last = t; if (run) requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  await new Function("v", `return (async () => { ${src} })()`)(v);
  run = false;
  times.sort((a, b) => a - b);
  const med = times[Math.floor(times.length / 2)], p95 = times[Math.floor(times.length * 0.95)];
  return { frames: times.length, fps: Math.round(1000 / med), p95: Math.round(p95 * 10) / 10, worst: Math.round(times[times.length - 1]) };
}, fn.toString().replace(/^[^{]*\{|\}$/g, ""));

const cases = {
  "pan at 100%": () => { v.cam.set(v.cam.viewAt(4600, 2200, 1), false);
    return new Promise(r => { let n = 0; const f = () => { v.cam.panBy(-6, -2); ++n < 240 ? requestAnimationFrame(f) : r(); }; requestAnimationFrame(f); }); },
  "pan, whole chart": () => { v.cam.set(v.cam.fitView(), false);
    return new Promise(r => { let n = 0; const f = () => { v.cam.panBy(n < 120 ? -3 : 3, 0); ++n < 240 ? requestAnimationFrame(f) : r(); }; requestAnimationFrame(f); }); },
  "zoom in and out": () => { v.cam.set(v.cam.fitView(), false);
    return new Promise(r => { let n = 0; const f = () => { v.cam.zoomAt(n < 120 ? 1.025 : 1 / 1.025, 700, 410); ++n < 240 ? requestAnimationFrame(f) : r(); }; requestAnimationFrame(f); }); },
  "fly to a card": async () => { v.cam.set(v.cam.fitView(), false); await v.flyToPerson("pb10"); await v.fit(); },
};

let failed = 0;
console.log(`Chrome ${browser.version()}, visible window 1400x820, pass if median >= ${MIN} fps`);
for (const [name, fn] of Object.entries(cases)) {
  const r = await record(fn);
  const ok = r.fps >= MIN; if (!ok) failed++;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name.padEnd(18)} ${String(r.fps).padStart(3)} fps median, p95 ${r.p95} ms, worst ${r.worst} ms (${r.frames} frames)`);
}
await browser.close();
process.exit(failed ? 1 : 0);

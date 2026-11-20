// Design screenshots for review (docs/review/p3-*.png). Needs npm run demo: node packages/viewer/tests/design-shots.mjs
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
const OUT = fileURLToPath(new URL("../../../docs/review/", import.meta.url));
const b = await chromium.launch({ channel: "chrome" });
const page = async (w, h, hash = "") => {
  const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  p.on("pageerror", e => console.log("pageerror", String(e)));
  await p.goto("http://localhost:5173/" + hash);
  await p.waitForFunction(() => window.crownline?.hasAttribute("ready"), null, { timeout: 60000 });
  await p.waitForTimeout(800);
  return p;
};
const settle = p => p.waitForTimeout(1600);

// 1-2: Hamengkubuwana II selected, lineage lit, strong and soft veils
let p = await page(1600, 900);
await p.evaluate(() => window.crownline.select("hb2"));
await p.evaluate(() => { const v = window.crownline; v.cam.set(v.cam.viewAt(3600, 2500, 0.3), false); });
await settle(p);
await p.screenshot({ path: OUT + "p3-lineage-strong.png" });
await p.evaluate(() => window.crownline.highlight.setStyle({ veil: "rgba(237, 232, 216, 0.6)" }));
await settle(p);
await p.screenshot({ path: OUT + "p3-lineage-soft.png" });

// 3: panel close-up on Sultan Agung (portrait, crown, notes, family)
await p.evaluate(() => window.crownline.highlight.setStyle({ veil: "rgba(237, 232, 216, 0.82)" }));
await p.evaluate(() => window.crownline.flyToPerson("agung"));
await settle(p);
await p.screenshot({ path: OUT + "p3-panel-agung.png" });

// 4: hover tooltip (nothing selected)
await p.evaluate(() => window.crownline.select(null));
await p.evaluate(() => { const v = window.crownline; v.cam.set(v.cam.viewAt(5600, 1000, 0.8), false); });
await settle(p);
const pt = await p.evaluate(() => {
  const v = window.crownline, r = v.layout.people.am1.rect, c = v.cam, bb = v.getBoundingClientRect();
  return { x: bb.left + c.tx + (r[0] + r[2]) / 2 * c.s, y: bb.top + c.ty + (r[1] + r[3]) / 2 * c.s };
});
await p.mouse.move(pt.x, pt.y); await p.waitForTimeout(300);
await p.screenshot({ path: OUT + "p3-tooltip.png", clip: { x: Math.max(0, pt.x - 400), y: Math.max(0, pt.y - 250), width: 800, height: 450 } });
await p.close();

// 5: phone: bottom sheet
p = await page(390, 800);
await p.evaluate(() => window.crownline.flyToPerson("pb13"));
await settle(p);
await p.screenshot({ path: OUT + "p3-phone.png" });
await b.close();
console.log("ok");

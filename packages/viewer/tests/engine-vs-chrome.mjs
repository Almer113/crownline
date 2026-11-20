// Does the engine's text layout agree with Chrome's? For every note, the height the engine
// reserved (layout.json) must equal the height Chrome draws, and no card's text may run past its box.
//   node packages/viewer/tests/engine-vs-chrome.mjs [chart.html ...]   (default: every build in the repo root)
import { chromium } from "playwright";
import { pathToFileURL, fileURLToPath } from "node:url";
import { readFileSync, readdirSync } from "node:fs";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const files = process.argv.slice(2).length ? process.argv.slice(2)
  : readdirSync(ROOT).filter(f => f.endsWith(".html") && readdirSync(ROOT).includes(f.replace(/\.html$/, ".layout.json")))
      .sort().map(f => ROOT + f);
const KNOWN = new Set(["mangkubumi"]);   // its "disputed" tag hangs over the box edge by design
const browser = await chromium.launch({ channel: "chrome" });
let failed = 0;
for (const f of files) {
  let layout;
  try { layout = JSON.parse(readFileSync(f.replace(/\.html$/, ".layout.json"), "utf8")); }
  catch { console.log(`skip ${f} (not built)`); continue; }
  const page = await browser.newPage();
  await page.goto(pathToFileURL(f).href);
  await page.evaluate(() => document.fonts.ready);
  const res = await page.evaluate(({ notes, people }) => {
    const out = [];
    const real = [...document.querySelectorAll(".note")].map(n => {
      const r = n.getBoundingClientRect(); return { l: r.left + scrollX, t: r.top + scrollY, h: r.height };
    });
    for (const n of notes) {
      const [l, t, , b] = n.rect, m = real.find(x => Math.abs(x.l - l) < 1 && Math.abs(x.t - t) < 1);
      if (!m) out.push(`note ${n.anchor}: not found on the page`);
      else if (Math.abs(m.h - (b - t)) > 1) out.push(`note ${n.anchor}: engine ${(b - t).toFixed(1)} px, Chrome ${m.h.toFixed(1)} px`);
    }
    for (const card of document.querySelectorAll("[data-id]")) {
      const [l, , r] = people[card.dataset.id].rect;
      for (const el of card.querySelectorAll("*")) {
        if (![...el.childNodes].some(c => c.nodeType === 3 && c.textContent.trim())) continue;
        const rg = document.createRange(); rg.selectNodeContents(el);
        const t = rg.getBoundingClientRect();
        if (t.right > r + 0.5 || t.left < l - 0.5)
          out.push(`card ${card.dataset.id}: "${el.textContent.trim().slice(0, 30)}" runs past the box`);
      }
    }
    return out;
  }, { notes: layout.notes, people: layout.people });
  const bad = res.filter(m => !KNOWN.has(m.split(":")[0].split(" ")[1]));
  failed += bad.length;
  console.log(`${f.split(/[\\/]/).pop()}: ${layout.notes.length} notes, ${Object.keys(layout.people).length} cards, ` +
              (bad.length ? `${bad.length} problems` : "all agree"));
  for (const m of bad) console.log("  " + m);
}
await browser.close();
process.exit(failed ? 1 : 0);

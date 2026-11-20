// Cross-browser smoke test: the same checks as tools/viewer_smoke.py, in Chrome, Firefox and WebKit (Safari's engine).
//   node packages/viewer/tests/browsers.mjs [URL] [--only chromium,firefox,webkit] [--headed]
// URL defaults to http://localhost:5173/ (npm run demo); a published site/ folder works too.
// Chrome is the installed one (channel "chrome"); Firefox and WebKit are Playwright's builds (npx playwright install).
import { chromium, firefox, webkit } from "playwright";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const URL_ = args.find(a => /^https?:/.test(a)) ?? "http://localhost:5173/";
const only = args.includes("--only") ? args[args.indexOf("--only") + 1].split(",") : ["chromium", "firefox", "webkit"];
const OUT = fileURLToPath(new URL("../../../.scratch/viewer-smoke/", import.meta.url));
mkdirSync(OUT, { recursive: true });
const ENGINES = { chromium: [chromium, { channel: "chrome" }], firefox: [firefox, {}], webkit: [webkit, {}] };

async function run(name) {
  const [type, opts] = ENGINES[name];
  const browser = await type.launch({ ...opts, headless: !args.includes("--headed") });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [], results = [];
  page.on("pageerror", e => errors.push(String(e)));
  page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
  // a download cut short by leaving the page (the test navigates on) is not a failure
  page.on("requestfailed", r => { const t = r.failure()?.errorText ?? "";
    if (!/cancel|ERR_ABORTED|NS_BINDING_ABORTED/i.test(t)) errors.push(`failed: ${r.url()} ${t}`); });
  const check = (label, ok, detail = "") => results.push({ label, ok: !!ok, detail });
  const info = (label, detail) => results.push({ label, ok: true, info: true, detail });
  const cam = () => page.evaluate(() => { const c = window.crownline.cam, [x, y] = c.centre(); return { s: c.s, x, y }; });
  const ready = () => page.waitForFunction(() => {
    const sh = window.crownline?.shadowRoot; if (!sh || !window.crownline.hasAttribute("ready")) return false;
    const imgs = [...sh.querySelectorAll("img")];
    return sh.querySelectorAll("[data-id]").length > 100 && imgs.every(i => i.complete && i.naturalWidth > 0);
  }, null, { timeout: 60000 });
  const box = await (async () => { await page.goto(URL_); await ready(); return page.locator("crownline-viewer").boundingBox(); })();

  // load
  const st = await page.evaluate(async () => {
    await document.fonts.ready;
    const sh = window.crownline.shadowRoot, imgs = [...sh.querySelectorAll("img")];
    return { cards: sh.querySelectorAll("[data-id]").length, imgs: imgs.length,
             small: imgs.filter(i => /portraits\//.test(i.src)).every(i => i.src.endsWith("-64.webp")),
             fonts: [...document.fonts].map(f => f.status), fit: [window.crownline.cam.s, window.crownline.cam.fitView().s] };
  });
  check("chart, images, fonts load", st.cards > 100 && st.fonts.every(f => f === "loaded"), `${st.cards} cards, ${st.imgs} images`);
  check("first view fits the chart", Math.abs(st.fit[0] - st.fit[1]) < 1e-9 && st.fit[0] > 0.05, st.fit[0].toFixed(4));
  check("portraits start small", st.small);
  await page.screenshot({ path: `${OUT}${name}-1-fit.png` });

  // wheel zoom towards the cursor
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  const before = await cam();
  for (let i = 0; i < 5; i++) { await page.mouse.wheel(0, -100); await page.waitForTimeout(30); }
  await page.waitForTimeout(400);
  const after = await cam();
  check("wheel zooms in about the cursor", after.s > before.s * 1.3 && Math.hypot(after.x - before.x, after.y - before.y) < 30,
        `${before.s.toFixed(3)} → ${after.s.toFixed(3)}`);

  // drag to pan
  await page.mouse.move(cx, cy); await page.mouse.down();
  await page.mouse.move(cx - 200, cy - 100, { steps: 8 }); await page.mouse.up();
  const panned = await cam();
  check("drag pans", Math.abs((panned.x - after.x) * panned.s - 200) < 3 && Math.abs((panned.y - after.y) * panned.s - 100) < 3,
        `moved ${((panned.x - after.x) * panned.s).toFixed(0)}, ${((panned.y - after.y) * panned.s).toFixed(0)} px`);

  // keyboard
  await page.evaluate(() => window.crownline.cam.set(window.crownline.cam.fitView(), false));
  await page.locator("crownline-viewer").focus();
  await page.keyboard.press("Equal"); await page.waitForTimeout(700);
  check("keyboard zoom", (await cam()).s > st.fit[0] * 1.2);

  // shift-drag zoom-to-region
  await page.keyboard.press("Digit0"); await page.waitForTimeout(900);
  await page.keyboard.down("Shift");
  await page.mouse.move(box.x + 300, box.y + 300); await page.mouse.down();
  await page.mouse.move(box.x + 500, box.y + 420, { steps: 5 }); await page.mouse.up();
  await page.keyboard.up("Shift");
  await page.waitForTimeout(1500);
  check("shift-drag zooms into the box", (await cam()).s > st.fit[0] * 4, (await cam()).s.toFixed(3));

  // animation smoothness: frames drawn during a fly-to (headless numbers are a rough guide only)
  const fps = await page.evaluate(async () => {
    const v = window.crownline; v.cam.set(v.cam.fitView(), false);
    let frames = 0, run = true; const t0 = performance.now();
    const tick = () => { frames++; if (run) requestAnimationFrame(tick); }; requestAnimationFrame(tick);
    await v.flyToPerson("agung"); run = false;
    return Math.round(frames / ((performance.now() - t0) / 1000));
  });
  // Reported, not judged: headless and software-drawn browsers (Playwright's WebKit on Windows) are far
  // slower than the real thing. Judge smoothness in a visible Chrome (--headed) or on real devices.
  info("frames during a fly-to", `${fps} fps`);
  await page.waitForTimeout(1500);
  const sharp = await page.evaluate(() => {
    const v = window.crownline, r = v.getBoundingClientRect();
    return [...v.shadowRoot.querySelectorAll("img")].filter(i => /portraits\//.test(i.src)).filter(i => {
      const b = i.getBoundingClientRect(); return b.right > r.left && b.left < r.right && b.bottom > r.top && b.top < r.bottom;
    }).map(i => i.src.split("/").pop());
  });
  check("portraits on screen sharpen", sharp.length && sharp.every(s => !s.endsWith("-64.webp")), sharp.join(" "));
  await page.screenshot({ path: `${OUT}${name}-2-agung.png` });

  // clicking a card selects it; double-clicking flies to it (both broke once: pointer capture hid the card)
  await page.evaluate(() => window.crownline.cam.set(window.crownline.cam.viewAt(5598, 1008, 1), false));
  await page.waitForTimeout(300);
  const card = await page.evaluate(() => {
    const v = window.crownline, r = v.layout.people.agung.rect, c = v.cam, b = v.getBoundingClientRect();
    return { x: b.left + c.tx + (r[0] + r[2]) / 2 * c.s, y: b.top + c.ty + (r[1] + r[3]) / 2 * c.s };
  });
  // start from no selection, and have the listener in place before the click (not racing it)
  await page.evaluate(() => {
    window.crownline.select(null);
    window.__selected = null;
    window.crownline.addEventListener("select", e => { window.__selected = e.detail.id; }, { once: true });
  });
  await page.mouse.click(card.x, card.y);
  const selected = await page.waitForFunction(() => window.__selected, null, { timeout: 5000 })
    .then(h => h.jsonValue(), () => "(no select event)");
  check("click selects the card", selected === "agung" && page.url().includes("p=agung"), `${selected} ${page.url().split("#")[1]}`);
  await page.evaluate(() => window.crownline.select(null));
  await page.mouse.dblclick(card.x, card.y);
  await page.waitForTimeout(1200);
  const dbl = await page.evaluate(() => ({ sel: getComputedStyle(window.crownline.shadowRoot.getElementById("sel")).display,
                                           s: window.crownline.cam.s }));
  check("double-click flies to the card", dbl.sel === "block" && Math.abs(dbl.s - 1) < 0.01, `zoom ${dbl.s.toFixed(2)}`);
  // Playwright's WebKit (Windows) takes no mouse input at all after a real right-click opens its menu:
  // there, send the right button's pointer events directly (the check is that the viewer ignores them)
  if (name === "webkit") await page.evaluate(({ x, y }) => {
    const vp = window.crownline.shadowRoot.getElementById("vp");
    for (const t of ["pointerdown", "pointerup"])
      vp.dispatchEvent(new PointerEvent(t, { pointerId: 1, clientX: x, clientY: y, button: 2, buttons: 2, pointerType: "mouse", bubbles: true }));
  }, card);
  else await page.mouse.click(card.x, card.y, { button: "right" });
  check("right-click leaves the selection alone", (await page.evaluate(() => window.crownline.shadowRoot.getElementById("sel").style.display)) === "block");
  await page.keyboard.press("Escape");

  // buttons work from the keyboard (Enter was once swallowed by the viewer)
  const s0 = (await cam()).s;
  await page.locator("crownline-viewer").evaluate(v => v.shadowRoot.querySelector('button[data-act="out"]').focus());
  await page.keyboard.press("Enter"); await page.waitForTimeout(300);
  check("Enter on a focused button", (await cam()).s < s0 * 0.8, `${s0.toFixed(2)} → ${(await cam()).s.toFixed(2)}`);

  // editing the view in the address bar moves the view
  await page.evaluate(() => { location.hash = "#@3000,2000,50"; });
  await page.waitForTimeout(1200);
  const hv = await cam();
  check("hash edit moves the view", Math.abs(hv.x - 3000) < 2 && Math.abs(hv.y - 2000) < 2 && Math.abs(hv.s - 0.5) < 0.001,
        `${hv.x.toFixed(0)},${hv.y.toFixed(0)},${(hv.s * 100).toFixed(0)}%`);

  // moving the element in the page must not load or bind it twice; creating one from script must work
  const re = await page.evaluate(async () => {
    const v = window.crownline, parent = v.parentNode, next = v.nextSibling;
    v.remove(); parent.insertBefore(v, next);
    await new Promise(r => setTimeout(r, 300));
    const tx = v.cam.tx;
    const vp = v.shadowRoot.getElementById("vp"), b = v.getBoundingClientRect(), x = b.left + 300, y = b.top + 300;
    vp.dispatchEvent(new PointerEvent("pointerdown", { pointerId: 9, clientX: x, clientY: y, button: 0, pointerType: "mouse", bubbles: true }));
    vp.dispatchEvent(new PointerEvent("pointermove", { pointerId: 9, clientX: x + 100, clientY: y, pointerType: "mouse", bubbles: true }));
    vp.dispatchEvent(new PointerEvent("pointerup", { pointerId: 9, clientX: x + 100, clientY: y, pointerType: "mouse", bubbles: true }));
    let created = "ok";
    // compare with the registered class (a production build shortens class names)
    try { const el = document.createElement("crownline-viewer"); if (!(el instanceof customElements.get("crownline-viewer"))) created = el.constructor.name; }
    catch (e) { created = String(e); }
    return { charts: v.shadowRoot.querySelectorAll("#chart").length, maps: v.shadowRoot.querySelectorAll(".minimap").length,
             moved: Math.round(v.cam.tx - tx), created };
  });
  check("re-inserting the element keeps one chart", re.charts === 1 && re.maps === 1 && re.moved === 100,
        `${re.charts} chart, ${re.maps} minimap, drag 100 px moved ${re.moved}`);
  check("document.createElement works", re.created === "ok", re.created);

  // ---------------------------------------------------------------- Phase 3: exploring
  const sh = (fn, arg) => page.evaluate(fn, arg);
  await sh(() => { const v = window.crownline; v.select(null); v.cam.set(v.cam.fitView(), false); });

  // card panel: opens on selection with the person's family; the lineage stays lit
  await sh(() => window.crownline.select("hb2"));
  const pn = await sh(() => {
    const r = window.crownline.shadowRoot, panel = r.querySelector(".clp-panel");
    return { open: panel.classList.contains("clp-open"), name: panel.querySelector("h2")?.textContent,
             kin: [...panel.querySelectorAll(".clp-kin")].map(b => b.dataset.go),
             lit: [...r.querySelectorAll(".cl-highlight:not(.cl-hover) [data-id]")].map(e => e.dataset.id) };
  });
  check("panel shows the person and family", pn.open && pn.name.replace(/\s/g, " ") === "Hamengkubuwana II" && pn.kin.includes("hb1") && pn.kin.includes("hb3"),
        `${pn.name}: ${pn.kin.length} relatives`);
  check("lineage lights ancestors and descendants", ["hb2", "hb1", "hb10", "agung"].every(k => pn.lit.includes(k)) && !pn.lit.includes("pb3"),
        `${pn.lit.length} lit`);
  await sh(() => window.crownline.shadowRoot.querySelector('.clp-kin[data-go="hb1"]').click());
  await page.waitForTimeout(1200);
  check("a relative in the panel flies there", (await sh(() => location.hash)).includes("p=hb1"));
  await sh(() => window.crownline.select(null));

  // search: "/" focuses the box, old spellings and numerals match, Enter flies to the result
  await page.locator("crownline-viewer").focus();
  await page.keyboard.press("/");
  await page.keyboard.type("hamengkubuwono 9", { delay: 15 });
  await page.waitForTimeout(200);
  const first = await sh(() => window.crownline.shadowRoot.querySelector(".clt-results li")?.dataset.id);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(1300);
  check("search: old spelling and numeral, Enter selects", first === "hb9" && (await sh(() => location.hash)).includes("p=hb9"), first);
  const finds = await sh(() => ["djokja", "mangkunagara 1", "sambernyawa", "pb xiii"].map(q => window.crownline.search.find(q)[0]?.id));
  check("search: variants, numerals and notes", finds.join() === "hb1,mn1,mn1,pb13", finds.join());

  // relationship finder: pick two people, read the path
  await sh(() => window.crownline.relate("agung", "hb1"));
  await page.waitForTimeout(1200);
  const rel = await sh(() => ({ text: window.crownline.shadowRoot.querySelector(".clp-relbox")?.textContent.replace(/\s+/g, " ") ?? "",
                                hash: location.hash }));
  check("relationship: path described", /Hamengkubuwana I is Agung's great-great-grandchild, through Amangkurat I, Pakubuwana I and Amangkurat IV/.test(rel.text)
        && rel.hash.includes("from=agung"), rel.text.slice(0, 90));
  await sh(() => window.crownline.select(null));

  // filters: rulers only
  await page.locator("crownline-viewer button[data-tb=filters]").click();
  await page.locator("crownline-viewer input[data-f=rulersOnly]").check();
  const fl = await sh(() => {
    const v = window.crownline, lit = new Set([...v.shadowRoot.querySelectorAll(".cl-highlight:not(.cl-hover) [data-id]")].map(e => e.dataset.id));
    const rulers = Object.entries(v.layout.people).filter(([, p]) => p.kind === "ruler").map(([k]) => k);
    return { lit: lit.size, rulers: rulers.length, all: rulers.every(k => lit.has(k)) };
  });
  check("filters: rulers only", fl.all && fl.lit === fl.rulers, `${fl.lit} lit, ${fl.rulers} rulers`);
  check("filters: the button shows that a filter is on",
        /•/.test(await sh(() => window.crownline.shadowRoot.querySelector("button[data-tb=filters]").textContent)));
  await page.locator("crownline-viewer button.clt-link[data-f=reset]").click();
  await page.keyboard.press("Escape");
  check("filters: reset shows everyone", await sh(() => getComputedStyle(window.crownline.shadowRoot.querySelector(".cl-highlight")).display === "none"));

  // time slider: who reigned in 1757, the era and the map stage
  await sh(() => window.crownline.setYear(1757));
  await page.waitForTimeout(450);                    // the address is written once the year settles
  const tm = await sh(() => {
    const r = window.crownline.shadowRoot;
    return { lit: [...r.querySelectorAll(".cl-highlight:not(.cl-hover) [data-id]")].map(e => e.dataset.id),
             map: r.querySelector(".cl-highlight .mcell")?.dataset.stage, era: r.querySelector(".clt-era")?.textContent, hash: location.hash };
  });
  check("time slider: 1757", ["hb1", "pb3", "mn1"].every(k => tm.lit.includes(k)) && !tm.lit.includes("agung") && tm.map === "S3"
        && tm.era === "The divided kingdoms" && tm.hash.includes("y=1757"), `${tm.lit.length} lit, map ${tm.map}, ${tm.era}`);
  await sh(() => window.crownline.setYear(null));

  // tour: steps by keyboard, link records the step, Escape ends it
  await sh(() => window.crownline.tour("split", 0));
  await page.waitForTimeout(300);
  await page.locator("crownline-viewer").focus();
  await page.keyboard.press("ArrowRight"); await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(1200);
  const tr = await sh(() => ({ card: window.crownline.shadowRoot.querySelector(".clt-card h3")?.textContent, hash: location.hash,
                               map: window.crownline.shadowRoot.querySelector(".cl-highlight .mcell")?.dataset.stage }));
  await page.keyboard.press("Escape");
  const ended = await sh(() => !window.crownline.shadowRoot.querySelector(".clt-card").classList.contains("clt-open") && !location.hash.includes("tour="));
  check("tour: arrow keys step, Escape ends", tr.card === "The map around 1640" && tr.hash.includes("tour=split.3") && tr.map === "S1" && ended,
        `${tr.card}, ${tr.hash.split("&").pop()}`);

  // hovering a line names the people it joins; hovering a title explains it
  await sh(() => { const v = window.crownline; v.cam.set(v.cam.viewAt(5636.7, 1067, 1), false); });
  await page.waitForTimeout(300);
  const lp = await sh(() => { const v = window.crownline, b = v.getBoundingClientRect(); return { x: b.left + v.cam.tx + 5636.7 * v.cam.s, y: b.top + v.cam.ty + 1067 * v.cam.s }; });
  await page.mouse.move(lp.x, lp.y); await page.waitForTimeout(300);
  const lt = await sh(() => window.crownline.shadowRoot.querySelector(".cl-tip").textContent);
  check("line hover names its people", lt === "Agung → Alit", lt);
  const tt = await sh(() => { const el = window.crownline.shadowRoot.querySelector('#chart [data-id="agung"] .t'), r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await page.mouse.move(tt.x, tt.y); await page.waitForTimeout(300);
  check("title hover explains the title", /Sultan: Muslim sovereign/.test(await sh(() => window.crownline.shadowRoot.querySelector(".cl-tip").textContent)));
  await page.mouse.move(box.x + 5, box.y + box.height - 5);

  // language: the toggle re-words the controls and the panel
  await page.locator("crownline-viewer button[data-tb=lang]").click();
  await sh(() => window.crownline.select("hb1"));
  const id_ = await sh(() => ({ ph: window.crownline.shadowRoot.querySelector(".clt-search input").placeholder,
                                dt: window.crownline.shadowRoot.querySelector(".clp-rel dt")?.textContent }));
  await page.locator("crownline-viewer button[data-tb=lang]").click();
  check("language toggle", id_.ph === "Cari tokoh" && id_.dt === "Orang tua", `${id_.ph} / ${id_.dt}`);
  await sh(() => window.crownline.select(null));

  // ---------------------------------------------------------------- review fixes (Phase 3 review)
  // Esc cancels a relationship pick from the panel's button and from an empty search box
  await sh(() => window.crownline.select("hb5"));
  await page.locator("crownline-viewer .clp-panel button[data-act=relate]").click();
  await page.keyboard.press("Escape");
  const pk1 = await sh(() => window.crownline.shadowRoot.querySelector(".clt-banner").classList.contains("clt-open"));
  await page.locator("crownline-viewer .clp-panel button[data-act=relate]").click();
  await page.locator("crownline-viewer .clt-search input").focus();
  await page.keyboard.press("Escape");
  const pk2 = await sh(() => window.crownline.shadowRoot.querySelector(".clt-banner").classList.contains("clt-open"));
  check("Esc cancels a pick at once (panel button, empty search box)", !pk1 && !pk2, `${pk1} ${pk2}`);
  await sh(() => window.crownline.select(null));

  // search: filler words, aliases, Sala is Surakarta (not Sela), the name outranks the card's line
  const sf = await sh(() => ["sunan pakubuwono 10", "prince diponegoro", "sutawijaya", "hanyakrakusuma", "sultan agung", "kiai maja"]
    .map(q => window.crownline.search.find(q)[0]?.id));
  check("search: filler words and other names", sf.join() === "pb10,diponegoro,senapati,agung,agung,kyaimaja", sf.join());
  const sala = await sh(() => window.crownline.search.find("sala").map(h => h.id));
  check("search: Sala finds Surakarta, not Sela", !sala.includes("lg_sela") && sala.length > 0, sala.slice(0, 4).join());

  // relationships: a close blood tie beats a marriage; people who share a name are told apart
  const rw = await sh(() => {
    const v = window.crownline, txt = () => v.shadowRoot.querySelector(".clp-relbox")?.textContent.replace(/\s+/g, " ") ?? "";
    v.relate("hb1", "mn1"); const a = txt();
    v.relate("pb14h", "pb14p"); const b = txt();
    v.select(null); return [a, b];
  });
  check("relationship: blood before marriage (hb1 to mn1)", /Mangkunegara I is Hamengkubuwana I's (nephew|great-nephew|first cousin)/.test(rw[0]), rw[0].slice(12, 90));
  check("relationship: shared names told apart", /Pakubuwana XIV \(Purbaya\).*Pakubuwana XIV \(Hangabehi\)/.test(rw[1]), rw[1].slice(12, 100));

  // choosing people makes browser-history steps: Back returns to the one before, then to none
  await sh(() => window.crownline.select(null));
  await page.waitForTimeout(400);
  await sh(() => window.crownline.select("hb5")); await page.waitForTimeout(100);
  await sh(() => window.crownline.select("hb4")); await page.waitForTimeout(100);
  await page.goBack(); await page.waitForTimeout(400);
  const b1 = await sh(() => window.crownline.selected);
  await page.goBack(); await page.waitForTimeout(400);
  const b2 = await sh(() => ({ sel: window.crownline.selected, url: location.href.startsWith("http") }));
  check("Back steps through the people chosen", b1 === "hb5" && b2.sel === null && b2.url, `${b1}, ${b2.sel}`);

  // a person (or a relationship) in a link without a view is brought into view
  await page.goto("about:blank");
  await page.goto(URL_.split("#")[0] + "#p=diponegoro"); await ready();
  const nv = await sh(() => { const v = window.crownline, r = v.layout.people.diponegoro.rect, c = v.cam;
    return { zoomed: c.s > c.fitView().s * 3, x: (r[0] + r[2]) / 2 * c.s + c.tx, w: v.shadowRoot.getElementById("vp").clientWidth }; });
  check("a linked person without a view is shown", nv.zoomed && nv.x > 0 && nv.x < nv.w, JSON.stringify(nv));

  // a link with an out-of-range zoom keeps its centre
  await page.goto("about:blank");
  await page.goto(URL_.split("#")[0] + "#@3700,2600,9999"); await ready();
  const zc = await cam();
  check("a link's zoom is limited, its centre kept", Math.abs(zc.x - 3700) < 2 && Math.abs(zc.y - 2600) < 2, JSON.stringify(zc));

  // a shared link
  await page.goto("about:blank");
  await page.goto(URL_.split("#")[0] + "#@4123,1925,150&p=hb1"); await ready();
  const v = await cam();
  const sel = await page.evaluate(() => getComputedStyle(window.crownline.shadowRoot.getElementById("sel")).display);
  check("link restores view and selection", Math.abs(v.x - 4123) < 2 && Math.abs(v.y - 1925) < 2 && Math.abs(v.s - 1.5) < 1e-6
        && sel === "block", `${v.x.toFixed(0)},${v.y.toFixed(0)},${(v.s * 100).toFixed(0)}%`);
  // a link with a relationship and a year
  await page.goto("about:blank");
  await page.goto(URL_.split("#")[0] + "#@5000,2000,40&p=hb1&from=agung&y=1760"); await ready();
  const lk = await page.evaluate(() => ({ rel: !!window.crownline.shadowRoot.querySelector(".clp-relbox"),
                                          y: window.crownline.shadowRoot.querySelector(".clt-time output")?.textContent }));
  check("link restores relationship and year", lk.rel && lk.y === "1760", `${lk.rel} ${lk.y}`);
  check("no errors logged", !errors.length, errors.slice(0, 3).join(" | "));
  const version = browser.version();
  await browser.close();
  return { name, version, results };
}

let failed = 0;
for (const name of only) {
  try {
    // a stuck browser fails the run instead of hanging it
    const { version, results } = await Promise.race([run(name),
      new Promise((_, no) => setTimeout(() => no(new Error("timed out after 5 minutes")), 300000).unref())]);
    console.log(`\n${name} ${version}`);
    for (const r of results) { if (!r.ok) failed++; console.log(`  ${r.info ? "INFO" : r.ok ? "PASS" : "FAIL"}  ${r.label}${r.detail ? "  " + r.detail : ""}`); }
  } catch (e) { failed++; console.log(`\n${name}: ERROR ${e.message.split("\n")[0]}`); }
}
console.log(failed ? `\n${failed} failed` : "\nall passed");
process.exit(failed ? 1 : 0);   // also ends a browser left open by a timed-out run

"""Smoke-test the viewer in a separate headless Chrome over the DevTools protocol (no visible window needed).

    python tools/viewer_smoke.py [URL]       # default http://localhost:5173/ (npm run demo, or a static build)
Checks: the chart mounts, every image and font loads, the first view fits the chart, zooming, a shared
link (#@x,y,zoom&p=id) opens the same view and selection, and the page logs no errors. Saves a screenshot.
"""
import base64, json, os, subprocess, sys, tempfile, time, urllib.request
import websocket

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
import render  # noqa: E402

URL = next((a for a in sys.argv[1:] if not a.startswith("-")), "http://localhost:5173/")
PORT = 9334
OUT = os.path.join(ROOT, ".scratch", "viewer-smoke")


def main():
    os.makedirs(OUT, exist_ok=True)
    prof = tempfile.mkdtemp(prefix="crownline-smoke-", dir=os.environ.get("TEMP"))
    proc = subprocess.Popen([render.browser(), f"--remote-debugging-port={PORT}", f"--user-data-dir={prof}",
                             "--window-size=1280,800", "--no-first-run", "--headless=new", "about:blank"],
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        tabs = None
        for _ in range(50):
            try:
                tabs = json.load(urllib.request.urlopen(f"http://127.0.0.1:{PORT}/json")); break
            except OSError:
                time.sleep(0.2)
        if tabs is None:
            sys.exit(f"Chrome did not open its DevTools port {PORT}; is another Chrome using it?")
        ws = websocket.create_connection([t for t in tabs if t["type"] == "page"][0]["webSocketDebuggerUrl"],
                                         timeout=60)
        n, errors = 0, []

        def call(method, **params):
            nonlocal n
            n += 1; ws.send(json.dumps({"id": n, "method": method, "params": params}))
            while True:
                m = json.loads(ws.recv())
                if m.get("method") == "Runtime.exceptionThrown":
                    errors.append(m["params"]["exceptionDetails"].get("exception", {}).get("description", "?"))
                elif m.get("method") == "Runtime.consoleAPICalled" and m["params"]["type"] == "error":
                    errors.append(" ".join(str(a.get("value", a.get("description"))) for a in m["params"]["args"]))
                elif m.get("method") == "Log.entryAdded" and m["params"]["entry"]["level"] == "error":
                    errors.append(m["params"]["entry"]["text"] + " " + m["params"]["entry"].get("url", ""))
                if m.get("id") == n:
                    return m.get("result", {})

        def js(expr):
            r = call("Runtime.evaluate", expression=expr, returnByValue=True, awaitPromise=True)
            if "exceptionDetails" in r:
                raise RuntimeError(r["exceptionDetails"])
            return r["result"].get("value")

        def wait_ready(timeout=60):
            t0 = time.time()
            while time.time() - t0 < timeout:
                st = js("""(() => { const v = window.crownline, sh = v?.shadowRoot; if (!sh) return null;
                    const imgs = [...sh.querySelectorAll('img')];
                    return { cards: sh.querySelectorAll('[data-id]').length, imgs: imgs.length,
                             done: imgs.filter(i => i.complete && i.naturalWidth > 0).length,
                             status: sh.querySelector('.status')?.textContent ?? '',
                             size: [v.clientWidth, v.clientHeight], hash: location.hash,
                             ready: v.hasAttribute('ready') }; })()""")
                if st and st["ready"] and st["cards"] and st["done"] == st["imgs"] and st["hash"]:
                    return st
                time.sleep(0.5)
            return st

        def shot(name):
            png = call("Page.captureScreenshot", format="png")["data"]
            path = os.path.join(OUT, name)
            with open(path, "wb") as f:
                f.write(base64.b64decode(png))
            return path

        call("Runtime.enable"); call("Log.enable"); call("Page.enable")
        results, ok = {}, True

        def check(name, cond, detail=""):
            nonlocal ok
            ok &= bool(cond)
            print(f"{'PASS' if cond else 'FAIL'}  {name}{'  ' + str(detail) if detail else ''}")

        # 1. plain load: whole chart in view
        call("Page.navigate", url=URL)
        st = wait_ready()
        people = js("Object.keys(window.crownline.layout.people).length")
        check("chart mounted", st and st["cards"] >= people > 0, st and f"{st['cards']} cards, {people} people")
        # the person the link and zoom checks use: the first with a portrait, viewed at its centre
        who = js("""(() => { const ps = window.crownline.layout.people;
            const id = Object.keys(ps).find(k => ps[k].portrait); const [l, t, r, b] = ps[id].rect;
            return [id, Math.round((l + r) / 2), Math.round((t + b) / 2)]; })()""")
        pid, vx, vy = who
        check("all images loaded", st and st["done"] == st["imgs"], st and f"{st['done']}/{st['imgs']}")
        check("no status message", st and not st["status"], st and st["status"])
        fonts = js("[...document.fonts].map(f => f.family + ':' + f.status)")
        check("fonts loaded", fonts and all(f.endswith(":loaded") for f in fonts), fonts)
        cam = js("(() => { const c = window.crownline.cam; return [c.s, c.fitView().s]; })()")
        check("first view fits the chart", cam and abs(cam[0] - cam[1]) < 1e-9 and cam[0] > 0.05, cam)
        pics = js("""(() => { const sh = window.crownline.shadowRoot;
            return [...sh.querySelectorAll('img')].map(i => i.src).filter(s => /portraits\\//.test(s)); })()""")
        small = [p for p in pics if p.endswith("-64.webp")]
        check("portraits start small", pics and len(small) == len(pics), f"{len(small)}/{len(pics)} at 64 px")
        kb = js("Math.round(performance.getEntriesByType('resource').filter(r => /portraits\\//.test(r.name))"
                ".reduce((a, r) => a + r.transferSize, 0) / 1024)")
        print(f"      portrait bytes on first view: {kb} KB")
        full = js("performance.getEntriesByType('resource').filter(r => /portraits\\/[^/]+\\.jpe?g/.test(r.name)).length")
        check("no full-size portrait fetched for the first view", full == 0, f"{full} fetched")
        results["fit"] = shot("1-fit.png")

        # 2. zoom in on the middle with the keyboard
        js("window.crownline.focus(); window.crownline.dispatchEvent(new KeyboardEvent('keydown', {key: '+', bubbles: true}))")
        time.sleep(0.8)
        s2 = js("window.crownline.cam.s")
        check("keyboard zoom", s2 and s2 > cam[0] * 1.2, s2)

        # 2b. shift-drag a box: the view zooms so that box fills the screen
        js("window.crownline.cam.set(window.crownline.cam.fitView(), false)")
        top = js("window.crownline.getBoundingClientRect().top")
        for typ, x, y in (("mousePressed", 300, 300), ("mouseMoved", 400, 360), ("mouseMoved", 500, 420),
                          ("mouseReleased", 500, 420)):
            call("Input.dispatchMouseEvent", type=typ, x=x, y=y + top, modifiers=8, button="left",
                 buttons=0 if typ == "mouseReleased" else 1, clickCount=1)
        time.sleep(1.5)
        s3 = js("window.crownline.cam.s")
        check("shift-drag zooms into the box", s3 and s3 > cam[0] * 4, s3)

        # 3. a shared link opens the same place and selection
        call("Page.navigate", url="about:blank"); time.sleep(0.5)
        call("Page.navigate", url=URL.split("#")[0] + f"#@{vx},{vy},150&p={pid}"); time.sleep(0.5)
        st = wait_ready()
        view = js("(() => { const c = window.crownline.cam, [x, y] = c.centre(); return [x, y, c.s]; })()")
        check("link restores the view", view and abs(view[0] - vx) < 2 and abs(view[1] - vy) < 2
              and abs(view[2] - 1.5) < 1e-6, view)
        sel = js("getComputedStyle(window.crownline.shadowRoot.getElementById('sel')).display")
        check("link restores the selection", sel == "block" and f"p={pid}" in st["hash"], st["hash"])
        results["link"] = shot("2-link.png")
        # 4. zoom to someone with a public portrait: the portraits on screen must swap to sharper copies
        js(f"window.crownline.flyToPerson('{pid}')")
        time.sleep(2.5)
        near = js("""(() => { const sh = window.crownline.shadowRoot, r = window.crownline.getBoundingClientRect();
            return [...sh.querySelectorAll('img')].filter(i => /portraits\\//.test(i.src)).filter(i => {
              const b = i.getBoundingClientRect(); return b.right > r.left && b.left < r.right && b.bottom > r.top && b.top < r.bottom;
            }).map(i => i.src.split('/').pop()); })()""")
        check("portraits on screen sharpen when zoomed", near and all(not p.endswith("-64.webp") for p in near), near)
        results["sharp"] = shot("3-sharp.png")

        check("no errors logged", not errors, errors[:5])
        print(json.dumps(results, indent=1))
        return 0 if ok else 1
    finally:
        proc.terminate()


if __name__ == "__main__":
    sys.exit(main())

"""Build the chart, check its layout, and render it to PNG + PDF with headless Chrome/Edge.

    python render.py             # full-size PNG (2x) + PDF
    python render.py --preview   # quick 1x PNG only
    python render.py --force     # render even if the layout check reports errors

Set CHART_PUBLIC=1 for a public build (wangsa-mataram-public.*): the assets marked
private in the chart document's media are left out, without moving anything.

Set CHART_BROWSER to a Chrome/Edge executable to override the browser lookup.
"""
import math
import os
import pathlib
import shutil
import subprocess
import sys
import tempfile

from PIL import Image

import build

Image.MAX_IMAGE_PIXELS = None
ROOT = pathlib.Path(__file__).parent
TILE = 2400          # max CSS px per tile; very large single screenshots come out blank
TIMEOUT = 420        # seconds per browser call
CANDIDATES = [
    os.environ.get("CHART_BROWSER", ""),
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    os.path.expandvars(r"%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"),
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    shutil.which("chrome") or "", shutil.which("msedge") or "",
    shutil.which("chromium") or "", shutil.which("google-chrome") or "",
]


def browser():
    for b in CANDIDATES:
        if b and os.path.exists(b):
            return b
    sys.exit("No Chrome/Edge found; set CHART_BROWSER")


def run(args, profile):
    cmd = [browser(), "--headless=new", "--disable-gpu", "--hide-scrollbars", f"--user-data-dir={profile}",
           "--allow-file-access-from-files", "--virtual-time-budget=8000"] + args
    try:
        subprocess.run(cmd, check=True, capture_output=True, timeout=TIMEOUT)
    except subprocess.CalledProcessError as err:
        sys.exit(f"browser failed ({err.returncode}):\n{err.stderr.decode(errors='replace')[-2000:]}")
    except subprocess.TimeoutExpired:
        sys.exit(f"browser timed out after {TIMEOUT}s")


def splits(total):
    """equal-sized tiles no larger than TILE"""
    n = math.ceil(total / TILE)
    edges = [round(i * total / n) for i in range(n + 1)]
    return list(zip(edges, edges[1:]))


def screenshot_tiled(html_path, png, scale, work, profile):
    """Screenshot the page tile by tile (shifting the chart under a fixed window) and stitch."""
    src = html_path.read_text(encoding="utf-8")
    out = Image.new("RGB", (build.W * scale, build.HGT * scale))
    tmp = html_path.with_name(f"_tile_{os.getpid()}.html")      # beside the page so assets resolve
    try:
        for y0, y1 in splits(build.HGT):
            for x0, x1 in splits(build.W):
                tw, th = x1 - x0, y1 - y0
                css = (f"<style>html,body{{width:{tw}px;height:{th}px;overflow:hidden}}"
                       f"#chart{{position:absolute;left:{-x0}px;top:{-y0}px}}</style></head>")
                tmp.write_text(src.replace("</head>", css, 1), encoding="utf-8")
                shot = work / f"tile_{x0}_{y0}.png"
                run([f"--screenshot={shot}", f"--window-size={tw},{th}",
                     f"--force-device-scale-factor={scale}", tmp.resolve().as_uri()], profile)
                with Image.open(shot) as im:
                    want = (tw * scale, th * scale)
                    if im.size != want:
                        sys.exit(f"tile {x0},{y0}: got {im.size}, expected {want}")
                    out.paste(im.convert("RGB"), (x0 * scale, y0 * scale))
    finally:
        tmp.unlink(missing_ok=True)
    out.save(png, optimize=True)


def main():
    errs, _ = build.build()
    if errs and "--force" not in sys.argv:
        sys.exit(f"layout check found {len(errs)} errors; fix them or pass --force")
    html_path = ROOT / (build.OUT_NAME + ".html")
    preview = "--preview" in sys.argv
    scale = 1 if preview else 2
    png = ROOT / (build.OUT_NAME + ("-preview.png" if preview else ".png"))
    with tempfile.TemporaryDirectory(prefix="wm_render_") as tmpdir:
        work = pathlib.Path(tmpdir)
        profile = work / "profile"
        screenshot_tiled(html_path, png, scale, work, profile)
        print("wrote", png)
        if not preview:
            pdf = ROOT / (build.OUT_NAME + ".pdf")
            run([f"--print-to-pdf={pdf}", "--no-pdf-header-footer", html_path.resolve().as_uri()], profile)
            print("wrote", pdf)


if __name__ == "__main__":
    main()

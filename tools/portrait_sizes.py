"""Make small WebP copies of the portraits a chart page uses, so the viewer can load light images first.

    python tools/portrait_sizes.py [PAGE.html ...] [--out DIR]
        default page: <CHART_PAGE or the chart's id>-public.html     default out: .cache/portraits
Writes <name>-64.webp and <name>-160.webp for every assets/portraits/<name>.<ext> the page references
(a chart's own set, assets/portraits/<set>/<name>.<ext>, goes to <set>/<name>-64.webp and so on)
(and only those, so a public page never pulls in a private portrait). The original file stays the largest
size. Files already newer than their source are skipped.
"""
import os, re, sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SIZES = (64, 160)
PORTRAIT = re.compile(r'src="assets/portraits/((?:[A-Za-z0-9_-]+/)?[A-Za-z0-9_-]+)\.(jpe?g|png|webp)"')


def used(page):
    with open(page, encoding="utf-8") as f:
        return sorted(set(PORTRAIT.findall(f.read())))


def make(pages, out):
    os.makedirs(out, exist_ok=True)
    made = kept = 0
    for name, ext in sorted({p for page in pages for p in used(page)}):
        src = os.path.join(ROOT, "assets", "portraits", f"{name}.{ext}")
        for size in SIZES:
            dst = os.path.join(out, f"{name}-{size}.webp")
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            if os.path.exists(dst) and os.path.getmtime(dst) >= os.path.getmtime(src):
                kept += 1; continue
            with Image.open(src) as im:
                im = im.convert("RGB")
                side = min(im.size)  # the card crops to a square (object-fit: cover)
                left, top = (im.width - side) // 2, (im.height - side) // 2
                im = im.crop((left, top, left + side, top + side)).resize((size, size), Image.LANCZOS)
                im.save(dst, "WEBP", quality=82, method=6)
            made += 1
    return made, kept


if __name__ == "__main__":
    args = sys.argv[1:]
    out = os.path.join(ROOT, ".cache", "portraits")
    if "--out" in args:
        i = args.index("--out"); out = os.path.abspath(args[i + 1]); del args[i:i + 2]
    if not args:
        sys.path.insert(0, ROOT)
        import chartfile
        args = [os.path.join(ROOT, (os.environ.get("CHART_PAGE") or chartfile.CHART_ID + "-public") + ".html")]
    pages = [os.path.abspath(a) for a in args]
    made, kept = make(pages, out)
    print(f"portraits: {made} written, {kept} up to date -> {out}")

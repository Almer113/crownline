// Portraits in several sizes (PLAN Phase 2.4). The page starts with small WebP copies made by
// tools/portrait_sizes.py; once the view settles, each portrait on screen is raised to the smallest copy
// that is sharp at the current zoom and pixel density, and finally to the original. Never lowered again.
// A missing copy falls back to the original, so a page without copies still works.

// assets/portraits/<name>.jpg, or a chart's own set: assets/portraits/<set>/<name>.jpg (copies: <set>/<name>-64.webp)
const PORTRAIT = /\/assets\/portraits\/((?:[A-Za-z0-9_-]+\/)?[A-Za-z0-9_-]+)\.(?:jpe?g|png|webp)$/;

interface Entry { img: HTMLImageElement; name: string; full: string; tier: number }

export class Portraits {
  private readonly entries: Entry[] = [];

  /** `base` is where <name>-<size>.webp copies live; `sizes` ascending, e.g. [64, 160] */
  constructor(root: ParentNode, private readonly base: string, private readonly sizes: number[]) {
    for (const img of Array.from(root.querySelectorAll("img"))) {
      const m = PORTRAIT.exec(new URL(img.src, location.href).pathname);
      if (!m) continue;
      const e: Entry = { img, name: m[1], full: img.src, tier: 0 };
      img.addEventListener("error", () => { if (img.src !== e.full) { e.tier = sizes.length; img.src = e.full; } });
      img.src = this.url(e, 0);
      this.entries.push(e);
    }
  }

  get count(): number { return this.entries.length; }

  private url(e: Entry, tier: number): string {
    return tier < this.sizes.length ? new URL(`${e.name}-${this.sizes[tier]}.webp`, this.base).href : e.full;
  }

  /** raise the portraits in (or near) the viewport to the size the zoom needs */
  refresh(scale: number, viewport: DOMRect): void {
    const dpr = window.devicePixelRatio || 1, mx = viewport.width / 2, my = viewport.height / 2;
    for (const e of this.entries) {
      const need = e.img.offsetWidth * scale * dpr;
      let tier = this.sizes.findIndex(s => s >= need);
      if (tier < 0) tier = this.sizes.length;
      if (tier <= e.tier) continue;
      const r = e.img.getBoundingClientRect();
      if (r.right < viewport.left - mx || r.left > viewport.right + mx ||
          r.bottom < viewport.top - my || r.top > viewport.bottom + my) continue;
      e.tier = tier;
      // load and decode first, so the smaller picture stays until the sharper one can replace it at once
      const next = new Image(), url = this.url(e, tier);
      next.src = url;
      next.decode().then(() => { if (e.tier === tier) e.img.src = url; },
                         () => { if (url !== e.full) { e.tier = this.sizes.length; e.img.src = e.full; } });
    }
  }
}

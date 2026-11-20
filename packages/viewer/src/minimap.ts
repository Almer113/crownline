// Minimap: the whole chart drawn small from the layout file (boxes and lines, no image needed),
// with the current view as a frame. Click or drag on it to move the view.
import type { Camera } from "./camera";
import type { Layout } from "./layout";

export class Minimap {
  readonly el: HTMLCanvasElement;
  private scale = 1;
  private base?: ImageBitmap | HTMLCanvasElement;

  constructor(private readonly layout: Layout, private readonly cam: Camera, width = 240) {
    const [W, H] = layout.canvas;
    this.scale = width / W;
    this.el = document.createElement("canvas");
    const dpr = devicePixelRatio || 1;
    this.el.width = Math.round(width * dpr);
    this.el.height = Math.round(H * this.scale * dpr);
    this.el.style.width = `${width}px`;
    this.el.style.height = `${Math.round(H * this.scale)}px`;
    this.el.className = "minimap";
    this.el.setAttribute("role", "img");
    this.el.setAttribute("aria-label", "Overview of the whole chart. Click to move there.");
    this.drawBase(dpr);
    let dragging = false;
    const go = (e: PointerEvent) => {
      const r = this.el.getBoundingClientRect();
      const cx = (e.clientX - r.left) / this.scale, cy = (e.clientY - r.top) / this.scale;
      this.cam.set(this.cam.viewAt(cx, cy, this.cam.s), true);   // moving: sharpen once the drag settles
    };
    this.el.addEventListener("pointerdown", e => { dragging = true; this.el.setPointerCapture(e.pointerId); go(e); e.stopPropagation(); });
    this.el.addEventListener("pointermove", e => { if (dragging) go(e); });
    this.el.addEventListener("pointerup", () => { dragging = false; });
    this.el.addEventListener("pointercancel", () => { dragging = false; });
  }

  private drawBase(dpr: number): void {
    const c = document.createElement("canvas");
    c.width = this.el.width; c.height = this.el.height;
    const g = c.getContext("2d")!;
    const k = this.scale * dpr;
    g.fillStyle = "#EDE8D8"; g.fillRect(0, 0, c.width, c.height);
    g.lineWidth = Math.max(0.6, 2 * k);
    for (const ln of this.layout.lines) {
      g.strokeStyle = ln.colour; g.globalAlpha = 0.55; g.beginPath();
      ln.points.forEach(([x, y], i) => (i ? g.lineTo(x * k, y * k) : g.moveTo(x * k, y * k)));
      g.stroke();
    }
    g.globalAlpha = 1;
    for (const p of Object.values(this.layout.people)) {
      const [l, t, r, b] = p.rect;
      g.fillStyle = p.kind === "text" ? "#9A9078" : p.colour;
      g.fillRect(l * k, t * k, Math.max(1, (r - l) * k), Math.max(1, (b - t) * k));
    }
    this.base = c;
  }

  /** redraw the view frame (cheap: copies the base drawing) */
  update(vw: number, vh: number): void {
    const g = this.el.getContext("2d")!, dpr = devicePixelRatio || 1, k = this.scale * dpr;
    if (this.base) g.drawImage(this.base, 0, 0);
    const x = (-this.cam.tx / this.cam.s) * k, y = (-this.cam.ty / this.cam.s) * k;
    const w = (vw / this.cam.s) * k, h = (vh / this.cam.s) * k;
    g.strokeStyle = "#1F1F1F"; g.lineWidth = 1.5 * dpr;
    g.fillStyle = "rgba(31,31,31,.08)";
    g.fillRect(x, y, w, h); g.strokeRect(x, y, w, h);
  }
}

// Camera: which part of the chart is on screen. `s` is the zoom (screen px per chart px);
// (tx, ty) is where the chart's top-left corner sits on screen.
import type { Rect } from "./layout";

export interface View { s: number; tx: number; ty: number }

export const MIN_ZOOM_FACTOR = 0.5;   // relative to "fit": may zoom out to half the fitted size
export const MAX_ZOOM = 4;            // 400% of chart pixels

export class Camera {
  s = 1; tx = 0; ty = 0;
  private anim = 0;
  /** the running flight's promise: settled when it ends or is interrupted, so nobody waits forever */
  private done: (() => void) | null = null;

  constructor(private readonly onChange: (moving: boolean) => void,
              private chartW = 1, private chartH = 1, private vw = 1, private vh = 1) {}

  setSizes(chartW: number, chartH: number, vw: number, vh: number): void {
    Object.assign(this, { chartW, chartH, vw, vh });
  }

  fitZoom(): number { return Math.min(this.vw / this.chartW, this.vh / this.chartH); }
  minZoom(): number { return this.fitZoom() * MIN_ZOOM_FACTOR; }

  /** the view that shows `r` (chart px) centred, with a margin in screen px; `top` and `bottom` are screen
   *  bands kept clear (a toolbar, a caption card), so `r` is centred in what is left between them */
  viewFor(r: Rect, margin = 40, maxZoom = 1.5, top = 0, bottom = 0): View {
    const [l, t, rr, b] = r, h = Math.max(80, this.vh - top - bottom);
    const s = Math.min(maxZoom, (this.vw - 2 * margin) / (rr - l), (h - 2 * margin) / (b - t));
    return { s, tx: this.vw / 2 - ((l + rr) / 2) * s, ty: top + h / 2 - ((t + b) / 2) * s };
  }

  fitView(): View { return this.viewFor([0, 0, this.chartW, this.chartH], 16, Infinity); }

  /** chart point at the centre of the screen */
  centre(): [number, number] { return [(this.vw / 2 - this.tx) / this.s, (this.vh / 2 - this.ty) / this.s]; }

  viewAt(cx: number, cy: number, s: number): View {
    // limit the zoom first, so the centre asked for stays the centre (a link with zoom 9999 or 0.001)
    s = Math.min(MAX_ZOOM, Math.max(this.minZoom(), s));
    cx = Math.min(this.chartW, Math.max(0, cx)); cy = Math.min(this.chartH, Math.max(0, cy));
    return { s, tx: this.vw / 2 - cx * s, ty: this.vh / 2 - cy * s };
  }

  set(v: View, moving = true): void {
    const s = Math.min(MAX_ZOOM, Math.max(this.minZoom(), v.s));
    // keep at least a quarter of the screen on the chart, so it can't be lost off-screen
    const mx = this.vw * 0.75, my = this.vh * 0.75;
    const tx = Math.min(mx, Math.max(this.vw - mx - this.chartW * s, v.tx));
    const ty = Math.min(my, Math.max(this.vh - my - this.chartH * s, v.ty));
    this.s = s; this.tx = tx; this.ty = ty;
    this.onChange(moving);
  }

  zoomAt(factor: number, sx: number, sy: number): void {
    this.stop();
    const s = Math.min(MAX_ZOOM, Math.max(this.minZoom(), this.s * factor));
    this.set({ s, tx: sx - (sx - this.tx) * (s / this.s), ty: sy - (sy - this.ty) * (s / this.s) });
  }

  panBy(dx: number, dy: number): void { this.stop(); this.set({ s: this.s, tx: this.tx + dx, ty: this.ty + dy }); }

  stop(): void { cancelAnimationFrame(this.anim); this.anim = 0; const d = this.done; this.done = null; d?.(); }

  /** animated move: zooms out and back in on long trips (van Wijk & Nuij style, simplified) */
  flyTo(v: View, ms = 700): Promise<void> {
    this.stop();
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) { this.set(v, false); return Promise.resolve(); }
    const a = { s: this.s, c: this.centre() };
    const b = { s: v.s, c: [(this.vw / 2 - v.tx) / v.s, (this.vh / 2 - v.ty) / v.s] as [number, number] };
    const dist = Math.hypot(b.c[0] - a.c[0], b.c[1] - a.c[1]);
    const span = Math.max(this.vw / a.s, this.vw / b.s);
    const out = Math.max(1, dist / span);                   // how far to zoom out mid-flight
    const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    return new Promise(resolve => {
      this.done = resolve;
      const t0 = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - t0) / ms), e = ease(t);
        const bump = 1 + (out - 1) * Math.sin(Math.PI * t);  // 1 at both ends
        const s = Math.exp(Math.log(a.s) + (Math.log(b.s) - Math.log(a.s)) * e) / bump;
        const cx = a.c[0] + (b.c[0] - a.c[0]) * e, cy = a.c[1] + (b.c[1] - a.c[1]) * e;
        this.set(this.viewAt(cx, cy, s), t < 1);
        if (t < 1) this.anim = requestAnimationFrame(step); else { this.anim = 0; this.done = null; resolve(); }
      };
      this.anim = requestAnimationFrame(step);
    });
  }
}

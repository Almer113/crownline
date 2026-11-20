// The position diff (PLAN 7c): which cards moved, and by how much, since the chart was opened or last saved.
// This is the check that was done by script on this project (tests/layout_snapshot.py), live.
import { TOL, type Lock, type Rect } from "@crownline/engine";
import { h, render, textOf } from "./dom.ts";
import type { Editor } from "./editor.ts";

export interface CardMove { id: string; what: "moved" | "resized" | "new" | "gone"; dx: number; dy: number; was: Rect | null; now: Rect | null }

const mid = (r: number[]) => [(r[0] + r[2]) / 2, (r[1] + r[3]) / 2];

/** the cards that differ between two locks (more than the lock's tolerance) */
export function cardMoves(from: Lock, to: Lock): CardMove[] {
  const out: CardMove[] = [];
  const a = from.boxes as Record<string, Rect>, b = to.boxes as Record<string, Rect>;
  for (const [id, r] of Object.entries(b)) {
    const o = a[id];
    if (!o) { out.push({ id, what: "new", dx: 0, dy: 0, was: null, now: r }); continue; }
    const [ox, oy] = mid(o), [nx, ny] = mid(r), dx = nx - ox, dy = ny - oy;
    const dw = Math.abs((r[2] - r[0]) - (o[2] - o[0])) + Math.abs((r[3] - r[1]) - (o[3] - o[1]));
    if (Math.abs(dx) > TOL || Math.abs(dy) > TOL) out.push({ id, what: "moved", dx, dy, was: o, now: r });
    else if (dw > TOL) out.push({ id, what: "resized", dx: 0, dy: 0, was: o, now: r });
  }
  for (const [id, o] of Object.entries(a)) if (!b[id]) out.push({ id, what: "gone", dx: 0, dy: 0, was: o, now: null });
  const size = (m: CardMove) => (m.what === "moved" ? Math.abs(m.dx) + Math.abs(m.dy) : m.what === "new" ? 1e6 : m.what === "gone" ? 1e5 : 0);
  return out.sort((p, q) => size(q) - size(p) || p.id.localeCompare(q.id));
}

/** "12 px right, 4 px down" */
export function moveWords(m: CardMove): string {
  if (m.what !== "moved") return { new: "new", gone: "deleted (its space stays until a re-layout)", resized: "changed size, same place" }[m.what];
  const part = (v: number, neg: string, pos: string) => (Math.abs(v) > TOL ? `${Math.round(Math.abs(v))} px ${v < 0 ? neg : pos}` : "");
  return [part(m.dx, "left", "right"), part(m.dy, "up", "down")].filter(Boolean).join(", ");
}

export class MovesPanel {
  readonly el = h("section", { class: "moves", "aria-label": "Moves" });
  readonly badge = h("span", { class: "badge" });

  constructor(private readonly ed: Editor, private readonly hooks: { fly: (id: string) => void; show: (ms: CardMove[]) => void }) {
    ed.on(what => { if (what === "result" || what === "saved") this.fill(); });
    this.fill();
  }

  fill(): void {
    const ed = this.ed, base = ed.baseline, now = ed.result.lock;
    const name = (id: string) => textOf(ed.doc.people[id]?.name, ed.lang) || id;
    if (!base || !now) { render(this.el, h("p", { class: "empty" }, "Nothing drawn yet.")); this.badge.textContent = ""; return; }
    const ms = cardMoves(base, now), moved = ms.filter(m => m.what !== "resized");
    this.badge.textContent = moved.length ? String(moved.length) : "";
    this.badge.className = "badge warning";
    render(this.el,
      h("p", { class: "hint" }, ed.frozen
        ? "Compared with the chart as it was opened or last saved. Under the kept layout only what you change should move."
        : "The automatic layout, compared with the chart as it was opened or last saved."),
      ms.length ? h("button", { type: "button", onclick: () => this.hooks.show(ms) }, "Outline where they were") : h("p", { class: "empty" }, "No card has moved."),
      h("ul", {}, ...ms.map(m => h("li", { class: m.what },
        h("button", { type: "button", disabled: m.what === "gone", onclick: () => { ed.select(m.id); this.hooks.fly(m.id); } },
          h("span", {}, name(m.id)), h("small", {}, moveWords(m)))))));
  }
}

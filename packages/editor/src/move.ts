// Moving things on the chart by hand (PLAN 7b). Drag the selected card sideways: it snaps to its parent's and
// siblings' lines; on release the editor asks whether the card moves alone or with everyone below, and whether
// the move should survive a later re-layout. With a kept layout (frozen mode) the move changes the lock; an
// adjustment (`nudge`, with a reason) is recorded when it should survive. Drag a note: a `noteOffset`.
// Every move is one undo step.
import type { Rect } from "@crownline/engine";
import { below, besideOf, findAdjustment, nudge, setAdjustment, shiftLock, treeChildren, together, type Op } from "@crownline/ops";
import type { CrownlineViewer } from "@crownline/viewer";
import { askMove } from "./dialog.ts";
import { textOf } from "./dom.ts";
import type { Editor } from "./editor.ts";

const SNAP = 10;                        // chart px
const r1 = (v: number) => Math.round(v * 10) / 10;
const plain = (s: string) => s.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();

interface CardDrag { kind: "card"; id: string; moving: string[]; x0: number; snaps: number[]; dx: number }
interface NoteDrag { kind: "note"; id: string; rect: Rect; dx: number; dy: number }

export function bindMoves(ed: Editor, viewer: CrownlineViewer, done: () => void): void {
  let drag: CardDrag | NoteDrag | null = null;
  const layout = () => ed.result.layout;
  const name = (id: string) => textOf(ed.doc.people[id]?.name, ed.lang) || id;
  /** where the line into a person comes down (the lock's drop), else the middle of their card */
  const lineX = (id: string): number | null => {
    const d = ed.lock?.drops[id] ?? Object.entries(ed.lock?.drops ?? {}).find(([k]) => k.startsWith(id + "@"))?.[1];
    if (d && ed.frozen) return d[0];
    const r = layout()?.people[id]?.rect;
    return r ? (r[0] + r[2]) / 2 : null;
  };
  const parentOf = (id: string): string | null => {
    for (const d of Object.values(ed.doc.descents ?? {})) {
      if (d.child !== id || d.show?.hop || d.show?.branch || d.show?.row) continue;
      if (d.parent) return d.parent;
      if (d.union) return ed.doc.unions?.[d.union]?.partners[0] ?? null;
    }
    return null;
  };

  viewer.addEventListener("editdown", e => {
    const ev = e as CustomEvent<{ id: string | null; x: number; y: number }>, { id, x, y } = ev.detail, L = layout();
    if (!L || ed.building) return;
    if (id && id === ed.selected && !ed.doc.people[id]?.show.beside) {
      ev.preventDefault();
      const p = parentOf(id), sibs = p ? treeChildren(ed.doc, p).filter(k => k !== id) : [];
      const snaps = [p, ...sibs].filter((k): k is string => !!k).map(lineX).filter((v): v is number => v !== null);
      drag = { kind: "card", id, moving: [id, ...below(ed.doc, id)], x0: lineX(id) ?? x, snaps, dx: 0 };
      return;
    }
    if (!id) {
      const n = L.notes.find(n => x >= n.rect[0] && x <= n.rect[2] && y >= n.rect[1] && y <= n.rect[3]);
      const nid = n && Object.entries(ed.doc.notes ?? {}).find(([, d]) => d.anchor === n.anchor && plain(textOf(d.text, ed.lang)) === plain(n.text))?.[0];
      if (n && nid) { ev.preventDefault(); drag = { kind: "note", id: nid, rect: n.rect, dx: 0, dy: 0 }; }
    }
  });

  viewer.addEventListener("editmove", e => {
    const { dx, dy } = (e as CustomEvent<{ dx: number; dy: number }>).detail;
    if (!drag) return;
    if (drag.kind === "card") {
      let mx = dx, guide: number[] = [];
      const near = drag.snaps.map(s => [s, s - (drag as CardDrag).x0] as const).filter(([, d]) => Math.abs(d - dx) < SNAP)
        .sort((a, b) => Math.abs(a[1] - dx) - Math.abs(b[1] - dx))[0];
      if (near) { mx = near[1]; guide = [near[0]]; }
      drag.dx = mx;
      viewer.preview({ ids: drag.moving, dx: mx, guides: guide });
    } else {
      drag.dx = dx; drag.dy = dy;
      viewer.preview({ ids: [], dx, dy, rect: drag.rect });
    }
  });

  viewer.addEventListener("editcancel", () => { drag = null; viewer.preview(null); });

  viewer.addEventListener("editup", () => {
    const d = drag;
    drag = null;
    if (!d) return;
    void (d.kind === "card" ? dropCard(d) : dropNote(d)).finally(() => { viewer.preview(null); done(); });
  });

  async function dropCard(d: CardDrag): Promise<void> {
    const dx = r1(d.dx);
    if (Math.abs(dx) < 0.5) return;
    const doc = ed.doc, n = d.moving.length - 1 - besideOf(doc, d.id).length, frozen = ed.frozen && !!ed.lock;
    const a = await askMove(`Move ${name(d.id)} ${Math.abs(Math.round(dx))} px ${dx < 0 ? "left" : "right"}`, {
      scopes: n > 0 ? [`${name(d.id)} and everyone below (${n} more)`, `Only ${name(d.id)}${besideOf(doc, d.id).length ? " and who is drawn beside them" : ""}`] : undefined,
      canSkipKeep: frozen, reason: (findAdjustment(doc, "nudge", d.id)?.[1].reason) });
    if (!a) return;
    // the kept layout went while the question was open (a change outside the editor): the move is not made
    if (frozen && !ed.lock) return;
    const card = [d.id, ...besideOf(doc, d.id)];
    const moving = a.scope === "card" || n === 0 ? card : d.moving;
    const label = `Move ${name(d.id)}${moving.length > card.length ? " and their branch" : ""}`;
    ed.history.begin(label);
    try {
      if (frozen) ed.runLock(label, shiftLock(ed.lock!, moving, dx));
      if (a.keep || !frozen) {
        // a nudge moves the person with everyone below; moving the card alone takes it back from their children
        const ops: Op[] = [nudge(doc, d.id, dx, a.reason)];
        if (moving === card) for (const k of treeChildren(doc, d.id)) if (!card.includes(k)) ops.push(nudge(doc, k, -dx, a.reason || `stays put when ${name(d.id)} moves`));
        ed.run(together(label, ops));
      }
    } finally { ed.history.end(); }
  }

  async function dropNote(d: NoteDrag): Promise<void> {
    const dx = r1(d.dx), dy = r1(d.dy);
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;
    const had = findAdjustment(ed.doc, "noteOffset", d.id)?.[1] as { dx?: number; dy?: number; reason: string } | undefined;
    const a = await askMove("Move this note", { canSkipKeep: false, reason: had?.reason });
    if (!a) return;
    const nx = r1((had?.dx ?? 0) + dx), ny = r1((had?.dy ?? 0) + dy), fields: Record<string, number> = {};
    if (nx) fields.dx = nx;
    if (ny) fields.dy = ny;
    ed.run(setAdjustment(ed.doc, "noteOffset", d.id, fields, a.reason, "Move a note"));
  }
}

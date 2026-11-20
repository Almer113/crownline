// Re-layout on request (PLAN 7c). Under the kept layout nothing moves by itself; this lays out again the whole
// chart, a branch, a house or a generation band, shows the result with where the cards were, counts who moves,
// and changes the lock only when accepted (one undo step). A part is laid out automatically and placed so its
// first person stays where they are; the rest of the chart keeps its lock.
import { showPage } from "./store.ts";
import type { Lock, Rect } from "@crownline/engine";
import { below } from "@crownline/ops";
import type { CrownlineViewer } from "@crownline/viewer";
import type { Layout } from "@crownline/viewer/layout";
import { choose } from "./dialog.ts";
import { h, render, textOf } from "./dom.ts";
import type { Editor } from "./editor.ts";
import { cardMoves, moveWords } from "./moves.ts";

type Keyed = Record<string, number[]>;
const BY_PERSON = ["boxes", "pills", "crowns", "headers"] as const;

/** the lock with these people's records taken from another lock, moved by (dx, dy) */
function merged(lock: Lock, auto: Lock, ids: Set<string>, dx: number, dy: number): Lock {
  const out = structuredClone(lock) as Lock;
  const move = (v: number[], xs: number[], ys: number[]) => v.map((c, i) => Math.round((c + (xs.includes(i) ? dx : ys.includes(i) ? dy : 0)) * 10) / 10);
  for (const sec of BY_PERSON) {
    const o = out[sec] as Keyed, a = auto[sec] as Keyed;
    for (const id of ids) {
      if (a[id]) o[id] = move(a[id], [0, 2], [1, 3]);
      else delete o[id];
    }
  }
  const od = out.drops as Keyed, ad = auto.drops as Keyed;
  for (const k of Object.keys(od)) if (ids.has(k.split("@")[0])) delete od[k];
  for (const [k, v] of Object.entries(ad)) if (ids.has(k.split("@")[0])) od[k] = move(v, [0], [1]);
  return out;
}

export function bindRelayout(ed: Editor, viewer: CrownlineViewer, bar: HTMLElement, fly: (id: string) => void): { start: () => Promise<void> } {
  let pending: { lock: Lock; label: string } | null = null;
  const name = (id: string) => textOf(ed.doc.people[id]?.name, ed.lang) || id;

  const close = (restore: boolean) => {
    pending = null; bar.hidden = true; viewer.preview(null);
    if (restore && ed.result.html && ed.result.layout) void showPage(viewer, ed.store, ed.result.html, ed.result.layout);
  };
  // any edit while a proposal is shown ends it: the proposal was made for the document before the edit
  // (the page is put back: an edit that does not change the drawing, or cannot be drawn, brings no new page)
  let edits = 0;
  ed.on(what => { if (what !== "doc") return; edits++; if (pending) close(true); });
  const changed = async (n: number) => {
    if (n === edits) return false;
    await choose("Re-layout", "The chart changed while it was being laid out: choose Re-layout… again.", [["ok", "OK"]]);
    return true;
  };

  async function start(): Promise<void> {
    const lock = ed.lock;
    if (!lock || !ed.result.lock) return;
    const id = ed.selected, p = id ? ed.doc.people[id] : null, house = p?.house;
    const opts: [string, string][] = [["all", "The whole chart"]];
    if (id) opts.push(["branch", `${name(id)} and everyone below`]);
    if (house) opts.push(["house", `Everyone in the house of ${textOf(ed.doc.houses[house]?.name, ed.lang)}`]);
    if (id && lock.boxes[id]) opts.push(["band", `${name(id)}'s row (everyone level with them)`]);
    const scope = await choose("Re-layout", "Lay out again, automatically. You will see what moves before anything changes.", opts);
    if (!scope) return;
    const n = edits;
    const auto = await ed.probe(structuredClone(ed.doc), null);
    if (await changed(n)) return;
    if (auto.type !== "built") { await choose("Re-layout", `The chart cannot be laid out: ${auto.message}.`, [["ok", "OK"]]); return; }
    let proposed: Lock, label: string;
    if (scope === "all") { proposed = auto.lock; label = "Re-lay out the whole chart"; }
    else {
      const ids = new Set(scope === "branch" ? [id!, ...below(ed.doc, id!)]
        : scope === "house" ? Object.entries(ed.doc.people).filter(([, q]) => q.house === house).map(([k]) => k)
        : Object.entries(lock.boxes).filter(([, r]) => Math.abs(r[1] - lock.boxes[id!][1]) < 1 || Math.abs(r[3] - lock.boxes[id!][3]) < 1).map(([k]) => k));
      // the part keeps its place: its first person (the one chosen, or the house's top card) stays put
      const anchor = scope === "house"
        ? [...ids].filter(k => lock.boxes[k] && auto.lock.boxes[k]).sort((a, b) => lock.boxes[a][1] - lock.boxes[b][1] || lock.boxes[a][0] - lock.boxes[b][0])[0]
        : id!;
      const o = lock.boxes[anchor], a = auto.lock.boxes[anchor];
      const dx = o && a ? (o[0] + o[2] - a[0] - a[2]) / 2 : 0, dy = o && a ? o[1] - a[1] : 0;
      proposed = merged(lock, auto.lock, ids, dx, dy);
      label = { branch: `Re-lay out ${name(id!)}'s branch`, house: "Re-lay out a house", band: `Re-lay out ${name(id!)}'s row` }[scope as "branch" | "house" | "band"];
    }
    const shown = await ed.probe(structuredClone(ed.doc), proposed);
    if (await changed(n)) return;
    if (shown.type !== "built") { await choose("Re-layout", `The proposal cannot be drawn: ${shown.message}.`, [["ok", "OK"]]); return; }
    const ms = cardMoves(ed.result.lock!, shown.lock).filter(m => m.what === "moved");
    pending = { lock: shown.lock, label };
    await showPage(viewer, ed.store, shown.html, shown.layout as Layout);
    viewer.preview({ ids: [], dx: 0, ghosts: ms.map(m => m.was!).filter((r): r is Rect => !!r) });
    const most = ms[0];
    const errors = shown.issues.filter(i => i.severity === "error").length;
    bar.hidden = false;
    render(bar,
      h("strong", {}, label), " · ",
      ms.length ? `${ms.length} card${ms.length > 1 ? "s" : ""} move${ms.length > 1 ? "" : "s"}` : "nothing moves",
      most ? h("a", { href: "#", onclick: (e: Event) => { e.preventDefault(); fly(most.id); } }, ` (most: ${name(most.id)}, ${moveWords(most)})`) : null,
      errors ? h("span", { class: "warn" }, ` · ${errors} drawing error${errors > 1 ? "s" : ""}`) : null,
      h("small", {}, "Red outlines: where they were."),
      h("button", { type: "button", class: "primary", onclick: () => accept() }, "Accept"),
      h("button", { type: "button", onclick: () => close(true) }, "Cancel"));
  }

  function accept(): void {
    if (!pending) return;
    const { lock, label } = pending;
    close(false);
    viewer.preview(null);
    // the whole lock as drawn, section by section (one undo step)
    const cur = ed.lock as unknown as Record<string, unknown>, next = lock as unknown as Record<string, unknown>;
    const patch = Object.keys({ ...cur, ...next }).filter(k => k !== "$schema" && JSON.stringify(cur[k]) !== JSON.stringify(next[k]))
      .map(k => (k in next ? { op: "set" as const, path: [k], value: next[k] } : { op: "del" as const, path: [k] }));
    ed.runLock(label, patch);
  }

  return { start };
}

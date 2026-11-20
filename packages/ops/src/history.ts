// Undo and redo (research 1.3 decision 4, after tldraw and Excalidraw): History owns the document; every
// change goes through `run`, which applies the operation's patch and keeps the inverse. One gesture is one
// step: `begin`/`end` group what happens in between (a drag), and consecutive edits of one field merge
// (typing a name is one step, not one per letter). Layout results are never in history; they are re-derived.
import type { ChartDoc } from "@crownline/schema";
import { apply, type Patch } from "./patch.ts";
import type { Op } from "./ops.ts";

export interface Entry {
  label: string;
  redo: Patch;
  undo: Patch;
  /** edits with the same key, close together, merge into one entry */
  key?: string;
  at: number;
}

export class History<T extends object = ChartDoc> {
  private past: Entry[] = [];
  private future: Entry[] = [];
  private group: Entry | null = null;
  private depth = 0;
  /** the document as it was last saved (by the entry count): for "unsaved changes" */
  private savedAt = 0;
  private listeners = new Set<(why: "do" | "undo" | "redo") => void>();

  constructor(public doc: T, readonly mergeMs = 1500) {}

  /** apply an operation; `key` merges it with the last step when that one had the same key */
  run(op: Op, key?: string): void {
    if (!op.patch.length) return;
    const undo = apply(this.doc as unknown as Record<string, unknown>, op.patch);
    const now = Date.now();
    if (this.group) {
      this.group.redo.push(...op.patch);
      this.group.undo.unshift(...undo);
    } else {
      const last = this.past[this.past.length - 1];
      if (key && last?.key === key && now - last.at < this.mergeMs && this.past.length > this.savedAt) {
        last.redo.push(...op.patch); last.undo.unshift(...undo); last.at = now;
      } else {
        if (this.savedAt > this.past.length) this.savedAt = -1;      // the saved state was undone past: gone for good
        this.past.push({ label: op.label, redo: [...op.patch], undo, key, at: now });
      }
      this.future = [];
    }
    this.emit("do");
  }

  /** start a gesture: everything until the matching `end` is one step */
  begin(label: string): void {
    if (this.depth++ === 0) this.group = { label, redo: [], undo: [], at: Date.now() };
  }

  end(): void {
    if (--this.depth > 0) return;
    const g = this.group;
    this.group = null;
    if (g && g.redo.length) {
      if (this.savedAt > this.past.length) this.savedAt = -1;
      this.past.push(g); this.future = [];
    }
  }

  /** a gesture abandoned (Esc during a drag): put the document back as it was */
  cancel(): void {
    const g = this.group;
    this.group = null; this.depth = 0;
    if (g?.undo.length) { apply(this.doc as unknown as Record<string, unknown>, g.undo); this.emit("undo"); }
  }

  get canUndo(): boolean { return this.past.length > 0; }
  get canRedo(): boolean { return this.future.length > 0; }
  get undoLabel(): string | null { return this.past[this.past.length - 1]?.label ?? null; }
  get redoLabel(): string | null { return this.future[this.future.length - 1]?.label ?? null; }
  get dirty(): boolean { return this.past.length !== this.savedAt; }

  undo(): void {
    const e = this.past.pop();
    if (!e) return;
    apply(this.doc as unknown as Record<string, unknown>, e.undo);
    this.future.push(e);
    this.emit("undo");
  }

  redo(): void {
    const e = this.future.pop();
    if (!e) return;
    apply(this.doc as unknown as Record<string, unknown>, e.redo);
    e.at = 0;                                                     // never merges with what comes next
    this.past.push(e);
    this.emit("redo");
  }

  /** where the history is now, as a save starts: the last step no longer merges with what is typed next */
  seal(): number { const e = this.past[this.past.length - 1]; if (e) e.at = 0; return this.past.length; }

  /** the document was saved as it was at `at` (from `seal`; now, by default): edits made since stay unsaved */
  markSaved(at = this.past.length): void {
    this.savedAt = at <= this.past.length ? at : -1;
    for (const e of this.past) e.at = 0;
  }

  on(fn: (why: "do" | "undo" | "redo") => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(why: "do" | "undo" | "redo"): void { for (const fn of this.listeners) fn(why); }
}

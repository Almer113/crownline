// Small modal questions (<dialog>): a name for a new person, a choice, a confirmation.
import { h } from "./dom.ts";

export function modal<T>(build: (done: (v: T | null) => void) => HTMLElement[], title: string): Promise<T | null> {
  return new Promise(resolve => {
    const dlg = h("dialog", { class: "ask" });
    let settled = false;
    const done = (v: T | null) => { if (settled) return; settled = true; dlg.close(); dlg.remove(); resolve(v); };
    dlg.append(h("h3", {}, title), ...build(done));
    dlg.addEventListener("cancel", e => { e.preventDefault(); done(null); });
    document.body.append(dlg);
    dlg.showModal();
    dlg.querySelector<HTMLElement>("input, select, button.primary")?.focus();
  });
}

/** fields for a new person: a name, and optionally a choice (which couple, which side) */
export function askPerson(title: string, choice?: { label: string; options: [string, string][] }): Promise<{ name: string; choice?: string } | null> {
  return modal(done => {
    const name = h("input", { type: "text", placeholder: "Name as printed", required: true, "aria-label": "Name" });
    const sel = choice ? h("select", { "aria-label": choice.label }, ...choice.options.map(([v, l]) => h("option", { value: v }, l))) : null;
    const form = h("form", { method: "dialog", onsubmit: (e: Event) => {
      e.preventDefault();
      if (name.value.trim()) done({ name: name.value.trim(), choice: sel?.value });
    } },
      h("label", {}, "Name", name),
      sel ? h("label", {}, choice!.label, sel) : null,
      h("div", { class: "row end" }, h("button", { type: "button", onclick: () => done(null) }, "Cancel"),
        h("button", { class: "primary", type: "submit" }, "Add")));
    return [form];
  }, title);
}

/** one of several answers */
export function choose(title: string, text: string, options: [string, string][]): Promise<string | null> {
  return modal(done => [
    h("p", {}, text),
    h("div", { class: "choices" }, ...options.map(([v, l], i) => h("button", { class: i === 0 ? "primary" : "", type: "button", onclick: () => done(v) }, l))),
    h("div", { class: "row end" }, h("button", { type: "button", onclick: () => done(null) }, "Cancel")),
  ], title);
}

/** yes or no, with what will happen */
export async function confirm(title: string, lines: string[], yes: string): Promise<boolean> {
  return (await modal<boolean>(done => [
    ...lines.map(l => h("p", {}, l)),
    h("div", { class: "row end" }, h("button", { type: "button", onclick: () => done(false) }, "Cancel"),
      h("button", { class: "primary danger", type: "button", onclick: () => done(true) }, yes)),
  ], title)) === true;
}

export interface MoveAnswer { scope: "card" | "branch"; keep: boolean; reason: string }

/** after a drag: what moves (when there is a choice), whether the move survives a re-layout, and why */
export function askMove(title: string, o: { scopes?: [string, string]; canSkipKeep: boolean; reason?: string }): Promise<MoveAnswer | null> {
  return modal<MoveAnswer>(done => {
    const scope = o.scopes ? h("div", { class: "choices" },
      ...(["branch", "card"] as const).map((v, i) => h("label", { class: "radio" },
        h("input", { type: "radio", name: "scope", value: v, checked: i === 0 }), o.scopes![i]))) : null;
    const keep = h("input", { type: "checkbox", checked: !o.canSkipKeep, disabled: !o.canSkipKeep });
    const reason = h("input", { type: "text", value: o.reason ?? "", placeholder: "Why (shown in the adjustments list)", "aria-label": "Reason" });
    const form = h("form", { method: "dialog", onsubmit: (e: Event) => {
      e.preventDefault();
      const s = (form.querySelector("input[name=scope]:checked") as HTMLInputElement | null)?.value as MoveAnswer["scope"] | undefined;
      done({ scope: s ?? "branch", keep: keep.checked, reason: reason.value.trim() });
    } },
      scope,
      h("label", { class: "check" }, keep, o.canSkipKeep ? "Keep this move after a re-layout (records an adjustment)" : "Recorded as an adjustment, so it lasts through a re-layout"),
      h("label", {}, "Reason", reason),
      h("div", { class: "row end" }, h("button", { type: "button", onclick: () => done(null) }, "Cancel"),
        h("button", { class: "primary", type: "submit" }, "Move")));
    return [form];
  }, title);
}

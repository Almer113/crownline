// Every hand correction the document makes to the automatic layout, with its reason: review, explain or remove.
import { removeAdjustment, setField } from "@crownline/ops";
import { h, render, textOf } from "./dom.ts";
import type { Editor } from "./editor.ts";

const WHAT: Record<string, string> = {
  nudge: "Moved", follow: "Placed beside another person", coupleSide: "Couple's children on one side", shareBus: "Shares the parent's line",
  breakAt: "Break mark moved", markerTop: "Note letter at the top", textLift: "Label lifted", headerLeft: "House header on the left",
  noteOffset: "Note moved", drop: "Line level",
};

export class AdjustmentsPanel {
  readonly el = h("section", { class: "adjustments", "aria-label": "Adjustments" });
  private filter = "";

  constructor(private readonly ed: Editor, private readonly fly: (id: string) => void) {
    ed.on(what => { if (what !== "result" && what !== "select" && !this.el.contains(document.activeElement)) this.fill(); });
    this.fill();
  }

  /** the person an adjustment is about: its target, or the person its line, marriage or note belongs to */
  private personOf(target: string): string | null {
    const doc = this.ed.doc;
    if (doc.people[target]) return target;
    const d = doc.descents?.[target];
    if (d) return d.child;
    const u = doc.unions?.[target];
    if (u) return u.partners[0];
    const n = doc.notes?.[target];
    return n?.anchor && doc.people[n.anchor] ? n.anchor : null;
  }

  fill(): void {
    const ed = this.ed, all = Object.entries(ed.doc.adjustments ?? {});
    const name = (id: string | null) => (id ? textOf(ed.doc.people[id]?.name, ed.lang) || id : "");
    const q = this.filter.toLowerCase();
    const rows = all.filter(([k, a]) => !q || [k, a.target, a.reason, name(this.personOf(a.target))].some(s => s.toLowerCase().includes(q)));
    const amount = (a: Record<string, unknown>) => ["dx", "dy", "drop", "at", "side", "of"].filter(f => a[f] !== undefined).map(f => `${f} ${a[f]}`).join(", ");
    render(this.el,
      h("input", { type: "search", placeholder: "Find an adjustment", "aria-label": "Find an adjustment", value: this.filter, "data-key": "adj-filter",
        oninput: (e: Event) => { this.filter = (e.target as HTMLInputElement).value; this.fill(); } }),
      h("small", { class: "count" }, `${rows.length} of ${all.length} adjustments. Each one changes the automatic layout; the reason says why.`),
      h("ul", {}, ...rows.map(([k, a]) => {
        const who = this.personOf(a.target);
        const reason = h("input", { type: "text", value: a.reason, placeholder: "Why?", "aria-label": "Reason", "data-key": `adj:${k}` });
        reason.addEventListener("input", () => ed.run(setField(["adjustments", k, "reason"], reason.value, "Change an adjustment's reason"), `adj:${k}`));
        return h("li", {},
          h("div", { class: "row" },
            h("button", { type: "button", class: "link", disabled: !who, onclick: () => { if (who) { ed.select(who); this.fly(who); } } },
              h("strong", {}, WHAT[a.kind] ?? a.kind), " ", name(who) || a.target),
            h("button", { class: "x", type: "button", title: "Remove this adjustment", "aria-label": "Remove this adjustment",
              onclick: () => ed.run(removeAdjustment(k)) }, "×")),
          h("small", {}, [k, amount(a as unknown as Record<string, unknown>)].filter(Boolean).join(" · ")),
          reason);
      })));
  }
}

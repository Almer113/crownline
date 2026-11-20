// What is wrong: the document's own problems (schema, references, tree rules), then the drawing's (boxes that
// overlap, lines through cards). A click flies to the person or the area.
import type { Rect } from "@crownline/engine";
import { h, render } from "./dom.ts";
import type { Editor } from "./editor.ts";

export interface ProblemHooks { fly: (id: string) => void; flyRect: (r: Rect) => void }

export class ProblemsPanel {
  readonly el = h("section", { class: "problems", "aria-label": "Problems" });
  /** the badge for the tab: errors and warnings */
  readonly badge = h("span", { class: "badge" });

  constructor(private readonly ed: Editor, private readonly hooks: ProblemHooks) {
    ed.on(what => { if (what === "result") this.fill(); });
    this.fill();
  }

  private fill(): void {
    const { problems, issues, failed } = this.ed.result, doc = this.ed.doc;
    const person = (at: string) => {
      const m = /(?:^|\.)people\.([^.[\]]+)/.exec(at);
      return m && doc.people[m[1]] ? m[1] : null;
    };
    const errors = problems.filter(p => p.level === "error").length + issues.filter(i => i.severity === "error").length;
    const warnings = problems.length + issues.length - errors;
    this.badge.textContent = errors ? String(errors) : warnings ? String(warnings) : "";
    this.badge.className = `badge ${errors ? "error" : warnings ? "warning" : ""}`;
    const go = (id: string | null, box: Rect | null) => () => {
      if (box) this.hooks.flyRect(box);
      if (id) { this.ed.select(id); if (!box) this.hooks.fly(id); }
    };
    render(this.el,
      failed ? h("p", { class: "failed" }, `The chart was not redrawn: ${failed}. Fix the errors below; the last good drawing stays on screen.`) : null,
      !problems.length && !issues.length ? h("p", { class: "empty" }, "No problems.") : null,
      problems.length ? h("h3", {}, "In the document") : null,
      h("ul", {}, ...problems.map(p => {
        const id = person(p.at);
        return h("li", { class: p.level }, h("button", { type: "button", disabled: !id, onclick: go(id, null) },
          h("span", {}, p.message), h("small", {}, p.at)));
      })),
      issues.length ? h("h3", {}, "In the drawing") : null,
      h("ul", {}, ...issues.map(i => h("li", { class: i.severity },
        h("button", { type: "button", disabled: !i.box && !i.people.length, onclick: go(i.people[0] ?? null, i.box) },
          h("span", {}, i.message), h("small", {}, i.code))))));
  }
}

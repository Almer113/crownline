// The chart's look (PLAN 7d): house colours, the palette, the fonts and the type scale. Each change redraws.
import { SANS, SCRIPT, SECOND_SCRIPT } from "@crownline/engine";
import { setField } from "@crownline/ops";
import { h, render, textOf } from "./dom.ts";
import type { Editor } from "./editor.ts";

const PALETTE: [string, string][] = [
  ["background", "Background"], ["band", "Era bands"], ["ink", "Text"], ["noteInk", "Notes"], ["muted", "Muted text"],
  ["faint", "Faint text"], ["neutral", "Public figures' cards"], ["greyLine", "Grey lines"],
];
const TYPE: [string, string][] = [
  ["title", "Titles above names"], ["name", "Ruler's name"], ["reign", "Ruler's reign"], ["name2", "Small card's name"],
  ["sub2", "Small card's line"], ["note", "Notes"], ["cap", "Captions on lines"], ["small", "Small print"],
];
const FONT_NAMES: Record<string, string> = {
  gantari: "Gantari (open)", altehaas: "Alte Haas Grotesk (not for public builds)", felipa: "Felipa (open)",
  chancery: "Apple Chancery (not for public builds)", noto: "Noto Sans Javanese (open)", javatext: "Javatext (not for public builds)",
  "noto-jp": "Noto Sans JP (open)",
};

export class StylePanel {
  readonly el = h("section", { class: "style", "aria-label": "Style" });

  constructor(private readonly ed: Editor) {
    ed.on(what => { if (what === "doc" && !this.el.contains(document.activeElement)) this.fill(); });
    ed.history.on(why => { if (why !== "do" && this.el.contains(document.activeElement)) this.fill(); });     // undo, redo: not typing
    this.fill();
  }

  fill(): void {
    const ed = this.ed, doc = ed.doc, th = doc.theme;
    const colour = (label: string, path: string[], value: string, key: string) => {
      const i = h("input", { type: "color", value, "data-key": key, "aria-label": label });
      i.addEventListener("input", () => ed.run(setField(path, i.value.toUpperCase(), `Change ${label.toLowerCase()}`), key));
      return h("label", { class: "swatch" }, i, h("span", {}, label), h("code", {}, value));
    };
    const fonts = th.fonts as Record<string, string>, second = fonts.secondScript !== undefined ? "secondScript" : fonts.javanese !== undefined ? "javanese" : "secondScript";
    const fontSel = (label: string, key: string, options: string[], blank?: string) => h("label", { class: "field" }, h("span", {}, label),
      h("select", { onchange: (e: Event) => { const v = (e.target as HTMLSelectElement).value;
        ed.run(setField(["theme", "fonts", key], v || undefined, `Change the ${label.toLowerCase()}`)); } },
        blank !== undefined ? h("option", { value: "" }, blank) : null,
        ...options.map(o => h("option", { value: o, selected: fonts[key] === o }, FONT_NAMES[o] ?? o))));
    render(this.el,
      h("h3", {}, "Houses"),
      h("div", { class: "swatches" }, ...Object.entries(doc.houses).map(([k, v]) => colour(textOf(v.name, ed.lang) || k, ["houses", k, "colour"], v.colour, `house:${k}`))),
      h("h3", {}, "Palette"),
      h("div", { class: "swatches" }, ...PALETTE.map(([k, l]) => colour(l, ["theme", "palette", k], (th.palette as Record<string, string>)[k], `pal:${k}`))),
      h("h3", {}, "Fonts"),
      fontSel("Text font", "sans", Object.keys(SANS)),
      fontSel("Script font (house headers)", "script", Object.keys(SCRIPT)),
      fontSel("Second script (the title's)", second, Object.keys(SECOND_SCRIPT), "(none)"),
      h("h3", {}, "Type sizes (px)"),
      h("div", { class: "sizes" }, ...TYPE.map(([k, l]) => {
        const i = h("input", { type: "number", min: 6, max: 60, step: 0.5, value: (th.type as Record<string, number>)[k], "data-key": `type:${k}` });
        i.addEventListener("change", () => { const v = Number(i.value); if (v > 0) ed.run(setField(["theme", "type", k], v, `Change the size of ${l.toLowerCase()}`)); });
        return h("label", { class: "inline" }, l, i);
      })),
      h("p", { class: "hint" }, "Larger type makes cards bigger: under the kept layout they grow in place; use Re-layout… to make room."));
  }
}

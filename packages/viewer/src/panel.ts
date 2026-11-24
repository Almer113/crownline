// Card panel (PLAN Phase 3, item 1): a docked side panel with what the card can't hold. Docked, not floating,
// so it never covers the chart: the viewer narrows while it is open (research 1.2). It shows only what the
// layout file carries today (titles, dates, reign, notes, family); more fields can be added as data grows.
import type { Cite, Claim, Kin, Layout, Person } from "./layout";
import { pickText, t, type Lang } from "./i18n";
import type { Glossary } from "./glossary";
import { label, type Relation } from "./kinship";

export const PANEL_W = 380;
/** share of the viewer's height the bottom sheet takes on narrow screens */
export const SHEET = 0.52;
/** viewers narrower than this get the bottom sheet */
export const SHEET_BELOW = 760;

export const PANEL_CSS = `
.clp-panel { position: absolute; top: 0; right: 0; bottom: 0; width: ${PANEL_W}px; box-sizing: border-box;
         background: #F6F2E6; border-left: 1px solid #D5CDB6; box-shadow: -2px 0 10px rgba(0,0,0,.08);
         overflow-y: auto; overscroll-behavior: contain; font: 15px/1.45 'AHG', system-ui, sans-serif; color: #1F1F1F;
         user-select: text; -webkit-user-select: text; cursor: auto; display: none; }
.clp-panel.clp-open { display: block; }
.clp-panel:focus { outline: none; }
.clp-panel h2:focus { outline: none; }
.clp-panel .clp-band { height: 8px; }
.clp-panel .clp-close { position: sticky; top: 6px; z-index: 3; display: block; margin: 6px 10px -38px auto;
                width: 32px; height: 32px; border: 0; border-radius: 6px;
                background: rgba(246,242,230,.92); font: 22px/1 system-ui, sans-serif; color: #5E5848; cursor: pointer; }
.clp-panel .clp-close:hover { background: #E8E2D0; }
.clp-panel .clp-close:focus-visible, .clp-panel button:focus-visible, .clp-panel a:focus-visible { outline: 3px solid #2B6CB0; outline-offset: 1px; }
.clp-panel .clp-head { display: flex; gap: 14px; padding: 16px 44px 12px 18px; align-items: center; }
.clp-panel .clp-pic { flex: none; width: 104px; height: 104px; border-radius: 10px; overflow: hidden; background: #DDD8C9; }
.clp-panel .clp-pic img { width: 100%; height: 100%; object-fit: cover; display: block; }
.clp-panel .clp-pic.clp-none { display: flex; align-items: flex-end; justify-content: center; }
.clp-panel .clp-pic.clp-none svg { width: 76px; }
.clp-panel .clp-title { font-weight: 700; font-size: 12.5px; letter-spacing: 1.2px; text-transform: uppercase; color: #5E5848; }
.clp-panel h2 { margin: 2px 0 2px; font-size: 23px; line-height: 1.15; }
.clp-panel .clp-sub { color: #3A372F; }
.clp-panel .clp-about { padding: 0 18px 14px; }
.clp-panel .clp-aka { color: #5E5848; font-size: 13.5px; margin: 0 0 8px; }
.clp-panel .clp-bio { margin: 0; font-size: 15px; line-height: 1.5; }
.clp-panel .clp-claim { margin: 0 0 4px; font-size: 14.5px; }
.clp-panel .clp-claim .clp-or { color: #5E5848; font-style: italic; }
.clp-panel .clp-claim sup { color: #5E5848; font-size: 11px; margin-left: 2px; cursor: default; }
.clp-panel .clp-claim .clp-unsure { color: #8A5A1C; font-size: 12.5px; }
.clp-panel .clp-claim .clp-cnote { display: block; color: #5E5848; font-size: 13px; line-height: 1.4; }
.clp-panel .clp-life dd { display: block; }
.clp-panel .clp-srcs { margin: 0; padding-left: 22px; font-size: 13.5px; color: #3A372F; }
.clp-panel .clp-srcs li { margin: 0 0 4px; }
.clp-panel .clp-srcs a { color: #2B5C8A; }
.clp-panel .clp-facts { display: flex; flex-wrap: wrap; gap: 6px; padding: 0 18px 14px; }
.clp-panel .clp-fact { font-size: 13px; padding: 3px 9px; border-radius: 12px; background: #E8E2D0; color: #3A372F; }
.clp-panel .clp-fact.clp-crown { background: #F3E2B3; color: #5A4520; font-weight: 700; }
.clp-panel section { padding: 12px 18px; border-top: 1px solid #E2DBC6; }
.clp-panel h3 { margin: 0 0 8px; font-size: 12.5px; letter-spacing: 1.2px; text-transform: uppercase; color: #5E5848; }
.clp-panel .clp-note { margin: 0 0 8px; color: #3A372F; }
.clp-panel .clp-note .clp-ltr { display: inline-block; min-width: 20px; height: 20px; margin-right: 6px; border-radius: 10px;
                    border: 1.5px solid; font: italic 700 13px/17px 'AHG'; text-align: center; vertical-align: 1px; }
.clp-panel .clp-rel { display: grid; grid-template-columns: 82px 1fr; gap: 6px 8px; align-items: start; }
.clp-panel .clp-rel dt { color: #5E5848; font-size: 13.5px; padding-top: 4px; }
.clp-panel .clp-rel dd { margin: 0; display: flex; flex-wrap: wrap; gap: 5px; }
.clp-panel .clp-kin { font: inherit; font-size: 14px; text-align: left; border: 0; border-left: 5px solid; border-radius: 6px;
              padding: 3px 9px; background: #FFFFFF; color: #1F1F1F; cursor: pointer; box-shadow: 0 1px 2px rgba(0,0,0,.08); }
.clp-panel .clp-kin:hover { background: #FFF9E8; }
.clp-panel .clp-kin .clp-gap { color: #5E5848; font-size: 12.5px; }
.clp-panel .clp-muted { color: #5E5848; font-size: 13.5px; }
.clp-panel .clp-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.clp-panel .clp-actions button { font: inherit; font-size: 14px; padding: 6px 12px; border-radius: 6px; border: 1px solid #CFC6AE;
                         background: #FFFFFF; cursor: pointer; }
.clp-panel .clp-actions button[aria-pressed="true"] { background: #1F1F1F; color: #FFFFFF; border-color: #1F1F1F; }
.clp-panel abbr { text-decoration: underline dotted; text-underline-offset: 3px; cursor: help; }
.clp-panel .clp-gloss { font-size: 13px; color: #5E5848; margin-top: 3px; }
.clp-panel .clp-relbox { background: #FFF9E8; }
.clp-panel .clp-relbox p { margin: 0 0 6px; }
.clp-panel .clp-name { font: inherit; border: 0; padding: 0; background: none; color: #1F1F1F; font-weight: 700; cursor: pointer;
                       text-decoration: underline; text-decoration-color: #B9B2A0; text-underline-offset: 3px; }
.clp-panel .clp-name:hover { text-decoration-color: #1F1F1F; }
.clp-panel .clp-small { font: inherit; font-size: 13.5px; border: 0; background: none; color: #2B6CB0; padding: 2px 0; cursor: pointer; }
/* narrow viewers: a bottom sheet (the viewer sets the class from its own width, not the window's) */
.clp-panel.clp-sheet { top: auto; left: 0; width: auto; height: ${SHEET * 100}%; border-left: 0; border-top: 1px solid #D5CDB6;
           box-shadow: 0 -2px 10px rgba(0,0,0,.1); border-radius: 12px 12px 0 0; }`;

const SILHOUETTE = `<svg viewBox="0 0 76 80" aria-hidden="true"><circle cx="38" cy="26" r="17" fill="#B9B2A0"/>
  <path d="M4 80 C6 55 20 47 38 47 C56 47 70 55 72 80 Z" fill="#B9B2A0"/></svg>`;

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** "grandson" seen from the other side: the child's gap names the child; for a parent, name the elder */
const ELDER: Record<string, string> = { grandson: "grandparent", granddaughter: "grandparent", descendant: "ancestor" };

export interface PanelEvents { go(id: string): void; close(): void; lineage(on: boolean): void; relate(): void; clearRelation(): void }

/** a relationship to show: from the person picked first to the one shown, or no path (relation null) */
export interface RelationView { from: string; relation: Relation | null }

/** a reign numeral stays on the line of its name */
const keepNumeral = (n: string) => n.replace(/ ([IVXL]+)$/, "\u00a0$1");

/** "2, 4 and 8" */
const listOf = (xs: string[], and: string) => xs.length < 2 ? xs.join("") : xs.slice(0, -1).join(", ") + and + xs[xs.length - 1];

export class Panel {
  readonly el: HTMLElement;
  private lineageOn = true;

  private shown: string | null = null;
  private rel: RelationView | null = null;

  constructor(private readonly layout: Layout, private readonly ev: PanelEvents, private readonly url: (path: string) => string,
              private readonly lang: () => Lang, private readonly glossary: Glossary) {
    this.el = document.createElement("aside");
    this.el.className = "clp-panel";
    // focusable, so that after a click in the panel the arrow keys scroll it instead of panning the chart
    this.el.tabIndex = -1;
    this.el.addEventListener("pointerdown", e => {
      e.stopPropagation();
      if (!(e.target as HTMLElement).closest("button, a, input")) this.el.focus({ preventScroll: true });
    });
    this.el.addEventListener("wheel", e => e.stopPropagation(), { passive: true });
    this.el.addEventListener("keydown", e => { if (e.key === "Escape") { e.stopPropagation(); this.ev.close(); } });
    this.el.addEventListener("click", e => {
      const t = (e.target as HTMLElement).closest<HTMLElement>("[data-go], [data-act]");
      if (!t) return;
      if (t.dataset.go) this.ev.go(t.dataset.go);
      else if (t.dataset.act === "close") this.ev.close();
      else if (t.dataset.act === "relate") this.ev.relate();
      else if (t.dataset.act === "clearrel") this.ev.clearRelation();
      else if (t.dataset.act === "lineage") {
        this.lineageOn = !this.lineageOn; t.setAttribute("aria-pressed", String(this.lineageOn)); this.ev.lineage(this.lineageOn);
      } else if (t.dataset.act === "copy") {
        void navigator.clipboard?.writeText(location.href).then(() => { t.textContent = this.s("copied"); });
      }
    });
  }

  private s(key: string, vars?: Record<string, string | number>): string { return t(this.lang(), key, vars); }

  get isOpen(): boolean { return this.el.classList.contains("clp-open"); }
  get showLineage(): boolean { return this.lineageOn; }

  private houseName(house: string): string {
    for (const [id, h] of Object.entries(this.layout.headers)) if (this.layout.people[id]?.house === house) return h.name;
    return "";
  }

  private kin(list: Kin[] | undefined, elder: boolean): string {
    if (!list?.length) return "";
    return list.map(k => {
      const p = this.layout.people[k.id];
      if (!p) return "";
      const what = k.via ? this.s(k.via) : k.gap ? (elder ? ELDER[k.gap] ?? k.gap : k.gap) : "";
      const gap = what ? ` <span class="clp-gap">(${esc(what)})</span>` : "";
      return `<button class="clp-kin" data-go="${esc(k.id)}" style="border-left-color:${esc(p.colour)}"
               title="${esc([p.title, p.name, p.sub].filter(Boolean).join(" · "))}">${esc(label(this.layout, k.id))}${gap}</button>`;
    }).join("");
  }

  private relation(r: RelationView, to: string): string {
    const name = (id: string) => {
      const q = this.layout.people[id];
      return q ? `<button class="clp-name" data-go="${esc(id)}">${esc(label(this.layout, id))}</button>` : esc(id);
    };
    let body: string;
    if (r.from === to) body = `<p>${esc(this.s("samePerson"))}</p>`;
    else if (!r.relation) body = `<p>${esc(this.s("noPath"))}</p>`;
    else body = r.relation.summary.map(ph => `<p>${ph.map(x => (typeof x === "string" ? esc(x) : name(x.id))).join("")}.</p>`).join("")
      + (r.relation.unsure ? `<p class="clp-muted">${esc(this.s("skips"))}</p>` : "");
    return `<section class="clp-relbox"><h3>${esc(this.s("relationship"))}</h3>${body}
      <button class="clp-small" data-act="clearrel">${esc(this.s("clear"))}</button></section>`;
  }

  /** the birth and death claims, each with its source numbers, and the numbered list of the sources */
  private life(p: Person): { dates: string; sources: string } {
    const order: string[] = [];
    const num = (c: Cite) => { if (!order.includes(c.source)) order.push(c.source); return order.indexOf(c.source) + 1; };
    const refs = (cs: Cite[]) => cs.filter(c => this.layout.sources?.[c.source])
      .map(c => `<sup${c.where ? ` title="${esc(c.where)}"` : ""}>[${num(c)}]</sup>`).join("");
    const claims = (list: Claim[]) => list.map((c, i) => `<p class="clp-claim">${i ? `<span class="clp-or">${esc(this.s("orElse"))}</span> ` : ""}${
      esc([c.date, c.place].filter(Boolean).join(", "))}${refs(c.sources)}${
      c.certainty === "low" ? ` <span class="clp-unsure">(${esc(this.s("uncertain"))})</span>` : ""}${
      c.note ? `<span class="clp-cnote">${esc(c.note)}</span>` : ""}</p>`).join("");
    const rows = (["born", "died"] as const).filter(f => p[f]?.length).map(f => `<dt>${esc(this.s(f))}</dt><dd>${claims(p[f]!)}</dd>`);
    for (const c of p.sources ?? []) if (this.layout.sources?.[c.source]) num(c);   // the person's own sources, after the dates' ones
    const dates = rows.length ? `<section><h3>${esc(this.s("life"))}</h3><dl class="clp-rel clp-life">${rows.join("")}</dl></section>` : "";
    const items = order.map(k => {
      const s = this.layout.sources![k];
      const by = [s.author, s.year].filter(Boolean).join(", ");
      const t = s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title)}</a>` : esc(s.title);
      return `<li>${t}${by ? ` · ${esc(by)}` : ""}</li>`;
    });
    return { dates, sources: items.length ? `<section><h3>${esc(this.s("sources"))}</h3><ol class="clp-srcs">${items.join("")}</ol></section>` : "" };
  }

  show(id: string, rel: RelationView | null = null, keepScroll = false): void {
    const p: Person | undefined = this.layout.people[id];
    if (!p) return this.hide();
    // the panel is redrawn as a whole: keep the keyboard in it (on the heading) and, if asked, the scroll
    const root = this.el.getRootNode() as ShadowRoot | Document;
    const hadFocus = this.el.contains(root.activeElement), top = this.el.scrollTop;
    this.shown = id; this.rel = rel;
    this.el.setAttribute("aria-label", this.s("details"));
    // titles explained from the chart's glossary: the card's title, or a title at the start of the name
    const gl = this.glossary.lookup(p.title || p.name);
    const glossText = gl.map(g => `${g.term}${g.full ? ` · ${g.full}` : ""}: ${g.meaning}`).join("; ");
    const glossLine = gl.filter(g => g.full || g.meaning.toLowerCase() !== g.term.toLowerCase())
      .map(g => `${g.full || g.term}: ${g.meaning}`).join(" · ");
    const f = p.family;
    const pic = p.portrait
      ? `<div class="clp-pic"><img alt="" src="${esc(this.url(p.portrait))}"></div>`
      : `<div class="clp-pic clp-none">${SILHOUETTE}</div>`;
    const facts: string[] = [];
    if (p.reign) facts.push(`<span class="clp-fact clp-crown">${esc(pickText(p.reign, this.lang()))}</span>`);
    else if (p.crown) {
      const n = p.crown.split(" · ");
      const house = this.houseName(p.house);
      facts.push(`<span class="clp-fact clp-crown">${esc(this.s(n.length > 1 ? "reigns" : "ruler", { n: this.lang() === "id" ? listOf(n.map(x => "ke-" + x), " dan ") : listOf(n, " and "), house }))}</span>`);
    }
    if (p.traditional) facts.push(`<span class="clp-fact">${esc(this.s("chronicles"))}</span>`);
    if (p.tag) facts.push(`<span class="clp-fact">${esc(p.tag)}</span>`);
    if (p.hatch) facts.push(`<span class="clp-fact">${esc(this.s("claimant"))}</span>`);
    const notes = (p.notes ?? []).map(n => `<p class="clp-note">${n.letter
      ? `<span class="clp-ltr" style="border-color:${esc(p.colour)}" title="${esc(this.s("noteOnChart", { l: n.letter }))}">${esc(n.letter)}</span>` : ""}${esc(n.text)}</p>`).join("");
    const life = this.life(p);
    const rows = [[this.s("parents"), this.kin(f?.parents, true)], [this.s("spouses"), this.kin(f?.spouses, false)],
                  [this.s("children"), this.kin(f?.children, false)]].filter(r => r[1]);
    this.el.innerHTML = `
      <div class="clp-band" style="background:${esc(p.colour)}"></div>
      <button class="clp-close" data-act="close" aria-label="${esc(this.s("closePanel"))}" title="${esc(this.s("closePanel"))} (Esc)">×</button>
      <div class="clp-head">${pic}<div>
        ${p.title ? `<div class="clp-title">${gl.length ? `<abbr title="${esc(glossText)}">${esc(p.title)}</abbr>` : esc(p.title)}</div>` : ""}
        <h2>${!p.title && gl.length ? `<abbr title="${esc(glossText)}">${esc(keepNumeral(p.name))}</abbr>` : esc(keepNumeral(p.name))}</h2>
        ${p.sub ? `<div class="clp-sub">${esc(p.sub)}</div>` : ""}
        ${glossLine ? `<div class="clp-gloss">${esc(glossLine)}</div>` : ""}</div></div>
      ${facts.length ? `<div class="clp-facts">${facts.join("")}</div>` : ""}
      ${p.aka?.length || p.bio ? `<div class="clp-about">${p.aka?.length
        ? `<p class="clp-aka">${esc(this.s("aka"))}: ${esc(p.aka.join(" · "))}</p>` : ""}${p.bio
        ? `<p class="clp-bio">${esc(p.bio)}</p>` : ""}</div>` : ""}
      ${life.dates}
      ${rel ? this.relation(rel, id) : ""}
      ${notes ? `<section><h3>${esc(this.s("notes"))}</h3>${notes}</section>` : ""}
      <section><h3>${esc(this.s("family"))}</h3>${rows.length
        ? `<dl class="clp-rel">${rows.map(([h, v]) => `<dt>${esc(h)}</dt><dd>${v}</dd>`).join("")}</dl>`
        : `<p class="clp-muted">${esc(this.s("noFamily"))}</p>`}</section>
      ${life.sources}
      <section class="clp-actions">
        <button data-act="lineage" aria-pressed="${this.lineageOn}">${esc(this.s("lineage"))}</button>
        <button data-act="relate">${esc(this.s("relTo"))}</button>
        <button data-act="copy">${esc(this.s("copyLink"))}</button>
      </section>`;
    this.el.classList.add("clp-open");
    this.el.scrollTop = keepScroll ? top : 0;
    if (hadFocus) {
      const h = this.el.querySelector("h2") as HTMLElement;
      h.tabIndex = -1; h.focus({ preventScroll: true });
    }
  }

  hide(): void { this.el.classList.remove("clp-open"); this.shown = null; this.rel = null; }
}

// The viewer's controls for exploring (PLAN Phase 3): search, filters, the time slider, tours and the
// language toggle, plus the prompt shown while picking a second person for the relationship finder and the
// caption card of a running tour. This module only draws and reports; the viewer decides what things mean.
// Everything sits at the top left, small, so the chart stays the main thing on screen.
import type { Layout, Person } from "./layout";
import { t, type Lang } from "./i18n";
import type { Hit } from "./search";

export const TOOLBAR_CSS = `
.clt-bar { position: absolute; left: 12px; top: 12px; right: calc(var(--pw, 0px) + 12px); display: flex; gap: 6px;
           flex-wrap: wrap; align-items: flex-start; pointer-events: none; font: 14px/1.3 'AHG', system-ui, sans-serif; }
.clt-bar > * { pointer-events: auto; }
.clt-btn { font: inherit; height: 36px; padding: 0 12px; border: 0; border-radius: 6px; background: rgba(255,255,255,.94);
           color: #1F1F1F; box-shadow: 0 1px 4px rgba(0,0,0,.2); cursor: pointer; white-space: nowrap; }
.clt-btn[aria-pressed="true"], .clt-btn[aria-expanded="true"] { background: #1F1F1F; color: #FFFFFF; }
.clt-btn:focus-visible, .clt-pop :focus-visible, .clt-card :focus-visible, .clt-time :focus-visible, .clt-banner :focus-visible
  { outline: 3px solid #2B6CB0; outline-offset: 1px; }
.clt-search { position: relative; }
.clt-search input { font: inherit; width: 230px; height: 36px; box-sizing: border-box; padding: 0 10px 0 32px; border: 0;
                    border-radius: 6px; background: rgba(255,255,255,.97); box-shadow: 0 1px 4px rgba(0,0,0,.2); color: #1F1F1F; }
.clt-search input:focus { outline: 3px solid #2B6CB0; }
.clt-search svg { position: absolute; left: 10px; top: 11px; width: 15px; height: 15px; pointer-events: none; }
.clt-results { position: absolute; left: 0; top: 40px; width: 320px; max-width: calc(100vw - 24px); margin: 0; padding: 4px;
               list-style: none; background: #FFFFFF; border-radius: 8px; box-shadow: 0 4px 16px rgba(0,0,0,.2);
               max-height: 360px; overflow-y: auto; display: none; }
.clt-results.clt-open { display: block; }
.clt-results li { display: flex; gap: 8px; align-items: center; padding: 6px 8px; border-radius: 6px; cursor: pointer; }
.clt-results li[aria-selected="true"] { background: #F3EBD3; }
.clt-results .clt-sw { flex: none; width: 6px; align-self: stretch; border-radius: 3px; }
.clt-results .clt-t { font-size: 11.5px; letter-spacing: 1px; text-transform: uppercase; color: #5E5848; }
.clt-results .clt-s { font-size: 12.5px; color: #5E5848; }
.clt-results .clt-none { color: #5E5848; cursor: default; }
.clt-pop { position: absolute; z-index: 3; top: var(--clt-top, 56px); min-width: 240px; max-width: calc(100% - 24px); box-sizing: border-box;
           padding: 12px 14px; background: #FFFFFF; border-radius: 8px; box-shadow: 0 4px 16px rgba(0,0,0,.2);
           font: 14px/1.4 'AHG', system-ui, sans-serif; color: #1F1F1F; display: none; }
.clt-pop.clt-open { display: block; }
.clt-pop h4 { margin: 0 0 6px; font-size: 12px; letter-spacing: 1.2px; text-transform: uppercase; color: #5E5848; }
.clt-pop label { display: flex; gap: 8px; align-items: center; padding: 3px 0; cursor: pointer; }
.clt-pop .clt-sw { width: 14px; height: 14px; border-radius: 3px; flex: none; }
.clt-pop hr { border: 0; border-top: 1px solid #E2DBC6; margin: 8px 0; }
.clt-pop .clt-link { font: inherit; border: 0; background: none; color: #2B6CB0; padding: 4px 0; cursor: pointer; }
.clt-pop .clt-tour { display: block; width: 100%; text-align: left; font: inherit; border: 0; border-radius: 6px; padding: 7px 8px;
                     background: #F6F2E6; margin: 0 0 6px; cursor: pointer; }
.clt-pop .clt-tour small { display: block; color: #5E5848; }
.clt-time { position: absolute; left: 12px; top: var(--clt-top, 56px); z-index: 2; width: min(560px, calc(100% - var(--pw, 0px) - 24px));
            box-sizing: border-box; padding: 10px 14px; background: rgba(255,255,255,.96); border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,.2); font: 14px/1.35 'AHG', system-ui, sans-serif; color: #1F1F1F; display: none; }
.clt-time.clt-open { display: block; }
.clt-time .clt-row { display: flex; gap: 10px; align-items: center; }
.clt-time output { font-weight: 700; font-size: 22px; min-width: 52px; font-variant-numeric: tabular-nums; }
.clt-time input[type=range] { flex: 1; accent-color: #1F1F1F; }
.clt-time .clt-era { font-weight: 700; }
.clt-time .clt-ep { color: #8A3B12; }
.clt-time .clt-note { color: #5E5848; font-size: 12.5px; }
.clt-x { font: 20px/1 system-ui, sans-serif; width: 30px; height: 30px; border: 0; border-radius: 6px; background: transparent;
         color: #5E5848; cursor: pointer; flex: none; }
.clt-x:hover { background: rgba(0,0,0,.06); }
.clt-banner { position: absolute; left: 50%; top: var(--clt-top, 56px); transform: translateX(-50%); z-index: 2; display: none; gap: 10px;
              align-items: center; padding: 8px 10px 8px 14px; background: #1F1F1F; color: #FFFFFF; border-radius: 8px;
              font: 14px/1.3 'AHG', system-ui, sans-serif; box-shadow: 0 2px 10px rgba(0,0,0,.25); max-width: calc(100% - 24px); }
.clt-banner.clt-open { display: flex; }
.clt-banner button { font: inherit; border: 0; border-radius: 6px; padding: 5px 10px; background: #FFFFFF; color: #1F1F1F; cursor: pointer; }
.clt-card { position: absolute; z-index: 3; left: calc((100% - var(--pw, 0px)) / 2); bottom: calc(var(--pb, 0px) + 60px);
            transform: translateX(-50%); width: min(480px, calc(100% - var(--pw, 0px) - 24px)); box-sizing: border-box;
            padding: 14px 16px 12px; background: #FFFFFF; border-radius: 10px; box-shadow: 0 4px 18px rgba(0,0,0,.25);
            font: 15px/1.45 'AHG', system-ui, sans-serif; color: #1F1F1F; display: none; user-select: text; -webkit-user-select: text; }
.clt-card.clt-open { display: block; }
.clt-card .clt-head { display: flex; align-items: baseline; gap: 8px; }
.clt-card .clt-k { font-size: 12px; letter-spacing: 1.2px; text-transform: uppercase; color: #5E5848; flex: 1; }
.clt-card h3 { margin: 2px 0 6px; font-size: 18px; }
.clt-card p { margin: 0 0 10px; }
.clt-card .clt-nav { display: flex; gap: 8px; justify-content: flex-end; }
.clt-card .clt-nav button { font: inherit; font-size: 14px; padding: 6px 14px; border-radius: 6px; border: 1px solid #CFC6AE;
                            background: #FFFFFF; cursor: pointer; }
.clt-card .clt-nav button.clt-primary { background: #1F1F1F; color: #FFFFFF; border-color: #1F1F1F; }
.clt-card .clt-nav button:disabled { opacity: .4; cursor: default; }
@media (max-width: 560px) { .clt-search input { width: 128px; } .clt-btn { padding: 0 9px; } }
`;

const SEARCH_ICON = `<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="6.5" cy="6.5" r="5" fill="none" stroke="#5E5848" stroke-width="2"/>
  <path d="M10.5 10.5 L15 15" stroke="#5E5848" stroke-width="2" stroke-linecap="round"/></svg>`;

export interface Tour { id: string; title: string; summary?: string; steps: TourStep[] }
export interface TourStep {
  caption: string; title?: string;
  focus?: string[] | "all"; zoom?: number;
  light?: string[]; lineage?: string; year?: number; stage?: string;
}

export interface FilterState { houses: Record<string, boolean>; rulersOnly: boolean; disputed: boolean; outside: boolean }

export interface ToolbarEvents {
  query(q: string): Hit[];
  pick(id: string): void;
  filters(f: FilterState): void;
  time(year: number | null): void;
  tour(id: string | null, step: number): void;
  lang(l: Lang): void;
  cancelPick(): void;
}

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export class Toolbar {
  readonly els: HTMLElement[];
  /** the pop-ups that scroll and use the arrow keys themselves */
  get pops(): HTMLElement[] { return [this.filterPop, this.tourPop, this.timeBox]; }
  private readonly bar: HTMLDivElement;
  private readonly input: HTMLInputElement;
  private readonly results: HTMLUListElement;
  private readonly filterPop: HTMLDivElement;
  private readonly tourPop: HTMLDivElement;
  private readonly timeBox: HTMLDivElement;
  private readonly banner: HTMLDivElement;
  private readonly card: HTMLDivElement;
  private hits: Hit[] = [];
  private active = -1;
  lang: Lang;
  filters: FilterState;
  year: number | null = null;
  tourId: string | null = null;
  tourStep = 0;
  private readonly houses: { id: string; name: string; colour: string }[];
  private readonly years: [number, number];

  constructor(private readonly layout: Layout, private readonly tours: Tour[], private readonly ev: ToolbarEvents, lang: Lang,
              private readonly langs: Lang[]) {
    this.lang = lang;
    // houses in the order of their headers on the chart
    this.houses = Object.entries(layout.headers).map(([hid, h]) => ({ id: layout.people[hid]?.house ?? "", name: h.name,
      colour: layout.people[hid]?.colour ?? "#999" })).filter((h, i, a) => h.id && a.findIndex(x => x.id === h.id) === i);
    this.filters = { houses: Object.fromEntries(this.houses.map(h => [h.id, true])), rulersOnly: false, disputed: true, outside: true };
    const spans = Object.values(layout.people).map(p => p.span?.[0] ?? p.year).filter(y => y > 0);
    this.years = [Math.min(...spans), Number(/\d{4}/.exec(layout.asOf ?? "")?.[0] ?? new Date().getFullYear())];

    const div = (cls: string) => { const d = document.createElement("div"); d.className = cls; return d; };
    this.bar = div("clt-bar");
    this.filterPop = div("clt-pop"); this.tourPop = div("clt-pop");
    this.timeBox = div("clt-time"); this.banner = div("clt-banner"); this.card = div("clt-card");
    this.card.setAttribute("role", "region"); this.card.setAttribute("aria-live", "polite");
    this.input = document.createElement("input");
    this.results = document.createElement("ul");
    this.els = [this.bar, this.filterPop, this.tourPop, this.timeBox, this.banner, this.card];
    for (const el of this.els) {
      el.addEventListener("pointerdown", e => e.stopPropagation());
      el.addEventListener("wheel", e => e.stopPropagation(), { passive: true });
      el.addEventListener("dblclick", e => e.stopPropagation());
    }
    this.render();
  }

  private s(key: string, vars?: Record<string, string | number>): string { return t(this.lang, key, vars); }

  /** (re)draw everything in the current language, keeping state */
  render(): void {
    const q = this.input.value, langFocused = this.root()?.activeElement?.getAttribute("data-tb") === "lang";
    this.closePops();
    this.bar.innerHTML = `<div class="clt-search">${SEARCH_ICON}</div>
      <button class="clt-btn" data-tb="filters" aria-expanded="false">${esc(this.s("filters"))}</button>
      <button class="clt-btn" data-tb="time" aria-pressed="${this.year !== null}" title="${esc(this.s("timeTitle"))}">${esc(this.s("time"))}</button>
      ${this.tours.length ? `<button class="clt-btn" data-tb="tours" aria-expanded="false">${esc(this.s("tours"))}</button>` : ""}
      ${this.langs.length > 1 ? `<button class="clt-btn" data-tb="lang" aria-label="${esc(this.s("language"))}"
              title="${esc(this.s("language"))}">${this.langs.map(l => (l === this.lang ? `<b>${l.toUpperCase()}</b>` : l.toUpperCase())).join(" · ")}</button>` : ""}`;
    const box = this.bar.querySelector(".clt-search")!;
    Object.assign(this.input, { type: "search", placeholder: this.s("search"), value: q, spellcheck: false, autocomplete: "off" });
    this.input.setAttribute("role", "combobox");
    this.input.setAttribute("aria-label", `${this.s("search")}: ${this.s("searchHint")}`);
    this.input.setAttribute("aria-controls", "clt-results");
    this.input.setAttribute("aria-autocomplete", "list");
    this.input.setAttribute("aria-expanded", "false");
    this.results.id = "clt-results"; this.results.className = "clt-results"; this.results.setAttribute("role", "listbox");
    box.append(this.input, this.results);
    this.bindBar();
    this.renderFilters(); this.renderTours(); this.renderTime(); this.renderCard();
    requestAnimationFrame(() => this.place());
    if (this.banner.classList.contains("clt-open")) this.showPick(true);
    if (langFocused) (this.bar.querySelector('[data-tb="lang"]') as HTMLElement | null)?.focus();
  }

  private bindBar(): void {
    this.input.oninput = () => this.search();
    this.input.onfocus = () => { if (this.input.value) this.search(); };
    this.input.onblur = () => setTimeout(() => this.closeResults(), 150);
    this.input.onkeydown = e => {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        if (!this.hits.length) return;
        this.active = (this.active + (e.key === "ArrowDown" ? 1 : -1) + this.hits.length) % this.hits.length;
        this.markActive();
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (!this.input.value.trim()) return;
        const h = this.hits[Math.max(0, this.active)];
        if (h) this.choose(h.id);
      } else if (e.key === "Escape") {
        e.stopPropagation();
        if (this.input.value) { this.input.value = ""; this.closeResults(); }
        else if (this.banner.classList.contains("clt-open")) this.ev.cancelPick();
        else this.focusHost();
      }
      e.stopPropagation();       // typing must not pan or zoom the chart
    };
    this.results.onpointerdown = e => e.preventDefault();     // keep focus in the box while clicking a result
    this.results.onclick = e => {
      const li = (e.target as HTMLElement).closest<HTMLElement>("li[data-id]");
      if (li) this.choose(li.dataset.id!);
    };
    for (const b of Array.from(this.bar.querySelectorAll<HTMLButtonElement>("button[data-tb]"))) b.onclick = () => {
      const k = b.dataset.tb;
      if (k === "filters") this.toggle(this.filterPop, b);
      else if (k === "tours") this.toggle(this.tourPop, b);
      else if (k === "time") { this.closePops(); this.setYear(this.year === null ? this.defaultYear() : null); }
      else if (k === "lang") { this.lang = this.langs[(this.langs.indexOf(this.lang) + 1) % this.langs.length]; this.ev.lang(this.lang); }
    };
  }

  /** the toolbar may wrap onto two rows on narrow screens: what hangs below it starts where it ends */
  place(): void {
    const host = (this.bar.getRootNode() as ShadowRoot | null)?.host as HTMLElement | undefined;
    if (host && this.bar.offsetHeight) host.style.setProperty("--clt-top", `${this.bar.offsetTop + this.bar.offsetHeight + 8}px`);
  }

  /** the middle of the chart's years */
  get midYear(): number { return Math.round((this.years[0] + this.years[1]) / 2); }

  /** a year to open the slider at (the viewer sets it: the selected person's, else the chart's start year) */
  defaultYear = (): number => this.midYear;

  /** screen bands the tour's caption card and the toolbar take, for framing tour views between them */
  get tourInsets(): [number, number] {
    const bar = this.bar.offsetTop + this.bar.offsetHeight + 8;
    return [bar, this.card.classList.contains("clt-open") ? this.card.offsetHeight + 72 : 0];
  }

  focusSearch(): void { this.input.focus(); this.input.select(); }

  private search(): void {
    const q = this.input.value.trim();
    this.hits = q ? this.ev.query(q) : [];
    this.active = this.hits.length ? 0 : -1;
    if (!q) { this.closeResults(); return; }
    this.results.innerHTML = this.hits.length ? this.hits.map((h, i) => `<li role="option" id="clt-r${i}" data-id="${esc(h.id)}">
        <span class="clt-sw" style="background:${esc(h.person.colour)}"></span>
        <span>${h.person.title ? `<span class="clt-t">${esc(h.person.title)}</span><br>` : ""}<b>${esc(h.person.name)}</b>
        ${h.person.sub ? `<br><span class="clt-s">${esc(h.person.sub)}</span>` : ""}</span></li>`).join("")
      : `<li class="clt-none" role="option" aria-disabled="true">${esc(this.s("noMatch"))}</li>`;
    this.results.classList.add("clt-open");
    this.input.setAttribute("aria-expanded", "true");
    this.markActive();
  }

  private markActive(): void {
    this.results.querySelectorAll("li[data-id]").forEach((li, i) => li.setAttribute("aria-selected", String(i === this.active)));
    if (this.active >= 0) {
      this.input.setAttribute("aria-activedescendant", `clt-r${this.active}`);
      this.results.querySelector(`#clt-r${this.active}`)?.scrollIntoView({ block: "nearest" });
    } else this.input.removeAttribute("aria-activedescendant");
  }

  private closeResults(): void {
    this.results.classList.remove("clt-open"); this.input.setAttribute("aria-expanded", "false");
    this.hits = []; this.active = -1; this.input.removeAttribute("aria-activedescendant");
  }

  private root(): ShadowRoot | null { return this.bar.getRootNode() as ShadowRoot | null; }

  /** give the keyboard back to the chart (instead of dropping focus on the page) */
  private focusHost(): void { (this.root()?.host as HTMLElement | undefined)?.focus({ preventScroll: true }); }

  private choose(id: string): void {
    this.closeResults();
    this.input.value = "";
    this.focusHost();
    this.ev.pick(id);
  }

  private toggle(pop: HTMLElement, btn: HTMLButtonElement): void {
    const open = !pop.classList.contains("clt-open");
    for (const p of [this.filterPop, this.tourPop]) p.classList.remove("clt-open");
    this.bar.querySelectorAll("[aria-expanded]").forEach(b => { if (b !== this.input) b.setAttribute("aria-expanded", "false"); });
    if (!open) return;
    pop.classList.add("clt-open");
    btn.setAttribute("aria-expanded", "true");
    this.place();
    const host = (this.bar.getRootNode() as ShadowRoot).host as HTMLElement;
    pop.style.left = `${Math.max(12, Math.min(btn.offsetLeft + 12, host.clientWidth - pop.offsetWidth - 12))}px`;
    (pop.querySelector("input, button") as HTMLElement | null)?.focus();
  }

  /** close the pop-ups; `refocus` puts the keyboard back on the button that opened the open one */
  closePops(refocus = false): void {
    const opener = this.bar.querySelector<HTMLElement>('button[aria-expanded="true"]');
    for (const p of [this.filterPop, this.tourPop]) p.classList.remove("clt-open");
    this.bar.querySelectorAll("button[aria-expanded]").forEach(b => b.setAttribute("aria-expanded", "false"));
    if (refocus) opener?.focus();
  }

  // ---------------------------------------------------------------- filters
  private renderFilters(): void {
    const f = this.filters, box = (on: boolean) => (on ? " checked" : "");
    this.filterPop.innerHTML = `<h4>${esc(this.s("houses"))}</h4>
      ${this.houses.map(h => `<label><input type="checkbox" data-house="${esc(h.id)}"${box(f.houses[h.id])}>
        <span class="clt-sw" style="background:${esc(h.colour)}"></span>${esc(h.name)}</label>`).join("")}
      <hr><h4>${esc(this.s("show"))}</h4>
      <label><input type="checkbox" data-f="rulersOnly"${box(f.rulersOnly)}>${esc(this.s("rulersOnly"))}</label>
      <label><input type="checkbox" data-f="disputed"${box(f.disputed)}>${esc(this.s("disputed"))}</label>
      <label><input type="checkbox" data-f="outside"${box(f.outside)}>${esc(this.s("outside"))}</label>
      <hr><button class="clt-link" data-f="reset">${esc(this.s("reset"))}</button>`;
    this.filterPop.onchange = e => {
      const i = e.target as HTMLInputElement;
      if (i.dataset.house) f.houses[i.dataset.house] = i.checked;
      else if (i.dataset.f) (f as unknown as Record<string, boolean>)[i.dataset.f] = i.checked;
      this.markFilters();
      this.ev.filters(f);
    };
    (this.filterPop.querySelector('[data-f="reset"]') as HTMLButtonElement).onclick = () => {
      for (const k of Object.keys(f.houses)) f.houses[k] = true;
      Object.assign(f, { rulersOnly: false, disputed: true, outside: true });
      this.renderFilters(); this.ev.filters(f);
      (this.filterPop.querySelector("input") as HTMLElement | null)?.focus();
    };
    this.filterPop.onkeydown = e => { if (e.key === "Escape") { e.stopPropagation(); this.closePops(true); } };
    this.markFilters();
  }

  /** the Filters button shows a dot while anything is filtered out */
  private markFilters(): void {
    const btn = this.bar.querySelector('[data-tb="filters"]');
    if (!btn) return;
    const on = !isDefault(this.filters);
    btn.classList.toggle("clt-on", on);
    btn.textContent = on ? `${this.s("filters")} •` : this.s("filters");
  }

  // ---------------------------------------------------------------- time
  setYear(y: number | null): void {
    this.year = y === null ? null : Math.max(this.years[0], Math.min(this.years[1], Math.round(y)));
    this.bar.querySelector('[data-tb="time"]')?.setAttribute("aria-pressed", String(this.year !== null));
    this.renderTime();
    this.ev.time(this.year);
  }

  private closeTime(): void {
    this.setYear(null);
    (this.bar.querySelector('[data-tb="time"]') as HTMLElement | null)?.focus();
  }

  private renderTime(): void {
    const y = this.year;
    this.timeBox.classList.toggle("clt-open", y !== null);
    if (y === null) { this.timeBox.innerHTML = ""; return; }
    const era = [...(this.layout.eras ?? [])].reverse().find(e => e.year <= y);
    const eps = (this.layout.episodes ?? []).filter(e => e.from <= y && y <= e.to).map(e => e.name);
    let range = this.timeBox.querySelector<HTMLInputElement>("input[type=range]");
    if (!range) {
      this.timeBox.innerHTML = `<div class="clt-row"><output></output>
          <input type="range" min="${this.years[0]}" max="${this.years[1]}" step="1">
          <button class="clt-x" aria-label="${esc(this.s("timeClose"))}" title="${esc(this.s("timeClose"))}">×</button></div>
        <div class="clt-info"></div>`;
      range = this.timeBox.querySelector<HTMLInputElement>("input[type=range]")!;
      range.setAttribute("aria-label", this.s("time"));
      range.oninput = () => this.setYear(Number(range!.value));
      range.onkeydown = e => {
        e.stopPropagation();
        if (e.key === "Escape") this.closeTime();
      };
      (this.timeBox.querySelector(".clt-x") as HTMLButtonElement).onclick = () => this.closeTime();
    }
    if (Number(range.value) !== y) range.value = String(y);
    range.setAttribute("aria-valuetext", `${y}${era ? `, ${era.name}` : ""}`);
    this.timeBox.querySelector("output")!.textContent = String(y);
    this.timeBox.querySelector(".clt-info")!.innerHTML = `${era ? `<span class="clt-era">${esc(era.name)}</span>` : ""}`
      + `${eps.length ? ` · <span class="clt-ep">${esc(eps.join(", "))}</span>` : ""}`
      + `<div class="clt-note">${esc(this.s("timeNote"))}</div>`;
  }

  // ---------------------------------------------------------------- tours
  private renderTours(): void {
    this.tourPop.innerHTML = this.tours.map(tr => `<button class="clt-tour" data-tour="${esc(tr.id)}"><b>${esc(tr.title)}</b>
      <small>${esc(tr.summary ?? "")} · ${tr.steps.length}</small></button>`).join("");
    this.tourPop.onclick = e => {
      const b = (e.target as HTMLElement).closest<HTMLElement>("[data-tour]");
      if (b) { this.closePops(); this.startTour(b.dataset.tour!, 0); }
    };
    this.tourPop.onkeydown = e => { if (e.key === "Escape") { e.stopPropagation(); this.closePops(true); } };
  }

  startTour(id: string | null, step: number, focus = true): void {
    const hadFocus = this.card.contains(this.root()?.activeElement ?? null);
    const tour = this.tours.find(x => x.id === id);
    if (tour && this.year !== null) this.setYear(null);
    this.tourId = tour ? tour.id : null;
    this.tourStep = tour ? Math.max(0, Math.min(tour.steps.length - 1, step)) : 0;
    this.renderCard();
    this.ev.tour(this.tourId, this.tourStep);
    if (tour && (focus || hadFocus)) (this.card.querySelector(".clt-primary") as HTMLElement | null)?.focus({ preventScroll: true });
    else if (!tour && hadFocus) this.focusHost();
  }

  /** tour keys while a tour runs: arrows and Page keys step, Escape ends; returns true when handled */
  tourKey(key: string): boolean {
    if (!this.tourId) return false;
    if (key === "ArrowRight" || key === "PageDown") { this.stepBy(1); return true; }
    if (key === "ArrowLeft" || key === "PageUp") { this.stepBy(-1); return true; }
    if (key === "Escape") { this.startTour(null, 0); return true; }
    return false;
  }

  private stepBy(d: number): void {
    const tour = this.tours.find(x => x.id === this.tourId);
    if (!tour) return;
    const n = this.tourStep + d;
    if (n >= tour.steps.length) { this.startTour(null, 0); return; }
    if (n >= 0) this.startTour(tour.id, n);
  }

  private renderCard(): void {
    const tour = this.tours.find(x => x.id === this.tourId);
    this.card.classList.toggle("clt-open", !!tour);
    if (!tour) { this.card.innerHTML = ""; return; }
    const st = tour.steps[this.tourStep], last = this.tourStep === tour.steps.length - 1;
    this.card.setAttribute("aria-label", tour.title);
    this.card.innerHTML = `<div class="clt-head"><span class="clt-k">${esc(tour.title)} · ${esc(this.s("step", { n: this.tourStep + 1, m: tour.steps.length }))}</span>
        <button class="clt-x" data-nav="end" aria-label="${esc(this.s("endTour"))}" title="${esc(this.s("endTour"))} (Esc)">×</button></div>
      ${st.title ? `<h3>${esc(st.title)}</h3>` : ""}<p>${esc(st.caption)}</p>
      <div class="clt-nav"><button data-nav="back"${this.tourStep ? "" : " disabled"}>${esc(this.s("back"))}</button>
        <button class="clt-primary" data-nav="next">${esc(this.s(last ? "finish" : "next"))}</button></div>`;
    this.card.onclick = e => {
      const nav = (e.target as HTMLElement).closest<HTMLElement>("[data-nav]")?.dataset.nav;
      if (nav === "next") this.stepBy(1); else if (nav === "back") this.stepBy(-1); else if (nav === "end") this.startTour(null, 0);
    };
    this.card.onkeydown = e => { if (this.tourKey(e.key)) { e.preventDefault(); e.stopPropagation(); } };
  }

  // ---------------------------------------------------------------- relationship pick
  showPick(on: boolean): void {
    this.banner.classList.toggle("clt-open", on);
    if (!on) { this.banner.innerHTML = ""; return; }
    const touch = typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
    this.banner.innerHTML = `<span>${esc(this.s(touch ? "pickSecondTouch" : "pickSecond"))}</span><button>${esc(this.s("cancel"))}</button>`;
    (this.banner.querySelector("button") as HTMLButtonElement).onclick = () => this.ev.cancelPick();
  }
}

export function isDefault(f: FilterState): boolean {
  return Object.values(f.houses).every(Boolean) && !f.rulersOnly && f.disputed && f.outside;
}

/** the people the filters keep */
export function filtered(layout: Layout, f: FilterState): Set<string> | null {
  if (isDefault(f)) return null;
  const keep = new Set<string>();
  for (const [id, p] of Object.entries(layout.people) as [string, Person][]) {
    if (p.house ? f.houses[p.house] === false : !f.outside) continue;
    if (f.rulersOnly && p.kind !== "ruler") continue;
    if (!f.disputed && (p.hatch || p.tag === "disputed")) continue;
    keep.add(id);
  }
  return keep;
}

/** the people present in `year` (their span, read from the dates on their cards) */
export function presentIn(layout: Layout, year: number): Set<string> {
  const keep = new Set<string>();
  for (const [id, p] of Object.entries(layout.people)) {
    const [a, b] = p.span ?? [p.year, p.year + 30];
    if (a <= year && year <= b) keep.add(id);
  }
  return keep;
}

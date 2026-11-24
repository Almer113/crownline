// <crownline-viewer src="chart.html" layout="chart.layout.json">: pan, zoom, minimap, selection, links.
// The chart page drawn by the engine is shown as it is (live HTML and SVG), inside a shadow root.
// Hybrid zoom (docs/research/1.1): `will-change: transform` only while moving, so the browser keeps a
// cached bitmap during a gesture and re-draws sharp text once it stops.
import { Camera, MAX_ZOOM, type View } from "./camera";
import { loadLayout, type Layout } from "./layout";
import { Minimap } from "./minimap";
import { Portraits } from "./portraits";
import { Highlight, STYLES, lineage, lineAt, lineEnds } from "./highlight";
/** the closest a jump to one person zooms: the card with its neighbours around it */
const PERSON_ZOOM = 1;
import { Panel, PANEL_CSS, PANEL_W, SHEET, SHEET_BELOW, type RelationView } from "./panel";
import { Toolbar, TOOLBAR_CSS, filtered, presentIn, type Tour, type TourStep } from "./toolbar";
import { Search } from "./search";
import { Glossary } from "./glossary";
import { relate } from "./kinship";
import { LANGS, offered, pickLang, t, type Lang } from "./i18n";
import type { Rect } from "./layout";
import { placeKey, readHash, writeHash, type HashState } from "./url";

const SETTLE_MS = 150;

const SHELL_CSS = `
:host { display: block; position: relative; overflow: hidden; background: #CFC8B4; outline: none;
        touch-action: none; user-select: none; -webkit-user-select: none; contain: strict; }
:host(:focus-visible)::after { content: ""; position: absolute; inset: 0; pointer-events: none; z-index: 5;
                               box-shadow: inset 0 0 0 3px #2B6CB0; }
#vp { position: absolute; inset: 0; right: var(--pw, 0px); bottom: var(--pb, 0px); cursor: grab; }
.cl-tip { position: absolute; z-index: 4; pointer-events: none; max-width: 300px; padding: 5px 9px; border-radius: 6px;
       background: rgba(31,31,31,.92); color: #FFFFFF; font: 13.5px/1.35 'AHG', system-ui, sans-serif; display: none; }
.cl-tip b { font-size: 14.5px; }
.cl-tip .cl-gl { display: block; margin-top: 3px; color: #F3E2B3; font-size: 13px; }
#vp.dragging { cursor: grabbing; }
#stage { position: absolute; left: 0; top: 0; transform-origin: 0 0; }
#stage.moving { will-change: transform; }
#sel { position: absolute; pointer-events: none; border: 4px solid #1F1F1F; border-radius: 6px;
       box-shadow: 0 0 0 3px rgba(255,255,255,.9); display: none; }
[data-id] { cursor: pointer; }
.cl-guide { position: absolute; top: 0; width: 0; border-left: 1.5px dashed #B0302A; pointer-events: none; }
.cl-ghost.was { border-color: #B0302A; background: rgba(176,48,42,.08); }
.cl-ghost { position: absolute; border: 2px dashed #1F1F1F; background: rgba(255,255,255,.35); pointer-events: none; border-radius: 4px; }
#region { position: absolute; display: none; pointer-events: none; border: 2px dashed #1F1F1F;
          background: rgba(255,255,255,.25); }
.minimap { position: absolute; right: calc(var(--pw, 0px) + 12px); bottom: calc(var(--pb, 0px) + 12px); border-radius: 6px; cursor: crosshair;
           box-shadow: 0 1px 6px rgba(0,0,0,.25); background: #EDE8D8; }
.minimap.hidden { display: none; }
.ctrls { position: absolute; left: 12px; bottom: calc(var(--pb, 0px) + 12px); display: flex; gap: 6px; }
.ctrls.off { display: none; }
.ctrls button { font: 600 15px system-ui, sans-serif; min-width: 36px; height: 36px; border: 0; border-radius: 6px;
                background: rgba(255,255,255,.94); color: #1F1F1F; box-shadow: 0 1px 4px rgba(0,0,0,.2); cursor: pointer; }
.ctrls button:focus-visible { outline: 3px solid #2B6CB0; }
.status { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); font: 15px system-ui, sans-serif;
          color: #1F1F1F; background: rgba(255,255,255,.94); padding: 10px 14px; border-radius: 6px; }
` + PANEL_CSS + TOOLBAR_CSS;

export class CrownlineViewer extends HTMLElement {
  layout?: Layout;
  readonly cam: Camera;
  private readonly root: ShadowRoot;
  private readonly vp: HTMLDivElement;
  private readonly stage: HTMLDivElement;
  private readonly selBox: HTMLDivElement;
  private minimap?: Minimap;
  private portraits?: Portraits;
  private highlight?: Highlight;
  private panel?: Panel;
  private tip?: HTMLDivElement;
  private toolbar?: Toolbar;
  private search?: Search;
  private glossary?: Glossary;
  private tours: Tour[] = [];
  /** interface language (the `lang` attribute, or the toolbar's toggle) */
  uiLang: Lang = "en";
  /** the interface languages this chart offers (the layout's `interface`, else all) */
  langs: Lang[] = LANGS;
  /** relationship finder: the first person while a second is being picked; then the shown relationship */
  private pickFrom: string | null = null;
  private relFrom: string | null = null;
  private relView: RelationView | null = null;
  private filterSet: Set<string> | null = null;
  private year: number | null = null;
  private hoverOwner: string | null = null;
  /** the reader's own choice to show or hide the minimap (M or its button); null: by width */
  private mapChoice: boolean | null = null;
  private settle = 0;
  private hashTimer = 0;
  private selected: string | null = null;
  private placed = false;
  private resizeObs?: ResizeObserver;
  private loading = false;
  private globals?: AbortController;
  /** the style elements the chart page brought (replaced with the page) */
  private chartStyles: HTMLStyleElement[] = [];
  private shown = false;

  /** the editor's viewer (attribute `editor`): no reader toolbar or card panel, and the address is left alone;
   *  the editor gives it each new page with show() */
  get editor(): boolean { return this.hasAttribute("editor"); }

  /** where the first view opens (a page that hands the chart over from another view: the app's view and edit
   *  screens), in place of the address; set before show() */
  start: HashState | null = null;

  constructor() {
    super();
    this.root = this.attachShadow({ mode: "open" });
    this.root.innerHTML = `<style>${SHELL_CSS}</style><div id="vp"><div id="stage"><div id="sel"></div></div></div><div id="region"></div>
      <div class="ctrls" part="controls">
        <button data-act="in" aria-label="Zoom in" title="Zoom in (+)">+</button>
        <button data-act="out" aria-label="Zoom out" title="Zoom out (−)">−</button>
        <button data-act="fit" aria-label="Show the whole chart" title="Whole chart (0)">⤢</button>
        <button data-act="map" aria-label="Show or hide the overview" title="Overview (M)">▣</button>
      </div><div class="status" role="status">Loading the chart…</div>`;
    this.vp = this.root.getElementById("vp") as HTMLDivElement;
    this.stage = this.root.getElementById("stage") as HTMLDivElement;
    this.selBox = this.root.getElementById("sel") as HTMLDivElement;
    this.cam = new Camera(moving => this.apply(moving));
  }

  connectedCallback(): void {
    // attributes may not be set in the constructor (custom-element rules), so set them here
    if (!this.hasAttribute("tabindex")) this.tabIndex = 0;
    // a region, not an application: the panel and toolbar inside must read as normal text and controls
    if (!this.hasAttribute("role")) this.setAttribute("role", "region");
    if (!this.hasAttribute("aria-label")) this.setAttribute("aria-label", t(this.uiLang, "viewerLabel"));
    this.globals = new AbortController();
    addEventListener("hashchange", () => this.followHash(), { signal: this.globals.signal });
    if (this.loading) { this.resizeObs?.observe(this.vp); this.resizeObs?.observe(this); return; }    // moved in the page: keep what is loaded
    this.loading = true;
    this.load().catch(err => {
      this.loading = false;                                   // so adding the element again tries again
      this.status(t(this.uiLang, "loadFailed", { msg: (err as Error).message }));
    });
  }

  disconnectedCallback(): void {
    this.resizeObs?.disconnect(); this.cam.stop(); this.globals?.abort();
    clearTimeout(this.settle); clearTimeout(this.hashTimer);   // a removed viewer must not rewrite the address
  }

  private status(msg: string | null): void {
    const el = this.root.querySelector(".status") as HTMLElement;
    el.textContent = msg ?? ""; el.style.display = msg ? "" : "none";
  }

  private async load(): Promise<void> {
    const src = this.getAttribute("src"), layoutUrl = this.getAttribute("layout");
    if (!src || !layoutUrl) {
      // the editor, and a page with the attribute `manual`, call show() themselves
      if (this.editor || this.hasAttribute("manual")) return;
      throw new Error("set the src and layout attributes");
    }
    const [html, layout] = await Promise.all([fetch(src).then(r => {
      if (!r.ok) throw new Error(`${src}: HTTP ${r.status}`); return r.text();
    }), loadLayout(layoutUrl)]);
    await this.show(html, layout, new URL(src, location.href));
  }

  /** show a chart page and its layout file (`base`: where the page's relative paths start). Called again, it
   *  swaps the chart in place: the view stays where it is, and so does the selection while that person exists.
   *  `files` (the editor, on a folder opened in the browser): a loadable URL for a relative path, used after the
   *  page is made safe, so its own links are still checked as written */
  async show(html: string, layout: Layout, base: URL, files?: (path: string) => string | undefined): Promise<void> {
    this.files = files;
    if (this.shown) { this.swap(html, layout, base); return; }
    this.shown = true;
    this.loading = true;
    this.layout = layout;
    this.mountChart(html, base);
    const pBase = this.getAttribute("portraits");
    if (pBase) {
      const sizes = (this.getAttribute("portrait-sizes") ?? "64,160").split(",").map(Number).filter(n => n > 0);
      this.portraits = new Portraits(this.stage, new URL(pBase.replace(/\/?$/, "/"), location.href).href, sizes);
    }
    await document.fonts.ready;
    const [W, H] = layout.canvas;
    this.minimap = new Minimap(layout, this.cam);
    this.root.appendChild(this.minimap.el);
    this.bindInput();
    // A hidden or not-yet-laid-out element measures 0x0: place the first view only once it has a real size.
    // the card panel and the lineage highlight
    const chartEl = this.stage.querySelector("#chart") as HTMLElement;
    const style = STYLES[this.getAttribute("highlight") ?? "strong"] ?? STYLES.strong;
    this.highlight = new Highlight(chartEl, layout, style);
    this.langs = offered(layout.interface);
    this.uiLang = pickLang(this.getAttribute("lang"), this.langs) ?? pickLang(document.documentElement.lang, this.langs) ?? this.langs[0];
    this.glossary = new Glossary(layout);
    this.search = new Search(layout);
    this.tours = layout.tours ?? [];
    if (!this.editor) this.readerUi(layout);
    this.tip = document.createElement("div"); this.tip.className = "cl-tip"; this.tip.setAttribute("aria-hidden", "true");
    this.root.appendChild(this.tip);
    const h: HashState = this.start ?? (this.editor ? { view: null, person: null, from: null, year: null, tour: null } : readHash());
    this.navKey = placeKey(h);
    const place = () => {
      // a linked selection opens the panel first, so the linked view is centred in the narrowed chart area
      if (h.person && layout.people[h.person]) {
        if (h.from && layout.people[h.from]) this.relFrom = h.from;
        this.select(h.person, false, !!this.relFrom);
      }
      this.cam.setSizes(W, H, this.vp.clientWidth, this.vp.clientHeight);
      this.applyLang();
      this.minimap!.el.classList.toggle("hidden", this.clientWidth < 700);
      const shown = this.selected ? this.unionRect(this.relView?.relation?.path ?? [this.selected]) : null;
      if (h.view) this.cam.set(this.cam.viewAt(h.view.cx, h.view.cy, h.view.s), false);
      else if (shown) this.cam.set(this.cam.viewFor(shown, 80, PERSON_ZOOM), false);
      else this.cam.set(this.cam.fitView(), false);
      this.placed = true;
      if (h.year != null) this.toolbar?.setYear(h.year);
      if (h.tour && this.tours.some(x => x.id === h.tour!.id)) this.toolbar?.startTour(h.tour.id, h.tour.step, false);
      if (this.selected || h.year != null) this.syncHash();
      this.setAttribute("ready", "");   // for pages and tests: the chart is shown and the first view is placed
    };
    this.resizeObs = new ResizeObserver(() => {
      this.dock();                                  // the host changed size: the panel may switch side or sheet
      if (!this.vp.clientWidth || !this.vp.clientHeight) return;
      if (!this.placed) { place(); return; }
      this.resized(false);
    });
    this.resizeObs.observe(this.vp);
    this.resizeObs.observe(this);
    if (this.vp.clientWidth && this.vp.clientHeight) place();
    this.status(null);
    this.dispatchEvent(new CustomEvent("ready", { detail: { layout } }));
  }

  /** the reader's card panel and toolbar (not in the editor) */
  private readerUi(layout: Layout): void {
    this.panel = new Panel(layout, {
      go: id => {
        // names in a relationship are on its path: look at them without leaving the relationship
        const r = this.layout?.people[id]?.rect;
        if (this.pickFrom) this.choose(id);
        else if (this.relView?.relation?.path.includes(id) && r) void this.cam.flyTo(this.cam.viewFor(r, 80, 1.5));
        else void this.flyToPerson(id);
      },
      // while a second person is being picked, closing (× or Esc) cancels the pick first
      close: () => { if (this.pickFrom) this.endPick(); else { this.select(null); this.focus({ preventScroll: true }); } },
      lineage: () => this.refreshLit(),
      relate: () => this.startPick(),
      clearRelation: () => { this.relFrom = null; this.select(this.selected, false, false); },
    }, u => this.resolve(u), () => this.uiLang, this.glossary!);
    this.root.appendChild(this.panel.el);
    this.toolbar = new Toolbar(layout, this.tours, {
      query: q => this.search!.find(q),
      pick: id => { if (this.pickFrom) this.choose(id); else void this.flyToPerson(id); },
      filters: f => { this.filterSet = filtered(layout, f); this.refreshLit(); },
      time: y => { this.year = y; this.refreshLit(); this.queueHash(); },
      tour: (id, step) => this.playTour(id, step),
      lang: l => this.setLang(l),
      cancelPick: () => this.endPick(),
    }, this.uiLang, this.langs);
    this.toolbar.defaultYear = () => {
      const sp = this.selected ? layout.people[this.selected]?.span : null;
      return sp ? sp[0] : layout.startYear ?? this.toolbar!.midYear;
    };
    for (const el of this.toolbar.els) this.root.appendChild(el);
  }

  /** a new page for the chart already shown (the editor, after an edit): the old one goes, the view stays */
  private swap(html: string, layout: Layout, base: URL): void {
    this.stage.querySelector("#chart")?.remove();
    for (const st of this.chartStyles) st.remove();
    this.chartStyles = [];
    this.layout = layout;
    this.mountChart(html, base);
    const chartEl = this.stage.querySelector("#chart") as HTMLElement;
    this.highlight = new Highlight(chartEl, layout, STYLES[this.getAttribute("highlight") ?? "strong"] ?? STYLES.strong);
    const hidden = this.minimap?.el.classList.contains("hidden") ?? false;
    this.minimap?.el.remove();
    this.minimap = new Minimap(layout, this.cam);
    this.minimap.el.classList.toggle("hidden", hidden);
    this.root.appendChild(this.minimap.el);
    this.glossary = new Glossary(layout);
    this.search = new Search(layout);
    const pBase = this.getAttribute("portraits");
    if (pBase) {
      const sizes = (this.getAttribute("portrait-sizes") ?? "64,160").split(",").map(Number).filter(n => n > 0);
      this.portraits = new Portraits(this.stage, new URL(pBase.replace(/\/?$/, "/"), location.href).href, sizes);
    }
    const { s, tx, ty } = this.cam;
    this.cam.setSizes(layout.canvas[0], layout.canvas[1], this.vp.clientWidth, this.vp.clientHeight);
    this.cam.set({ s, tx, ty }, false);
    this.hoverOwner = null;
    this.select(this.selected && layout.people[this.selected] ? this.selected : null, false, true);
    this.sharpen();
  }

  /** the person whose card is at a point on the screen (client coordinates), or null */
  personAt(x: number, y: number): string | null { return this.idAtPoint(x, y); }

  /** a point on the screen (client coordinates) in chart pixels */
  chartPoint(x: number, y: number): [number, number] {
    const vr = this.vp.getBoundingClientRect(), { s, tx, ty } = this.cam;
    return [(x - vr.left - tx) / s, (y - vr.top - ty) / s];
  }

  /** a rectangle in chart pixels on the screen (client coordinates) */
  screenRect([l, t, r, b]: Rect): DOMRect {
    const vr = this.vp.getBoundingClientRect(), { s, tx, ty } = this.cam;
    return new DOMRect(vr.left + l * s + tx, vr.top + t * s + ty, (r - l) * s, (b - t) * s);
  }

  /** the editor's drag preview: shift these people's cards (and the selection outline) by dx, dy chart pixels,
   *  and draw guide lines at chart x positions; preview(null) ends it */
  preview(p: { ids: string[]; dx: number; dy?: number; guides?: number[]; rect?: Rect; ghosts?: Rect[] } | null): void {
    for (const el of this.stage.querySelectorAll<HTMLElement>("[data-cl-moved]")) { el.style.translate = ""; el.removeAttribute("data-cl-moved"); }
    for (const g of this.stage.querySelectorAll(".cl-guide, .cl-ghost")) g.remove();
    this.selBox.style.translate = "";
    if (!p) return;
    const t = `${p.dx}px ${p.dy ?? 0}px`;
    for (const id of p.ids) for (const el of this.stage.querySelectorAll<HTMLElement>(`[data-id="${CSS.escape(id)}"]`)) {
      el.style.translate = t; el.setAttribute("data-cl-moved", "");
    }
    if (this.selected && p.ids.includes(this.selected)) this.selBox.style.translate = t;
    const H = this.layout?.canvas[1] ?? 0;
    for (const x of p.guides ?? []) {
      const g = document.createElement("div"); g.className = "cl-guide";
      Object.assign(g.style, { left: `${x}px`, height: `${H}px` });
      this.stage.appendChild(g);
    }
    for (const [l, t2, r, b] of p.ghosts ?? []) {          // where things were (a re-layout's "before")
      const g = document.createElement("div"); g.className = "cl-ghost was";
      Object.assign(g.style, { left: `${l}px`, top: `${t2}px`, width: `${r - l}px`, height: `${b - t2}px` });
      this.stage.appendChild(g);
    }
    if (p.rect) {
      const [l, t2, r, b] = p.rect, g = document.createElement("div"); g.className = "cl-ghost";
      Object.assign(g.style, { left: `${l + p.dx}px`, top: `${t2 + (p.dy ?? 0)}px`, width: `${r - l}px`, height: `${b - t2}px` });
      this.stage.appendChild(g);
    }
  }

  /** fly to a rectangle in chart pixels (a problem's area) */
  flyToRect(r: Rect, zoom = 1.2): Promise<void> { return this.cam.flyTo(this.cam.viewFor(r, 80, zoom)); }

  /** put the engine's page into the shadow root: its CSS scoped to the stage, its relative URLs resolved */
  private files: ((path: string) => string | undefined) | undefined;
  private base: URL | undefined;

  /** a loadable URL for a path in the chart page (a portrait): the caller's files, or relative to the page */
  private resolve(u: string, base = this.base!): string {
    return /^(data:|https?:|\/\/|#)/.test(u) ? u : this.files?.(u) ?? new URL(u, base).href;
  }

  private mountChart(html: string, base: URL): void {
    this.base = base;
    const doc = new DOMParser().parseFromString(html, "text/html");
    const abs = (u: string) => this.resolve(u, base);
    const fontFaces: string[] = [];
    for (const st of Array.from(doc.querySelectorAll("style"))) {
      let css = st.textContent ?? "";
      css = css.replace(/url\((['"]?)([^'")]+)\1\)/g, (_m, q: string, u: string) => `url(${q}${abs(u)}${q})`);
      // @font-face does not work inside a shadow root: lift it to the document
      css = css.replace(/@font-face\s*\{[^}]*\}/g, m => { fontFaces.push(m); return ""; });
      // page-level selectors mean the stage here: body, html, :root (alone or in a selector list)
      const PAGE = /^(html|body|:root)$/;
      css = css.replace(/(^|[{}])([^{}@]*)\{/g, (m, pre: string, sel: string) => {
        const parts = sel.split(",").map(x => x.trim());
        if (!parts.some(x => PAGE.test(x))) return m;
        return `${pre} ${[...new Set(parts.map(x => (PAGE.test(x) ? "#stage" : x)))].join(", ")} {`;
      });
      const el = document.createElement("style"); el.textContent = css; this.root.insertBefore(el, this.vp);
      this.chartStyles.push(el);
    }
    if (fontFaces.length && !document.getElementById("crownline-fonts")) {
      const f = document.createElement("style"); f.id = "crownline-fonts"; f.textContent = fontFaces.join("\n");
      document.head.appendChild(f);
    }
    const chart = doc.getElementById("chart");
    if (!chart) throw new Error("the chart page has no #chart element");
    // the page is data: no scripts, embedded documents, animations that could set links, inline event
    // handlers, or links other than web, data-image and in-page ones (browsers ignore spaces and control
    // characters inside a scheme, so those are removed before the check)
    const DROP = /^(script|iframe|object|embed|form|foreignobject|animate|animatemotion|animatetransform|set|base|meta|link)$/i;
    const URLISH = /^(href|xlink:href|src|action|formaction|data|srcdoc|poster|background)$/i;
    for (const el of Array.from(chart.querySelectorAll("*"))) {
      if (DROP.test(el.localName)) { el.remove(); continue; }
      for (const at of Array.from(el.attributes)) {
        const v = at.value.replace(/[\u0000-\u0020\u007f]+/g, "").toLowerCase();
        if (/^on/i.test(at.name) || at.name.toLowerCase() === "srcdoc"
            || (URLISH.test(at.name) && /^[a-z][a-z0-9+.-]*:/.test(v) && !/^(https?:|data:image\/)/.test(v)))
          el.removeAttribute(at.name);
      }
    }
    for (const img of Array.from(chart.querySelectorAll("img"))) {
      img.setAttribute("src", abs(img.getAttribute("src") ?? "")); img.decoding = "async"; img.draggable = false;
    }
    this.stage.insertBefore(document.adoptNode(chart), this.selBox);
  }

  private apply(moving: boolean): void {
    this.stage.style.transform = `translate(${this.cam.tx}px, ${this.cam.ty}px) scale(${this.cam.s})`;
    if (moving) {
      this.stage.classList.add("moving");
      clearTimeout(this.settle);
      this.settle = window.setTimeout(() => { this.stage.classList.remove("moving"); this.sharpen(); }, SETTLE_MS);
    } else {
      this.stage.classList.remove("moving");
      this.sharpen();
    }
    this.minimap?.update(this.vp.clientWidth, this.vp.clientHeight);
    this.queueHash();
  }

  /** write the address soon, once things settle (Safari throws after ~100 history updates in 30 s) */
  private queueHash(): void {
    clearTimeout(this.hashTimer);
    this.hashTimer = window.setTimeout(() => this.syncHash(), 300);
  }

  private sharpen(): void {
    if (this.placed) this.portraits?.refresh(this.cam.s, this.vp.getBoundingClientRect());
  }

  /** the place in the address the last time it was written or followed (see placeKey) */
  private navKey = "";

  /** write the address. Choosing a person, a relationship or a tour step is a browser-history step, so Back
   *  returns to the one before; moving the view or the year only updates the current step. A page that
   *  embeds the viewer can keep its history untouched with history="replace". */
  private syncHash(): void {
    // the editor's viewer writes the address only when asked (attribute `address`), and never follows it
    if (!this.placed || (this.editor && !this.hasAttribute("address"))) return;
    const [cx, cy] = this.cam.centre();
    const tb = this.toolbar;
    const st: HashState = { view: { cx, cy, s: this.cam.s }, person: this.selected, from: this.relFrom, year: this.year,
                            tour: tb?.tourId ? { id: tb.tourId, step: tb.tourStep } : null };
    const key = placeKey(st), push = key !== this.navKey && this.getAttribute("history") !== "replace";
    this.navKey = key;
    writeHash(st, push);
  }

  private followHash(): void {
    const h = readHash(), L = this.layout;
    if (!this.placed || !L || this.editor) return;
    this.navKey = placeKey(h);                // following the address is not a new history step
    const tb = this.toolbar!;
    if ((h.year ?? null) !== this.year) tb.setYear(h.year ?? null);
    const tour = h.tour && this.tours.some(x => x.id === h.tour!.id) ? h.tour : null;
    if ((tour?.id ?? null) !== tb.tourId || (tour && tour.step !== tb.tourStep)) { tb.startTour(tour?.id ?? null, tour?.step ?? 0, false); return; }
    const person = h.person && L.people[h.person] ? h.person : null, from = h.from && L.people[h.from] ? h.from : null;
    if (person && from && (person !== this.selected || from !== this.relFrom)) {
      this.relFrom = from; this.select(person, false, true);
      const r = this.unionRect(this.relView?.relation?.path ?? [from, person]);
      if (r) void this.cam.flyTo(this.cam.viewFor(r, 60, 1.5));
      return;
    }
    if (person !== this.selected || (!from && this.relFrom)) {
      if (person) { this.relFrom = null; void this.flyToPerson(person); return; }
      this.select(null);
    }
    if (h.view) {
      const [cx, cy] = this.cam.centre();
      if (Math.abs(cx - h.view.cx) > 1 || Math.abs(cy - h.view.cy) > 1 || Math.abs(this.cam.s - h.view.s) > 0.001)
        void this.cam.flyTo(this.cam.viewAt(h.view.cx, h.view.cy, h.view.s));
    }
  }

  // ------------------------------------------------------------------ public API
  fit(): Promise<void> { return this.cam.flyTo(this.cam.fitView()); }

  /** where the reader is: the view, the selected person, the relationship, the year and the tour step (null
   *  before the first view is placed); what `start` takes, to open another viewer at the same place */
  where(): HashState | null {
    if (!this.placed) return null;
    const [cx, cy] = this.cam.centre(), tb = this.toolbar;
    return { view: { cx, cy, s: this.cam.s }, person: this.selected, from: this.relFrom, year: this.year,
             tour: tb?.tourId ? { id: tb.tourId, step: tb.tourStep } : null };
  }

  flyToPerson(id: string): Promise<void> {
    const p = this.layout?.people[id];
    if (!p) return Promise.resolve();
    this.select(id, false);
    return this.cam.flyTo(this.cam.viewFor(p.rect, 80, PERSON_ZOOM));
  }

  /** what a reader's click, search result or relative button does: completes a relationship pick when one is
   *  running (a click on empty paper keeps it running), otherwise selects */
  private choose(id: string | null): void {
    if (!this.pickFrom) { this.select(id); return; }
    if (!id || !this.layout?.people[id]) return;
    this.relFrom = this.pickFrom;
    this.endPick();
    this.select(id, true, true, true);
  }

  /** select a person (null: none). `keepRel` keeps the shown relationship; selecting the person already
   *  selected keeps it too. `flyPath` frames the relationship's whole path. */
  select(id: string | null, notify = true, keepRel = false, flyPath = false): void {
    const prev = this.selected;
    if (!keepRel && id !== this.selected) this.relFrom = null;
    this.selected = id && this.layout?.people[id] ? id : null;
    if (!this.selected) this.relFrom = null;
    this.relView = this.relFrom && this.selected
      ? { from: this.relFrom, relation: relate(this.layout!, this.relFrom, this.selected, this.uiLang) } : null;
    const p = this.selected ? this.layout!.people[this.selected] : null;
    if (p) {
      const [l, t, r, b] = p.rect, pad = 7;
      Object.assign(this.selBox.style, { display: "block", left: `${l - pad}px`, top: `${t - pad}px`,
                                         width: `${r - l + 2 * pad}px`, height: `${b - t + 2 * pad}px` });
    } else {
      this.selBox.style.display = "none";
    }
    const wasOpen = this.panel?.isOpen ?? false;
    if (this.selected) this.panel?.show(this.selected, this.relView, this.keepScroll); else this.panel?.hide();
    this.refreshLit();
    const open = this.panel?.isOpen ?? false;
    if (open !== wasOpen) {
      this.dock();
      if (this.placed) this.resized(true);        // now, so a fly-to that follows aims at the narrower view
      if (open && p && notify && !flyPath) this.reveal(p.rect);
    }
    if (flyPath) {
      const r = this.unionRect(this.relView?.relation?.path ?? [this.relFrom!, this.selected!]);
      if (r) void this.cam.flyTo(this.cam.viewFor(r, 60, 1.5));
    }
    this.syncHash();
    if (notify || prev !== this.selected) this.dispatchEvent(new CustomEvent("select", { detail: { id: this.selected, person: p } }));
  }

  private keepScroll = false;

  /** switch the interface language: controls, labels, the panel and any relationship are re-worded */
  setLang(l: Lang): void {
    if (!this.langs.includes(l)) return;           // the chart does not offer it
    this.uiLang = l;
    this.toolbar!.lang = l;
    this.toolbar?.render();
    this.applyLang();
    if (this.selected) { this.keepScroll = true; this.select(this.selected, false, true); this.keepScroll = false; }
    this.dispatchEvent(new CustomEvent("lang", { detail: l }));
  }

  private applyLang(): void {
    const L = this.uiLang, lab: Record<string, [string, string]> = {
      in: ["zoomIn", " (+)"], out: ["zoomOut", " (−)"], fit: ["wholeChart", " (0)"], map: ["overview", " (M)"] };
    for (const b of Array.from(this.root.querySelectorAll<HTMLButtonElement>(".ctrls button"))) {
      const [k, key] = lab[b.dataset.act ?? ""] ?? [];
      if (k) { b.setAttribute("aria-label", t(L, k)); b.title = t(L, k) + key; }
    }
    if (this.getAttribute("aria-label") === t(L === "en" ? "id" : "en", "viewerLabel") || !this.hasAttribute("aria-label"))
      this.setAttribute("aria-label", t(L, "viewerLabel"));
    this.minimap?.el.setAttribute("aria-label", t(L, "minimap"));
  }

  private toggleMap(): void {
    const el = this.minimap?.el;
    if (!el) return;
    el.classList.toggle("hidden");
    this.mapChoice = !el.classList.contains("hidden");
  }

  /** what is lit: a tour step decides alone; otherwise the relationship path or the lineage, narrowed by the
   *  filters and the year. The selected person always stays lit. */
  private refreshLit(): void {
    const L = this.layout, hl = this.highlight;
    if (!L || !hl) return;
    let lit: Set<string> | null = null;
    const extras: HTMLElement[] = [];
    const and = (s: Set<string>) => { lit = lit ? new Set([...lit].filter(x => s.has(x))) : new Set(s); };
    const step = this.tourStep();
    if (step) {
      if (step.light) and(new Set(step.light));
      if (step.lineage) and(lineage(L, step.lineage));
      if (step.year != null) and(presentIn(L, step.year));
      const cell = step.stage ? this.stageCell(step.stage) : null;
      if (cell) { extras.push(cell); if (!lit) lit = new Set(); }
    } else {
      const path = this.relView?.relation?.path;
      if (path) and(new Set(path));
      else if (this.selected && this.panel?.showLineage) and(lineage(L, this.selected));
      if (this.filterSet) and(this.filterSet);
      if (this.year !== null) {
        and(presentIn(L, this.year));
        const st = [...(L.stages ?? [])].reverse().find(x => x.from <= this.year!);
        const cell = st ? this.stageCell(st.id) : null;
        if (cell) extras.push(cell);
      }
      if (lit && this.selected) (lit as Set<string>).add(this.selected);
    }
    hl.show(lit, extras);
  }

  private stageCell(id: string): HTMLElement | null {
    return this.stage.querySelector<HTMLElement>(`#chart .mcell[data-stage="${CSS.escape(id)}"]`);
  }

  /** an element's box in chart pixels (for map cells, which their panel lays out) */
  private elRect(el: HTMLElement): Rect {
    const chart = this.stage.querySelector("#chart");
    let x = 0, y = 0;
    for (let n: HTMLElement | null = el; n && n !== chart; n = n.offsetParent as HTMLElement | null) { x += n.offsetLeft; y += n.offsetTop; }
    return [x, y, x + el.offsetWidth, y + el.offsetHeight];
  }

  private unionRect(items: string[]): Rect | null {
    const rs: Rect[] = [];
    for (const it of items) {
      if (it.startsWith("map:")) { const c = this.stageCell(it.slice(4)); if (c) rs.push(this.elRect(c)); }
      else { const r = this.layout?.people[it]?.rect; if (r) rs.push(r); }
    }
    if (!rs.length) return null;
    return [Math.min(...rs.map(r => r[0])), Math.min(...rs.map(r => r[1])), Math.max(...rs.map(r => r[2])), Math.max(...rs.map(r => r[3]))];
  }

  // ------------------------------------------------------------------ relationship finder
  private startPick(): void {
    if (!this.selected) return;
    this.pickFrom = this.selected;
    this.toolbar?.showPick(true);
  }

  private endPick(): void {
    this.pickFrom = null;
    this.toolbar?.showPick(false);
  }

  /** show the relationship from `a` to `b` (as if the user picked them in turn) */
  relate(a: string, b: string): void {
    if (!this.layout?.people[a] || !this.layout.people[b]) return;
    this.select(a, false);
    this.startPick();
    this.choose(b);
  }

  // ------------------------------------------------------------------ tours
  private tourStep(): TourStep | null {
    const tb = this.toolbar;
    return tb?.tourId ? this.tours.find(t => t.id === tb.tourId)?.steps[tb.tourStep] ?? null : null;
  }

  private playTour(id: string | null, _step: number): void {
    const st = this.tourStep();
    this.endPick();
    if (id && this.selected) this.select(null, false);       // the panel would take room from the tour's views
    this.refreshLit();
    this.syncHash();
    if (!st || !id) return;
    if (st.focus === "all" || !st.focus) { void this.cam.flyTo(this.cam.fitView(), 900); return; }
    const r = this.unionRect(st.focus);
    const [top, bottom] = this.toolbar!.tourInsets;
    if (r) void this.cam.flyTo(this.cam.viewFor(r, 40, st.zoom ?? 1.2, top, bottom), 900);
  }

  /** start a tour at a step (counting from 0); null ends the running tour */
  tour(id: string | null, step = 0): void { this.toolbar?.startTour(id, step); }

  /** the time slider's year (null closes it) */
  setYear(y: number | null): void { this.toolbar?.setYear(y); }

  /** the open panel takes room from the viewport, so it never covers the chart: docked at the right,
   *  or a bottom sheet on narrow viewers */
  private dock(): void {
    const open = this.panel?.isOpen ?? false, sheet = this.clientWidth < SHEET_BELOW;
    this.panel?.el.classList.toggle("clp-sheet", sheet);
    this.style.setProperty("--pw", open && !sheet ? `${PANEL_W}px` : "0px");
    this.style.setProperty("--pb", open && sheet ? `${Math.round(this.clientHeight * SHEET)}px` : "0px");
    this.root.querySelector(".ctrls")?.classList.toggle("off", open && sheet);
  }

  /** take the viewport's new size: keep the chart's corner still (panel opening or closing: nothing jumps
   *  under the pointer) or the centre of the view (window resize) */
  private resized(keepCorner: boolean): void {
    const vw = this.vp.clientWidth, vh = this.vp.clientHeight;
    if (!this.layout || !vw || !vh) return;
    const [cx, cy] = this.cam.centre();
    this.cam.setSizes(this.layout.canvas[0], this.layout.canvas[1], vw, vh);
    if (keepCorner) this.cam.set({ s: this.cam.s, tx: this.cam.tx, ty: this.cam.ty }, false);
    else this.cam.set(this.cam.viewAt(cx, cy, this.cam.s), false);
    if (this.mapChoice === null) this.minimap?.el.classList.toggle("hidden", this.clientWidth < 700);
    this.toolbar?.place();
    const p = this.selected ? this.layout.people[this.selected] : null;
    if (p && !keepCorner) this.reveal(p.rect);
  }

  /** pan just enough to bring `r` fully into the viewport (after the panel narrowed it) */
  private reveal(r: [number, number, number, number]): void {
    const { s, tx, ty } = this.cam, vw = this.vp.clientWidth, vh = this.vp.clientHeight, m = 24;
    const sx = r[0] * s + tx, ex = r[2] * s + tx, sy = r[1] * s + ty, ey = r[3] * s + ty;
    const dx = ex > vw - m ? vw - m - ex : sx < m ? m - sx : 0;
    const dy = ey > vh - m ? vh - m - ey : sy < m ? m - sy : 0;
    if (dx || dy) void this.cam.flyTo({ s, tx: tx + dx, ty: ty + dy }, 350);
  }

  // ------------------------------------------------------------------ input
  private bindInput(): void {
    const vp = this.vp, pointers = new Map<number, { x: number; y: number }>();
    let tipFrame = 0;
    let downAt: { x: number; y: number } | null = null, downId: string | null = null, pinch0 = 0;
    // shift-drag draws a box to zoom into (zoom-to-region)
    let regionFrom: { x: number; y: number } | null = null;
    let linkFrom: string | null = null;
    let editing: { x: number; y: number; moved: boolean; id: string | null } | null = null;
    const editAt = (e: PointerEvent) => { const [x, y] = this.chartPoint(e.clientX, e.clientY);
      return { x, y, dx: (e.clientX - editing!.x) / this.cam.s, dy: (e.clientY - editing!.y) / this.cam.s, clientX: e.clientX, clientY: e.clientY }; };
    const region = this.root.getElementById("region") as HTMLDivElement;
    const box = (a: { x: number; y: number }, b: { x: number; y: number }) =>
      [Math.min(a.x, b.x), Math.min(a.y, b.y), Math.max(a.x, b.x), Math.max(a.y, b.y)] as const;
    const local = (e: { clientX: number; clientY: number }) => {
      const r = this.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top };
    };

    const quiet = () => { cancelAnimationFrame(tipFrame); this.showTip(-1, -1); };
    vp.addEventListener("wheel", e => {
      e.preventDefault();
      quiet();
      const p = local(e);
      if (e.ctrlKey) this.cam.zoomAt(Math.exp(-e.deltaY * 0.01), p.x, p.y);          // trackpad pinch
      else if (e.shiftKey) this.cam.panBy(-(e.deltaX || e.deltaY), 0);   // some browsers already send deltaX
      else if (e.deltaMode === 0 && Math.abs(e.deltaX) > Math.abs(e.deltaY) / 2 && e.deltaX !== 0)
        this.cam.panBy(-e.deltaX, -e.deltaY);                                          // trackpad two-finger scroll
      else this.cam.zoomAt(Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0015)), p.x, p.y);
    }, { passive: false });

    vp.addEventListener("pointerdown", e => {
      if (e.pointerType === "mouse" && e.button !== 0) return;          // right and middle buttons: leave alone
      this.focus({ preventScroll: true, focusVisible: false } as FocusOptions);
      this.toolbar?.closePops();
      quiet();
      this.cam.stop();
      // the card under the pointer, found now: after capture, events target the viewport, not the card
      const id = this.idAtPoint(e.clientX, e.clientY);
      try { vp.setPointerCapture(e.pointerId); } catch { /* scripted or already-ended pointer */ }
      // the editor: Alt-drag from one card to another links the two people (the editor asks how)
      if (this.editor && e.altKey && id && !pointers.size) {
        linkFrom = id;
        this.dispatchEvent(new CustomEvent("linkdrag", { detail: { from: id, x: e.clientX, y: e.clientY, over: id } }));
        return;
      }
      // the editor may take the drag (moving a card or a note): it is told where the pointer goes instead of panning
      if (this.editor && !pointers.size && !e.shiftKey) {
        const [cx, cy] = this.chartPoint(e.clientX, e.clientY);
        const claim = new CustomEvent("editdown", { cancelable: true, detail: { id, x: cx, y: cy, clientX: e.clientX, clientY: e.clientY } });
        if (!this.dispatchEvent(claim)) { editing = { x: e.clientX, y: e.clientY, moved: false, id }; return; }
      }
      if (e.shiftKey && e.pointerType === "mouse" && !pointers.size) {
        regionFrom = local(e); Object.assign(region.style, { display: "block", width: "0", height: "0" }); return;
      }
      pointers.set(e.pointerId, local(e));
      if (pointers.size === 1) { downAt = local(e); downId = id; vp.classList.add("dragging"); }
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); downAt = null;
      }
    });
    vp.addEventListener("pointermove", e => {
      if (e.pointerType === "mouse" && !pointers.size && !regionFrom) {
        cancelAnimationFrame(tipFrame);
        tipFrame = requestAnimationFrame(() => this.showTip(e.clientX, e.clientY));
      }
      if (editing) {
        if (!editing.moved && Math.hypot(e.clientX - editing.x, e.clientY - editing.y) < 4) return;
        editing.moved = true;
        this.dispatchEvent(new CustomEvent("editmove", { detail: editAt(e) }));
        return;
      }
      if (linkFrom) {
        const over = this.idAtPoint(e.clientX, e.clientY);
        this.dispatchEvent(new CustomEvent("linkdrag", { detail: { from: linkFrom, x: e.clientX, y: e.clientY, over } }));
        return;
      }
      if (regionFrom) {
        const [l, t, r, b] = box(regionFrom, local(e));
        Object.assign(region.style, { left: `${l}px`, top: `${t}px`, width: `${r - l}px`, height: `${b - t}px` });
        return;
      }
      const prev = pointers.get(e.pointerId);
      if (!prev) return;
      const cur = local(e);
      pointers.set(e.pointerId, cur);
      if (pointers.size === 1) this.cam.panBy(cur.x - prev.x, cur.y - prev.y);
      else if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch0) this.cam.zoomAt(d / pinch0, (a.x + b.x) / 2, (a.y + b.y) / 2);
        pinch0 = d;
      }
    });
    const up = (e: PointerEvent) => {
      const cur = local(e);
      if (editing) {
        const d = editAt(e), moved = editing.moved, id = editing.id;
        editing = null;
        if (moved) this.dispatchEvent(new CustomEvent("editup", { detail: d }));
        else this.choose(id);                                  // a click, not a drag: select as usual
        return;
      }
      if (linkFrom) {
        const from = linkFrom, to = this.idAtPoint(e.clientX, e.clientY);
        linkFrom = null;
        this.dispatchEvent(new CustomEvent("link", { detail: { from, to: to !== from ? to : null } }));
        return;
      }
      if (regionFrom) {
        const [l, t, r, b] = box(regionFrom, cur), { s, tx, ty } = this.cam;
        regionFrom = null; region.style.display = "none";
        if (r - l > 8 && b - t > 8)
          void this.cam.flyTo(this.cam.viewFor([(l - tx) / s, (t - ty) / s, (r - tx) / s, (b - ty) / s], 0, MAX_ZOOM));
        return;
      }
      if (!pointers.has(e.pointerId)) return;
      if (downAt && pointers.size === 1 && Math.hypot(cur.x - downAt.x, cur.y - downAt.y) < 5) this.choose(downId);
      pointers.delete(e.pointerId);
      if (!pointers.size) { downAt = null; downId = null; vp.classList.remove("dragging"); }
    };
    vp.addEventListener("pointerup", up);
    vp.addEventListener("pointerleave", () => { cancelAnimationFrame(tipFrame); this.showTip(-1, -1); });
    vp.addEventListener("pointercancel", e => {
      if (linkFrom) { this.dispatchEvent(new CustomEvent("link", { detail: { from: linkFrom, to: null } })); linkFrom = null; }
      if (editing) { if (editing.moved) this.dispatchEvent(new CustomEvent("editcancel")); editing = null; }
      regionFrom = null; region.style.display = "none"; pointers.delete(e.pointerId);
      if (!pointers.size) { downAt = null; downId = null; vp.classList.remove("dragging"); }
    });
    vp.addEventListener("dblclick", e => {
      const id = this.idAtPoint(e.clientX, e.clientY);
      if (id && this.pickFrom) this.choose(id);
      else if (id) void this.flyToPerson(id);
      else { const p = local(e); this.cam.zoomAt(2, p.x, p.y); }
    });

    this.addEventListener("keydown", e => {
      const path = e.composedPath(), from = (path[0] as Element | undefined)?.localName ?? "";
      if (["input", "select", "textarea"].includes(from)) return;          // typing is not steering
      // the panel and the toolbar's pop-ups scroll and handle their own keys
      const own = [this.panel?.el, ...(this.toolbar?.pops ?? [])].filter(Boolean) as EventTarget[];
      if (path.some(n => own.includes(n)) && e.key !== "/") return;
      if (!e.ctrlKey && !e.metaKey && !e.altKey && this.toolbar?.tourKey(e.key)) { e.preventDefault(); return; }
      if (e.key === "/" || (e.key === "f" && (e.ctrlKey || e.metaKey))) { e.preventDefault(); this.toolbar?.focusSearch(); return; }
      if (e.key === "Escape" && this.pickFrom) { this.endPick(); return; }
      if (from === "button") return;                                        // buttons handle Enter, Space
      const step = e.shiftKey ? 400 : 120, w = this.vp.clientWidth / 2, h = this.vp.clientHeight / 2;
      const keys: Record<string, () => void> = {
        ArrowLeft: () => this.cam.panBy(step, 0), ArrowRight: () => this.cam.panBy(-step, 0),
        ArrowUp: () => this.cam.panBy(0, step), ArrowDown: () => this.cam.panBy(0, -step),
        "+": () => this.cam.zoomAt(1.25, w, h), "=": () => this.cam.zoomAt(1.25, w, h),
        "-": () => this.cam.zoomAt(0.8, w, h), _: () => this.cam.zoomAt(0.8, w, h),
        "0": () => void this.fit(), Home: () => void this.fit(),
        m: () => this.toggleMap(), M: () => this.toggleMap(), Escape: () => this.select(null),
        Enter: () => { if (this.selected) void this.flyToPerson(this.selected); },
      };
      const f = keys[e.key];
      if (f && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); f(); }
    });

    for (const b of Array.from(this.root.querySelectorAll<HTMLButtonElement>(".ctrls button"))) {
      b.addEventListener("click", () => {
        const w = this.vp.clientWidth / 2, h = this.vp.clientHeight / 2;
        ({ in: () => this.cam.zoomAt(1.5, w, h), out: () => this.cam.zoomAt(1 / 1.5, w, h), fit: () => void this.fit(),
           map: () => this.toggleMap() } as Record<string, () => void>)[b.dataset.act ?? ""]?.();
      });
    }
  }

  private showTip(x: number, y: number): void {
    const tip = this.tip!, off = x < 0 || this.stage.classList.contains("moving");
    const el = off ? null : this.root.elementFromPoint(x, y);
    const id = (el?.closest("[data-id]") as HTMLElement | null)?.dataset.id ?? null;
    const p = id ? this.layout?.people[id] : null;
    // over a card's title: what the title means (glossary on demand)
    const titleEl = el?.closest(".t, .n2") as HTMLElement | null;
    const gl = p && titleEl ? this.glossary?.lookup(titleEl.classList.contains("t") ? p.title : p.name) ?? [] : [];
    // not over a card: a line under the pointer, and the people it joins
    let owner: string | null = null, lineText = "";
    if (!p && !off && this.layout) {
      const vr = this.vp.getBoundingClientRect(), { s, tx, ty } = this.cam;
      const l = lineAt(this.layout, (x - vr.left - tx) / s, (y - vr.top - ty) / s, Math.max(4, 7 / s));
      if (l) {
        owner = l.owner;
        const { a, b } = lineEnds(this.layout, l), names = (ps: { name: string }[]) => ps.map(q => q.name).join(" & ");
        lineText = l.type === "marriage" && !b.length ? names(a) : `${names(a)} → ${names(b)}`;
      }
    }
    if (owner !== this.hoverOwner) { this.hoverOwner = owner; this.highlight?.hoverLine(owner); }
    if ((!p || (id === this.selected && !gl.length)) && !lineText) { tip.style.display = "none"; return; }
    tip.innerHTML = "";
    const b = document.createElement("b"); b.textContent = p ? p.name : lineText; tip.append(b);
    if (p?.sub) tip.append(document.createElement("br"), p.sub);
    for (const g of gl) {
      const sp = document.createElement("span"); sp.className = "cl-gl";
      sp.textContent = `${g.term}${g.full ? ` · ${g.full}` : ""}: ${g.meaning}`; tip.append(sp);
    }
    const r = this.getBoundingClientRect();
    tip.style.display = "block";
    const left = Math.min(x - r.left + 14, this.vp.clientWidth - tip.offsetWidth - 8);
    tip.style.left = `${Math.max(8, left)}px`; tip.style.top = `${y - r.top + 18}px`;
  }

  private idAtPoint(x: number, y: number): string | null {
    const el = this.root.elementFromPoint(x, y);
    return (el?.closest("[data-id]") as HTMLElement | null)?.dataset.id ?? null;
  }
}

export type { View };
export type { HashState } from "./url";

if (!customElements.get("crownline-viewer")) customElements.define("crownline-viewer", CrownlineViewer);

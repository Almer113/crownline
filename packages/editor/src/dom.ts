// A few lines instead of a framework (the editor is plain TypeScript, as the viewer is): make elements, and
// rebuild a panel's contents when the document changes.

type Attrs = Record<string, string | number | boolean | null | undefined | ((e: any) => void)>;
type Child = Node | string | number | null | undefined | false | Child[];

/** an element: h("button", {class: "x", onclick: f}, "Save") */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v as EventListener);
    else if (k === "value" && "value" in el) (el as HTMLInputElement).value = String(v);
    else if (k === "checked" && "checked" in el) (el as HTMLInputElement).checked = Boolean(v);
    else el.setAttribute(k, v === true ? "" : String(v));
  }
  add(el, children);
  return el;
}

function add(el: Node, children: Child[]): void {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    if (Array.isArray(c)) add(el, c);
    else el.appendChild(typeof c === "object" ? c : document.createTextNode(String(c)));
  }
}

/** replace an element's contents, keeping the focused field (and its caret) when it is rebuilt with the same key */
export function render(el: HTMLElement, ...children: Child[]): void {
  const active = document.activeElement as HTMLInputElement | null;
  const key = active && el.contains(active) ? active.dataset.key : undefined;
  const sel = key && "selectionStart" in active! ? [active!.selectionStart, active!.selectionEnd] : null;
  const scroll = el.scrollTop;
  el.replaceChildren();
  add(el, children);
  el.scrollTop = scroll;
  if (key) {
    const again = el.querySelector<HTMLInputElement>(`[data-key="${CSS.escape(key)}"]`);
    if (again) {
      again.focus({ preventScroll: true });
      if (sel && sel[0] !== null) try { again.setSelectionRange(sel[0], sel[1]); } catch { /* not a text field */ }
    }
  }
}

/** a name for a text value (a plain string or {lang: text}) */
export const textOf = (v: unknown, lang: string): string =>
  typeof v === "string" ? v : v && typeof v === "object" ? ((v as Record<string, string>)[lang] ?? Object.values(v)[0] ?? "") : "";

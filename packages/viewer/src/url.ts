// The address records the view and what is shown, so a link opens exactly what was shared:
//   #@<centre x>,<centre y>,<zoom %>&p=<person>&from=<person>&y=<year>&tour=<tour>.<step>
// e.g. #@4123,1925,150&p=hb1              (chart pixels; zoom in percent of chart pixels)
//      #@4123,1925,150&p=hb1&from=agung   the relationship from Sultan Agung to Hamengkubuwana I
//      #y=1755                            the time slider at 1755
//      #tour=split.3                      step 3 (counting from 1) of the tour "split"
export interface HashState {
  view: { cx: number; cy: number; s: number } | null;
  person: string | null;
  from?: string | null;
  year?: number | null;
  tour?: { id: string; step: number } | null;
}

const ID = /^[a-z][a-z0-9_]*$/;

export function readHash(hash = location.hash): HashState {
  const params = new URLSearchParams(hash.replace(/^#/, "").replace(/^@/, "v="));
  const v = params.get("v")?.split(",").map(Number);
  const view = v && v.length === 3 && v.every(Number.isFinite) && v[2] > 0
    ? { cx: v[0], cy: v[1], s: v[2] / 100 } : null;
  const id = (k: string) => { const x = params.get(k); return x && ID.test(x) ? x : null; };
  const y = Number(params.get("y"));
  const tm = /^([a-z][a-z0-9_-]*)\.(\d+)$/.exec(params.get("tour") ?? "");
  return { view, person: id("p"), from: id("from"), year: params.get("y") && Number.isInteger(y) ? y : null,
           tour: tm ? { id: tm[1], step: Math.max(0, Number(tm[2]) - 1) } : null };
}

/** what a history step is: who is selected, from whom, and the tour step (not the view or the year) */
export function placeKey(st: HashState): string {
  return [st.person ?? "", st.person ? st.from ?? "" : "", st.tour ? `${st.tour.id}.${st.tour.step}` : ""].join("|");
}

/** a place as the address writes it (without the #) */
export function hashOf(st: HashState): string {
  const parts: string[] = [];
  if (st.view) parts.push(`@${Math.round(st.view.cx)},${Math.round(st.view.cy)},${Math.round(st.view.s * 1000) / 10}`);
  if (st.person) parts.push(`p=${st.person}`);
  if (st.person && st.from) parts.push(`from=${st.from}`);
  if (st.year != null) parts.push(`y=${st.year}`);
  if (st.tour) parts.push(`tour=${st.tour.id}.${st.tour.step + 1}`);
  return parts.join("&");
}

/** write the address; `push` makes it a new browser-history step (Back returns to the one before) */
export function writeHash(st: HashState, push = false): void {
  const h = hashOf(st);
  const url = `${location.pathname}${location.search}${h ? "#" + h : ""}`;
  if (url === `${location.pathname}${location.search}${location.hash}`) return;
  if (push) history.pushState(null, "", url); else history.replaceState(null, "", url);
}

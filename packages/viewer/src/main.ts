// Demo page entry: registers <crownline-viewer> and exposes it for scripted checks.
import { CrownlineViewer } from "./viewer";

const viewer = document.querySelector("crownline-viewer") as CrownlineViewer | null;
(window as unknown as { crownline: unknown }).crownline = viewer;
// the chart's title (from its layout file) names the page and the header
let chartTitle = document.title;
viewer?.addEventListener("ready", e => {
  const { layout } = (e as CustomEvent).detail as { layout: { title?: string } };
  if (!layout.title) return;
  chartTitle = document.title = layout.title;
  const h1 = document.getElementById("chart-title");
  if (h1) h1.textContent = layout.title;
});
viewer?.addEventListener("select", e => {
  const { id, person } = (e as CustomEvent).detail as { id: string | null; person: { name: string } | null };
  document.title = id && person ? `${person.name} · ${chartTitle}` : chartTitle;
});

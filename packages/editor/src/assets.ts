// Pictures (PLAN 7d): a portrait imported and cropped as crop_portraits.py crops (a square, the face centred,
// HEADROOM of the square above the face's middle, 400 x 400 JPEG), with its credit; an emblem imported with its
// white background made transparent as clean_emblem.py does. The source, the crop (in the set's crops.json, so
// `python crop_portraits.py` makes the same file) and the record in the document are all written.
import { assetBase, plainPath } from "@crownline/engine";
import type { ChartDoc } from "@crownline/schema";
import { confirm } from "./dialog.ts";
import { h } from "./dom.ts";
import type { Editor } from "./editor.ts";

const SIZE = 400, HEADROOM = 0.42;
const EXTS = /\.(jpe?g|png|webp)$/i;

type Credit = NonNullable<NonNullable<ChartDoc["media"]>[string]["credit"]>;

/** a repository path as a document's media path (relative to meta.assetRoot) */
export function docPath(ed: Editor, repoPath: string): string {
  const base = assetBase(ed.doc, ed.chartPath).split("/").filter(Boolean), to = repoPath.split("/");
  let i = 0;
  while (i < base.length && base[i] === to[i]) i++;
  return [...base.slice(i).map(() => ".."), ...to.slice(i)].join("/");
}

/** where this chart keeps its portraits: the folder of the ones it has, else assets/portraits/<chart id> */
export function portraitFolder(ed: Editor): string {
  const base = assetBase(ed.doc, ed.chartPath);
  for (const m of Object.values(ed.doc.media ?? {}))
    if (m.kind === "portrait") return plainPath(`${base}/${m.file}`).split("/").slice(0, -1).join("/");
  return `assets/portraits/${ed.doc.meta.id}`;
}

const pickFile = (accept: string): Promise<File | null> => new Promise(resolve => {
  const input = h("input", { type: "file", accept });
  input.addEventListener("change", () => resolve(input.files?.[0] ?? null));
  input.addEventListener("cancel", () => resolve(null));
  input.click();
});

const loadImage = (f: Blob): Promise<HTMLImageElement> => new Promise((resolve, reject) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = () => reject(new Error("the file is not an image the browser can read"));
  img.src = URL.createObjectURL(f);
});

const blob = (c: HTMLCanvasElement, type: string, q?: number): Promise<Blob> =>
  new Promise((resolve, reject) => c.toBlob(b => (b ? resolve(b) : reject(new Error("could not encode the picture"))), type, q));

/** stretch each channel so 1% of pixels clip at each end (PIL's autocontrast, cutoff=1) */
function stretch(ctx: CanvasRenderingContext2D, w: number, hgt: number): void {
  const im = ctx.getImageData(0, 0, w, hgt), d = im.data, n = w * hgt;
  for (let ch = 0; ch < 3; ch++) {
    const hist = new Array(256).fill(0);
    for (let i = ch; i < d.length; i += 4) hist[d[i]]++;
    let lo = 0, hi = 255, acc = 0;
    while (lo < 255 && (acc += hist[lo]) <= n * 0.01) lo++;
    acc = 0;
    while (hi > 0 && (acc += hist[hi]) <= n * 0.01) hi--;
    if (hi <= lo) continue;
    const k = 255 / (hi - lo);
    for (let i = ch; i < d.length; i += 4) d[i] = Math.max(0, Math.min(255, (d[i] - lo) * k));
  }
  ctx.putImageData(im, 0, 0);
}

interface Crop { fx: number; fy: number; fs: number; contrast: boolean; credit: Credit }

/** crops.json with one person's crop set, keeping the rest of the file as written (one crop per line, the
 *  numbers as typed): only that line and the contrast line change */
export function cropsText(text: string | null, id: string, crop: number[], contrast: string[]): string {
  const line = `    ${JSON.stringify(id)}: [${crop.join(", ")}]`, cl = `  "contrast": ${JSON.stringify(contrast).replace(/,/g, ", ")}`;
  if (!text) return `{\n  "crops": {\n${line}\n  },\n${cl}\n}\n`;
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const start = lines.findIndex(l => l.includes('"crops"'));
  const end = lines.findIndex((l, i) => i > start && /^\s*},?\s*$/.test(l));
  if (start < 0 || end < 0) throw new Error("crops.json is not laid out as expected; add the crop by hand");
  const at = lines.findIndex((l, i) => i > start && i < end && l.trimStart().startsWith(`${JSON.stringify(id)}:`));
  if (at >= 0) lines[at] = line + (lines[at].trimEnd().endsWith(",") ? "," : "");
  else {
    const last = end - 1;
    if (last > start && !lines[last].trimEnd().endsWith(",")) lines[last] = lines[last].trimEnd() + ",";
    lines.splice(end, 0, line);
  }
  const ci = lines.findIndex(l => l.trimStart().startsWith('"contrast"'));
  if (ci >= 0) lines[ci] = cl + (lines[ci].trimEnd().endsWith(",") ? "," : "");
  else if (contrast.length) {
    const close = lines.findIndex((l, i) => i > start && /^\s*},?\s*$/.test(l));
    if (!lines[close].trimEnd().endsWith(",")) lines[close] = lines[close].trimEnd() + ",";
    lines.splice(close + 1, 0, cl);
  }
  return lines.join("\n");
}

/** the crop dialog: drag the square, size it with the slider or the wheel; the dot is where the face goes */
function cropDialog(img: HTMLImageElement, name: string, credit: Credit | undefined, start?: [number, number, number]): Promise<Crop | null> {
  return new Promise(resolve => {
    const W = img.naturalWidth, H = img.naturalHeight, view = Math.min(1, 520 / Math.max(W, H));
    const cv = h("canvas", { width: Math.round(W * view), height: Math.round(H * view), class: "crop" });
    const prev = h("canvas", { width: 160, height: 160, class: "crop-prev" });
    let [fx, fy, fs] = start ?? [0.5, 0.35, 0.6];
    const side = () => Math.min(fs * W, W, H);
    const box = () => {                                    // the square in image pixels, as crop_portraits.py clamps it
      const s = side();
      return [Math.min(Math.max(fx * W - s / 2, 0), W - s), Math.min(Math.max(fy * H - HEADROOM * s, 0), H - s), s];
    };
    const contrast = h("input", { type: "checkbox" });
    const size = h("input", { type: "range", min: 0.05, max: 1.5, step: 0.005, value: fs, "aria-label": "Square size" });
    const draw = () => {
      const c = cv.getContext("2d")!, [x0, y0, s] = box();
      c.drawImage(img, 0, 0, cv.width, cv.height);
      c.fillStyle = "rgb(0 0 0 / .45)";
      c.beginPath(); c.rect(0, 0, cv.width, cv.height); c.rect(x0 * view, y0 * view, s * view, s * view); c.fill("evenodd");
      c.strokeStyle = "#fff"; c.lineWidth = 2; c.strokeRect(x0 * view, y0 * view, s * view, s * view);
      c.fillStyle = "#E0B341"; c.beginPath(); c.arc((x0 + s / 2) * view, (y0 + HEADROOM * s) * view, 5, 0, 7); c.fill();
      const p = prev.getContext("2d")!;
      p.drawImage(img, x0, y0, s, s, 0, 0, prev.width, prev.height);
      if (contrast.checked) stretch(p, prev.width, prev.height);
    };
    let drag: [number, number, number, number] | null = null;
    cv.addEventListener("pointerdown", e => { cv.setPointerCapture(e.pointerId); drag = [e.offsetX, e.offsetY, fx, fy]; });
    cv.addEventListener("pointermove", e => {
      if (!drag) return;
      fx = Math.min(1, Math.max(0, drag[2] + (e.offsetX - drag[0]) / view / W));
      fy = Math.min(1, Math.max(0, drag[3] + (e.offsetY - drag[1]) / view / H));
      draw();
    });
    cv.addEventListener("pointerup", () => { drag = null; });
    cv.addEventListener("wheel", e => { e.preventDefault(); fs = Math.min(1.5, Math.max(0.05, fs * Math.exp(e.deltaY * 0.001))); size.value = String(fs); draw(); }, { passive: false });
    size.addEventListener("input", () => { fs = Number(size.value); draw(); });
    contrast.addEventListener("change", draw);
    const f = (label: string, key: keyof Credit, ph = "") => {
      const i = h("input", { type: "text", value: credit?.[key] ?? "", placeholder: ph, "data-credit": key });
      return h("label", {}, label, i);
    };
    const dlg = h("dialog", { class: "ask wide" });
    const done = (v: Crop | null) => { dlg.close(); dlg.remove(); resolve(v); };
    const form = h("form", { method: "dialog", onsubmit: (e: Event) => {
      e.preventDefault();
      const c: Record<string, string> = {};
      for (const i of form.querySelectorAll<HTMLInputElement>("[data-credit]")) if (i.value.trim()) c[i.dataset.credit!] = i.value.trim();
      if (!c.title) { (form.querySelector("[data-credit=title]") as HTMLInputElement).focus(); return; }
      const r3 = (v: number) => Math.round(v * 1000) / 1000;
      done({ fx: r3(fx), fy: r3(fy), fs: r3(fs), contrast: contrast.checked, credit: c as unknown as Credit });
    } },
      h("div", { class: "crop-row" }, cv, h("div", {}, prev, h("small", {}, "The dot is the middle of the face."),
        h("label", {}, "Size", size), h("label", { class: "check" }, contrast, "Stretch the tones (a faded photograph)"))),
      h("div", { class: "credit" },
        f("Title", "title", "what the picture shows (required)"), f("Source page", "source", "https://…"),
        f("File URL", "fileUrl"), f("Author", "author"), f("Licence", "licence", "Public domain, CC BY-SA 4.0…"),
        f("Changes", "changes", "cropped to a square"), f("Note", "note")),
      h("div", { class: "row end" }, h("button", { type: "button", onclick: () => done(null) }, "Cancel"),
        h("button", { class: "primary", type: "submit" }, "Use this portrait")));
    dlg.append(h("h3", {}, `Portrait of ${name}`), form);
    dlg.addEventListener("cancel", e => { e.preventDefault(); done(null); });
    document.body.append(dlg);
    dlg.showModal();
    draw();
  });
}

/** import a portrait for a person: choose the file, crop it, credit it; writes the files and the records */
export async function importPortrait(ed: Editor, id: string, chosen?: File): Promise<void> {
  const file = chosen ?? await pickFile("image/jpeg,image/png,image/webp");
  if (!file) return;
  if (!EXTS.test(file.name)) throw new Error("a portrait must be a JPEG, PNG or WebP file");
  const img = await loadImage(file);
  const doc = ed.doc, p = doc.people[id], mid = p.portrait ?? `p_${id}`, had = doc.media?.[mid];
  const folder = portraitFolder(ed), set = folder.replace(/^assets\/portraits\/?/, "");
  const srcDir = `assets/portraits_src${set ? "/" + set : ""}`, cropsPath = `${srcDir}/crops.json`;
  let spec: { crops: Record<string, number[]>; contrast?: string[] } = { crops: {} }, specText: string | null = null;
  try { specText = await (await ed.store.read(cropsPath)).text(); spec = JSON.parse(specText); } catch { /* none yet */ }
  const name = typeof p.name === "string" ? p.name : Object.values(p.name)[0];
  const c = await cropDialog(img, name, had?.credit ?? { title: name, changes: "cropped to a square" } as Credit,
    spec.crops[id] as [number, number, number] | undefined);
  if (!c) return;
  // the crop, as crop_portraits.py makes it
  const W = img.naturalWidth, H = img.naturalHeight, s = Math.min(c.fs * W, W, H);
  const x0 = Math.min(Math.max(c.fx * W - s / 2, 0), W - s), y0 = Math.min(Math.max(c.fy * H - HEADROOM * s, 0), H - s);
  const out = h("canvas", { width: SIZE, height: SIZE });
  const ctx = out.getContext("2d")!;
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, SIZE, SIZE);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, Math.round(x0), Math.round(y0), Math.round(s), Math.round(s), 0, 0, SIZE, SIZE);
  if (c.contrast) stretch(ctx, SIZE, SIZE);
  const ext = file.name.match(EXTS)![1].toLowerCase().replace("jpeg", "jpg");
  const cropPath = `${folder}/${id}.jpg`, srcPath = `${srcDir}/${id}.${ext}`;
  // the files are written now, not on Save, and Undo does not bring old ones back: say so before replacing any
  const there = [cropPath, srcPath].filter(f => ed.files.has(f));
  if (there.length) {
    const own = !!had && em(ed, mid) === cropPath;
    const ok = await confirm("Replace the picture?", [
      own ? `${name} already has a portrait. Its files are replaced now:` : `These files are already in the project (another chart may use them):`,
      there.join(", "),
      "Undo takes the new portrait off the chart but does not bring the old picture back.",
    ], "Replace");
    if (!ok) return;
  }
  await ed.putAsset(srcPath, file);
  await ed.putAsset(cropPath, await blob(out, "image/jpeg", 0.9));
  const contrast = new Set(spec.contrast ?? []);
  if (c.contrast) contrast.add(id); else contrast.delete(id);
  await ed.putAsset(cropsPath, cropsText(specText, id, [c.fx, c.fy, c.fs], [...contrast]));
  const rec = { kind: "portrait", file: docPath(ed, cropPath), of: id, credit: c.credit, ...(had?.private ? { private: had.private } : {}) };
  ed.run({ label: `Portrait of ${name}`, patch: [
    { op: "set", path: ["media", mid], value: rec },
    { op: "set", path: ["people", id, "portrait"], value: mid },
  ] });
}

/** an emblem's white background made transparent (clean_emblem.py: near-white is background, and along its
 *  edge the colours are un-mixed from white, so no pale fringe stays) */
export async function cleanEmblem(img: HTMLImageElement): Promise<HTMLCanvasElement> {
  const UP = 2, WHITE = 236, EDGE = 2 * UP;
  const w = img.naturalWidth * UP, hh = img.naturalHeight * UP;
  const cv = h("canvas", { width: w, height: hh }), ctx = cv.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, w, hh);
  const im = ctx.getImageData(0, 0, w, hh), d = im.data, n = w * hh;
  const bg = new Uint8Array(n);
  for (let i = 0; i < n; i++) bg[i] = Math.min(d[4 * i], d[4 * i + 1], d[4 * i + 2]) > WHITE && d[4 * i + 3] > 0 ? 1 : 0;
  // near the background: a square neighbourhood, by rows then columns
  const rows = new Uint8Array(n), edge = new Uint8Array(n);
  for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) {
    let v = 0;
    for (let k = Math.max(0, x - EDGE); k <= Math.min(w - 1, x + EDGE) && !v; k++) v = bg[y * w + k];
    rows[y * w + x] = v;
  }
  for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) {
    let v = 0;
    for (let k = Math.max(0, y - EDGE); k <= Math.min(hh - 1, y + EDGE) && !v; k++) v = rows[k * w + x];
    edge[y * w + x] = v;
  }
  for (let i = 0; i < n; i++) {
    const r = d[4 * i], g = d[4 * i + 1], b = d[4 * i + 2];
    if (bg[i]) { d[4 * i + 3] = 0; continue; }
    if (!edge[i]) continue;
    const a = Math.min(1, Math.max(1e-3, Math.max(255 - r, 255 - g, 255 - b) / 255));
    d[4 * i] = Math.max(0, Math.min(255, 255 - (255 - r) / a));
    d[4 * i + 1] = Math.max(0, Math.min(255, 255 - (255 - g) / a));
    d[4 * i + 2] = Math.max(0, Math.min(255, 255 - (255 - b) / a));
    d[4 * i + 3] = Math.round(a * 255);
  }
  ctx.putImageData(im, 0, 0);
  return cv;
}

/** the repository path of a media record's file */
const em = (ed: Editor, id: string | undefined): string | null => {
  const m = id ? ed.doc.media?.[id] : undefined;
  return m ? plainPath(`${assetBase(ed.doc, ed.chartPath)}/${m.file}`) : null;
};

/** import an emblem for a house header (the person whose header it is) */
export async function importEmblem(ed: Editor, headerOf: string, chosen?: File): Promise<void> {
  const file = chosen ?? await pickFile("image/png,image/jpeg,image/webp");
  if (!file) return;
  const img = await loadImage(file);
  const header = ed.doc.display?.headers?.[headerOf] as { name?: string; emblem?: string } | undefined;
  const slug = (header?.name ?? headerOf).toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || headerOf;
  const clean = await cleanEmblem(img);
  const keep = await new Promise<{ clean: boolean; credit: Credit } | null>(resolve => {
    const dlg = h("dialog", { class: "ask" });
    const done = (v: { clean: boolean; credit: Credit } | null) => { dlg.close(); dlg.remove(); resolve(v); };
    const a = h("canvas", { width: 140, height: 140, class: "checker" }), b = h("canvas", { width: 140, height: 140, class: "checker" });
    const fit = (c: HTMLCanvasElement, src: CanvasImageSource, w: number, hh: number) => {
      const k = Math.min(140 / w, 140 / hh); c.getContext("2d")!.drawImage(src, (140 - w * k) / 2, (140 - hh * k) / 2, w * k, hh * k);
    };
    fit(a, img, img.naturalWidth, img.naturalHeight); fit(b, clean, clean.width, clean.height);
    const useClean = h("input", { type: "checkbox", checked: true });
    const title = h("input", { type: "text", value: `Emblem of ${header?.name ?? headerOf}` }), source = h("input", { type: "text", placeholder: "https://…" });
    const author = h("input", { type: "text" }), licence = h("input", { type: "text", placeholder: "Public domain, CC BY-SA 4.0…" });
    dlg.append(h("h3", {}, "Emblem"),
      h("div", { class: "row" }, h("figure", {}, a, h("figcaption", {}, "As imported")), h("figure", {}, b, h("figcaption", {}, "White made transparent"))),
      h("label", { class: "check" }, useClean, "Make the white background transparent"),
      h("label", {}, "Title", title), h("label", {}, "Source page", source), h("label", {}, "Author", author), h("label", {}, "Licence", licence),
      h("div", { class: "row end" }, h("button", { type: "button", onclick: () => done(null) }, "Cancel"),
        h("button", { class: "primary", type: "button", onclick: () => {
          const c: Record<string, string> = { title: title.value.trim() || `Emblem of ${headerOf}` };
          if (source.value.trim()) c.source = source.value.trim();
          if (author.value.trim()) c.author = author.value.trim();
          if (licence.value.trim()) c.licence = licence.value.trim();
          if (useClean.checked) c.changes = "white background made transparent";
          done({ clean: useClean.checked, credit: c as unknown as Credit });
        } }, "Use this emblem")));
    dlg.addEventListener("cancel", e => { e.preventDefault(); done(null); });
    document.body.append(dlg); dlg.showModal();
  });
  if (!keep) return;
  // the header's own emblem file is replaced; another file of that name (another house's) is not
  const own = em(ed, header?.emblem);
  let path = `assets/emblems/${slug}.png`;
  for (let i = 2; ed.files.has(path) && path !== own; i++) path = `assets/emblems/${slug}-${i}.png`;
  let out: Blob;
  if (keep.clean) out = await blob(clean, "image/png");
  else { const c = h("canvas", { width: img.naturalWidth, height: img.naturalHeight }); c.getContext("2d")!.drawImage(img, 0, 0); out = await blob(c, "image/png"); }
  await ed.putAsset(path, out);
  // the header's own record, or a new one (another header of the same name keeps its emblem)
  let mid = header?.emblem;
  if (!mid) { const base = `e_${slug.replace(/-/g, "_")}`; mid = base; for (let i = 2; ed.doc.media?.[mid]; i++) mid = `${base}_${i}`; }
  ed.run({ label: "Emblem of a house", patch: [
    { op: "set", path: ["media", mid], value: { kind: "emblem", file: docPath(ed, path), credit: keep.credit } },
    { op: "set", path: ["display", "headers", headerOf, "emblem"], value: mid },
  ] });
}

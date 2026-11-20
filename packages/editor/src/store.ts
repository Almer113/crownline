import type { CrownlineViewer } from "@crownline/viewer";
import type { Layout } from "@crownline/viewer/layout";

// Where the editor reads and writes a project's files (PLAN 7f). Paths are '/'-separated and relative to the
// project folder (the one holding charts/ and assets/), as the engine names them.
//
//   ServerStore   the local server (npm run dev: the app) and this repository: it can also export
//   FolderStore   a folder opened from the browser (Chrome, Edge: the File System Access API): read and write in place
//   UploadStore   a folder uploaded into the page (any browser): read only; Save downloads the files instead
//   SiteStore     the demo site (PLAN 9e): the published charts, read from the site; changes kept in this browser,
//                 and Save downloads the chart's folder as a .zip

export interface ChartEntry { path: string; id: string; title: string }

export interface Store {
  readonly kind: "server" | "folder" | "upload" | "site";
  /** what to call it: the folder's name */
  readonly name: string;
  /** what Save does, in words, for the status line */
  readonly saves: string;
  /** the charts in the project: every charts/<id>/chart.json (and a chart.json at the top) */
  charts(): Promise<ChartEntry[]>;
  /** every file the engine may ask about: those under assets/ and charts/ */
  list(): Promise<string[]>;
  read(path: string): Promise<Blob>;
  /** `expect`: the file's text as the editor last saw it (null: there was none). Where the store can check it
   *  (the local server), a file changed since is not written over: ChangedOnDisk is thrown instead */
  write(path: string, body: Blob | string, expect?: string | null): Promise<void>;
  /** delete a file, if it is there (a chart's lock, undone after it was saved); `expect` as for write */
  remove(path: string, expect?: string | null): Promise<void>;
  /** a file as a URL an <img> can load ("" if there is none) */
  url(path: string): Promise<string>;
  /** what the viewer needs to load the chart page's files: the base its relative paths start from, and (for a
   *  folder in the browser) a URL for each file it names */
  page(html: string): Promise<{ base: URL; files?: (path: string) => string | undefined }>;
  /** after the editor saved a chart (its files written): what else Save does (the demo site downloads it) */
  saved?(chartPath: string): Promise<void>;
}

const REF = /(src="|url\(['"]?)((?:assets|charts)\/[^"')]+)/g;
const title = (doc: { meta?: { title?: unknown; defaultLang?: string } }, d: string): string => {
  const t = doc.meta?.title;
  return typeof t === "string" ? t : (t as Record<string, string> | undefined)?.[doc.meta?.defaultLang ?? ""] ?? Object.values(t ?? {})[0] as string ?? d;
};
/** a save refused because the file changed on disk since the editor read it (a model's batch, a person) */
export class ChangedOnDisk extends Error {}

/** the header that says what the file should still be: the sha256 of its text, or "absent". None where the page
 *  cannot hash (crypto.subtle needs a secure page: localhost, or https) */
async function expectHeader(expect: string | null | undefined): Promise<Record<string, string>> {
  if (expect === undefined) return {};
  if (expect === null) return { "X-Crownline-Expect": "absent" };
  if (!globalThis.crypto?.subtle) return {};
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(expect));
  return { "X-Crownline-Expect": [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, "0")).join("") };
}

const fail = async (r: Response) => { throw new Error(((await r.json().catch(() => ({}))) as { error?: string }).error ?? `HTTP ${r.status}`); };

export class ServerStore implements Store {
  readonly kind = "server";
  readonly name = "this repository";
  readonly saves = "Saved to the repository";
  async charts(): Promise<ChartEntry[]> { return (await (await fetch("/api/charts")).json()) as ChartEntry[]; }
  async list(): Promise<string[]> { return (await (await fetch("/api/files")).json()) as string[]; }
  async read(path: string): Promise<Blob> {
    const r = await fetch(`/repo/${path}`);
    if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
    return r.blob();
  }
  async write(path: string, body: Blob | string, expect?: string | null): Promise<void> {
    const doc = /^charts\/[^/]+\/(chart|layout\.lock)\.json$/.test(path);
    const r = await fetch(`/api/${doc ? "save" : "asset"}?path=${encodeURIComponent(path)}`, {
      method: "PUT", body, headers: { "X-Crownline": "save", ...(doc ? { "Content-Type": "application/json", ...await expectHeader(expect) } : {}) } });
    if (r.status === 409) throw new ChangedOnDisk(`${path} changed on disk`);
    if (!r.ok) await fail(r);
  }
  async remove(path: string, expect?: string | null): Promise<void> {
    const r = await fetch(`/api/save?path=${encodeURIComponent(path)}`, { method: "DELETE", headers: { "X-Crownline": "save", ...await expectHeader(expect) } });
    if (r.status === 409) throw new ChangedOnDisk(`${path} changed on disk`);
    if (!r.ok) await fail(r);
  }
  async url(path: string): Promise<string> { return `/repo/${path}`; }
  async page(_html: string) { return { base: new URL("/repo/", location.href) }; }
}

/** files kept in memory or on disk: what the two browser stores share (blob URLs for the page) */
abstract class LocalStore implements Store {
  abstract readonly kind: "folder" | "upload" | "site";
  abstract readonly name: string;
  abstract readonly saves: string;
  private urls = new Map<string, string>();
  abstract list(): Promise<string[]>;
  abstract read(path: string): Promise<Blob>;
  abstract write(path: string, body: Blob | string): Promise<void>;
  abstract remove(path: string): Promise<void>;

  async charts(): Promise<ChartEntry[]> {
    const out: ChartEntry[] = [];
    for (const path of (await this.list()).filter(p => /^(charts\/[^/]+\/)?chart\.json$/.test(p)).sort()) {
      const d = path.split("/").at(-2) ?? this.name;
      try { const doc = JSON.parse(await (await this.read(path)).text()); out.push({ path, id: doc.meta?.id ?? d, title: title(doc, d) }); }
      catch { out.push({ path, id: d, title: `${d} (cannot be read)` }); }
    }
    return out;
  }
  async url(path: string): Promise<string> {
    let u = this.urls.get(path);
    if (u === undefined) {
      try { u = URL.createObjectURL(await this.read(path)); } catch { u = ""; }
      this.urls.set(path, u);
    }
    return u;
  }
  protected changed(path: string): void {
    const u = this.urls.get(path);
    if (u) URL.revokeObjectURL(u);
    this.urls.delete(path);
  }
  async page(html: string) {
    const refs = new Set<string>();
    for (const m of html.matchAll(REF)) refs.add(decodeURI(m[2]));
    const urls = new Map(await Promise.all([...refs].map(async p => [p, await this.url(p)] as const)));
    return { base: new URL(location.href), files: (p: string) => urls.get(decodeURI(p)) || undefined };
  }
}

/** a project without the fonts: the app's own (the local server's repository, or the demo site's files, both at
 *  repo/ beside the page) */
async function ownFont(path: string): Promise<Blob | null> {
  if (!path.startsWith("assets/fonts/")) return null;
  const r = await fetch(new URL(`repo/${path}`, document.baseURI)).catch(() => null);
  return r?.ok ? r.blob() : null;
}

// the File System Access API, as far as the editor uses it (not yet in TypeScript's DOM library)
interface DirHandle { kind: "directory"; name: string; values(): AsyncIterable<DirHandle | FileHandle>;
  getDirectoryHandle(n: string, o?: { create?: boolean }): Promise<DirHandle>; removeEntry(n: string): Promise<void>; getFileHandle(n: string, o?: { create?: boolean }): Promise<FileHandle>;
  queryPermission?(o: { mode: string }): Promise<string>; requestPermission?(o: { mode: string }): Promise<string> }
interface FileHandle { kind: "file"; name: string; getFile(): Promise<File>;
  createWritable(): Promise<{ write(d: Blob | string): Promise<void>; close(): Promise<void> }> }

export const canOpenFolders = (): boolean => typeof (window as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker === "function";

export class FolderStore extends LocalStore {
  readonly kind = "folder";
  readonly saves: string;
  private constructor(private readonly root: DirHandle) { super(); this.saves = `Saved to the folder ${root.name}`; }
  get name(): string { return this.root.name; }

  /** ask for a folder (read and write); null when the reader cancels */
  static async pick(): Promise<FolderStore | null> {
    try {
      const root = await (window as unknown as { showDirectoryPicker(o: object): Promise<DirHandle> }).showDirectoryPicker({ mode: "readwrite", id: "crownline" });
      return new FolderStore(root);
    } catch (e) { if ((e as Error).name === "AbortError") return null; throw e; }
  }

  async list(): Promise<string[]> {
    const out: string[] = [];
    const walk = async (d: DirHandle, at: string) => {
      for await (const e of d.values()) {
        const p = at + e.name;
        if (e.kind === "file") out.push(p);
        else if (!e.name.startsWith(".") && e.name !== "node_modules") await walk(e, p + "/");
      }
    };
    for await (const e of this.root.values()) {
      if (e.kind === "directory" && (e.name === "assets" || e.name === "charts")) await walk(e, e.name + "/");
      else if (e.kind === "file" && e.name === "chart.json") out.push(e.name);
    }
    return out;
  }
  private async dir(parts: string[], create: boolean): Promise<DirHandle> {
    let d = this.root;
    for (const p of parts) d = await d.getDirectoryHandle(p, { create });
    return d;
  }
  async read(path: string): Promise<Blob> {
    const parts = path.split("/"), name = parts.pop()!;
    try { return await (await (await this.dir(parts, false)).getFileHandle(name)).getFile(); }
    catch {
      // a project without the fonts: the editor's own (when it runs from the local server)
      const font = await ownFont(path);
      if (font) return font;
      throw new Error(`${path} is not in the folder ${this.name}`);
    }
  }
  async write(path: string, body: Blob | string): Promise<void> {
    if (this.root.queryPermission && (await this.root.queryPermission({ mode: "readwrite" })) !== "granted"
        && (await this.root.requestPermission?.({ mode: "readwrite" })) !== "granted")
      throw new Error(`not allowed to write to ${this.name}`);
    const parts = path.split("/"), name = parts.pop()!;
    const w = await (await (await this.dir(parts, true)).getFileHandle(name, { create: true })).createWritable();
    await w.write(body); await w.close();
    this.changed(path);
  }
  async remove(path: string): Promise<void> {
    const parts = path.split("/"), name = parts.pop()!;
    let d: DirHandle;
    try { d = await this.dir(parts, false); } catch { return; }          // no such folder: nothing to remove
    await d.removeEntry(name).catch((e: Error) => { if (e.name !== "NotFoundError") throw e; });
    this.changed(path);
  }
}

/** a folder given to an <input webkitdirectory>: read once; a write is kept in the page and downloaded */
export class UploadStore extends LocalStore {
  readonly kind = "upload";
  get saves(): string {
    const gone = [...this.removed];
    return "Downloaded (an uploaded folder cannot be written to)" + (gone.length ? `: delete ${gone.join(", ")} from the folder` : "");
  }
  private files = new Map<string, Blob>();
  private constructor(readonly name: string, files: File[]) {
    super();
    for (const f of files) {
      const rel = (f.webkitRelativePath || f.name).split("/").slice(1).join("/");    // without the folder's own name
      if (/^(assets|charts)\//.test(rel) || rel === "chart.json") this.files.set(rel, f);
    }
  }
  /** ask for a folder to upload; null when the reader cancels */
  static pick(): Promise<UploadStore | null> {
    return new Promise(resolve => {
      const i = Object.assign(document.createElement("input"), { type: "file", multiple: true });
      i.setAttribute("webkitdirectory", "");
      i.addEventListener("change", () => {
        const fs = [...(i.files ?? [])];
        resolve(fs.length ? new UploadStore(fs[0].webkitRelativePath.split("/")[0] || "upload", fs) : null);
      });
      i.addEventListener("cancel", () => resolve(null));
      i.click();
    });
  }
  async list(): Promise<string[]> { return [...this.files.keys()]; }
  async read(path: string): Promise<Blob> {
    const f = this.files.get(path);
    if (f) return f;
    const font = await ownFont(path);
    if (font) return font;
    throw new Error(`${path} was not in the uploaded folder`);
  }
  async write(path: string, body: Blob | string): Promise<void> {
    const b = typeof body === "string" ? new Blob([body], { type: "application/json" }) : body;
    this.files.set(path, b);
    this.changed(path);
    download(b, path.replaceAll("/", "_").replace(/^charts_[^_]+_/, ""));
  }
  /** a file cannot be taken out of the reader's folder from here: the status line says to delete it */
  async remove(path: string): Promise<void> {
    if (this.files.delete(path)) { this.changed(path); this.removed.add(path); }
  }
  /** files to delete by hand from the folder the reader uploaded */
  readonly removed = new Set<string>();
}

/** the files the demo site's charts were published with, as changed in this browser and kept in IndexedDB: a
 *  file's new content, or null for one removed. Without IndexedDB (a private window in some browsers) they last
 *  only while the page is open */
class Kept {
  private readonly db: Promise<IDBDatabase | null>;
  constructor(name: string) {
    this.db = new Promise(resolve => {
      try {
        const r = indexedDB.open(name, 1);
        r.onupgradeneeded = () => r.result.createObjectStore("files");
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => resolve(null);
      } catch { resolve(null); }
    });
  }
  private async tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | undefined> {
    const db = await this.db;
    if (!db) return undefined;
    return new Promise((resolve, reject) => {
      const t = db.transaction("files", mode), req = fn(t.objectStore("files"));
      t.oncomplete = () => resolve(req.result);
      t.onerror = t.onabort = () => reject(t.error ?? new Error("IndexedDB refused the change"));
    });
  }
  async all(): Promise<Map<string, Blob | null>> {
    const out = new Map<string, Blob | null>();
    const keys = (await this.tx("readonly", s => s.getAllKeys())) ?? [];
    const vals = (await this.tx("readonly", s => s.getAll())) ?? [];
    keys.forEach((k, i) => {
      const v = vals[i] as { data: ArrayBuffer | null; type: string };
      out.set(String(k), v.data ? new Blob([v.data], { type: v.type }) : null);
    });
    return out;
  }
  /** kept as bytes, not as a Blob, which WebKit's IndexedDB does not always take. False: not kept (this browser
   *  keeps nothing: the change lasts while the page is open) */
  async put(path: string, blob: Blob | null): Promise<boolean> {
    try {
      const data = blob ? await blob.arrayBuffer() : null;
      await this.tx("readwrite", s => s.put({ data, type: blob?.type ?? "" }, path));
      return true;
    } catch { return false; }
  }
  async clear(): Promise<void> { await this.tx("readwrite", s => s.clear()).catch(() => undefined); }
}

/** the demo site: the charts it was published with, under repo/ beside the page (repo/files.json lists them, as
 *  the local server's /api/files does). A change is kept in this browser; Save also downloads the chart's folder */
export class SiteStore extends LocalStore {
  readonly kind = "site";
  readonly name = "this site";
  private readonly base = new URL("repo/", document.baseURI);
  private readonly kept = new Kept("crownline-site");
  private changes: Promise<Map<string, Blob | null>> = this.kept.all().catch(() => new Map());
  private published: Promise<string[]> | null = null;
  private lastZip = "";
  get saves(): string { return `Kept in this browser, and downloaded as ${this.lastZip || "a .zip"}`; }

  /** the files changed in this browser (a chart's, a picture imported), sorted */
  async edited(): Promise<string[]> { return [...(await this.changes).keys()].sort(); }
  /** back to the charts as published: every change made in this browser forgotten */
  async forget(): Promise<void> {
    for (const p of await this.edited()) this.changed(p);
    await this.kept.clear();
    this.changes = Promise.resolve(new Map());
  }

  private files(): Promise<string[]> {
    return this.published ??= fetch(new URL("files.json", this.base)).then(r => {
      if (!r.ok) throw new Error(`the site's list of files: HTTP ${r.status}`);
      return r.json() as Promise<string[]>;
    });
  }
  async list(): Promise<string[]> {
    const ch = await this.changes, all = new Set(await this.files());
    for (const [p, b] of ch) if (b) all.add(p); else all.delete(p);
    return [...all];
  }
  async read(path: string): Promise<Blob> {
    const ch = await this.changes;
    if (ch.has(path)) {
      const b = ch.get(path);
      if (b) return b;
      throw new Error(`${path} was removed in this browser`);
    }
    const r = await fetch(new URL(path, this.base));
    if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
    return r.blob();
  }
  /** a published file: its address on the site; one changed here: a blob URL */
  override async url(path: string): Promise<string> {
    return (await this.changes).get(path) ? super.url(path) : new URL(path, this.base).href;
  }
  async write(path: string, body: Blob | string): Promise<void> {
    const b = typeof body === "string" ? new Blob([body], { type: "application/json" }) : body;
    (await this.changes).set(path, b);
    this.changed(path);
    await this.kept.put(path, b);
  }
  async remove(path: string): Promise<void> {
    (await this.changes).set(path, null);
    this.changed(path);
    await this.kept.put(path, null);
  }
  /** Save: the chart's folder as <id>.zip, laid out as a project (charts/<id>/…, and the pictures imported in this
   *  browser under assets/), so it unzips into a project folder as it is */
  async saved(chartPath: string): Promise<void> {
    const dir = chartPath.includes("/") ? chartPath.replace(/[^/]*$/, "") : "";
    const id = dir.split("/").at(-2) || "chart", ch = await this.changes;
    const names = (await this.list()).filter(p => (dir && p.startsWith(dir)) || p === chartPath || (p.startsWith("assets/") && !!ch.get(p))).sort();
    const { zip } = await import("./zip.ts");
    const files = await Promise.all(names.map(async name => ({ name, data: new Uint8Array(await (await this.read(name)).arrayBuffer()) })));
    this.lastZip = `${id}.zip`;
    download(zip(files), this.lastZip);
  }
}

/** show a chart page from a store: its files made loadable first. A newer call wins over an older one still
 *  resolving its files */
let showing = 0;
export async function showPage(viewer: CrownlineViewer, store: Store, html: string, layout: Layout): Promise<void> {
  const n = ++showing, pg = await store.page(html);
  if (n === showing) await viewer.show(html, layout, pg.base, pg.files);
}

/** hand the reader a file to save */
export function download(body: Blob | string, name: string): void {
  const b = typeof body === "string" ? new Blob([body]) : body;
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(b), download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}

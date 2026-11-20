// Interface language (PLAN Phase 3, item 9). The viewer's own words come from this table; the chart's content
// (names, notes, captions) is in the layout file and stays in its own language until the chart document
// (Phase 4) carries translations. Add a language by adding a column; a missing key falls back to English.
export type Lang = "en" | "id";
export const LANGS: Lang[] = ["en", "id"];

const STR: Record<string, Record<Lang, string>> = {
  search: { en: "Search people", id: "Cari tokoh" },
  searchHint: { en: "Name, title or house", id: "Nama, gelar, atau keraton" },
  noMatch: { en: "No one by that name on this chart", id: "Tidak ada tokoh dengan nama itu di bagan ini" },
  filters: { en: "Filters", id: "Filter" },
  houses: { en: "Houses", id: "Keraton" },
  show: { en: "Show", id: "Tampilkan" },
  rulersOnly: { en: "Rulers only", id: "Hanya penguasa" },
  disputed: { en: "Disputed claimants", id: "Penuntut takhta yang disengketakan" },
  outside: { en: "People outside the dynasty", id: "Tokoh di luar dinasti" },
  reset: { en: "Show everyone", id: "Tampilkan semua" },
  time: { en: "Year", id: "Tahun" },
  timeTitle: { en: "Show who was present in a year", id: "Tampilkan tokoh pada tahun tertentu" },
  timeClose: { en: "Close the time slider", id: "Tutup penggeser waktu" },
  timeNote: { en: "From reigns and the years on the cards; some are estimates",
              id: "Berdasarkan masa takhta dan tahun yang tertera di kartu; sebagian perkiraan" },
  tours: { en: "Tours", id: "Tur" },
  step: { en: "Step {n} of {m}", id: "Langkah {n} dari {m}" },
  back: { en: "Back", id: "Kembali" },
  next: { en: "Next", id: "Lanjut" },
  finish: { en: "Finish", id: "Selesai" },
  endTour: { en: "End the tour", id: "Akhiri tur" },
  language: { en: "Language", id: "Bahasa" },
  // the viewer's own controls
  zoomIn: { en: "Zoom in", id: "Perbesar" },
  zoomOut: { en: "Zoom out", id: "Perkecil" },
  wholeChart: { en: "Show the whole chart", id: "Tampilkan seluruh bagan" },
  overview: { en: "Show or hide the overview", id: "Tampilkan atau sembunyikan peta kecil" },
  loading: { en: "Loading the chart…", id: "Memuat bagan…" },
  loadFailed: { en: "Could not load the chart: {msg}", id: "Bagan tidak dapat dimuat: {msg}" },
  viewerLabel: { en: "Chart viewer. Drag or use the arrow keys to move, plus and minus to zoom, / to search.",
                 id: "Penampil bagan. Seret atau pakai tombol panah untuk bergeser, plus dan minus untuk memperbesar, / untuk mencari." },
  minimap: { en: "Overview of the whole chart", id: "Peta kecil seluruh bagan" },
  noteOnChart: { en: "Note {l} on the chart", id: "Catatan {l} di bagan" },
  // panel
  details: { en: "Person details", id: "Rincian tokoh" },
  closePanel: { en: "Close the panel", id: "Tutup panel" },
  notes: { en: "Notes", id: "Catatan" },
  aka: { en: "Also known as", id: "Dikenal juga sebagai" },
  life: { en: "Life", id: "Riwayat hidup" },
  born: { en: "Born", id: "Lahir" },
  died: { en: "Died", id: "Wafat" },
  orElse: { en: "or", id: "atau" },
  uncertain: { en: "uncertain", id: "tidak pasti" },
  sources: { en: "Sources", id: "Sumber" },
  family: { en: "Family on this chart", id: "Keluarga di bagan ini" },
  parents: { en: "Parents", id: "Orang tua" },
  spouses: { en: "Spouses", id: "Pasangan" },
  children: { en: "Children", id: "Anak" },
  adoptive: { en: "adoptive", id: "angkat" },
  noFamily: { en: "No relatives drawn on this chart.", id: "Tidak ada kerabat yang tercantum di bagan ini." },
  lineage: { en: "Highlight lineage", id: "Sorot garis keturunan" },
  copyLink: { en: "Copy link", id: "Salin tautan" },
  copied: { en: "Link copied", id: "Tautan disalin" },
  relTo: { en: "Relationship to…", id: "Hubungan dengan…" },
  ruler: { en: "Ruler {n} of {house}", id: "Penguasa ke-{n} {house}" },
  reigns: { en: "Reigns {n} of {house}", id: "Penguasa {n} {house}" },
  chronicles: { en: "Dates from court chronicles", id: "Tahun menurut babad keraton" },
  claimant: { en: "Claimant or disputed", id: "Penuntut takhta atau disengketakan" },
  // relationship finder
  relationship: { en: "Relationship", id: "Hubungan" },
  pickSecond: { en: "Choose a second person: click a card or search. Esc cancels.",
                id: "Pilih tokoh kedua: klik kartu atau cari. Esc untuk batal." },
  pickSecondTouch: { en: "Tap a second person, or search", id: "Ketuk tokoh kedua, atau cari" },
  cancel: { en: "Cancel", id: "Batal" },
  clear: { en: "Clear", id: "Hapus" },
  noPath: { en: "The chart draws no family link between them.", id: "Bagan ini tidak menunjukkan hubungan keluarga antara keduanya." },
  samePerson: { en: "That is the same person.", id: "Itu tokoh yang sama." },
  skips: { en: "The chart skips an unknown number of generations on this path, so the exact relationship is not known.",
           id: "Bagan melompati sejumlah generasi yang tidak diketahui di jalur ini, jadi hubungan pastinya tidak diketahui." },
};

/** a language tag ("id", "ID", "id-ID", "en-GB") to one of the offered languages, or null */
export function pickLang(tag: string | null | undefined, langs: Lang[] = LANGS): Lang | null {
  const l = (tag ?? "").slice(0, 2).toLowerCase() as Lang;
  return langs.includes(l) ? l : null;
}

/** the languages a chart offers (the layout's `interface`, in its order), or all of them */
export function offered(list: string[] | undefined): Lang[] {
  if (!list?.length) return LANGS;
  const ls = list.map(x => pickLang(x)).filter((l, i, a): l is Lang => l !== null && a.indexOf(l) === i);
  return ls.length ? ls : [LANGS[0]];               // none it has: English only, not every language
}

/** a chart text in the interface language: {tag: text}, falling back to English, then to any */
export function pickText(v: Record<string, string> | undefined, lang: Lang): string {
  if (!v) return "";
  const k = Object.keys(v).find(x => pickLang(x) === lang) ?? Object.keys(v).find(x => pickLang(x) === "en");
  return k ? v[k] : Object.values(v)[0] ?? "";
}

export function t(lang: Lang, key: string, vars: Record<string, string | number> = {}): string {
  const s = STR[key]?.[lang] ?? STR[key]?.en ?? key;
  return s.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ""));
}

// A small OpenType reader: only what text width needs (PLAN Phase 5, step 1). It reads the character map,
// the advance widths and the GPOS 'kern' pair adjustments, the same tables the Python engine's
// textmeasure.py reads with fontTools, so the two give the same widths to the last bit.
// Not read: glyph outlines, substitutions (ligatures), contextual kerning, lookup flags. See textmeasure.py.

export type PairSub =
  | { kind: "pair"; cover: Set<number>; pairs: Map<number, number> }      // key: first * 65536 + second
  | { kind: "class"; cover: Set<number>; c1: Map<number, number>; c2: Map<number, number>; recs: number[][] };

export interface Font {
  unitsPerEm: number;
  /** character (code point) -> glyph id */
  cmap: Map<number, number>;
  /** advance width of each glyph, in font units */
  advance: (glyph: number) => number;
  /** the 'kern' lookups, each a list of pair subtables; the first subtable that covers a pair wins, lookups add up */
  kern: PairSub[][];
}

class Reader {
  constructor(readonly v: DataView) {}
  u8(o: number) { return this.v.getUint8(o); }
  u16(o: number) { return this.v.getUint16(o); }
  i16(o: number) { return this.v.getInt16(o); }
  u32(o: number) { return this.v.getUint32(o); }
  tag(o: number) { return String.fromCharCode(this.u8(o), this.u8(o + 1), this.u8(o + 2), this.u8(o + 3)); }
}

export function parseFont(bytes: Uint8Array): Font {
  const r = new Reader(new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength));
  const sfnt = r.u32(0);
  if (sfnt !== 0x00010000 && sfnt !== 0x4f54544f && sfnt !== 0x74727565)
    throw new Error("not a TrueType or OpenType font (a WOFF or collection is not read)");
  const tables = new Map<string, number>();
  for (let i = 0, n = r.u16(4); i < n; i++) tables.set(r.tag(12 + i * 16), r.u32(12 + i * 16 + 8));
  const at = (t: string) => {
    const o = tables.get(t);
    if (o === undefined) throw new Error(`the font has no ${t} table`);
    return o;
  };
  const unitsPerEm = r.u16(at("head") + 18);
  const numH = r.u16(at("hhea") + 34), hmtx = at("hmtx");
  const advance = (g: number) => r.u16(hmtx + 4 * Math.min(g, numH - 1));
  return { unitsPerEm, cmap: readCmap(r, at("cmap")), advance, kern: tables.has("GPOS") ? readKern(r, at("GPOS")) : [] };
}

// fontTools' getBestCmap order: the first of these subtables the font has
const CMAP_ORDER: [number, number][] = [[3, 10], [0, 6], [0, 4], [3, 1], [0, 3], [0, 2], [0, 1], [0, 0]];

function readCmap(r: Reader, base: number): Map<number, number> {
  const subs = new Map<string, number>();
  for (let i = 0, n = r.u16(base + 2); i < n; i++) {
    const o = base + 4 + i * 8;
    subs.set(`${r.u16(o)},${r.u16(o + 2)}`, base + r.u32(o + 4));
  }
  for (const [p, e] of CMAP_ORDER) {
    const o = subs.get(`${p},${e}`);
    if (o !== undefined) return readCmapSub(r, o);
  }
  throw new Error("the font has no Unicode character map");
}

function readCmapSub(r: Reader, o: number): Map<number, number> {
  const m = new Map<number, number>(), format = r.u16(o);
  if (format === 4) {
    const segX2 = r.u16(o + 6), ends = o + 14, starts = ends + segX2 + 2, deltas = starts + segX2, ranges = deltas + segX2;
    for (let s = 0; s < segX2 / 2; s++) {
      const end = r.u16(ends + 2 * s), start = r.u16(starts + 2 * s), delta = r.i16(deltas + 2 * s);
      const ro = r.u16(ranges + 2 * s);
      for (let c = start; c <= end && c !== 0xffff; c++) {
        let g: number;
        if (ro === 0) g = (c + delta) & 0xffff;
        else {
          g = r.u16(ranges + 2 * s + ro + 2 * (c - start));
          if (g !== 0) g = (g + delta) & 0xffff;
        }
        if (g !== 0) m.set(c, g);
      }
    }
  } else if (format === 12) {
    for (let i = 0, n = r.u32(o + 12); i < n; i++) {
      const g0 = o + 16 + i * 12, start = r.u32(g0), end = r.u32(g0 + 4), glyph = r.u32(g0 + 8);
      for (let c = start; c <= end; c++) m.set(c, glyph + (c - start));
    }
  } else if (format === 6) {
    const first = r.u16(o + 6);
    for (let i = 0, n = r.u16(o + 8); i < n; i++) { const g = r.u16(o + 10 + 2 * i); if (g) m.set(first + i, g); }
  } else if (format === 0) {
    for (let c = 0; c < 256; c++) { const g = r.u8(o + 6 + c); if (g) m.set(c, g); }
  } else throw new Error(`character map format ${format} is not read`);
  return m;
}

function coverage(r: Reader, o: number): Set<number> {
  const s = new Set<number>();
  if (r.u16(o) === 1) for (let i = 0, n = r.u16(o + 2); i < n; i++) s.add(r.u16(o + 4 + 2 * i));
  else for (let i = 0, n = r.u16(o + 2); i < n; i++) {
    const q = o + 4 + 6 * i;
    for (let g = r.u16(q); g <= r.u16(q + 2); g++) s.add(g);
  }
  return s;
}

function classDef(r: Reader, o: number): Map<number, number> {
  const m = new Map<number, number>();
  if (r.u16(o) === 1) {
    const first = r.u16(o + 2);
    for (let i = 0, n = r.u16(o + 4); i < n; i++) m.set(first + i, r.u16(o + 6 + 2 * i));
  } else for (let i = 0, n = r.u16(o + 2); i < n; i++) {
    const q = o + 4 + 6 * i, cls = r.u16(q + 4);
    for (let g = r.u16(q); g <= r.u16(q + 2); g++) m.set(g, cls);
  }
  return m;
}

/** bytes of a value record, and where its XAdvance is (or -1) */
function valueLayout(fmt: number): [number, number] {
  let size = 0, xadv = -1;
  for (let bit = 0; bit < 8; bit++) if (fmt & (1 << bit)) { if (bit === 2) xadv = size; size += 2; }
  return [size, xadv];
}

function readKern(r: Reader, gpos: number): PairSub[][] {
  const featList = gpos + r.u16(gpos + 6), lookupList = gpos + r.u16(gpos + 8);
  const idx = new Set<number>();
  for (let i = 0, n = r.u16(featList); i < n; i++) {
    const rec = featList + 2 + i * 6;
    if (r.tag(rec) !== "kern") continue;
    const f = featList + r.u16(rec + 4);
    for (let j = 0, m = r.u16(f + 2); j < m; j++) idx.add(r.u16(f + 4 + 2 * j));
  }
  const out: PairSub[][] = [];
  for (const li of [...idx].sort((a, b) => a - b)) {
    const lk = lookupList + r.u16(lookupList + 2 + 2 * li), subs: PairSub[] = [];
    for (let s = 0, n = r.u16(lk + 4); s < n; s++) {
      let kind = r.u16(lk), st = lk + r.u16(lk + 6 + 2 * s);
      if (kind === 9) { kind = r.u16(st + 2); st = st + r.u32(st + 4); }      // extension: unwrap
      if (kind !== 2) continue;                                              // only pair adjustment
      const fmt = r.u16(st), cover = coverage(r, st + r.u16(st + 2));
      const [size1, x1] = valueLayout(r.u16(st + 4)), [size2] = valueLayout(r.u16(st + 6));
      const xa = (o: number) => (x1 < 0 ? 0 : r.i16(o + x1));
      if (fmt === 1) {
        const pairs = new Map<number, number>(), firsts = [...coverageList(r, st + r.u16(st + 2))];
        for (let i = 0, n2 = r.u16(st + 8); i < n2; i++) {
          const ps = st + r.u16(st + 10 + 2 * i), rec = 2 + size1 + size2;
          for (let k = 0, m = r.u16(ps); k < m; k++) {
            const q = ps + 2 + k * rec;
            const key = firsts[i] * 65536 + r.u16(q);
            pairs.set(key, xa(q + 2));                 // a repeated pair: the last wins, as in fontTools
          }
        }
        subs.push({ kind: "pair", cover, pairs });
      } else {
        const c1 = classDef(r, st + r.u16(st + 8)), c2 = classDef(r, st + r.u16(st + 10));
        const n1 = r.u16(st + 12), n2 = r.u16(st + 14), recs: number[][] = [];
        for (let i = 0; i < n1; i++) {
          const row: number[] = [];
          for (let j = 0; j < n2; j++) row.push(xa(st + 16 + (i * n2 + j) * (size1 + size2)));
          recs.push(row);
        }
        subs.push({ kind: "class", cover, c1, c2, recs });
      }
    }
    out.push(subs);
  }
  return out;
}

/** coverage glyphs in coverage-index order (format 1 pair sets are indexed by it) */
function coverageList(r: Reader, o: number): number[] {
  const out: number[] = [];
  if (r.u16(o) === 1) for (let i = 0, n = r.u16(o + 2); i < n; i++) out.push(r.u16(o + 4 + 2 * i));
  else for (let i = 0, n = r.u16(o + 2); i < n; i++) {
    const q = o + 4 + 6 * i;
    for (let g = r.u16(q); g <= r.u16(q + 2); g++) out.push(g);
  }
  return out;
}

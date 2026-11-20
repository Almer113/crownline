// Just enough PNG for the build's tiled screenshots (no dependency): read the 8-bit RGB or RGBA,
// non-interlaced PNGs the browser writes, and write one large RGB PNG band by band, so the whole image
// (Mataram at 2x is 18338 × 8736) is never in memory at once.
import { closeSync, openSync, rmSync, writeSync } from "node:fs";
import { createDeflate, crc32, inflateSync } from "node:zlib";

const SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

/** an RGB image: width × height × 3 bytes, row after row */
export interface Rgb { width: number; height: number; data: Buffer }

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

/** a PNG (8-bit RGB or RGBA, not interlaced) as RGB; alpha is dropped (the chart is opaque) */
export function readPng(buf: Buffer): Rgb {
  if (!buf.subarray(0, 8).equals(SIG)) throw new Error("not a PNG");
  let pos = 8, width = 0, height = 0, ch = 0;
  const idat: Buffer[] = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos), type = buf.toString("latin1", pos + 4, pos + 8), body = buf.subarray(pos + 8, pos + 8 + len);
    if (type === "IHDR") {
      width = body.readUInt32BE(0); height = body.readUInt32BE(4);
      const depth = body[8], colour = body[9], interlace = body[12];
      if (depth !== 8 || (colour !== 2 && colour !== 6) || interlace !== 0)
        throw new Error(`PNG: only 8-bit RGB or RGBA, not interlaced (got depth ${depth}, colour type ${colour}, interlace ${interlace})`);
      ch = colour === 6 ? 4 : 3;
    } else if (type === "IDAT") idat.push(body);
    else if (type === "IEND") break;
    pos += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat)), stride = width * ch;
  const cur = Buffer.alloc(stride), prev = Buffer.alloc(stride), out = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y++) {
    const f = raw[y * (stride + 1)], row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let i = 0; i < stride; i++) {
      const a = i >= ch ? cur[i - ch] : 0, b = prev[i], c = i >= ch ? prev[i - ch] : 0;
      cur[i] = (row[i] + (f === 0 ? 0 : f === 1 ? a : f === 2 ? b : f === 3 ? (a + b) >> 1 : paeth(a, b, c))) & 255;
    }
    const o = y * width * 3;
    if (ch === 3) cur.copy(out, o);
    else for (let x = 0; x < width; x++) { out[o + 3 * x] = cur[4 * x]; out[o + 3 * x + 1] = cur[4 * x + 1]; out[o + 3 * x + 2] = cur[4 * x + 2]; }
    cur.copy(prev);
  }
  return { width, height, data: out };
}

function chunk(type: string, body: Buffer): Buffer {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(body.length, 0);
  head.write(type, 4, "latin1");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body, crc32(Buffer.from(type, "latin1"))) >>> 0);
  return Buffer.concat([head, body, crc]);
}

/** a PNG file written band by band: `band(rgb)` adds rows (each band as wide as the image), `end()` finishes */
export async function writePng(path: string, width: number, height: number) {
  const fd = openSync(path, "w");
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 2;
  writeSync(fd, SIG); writeSync(fd, chunk("IHDR", ihdr));
  const z = createDeflate({ level: 9, memLevel: 9 });
  z.on("data", (d: Buffer) => writeSync(fd, chunk("IDAT", d)));
  const done = new Promise<void>((res, rej) => { z.on("end", res); z.on("error", rej); });
  const stride = width * 3, prev = Buffer.alloc(stride);
  let rows = 0;
  const write = (b: Buffer) => new Promise<void>(res => (z.write(b) ? res() : z.once("drain", () => res())));
  return {
    async band(img: Rgb) {
      if (img.width !== width) throw new Error(`band ${img.width} px wide, image ${width}`);
      const out = Buffer.alloc(img.height * (stride + 1)), cand = [Buffer.alloc(stride), Buffer.alloc(stride)];
      for (let y = 0; y < img.height; y++) {
        const row = img.data.subarray(y * stride, (y + 1) * stride);
        // each row filtered the way that leaves the smallest numbers: none, Sub or Up
        let best = 0, bestSum = 0;
        for (let i = 0; i < stride; i++) bestSum += row[i] < 128 ? row[i] : 256 - row[i];
        for (let f = 1; f <= 2; f++) {
          const c = cand[f - 1];
          let s = 0;
          for (let i = 0; i < stride; i++) {
            const v = (row[i] - (f === 1 ? (i >= 3 ? row[i - 3] : 0) : prev[i])) & 255;
            c[i] = v; s += v < 128 ? v : 256 - v;
          }
          if (s < bestSum) { best = f; bestSum = s; }
        }
        const o = y * (stride + 1);
        out[o] = best;
        (best === 0 ? row : cand[best - 1]).copy(out, o + 1);
        row.copy(prev);
      }
      rows += img.height;
      await write(out);
    },
    async end() {
      if (rows !== height) throw new Error(`PNG: ${rows} rows written, ${height} expected`);
      z.end();
      await done;
      writeSync(fd, chunk("IEND", Buffer.alloc(0)));
      closeSync(fd);
    },
    /** give up: close and remove the unfinished file */
    abort() {
      z.destroy();
      try { closeSync(fd); } catch { /* closed already */ }
      rmSync(path, { force: true });
    },
  };
}

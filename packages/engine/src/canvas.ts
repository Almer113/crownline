// The canvas (PLAN Phase 5, step 6, its second half; the "place the whole tree" part of the Python
// compose.py): the tree moved clear of the header card (top left) and the map panel (top right), the
// chart's width and height, the footer and the lettered notes band, the card stretched to the chart (a top
// card as wide, a column card as tall), and the time axis's end lifted when the last people sit below it.
import type { Box } from "./boxes.ts";
import type { Doc } from "./doc.ts";
import type { Axis } from "./axis.ts";
import type { Geometry, Rect } from "./columns.ts";
import { type HeaderPanel, type Rows, TOP_GAP } from "./rows.ts";
import type { Tree } from "./tree.ts";
import { mapSize } from "./maps.ts";

export const GUTTER = 120;
export const FOOT_H = 170;      // caveats, sources and logos below the notes band


export interface Canvas {
  W: number;
  HGT: number;
  FOOT_Y: number;
  NOTES_H: number;
  MAP_X: number | null;
  MAP_Y: number;
  TREE_BOTTOM: number;
  /** the header card after it is stretched to the chart */
  header: HeaderPanel;
  NOTE_COLS: number;
  /** the map panel's size, or null for a chart without one */
  map: [number, number] | null;
}

const yov = (r: Rect, p: Rect) => r[1] < p[3] && p[1] < r[3];
const int = Math.trunc;          // Python's int() on a float

export function placeCanvas(doc: Doc, boxes: Map<string, Box>, tree: Tree, g: Geometry, axis: Axis, rows: Rows,
                            header: HeaderPanel, shift = true): Canvas {
  const hd = { ...header };
  const map = mapSize(doc);

  let all = g.rects(tree.root);
  const hdr: Rect = [hd.x, hd.y, hd.x + hd.width, hd.arrange === "column" ? 1e9 : hd.y + hd.height];
  const dx = Math.max(GUTTER + 40 - Math.min(...all.map(r => r[0])), ...all.filter(r => yov(r, hdr)).map(r => hdr[2] + 60 - r[0]));
  if (shift) g.shift(tree.root, dx);          // frozen mode sizes the canvas around the boxes where they are
  all = g.rects(tree.root);
  const maxR = Math.max(...all.map(r => r[2]));
  const MAP_Y = hd.y + (hd.arrange === "top" ? hd.height + TOP_GAP : 0);     // the map stays clear of a top card
  let W: number, MAP_X: number | null;
  if (map) {
    const mapRows: Rect = [0, MAP_Y, 0, MAP_Y + map[1]];
    W = int(Math.max(maxR + 60 + GUTTER, ...all.filter(r => yov(r, mapRows)).map(r => r[2] + 60 + map[0] + GUTTER + 20)));
    MAP_X = W - GUTTER - 20 - map[0];
  } else {
    W = int(Math.max(maxR + 60 + GUTTER, hd.x + hd.width + GUTTER));
    MAP_X = null;
  }
  const TREE_BOTTOM = Math.max(...all.map(r => r[3]));
  let FOOT_Y = int(Math.max(TREE_BOTTOM, hd.arrange === "row" ? hd.y + hd.height : 0) + 70);   // a tall row card too
  if (hd.arrange === "top") hd.width = W - 2 * hd.x;                // as wide as the chart
  else if (hd.arrange === "column") hd.height = int(Math.max(TREE_BOTTOM - hd.y, header.height));   // as tall as the tree, or its own height

  const NOTE_COLS = Math.max(1, Math.min(5, Math.floor((W - 2 * GUTTER - 80 + 46) / (440 + 46))));
  const notesBandH = () => {     // five balanced columns of wrapped notes (15 px type)
    const cw = (W - 2 * GUTTER - 80 - (NOTE_COLS - 1) * 46) / NOTE_COLS - 30;
    const hs = g.notes.filter((_, i) => !g.inline.has(i)).map(nt => g.nt.wrapLines(g.nt.nobreak(nt[5]), cw, 15) * 20.25 + 7);
    if (!hs.length) return 0;
    const per = Math.ceil(hs.length / NOTE_COLS);
    let most = -Infinity;
    for (let i = 0; i < hs.length; i += per) most = Math.max(most, hs.slice(i, i + per).reduce((a, b) => a + b, 0));
    return 34 + most + 40;
  };
  const NOTES_H = hd.arrange === "column" ? 0 : int(notesBandH());   // a column card holds the notes
  let HGT = int(FOOT_Y + NOTES_H + FOOT_H);
  if (hd.arrange === "column") HGT = FOOT_Y = int(Math.max(TREE_BOTTOM, hd.y + hd.height) + 130);  // the card holds the footer too

  const { now, year1 } = rows;
  if (axis.Y(year1) < TREE_BOTTOM + 30) {      // the bands reach below the last person
    const lift = TREE_BOTTOM + 30 - axis.Y(year1);
    for (const yr of axis.years)
      if (yr >= now) axis.ymap.set(yr, axis.ymap.get(yr)! + lift * Math.min(1, (yr - (now - 1)) / (year1 - (now - 1))));
  }
  return { W, HGT, FOOT_Y, NOTES_H, MAP_X, MAP_Y, TREE_BOTTOM, header: hd, NOTE_COLS, map };
}

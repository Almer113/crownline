// The layout so far, end to end (the Python compose.py): boxes, tree, rows, the time axis, columns, canvas.
import { type Box, makeBoxes } from "./boxes.ts";
import type { Doc, Env } from "./doc.ts";
import { type Axis, fitAxis } from "./axis.ts";
import { type Canvas, placeCanvas } from "./canvas.ts";
import { type Geometry, geometry, placeColumns } from "./columns.ts";
import { type HeaderPanel, headerPanel, placeRows, type Rows } from "./rows.ts";
import { readTables, type Tables } from "./tables.ts";
import { buildTree, type Tree } from "./tree.ts";
import { freeze, type Lock } from "./lock.ts";

export interface Composed {
  boxes: Map<string, Box>;
  ties: Map<string, string>;
  tables: Tables;
  tree: Tree;
  rows: Rows;
  axis: Axis;
  geometry: Geometry;
  canvas: Canvas;
  /** frozen mode: the lock it was pinned to, and the people the lock did not have (placed afresh) */
  lock: Lock | null;
  placed: string[];
}

/** lay a chart out; `header` overrides panels.header (to compare arrangements, as CHART_HEADER does).
 *  With a lock (frozen mode), everything the lock holds stays where it is (lock.ts, freeze) */
export function compose(doc: Doc, env: Env, header: HeaderPanel = headerPanel(doc), lock: Lock | null = null): Composed {
  const { boxes, ties } = makeBoxes(doc, env);
  const spouseDx = new Map([...ties].map(([s, p]) => [s, boxes.get(s)!.x - boxes.get(p)!.x]));
  const tables = readTables(doc), tree = buildTree(boxes, ties, tables);
  const rows = placeRows(doc, boxes, ties, tables, tree, header);
  const axis = fitAxis(boxes, ties, tables, rows);
  const g = geometry(doc, env, boxes, tables, tree, axis);
  placeColumns(boxes, ties, tables, tree, g, spouseDx);
  const canvas = placeCanvas(doc, boxes, tree, g, axis, rows, header);
  const c: Composed = { boxes, ties, tables, tree, rows, axis, geometry: g, canvas, lock, placed: [] };
  if (lock) {
    c.placed = freeze(c, lock).placed;
    c.canvas = placeCanvas(doc, boxes, tree, g, axis, rows, header, false);    // around the frozen boxes
  }
  return c;
}

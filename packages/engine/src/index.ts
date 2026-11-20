// @crownline/engine: the layout engine in TypeScript (PLAN Phase 5). Built step by step against the Python
// engine's output; see docs/PLAN.md, Phase 5.
export { Measure } from "./text/measure.ts";
export { parseFont, type Font } from "./text/font.ts";
export { makeBoxes, dispTitle, left, right, type Box, type Boxes, type Kind } from "./boxes.ts";
export { text, type Doc, type Env, type Fonts } from "./doc.ts";
export { readTables, type Tables, type Desc, type Marr } from "./tables.ts";
export { buildTree, TreeError, type Tree, type Group } from "./tree.ts";
export { placeRows, headerPanel, type Rows, type HeaderPanel, type Arrange } from "./rows.ts";
export { fitAxis, type Axis } from "./axis.ts";
export { nobreak, noteText, snapWidth, NBSP, type NoteText } from "./notes.ts";
export { geometry, placeColumns, GAP, type Geometry, type Rect, type Note } from "./columns.ts";
export { placeCanvas, GUTTER, type Canvas } from "./canvas.ts";
export { compose, type Composed } from "./compose.ts";
export { route, pyRound, LINE, CORNER, type Routing, type Seg, type Pt, type HRun } from "./routing.ts";
export { crossings, type Patch } from "./crossings.ts";
export { placeLabels, ov, segRect, type Labels, type BracketGeom, type EraLabel } from "./labels.ts";
export { pyFixed, escape } from "./py.ts";
export { check, textRects, issue, blockPeople, type Issue, type IssueCode, type Report } from "./checks.ts";
export { render, roundedPath, tint, hatch, letter, type Page } from "./render.ts";
export { succession, shortNames, sourcesText, titleScript, type SuccRow } from "./content.ts";
export { mapPanel, mapSize } from "./maps.ts";
export { layoutFile, span, plain, reignText, tours, FORMAT } from "./layout.ts";
export { lockOf, diffLock, dumpLock, freeze, lineName, LOCK_SECTIONS, TOL, type Lock } from "./lock.ts";
export { SANS, SCRIPT, SECOND_SCRIPT, fontChoice, type FontChoice } from "./fonts.ts";
export { webEnv, dataFiles, assetBase, plainPath, type WebFiles } from "./web.ts";

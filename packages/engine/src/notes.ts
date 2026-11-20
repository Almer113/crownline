// Note text as the layout measures it (the "notes" section of the Python compose.py): which spaces must not
// break, and how many lines a note needs at a width, breaking as Chrome does. The regular expressions follow
// Python's, whose \d, \w and \b are Unicode-aware: here \p{Nd}, [\p{L}\p{N}_] and lookarounds on that.
import type { Doc, Fonts } from "./doc.ts";

export const NBSP = " ";
const MONTHS = "Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec";
export const NOTE_WIDTHS = [240, 300, 360, 440, 560];
const W = "[\\p{L}\\p{N}_]";                       // Python's \w on text
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\\/-]/g, "\\$&");
const len = (s: string) => [...s].length;           // Python's len: code points

/** keep dates, numbered titles and the last two words of a note together */
export function nobreak(h: string, keepTogether: string[] = []): string {
  h = h.replace(new RegExp(`(\\p{Nd}) (${MONTHS})(?!${W})`, "gu"), `$1${NBSP}$2`);
  h = h.replace(new RegExp(`(?<!${W})(${MONTHS}) (\\p{Nd}{4})`, "gu"), `$1${NBSP}$2`);
  if (keepTogether.length)
    h = h.replace(new RegExp(`(${keepTogether.map(escape).join("|")}) ([IVX]+|\\p{Nd}+)(?!${W})`, "gu"), `$1${NBSP}$2`);
  h = h.split("d. c. ").join(`d.${NBSP}c.${NBSP}`);
  const i = h.lastIndexOf(" ");
  if (i > 0 && len(h.slice(i).replace(/<[^>]+>/g, "")) < 14) h = h.slice(0, i) + NBSP + h.slice(i + 1);
  return h;
}

export const snapWidth = (w: number) =>
  NOTE_WIDTHS.reduce((best, c) => (Math.abs(c - w) < Math.abs(best - w) ? c : best));

export interface NoteText {
  /** width of a run of note text, with <b> parts measured in the bold face */
  htmlW: (html: string, size: number) => number;
  /** lines the browser needs for this note: greedy breaks at spaces, after a hyphen inside a word
   *  (government-|appointed) and after an en dash (1729–|30), as Chrome does */
  wrapLines: (html: string, width: number, size?: number) => number;
  nobreak: (h: string) => string;
}

export function noteText(doc: Doc, fonts: Fonts): NoteText {
  const FS = doc.theme.type as Record<string, number>;
  const keep = ((doc.display as any)?.keepTogether ?? []) as string[];
  const htmlW = (html: string, size: number) => {
    let total = 0, bold = false;
    for (const part of html.split(/(<[^>]+>)/)) {
      if (part.startsWith("<")) bold = part === "<b>" ? true : part === "</b>" ? false : bold;
      else if (part) total += (bold ? fonts.sans.bold : fonts.sans.regular).width(part.split(NBSP).join(" "), size);
    }
    return total;
  };
  const split = new RegExp(`(?<=[A-Za-z]-)(?=[A-Za-z])|(?<=–)(?=${W})`, "u");
  const wrapLines = (html: string, width: number, size = FS.note) => {
    const pieces: [string, boolean][] = [];                       // (text, space before it)
    for (const w of html.split(" ").filter(Boolean))
      w.split(split).forEach((part, j) => pieces.push([part, j === 0]));
    let lines = 0, cur = "", bold = false;
    for (const [part, space] of pieces) {
      const trial = cur + (space && cur ? " " : "") + part;
      if (htmlW((bold ? "<b>" : "") + trial, size) > width - 0.5 && cur) {
        lines++;
        if (cur.includes("<b>") || cur.includes("</b>")) bold = cur.lastIndexOf("<b>") > cur.lastIndexOf("</b>");
        cur = part;
      } else cur = trial;
    }
    return lines + (cur ? 1 : 0);
  };
  return { htmlW, wrapLines, nobreak: (h: string) => nobreak(h, keep) };
}

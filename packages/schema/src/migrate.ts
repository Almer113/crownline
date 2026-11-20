// Versioning (PLAN Phase 4 item 5). A document carries an integer "format". When the format changes, a
// migration from format n to n + 1 is added here, with a fixture test (a document before and after).
// Opening an older document runs each step in turn; a newer one is refused (update Crownline).
// Format 1 is the first: there are no migrations yet. The v43 Python data was converted once, by
// tools/convert/convert_v43.py, and is not a format.
import { FORMAT } from "./chart.ts";

export type Doc = Record<string, unknown> & { format?: unknown };
/** from format n to n + 1; must not change anything it does not understand (ext stays as it is) */
export type Migration = (doc: Doc) => Doc;

export const MIGRATIONS: Record<number, Migration> = {};

export class FormatError extends Error {}

/** bring a document up to `target` (the current format); returns a new object and the steps taken */
export function migrate(doc: Doc, target = FORMAT, table: Record<number, Migration> = MIGRATIONS):
    { doc: Doc; steps: string[] } {
  const from = doc.format;
  if (!Number.isInteger(from)) throw new FormatError(`"format" must be a whole number, not ${JSON.stringify(from)}`);
  let n = from as number;
  if (n > target) throw new FormatError(`format ${n} is newer than this Crownline understands (${target}); update Crownline`);
  let out: Doc = structuredClone(doc);
  const steps: string[] = [];
  while (n < target) {
    const step = table[n];
    if (!step) throw new FormatError(`no migration from format ${n} to ${n + 1}`);
    out = step(structuredClone(out));
    if (out.format !== n + 1) throw new FormatError(`the migration from format ${n} did not set format ${n + 1}`);
    steps.push(`${n} → ${n + 1}`);
    n += 1;
  }
  return { doc: out, steps };
}

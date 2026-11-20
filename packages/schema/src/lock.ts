// The layout lock, format 1 (PLAN Phase 4 item 6; research 1.5): the accepted position of everything the
// layout engine places. Written by the build (--update-lock), the editor or the crownline tools, never by hand;
// the diff tool compares a build with it and names what moved. Sits beside the chart: charts/<chart>/layout.lock.json.
import { Type, type Static } from "@sinclair/typebox";

const N = Type.Number();
const Rect = Type.Array(N, { minItems: 4, maxItems: 4, description: "[left, top, right, bottom] in px" });
const Point = Type.Array(N, { minItems: 2, maxItems: 2 });
const Key = Type.String({ minLength: 1 });
const Of = <T extends Parameters<typeof Type.Record>[1]>(item: T, description: string) =>
  Type.Record(Key, item, { description });

export const LOCK_FORMAT = 1;

export const Lock = Type.Object({
  $schema: Type.Optional(Type.String()),
  format: Type.Literal(LOCK_FORMAT),
  chart: Type.String({ description: "meta.id of the chart document" }),
  canvas: Type.Array(Type.Integer({ minimum: 1 }), { minItems: 2, maxItems: 2, description: "[width, height]" }),
  errors: Type.Integer({ minimum: 0, description: "layout errors when the lock was written (should be 0)" }),
  warnings: Type.Array(Type.String(), { description: "layout warnings when the lock was written" }),
  boxes: Of(Rect, "each person's box, by person id"),
  drops: Of(Point, "the line into each child, by person id (\"child@descent\" when a child has more than one line): [x, y of the horizontal line it leaves]"),
  lines: Of(Type.Array(N), "the levels (y) of each line's horizontal runs, by descent id (a line's first descent) or union id"),
  notes: Of(Rect, "inline notes, by note id"),
  letters: Of(Type.String({ pattern: "^[a-z]{1,2}$" }), "the letter of each numbered note, by note id"),
  pills: Of(Point, "house pills, by person id: centre [x, y]"),
  headers: Of(Rect, "house headers, by person id"),
  crowns: Of(Rect, "crowns, by person id"),
  brackets: Of(Type.Array(N, { minItems: 3, maxItems: 3 }), "brackets, by their members joined with +: [x0, x1, y]"),
  axis: Of(N, "the y of each era's year on the time axis, by year"),
  eraLabels: Of(Rect, "era labels, by year"),
}, { additionalProperties: false, $id: "https://almer113.github.io/crownline/schema/lock-1.json", title: "Crownline layout lock, format 1" });

export type LockT = Static<typeof Lock>;

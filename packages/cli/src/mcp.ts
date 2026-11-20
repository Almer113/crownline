// The MCP server (PLAN Phase 8.2): `crownline mcp`, on stdio. Ten tools over the same functions as the command
// line (api.ts), their input schemas made from the operation registry's TypeBox schemas (no second set in
// Zod); the guide as a prompt and a resource. Mistakes a model can fix come back as results with isError and
// a message saying how; only unknown tools and malformed requests are protocol errors.
import { Type, type TSchema } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import { fromJsonSchema, McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { Chart } from "@crownline/schema";
import {
  applyOps, check, describe, diff, find, history, open, opsList, readPerson, renderRegion, undo, UserError,
} from "./api.ts";
import { guide } from "./guide.ts";
import { Operation } from "./registry.ts";
import { text } from "./main.ts";

const chart = Type.String({ description: "the chart: its id (wangsa-mataram, tokugawa), folder, or chart.json" });
const ids = Type.Array(Type.String(), { description: "person ids (from crownline_find)" });
/** an operation as the arguments are checked: any object with an op. The published schema has every operation's
 *  shape; a mistake in one is reported by apply itself, which names the operation and gives its example, where
 *  the union's own failure would list every shape it did not match */
const looseOp = Type.Object({ op: Type.String() }, { additionalProperties: true });
const loosen = (s: TSchema): TSchema => (s === Operation ? looseOp : s.type === "array" && s.items ? { ...s, items: loosen(s.items) } : s);

/** a tool's input schema from TypeBox (no second set in Zod), checked with TypeBox's own Value */
const obj = (props: Record<string, TSchema>) => {
  const published = Type.Object(props, { additionalProperties: false });
  // (a spread keeps TypeBox's mark of an optional property)
  const schema = Type.Object(Object.fromEntries(Object.entries(props).map(([k, v]) => [k, loosen(v)])), { additionalProperties: false });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- each handler states its own input type
  return fromJsonSchema<any>(published as never, {
    getValidator: () => (input: unknown) => Value.Check(schema, input)
      ? { valid: true as const, data: input, errorMessage: undefined }
      : { valid: false as const, data: undefined, errorMessage: [...Value.Errors(schema, input)].slice(0, 4).map(e => `${e.path || "(arguments)"}: ${e.message}`).join("; ") },
  } as never);
};

const READ = { readOnlyHint: true, openWorldHint: false } as const;
const WRITE = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false } as const;

type Content = { type: "text"; text: string } | { type: "image"; data: string; mimeType: string };
const ok = (v: object, extra: Content[] = []) => ({ content: [...extra, { type: "text" as const, text: text(v) }], structuredContent: v as Record<string, unknown> });
const wrap = <A>(fn: (a: A) => object | Promise<object>) => async (a: A) => {
  try { return ok(await fn(a)); }
  catch (e) {
    const msg = e instanceof UserError ? e.message : `Crownline failed: ${(e as Error).message}`;
    return { content: [{ type: "text" as const, text: msg }], isError: true };
  }
};

export function server(): McpServer {
  const s = new McpServer({ name: "crownline", version: "0.1.0" }, {
    instructions: "Crownline edits royal genealogy charts. Read the guide first (prompt crownline-guide, or resource crownline://guide): " +
      "look (describe, find, read), change with one apply batch (dry_run first), check, render to look, diff to confirm only what you meant moved. " +
      "Fix collisions locally (move the note first); never re-lay out a chart.",
  });

  s.registerTool("crownline_describe", { title: "Describe a chart", annotations: READ,
    description: "The chart in brief: title, counts of people, unions, lines and notes, the houses (ids and colours), the eras, whether its layout is kept, the check's totals, and its hash (pass it to crownline_apply as expected_hash).",
    inputSchema: obj({ chart }) }, wrap((a: { chart: string }) => describe(open(a.chart))));

  s.registerTool("crownline_find", { title: "Find people", annotations: READ,
    description: "Find people by words of their name (any spelling the chart knows), title or id, optionally by house id or a year (±15). Returns ids with short labels; use the ids in the other tools.",
    inputSchema: obj({ chart, query: Type.Optional(Type.String()), house: Type.Optional(Type.String()), year: Type.Optional(Type.Integer()),
      limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })) }) },
    wrap((a: { chart: string; query?: string; house?: string; year?: number; limit?: number }) => find(open(a.chart), a)));

  s.registerTool("crownline_read", { title: "Read a person", annotations: READ,
    description: "One person: the full record, their box on the page, the lines into them (with the line ids), their marriages (union ids, needed to add a couple's child), their children (depth 1-3), notes, adjustments that concern them, and layout issues involving them.",
    inputSchema: obj({ chart, id: Type.String(), depth: Type.Optional(Type.Integer({ minimum: 1, maximum: 3 })) }) },
    wrap((a: { chart: string; id: string; depth?: number }) => readPerson(open(a.chart), a.id, a)));

  s.registerTool("crownline_check", { title: "Check the layout", annotations: READ,
    description: "The layout check: errors (overlaps, lines through boxes or notes) and warnings, each with its code, the people and lines involved, a box in page px, and fixes to try in order. Filter by ids; level errors leaves out warnings.",
    inputSchema: obj({ chart, ids: Type.Optional(ids), level: Type.Optional(Type.Union([Type.Literal("errors"), Type.Literal("all")])) }) },
    wrap((a: { chart: string; ids?: string[]; level?: "errors" | "all" }) => check(open(a.chart), a)));

  s.registerTool("crownline_apply", { title: "Change the chart", annotations: WRITE,
    description: "Change the chart with a batch of operations (crownline_ops lists them with examples), all or nothing. The batch is validated, laid out (from the kept layout, so only what must move moves) and checked before anything is saved. " +
      "A batch that adds layout errors is NOT saved unless allow_errors: the result lists the new issues with fixes to try; fix them in the same batch. Use dry_run: true to try a batch. Prefer local fixes (move_note, a note's side or width, adjust breakAt, textLift, shareBus) before move_person. " +
      "Returns saved, the new hash, the new and fixed errors, and what moved.",
    inputSchema: obj({ chart, ops: Type.Array(Operation, { minItems: 1 }),
      reason: Type.String({ minLength: 1, description: "why, in a few words: kept in the history and with each adjustment" }),
      dry_run: Type.Optional(Type.Boolean()), allow_errors: Type.Optional(Type.Boolean()),
      expected_hash: Type.Optional(Type.String({ description: "the hash from crownline_describe or the last apply: refused if the chart changed since" })) }) },
    wrap((a: { chart: string; ops: unknown[]; reason: string; dry_run?: boolean; allow_errors?: boolean; expected_hash?: string }) => applyOps(open(a.chart), a)));

  s.registerTool("crownline_render", { title: "Look at a region", annotations: READ,
    description: "Render a region of the chart to a picture: around people (with their inline notes) or notes, with a margin (default 300 px), or a box in page px; issues are outlined in red and numbered, highlighted ids in blue. Pass ops to look at a batch without saving it. " +
      "The picture's long edge is at most 1600 px; the full file is saved in the chart's .crownline/renders/.",
    inputSchema: obj({ chart, around: Type.Optional(ids), margin: Type.Optional(Type.Number({ minimum: 0 })),
      box: Type.Optional(Type.Object({ x: Type.Number(), y: Type.Number(), w: Type.Number({ exclusiveMinimum: 0 }), h: Type.Number({ exclusiveMinimum: 0 }) })),
      scale: Type.Optional(Type.Number({ exclusiveMinimum: 0, maximum: 2 })), highlight: Type.Optional(ids), issues: Type.Optional(Type.Boolean()),
      ops: Type.Optional(Type.Array(Operation)) }) },
    async (a: Parameters<typeof renderRegion>[1] & { chart: string }) => {
      try {
        const { png, ...r } = await renderRegion(open(a.chart), a);
        return ok(r, [{ type: "image", data: png.toString("base64"), mimeType: "image/png" }]);
      } catch (e) {
        return { content: [{ type: "text" as const, text: e instanceof UserError ? e.message : `Crownline failed: ${(e as Error).message}` }], isError: true };
      }
    });

  s.registerTool("crownline_diff", { title: "What moved", annotations: READ,
    description: "Compare the chart now with a version: from \"last\" (before the last applied batch) or a git ref (\"HEAD\", the default). Lists the people and notes that moved (dx, dy in px), added and removed, the page size, and the error counts. After a fix, only the people you meant to move should be here.",
    inputSchema: obj({ chart, from: Type.Optional(Type.String()) }) },
    wrap((a: { chart: string; from?: string }) => diff(open(a.chart), a)));

  s.registerTool("crownline_history", { title: "Applied batches", annotations: READ,
    description: "The batches applied to the chart with these tools, newest first, with their reasons.",
    inputSchema: obj({ chart }) }, wrap((a: { chart: string }) => history(open(a.chart))));

  s.registerTool("crownline_undo", { title: "Undo the last batch", annotations: WRITE,
    description: "Undo the last applied batch, if the chart is still as that batch left it (not changed since by the editor or a person).",
    inputSchema: obj({ chart }) }, wrap((a: { chart: string }) => undo(open(a.chart))));

  s.registerTool("crownline_ops", { title: "The operations", annotations: READ,
    description: "The operations crownline_apply takes, each with a summary and an example; with op, that one's full schema.",
    inputSchema: obj({ op: Type.Optional(Type.String()) }) }, wrap((a: { op?: string }) => ({ ops: opsList(a.op) })));

  // the guide: a prompt (the user's slash command) and a resource (context a client attaches)
  const msg = (t: string) => ({ messages: [{ role: "user" as const, content: { type: "text" as const, text: t } }] });
  s.registerPrompt("crownline-guide", { title: "Crownline: the guide", description: "The style's rules, the working loop and the operations" }, () => msg(guide()));
  s.registerPrompt("crownline-fix-collisions", { title: "Crownline: fix the collisions", description: "Fix a chart's layout errors locally, without re-flowing it",
    argsSchema: obj({ chart }) }, (a: { chart: string }) => msg(`${guide()}\n\n---\n\nFix the layout errors in the chart ${a.chart}. ` +
      "Run crownline_check; for each error, render around it, try the local fixes in order with dry_run, apply the one that clears it without moving cards, and confirm with crownline_diff from last. Report each fix with its reason."));
  s.registerPrompt("crownline-add-person", { title: "Crownline: add a person", description: "Add a person to a chart, connected and checked",
    argsSchema: obj({ chart, who: Type.String({ description: "who, and how they are related" }) }) },
    (a: { chart: string; who: string }) => msg(`${guide()}\n\n---\n\nAdd to the chart ${a.chart}: ${a.who}. Follow the working loop; report the result with a picture.`));
  s.registerResource("guide", "crownline://guide", { title: "The Crownline guide for models", mimeType: "text/markdown" },
    async uri => ({ contents: [{ uri: uri.href, mimeType: "text/markdown", text: guide() }] }));
  s.registerResource("chart-schema", "crownline://schema/chart", { title: "The chart document's JSON Schema", mimeType: "application/schema+json" },
    async uri => ({ contents: [{ uri: uri.href, mimeType: "application/schema+json", text: JSON.stringify(Chart) }] }));
  return s;
}

/** serve on stdio until the client closes it; nothing else may write to stdout */
export async function serve(): Promise<void> {
  console.log = (...a: unknown[]) => console.error(...a);       // stray logging goes to stderr
  serveStdio(() => server(), { onerror: e => console.error("crownline mcp:", e.message) });
}

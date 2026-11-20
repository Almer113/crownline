// Two-pass validation (PLAN Phase 4 item 4): the JSON Schema (Ajv, draft 2020-12), then check.ts.
// Schema errors are rewritten into one readable line per mistake: where, and what is wrong.
import { Ajv2020, type ErrorObject } from "ajv/dist/2020.js";
import { Chart, Adjustment, EDTF_PATTERN, type ChartDoc } from "./chart.ts";
import { Lock, type LockT } from "./lock.ts";
import { check, checkLock, type Problem } from "./check.ts";

const ajv = new Ajv2020({ allErrors: true, strict: false, verbose: true });
const chartV = ajv.compile(Chart);
const lockV = ajv.compile(Lock);
const adjV = Object.fromEntries(Adjustment.anyOf.map(s => [s.properties.kind.const as string, ajv.compile(s)]));

/** /people/hb9/show/box → people.hb9.show.box */
const where = (path: string) => path.split("/").slice(1).map(p => p.replace(/~1/g, "/").replace(/~0/g, "~"))
  .reduce((acc, p) => /^\d+$/.test(p) ? `${acc}[${p}]` : acc ? `${acc}.${p}` : p, "") || "(document)";

/** what a pattern means, for the patterns people meet */
const PATTERNS: Record<string, string> = {
  "^[a-z][a-z0-9_]*$": "is not an id (lowercase letters, digits and _, starting with a letter)",
  "^#[0-9A-Fa-f]{6}$": "is not a colour like #EFC239",
  "^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$": "is not a language tag (en, id, jv-Java)",
  [EDTF_PATTERN]: "is not an EDTF date (1587, 1587~, 1587-05, 1792/1810, 1989/.., [1822,1823])",
  "^[a-z][a-z0-9]*(-[a-z0-9]+)*$": "is not a chart id (lowercase words joined by -)",
  "^([a-z][a-z0-9_]*|map:[A-Za-z0-9_]+)$": "is not a person id or map:<stage>",
};
const article = (t: string) => t === "integer" ? "a whole number" : /^[aeiou]/.test(t) ? `an ${t}` : `a ${t}`;

function say(e: ErrorObject): string {
  const p = e.params as Record<string, unknown>;
  const ps = e.parentSchema as Record<string, unknown> | undefined;
  switch (e.keyword) {
    case "required": return `${p.missingProperty} is missing`;
    case "additionalProperties": {
      const key = p.additionalProperty as string;
      const pats = ps?.patternProperties ? Object.keys(ps.patternProperties as object) : [];
      if (pats.length) return `key "${key}" ${PATTERNS[pats[0]] ?? `does not match ${pats[0]}`}`;
      return `unknown field "${key}" (extensions go under "ext")`;
    }
    case "enum": return `must be one of ${(p.allowedValues as unknown[]).map(v => JSON.stringify(v)).join(", ")}`;
    case "const": return `must be ${JSON.stringify(p.allowedValue)}`;
    case "type": return `must be ${article(p.type as string)}`;
    case "pattern": return `${JSON.stringify(e.data)} ${PATTERNS[p.pattern as string] ?? `does not match ${p.pattern}`}`;
    case "minProperties": return p.limit === 1 ? "must not be empty" : `needs at least ${p.limit} entries`;
    case "minItems": return p.limit === 1 ? "must not be empty" : `needs at least ${p.limit} items`;
    case "maxItems": return `has more than ${p.limit} items`;
    case "minimum": return `must be at least ${p.limit}`;
    case "maximum": return `must be at most ${p.limit}`;
    case "exclusiveMinimum": return `must be more than ${p.limit}`;
    default: return e.message ?? e.keyword;
  }
}

/** how one alternative of an anyOf reads ("a whole number ≥ 1", "\"several\"", "an object") */
function describe(s: Record<string, unknown>): string {
  if ("const" in s) return JSON.stringify(s.const);
  if (s.type === "integer") return s.minimum !== undefined ? `a whole number ≥ ${s.minimum}` : "a whole number";
  if (s.type === "string") return s.pattern && PATTERNS[s.pattern as string]?.includes(" id") ? "an id" : "a string";
  if (s.type === "array") return "a list";
  if (s.type === "object") return s.patternProperties ? "{key: value}" : "an object";
  return s.type ? article(s.type as string) : "another form";
}

/** Ajv explains a failed anyOf with every branch's errors. Keep the branch that had the right type
 *  (its errors say what is wrong inside it); if none had, say once what the value may be. */
function readable(errors: ErrorObject[]): Problem[] {
  const out: Problem[] = [];
  const seen = new Set<string>();
  const push = (at: string, message: string) => {
    const k = `${at}: ${message}`;
    if (!seen.has(k)) { seen.add(k); out.push({ level: "error", at, message }); }
  };
  const dropped = new Set<ErrorObject>();
  const summary = new Map<ErrorObject, string>();
  const anyOfs = errors.filter(e => e.keyword === "anyOf").sort((a, b) => b.schemaPath.length - a.schemaPath.length);
  for (const a of anyOfs) {
    const base = a.schemaPath + "/";
    const inside = errors.filter(e => e !== a && e.schemaPath.startsWith(base) && !dropped.has(e));
    const branches = new Map<string, ErrorObject[]>();
    for (const e of inside) {
      const i = e.schemaPath.slice(base.length).split("/")[0];
      branches.set(i, [...(branches.get(i) ?? []), e]);
    }
    const wrongType = (es: ErrorObject[]) =>
      es.some(e => e.instancePath === a.instancePath && ["type", "const", "anyOf"].includes(e.keyword));
    const fit = [...branches.values()].find(es => !wrongType(es));
    inside.forEach(e => { if (!fit?.includes(e)) dropped.add(e); });
    if (fit) { dropped.add(a); continue; }
    // no branch had the right type: one line for the anyOf
    const ps = a.parentSchema as { anyOf?: Record<string, unknown>[]; description?: string };
    const alts = ps.anyOf ?? [];
    summary.set(a, (ps.description ?? "").startsWith("a plain string") ? "must be text: a string, or {language tag: string}"
      : alts.every(s => "const" in s) ? `${JSON.stringify(a.data)} must be one of ${alts.map(describe).join(", ")}`
      : `must be ${alts.map(describe).join(" or ")}`);
  }
  for (const e of errors) if (!dropped.has(e)) push(where(e.instancePath), summary.get(e) ?? say(e));
  return out;
}

/** schema errors, with each adjustment checked against the schema for its own kind only */
function schemaErrors(doc: unknown): Problem[] {
  if (chartV(doc)) return [];
  const errors = chartV.errors ?? [];
  const adjBad = new Set<string>();
  for (const e of errors) { const m = /^\/adjustments\/([^/]+)/.exec(e.instancePath); if (m) adjBad.add(m[1]); }
  const adjustments = (doc as { adjustments?: Record<string, unknown> }).adjustments ?? {};
  const mine: ErrorObject[] = errors.filter(e => !/^\/adjustments\/[^/]+/.test(e.instancePath));
  const extra: Problem[] = [];
  for (const ptrId of adjBad) {
    const id = ptrId.replace(/~1/g, "/").replace(/~0/g, "~");
    const a = adjustments[id] as { kind?: string } | null;
    if (!a || typeof a !== "object" || Array.isArray(a)) { extra.push({ level: "error", at: `adjustments.${id}`, message: "must be an object with kind, target and reason" }); continue; }
    const v = adjV[a.kind ?? ""];
    if (!v) { extra.push({ level: "error", at: `adjustments.${id}`, message: `kind ${JSON.stringify(a.kind)} must be one of ${Object.keys(adjV).join(", ")}` }); continue; }
    v(a);
    for (const e of v.errors ?? []) mine.push({ ...e, instancePath: `/adjustments/${ptrId}` + e.instancePath, schemaPath: `#/adj/${ptrId}` + e.schemaPath.slice(1) });
  }
  return [...readable(mine), ...extra];
}

export interface Result { ok: boolean; errors: Problem[]; warnings: Problem[] }

/** validate a chart document: the schema first; references and tree rules only if it passes */
export function validate(doc: unknown): Result {
  const errors = schemaErrors(doc);
  if (errors.length) return { ok: false, errors, warnings: [] };
  const problems = check(doc as ChartDoc);
  const errs = problems.filter(p => p.level === "error"), warnings = problems.filter(p => p.level === "warning");
  return { ok: errs.length === 0, errors: errs, warnings };
}

/** validate a layout lock: its schema, and, given its document, that it belongs to it */
export function validateLock(lock: unknown, doc?: ChartDoc): Result {
  if (!lockV(lock)) return { ok: false, errors: readable(lockV.errors ?? []), warnings: [] };
  const problems = doc ? checkLock(lock as LockT, doc) : [];
  const errors = problems.filter(p => p.level === "error"), warnings = problems.filter(p => p.level === "warning");
  return { ok: errors.length === 0, errors, warnings };
}

export const format = (p: Problem) => `${p.level === "error" ? "error" : "warning"}  ${p.at}: ${p.message}`;

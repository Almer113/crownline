// npm run guide: the guide for models, written where people and Claude Code find it
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { ROOT } from "./api.ts";
import { guide } from "./guide.ts";

const SKILL = `---
name: crownline
description: Edit a Crownline royal genealogy chart (charts/<id>/chart.json) - add people, marriages and notes, fix layout collisions without re-flowing, look at regions and compare positions - through the crownline command line or MCP tools. Use for any change to a chart in charts/.
---

`;
const out: [string, string][] = [
  ["docs/AI_GUIDE.md", `<!-- made by npm run guide from packages/cli/src/guide.ts and the operation registry: do not edit by hand -->\n\n${guide()}`],
  [".claude/skills/crownline/SKILL.md", SKILL + guide()],
];
for (const [f, text] of out) { mkdirSync(dirname(join(ROOT, f)), { recursive: true }); writeFileSync(join(ROOT, f), text, "utf8"); console.log("wrote", f); }

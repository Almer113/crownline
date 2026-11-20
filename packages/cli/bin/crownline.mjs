#!/usr/bin/env node
// crownline: the command line, run from its TypeScript source (tsx)
import { register } from "tsx/esm/api";
register();
const { main } = await import("../src/main.ts");
main(process.argv.slice(2)).then(code => { if (code >= 0) process.exitCode = code; }, err => {
  console.error(err?.constructor?.name === "UserError" ? err.message : err?.stack ?? err);
  process.exitCode = 2;
});

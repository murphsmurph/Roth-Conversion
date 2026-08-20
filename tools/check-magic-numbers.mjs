#!/usr/bin/env node
// CI guard (CLAUDE.md R3 / addendum §5.4): src/engine/** must contain NO numeric literal
// outside the allowed set [-1, 0, 1, 2, 100]. Every tax constant belongs in a versioned,
// sourced rules JSON — not inline in the engine. Comments and string literals are ignored.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = "src/engine";
const ALLOWED = new Set(["0", "1", "2", "100"]); // -1 appears as the token "1"

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (p.endsWith(".ts")) out.push(p);
  }
  return out;
}

function strip(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, " ")            // block comments
    .replace(/\/\/[^\n]*/g, " ")                    // line comments
    .replace(/`(?:\\.|\$\{[^}]*\}|[^`\\])*`/g, " ") // template literals
    .replace(/"(?:\\.|[^"\\])*"/g, " ")             // double-quoted strings
    .replace(/'(?:\\.|[^'\\])*'/g, " ");            // single-quoted strings
}

let violations = 0;
for (const file of walk(ROOT)) {
  const code = strip(readFileSync(file, "utf8"));
  const lines = code.split("\n");
  lines.forEach((line, idx) => {
    for (const m of line.matchAll(/\b\d+(?:\.\d+)?\b/g)) {
      if (!ALLOWED.has(m[0])) {
        violations++;
        console.error(`MAGIC NUMBER  ${file}:${idx + 1}  -> ${m[0]}  (move to a rules JSON with sourceUrl + verifiedDate)`);
      }
    }
  });
}

if (violations > 0) {
  console.error(`\n${violations} magic number(s) found in ${ROOT}. Failing.`);
  process.exit(1);
}
console.log(`OK — no magic numbers in ${ROOT}.`);

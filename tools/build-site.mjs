#!/usr/bin/env node
// Build-and-inline: src/engine/legacy/projectorEngine.ts is the single source of truth for the
// deployed engine. This inlines it (as a classic-script factory) into the ENGINE region of each
// static HTML file, so the site stays one self-contained file (no external fetches, nothing to 404).
import { readFileSync, writeFileSync } from "node:fs";

const START = "// ===ENGINE-START===";
const END = "// ===ENGINE-END===";
const TARGETS = ["index.html", "roth-conversion-projector.html"];

const factory = readFileSync("src/engine/legacy/projectorEngine.ts", "utf8")
  .replace(/^\/\/ @ts-nocheck\r?\n/, "")
  .replace(/export function createProjectorEngine/, "function createProjectorEngine")
  .trimEnd();
// indent 2 spaces to sit inside the IIFE
const body = factory.split("\n").map(l => (l.length ? "  " + l : l)).join("\n");

const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const re = new RegExp("(" + esc(START) + "\\r?\\n)[\\s\\S]*?(\\r?\\n[ \\t]*" + esc(END) + ")");

let changed = 0;
for (const f of TARGETS) {
  const html = readFileSync(f, "utf8");
  if (!re.test(html)) { console.error(`markers not found in ${f}`); process.exit(1); }
  const out = html.replace(re, (_m, a, b) => a + body + b.replace(/^\r?\n/, "\n"));
  writeFileSync(f, out);
  changed++;
  console.log(`inlined engine into ${f}`);
}
console.log(`build-site: updated ${changed} file(s).`);

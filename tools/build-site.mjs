#!/usr/bin/env node
// Build-and-inline. Two engines are inlined into each static HTML file so the site stays one
// self-contained file (no external fetches, nothing to 404):
//   1) The legacy projector (src/engine/legacy/projectorEngine.ts) drives the existing rich UI
//      (50-state detail, QCD, estate, Monte Carlo) — inlined verbatim into the ENGINE region.
//   2) The validated Phase 2-5 engine (src/engine/index.ts) is esbuild-bundled to an IIFE global
//      `RTP` and inlined into the RTP-ENGINE region; it powers the "Optimal conversion" panel and
//      is fully updatable from the versioned rules JSON.
import { readFileSync, writeFileSync } from "node:fs";
import { buildSync } from "esbuild";

const TARGETS = ["index.html"];
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const regionRe = (start, end) =>
  new RegExp("(" + esc(start) + "\\r?\\n)[\\s\\S]*?(\\r?\\n[ \\t]*" + esc(end) + ")");

// (1) legacy factory, indented to sit inside the main IIFE
const factory = readFileSync("src/engine/legacy/projectorEngine.ts", "utf8")
  .replace(/^\/\/ @ts-nocheck\r?\n/, "")
  .replace(/export function createProjectorEngine/, "function createProjectorEngine")
  .trimEnd();
const legacyBody = factory.split("\n").map(l => (l.length ? "  " + l : l)).join("\n");
const legacyRe = regionRe("// ===ENGINE-START===", "// ===ENGINE-END===");

// (2) validated engine, bundled to a single self-contained IIFE assigned to window.RTP
const bundled = buildSync({
  entryPoints: ["src/engine/index.ts"],
  bundle: true, format: "iife", globalName: "RTP", platform: "browser",
  target: "es2019", legalComments: "none", write: false,
}).outputFiles[0].text.trimEnd();
const rtpBody =
  "/* Bundled by tools/build-site.mjs from src/engine/index.ts — do not edit here. */\n" +
  bundled + "\nwindow.RTP = RTP;";
const rtpRe = regionRe("/* ===RTP-ENGINE-START=== */", "/* ===RTP-ENGINE-END=== */");

let changed = 0;
for (const f of TARGETS) {
  let html = readFileSync(f, "utf8");
  if (!legacyRe.test(html)) { console.error(`legacy markers not found in ${f}`); process.exit(1); }
  if (!rtpRe.test(html)) { console.error(`RTP markers not found in ${f}`); process.exit(1); }
  html = html.replace(legacyRe, (_m, a, b) => a + legacyBody + b.replace(/^\r?\n/, "\n"));
  html = html.replace(rtpRe, (_m, a, b) => a + rtpBody + b.replace(/^\r?\n/, "\n"));
  writeFileSync(f, html);
  changed++;
  console.log(`inlined legacy + RTP engine into ${f}`);
}
console.log(`build-site: updated ${changed} file(s).`);

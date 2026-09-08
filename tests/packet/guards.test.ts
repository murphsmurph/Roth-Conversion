// Track B architecture guards (CLAUDE.md 8.5 / spec 3.1-3.2). These MUST pass and gate CI:
// src/packet/** and src/ledger/** never import src/rules/** or the legacy engine. The packet consumes
// the VALIDATED engine only; a rules/legacy import is a defect, not a style nit.
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

function tsFiles(dir: string): string[] {
  const out: string[] = [];
  let entries: string[] = [];
  try { entries = readdirSync(dir); } catch { return out; }
  for (const e of entries) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...tsFiles(p));
    else if (e.endsWith(".ts")) out.push(p);
  }
  return out;
}

const importFrom = (src: string): string[] =>
  [...src.matchAll(/(?:import|export)[^'"]*from\s*['"]([^'"]+)['"]/g)].map(m => m[1]!);

describe("Track B guards — packet/ledger never import rules or the legacy engine", () => {
  for (const layer of ["src/packet", "src/ledger"]) {
    it(`${layer}/** does not import src/rules/**`, () => {
      for (const f of tsFiles(join(ROOT, layer))) {
        for (const spec of importFrom(readFileSync(f, "utf8"))) {
          expect(spec, `${f} imports ${spec}`).not.toMatch(/rules/);
        }
      }
    });
    it(`${layer}/** does not import the legacy engine`, () => {
      for (const f of tsFiles(join(ROOT, layer))) {
        for (const spec of importFrom(readFileSync(f, "utf8"))) {
          expect(spec, `${f} imports ${spec}`).not.toMatch(/legacy/);
        }
      }
    });
  }
});

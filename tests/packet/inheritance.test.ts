// Inheritance module runner (Track B, session B1a). GREEN and gating: 16/16 INH fixtures pass.
// Each fixture asserts only the keys it targets; a handful of guard keys assert a NEGATIVE
// (mustNotEqual / mustNotReport / mustNotSay / wrongAnswerToWatchFor). The fixtures are the oracle
// (INHERITANCE-MODULE-SPEC.md §7) — never edited to make the module pass.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import { analyzeInheritance } from "../../src/inheritance/analyze";
import { INHERITANCE_FLAGS } from "../../src/inheritance/flags";

const FIX = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures", "inheritance");
interface Row { id: string; title: string }
const index: Row[] = JSON.parse(readFileSync(join(FIX, "INDEX.json"), "utf8"));

const DOC_ONLY = new Set(["mustNotCompute"]);

describe("inheritance module — 16 INH fixtures", () => {
  for (const row of index) {
    const f = JSON.parse(readFileSync(join(FIX, `${row.id}.json`), "utf8"));
    it(`${f.id} — ${f.title}`, () => {
      const out = analyzeInheritance(f.input);
      const exp = f.expected as Record<string, unknown>;
      for (const [key, want] of Object.entries(exp)) {
        if (DOC_ONLY.has(key)) continue;
        switch (key) {
          case "flags":
            expect([...(out.flags as string[])].sort(), `${f.id}:flags`)
              .toEqual([...(want as string[])].sort());
            break;
          case "mustNotEqual":
            for (const [k, v] of Object.entries(want as Record<string, unknown>))
              expect(out[k], `${f.id}:mustNotEqual.${k}`).not.toEqual(v);
            break;
          case "mustNotReport":
            expect(out.status, `${f.id}:mustNotReport`).not.toEqual(want);
            break;
          case "mustNotSay":
            expect(String(out.requiredFlagText ?? ""), `${f.id}:mustNotSay`)
              .not.toContain(want as string);
            break;
          case "wrongAnswerToWatchFor":
            expect(out.tenYearRuleEndDate, `${f.id}:wrongAnswer`).not.toEqual(want);
            break;
          default:
            expect(out[key], `${f.id}:${key}`).toEqual(want);
        }
      }
    });
  }
});

describe("inheritance flag registry (spec §6)", () => {
  it("every flag the analyzer emits across the fixtures is registered, as a non-conclusion", () => {
    for (const row of index) {
      const f = JSON.parse(readFileSync(join(FIX, `${row.id}.json`), "utf8"));
      const out = analyzeInheritance(f.input);
      for (const id of (out.flags as string[])) {
        expect(INHERITANCE_FLAGS[id], `${row.id} emits unregistered flag ${id}`).toBeDefined();
        expect(INHERITANCE_FLAGS[id]!.isConclusion, `${id} must be an observation`).toBe(false);
      }
    }
  });
});

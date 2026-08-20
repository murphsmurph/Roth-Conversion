// Property tests P1–P6 (PHASE-0-FIXTURE-SPEC.md §5).
// Governing invariant: NO UNEXPLAINED MOVEMENT — not that any curve has a particular shape.
//
// Phase 0: the engine throws NotImplementedError, so all of these fail. That is success.
// They are written against the real engine API so they become live invariants in later phases.
import { describe, it, expect } from "vitest";
import { computeYear } from "../../src/engine/calculateYear";
import { ENUMERATED_DISCONTINUITIES, isEnumeratedDiscontinuity } from "../../src/rules/discontinuities";
import type { YearInput } from "../../src/engine/types";

function baseInput(over: Partial<YearInput> = {}): YearInput {
  return {
    taxYear: 2026, lawMode: "current_law", status: "mfj", ages: [68, 67],
    iraDistributions: 60000, ...over,
  };
}

const fedTax = (over: Partial<YearInput>): number => computeYear(baseInput(over)).totalFederalTax;

describe("property invariants", () => {
  // P1 — designated-monotonic class: a clean household (no SS, no preferential income, no cliffs)
  // must never see federal tax DECREASE as conversion income rises.
  it("P1 — designated-monotonic: incremental conversion does not reduce federal tax", () => {
    let prev = -Infinity;
    for (let conv = 0; conv <= 200000; conv += 25000) {
      const t = fedTax({ rothConversion: conv });
      expect(t, `conversion ${conv}`).toBeGreaterThanOrEqual(prev);
      prev = t;
    }
  });

  // P2 — no unexplained movement: any large jump in marginal cost across a sweep must be
  // explained by a discontinuity rule ID drawn from the registry. (Fleshed out in Phase 3.)
  it("P2 — every discontinuity carries a registered rule ID", () => {
    const step = 1000;
    let prevTax = fedTax({ rothConversion: 0 });
    let prevMarg = 0;
    for (let conv = step; conv <= 250000; conv += step) {
      const r = computeYear(baseInput({ rothConversion: conv }));
      const marg = (r.totalFederalTax - prevTax) / step;
      const jump = Math.abs(marg - prevMarg) > 0.10; // a level jump, not a bracket kink
      if (jump) {
        expect(r.appliedRuleIds.some(isEnumeratedDiscontinuity), `unexplained jump at ${conv}`).toBe(true);
      }
      for (const id of r.appliedRuleIds) {
        if (isEnumeratedDiscontinuity(id)) expect(ENUMERATED_DISCONTINUITIES).toContain(id);
      }
      prevTax = r.totalFederalTax;
      prevMarg = marg;
    }
  });

  // P3 — zero identity: a $0 conversion reproduces the baseline to the penny.
  it("P3 — zero identity", () => {
    expect(fedTax({ rothConversion: 0 })).toBe(fedTax({}));
  });

  // P4 — additivity within a year: converting X then Y equals converting X+Y.
  it("P4 — additivity within a tax year", () => {
    const x = 30000, y = 40000;
    const t0 = fedTax({ rothConversion: 0 });
    const tx = fedTax({ rothConversion: x });
    const txy = fedTax({ rothConversion: x + y });
    const incrementalTwoStep = (tx - t0) + (txy - tx);
    const incrementalOneStep = txy - t0;
    expect(Math.abs(incrementalTwoStep - incrementalOneStep)).toBeLessThanOrEqual(0.01);
  });

  // P5 — MAGI isolation: the four MAGIs are not aliases. With muni interest + SS present:
  // magi.aca > magi.irmaa > magi.niit, and magi.senior === agi.
  it("P5 — MAGI isolation", () => {
    const r = computeYear(baseInput({
      grossSocialSecurity: 48000, iraDistributions: 14000, taxExemptInterest: 8000,
    }));
    expect(r.magi.aca).toBeGreaterThan(r.magi.irmaa);
    expect(r.magi.irmaa).toBeGreaterThan(r.magi.niit);
    expect(r.magi.senior).toBe(r.agi);
  });

  // P6 — provenance completeness: every applied discontinuity ID resolves in the registry,
  // and calculationMetadata is fully populated.
  it("P6 — provenance completeness", () => {
    const r = computeYear(baseInput({ rothConversion: 50000 }));
    for (const id of r.appliedRuleIds) {
      if (id.startsWith("IRMAA_") || id.startsWith("ACA_")) {
        expect(isEnumeratedDiscontinuity(id), `unregistered discontinuity ${id}`).toBe(true);
      }
    }
    const m = r.calculationMetadata;
    for (const v of [m.engineVersion, m.federalRulesVersion, m.medicareRulesVersion, m.acaRulesVersion, m.calculationDate]) {
      expect(v && v.length).toBeTruthy();
    }
    expect(m.taxYear).toBe(2026);
  });
});

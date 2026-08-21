// Phase 3 exit criterion: on a representative household, every inflection in the marginal-cost
// curve is explained by a named rule, and there is NO unexplained movement anywhere in the sweep.
import { describe, it, expect } from "vitest";
import { sweepConversion, type SweepOpts } from "../../src/engine/sweepConversion";
import { ENUMERATED_DISCONTINUITIES, isEnumeratedDiscontinuity } from "../../src/rules/discontinuities";
import type { YearInput } from "../../src/engine/types";

// MFJ, both 65+, heavy Social Security + preferential income — the CG-08 profile. Sweeping a
// conversion across it crosses the SS torpedo, the senior-deduction phaseout, LTCG/QD stacking,
// NIIT, and several IRMAA tiers.
const household: YearInput = {
  taxYear: 2026, lawMode: "current_law", status: "mfj", ages: [68, 67],
  grossSocialSecurity: 120000, iraDistributions: 40000, qualifiedDividends: 15000, netLtcg: 30000,
};

const opts: SweepOpts = {
  maxConversion: 250000, coarseStep: 1000, fineStep: 100, fineWindow: 5000,
  marginalEpsilon: 0.01, medicareEnrollees: 2, householdSize: 2, annualAcaCredit: 0, stateMarginalRate: 0,
};

describe("Phase 3 — marginal conversion sweep", () => {
  const { steps, inflections } = sweepConversion(household, opts);

  it("produces a monotonic-cost sweep with both rates", () => {
    expect(steps.length).toBeGreaterThan(50);
    // total economic cost never decreases as conversion rises (no credits in this household)
    for (let i = 1; i < steps.length; i++) {
      expect(steps[i]!.totalEconomicCost).toBeGreaterThanOrEqual(steps[i - 1]!.totalEconomicCost - 0.01);
    }
    const last = steps[steps.length - 1]!;
    expect(last.averageRate).toBeGreaterThan(0);
    expect(last.marginalRate).toBeGreaterThan(0);
  });

  it("every inflection carries at least one rule id; jumps carry a registry discontinuity id", () => {
    expect(inflections.length).toBeGreaterThan(0);
    for (const infl of inflections) {
      for (const cr of infl.crossings) {
        expect(cr.ruleId, `inflection @ ${infl.conversion}`).toBeTruthy();
        if (cr.kind === "jump") {
          expect(isEnumeratedDiscontinuity(cr.ruleId), `jump ruleId ${cr.ruleId} in registry`).toBe(true);
        }
      }
    }
  });

  it("NO unexplained movement: every marginal-rate change is explained by a labeled crossing", () => {
    const explainedNear = (i: number): boolean =>
      [i - 1, i, i + 1].some(j => steps[j] !== undefined && steps[j]!.crossings.length > 0);
    for (let i = 2; i < steps.length; i++) {
      const changed = Math.abs(steps[i]!.marginalRate - steps[i - 1]!.marginalRate) > opts.marginalEpsilon;
      if (changed) {
        expect(explainedNear(i), `unexplained marginal change at conversion ${steps[i]!.conversion} ` +
          `(${(steps[i - 1]!.marginalRate * 100).toFixed(2)}% -> ${(steps[i]!.marginalRate * 100).toFixed(2)}%)`).toBe(true);
      }
    }
  });

  it("exercises multiple distinct provisions (SS, senior, LTCG, NIIT, IRMAA)", () => {
    const ruleIds = new Set(inflections.flatMap(s => s.crossings.map(c => c.ruleId)));
    // at least one IRMAA tier jump present
    expect([...ruleIds].some(id => id.startsWith("IRMAA_TIER_"))).toBe(true);
    // and at least three distinct causes overall (kinks + jumps)
    expect(ruleIds.size).toBeGreaterThanOrEqual(3);
    // sanity: every registry discontinuity id we emit is valid
    for (const id of ruleIds) if (id.startsWith("IRMAA_") || id.startsWith("ACA_")) {
      expect(ENUMERATED_DISCONTINUITIES).toContain(id);
    }
  });
});

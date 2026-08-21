// Phase 5: the optimizer outputs a RANGE + preferred target + binding constraint (by rule id) +
// why-not-more/less + sensitivity, all from the deterministic engine.
import { describe, it, expect } from "vitest";
import { optimizeConversion, type OptimizerOpts } from "../../src/engine/optimizeConversion";
import { projectLifetime, type LifetimeInput } from "../../src/engine/projectLifetime";

// MFJ couple in the pre-RMD "tax valley": low current income, large traditional balances, SS not yet
// claimed — the classic profile where filling low brackets with conversions pays off.
const household: LifetimeInput = {
  taxYear: 2026, lawMode: "current_law", filingStatus: "mfj",
  spouses: [
    { label: "A", birthYear: 1963, age: 63, traditionalIra: 700_000, socialSecurityAnnual: 30_000, ssClaimAge: 70, pensionAnnual: 0, pensionSurvivorFraction: 0 },
    { label: "B", birthYear: 1965, age: 61, traditionalIra: 200_000, socialSecurityAnnual: 18_000, ssClaimAge: 67, pensionAnnual: 0, pensionSurvivorFraction: 0 },
  ],
  rothBalance: 100_000, taxableBalance: 250_000, otherOrdinaryAnnual: 20_000, spendingAnnual: 85_000,
  growthRate: 0.06, inflationRate: 0.025, horizonAge: 95, firstDeathAtAgeA: 84, whoDiesFirst: "B",
  medicareEnrollees: 2, beneficiaryTaxRate: 0.27, beneficiaryWindowYears: 10, conversionByYear: [],
};

const opts: OptimizerOpts = {
  conversionYears: 10, candidateStep: 10_000, candidateMax: 150_000, rangeTolerance: 0.05, roundTo: 1000,
  sweepOpts: { maxConversion: 250_000, coarseStep: 1000, fineStep: 100, fineWindow: 5000, marginalEpsilon: 0.01,
    medicareEnrollees: 2, householdSize: 2, annualAcaCredit: 0, stateMarginalRate: 0 },
  growthDelta: 0.02, horizonDelta: 5, beneficiaryRateDelta: 0.05,
};

describe("Phase 5 — conversion optimizer", () => {
  const r = optimizeConversion(household, opts);

  it("recommends a range with the preferred target inside it", () => {
    expect(r.optimalRangeLow).toBeLessThanOrEqual(r.preferredTarget);
    expect(r.preferredTarget).toBeLessThanOrEqual(r.optimalRangeHigh);
    expect(r.optimalRangeHigh).toBeGreaterThan(r.optimalRangeLow); // a range, not a point
  });

  it("the preferred conversion beats both doing nothing and over-converting", () => {
    expect(r.expectedBenefit).toBeGreaterThan(0);
    const w = (a: number) => projectLifetime({ ...household, conversionByYear: Array.from({ length: opts.conversionYears }, () => a) }).finalAfterTaxWealthBeneficiary;
    expect(w(r.preferredTarget)).toBeGreaterThan(w(0));
    expect(w(r.preferredTarget)).toBeGreaterThan(w(opts.candidateMax));
  });

  it("names a binding constraint and answers why-not-more / why-not-less", () => {
    expect(r.bindingConstraintCause.length).toBeGreaterThan(0);
    expect(r.whyNotMore).toMatch(/\$/);
    expect(r.whyNotLess.length).toBeGreaterThan(0);
    // if a discontinuity binds, its rule id is a real IRMAA/ACA discontinuity
    if (r.bindingConstraintRuleId) expect(r.bindingConstraintRuleId).toMatch(/IRMAA_|ACA_/);
  });

  it("reports sensitivity across returns, longevity, and future/beneficiary rate", () => {
    expect(r.sensitivity.length).toBe(3);
    for (const s of r.sensitivity) {
      expect(s.base).toBe(r.preferredTarget);
      expect(Number.isFinite(s.low)).toBe(true);
      expect(Number.isFinite(s.high)).toBe(true);
    }
  });

  it("carries provenance, law-mode label, assumptions, data-quality, and a disclaimer", () => {
    expect(r.lawMode).toBe("current_law");
    expect(r.calculationMetadata.federalRulesVersion).toMatch(/federal-2026/);
    expect(Object.keys(r.assumptions).length).toBeGreaterThan(3);
    expect(r.dataQuality.length).toBeGreaterThan(0);
    expect(r.disclaimer).toMatch(/not tax advice/i);
  });
});

// State-tax v1 (flat-rate). The engine models the nine no-income-tax states at 0% on ordinary income,
// applies an advisor-supplied flat rate for any other state, and NEVER guesses a state rate — an
// unspecified taxing state is flagged NOT MODELED rather than assigned a fabricated rate.
import { describe, it, expect } from "vitest";
import { resolveStateOrdinaryRate, stateTaxOnOrdinary } from "../../src/engine/calculateState";
import { projectLifetime, type LifetimeInput } from "../../src/engine/projectLifetime";

describe("state tax — rate resolution (never guesses)", () => {
  it("no-income-tax state resolves to 0 and is MODELED", () => {
    for (const code of ["TX", "fl", "  Wa "]) {
      const r = resolveStateOrdinaryRate({ stateCode: code, advisorMarginalRate: null });
      expect(r.rate).toBe(0);
      expect(r.modeled).toBe(true);
      expect(r.basis).toBe("no_income_tax_state");
    }
  });

  it("advisor-supplied rate is applied and MODELED", () => {
    const r = resolveStateOrdinaryRate({ stateCode: "CA", advisorMarginalRate: 0.093 });
    expect(r.rate).toBeCloseTo(0.093, 6);
    expect(r.modeled).toBe(true);
    expect(r.basis).toBe("advisor_supplied");
  });

  it("taxing state with NO supplied rate is NOT modeled (defaults to 0, does not guess)", () => {
    const r = resolveStateOrdinaryRate({ stateCode: "CA", advisorMarginalRate: null });
    expect(r.rate).toBe(0);
    expect(r.modeled).toBe(false);
    expect(r.basis).toBe("unspecified_default_zero");
    expect(r.note).toMatch(/does not guess/i);
  });

  it("no state at all is NOT modeled", () => {
    const r = resolveStateOrdinaryRate({ stateCode: null, advisorMarginalRate: null });
    expect(r.modeled).toBe(false);
    expect(r.rate).toBe(0);
  });

  it("flat tax floors negatives at zero", () => {
    expect(stateTaxOnOrdinary(100_000, 0.05)).toBeCloseTo(5_000, 6);
    expect(stateTaxOnOrdinary(-100, 0.05)).toBe(0);
  });
});

describe("state tax — lifetime integration", () => {
  const base: LifetimeInput = {
    taxYear: 2026, lawMode: "current_law", filingStatus: "single",
    spouses: [{ label: "A", birthYear: 1956, age: 70, traditionalIra: 800_000,
      socialSecurityAnnual: 30_000, ssClaimAge: 70, pensionAnnual: 0, pensionSurvivorFraction: 0 }],
    rothBalance: 0, taxableBalance: 400_000, otherOrdinaryAnnual: 0, spendingAnnual: 50_000,
    growthRate: 0.05, inflationRate: 0, horizonAge: 80,
    firstDeathAtAgeA: 0, whoDiesFirst: "A", medicareEnrollees: 1,
    beneficiaryTaxRate: 0.24, beneficiaryWindowYears: 10, conversionByYear: [],
  };

  it("a no-tax state and an unspecified state both yield zero state tax", () => {
    const tx = projectLifetime({ ...base, stateCode: "TX" });
    const none = projectLifetime(base);
    expect(tx.stateTaxRate).toBe(0);
    expect(tx.stateTaxModeled).toBe(true);           // TX: modeled at 0
    expect(none.stateTaxModeled).toBe(false);         // unspecified: not modeled
    expect(tx.rows.every(r => r.stateTax === 0)).toBe(true);
    expect(none.rows.every(r => r.stateTax === 0)).toBe(true);
    // identical wealth: state tax changed nothing
    expect(tx.finalAfterTaxWealthBeneficiary).toBeCloseTo(none.finalAfterTaxWealthBeneficiary, 2);
  });

  it("an advisor-supplied state rate reduces after-tax wealth and shows per-year state tax", () => {
    const withState = projectLifetime({ ...base, stateCode: "CA", stateMarginalRate: 0.06,
      conversionByYear: Array.from({ length: 10 }, () => 60_000) });
    const noState = projectLifetime({ ...base,
      conversionByYear: Array.from({ length: 10 }, () => 60_000) });
    expect(withState.stateTaxRate).toBeCloseTo(0.06, 6);
    expect(withState.stateTaxModeled).toBe(true);
    // some year has positive state tax (there is ordinary income each year)
    expect(withState.rows.some(r => r.stateTax > 0)).toBe(true);
    // paying state tax leaves less wealth than paying none
    expect(withState.finalAfterTaxWealthBeneficiary)
      .toBeLessThan(noState.finalAfterTaxWealthBeneficiary);
  });
});

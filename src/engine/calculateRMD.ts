// RMD applicable age, Uniform Lifetime Table amount, and the first-dollars-out ordering rule.
// Phase 1 commit 1 (baseline): rmdApplicableAge reproduces the pre-fix projector, which applied
// age 73 to every household regardless of birth year. RMD-03 and RMD-04 fail here BY DESIGN;
// commit 2 fixes the birth-year rule. All constants come from the rules JSON (no magic numbers).
import federal from "../rules/federal/2026.json";
import type { RmdApplicableAgeResult, RmdAmountResult, RmdOrderingResult } from "./types";
import { NotImplementedError } from "./notImplemented";

const RMD = federal.rules.RMD_APPLICABLE_AGE;

export function rmdApplicableAge(_birthYear: number): RmdApplicableAgeResult {
  return { rmdApplicableAge: RMD.legacyApplicableAge, appliedRuleIds: [RMD.ruleId] };
}

export function rmdAmount(_priorYearEndBalance: number, _ageAtYearEnd: number): RmdAmountResult {
  throw new NotImplementedError("rmdAmount");
}

export function rmdOrdering(_args: {
  birthYear: number;
  taxYear: number;
  priorYearEndBalance: number;
  attemptedRothConversion: number;
}): RmdOrderingResult {
  throw new NotImplementedError("rmdOrdering");
}

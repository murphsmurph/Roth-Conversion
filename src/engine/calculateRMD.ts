// RMD applicable age, Uniform Lifetime Table amount, and the first-dollars-out ordering rule.
// Phase 1 commit 2 (the one allowed behavior change): rmdApplicableAge now derives the age per
// birth year per SECURE 2.0 sec. 107 and T.D. 10001 (born <=1950 -> 72, 1951-1959 -> 73,
// 1960+ -> 75), reading the bands from the rules JSON (no magic numbers). RMD-01..04 all pass.
import federal from "../rules/federal/2026.json";
import type { RmdApplicableAgeResult, RmdAmountResult, RmdOrderingResult } from "./types";
import { NotImplementedError } from "./notImplemented";

const RMD = federal.rules.RMD_APPLICABLE_AGE;

export function rmdApplicableAge(birthYear: number): RmdApplicableAgeResult {
  for (const band of RMD.byBirthYear) {
    if (band.maxBirthYear === null || birthYear <= band.maxBirthYear) {
      return { rmdApplicableAge: band.age, appliedRuleIds: [RMD.ruleId] };
    }
  }
  // The final band carries maxBirthYear=null and matches everyone, so this is unreachable.
  throw new Error("RMD applicable-age bands are not exhaustive (missing open-ended final band).");
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

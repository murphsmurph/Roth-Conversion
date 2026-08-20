// RMD applicable age, Uniform Lifetime Table amount, and the first-dollars-out ordering rule.
// Session 0: signatures only. The applicable-age fix (73 vs 75) lands in Phase 1 behind RMD-03.
import type { RmdApplicableAgeResult, RmdAmountResult, RmdOrderingResult } from "./types";
import { NotImplementedError } from "./notImplemented";

export function rmdApplicableAge(_birthYear: number): RmdApplicableAgeResult {
  throw new NotImplementedError("rmdApplicableAge");
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

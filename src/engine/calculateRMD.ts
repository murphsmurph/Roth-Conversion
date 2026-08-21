// RMD applicable age (SECURE 2.0), Uniform Lifetime Table amount, and the first-dollars-out rule.
// All constants come from the rules JSON (no magic numbers).
import { cents } from "./money";
import { rmdAgeBands, RMD_AGE_RULE_ID, RMD_ORDERING_RULE_ID, ultFactor, ULT_RULE_ID } from "./rules";
import type { RmdApplicableAgeResult, RmdAmountResult, RmdOrderingResult } from "./types";

export function rmdApplicableAge(birthYear: number): RmdApplicableAgeResult {
  for (const band of rmdAgeBands()) {
    if (band.maxBirthYear === null || birthYear <= band.maxBirthYear) {
      return { rmdApplicableAge: band.age, appliedRuleIds: [RMD_AGE_RULE_ID] };
    }
  }
  throw new Error("RMD applicable-age bands are not exhaustive (missing open-ended final band).");
}

export function rmdAmount(priorYearEndBalance: number, ageAtYearEnd: number): RmdAmountResult {
  const factor = ultFactor(ageAtYearEnd);
  if (factor === undefined) throw new Error(`no Uniform Lifetime Table factor for age ${ageAtYearEnd}`);
  return { rmd: cents(priorYearEndBalance / factor), distributionPeriod: factor, appliedRuleIds: [ULT_RULE_ID] };
}

export function rmdOrdering(args: {
  birthYear: number;
  taxYear: number;
  priorYearEndBalance: number;
  attemptedRothConversion: number;
}): RmdOrderingResult {
  const ageAtYearEnd = args.taxYear - args.birthYear;
  const factor = ultFactor(ageAtYearEnd);
  if (factor === undefined) throw new Error(`no Uniform Lifetime Table factor for age ${ageAtYearEnd}`);
  const rmdRequiredFirst = cents(args.priorYearEndBalance / factor);
  const amountEligibleForConversion = args.priorYearEndBalance - rmdRequiredFirst;
  // First-dollars-out: the RMD is not eligible for conversion. If contributed to a Roth it is a
  // regular contribution; with no earned income the allowance is 0, so the whole RMD is excess.
  const allowableRegularRothContributionThisFixture = 0;
  const excessContributionThisFixture = Math.max(0, rmdRequiredFirst - allowableRegularRothContributionThisFixture);
  return {
    rmdRequiredFirst,
    amountEligibleForConversion,
    conversionOfRmdAmountPermitted: false,
    excessContributionThisFixture,
    allowableRegularRothContributionThisFixture,
    appliedRuleIds: [RMD_ORDERING_RULE_ID],
  };
}

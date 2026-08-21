// ACA premium tax credit 400% FPL cliff — a first-class modeled cost (addendum §2.1).
// Under current law the enhanced subsidies expired 2025-12-31, so at MAGI_ACA <= 400.00% FPL the
// credit is available and one dollar above it drops the credit to $0. This is a true JUMP and
// reports the discontinuity rule id ACA_36B_400FPL_CLIFF.
import { ACA_CLIFF_RULE_ID, acaThresholdPercent, fplByHousehold } from "./rules";
import type { AcaResult, MagiAca } from "./types";

export function calculateAca(magiAca: MagiAca, householdSize: number): AcaResult {
  const fpl100 = fplByHousehold(householdSize);
  if (fpl100 === undefined) throw new Error(`ACA: no FPL guideline for household size ${householdSize}`);
  const magi = magiAca as number;
  const fpl400 = fpl100 * (acaThresholdPercent() / 100);
  const fplPercentage = (magi / fpl100) * 100;
  const eligible = magi <= fpl400;
  return {
    fpl100Percent: fpl100,
    fpl400Percent: fpl400,
    fplPercentage,
    premiumTaxCreditEligible: eligible,
    creditMultiplier: eligible ? 1 : 0,
    appliedRuleIds: [ACA_CLIFF_RULE_ID],
    discontinuityId: ACA_CLIFF_RULE_ID,
  };
}

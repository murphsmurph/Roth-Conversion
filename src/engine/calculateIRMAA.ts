// IRMAA surcharge — the annual Medicare Part B + Part D surcharge above the standard premium.
// Tiers use a 2-year MAGI lookback; magiMax is INCLUSIVE (income at exactly magiMax stays lower).
// The surcharge applies PER enrollee, not per household — a common doubling bug.
import { irmaaMonths, irmaaStandardPartB, irmaaTiers } from "./rules";
import { cents } from "./money";
import type { FilingStatus, IrmaaResult, MagiIrmaa } from "./types";

export function calculateIrmaa(magiIrmaa: MagiIrmaa, status: FilingStatus, enrolled: number): IrmaaResult {
  const tiers = irmaaTiers(status);
  const standardPartB = irmaaStandardPartB();
  const magi = magiIrmaa as number;
  for (let i = 0; i < tiers.length; i++) {
    const t = tiers[i]!;
    if (t.magiMax === null || magi <= t.magiMax) {
      const surchargeMonthlyPerPerson = (t.partBMonthly - standardPartB) + t.partDIrmaaMonthly;
      return {
        annualHouseholdSurchargeAboveStandard: cents(surchargeMonthlyPerPerson * irmaaMonths() * enrolled),
        tier: i,
        partBMonthly: t.partBMonthly,
        partDIrmaaMonthly: t.partDIrmaaMonthly,
        surchargeMonthlyPerPerson,
        enrolled,
        appliedRuleIds: [t.ruleId],
      };
    }
  }
  throw new Error("IRMAA tiers are not exhaustive (missing open-ended top tier).");
}

// Single-year federal calculation — the frozen R4 order of operations, made visible in the output.
// Independent reimplementation of the IRS worksheets; every constant comes from the rules JSON.
import { socialSecurityTaxable } from "./calculateSocialSecurity";
import { computeDeductions } from "./calculateDeductions";
import { qdcgWorksheet } from "./calculateTax";
import { niitTax } from "./calculateNIIT";
import { cents } from "./money";
import {
  calculationMetadata, NIIT_RULE_ID, ORDINARY_BRACKETS_RULE_ID, SENIOR_RULE_ID, SS_RULE_ID,
} from "./rules";
import type {
  MagiAca, MagiIrmaa, MagiNiit, MagiSenior, YearInput, YearResult,
} from "./types";

const n = (v: number | undefined): number => v ?? 0;

export function computeYear(input: YearInput): YearResult {
  const status = input.status;
  const ages = input.ages;

  // STEP 1 — gross income other than Social Security
  const wages = n(input.wages), interest = n(input.interest);
  const qualifiedDividends = n(input.qualifiedDividends);
  const ordinaryDividends = input.ordinaryDividends ?? qualifiedDividends;
  const netLtcg = n(input.netLtcg), iraDistributions = n(input.iraDistributions);
  const rothConversion = n(input.rothConversion), pension = n(input.pension);
  const otherOrdinary = n(input.otherOrdinary), adjustments = n(input.adjustments);
  const taxExemptInterest = n(input.taxExemptInterest), qbi = n(input.qbiDeduction);
  const grossSs = n(input.grossSocialSecurity);
  const itemized = input.itemizedDeductions;

  const otherIncome = wages + interest + ordinaryDividends + netLtcg + iraDistributions +
    rothConversion + pension + otherOrdinary;

  // STEP 2/3 — provisional income and taxable Social Security
  const ss = socialSecurityTaxable(grossSs, otherIncome, taxExemptInterest, adjustments, status);

  // STEP 4 — AGI
  const agi = otherIncome + ss.taxable - adjustments;

  // STEP 5 — the four MAGIs, computed separately and never interchanged
  const magi = {
    irmaa: (agi + taxExemptInterest) as MagiIrmaa,
    niit: agi as MagiNiit,
    aca: (agi + taxExemptInterest + (grossSs - ss.taxable)) as MagiAca,
    senior: agi as MagiSenior,
  };

  // STEP 6 — deductions (senior deduction phased on MAGI_SENIOR, below the line)
  const deductions = computeDeductions(status, ages, magi.senior as number, itemized, qbi);

  // STEP 7 — taxable income
  const taxableIncome = Math.max(0, agi - deductions.total);

  // STEP 8 — ordinary/preferential split + stacking
  const q = qdcgWorksheet(taxableIncome, qualifiedDividends, netLtcg, status);

  // STEP 9 — NIIT (conversion is not in the NII base)
  const nii = interest + ordinaryDividends + netLtcg;
  const niit = niitTax(magi.niit as number, nii, status);

  const totalFederalTax = cents(q.regularTax + niit);

  return {
    grossIncome: otherIncome + grossSs,
    provisionalIncome: ss.provisional,
    taxableSocialSecurity: ss.taxable,
    agi,
    magi,
    deductions,
    taxableIncome,
    ordinaryIncome: q.ordinaryTaxableIncome,
    preferential: { taxedAtZero: q.taxedAtZero, taxedAtFifteen: q.taxedAtFifteen, taxedAtTwenty: q.taxedAtTwenty },
    regularTax: cents(q.regularTax),
    niit,
    amt: 0,
    additionalMedicareTax: 0,
    stateTax: 0,
    totalFederalTax,
    acaCost: 0,
    irmaaFutureCost: 0,
    totalEconomicCost: totalFederalTax,
    appliedRuleIds: [SS_RULE_ID, ORDINARY_BRACKETS_RULE_ID, SENIOR_RULE_ID, NIIT_RULE_ID],
    ruleIds: {
      taxableSocialSecurity: SS_RULE_ID,
      regularTax: ORDINARY_BRACKETS_RULE_ID,
      seniorBonusDeduction: SENIOR_RULE_ID,
      niit: NIIT_RULE_ID,
    },
    calculationMetadata: calculationMetadata(input.taxYear, input.lawMode),
  };
}

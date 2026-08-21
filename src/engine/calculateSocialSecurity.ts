// Taxable Social Security — IRC 86 Social Security Benefits Worksheet, reproduced line-for-line.
// Depends on provisional income only (not on deductions), so there is no circularity in R4.
import { ssBase1, ssBase2Additional, ssLowerRate, ssMaxRate } from "./rules";
import type { FilingStatus } from "./types";

export interface SsResult {
  taxable: number;
  provisional: number;
}

export function socialSecurityTaxable(
  grossSocialSecurity: number,
  otherIncome: number,
  taxExemptInterest: number,
  adjustments: number,
  status: FilingStatus,
): SsResult {
  const half = ssLowerRate();
  const max = ssMaxRate();
  const halfBenefits = grossSocialSecurity * half;              // L2
  const combined = halfBenefits + otherIncome + taxExemptInterest; // L5
  const provisional = Math.max(0, combined - adjustments);      // L7
  if (provisional <= 0) return { taxable: 0, provisional };

  const over1 = Math.max(0, provisional - ssBase1(status));     // L9
  if (over1 <= 0) return { taxable: 0, provisional };

  const base2 = ssBase2Additional(status);
  const over2 = Math.max(0, over1 - base2);                     // L11
  const inLowerBand = Math.min(over1, base2);                   // L12
  const lowerHalf = inLowerBand * half;                         // L13
  const lowerInclusion = Math.min(halfBenefits, lowerHalf);     // L14
  const upperInclusion = over2 * max;                           // L15
  const taxable = Math.min(lowerInclusion + upperInclusion, grossSocialSecurity * max); // L18 vs L17
  return { taxable, provisional };
}

// Ordinary tax (progressive brackets) and the Qualified Dividends & Capital Gain Tax Worksheet.
// Ordinary income fills the brackets first; preferential income (QD + LTCG) STACKS on top at the
// 0/15/20% rates. Computing the two separately and adding them is wrong at the rate boundaries.
import { ordinaryBrackets, prefRates, prefThresholds } from "./rules";
import type { FilingStatus } from "./types";

export function ordinaryTax(taxableIncome: number, status: FilingStatus): number {
  const taxable = Math.max(0, taxableIncome);
  const bands = ordinaryBrackets(status); // [floor, rate], ascending
  let tax = 0;
  for (let i = 0; i < bands.length; i++) {
    const floor = bands[i]![0];
    const rate = bands[i]![1];
    const nextFloor = i + 1 < bands.length ? bands[i + 1]![0] : Infinity;
    if (taxable > floor) tax += (Math.min(taxable, nextFloor) - floor) * rate;
    else break;
  }
  return Math.max(0, tax);
}

export interface QdcgResult {
  regularTax: number;
  ordinaryTaxableIncome: number;
  taxedAtZero: number;
  taxedAtFifteen: number;
  taxedAtTwenty: number;
}

export function qdcgWorksheet(
  taxableIncome: number,
  qualifiedDividends: number,
  netLtcg: number,
  status: FilingStatus,
): QdcgResult {
  const th = prefThresholds(status);
  const rate = prefRates();
  const L1 = Math.max(0, taxableIncome);
  const L4 = qualifiedDividends + netLtcg;      // total preferential
  const L5 = Math.max(0, L1 - L4);              // ordinary taxable income
  const L6 = Math.min(L1, th.zeroRateTop);
  const L7 = Math.min(L5, L6);
  const L8 = L6 - L7;                           // taxed at 0%
  const L9 = Math.min(L1, L4);
  const L12 = Math.min(L1, th.fifteenRateTop);
  const L13 = L5 + L8;
  const L14 = Math.max(0, L12 - L13);
  const L15 = Math.min(L9 - L8, L14);           // taxed at 15%
  const L18 = L9 - (L8 + L15);                   // taxed at 20%
  const preferentialTax = L15 * rate.fifteen + L18 * rate.twenty;
  const viaWorksheet = preferentialTax + ordinaryTax(L5, status);
  const viaOrdinary = ordinaryTax(L1, status);
  return {
    regularTax: Math.min(viaWorksheet, viaOrdinary),
    ordinaryTaxableIncome: L5,
    taxedAtZero: L8,
    taxedAtFifteen: L15,
    taxedAtTwenty: L18,
  };
}

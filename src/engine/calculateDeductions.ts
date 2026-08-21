// Deductions: standard (+ age-65 add-on) or itemized, then the OBBBA senior bonus deduction.
// The senior deduction is computed on Schedule 1-A: ONE per-person phaseout amount (line 35) is
// entered on BOTH line 36a and 36b, so two qualifying spouses phase out at 12% combined.
// It is BELOW the line — it reduces taxable income only, never AGI or any MAGI.
import {
  additional65, seniorMinAge, seniorPerPerson, seniorPhaseoutRate, seniorPhaseoutStart, stdDeduction,
} from "./rules";
import type { Deductions, FilingStatus } from "./types";

export interface SeniorResult {
  total: number;
  schedule1a: Record<string, number | string>;
}

export function seniorDeduction(magiSenior: number, status: FilingStatus, nQualifying: number): SeniorResult {
  if (nQualifying === 0) return { total: 0, schedule1a: { note: "no qualifying individual" } };
  const perPerson = seniorPerPerson();                                   // line 33
  const excess = Math.max(0, magiSenior - seniorPhaseoutStart(status));  // line 34
  const perPersonAfter = Math.max(0, perPerson - excess * seniorPhaseoutRate()); // line 35
  const line36a = nQualifying >= 1 ? perPersonAfter : 0;
  const line36b = nQualifying >= 2 ? perPersonAfter : 0;
  const total = line36a + line36b;
  return { total, schedule1a: { "33": perPerson, "34": excess, "35": perPersonAfter, "36a": line36a, "36b": line36b, total } };
}

export function countAge65Plus(ages: number[]): number {
  const min = seniorMinAge();
  return ages.filter(a => a >= min).length;
}

export function computeDeductions(
  status: FilingStatus,
  ages: number[],
  magiSenior: number,
  itemizedDeductions: number | null | undefined,
  qbiDeduction: number,
): Deductions {
  const n65 = countAge65Plus(ages);
  let base: number;
  let kind: Deductions["kind"];
  if (itemizedDeductions == null) {
    base = stdDeduction(status) + additional65(status) * n65;
    kind = "standard";
  } else {
    base = itemizedDeductions;
    kind = "itemized";
  }
  const senior = seniorDeduction(magiSenior, status, n65).total;
  const total = base + senior + qbiDeduction;
  return { kind, base, nAge65Plus: n65, seniorBonusDeduction: senior, qbi: qbiDeduction, charitable: 0, total };
}

// Net Investment Income Tax — Form 8960 / IRC 1411. 3.8% on the LESSER of net investment income
// or (MAGI_NIIT - threshold). A Roth conversion is NOT net investment income (it does not enter
// the NII base) but it does raise MAGI and can therefore pull existing NII into the tax.
import { niitRate, niitThreshold } from "./rules";
import { cents } from "./money";
import type { FilingStatus } from "./types";

export function niitTax(magiNiit: number, netInvestmentIncome: number, status: FilingStatus): number {
  const excess = Math.max(0, magiNiit - niitThreshold(status));
  const base = Math.min(netInvestmentIncome, excess);
  return cents(base * niitRate());
}

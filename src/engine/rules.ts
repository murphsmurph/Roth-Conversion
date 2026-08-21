// Typed accessors over the versioned rules JSON. The engine reads EVERY tax constant from here
// (CLAUDE.md R3) — no inline numbers in the calculators. This module contains no numeric literals
// of its own beyond structural 0/1/100 used for lookups.
import federalRules from "../rules/federal/2026.json";
import medicareRules from "../rules/medicare/2026.json";
import acaRules from "../rules/aca/2026.json";
import type { CalculationMetadata, FilingStatus, LawMode } from "./types";

const F = federalRules.rules as Record<string, any>;

function pick<T>(obj: Record<string, unknown>, status: FilingStatus): T {
  const v = obj[status];
  if (v === undefined) throw new Error(`rules: no entry for filing status '${status}'`);
  return v as T;
}

// ---- deductions ----
export const stdDeduction = (s: FilingStatus): number => pick<number>(F.STD_DEDUCTION.values, s);
export const additional65 = (s: FilingStatus): number => pick<number>(F.ADDITIONAL_STD_DEDUCTION_AGE_65.values, s);

// ---- ordinary brackets: array of [floorTaxableIncome, marginalRate] ----
export const ordinaryBrackets = (s: FilingStatus): Array<[number, number]> =>
  pick<Array<[number, number]>>(F.ORDINARY_BRACKETS, s);
export const ORDINARY_BRACKETS_RULE_ID = "ORDINARY_BRACKETS_2026";

// ---- preferential (LTCG/QD) ----
export const prefThresholds = (s: FilingStatus): { zeroRateTop: number; fifteenRateTop: number } =>
  pick(F.PREFERENTIAL_RATE_THRESHOLDS, s);
export const prefRates = (): { zero: number; fifteen: number; twenty: number } =>
  F.PREFERENTIAL_RATE_THRESHOLDS.rates;
export const LTCG_RULE_ID = "LTCG_QD_STACKING_IRC_1H";

// ---- Social Security taxability (IRC 86) ----
export const ssBase1 = (s: FilingStatus): number => pick<number>(F.SOCIAL_SECURITY_TAXABILITY.base1, s);
export const ssBase2Additional = (s: FilingStatus): number =>
  pick<number>(F.SOCIAL_SECURITY_TAXABILITY.base2Additional, s);
export const ssLowerRate = (): number => F.SOCIAL_SECURITY_TAXABILITY.lowerInclusionRate;
export const ssMaxRate = (): number => F.SOCIAL_SECURITY_TAXABILITY.maxInclusionRate;
export const SS_RULE_ID = F.SOCIAL_SECURITY_TAXABILITY.ruleId as string;

// ---- NIIT ----
export const niitRate = (): number => F.NIIT.rate;
export const niitThreshold = (s: FilingStatus): number => pick<number>(F.NIIT.thresholds, s);
export const NIIT_RULE_ID = F.NIIT.ruleId as string;

// ---- senior bonus deduction ----
export const seniorPerPerson = (): number => F.SENIOR_BONUS_DEDUCTION.amountPerQualifyingIndividual;
export const seniorPhaseoutStart = (s: FilingStatus): number =>
  pick<number>(F.SENIOR_BONUS_DEDUCTION.phaseoutStartMagi, s);
export const seniorPhaseoutRate = (): number => F.SENIOR_BONUS_DEDUCTION.phaseoutRatePerQualifyingIndividual;
export const seniorMinAge = (): number => F.SENIOR_BONUS_DEDUCTION.minimumAge;
export const SENIOR_RULE_ID = F.SENIOR_BONUS_DEDUCTION.ruleId as string;

// ---- RMD ----
export const rmdAgeBands = (): Array<{ maxBirthYear: number | null; age: number }> => F.RMD_APPLICABLE_AGE.byBirthYear;
export const RMD_AGE_RULE_ID = F.RMD_APPLICABLE_AGE.ruleId as string;
export const ultFactor = (age: number): number | undefined =>
  (F.RMD_UNIFORM_LIFETIME_TABLE.distributionPeriodByAge as Record<string, number>)[String(age)];
export const ULT_RULE_ID = F.RMD_UNIFORM_LIFETIME_TABLE.ruleId as string;
export const RMD_ORDERING_RULE_ID = F.RMD_ORDERING.ruleId as string;

// ---- IRMAA (medicare) ----
export interface IrmaaTier { ruleId: string; magiMax: number | null; partBMonthly: number; partDIrmaaMonthly: number }
export const irmaaTiers = (s: FilingStatus): IrmaaTier[] =>
  pick<IrmaaTier[]>(medicareRules.tiers as unknown as Record<string, unknown>, s);
export const irmaaStandardPartB = (): number => medicareRules.standardPartBPremiumMonthly;
export const irmaaMonths = (): number => (medicareRules as { monthsPerYear: number }).monthsPerYear;

// ---- ACA ----
export const fplByHousehold = (n: number): number | undefined =>
  (acaRules.federalPovertyGuidelines2025 as unknown as Record<string, number>)[String(n)];
export const fplAdditionalPerPerson = (): number => acaRules.federalPovertyGuidelines2025.additionalPerPerson;
export const acaThresholdPercent = (): number => acaRules.subsidyCliff.thresholdPercentOfFpl;
export const ACA_CLIFF_RULE_ID = acaRules.subsidyCliff.ruleId as string;

// ---- provenance ----
export const ENGINE_VERSION = "0.2.0-phase2";
export function calculationMetadata(taxYear: number, lawMode: LawMode): CalculationMetadata {
  return {
    engineVersion: ENGINE_VERSION,
    federalRulesVersion: federalRules.ruleSetId,
    medicareRulesVersion: medicareRules.ruleSetId,
    acaRulesVersion: acaRules.ruleSetId,
    stateRulesVersion: "none-phase2",
    calculationDate: "injected",
    taxYear,
    lawMode,
  };
}

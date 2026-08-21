// Engine type surface (Session 0 — TYPES ONLY, no logic).
// Implements the branded MAGI types and the full order-of-operations output shape
// from CLAUDE-CODE-ADDENDUM.md R4a and R5. Every function body elsewhere stays
// unimplemented until its phase.

// ---------------------------------------------------------------------------
// Branded/nominal types — one MAGI can never be passed where another is expected.
// CLAUDE.md R4 / addendum R4a: the four MAGIs are computed separately and never aliased.
// ---------------------------------------------------------------------------
declare const __brand: unique symbol;
export type Brand<T, B extends string> = T & { readonly [__brand]: B };

export type MagiIrmaa = Brand<number, "MAGI_IRMAA">;
export type MagiNiit = Brand<number, "MAGI_NIIT">;
export type MagiAca = Brand<number, "MAGI_ACA">;
export type MagiSenior = Brand<number, "MAGI_SENIOR">;

export type FilingStatus = "single" | "mfj" | "hoh" | "mfs";
export type LawMode = "current_law" | "alternative_law";
export type DeductionKind = "standard" | "itemized";

// ---------------------------------------------------------------------------
// Engine input — one plain object (R1). Dates/tax year injected, never read from Date.now().
// Field set mirrors the independent oracle's compute_year signature so fixtures map 1:1.
// ---------------------------------------------------------------------------
export interface YearInput {
  taxYear: number;
  lawMode: LawMode;
  status: FilingStatus;
  /** Ages at year end, one entry per filer. */
  ages: number[];
  grossSocialSecurity?: number;
  wages?: number;
  interest?: number;
  taxExemptInterest?: number;
  qualifiedDividends?: number;
  ordinaryDividends?: number;
  netLtcg?: number;
  iraDistributions?: number;
  rothConversion?: number;
  pension?: number;
  otherOrdinary?: number;
  adjustments?: number;
  itemizedDeductions?: number | null;
  qbiDeduction?: number;
}

// ---------------------------------------------------------------------------
// Provenance (R5) — every output carries calculation metadata; every major line a rule ID.
// ---------------------------------------------------------------------------
export interface CalculationMetadata {
  engineVersion: string;
  federalRulesVersion: string;
  medicareRulesVersion: string;
  acaRulesVersion: string;
  stateRulesVersion: string;
  calculationDate: string;
  taxYear: number;
  lawMode: LawMode;
}

export interface MagiBundle {
  irmaa: MagiIrmaa;
  niit: MagiNiit;
  aca: MagiAca;
  senior: MagiSenior;
}

export interface Deductions {
  kind: DeductionKind;
  base: number;
  nAge65Plus: number;
  seniorBonusDeduction: number;
  qbi: number;
  charitable: number;
  total: number;
}

export interface PreferentialBreakdown {
  taxedAtZero: number;
  taxedAtFifteen: number;
  taxedAtTwenty: number;
}

// ---------------------------------------------------------------------------
// R4a — the frozen order of operations, made VISIBLE in the return object.
// Every fixture asserts intermediate values, so each is exposed here.
// ---------------------------------------------------------------------------
export interface YearResult {
  grossIncome: number;
  provisionalIncome: number;
  taxableSocialSecurity: number;
  agi: number;
  magi: MagiBundle;
  deductions: Deductions;
  taxableIncome: number;
  ordinaryIncome: number;
  preferential: PreferentialBreakdown;
  regularTax: number;
  niit: number;
  amt: number;
  additionalMedicareTax: number;
  stateTax: number;
  totalFederalTax: number;
  acaCost: number;
  irmaaFutureCost: number;
  totalEconomicCost: number;
  /** Every emitted discontinuity's rule ID (must resolve in the registry). */
  appliedRuleIds: string[];
  /** Per-line rule IDs — how the UI answers "why is this number $X?" without AI. */
  ruleIds: Record<string, string>;
  calculationMetadata: CalculationMetadata;
}

// ---------------------------------------------------------------------------
// Sub-results for the RMD / IRMAA / ACA fixture families (not full-year returns).
// ---------------------------------------------------------------------------
export interface RmdApplicableAgeResult {
  rmdApplicableAge: number;
  appliedRuleIds: string[];
}

export interface RmdAmountResult {
  rmd: number;
  distributionPeriod: number;
  appliedRuleIds: string[];
}

export interface RmdOrderingResult {
  rmdRequiredFirst: number;
  amountEligibleForConversion: number;
  conversionOfRmdAmountPermitted: boolean;
  excessContributionThisFixture: number;
  allowableRegularRothContributionThisFixture: number;
  appliedRuleIds: string[];
}

export interface IrmaaResult {
  annualHouseholdSurchargeAboveStandard: number;
  tier: number;
  partBMonthly: number;
  partDIrmaaMonthly: number;
  surchargeMonthlyPerPerson: number;
  enrolled: number;
  appliedRuleIds: string[];
}

export interface AcaResult {
  fpl100Percent: number;
  fpl400Percent: number;
  fplPercentage: number;
  premiumTaxCreditEligible: boolean;
  creditMultiplier: number;
  appliedRuleIds: string[];
  discontinuityId?: string;
}

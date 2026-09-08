/**
 * Inheritance calculations (Track B, session B1a). Pure, I/O-free, cites its authority inline.
 * MAY compute: the statutory dates and section-1014 holding-period treatment. MAY NOT compute any
 * taxable amount, depreciation recapture, basis allocation, trust DNI, or whether an asset IS IRD —
 * those are flags for the CPA (INHERITANCE-MODULE-SPEC.md §9). Never imports src/rules or the engine.
 */
import type { StepUpRegime } from "./types";

// IRC 1014(c): §1014 does not apply to income in respect of a decedent — inherited pre-tax
// retirement money and accrued compensation get NO basis adjustment.
const IRD_ASSET_TYPES = new Set([
  "traditional_ira", "inherited_traditional_ira", "sep_ira", "simple_ira",
  "employer_401k", "401k", "roth_401k", "employer_403b", "403b", "governmental_457b",
  "annuity_ird", "accrued_compensation", "savings_bond_accrued_interest",
]);
// Assets that receive a §1014 basis adjustment at death.
const STEP_UP_ASSET_TYPES = new Set([
  "land", "publicly_traded_stock", "taxable_brokerage", "brokerage", "rental_property",
  "real_property", "real_estate", "private_business", "collectible", "cash",
]);

export function regimeForAsset(assetType: string): StepUpRegime {
  if (IRD_ASSET_TYPES.has(assetType)) return "ird_no_stepup";
  if (STEP_UP_ASSET_TYPES.has(assetType)) return "section_1014";
  return "unknown";
}

// IRC 1014(b)(6) mandatory community-property jurisdictions (both halves step up).
export const MANDATORY_CP = new Set(["AZ", "CA", "ID", "LA", "NV", "NM", "TX", "WA", "WI", "PR", "GU"]);
// Elective community-property-trust states — IRS position UNSETTLED; do not model (Pub 555 / IRM 25.18.1).
export const ELECTIVE_CP = new Set(["AK", "SD", "TN", "FL", "KY"]);
// State inheritance tax as of 2026 (Iowa repealed for deaths on/after 2025-01-01).
export const STATE_INHERITANCE_TAX = new Set(["KY", "MD", "NE", "NJ", "PA"]);

/**
 * Compressed trust brackets, tax year 2026. Mirrors src/rules/federal/estates-trusts-2026.json
 * (37% over $16,000), cross-verified against Rev. Proc. 2025-32 on 2026-09-08. Duplicated here as a
 * NAMED, cited constant only because (a) the packet layer must not import src/rules (guard) and
 * (b) session B1a is read-only over the engine, so no rules.ts accessor may be added yet. The
 * module only NAMES this threshold for a flag observation; it never computes the trust's tax.
 * Follow-up: expose via a validated-engine accessor and delete this duplicate.
 */
export const TRUST_TOP_BRACKET_2026 = 16000;
export const TRUST_TOP_RATE = 0.37;

const pad = (n: number): string => String(n).padStart(2, "0");
const iso = (d: Date): string => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const parts = (s: string): [number, number, number] =>
  [Number(s.slice(0, 4)), Number(s.slice(5, 7)), Number(s.slice(8, 10))];

/** IRC 2032 default alternate valuation date: six months after death. */
export function alternateValuationDefault(dateOfDeath: string | null): string | null {
  if (!dateOfDeath) return null;
  const [y, m, d] = parts(dateOfDeath);
  return iso(new Date(Date.UTC(y, m - 1 + 6, d)));
}

/** Heir's holding period / depreciation clock begins the day AFTER death (Reg. 1.1250-3(b)). */
export function dayAfter(date: string | null): string | null {
  if (!date) return null;
  const [y, m, d] = parts(date);
  return iso(new Date(Date.UTC(y, m - 1, d + 1)));
}

export type YearOfDeathRmdStatus =
  | "satisfied" | "partially_satisfied" | "not_satisfied" | "not_applicable" | "unknown";

/**
 * Year-of-death RMD status. GATED by RBD: no year-of-death RMD exists unless the owner died on or
 * after the required beginning date (Reg. 1.401(a)(9)-5(e)). Returns not_applicable when it doesn't.
 */
export function yearOfDeathRmdStatus(
  rbdStatus: string,
  amountRequired: number | null,
  amountTakenBeforeDeath: number | null,
  beneficiaryCompleted: boolean | null,
): { required: boolean; status: YearOfDeathRmdStatus; amountRemaining: number | null } {
  if (rbdStatus === "before_required_beginning_date")
    return { required: false, status: "not_applicable", amountRemaining: null };
  if (rbdStatus !== "after_required_beginning_date")
    return { required: false, status: "unknown", amountRemaining: null };
  if (amountRequired === null) return { required: true, status: "unknown", amountRemaining: null };
  const taken = amountTakenBeforeDeath ?? 0;
  const remaining = Math.max(0, amountRequired - taken);
  if (remaining === 0 || beneficiaryCompleted === true)
    return { required: true, status: "satisfied", amountRemaining: remaining };
  if (taken > 0) return { required: true, status: "partially_satisfied", amountRemaining: remaining };
  return { required: true, status: "not_satisfied", amountRemaining: remaining };
}

/** Dec 31 of the year of death — the statutory year-of-death RMD deadline. */
export function endOfDeathYear(dateOfDeath: string | null): string | null {
  if (!dateOfDeath) return null;
  return `${dateOfDeath.slice(0, 4)}-12-31`;
}

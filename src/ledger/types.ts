/**
 * CPA TAX COORDINATION PACKET — ledger + value-state + provenance types (Track B, session B0).
 *
 * Split from cpa-packet/types/packet-types.ts (everything ABOVE the "split here" marker).
 * Pure types only — no I/O, no imports from src/rules or the legacy engine.
 *
 * Design intent: make the failure modes in cpa-packet/CPA-PACKET-SPEC.md UNREPRESENTABLE:
 *   - a value cannot be "0" without declaring whether that 0 is knowledge or absence
 *   - a figure cannot exist without provenance
 *   - basis cannot be held at the household level
 */

// ============================================================================
// VALUE STATES  (spec section 6)
// ============================================================================

/**
 * A verified 0 and an unknown are DIFFERENT DOCUMENTS to a CPA.
 * The union makes it impossible to write `amount: 0` and mean "we didn't look".
 */
export type Sourced<T> =
  | { state: 'verified';       value: T;    provenance: Provenance }
  | { state: 'unknown';        value: null; provenance?: Provenance; reason?: string }
  | { state: 'not_applicable'; value: null }
  | { state: 'suppressed';     value: T;    provenance: Provenance; suppressedBy: string; suppressedReason: string }

export const isPresent = <T>(s: Sourced<T>): s is Extract<Sourced<T>, { state: 'verified' }> =>
  s.state === 'verified'

/** Renders as an em dash, never as zero. Enforced in the renderer. */
export const isUnknown = <T>(s: Sourced<T>): boolean => s.state === 'unknown'

// ============================================================================
// PROVENANCE  (spec section 5)
// ============================================================================

export type SourceType =
  | 'custodian_verified'
  | 'advisor_entered'
  | 'client_reported'
  | 'prior_tax_return'
  | 'cpa_provided'
  | 'calculated'
  | 'estimated'

/**
 * Corrected 1099s are routine. A January number and a final-form number are both
 * "custodian verified" and are frequently different. Spec section 5.2.
 */
export type DocumentStatus = 'preliminary' | 'tax_form_issued' | 'corrected_form_issued'

export interface Provenance {
  sourceType: SourceType
  /** REQUIRED when sourceType === 'custodian_verified'. Enforced by isValidProvenance(). */
  documentStatus?: DocumentStatus
  /** The date the underlying data was true as of — not the date it was typed. */
  asOfDate: string            // ISO 8601
  sourceDocument?: string     // "2026 Form 1099-B, Account ...4471"
  sourceAccount?: AccountId
  sourceDate?: string
  enteredBy?: string
  verifiedDate?: string
  notes?: string
  /** Set ONLY when sourceType === 'calculated'. Spec section 11. */
  ruleId?: string
  rulesVersion?: string
  engineVersion?: string
}

export function isValidProvenance(p: Provenance): true | string {
  if (p.sourceType === 'custodian_verified' && !p.documentStatus)
    return 'custodian_verified requires documentStatus (preliminary | tax_form_issued | corrected_form_issued)'
  if (p.sourceType === 'calculated' && !(p.ruleId && p.rulesVersion && p.engineVersion))
    return 'calculated requires ruleId, rulesVersion and engineVersion'
  if (p.sourceType !== 'calculated' && p.ruleId)
    return 'ruleId is only meaningful on calculated figures'
  return true
}

export const PROVENANCE_LABEL: Record<SourceType, string> = {
  custodian_verified: 'Custodian Verified',
  advisor_entered:    'Advisor Entered',
  client_reported:    'Client Reported',
  prior_tax_return:   'Prior Tax Return',
  cpa_provided:       'CPA Provided',
  calculated:         'Calculated',
  estimated:          'Estimated',
}

// ============================================================================
// PEOPLE AND ACCOUNTS
// ============================================================================

export type PersonId = string & { readonly __brand: 'PersonId' }
export type AccountId = string & { readonly __brand: 'AccountId' }

export interface Person {
  id: PersonId
  displayName: string
  dateOfBirth: string
  /** Form 8606 basis is PER PERSON and never aggregated. Master Spec section 6. */
  form8606: {
    priorNondeductibleBasis: Sourced<number>
    currentYearNondeductibleContribution: Sourced<number>
    yearEndAggregateTradSepSimpleValue: Sourced<number>
  }
}

export type AccountTaxType =
  | 'taxable_brokerage' | 'cash'
  | 'traditional_ira' | 'sep_ira' | 'simple_ira' | 'inherited_traditional_ira'
  | 'roth_ira' | 'inherited_roth_ira'
  | 'employer_401k' | 'employer_403b' | 'governmental_457b' | 'roth_401k'
  | 'hsa' | 'annuity' | 'pension' | 'coverdell' | 'plan_529' | 'trust' | 'other'

export interface Account {
  id: AccountId
  displayName: string
  registration: string
  taxType: AccountTaxType
  /** Exactly one owner. Joint registrations carry a primary owner plus jointWith. */
  ownerId: PersonId
  jointWithId?: PersonId
  subjectToRmd: boolean
}

// ============================================================================
// THE LEDGER  (spec section 4) — one row, many pages
// ============================================================================

export type LedgerKind =
  | 'interest' | 'dividend' | 'capital_gain_distribution' | 'return_of_capital'
  | 'realized_disposition'
  | 'distribution' | 'conversion' | 'rollover' | 'contribution'
  | 'withholding' | 'estimated_tax_payment'
  | 'charitable_transfer'
  | 'fee' | 'margin_interest'
  | 'plan529_contribution' | 'plan529_distribution' | 'plan529_rollover'

/**
 * Tags are how one row reaches several pages WITHOUT being entered twice.
 * A QCD is ONE row tagged ['charitable','rmd_satisfying'].
 * Cross-references (spec section 7) are computed from these — never typed by a human.
 */
export type LedgerTag =
  | 'charitable' | 'qcd' | 'rmd_satisfying' | 'roth_conversion'
  | 'appreciated_security_gift' | 'daf'
  | 'noncovered' | 'missing_basis' | 'wash_sale'
  | 'equity_compensation' | 'inherited' | 'gifted'
  | 'held_away'

export interface LedgerEntry {
  id: string
  taxYear: number
  accountId: AccountId
  kind: LedgerKind
  tags: LedgerTag[]
  date: string
  amount: Sourced<number>
  description: string
  provenance: Provenance
  /** Corrections APPEND. Rows are never mutated. */
  supersedesId?: string
  /** Import idempotency key: sourceDocument|sourceAccount|date|amount|kind */
  dedupeKey: string
  detail?: DispositionDetail | DistributionDetail | CharitableDetail | Plan529Detail | FeeDetail
}

export interface DispositionDetail {
  security: string
  shares: Sourced<number>
  proceeds: Sourced<number>
  costBasis: Sourced<number>          // 'unknown' here is the point — never infer
  acquisitionDate: Sourced<string>
  holdingPeriod: 'short' | 'long' | 'unknown'
  covered: Sourced<boolean>
  washSaleAdjustment: Sourced<number>
}

export interface DistributionDetail {
  grossAmount: Sourced<number>
  federalWithholding: Sourced<number>
  stateWithholding: Sourced<number>
  netToClient: Sourced<number>
  /**
   * NOT inferred from the payee. An IRA check to a charity is only a QCD when the
   * advisor explicitly classifies it. Spec: "do not assume every IRA charitable
   * payment is a valid QCD."
   */
  qcdClassification: 'confirmed_qcd' | 'not_qcd' | 'unclassified'
}

export interface CharitableDetail {
  charityName: string
  giftType: 'cash' | 'appreciated_security' | 'daf' | 'qcd' | 'other_noncash'
  fairMarketValue: Sourced<number>
  costBasis: Sourced<number>
  checkOrReference?: string
  cleared: Sourced<boolean>
}

export interface Plan529Detail {
  beneficiaryName: string
  plan: string
  planState: string
  contributorName?: string
  earningsPortion: Sourced<number>
  basisPortion: Sourced<number>
  qualifiedExpensesReportedByClient: Sourced<number>
  rollover?: {
    kind: '529_to_529' | '529_to_roth' | 'beneficiary_change' | 'recontribution'
    accountOpenedDate: Sourced<string>
    receivingRothAccountId?: AccountId
    lifetimeRolledToRoth: Sourced<number>
  }
}

export interface FeeDetail {
  /** Never combined. Tax treatment differs. Spec section 9 / requirements Page 9. */
  category: 'advisory_program' | 'custodial' | 'planning' | 'other_account' | 'margin_interest'
  paymentSource: 'taxable_account' | 'traditional_ira' | 'roth_ira' | 'external' | 'unknown'
}

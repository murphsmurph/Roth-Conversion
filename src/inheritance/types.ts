/**
 * INHERITANCE & BENEFICIARY ASSETS — types.
 * Installed at src/inheritance/types.ts (Track B, session B1a). Imports from ../ledger/types.
 *
 * The central design decision: BasisModel is a DISCRIMINATED UNION on step-up eligibility,
 * so that copying a date-of-death value into tax basis on an IRD asset is a COMPILE ERROR
 * rather than a bug someone has to notice in review.
 *
 * Every rule cited below was verified against the Code and the regs on 2026-08-21.
 */

import type { Sourced, PersonId, AccountId } from '../ledger/types'

// ============================================================================
// PROVENANCE — inheritance adds five source types
// ============================================================================

export type InheritanceSourceType =
  | 'custodian_verified' | 'advisor_entered' | 'client_reported'
  | 'estate_document' | 'trust_document' | 'appraisal'
  | 'prior_tax_return' | 'cpa_provided' | 'attorney_provided'
  | 'calculated' | 'estimated' | 'unknown'

// ============================================================================
// THE BASIS MODEL — the load-bearing type in this module
// ============================================================================

export type StepUpRegime = 'section_1014' | 'ird_no_stepup' | 'unknown'

export type BasisStatus =
  | 'verified' | 'provided_by_cpa' | 'provided_by_attorney' | 'provided_by_custodian'
  | 'estimated' | 'unknown' | 'not_applicable'

export type AppraisalStatus = 'not_needed' | 'obtained' | 'pending' | 'recommended' | 'unknown'

/**
 * IRC 1014(c): section 1014 does NOT apply to property constituting income in respect of a
 * decedent. An inherited traditional IRA / 401(k) / 403(b) / accrued compensation receives NO
 * basis adjustment. Note there is no `taxBasis` on the IRD branch — that absence is the point.
 */
export type BasisModel =
  | {
      stepUpRegime: 'section_1014'
      dateOfDeathFMV: Sourced<number>
      /** NEVER auto-populated from dateOfDeathFMV. Separate field, separate provenance. */
      taxBasis: Sourced<number>
      basisStatus: BasisStatus
      appraisalStatus: AppraisalStatus
      /** IRC 1014(b)(6). Nine mandatory states + PR/Guam. Elective regimes are unsettled. */
      communityPropertyTreatment: CommunityPropertyTreatment
      /** IRC 1014(f)/6035: cap applies only where inclusion increased the estate tax liability. */
      basisConsistencyCapApplies: Sourced<boolean>
      form8971ScheduleAReceived: DocumentStatus
    }
  | {
      stepUpRegime: 'ird_no_stepup'
      /** A reporting and estate-valuation figure. NOT basis. Cannot become basis. */
      valueAtDeath: Sourced<number>
      /** The decedent's remaining Form 8606 after-tax basis, if any. Usually zero. */
      decedentAfterTaxBasis: Sourced<number>
      /** IRC 691(c): deduction for federal estate tax attributable to the IRD. Rare, valuable. */
      section691cDeductionAvailable: Sourced<boolean>
      federalEstateTaxPaidOnIRD: Sourced<number>
    }
  | {
      stepUpRegime: 'unknown'
      valueAtDeath: Sourced<number>
    }

/** IRC 1014(b)(6). AZ CA ID LA NV NM TX WA WI + PR + Guam are mandatory. */
export type CommunityPropertyTreatment =
  | 'full_double_stepup'
  | 'half_stepup'
  /** AK, SD, TN, FL, KY opt-in trusts. IRS has no published position. DO NOT MODEL. */
  | 'elective_regime_unsettled'
  | 'not_community_property'
  | 'unknown'

export const MANDATORY_COMMUNITY_PROPERTY_JURISDICTIONS =
  ['AZ', 'CA', 'ID', 'LA', 'NV', 'NM', 'TX', 'WA', 'WI', 'PR', 'GU'] as const

export const ELECTIVE_CP_TRUST_STATES_UNSETTLED = ['AK', 'SD', 'TN', 'FL', 'KY'] as const

// ============================================================================
// ESTATE-LEVEL FACTS — AVD is an estate election, never a per-asset field
// ============================================================================

/**
 * IRC 2032. Elected on Form 706, IRREVOCABLE, ALL-OR-NOTHING for the entire estate, and
 * allowed only if it decreases BOTH the gross estate AND the sum of estate + GST tax.
 * With a $15,000,000 exclusion for 2026 decedents, almost no estate files a 706 at all.
 */
export interface EstateContext {
  estateOrTrustName?: string
  estateEIN_masked?: string
  executorOrTrustee?: string
  decedentName: string
  /** THE load-bearing field. RBD status, 10-year date, valuation and holding period all key off it. */
  dateOfDeath: Sourced<string>
  decedentDomicileState: Sourced<string>
  form706Filed: Sourced<boolean>
  alternateValuation?: {
    elected: Sourced<boolean>
    /** Six months after death, or date of disposition if the asset was disposed of earlier. */
    defaultValuationDate: string
    electionDecreasesGrossEstateAndTax: Sourced<boolean>
    scope: 'entire_estate'
    irrevocable: true
  }
  /** Five states as of 2026: KY, MD, NE, NJ, PA. Iowa repealed for deaths on/after 2025-01-01. */
  stateInheritanceTaxPossible: Sourced<boolean>
}

export const STATE_INHERITANCE_TAX_STATES_2026 = ['KY', 'MD', 'NE', 'NJ', 'PA'] as const

// ============================================================================
// INHERITED RETIREMENT ACCOUNTS
// ============================================================================

export type BeneficiaryClassification =
  | 'spouse' | 'eligible_designated_beneficiary' | 'noneligible_designated_beneficiary'
  | 'non_designated_beneficiary' | 'estate' | 'trust' | 'unknown'

export type EdbSubtype =
  | 'surviving_spouse' | 'minor_child_of_owner' | 'disabled' | 'chronically_ill'
  | 'not_more_than_10_years_younger' | 'unknown'

export type RbdStatus =
  | 'before_required_beginning_date' | 'after_required_beginning_date'
  | 'unknown' | 'not_applicable'

/** SECURE 2.0 sec. 327 / Reg. 1.401(a)(9)-3(d). Effective for 2024+ RMD years. */
export type SpousalElection =
  | 'treat_as_own' | 'rollover' | 'remain_beneficiary'
  | 'section_327_treated_as_decedent' | 'not_yet_elected' | 'unknown'

/** An accumulation trust hits 37% at roughly $16,000 of retained taxable income. */
export type TrustType =
  | 'conduit' | 'accumulation' | 'see_through_undetermined' | 'non_see_through' | 'unknown'

export interface InheritedRetirementAccount {
  accountId: AccountId
  decedentName: string
  dateOfDeath: Sourced<string>
  beneficiaryId: PersonId
  beneficiaryRelationship: string
  beneficiaryClassification: Sourced<BeneficiaryClassification>
  edbSubtype?: Sourced<EdbSubtype>
  trustType?: Sourced<TrustType>
  spousalElection?: Sourced<SpousalElection>
  decedentRBDStatus: Sourced<RbdStatus>

  /** Absent entirely from the source requirements. Changes the whole schedule. */
  isSuccessorBeneficiary: Sourced<boolean>
  originalDecedentName?: Sourced<string>
  originalDateOfDeath?: Sourced<string>
  originalBeneficiaryRegime?: Sourced<string>

  accountValueAtDeath: Sourced<number>
  priorYearEndBalance: Sourced<number>

  /** Two distinct, sequential, commonly-blown deadlines. */
  multipleBeneficiaries: Sourced<boolean>
  separateAccountsEstablished: Sourced<boolean>

  /**
   * COMPUTED, with citations. Null whenever the inputs are unknown — never defaulted.
   * See computeTenYearEndDate below.
   */
  computed: {
    tenYearRuleEndDate: string | null
    minorChildFinalDistributionDeadline: string | null
    septemberThirtyDeterminationDate: string | null
    separateAccountDeadline: string | null
    annualRmdsRequiredDuringWindow: boolean | null
    scheduleDeterminable: boolean
    ruleIds: string[]
  }

  yearOfDeathRmd: YearOfDeathRmd
}

/** No year-of-death RMD exists unless the owner died ON OR AFTER the RBD. */
export interface YearOfDeathRmd {
  required: Sourced<boolean>
  amountRequired: Sourced<number>
  amountTakenBeforeDeath: Sourced<number>
  amountRemaining: Sourced<number>
  beneficiaryCompletedRemainingRmd: Sourced<boolean>
  status: 'satisfied' | 'partially_satisfied' | 'not_satisfied' | 'unknown' | 'not_applicable'
  /** Reg. 54.4974-1(g)(3) waives the excise tax automatically. No Form 5329 request needed. */
  automaticExciseWaiverAvailable: true
}

// ============================================================================
// COMPUTED DATES — implement these, they are clean and citable
// ============================================================================

/** Reg. 1.401(a)(9)-5(e)(2): Dec 31 of the 10th calendar year FOLLOWING the year of death. */
export function computeTenYearEndDate(dateOfDeath: string | null): string | null {
  if (!dateOfDeath) return null
  return `${Number(dateOfDeath.slice(0, 4)) + 10}-12-31`
}

/** Reg. 1.401(a)(9)-5(e)(4): child of the OWNER only. Payout by Dec 31 of the year they turn 31. */
export function computeMinorChildDeadline(beneficiaryDob: string | null): string | null {
  if (!beneficiaryDob) return null
  return `${Number(beneficiaryDob.slice(0, 4)) + 31}-12-31`
}

/** Reg. 1.401(a)(9)-4: designated-beneficiary determination date. */
export function computeSeptemberThirtyDate(dateOfDeath: string | null): string | null {
  if (!dateOfDeath) return null
  return `${Number(dateOfDeath.slice(0, 4)) + 1}-09-30`
}

/** Reg. 1.401(a)(9)-8: separate-accounting deadline. */
export function computeSeparateAccountDeadline(dateOfDeath: string | null): string | null {
  if (!dateOfDeath) return null
  return `${Number(dateOfDeath.slice(0, 4)) + 1}-12-31`
}

/**
 * IRC 1223(9) is a RESCUE provision: it requires (a) basis determined under section 1014 and
 * (b) disposition within one year of death. Beyond a year the period is long naturally.
 * It cannot reach IRD, because 1014(c) means 1014 never applied.
 */
export function holdingPeriodTreatment(
  regime: StepUpRegime,
): 'long_term' | 'ordinary_income' | 'unknown' {
  if (regime === 'ird_no_stepup') return 'ordinary_income'
  if (regime === 'section_1014') return 'long_term'
  return 'unknown'
}

// ============================================================================
// SUBSEQUENT ACTIVITY + DOCUMENTS
// ============================================================================

export type SubsequentDisposition =
  | 'retained' | 'sold' | 'partially_sold' | 'distributed' | 'rolled_over' | 'converted'
  | 'gifted' | 'donated_to_charity' | 'retitled' | 'transferred' | 'unknown'

export type DocumentStatus = 'expected' | 'received' | 'not_expected' | 'unknown'

export type ExpectedDocument =
  | '1099-R' | '1099-B' | '1099-DIV' | '1099-INT' | '1099-S' | '1099-Q' | '1099-SA'
  | 'K-1' | '5498' | '5498-SA'
  /** Added — missing from the source requirements. */
  | 'Form 706' | 'Form 8971 Schedule A' | 'Form 1041'
  | 'estate_appraisal' | 'closing_statement' | 'trust_statement' | 'estate_accounting' | 'other'

// ============================================================================
// THE RECORD
// ============================================================================

export type InheritanceMethod =
  | 'beneficiary_designation' | 'probate_estate' | 'trust_distribution' | 'joint_ownership'
  | 'transfer_on_death' | 'payable_on_death' | 'life_insurance' | 'other' | 'unknown'

export interface InheritanceRecord {
  inheritanceId: string
  taxYear: number
  beneficiaryId: PersonId
  estate: EstateContext
  relationshipToClient: string
  inheritanceMethod: Sourced<InheritanceMethod>
  dateReceived: Sourced<string>

  assetType: string                 // extensible; never force an asset into a wrong category
  assetDescription: string
  ownershipPercentage: Sourced<number>
  accountNumberMasked?: string      // masked only. never full.
  custodian?: string
  propertyLocationGeneral?: string  // county/state. never a street address.

  basis: BasisModel

  /** Advisor/CPA judgement, never inferred from asset category. */
  possibleIRD: Sourced<boolean>

  /** Distributions and sales live in the LEDGER, reached by accountId. Never duplicated here. */
  accountId?: AccountId

  subsequentDisposition: Sourced<SubsequentDisposition>
  expectedDocuments: Partial<Record<ExpectedDocument, DocumentStatus>>
  notes?: string
}

export type InheritanceCaseStatus =
  | 'complete' | 'partial' | 'missing_documents' | 'basis_missing' | 'valuation_missing'
  | 'cpa_review_required' | 'attorney_review_required'

/**
 * Gross nominal value only. Never presented as after-tax value — same rule as Master Spec
 * section 19. Split by step-up regime so a pre-tax IRA is not silently added to stepped-up land.
 */
export interface InheritanceSummary {
  decedentName: string
  dateOfDeath: Sourced<string>
  grossNominalValue: Sourced<number>
  ofWhichIRD_noStepUp: Sourced<number>
  ofWhichSection1014StepUp: Sourced<number>
  ofWhichRegimeUnknown: Sourced<number>
  disclaimer: 'Gross nominal value is informational. It is not an estate-tax value, not a tax basis, and not an after-tax value.'
  caseStatus: InheritanceCaseStatus
}

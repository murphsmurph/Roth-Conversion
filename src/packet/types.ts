/**
 * CPA TAX COORDINATION PACKET — packet types (Track B, session B0).
 *
 * Split from cpa-packet/types/packet-types.ts (everything BELOW the "split here" marker),
 * plus the OutputMode from spec section 2.
 *
 * Standing rule (CLAUDE.md 8.5): src/packet/** never imports src/rules/** or the legacy engine.
 * It may import src/ledger/** (below) and, later, the VALIDATED engine's output shape only.
 */
import type {
  Sourced, AccountId, Person, Account, LedgerEntry,
} from "../ledger/types";

// ============================================================================
// OUTPUT MODE  (spec section 2) — educational by default
// ============================================================================

/**
 * educational (default): every page carries a light footer, no attestation.
 * client_delivery: pages carry a DRAFT watermark until an approval record exists.
 * There is NO advisorName / firmName anywhere in the model — omitting them is a schema
 * decision, not a rendering choice, so branding cannot be added by editing a template.
 */
export type OutputMode = 'educational' | 'client_delivery'

// ============================================================================
// COMPLIANCE GATE  (spec section 2)
// ============================================================================

export interface ComplianceConfig {
  mode: OutputMode
  /** While false in client_delivery, EVERY page carries the DRAFT watermark. Do not flip to see the layout. */
  approvedForClientUse: boolean
  approvedBy?: string
  approvedDate?: string
  approvalReference?: string   // firm review ticket / principal approval id
}

export interface AuditRecord {
  reportId: string             // TCR-2026-{clientId}-v{n}
  version: number
  supersedesVersion?: number
  supersedesReason?: string
  generatedAt: string
  taxYear: number
  engineVersion: string
  rulesVersions: Record<string, string>
  renderedSha256: string
  suppressedSections: string[]
  approvedForClientUse: boolean
}

// ============================================================================
// SCOPE / COMPLETENESS  (spec section 8)
// ============================================================================

export type HeldAwayAnswer = 'none' | 'yes' | 'unknown'

export interface PacketScope {
  includedAccounts: AccountId[]
  /** Both default to 'unknown'. 'unknown' forces disclosure language on page 1. */
  heldAwayRetirementAccounts: HeldAwayAnswer
  heldAwayTaxableAccounts: HeldAwayAnswer
  dataAsOfDate: string
  taxFormsIssuedAsOfDate: boolean
}

// ============================================================================
// SECTION STATUS — DERIVED, never hand-set  (spec section 6)
// ============================================================================

export type SectionStatus =
  | 'complete' | 'partial' | 'missing_data' | 'cpa_review_required' | 'not_applicable'

export function deriveSectionStatus(
  fields: Sourced<unknown>[],
  hasReviewFlag: boolean,
): SectionStatus {
  if (fields.length === 0) return 'not_applicable'
  if (fields.every(f => f.state === 'not_applicable')) return 'not_applicable'
  if (hasReviewFlag) return 'cpa_review_required'
  const unknowns = fields.filter(f => f.state === 'unknown').length
  if (unknowns === 0) return 'complete'
  if (unknowns === fields.filter(f => f.state !== 'not_applicable').length) return 'missing_data'
  return 'partial'
}

// ============================================================================
// CPA ATTENTION FLAGS  (spec section 10)
// ============================================================================

export type FlagSeverity = 'informational' | 'review' | 'action_needed'

export interface FlagDefinition<Ctx = PacketContext> {
  id: string                       // FLAG_ROTH_CONVERSION
  severity: FlagSeverity
  title: string
  detail: (ctx: Ctx) => string
  trigger: (ctx: Ctx) => boolean
  /** Set ONLY when the trigger encodes a tax rule. Pure "this happened" flags cite nothing. */
  authority?: { ruleId: string; rulesVersion: string }
  /**
   * A flag is an OBSERVATION. The literal type makes a conclusion unrepresentable.
   * Spec section 11: "These should be flags, not tax conclusions."
   */
  isConclusion: false
}

export interface RaisedFlag {
  id: string
  severity: FlagSeverity
  title: string
  detail: string
  authority?: { ruleId: string; rulesVersion: string }
  relatedLedgerIds: string[]
}

// ============================================================================
// CROSS-REFERENCES — computed from tags, never typed  (spec section 7)
// ============================================================================

export type TotalBasis = 'gross_flows' | 'net_of_items_shown_elsewhere'

export interface PageTotal {
  label: string
  amount: Sourced<number>
  /** No unlabeled totals. A CPA must never have to guess whether they can add two pages. */
  basis: TotalBasis
  crossReferences: CrossReference[]
}

export interface CrossReference {
  amount: number
  alsoShownOn: string              // "page 7 — Charitable Giving"
  describedAs: string              // "qualified charitable distributions"
  ledgerIds: string[]
}

// ============================================================================
// TOP-LEVEL
// ============================================================================

export interface PacketContext {
  taxYear: number
  people: Person[]
  accounts: Account[]
  ledger: LedgerEntry[]
  scope: PacketScope
  compliance: ComplianceConfig
  /** VALIDATED engine only. The legacy engine is a defect here. Spec section 3.2. */
  engineOutput: unknown
  conversionTotal: number
  qcdTotal: number
}

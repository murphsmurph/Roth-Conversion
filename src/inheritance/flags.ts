/**
 * Inheritance flag registry (Track B, session B1a) — the flag definitions from
 * INHERITANCE-MODULE-SPEC.md §6. A flag is an OBSERVATION, never a tax conclusion
 * (isConclusion is the literal false, per CPA-PACKET-SPEC.md §10). authority is set only when the
 * trigger encodes a tax rule; pure "this happened" flags cite nothing (null).
 *
 * B1a registers the catalog (id / severity / title / authority). The PacketContext-driven trigger
 * evaluation is session B2; the analyzer in this module already emits these ids directly.
 */
import type { FlagSeverity } from "../packet/types";

export interface InheritanceFlagDef {
  id: string;
  severity: FlagSeverity;
  title: string;
  authority: string | null;
  isConclusion: false;
}

const f = (id: string, severity: FlagSeverity, title: string, authority: string | null): InheritanceFlagDef =>
  ({ id, severity, title, authority, isConclusion: false });

export const INHERITANCE_FLAGS: Record<string, InheritanceFlagDef> = Object.fromEntries([
  f("FLAG_IRD_NO_STEPUP", "review", "Income in respect of a decedent — no basis step-up", "IRC 1014(c)"),
  f("FLAG_691C_DEDUCTION_POSSIBLE", "review", "IRC 691(c) deduction may be available", "IRC 691(c)"),
  f("FLAG_BASIS_UNKNOWN", "action_needed", "Basis unknown", null),
  f("FLAG_FMV_KNOWN_BASIS_NOT_VERIFIED", "action_needed", "FMV known but tax basis not verified", null),
  f("FLAG_APPRAISAL_MISSING", "action_needed", "Date-of-death appraisal missing", null),
  f("FLAG_COMMUNITY_PROPERTY_DOUBLE_STEPUP", "review", "Community property — full double step-up", "IRC 1014(b)(6)"),
  f("FLAG_ELECTIVE_CP_REGIME_UNSETTLED", "review", "Elective community-property trust — unsettled", "Pub 555 / IRM 25.18.1"),
  f("FLAG_FORM_8971_EXPECTED", "review", "Form 8971 / Schedule A expected", "IRC 1014(f), 6035"),
  f("FLAG_ALTERNATE_VALUATION_ELECTED", "review", "Alternate valuation date elected", "IRC 2032"),
  f("FLAG_SUCCESSOR_BENEFICIARY", "action_needed", "Successor beneficiary — schedule may differ", "Reg. 1.401(a)(9)-5(e)"),
  f("FLAG_BENEFICIARY_CLASSIFICATION_UNKNOWN", "action_needed", "Beneficiary classification unknown", null),
  f("FLAG_RBD_STATUS_UNKNOWN", "action_needed", "Decedent RBD status unknown", null),
  f("FLAG_YEAR_OF_DEATH_RMD_UNKNOWN", "action_needed", "Year-of-death RMD — review (automatic excise waiver may apply)", "Reg. 54.4974-1(g)(3)"),
  f("FLAG_SEPARATE_ACCOUNTS_DEADLINE_OPEN", "action_needed", "Separate-accounts deadline still open", "Reg. 1.401(a)(9)-8"),
  f("FLAG_SEPT_30_DETERMINATION_DATE_OPEN", "review", "September 30 determination date still open", "Reg. 1.401(a)(9)-4"),
  f("FLAG_TEN_YEAR_RULE", "informational", "Subject to the 10-year rule", "Reg. 1.401(a)(9)-5(e)(2)"),
  f("FLAG_MINOR_CHILD_EDB", "review", "Minor child of the owner — EDB rules", "Reg. 1.401(a)(9)-5(e)(4)"),
  f("FLAG_ACCUMULATION_TRUST_COMPRESSED_BRACKETS", "review", "Accumulation trust — compressed brackets", "IRC 1(e)"),
  f("FLAG_SPOUSAL_ELECTION_NOT_MADE", "action_needed", "Spousal election not yet made", "Reg. 1.401(a)(9)-3(d)"),
  f("FLAG_INHERITED_PROPERTY_SOLD", "review", "Inherited property sold", null),
  f("FLAG_INHERITED_RENTAL_DEPRECIATION_RESTART", "review", "Inherited rental — depreciation restarts", "Reg. 1.1250-3(b)"),
  f("FLAG_STATE_INHERITANCE_TAX_POSSIBLE", "review", "State inheritance tax possible", "state statute"),
  f("FLAG_K1_EXPECTED", "informational", "Schedule K-1 expected", null),
  f("FLAG_ANNUITY_BASIS_UNKNOWN", "action_needed", "Annuity basis unknown", null),
  f("FLAG_LIFE_INSURANCE_INTEREST_COMPONENT", "review", "Life-insurance interest component", "IRC 101"),
  f("FLAG_BUSINESS_VALUATION_MISSING", "action_needed", "Business valuation missing", null),
].map(d => [d.id, d]));

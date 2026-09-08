/**
 * Inheritance analysis (Track B, session B1a). One entry point over the heterogeneous inheritance
 * inputs; each INH fixture exercises one facet, so this dispatches on the fields present and unions
 * the resulting flags. Pure and I/O-free; never imports src/rules or the legacy engine.
 *
 * It MAY compute the statutory dates and §1014 holding-period treatment. It MUST NOT compute any
 * taxable amount, depreciation recapture, basis allocation, trust DNI, or decide whether an asset
 * IS IRD (those are flags for the CPA). See INHERITANCE-MODULE-SPEC.md §9.
 */
import {
  computeTenYearEndDate, computeMinorChildDeadline, computeSeptemberThirtyDate,
  computeSeparateAccountDeadline, holdingPeriodTreatment,
} from "./types";
import {
  regimeForAsset, MANDATORY_CP, ELECTIVE_CP, TRUST_TOP_BRACKET_2026, TRUST_TOP_RATE,
  alternateValuationDefault, dayAfter, endOfDeathYear, yearOfDeathRmdStatus,
} from "./calculations";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Raw = Record<string, any>;
type Out = Record<string, unknown>;

const sv = (x: any): any => (x && typeof x === "object" && "value" in x ? x.value : x);
const ss = (x: any): string | undefined => (x && typeof x === "object" && "state" in x ? x.state : undefined);

export function analyzeInheritance(input: Raw): Out {
  const out: Out = {};
  const flags = new Set<string>();
  const assetType: string | undefined = input.assetType ?? input.inheritanceRecord?.assetType;
  const dod: string | null =
    input.dateOfDeath ?? input.inheritanceRecord?.dateOfDeath ?? input.estate?.dateOfDeath ?? null;
  const regime = assetType ? regimeForAsset(assetType) : "unknown";
  if (assetType) out.stepUpRegime = regime;

  // ---- Basis (INH-01 section 1014; INH-02 IRD) ----
  if (regime === "section_1014" && (input.dateOfDeathFMV !== undefined || input.taxBasis !== undefined)) {
    const fmv = input.dateOfDeathFMV, basis = input.taxBasis;
    out.dateOfDeathFMV = sv(fmv) ?? null;
    out.taxBasis = sv(basis) ?? null;
    out.taxBasisState = ss(basis) ?? "unknown";
    out.basisStatus = ss(basis) === "verified" ? "verified" : (ss(basis) ?? "unknown");
    out.renderedBasis = ss(basis) === "verified" ? sv(basis) : "—";
    // Only a basis CLAIM (taxBasis explicitly present but unverified) raises the guardrail flag.
    // An asset that supplies an FMV but no taxBasis field at all is not making a basis assertion.
    if (ss(fmv) === "verified" && input.taxBasis !== undefined && ss(basis) !== "verified") {
      flags.add("FLAG_FMV_KNOWN_BASIS_NOT_VERIFIED");
      out.caseStatus = "basis_missing";
    }
    if (input.appraisalStatus && input.appraisalStatus !== "obtained" && ss(basis) !== "verified")
      flags.add("FLAG_APPRAISAL_MISSING");
  }
  if (regime === "ird_no_stepup" &&
      (input.accountValueAtDeath !== undefined || input.valueAtDeath !== undefined ||
       input.decedentForm8606Basis !== undefined || input.federalEstateTaxPaidOnIRD !== undefined)) {
    out.valueAtDeath = sv(input.accountValueAtDeath ?? input.valueAtDeath) ?? null;
    out.taxBasisFieldPresent = false; // IRC 1014(c): IRD gets no basis adjustment — no taxBasis field at all
    const afterTax = input.decedentForm8606Basis ?? input.decedentAfterTaxBasis;
    out.decedentAfterTaxBasis = sv(afterTax) ?? null;
    out.decedentAfterTaxBasisState = ss(afterTax) ?? "unknown";
    out.possibleIRD = input.possibleIRD !== undefined ? sv(input.possibleIRD) : true;
    out.section691cDeductionAvailable = (sv(input.federalEstateTaxPaidOnIRD) ?? 0) > 0;
    out.distributionCharacter = "ordinary_income";
    flags.add("FLAG_IRD_NO_STEPUP");
    if (ss(afterTax) !== "verified") flags.add("FLAG_BASIS_UNKNOWN");
    if (out.section691cDeductionAvailable) flags.add("FLAG_691C_DEDUCTION_POSSIBLE");
    out.caseStatus = "cpa_review_required";
  }

  // ---- Sale of stepped-up property (INH-03) ----
  if (input.saleProceeds !== undefined || input.dateSold !== undefined) {
    out.holdingPeriodTreatment = holdingPeriodTreatment(regime); // section_1014 -> long_term
    if (regime === "section_1014") out.holdingPeriodRuleId = "IRC_1223_9";
    const proceeds = sv(input.saleProceeds), basis = sv(input.taxBasis);
    if (proceeds != null && basis != null) out.realizedGainLoss = proceeds - basis;
    flags.add("FLAG_INHERITED_PROPERTY_SOLD");
  }
  // ---- Distribution character for IRD (INH-04) ----
  if (input.grossDistribution !== undefined && regime === "ird_no_stepup" && input.trustType === undefined) {
    out.distributionCharacter = "ordinary_income";
    out.holdingPeriodTreatment = "not_applicable";
    out.section1223_9Applies = false;
    out.reason = "IRC 1223(9) requires basis determined under section 1014; 1014(c) excludes IRD.";
  }

  // ---- Community property (INH-05, INH-06) ----
  if (input.decedentDomicileState !== undefined || input.propertyCharacter !== undefined) {
    const st: string = input.decedentDomicileState;
    const pc: string = input.propertyCharacter;
    if (pc === "elective_community_property_trust" || ELECTIVE_CP.has(st)) {
      out.communityPropertyTreatment = "elective_regime_unsettled";
      out.portionReceivingAdjustment = null;
      out.adjustedBasisIfVerified = null;
      out.caseStatus = "attorney_review_required";
      flags.add("FLAG_ELECTIVE_CP_REGIME_UNSETTLED");
    } else if (pc === "community_property" && MANDATORY_CP.has(st)) {
      out.communityPropertyTreatment = "full_double_stepup";
      out.portionReceivingAdjustment = 1.0;
      out.adjustedBasisIfVerified = sv(input.totalDateOfDeathFMV) ?? null;
      flags.add("FLAG_COMMUNITY_PROPERTY_DOUBLE_STEPUP");
    } else {
      out.communityPropertyTreatment = "unknown";
    }
  }

  // ---- Alternate valuation date — estate-level election (INH-07) ----
  if (input.estate !== undefined && input.estate.alternateValuationElected) {
    const e = input.estate;
    out.electionScope = "entire_estate";
    out.electionIrrevocable = true;
    out.perAssetElectionPermitted = false;
    out.alternateValuationDateDefault = alternateValuationDefault(e.dateOfDeath);
    out.assetValuationDates = (input.assets ?? []).map((a: Raw) =>
      a.disposedBeforeAVD ? a.dispositionDate : out.alternateValuationDateDefault);
    flags.add("FLAG_ALTERNATE_VALUATION_ELECTED");
    if (e.form706Filed) flags.add("FLAG_FORM_8971_EXPECTED");
  }

  // ---- Inherited-account schedule (INH-08 NDB, INH-09 minor child, INH-10 successor) ----
  if (input.isSuccessorBeneficiary !== undefined) {
    if (sv(input.isSuccessorBeneficiary) === true) {
      const origKnown = ss(input.originalDateOfDeath) === "verified";
      if (!origKnown) {
        out.tenYearRuleEndDate = null;
        out["scheduledeterminable"] = false; // fixture key spelling (INH-10)
        out.caseStatus = "cpa_review_required";
        out.requiredMessage = "Inherited retirement distribution schedule cannot be determined from available data.";
        flags.add("FLAG_SUCCESSOR_BENEFICIARY");
      }
    }
  } else if (sv(input.edbSubtype) === "minor_child_of_owner") {
    const dob: string | null = input.beneficiaryDateOfBirth ?? null;
    const by = dob ? Number(dob.slice(0, 4)) : null;
    out.lifeExpectancyPaymentsUntilYear = by !== null ? by + 21 : null;
    out.ageOfMajorityAttainedYear = by !== null ? by + 21 : null;
    out.finalDistributionDeadline = computeMinorChildDeadline(dob);
    flags.add("FLAG_MINOR_CHILD_EDB");
    flags.add("FLAG_TEN_YEAR_RULE");
  } else if (input.beneficiaryClassification === "noneligible_designated_beneficiary") {
    out.tenYearRuleEndDate = computeTenYearEndDate(dod);
    out.annualRmdsRequiredYears1Through9 = input.decedentRBDStatus === "after_required_beginning_date";
    flags.add("FLAG_TEN_YEAR_RULE");
  }

  // ---- Year-of-death RMD (INH-11 pre-RBD, INH-12 partial) ----
  if (input.decedentRBDStatus !== undefined &&
      (input.amountTakenBeforeDeath !== undefined || input.amountRequired !== undefined) &&
      input.beneficiaryClassification === undefined && input.isSuccessorBeneficiary === undefined) {
    const req = sv(input.amountRequired) ?? null;
    const taken = sv(input.amountTakenBeforeDeath) ?? null;
    const completed = input.beneficiaryCompletedRemainingRMD !== undefined
      ? sv(input.beneficiaryCompletedRemainingRMD) : null;
    const r = yearOfDeathRmdStatus(input.decedentRBDStatus, req, taken, completed);
    out.decedentYearOfDeathRMDRequired = r.required;
    out.status = r.status;
    out.amountRequired = req;
    out.amountRemaining = r.amountRemaining;
    if (r.status !== "not_applicable") {
      out.statutoryDeadline = endOfDeathYear(dod);
      out.automaticExciseWaiverAvailable = true;
      out.waiverDeadlineDescription =
        "beneficiary's tax filing deadline including extensions, or the last day of the following calendar year if later";
      out.form5329WaiverRequestRequired = false;
      if (r.status !== "satisfied") flags.add("FLAG_YEAR_OF_DEATH_RMD_UNKNOWN");
    }
  }

  // ---- Separate-account / Sept 30 deadlines — forward-looking (INH-13) ----
  if (input.multipleBeneficiaries !== undefined || input.separateAccountsEstablished !== undefined) {
    out.septemberThirtyDeterminationDate = computeSeptemberThirtyDate(dod);
    out.separateAccountDeadline = computeSeparateAccountDeadline(dod);
    if (sv(input.separateAccountsEstablished) !== true) {
      const gen: string | undefined = input.packetGenerationDate;
      out.deadlineStillOpenAtGeneration = gen ? gen <= (out.separateAccountDeadline as string) : null;
      out.consequenceIfMissed =
        "Section 401(a)(9) applies to the aggregate account; in practice the least favorable beneficiary's rules apply to all.";
      out.caseStatus = "cpa_review_required";
      flags.add("FLAG_SEPARATE_ACCOUNTS_DEADLINE_OPEN");
      flags.add("FLAG_SEPT_30_DETERMINATION_DATE_OPEN");
    }
  }

  // ---- Accumulation trust (INH-14) ----
  if (input.trustType !== undefined) {
    out.trustType = input.trustType;
    if (input.trustType === "accumulation") {
      out.retainedIncomeSubjectToTrustBrackets = (sv(input.distributedToIndividualBeneficiary) ?? 0) === 0;
      out.trustTopBracketThreshold2026 = TRUST_TOP_BRACKET_2026;
      out.trustTopRate = TRUST_TOP_RATE;
      flags.add("FLAG_ACCUMULATION_TRUST_COMPRESSED_BRACKETS");
      flags.add("FLAG_K1_EXPECTED");
    }
  }

  // ---- Inherited rental — depreciation restarts (INH-15) ----
  if (input.decedentAccumulatedDepreciation !== undefined) {
    out.additionalDepreciationAtDeath = 0;
    out.heirHoldingPeriodBegins = dayAfter(dod);
    out.decedentDepreciationCarriesOver = false;
    out.decedentDepreciationRecapturedByHeir = false;
    out.requiredFlagText =
      "Inherited rental property. Depreciation restarts on the adjusted basis as of the date of death; " +
      "the decedent's prior depreciation generally does not carry over. Only the heir's own " +
      "post-inheritance depreciation is relevant on a later sale.";
    out.exceptionsToFlagSeparately =
      ["property is IRD", "IRC 1014(b)(9) - heir depreciated the property before the death"];
    flags.add("FLAG_INHERITED_RENTAL_DEPRECIATION_RESTART");
  }

  // ---- Ledger cross-reference — module holds NO totals of its own (INH-16) ----
  if (input.ledgerEntries !== undefined) {
    const acct = input.inheritanceRecord?.accountId ?? input.accountId;
    const dist = (input.ledgerEntries as Raw[]).filter(e => e.accountId === acct && e.kind === "distribution");
    const total = dist.reduce((s, e) => s + (sv(e.amount) ?? 0), 0);
    out.inheritanceSectionDistributionTotal = total; // a query over the ledger
    out.page4DistributionTotal = total;              // the same query
    out.householdTotalDistributions = total;         // deduped by ledger id — never section1 + section2
    out.sumOfSectionsIfNaivelyAdded = total * 2;     // the wrong answer this fixture guards against
    out.crossReferenceRequired = true;
    out.crossReferenceText =
      `Includes $${total.toLocaleString("en-US")} of inherited IRA distributions, ` +
      `also shown in the Inheritance & Beneficiary Activity section.`;
    out.inheritanceModuleHoldsOwnTotals = false;
  }

  out.flags = [...flags];
  return out;
}

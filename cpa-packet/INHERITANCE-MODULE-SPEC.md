# INHERITANCE & BENEFICIARY ASSETS — MODULE SPECIFICATION
### Track B, module 2. Read `CPA-PACKET-SPEC.md` first.

Authored 2026-08-21. Every tax rule below was independently verified against primary sources on
that date; citations are inline. Supersedes the source requirements document where they conflict;
the requirements document remains authoritative for **field lists**.

---

## 0. Verdict

**Approved, and it is right about the thing that matters most.** The FMV-is-not-basis guardrail is
the correct central rule, `possibleIRD: true/false/unknown` instead of category inference is more
sophisticated than most commercial software, and refusing to determine an inherited-IRA schedule
without beneficiary classification and RBD status is exactly right.

I ran thirteen independent checks against the Code and the regs. **Eleven confirmed. Two came back
partially wrong, and one of those is dangerous.** Nine things are missing. Below.

---

## 1. THE DANGEROUS ONE — IRD assets get no step-up at all

The requirements document builds its entire basis model around `dateOfDeathFMV`, then warns against
copying FMV into `taxBasis`. Correct as far as it goes. But it never states the rule underneath:

> **IRC 1014(c): §1014 does not apply to property that constitutes income in respect of a decedent.**

An inherited traditional IRA, 401(k), 403(b), or accrued compensation gets **no basis adjustment
whatsoever**. Not a partial one. Not one requiring verification. None. The beneficiary inherits the
decedent's remaining Form 8606 after-tax basis, if any — usually zero.

So `dateOfDeathFMV` on an inherited traditional IRA is a *reporting* figure. It is the account
value at death, relevant to estate valuation and to the IRC 691(c) deduction. **It is not, and can
never become, tax basis.** A module that stores FMV and basis in the same shape for every asset
type invites exactly the error the spec was written to prevent.

**Required:** the basis model is a discriminated union on step-up eligibility.

```ts
type BasisModel =
  | { stepUpRegime: 'section_1014';  dateOfDeathFMV: Sourced<number>; taxBasis: Sourced<number>; ... }
  | { stepUpRegime: 'ird_no_stepup'; valueAtDeath:   Sourced<number>;
      decedentAfterTaxBasis: Sourced<number>;      // Form 8606 carryover, usually 0
      section691cDeductionAvailable: Sourced<boolean>; }
  | { stepUpRegime: 'unknown';       valueAtDeath:   Sourced<number>; }
```

There is no `taxBasis` field on the IRD branch. The bug becomes unrepresentable rather than merely
discouraged. Authority: [IRC 1014(c)](https://www.law.cornell.edu/uscode/text/26/1014).

**Corollary the requirements document also misses:** where federal estate tax was actually paid on
IRD, the beneficiary gets an **IRC 691(c) income-tax deduction** for the estate tax attributable to
it. Rare (2026 exclusion is $15,000,000) but valuable when it applies, and nobody catches it.
Capture `section691cDeductionAvailable` and flag it.

---

## 2. The other correction — holding period is narrower than stated

The requirements document says don't infer holding-period treatment. Half right. The rule is clean
and citable, so **implement it** — but implement the real one:

> **IRC 1223(9)** treats property as held more than one year **only where basis is determined under
> §1014** and the disposition occurs **within one year of death**. Beyond a year the holding period
> is long-term naturally.

Two consequences:

- Inherited stock sold at any time → long-term. Safe to compute, with the citation.
- **Inherited IRA distributions are ordinary income, not long-term capital gain**, because §1014
  never applied. The §1223(9) rescue cannot reach IRD.

Implementing this correctly prevents a common and expensive error — an inherited-stock sale coded
short-term because the beneficiary held it four months. Authority:
[IRC 1223](https://www.law.cornell.edu/uscode/text/26/1223).

---

## 3. Nine things missing

### 3.1 Community property double step-up

[IRC 1014(b)(6)](https://www.law.cornell.edu/uscode/text/26/1014): in a community property state,
**both halves** of community property are adjusted at the first spouse's death. In a common-law
state, only the decedent's half. That is a 2× difference in basis on a jointly held taxable account
and the module has no field for it.

- **Nine mandatory states + PR and Guam:** AZ, CA, ID, LA, NV, NM, TX, WA, WI.
- **Elective community-property-trust states (AK, SD, TN, FL, KY): UNSETTLED.** IRS Pub 555
  expressly disclaims coverage and IRM 25.18.1 cites *Commissioner v. Harmon* against elective
  regimes in the income-reporting context. **Do not model these.** Flag for attorney review.

Add `decedentDomicileState` and `communityPropertyTreatment: 'full_double_stepup' | 'half_stepup' |
'elective_regime_unsettled' | 'unknown'`. Default `unknown`.

### 3.2 Alternate valuation date is an estate-level election, not a per-asset field

The requirements document models `alternateValuationFMV` and `alternateValuationDate` per asset.
That is structurally wrong. [IRC 2032](https://www.law.cornell.edu/uscode/text/26/2032):

- Elected **on Form 706**, **irrevocable**, and **all-or-nothing for the entire estate**.
- Available **only if it decreases both** the gross estate **and** the sum of estate + GST tax.
- Six months after death, **or date of disposition if earlier**.
- Must be elected on a return filed no later than 1 year after the due date including extensions.

Model it once at the estate level. Assets inherit it. **And note:** with a $15,000,000 exclusion,
almost no estate files a 706 at all — so if an advisor has entered AVD data, that is itself a signal
worth flagging for confirmation.

### 3.3 Basis consistency and Form 8971 — missing from the document checklist

[IRC 1014(f) and 6035](https://www.law.cornell.edu/uscode/text/26/6035): where an estate tax return
is required, the beneficiary's initial basis **cannot exceed** the value reported, and the executor
must furnish **Form 8971 with Schedule A**.

Narrowing condition worth encoding: this applies only to property whose inclusion **increased the
estate tax liability** after credits — a return filed solely to elect portability with zero tax
generally does not trigger the cap. Add `Form 8971 / Schedule A` and `Form 706` to the checklist.

### 3.4 Successor beneficiaries — absent entirely

If the client inherited from someone who had *themselves* inherited, the client is a **successor
beneficiary** and the rules differ: they generally step into the remainder of the original 10-year
window rather than starting a fresh one. This is common and the model has nowhere to put it.

Add `isSuccessorBeneficiary`, `originalDecedentName`, `originalDateOfDeath`,
`originalBeneficiaryRegime`. If `isSuccessorBeneficiary` is true and the original facts are
`unknown`, force CPA review — no schedule can be determined.

### 3.5 Spousal election — SECURE 2.0 §327

`beneficiaryClassification: 'spouse'` is not enough. A sole-spouse beneficiary has materially
different options, and [Reg. 1.401(a)(9)-3(d)](https://www.ecfr.gov/current/title-26/chapter-I/subchapter-A/part-1/subject-group-ECFRe7ea9640499de44/section-1.401(a)(9)-3)
added another for 2024 and later RMD years: elect to be treated **as the deceased owner**, delaying
RMDs to the year the decedent would have reached the applicable age and using the **Uniform
Lifetime Table** instead of Single Life.

Add `spousalElection: 'treat_as_own' | 'rollover' | 'remain_beneficiary' |
'section_327_treated_as_decedent' | 'not_yet_elected' | 'unknown'`.

Caveat to encode: effective for **2024+ RMD years**, which can include a 2023 death. For employer
plans the **plan document** controls whether the election is default or affirmative — do not code it
as universally automatic.

### 3.6 Two deadlines, sequential, both commonly blown

- **September 30 of the year following death** — determination date for identifying designated
  beneficiaries. Disclaimers and full cash-outs through this date can remove a bad beneficiary
  (a charity or estate) and preserve designated-beneficiary status for the rest.
- **December 31 of the year following death** — deadline to establish **separate accounts**. Miss
  it and §401(a)(9) applies to the aggregate, which in practice imposes the **least favorable**
  beneficiary's rules on everyone.

These are distinct, sequential, and time-critical. Authority:
[Reg. 1.401(a)(9)-4](https://www.ecfr.gov/current/title-26/chapter-I/subchapter-A/part-1/subject-group-ECFRe7ea9640499de44/section-1.401(a)(9)-4),
[-8](https://www.ecfr.gov/current/title-26/chapter-I/subchapter-A/part-1/subject-group-ECFRe7ea9640499de44/section-1.401(a)(9)-8).

Add `separateAccountsEstablished` and `separateAccountDeadline` (computed), and raise a flag while
the deadline is open and the answer is not `yes`. **This is the one place the module should be
forward-looking rather than purely retrospective** — a packet delivered in February that says
"separate accounts not yet established, deadline December 31" has done something a year-end summary
normally cannot.

### 3.7 Trust beneficiaries — see-through, conduit, accumulation

`beneficiaryClassification: 'trust'` is not enough either. An **accumulation** trust that retains
retirement distributions hits the compressed trust brackets already loaded in
`rules/federal/estates-trusts-2026.json` — **37% at roughly $16,000** of retained taxable income.
A **conduit** trust passes distributions to the individual beneficiary, taxed at their rates.

Add `trustType: 'conduit' | 'accumulation' | 'see_through_undetermined' | 'non_see_through' |
'unknown'`. When `accumulation`, raise a flag citing `TRUST_COMPRESSED_BRACKETS`. Do not compute the
trust's tax — that is the CPA's — but naming the exposure is precisely the coordination this packet
exists for.

### 3.8 Year-of-death RMD — get both halves of the rule

The requirements document's fields are good. The rule underneath has two parts:

- **A year-of-death RMD exists only if the owner died on or after the RBD.** Death before the RBD →
  no year-of-death RMD. `decedentRBDStatus` therefore gates the whole subsection.
- Statutory deadline is **December 31 of the year of death**, but
  [Reg. 54.4974-1(g)(3)](https://www.ecfr.gov/current/title-26/chapter-I/subchapter-D/part-54/section-54.4974-1)
  provides an **automatic waiver** of the excise tax if the beneficiary takes it by their tax filing
  deadline including extensions, or the last day of the following calendar year if later. No Form
  5329 waiver request needed.

So `status: 'not_satisfied'` is not automatically a penalty situation. Word the flag accordingly.

### 3.9 The 10-year end date, and the minor-child variant

`tenYearRuleEndDate` is computable, so compute it — with the citation, and watch the off-by-one:

```
tenYearEndDate = December 31 of (yearOfDeath + 10)
```

[Reg. 1.401(a)(9)-5(e)(2)](https://www.ecfr.gov/current/title-26/chapter-I/subchapter-A/part-1/subject-group-ECFRe7ea9640499de44/section-1.401(a)(9)-5).
Not ten years from the date of death. A 2026 death gives **2036-12-31**.

Minor-child EDB — **child of the owner only**, not a grandchild or niece: annual life-expectancy
payments until 21, then full payout by December 31 of the year the child turns **31**.

---

## 4. Two design corrections

### 4.1 "Total Known Inherited Value" is apples and oranges

The sample output totals a traditional IRA, a brokerage account, land, and cash into
`$1,108,400`. Those dollars are not equivalent. The IRA is pre-tax and worth perhaps 65–75 cents on
the dollar; the land and brokerage carry a stepped-up basis and are worth close to a full dollar.

This is the same error §19 of the Master Spec forbids everywhere else in this project. Fix it the
same way:

```
Inherited assets — gross nominal value                    $1,108,400
   of which subject to ordinary income tax when
   distributed (IRD, no basis step-up)                      $425,000
   of which received a basis adjustment under IRC 1014      $683,400

Gross nominal value is informational. It is not an estate-tax value, not a tax basis,
and not an after-tax value.
```

### 4.2 The depreciation flag is wrong as written

The requirements document suggests: *"CPA Review — Depreciation history may affect sale treatment."*

For inherited property that is misleading. Under
[Reg. 1.1250-3(b)](https://www.ecfr.gov/current/title-26/chapter-I/subchapter-A/part-1/subject-group-ECFR46fd8b3a9163d4c/section-1.1250-3),
on a transfer at death the additional depreciation **is zero** and the holding period **begins the
day after death**. The decedent's accumulated depreciation does not carry over and is not recaptured
by the heir. The heir starts fresh on the stepped-up basis.

Correct wording:

> **CPA Review** — Inherited rental property. Depreciation restarts on the adjusted basis as of the
> date of death; the decedent's prior depreciation generally does not carry over. Only the heir's
> own post-inheritance depreciation is relevant on a later sale.

Two exceptions to flag: the property is IRD, or **IRC 1014(b)(9)** — the heir had already taken
depreciation on the property before the death.

---

## 5. Integration — no independent numbers

Same rule as the packet (`CPA-PACKET-SPEC.md` §4). **An inherited IRA is both an inheritance record
and an account in the ledger.** Its distributions live in the ledger and nowhere else.

```
InheritanceRecord  ──────▶  identity, decedent, valuation, basis regime, classification
        │
        └── accountId ────▶  Ledger  ──▶  distributions, withholding, QCDs, sales
```

The inheritance module **must not hold its own distribution or sale totals.** It queries. Page 4
and the inheritance section must show the same distribution with a cross-reference between them.
Test: a fixture where an inherited IRA distribution appears in both, and no total double-counts it.

Architecture per the requirements document, adopted:

```
src/inheritance/{types,normalization,calculations,flags,aggregation,validation}
src/packet/render/inheritance-section     <- zero arithmetic, same as every renderer
```

`dateOfDeath` is the load-bearing field. RBD status, the 10-year date, the year-of-death RMD, the
valuation date, the AVD window and the holding period all key off it. **If it is `unknown`,
essentially nothing can be determined** — treat it as blocking and say so on the report.

---

## 6. Flag registry additions

All `isConclusion: false`, all with ids, per `CPA-PACKET-SPEC.md` §10.

| Flag id | Severity | Cites |
|---|---|---|
| `FLAG_IRD_NO_STEPUP` | review | IRC 1014(c) |
| `FLAG_691C_DEDUCTION_POSSIBLE` | review | IRC 691(c) |
| `FLAG_BASIS_UNKNOWN` | action | — |
| `FLAG_FMV_KNOWN_BASIS_NOT_VERIFIED` | action | — |
| `FLAG_APPRAISAL_MISSING` | action | — |
| `FLAG_COMMUNITY_PROPERTY_DOUBLE_STEPUP` | review | IRC 1014(b)(6) |
| `FLAG_ELECTIVE_CP_REGIME_UNSETTLED` | review | Pub 555 / IRM 25.18.1 |
| `FLAG_FORM_8971_EXPECTED` | review | IRC 1014(f), 6035 |
| `FLAG_ALTERNATE_VALUATION_ELECTED` | review | IRC 2032 |
| `FLAG_SUCCESSOR_BENEFICIARY` | action | Reg. 1.401(a)(9)-5(e) |
| `FLAG_BENEFICIARY_CLASSIFICATION_UNKNOWN` | action | — |
| `FLAG_RBD_STATUS_UNKNOWN` | action | — |
| `FLAG_YEAR_OF_DEATH_RMD_UNKNOWN` | action | Reg. 54.4974-1(g)(3) |
| `FLAG_SEPARATE_ACCOUNTS_DEADLINE_OPEN` | action | Reg. 1.401(a)(9)-8 |
| `FLAG_SEPT_30_DETERMINATION_DATE_OPEN` | review | Reg. 1.401(a)(9)-4 |
| `FLAG_TEN_YEAR_RULE` | informational | Reg. 1.401(a)(9)-5(e)(2) |
| `FLAG_MINOR_CHILD_EDB` | review | Reg. 1.401(a)(9)-5(e)(4) |
| `FLAG_ACCUMULATION_TRUST_COMPRESSED_BRACKETS` | review | IRC 1(e) |
| `FLAG_SPOUSAL_ELECTION_NOT_MADE` | action | Reg. 1.401(a)(9)-3(d) |
| `FLAG_INHERITED_PROPERTY_SOLD` | review | — |
| `FLAG_INHERITED_RENTAL_DEPRECIATION_RESTART` | review | Reg. 1.1250-3(b) |
| `FLAG_STATE_INHERITANCE_TAX_POSSIBLE` | review | state statute |
| `FLAG_K1_EXPECTED` | informational | — |
| `FLAG_ANNUITY_BASIS_UNKNOWN` | action | — |
| `FLAG_LIFE_INSURANCE_INTEREST_COMPONENT` | review | IRC 101 |
| `FLAG_BUSINESS_VALUATION_MISSING` | action | — |

**State inheritance tax — five states as of 2026:** Kentucky, Maryland, Nebraska, New Jersey,
Pennsylvania. **Iowa fully repealed** for deaths on or after 2025-01-01 (Iowa Code 450.98). Maryland
is the only state with both an estate tax and an inheritance tax. Trigger on decedent domicile or
property location.

---

## 7. Fixtures — my independent checks

Sixteen fixtures in `tests/fixtures/inheritance/`, shipped in `cpa-packet/fixtures/`. Each targets a
specific way this module gets built wrong. Highlights:

| Fixture | Catches |
|---|---|
| `INH-01` | **FMV silently copied into basis.** The headline guardrail. |
| `INH-02` | **Step-up applied to an inherited traditional IRA.** Must have no `taxBasis` field at all. |
| `INH-03` | Inherited stock sold at 4 months coded short-term. Must be long-term. |
| `INH-04` | Inherited IRA distribution coded as capital gain. Must be ordinary. |
| `INH-05` | Community property half-step-up applied in Texas. Must be full. |
| `INH-06` | Elective CP trust state auto-modeled. Must flag as unsettled, not compute. |
| `INH-08` | **10-year end date off by one.** 2026 death → 2036-12-31. |
| `INH-09` | Minor child EDB. Age 21 start → year child turns 31. |
| `INH-10` | Successor beneficiary with unknown original facts. Must refuse to schedule. |
| `INH-11` | Year-of-death RMD where death preceded RBD. Must be `not_applicable`, not `not_satisfied`. |
| `INH-13` | Separate-account deadline still open. Forward-looking flag. |
| `INH-14` | Accumulation trust. Must cite the compressed brackets. |
| `INH-15` | Inherited rental. Must NOT warn about the decedent's depreciation carrying over. |
| `INH-16` | **Cross-reference with the ledger.** Same distribution, both sections, no double count. |

`INH-02` and `INH-16` are the two to read by hand.

---

## 8. Session prompt — Track B, session B1a

```
Read CLAUDE.md, then cpa-packet/CPA-PACKET-SPEC.md, then
cpa-packet/INHERITANCE-MODULE-SPEC.md. Branch: track-b-1a-inheritance.

Prerequisite: B0 complete. This module is READ-ONLY over the engine.

1. Add the inheritance types from cpa-packet/types/inheritance-types.ts.
   The BasisModel discriminated union is not negotiable - an IRD asset must have NO
   taxBasis field, so that copying FMV into basis is a type error rather than a bug.
2. Install the 16 INH fixtures.
3. Implement src/inheritance/{normalization,calculations,validation}.
   You MAY compute, with citations: the 10-year end date, the minor-child EDB date, the
   separate-account and Sept 30 deadlines, and long-term holding-period treatment for
   section 1014 property.
   You MAY NOT compute: taxable amounts, depreciation recapture, basis allocation, outside
   or inside partnership basis, section 754 adjustments, trust DNI, or whether any asset
   IS income in respect of a decedent. Those are flags.
4. Wire the inheritance records to the ledger by accountId. The module holds NO
   distribution or sale totals of its own - it queries the ledger. INH-16 proves it.
5. Add the flag registry entries from spec section 6.

EXIT: 16/16 INH fixtures pass. INH-02 must fail to compile if anyone adds a taxBasis
field to the IRD branch.

Do not build the report section. That is B3.
```

---

## 9. What this module must never do

- Copy `dateOfDeathFMV` into `taxBasis`. Anywhere. For any asset type.
- Apply a basis step-up to IRD.
- Determine an inherited retirement distribution schedule without date of death, beneficiary
  classification, and RBD status.
- Compute depreciation recapture, basis allocation, land/building splits, passive-loss treatment,
  outside/inside basis, §754 adjustments, or built-in gain.
- Decide whether an asset *is* IRD. Flag it; a CPA decides.
- Model elective community-property-trust regimes.
- Present gross nominal inherited value as if it were after-tax value.
- Require an SSN, a full account number, or a street address.

---

## Verification record

Thirteen claims checked against the Code, the regs, and IRS guidance on 2026-08-21. Eleven
confirmed as stated. Two required correction and both corrections are folded in above: **IRC
1223(9)** is a rescue provision conditioned on §1014 basis and a disposition within one year, not a
free-standing long-term rule; and **IRC 1014(f)** basis consistency applies only where inclusion
increased the estate tax liability, so portability-only returns generally fall outside it.

Three further narrowings came out of the same pass and are encoded: elective community-property
regimes are unsettled and must not be modeled; the SECURE 2.0 §327 spousal election is effective for
2024+ RMD years with plan documents controlling default versus affirmative; and the year-of-death
RMD requires death on or after the RBD before any of its fields mean anything.

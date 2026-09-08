# CPA TAX COORDINATION PACKET — SPECIFICATION
### Track B. A reporting layer. It does not touch the tax engine.

Companion to `CLAUDE.md`, `CLAUDE-CODE-ADDENDUM.md` v1.1, `PHASE-0-FIXTURE-SPEC.md`.
Authored 2026-08-21. Supersedes the raw requirements document where the two conflict; the raw
requirements remain authoritative for **field lists** (which columns appear on which page).

---

## 0. Verdict on the requirements document

**Approved. It is the best-specified thing in this project so far.** The provenance taxonomy, the
verified-zero-vs-missing distinction, the tax-treatment boundary language, and the refusal to
combine margin interest with advisory fees are all correct and should be treated as binding.

Six things it is missing. Five are ways the report would mislead the reader; one is structural.

1. **No output-mode concept.** This is an educational tool, not an advisor-signed deliverable —
   but the two produce different documents and the difference should live in a switch, not in
   someone's memory. §2.
2. **"Custodian Verified" is one state doing two jobs.** A January figure and a final-1099 figure
   are not the same thing, and corrected 1099s are routine. §5.2.
3. **No model for the same dollar appearing on two pages.** A QCD is a distribution *and* a
   charitable gift. Add Page 4 to Page 7 and you have double-counted the client's charity. §7.
4. **No held-away-account concept.** This is the one that can actually hurt someone: RMD
   aggregation across IRAs the advisor cannot see. §8.
5. **No engine selection rule.** This repo now has two engines with documented divergences. The
   packet must consume exactly one of them. §3.2.
6. **No report identity or supersession.** Regenerate in March after a corrected 1099 and the CPA
   now holds two documents with different numbers and no way to tell which is current. §12.

---

## 1. Scope boundary — the load-bearing sentence

> This packet reports **financial activity the advisor has records of**. It does not report the
> client's tax situation.

Everything downstream follows from that. The packet is a *statement of what we know and where we
learned it*, not a *statement of what is true*. Every design decision below exists to keep those
two things from blurring.

**Required on page 1, verbatim, from the requirements doc:**

> **Planning & Coordination Document — Not Tax Preparation**
> This report summarizes tax-relevant financial activity known to the financial advisor and is
> intended to assist the client and tax professional with tax preparation and planning. It is not a
> substitute for official tax forms, custodian records, or professional tax advice. Final tax
> treatment should be independently determined by the client's tax professional.

---

## 2. OUTPUT MODE — educational by default

**This project is educational. It is not an advisor-signed, sealed, delivered document.**
The spec is written for a tool that models and teaches the mechanics of tax coordination, using
synthetic households. Nothing here is issued to a client under a registered representative's name.

That is the default and it needs almost no ceremony. What it needs is an honest label.

```ts
type OutputMode = 'educational' | 'client_delivery'   // default: 'educational'
```

**No attribution, in either mode.** The packet carries **no individual name, no firm name, no logo,
no letterhead, no contact block, and no "prepared by" line.** There is no `advisorName` field and no
`firmName` field anywhere in the data model — omitting them is a schema decision, not a rendering
choice, so nobody can add one by editing a template. An unbranded worksheet cannot be mistaken for
a firm deliverable, which is most of what keeps this on the right side of the line.

The document identifies itself by **household, tax year, and report version** only.

**`educational` (default).** Every page carries a light footer: *Educational example — not an
advisory deliverable.* Synthetic data only, per `CLAUDE.md` rule 6. No attestation, no approval
flag, no audit ceremony. Build freely.

**`client_delivery`.** A different object with different obligations, and the mode switch is where
they attach rather than something to reason about mid-build:

- Pages carry `DRAFT — NOT APPROVED FOR CLIENT USE` until an approval record exists with a reviewer
  name and date, mirroring the `verifiedBy` pattern in `src/rules/**`.
- The generator writes an immutable record per packet: client, tax year, version, timestamp, rules
  versions, SHA-256 of the rendered output.
- A document going to a client under a registered rep's name is firm communication, and the firm's
  policy on advisor-created client materials is stricter than the rule. That is a conversation with
  compliance, not a software problem.

**The tripwire is one line:** the moment a real client's numbers go in and the output leaves your
hands with your name on it, mode flips. Building the switch now costs an afternoon; retrofitting it
later means auditing every page.

Everything else in this document applies to both modes. The provenance discipline, the
verified-zero-versus-unknown distinction, the no-double-counting rule and the tax-treatment
boundary are not compliance theater — they are what makes the tool *correct*, and they matter just
as much when the only person reading it is you.

---

## 3. Architecture

### 3.1 Layering — the packet is downstream of everything

```
src/rules/**              tax constants, versioned, sourced          [unchanged]
src/engine/**             deterministic calculation                  [READ-ONLY from here]
src/ledger/**             NEW - planning transactions, provenance
src/packet/**             NEW - aggregation, flag rules, section status
src/packet/render/**      NEW - HTML/print. Zero arithmetic.
```

Four hard rules:

- **`src/packet/**` must never import from `src/rules/**`.** If the packet needs a tax constant it
  asks the engine. Duplicating a constant into report code is how the two drift.
- **`src/packet/render/**` performs no arithmetic.** Not a sum, not a rounding, not a percentage.
  It receives finished values and formats them. This is testable with a lint rule and it should be.
- **`src/ledger/**` is pure and I/O-free**, same as the engine (R1). Import/export are separate
  adapters.
- The packet may **read** engine output. It may not cause the engine to change.

### 3.2 Which engine — this repo has two, and it matters

`ADVISORREVIEWPACKET.md` §5 documents that the **legacy** engine (the year-by-year projection
table) omits the OBBBA senior deduction and omits dividends from Social Security provisional
income. It is wrong in two known, quantified ways.

> **The packet consumes the VALIDATED engine only.** Any calculated figure sourced from the legacy
> engine is a defect. Add a test that fails if `src/packet/**` imports the legacy path.

If a needed figure exists only in the legacy engine, that figure is `null / status: unavailable` —
not a legacy number with a caveat.

---

## 4. The ledger — one source of truth, every page a view

**The single most important structural decision in this build.**

Do not let pages hold their own numbers. Page 4 does not "have" a QCD total and Page 7 does not
"have" a charitable total. There is **one append-only transaction ledger** for the tax year, and
every page is a *query* over it.

```
Ledger  ──query──▶  Page 4 (retirement)   : where kind in {distribution, conversion}
        ──query──▶  Page 7 (charitable)   : where tags contains 'charitable'
        ──query──▶  Page 8 (withholding)  : where kind = 'withholding'
```

A single QCD is **one ledger row** carrying tags `['distribution','charitable','rmd_satisfying']`.
It appears on three pages because three queries match it. It cannot disagree with itself, it cannot
be entered twice, and the cross-references in §7 become computable rather than hand-maintained.

If Claude Code proposes per-page data structures, stop it. That design cannot be made correct.

**Ledger invariants (all testable):**

- Every row has a stable `id`. Import is idempotent on `(sourceDocument, sourceAccount, tradeDate, amount, kind)`.
- Rows are never mutated. A correction appends a new row with `supersedesId` set.
- Every row carries full provenance (§5).
- Every row belongs to exactly one account, and every account to exactly one owner. **Never a household.**

---

## 5. Provenance

### 5.1 The seven source types — adopted as written

`custodian_verified` · `advisor_entered` · `client_reported` · `prior_tax_return` ·
`cpa_provided` · `calculated` · `estimated`

Display convention, from the requirements doc:

```
Roth Conversions        $47,500     Source: Custodian Verified
Capital Loss Carryforward  $18,240  Source: Prior Tax Return / Client Provided
```

### 5.2 Correction — `custodian_verified` needs a document status

A figure pulled from a custodian in January and a figure from a final Form 1099 are both
"custodian verified" and they are frequently different numbers. Mutual fund and REIT distributions
get reclassified; corrected 1099s in February and March are routine, not exceptional.

Add to every `custodian_verified` figure:

```
documentStatus: 'preliminary' | 'tax_form_issued' | 'corrected_form_issued'
asOfDate:       ISO date
```

**Page 1 must state, prominently:** the as-of date of the underlying data, and whether official tax
forms had been issued as of that date. A packet generated 2027-01-15 for tax year 2026 is a
*planning draft*, and it should say so in its own header rather than leaving the CPA to work it out.

Auto-flag `CORRECTED_FORM_EXPECTED` whenever the packet is generated before mid-February and
contains REIT, MLP, or mutual-fund distribution data. That flag is already on the requirements
doc's list; this is when to raise it.

### 5.3 Also retained per figure

`sourceDocument` · `sourceAccount` · `sourceDate` · `enteredBy` · `verifiedDate` · `notes`

---

## 6. Value states — four, not two

The requirements doc has verified-zero versus missing. Two more are needed, because section
suppression (the "don't send a client blank pages" requirement) is driven by field state:

| State | Meaning | Renders as |
|---|---|---|
| `verified` | We know the value. `0` is a real answer. | the number |
| `unknown` | We do not know. **Never render as `0`.** | `—` plus a status chip |
| `not_applicable` | Structurally absent. Client has no 529. | omitted; drives suppression |
| `suppressed` | Known, deliberately excluded this run. | omitted; logged in the audit record |

```ts
{ foreignTaxPaid: { value: 0,    state: 'verified' } }   // there was no foreign tax
{ foreignTaxPaid: { value: null, state: 'unknown'  } }   // we did not look
```

These are different documents to a CPA. Conflating them is the failure the requirements doc is
right to call out, and the fix is a discriminated union in the type system, not a convention.

**Section status** (`Complete` / `Partial` / `Missing Data` / `CPA Review Required` /
`Not Applicable`) is **derived** from the field states, never set by hand.

---

## 7. The double-count problem

The same dollar legitimately appears in more than one place:

| Dollar | Appears on | Why |
|---|---|---|
| QCD | P4 retirement, P4 RMD, P7 charitable | gross distribution, RMD-satisfying, charitable gift |
| Roth conversion | P4 retirement, P5 conversions | gross distribution, conversion detail |
| IRA withholding | P4 retirement, P8 tax payments | reduces net distribution, is a tax payment |
| Appreciated stock gift | P3 capital gains (as a non-sale disposition), P7 charitable | disposed, donated |

A CPA who adds page totals will double-count. That destroys trust in the whole document faster than
a wrong number would.

**Required:**

1. Every page total is labeled either **`Gross flows`** or **`Net of items shown elsewhere`**.
   No unlabeled totals.
2. Any figure that also appears elsewhere renders a cross-reference: *"Includes $18,000 of QCDs,
   also shown on page 7."*
3. Cross-references are **computed from ledger tags**, never typed by a human.
4. There is exactly one **household reconciliation** figure and it is derived from the ledger, not
   from summing pages.
5. Test: for every tagged row, assert it appears in every page-query that should match and that no
   page total is the naive sum of two overlapping queries.

---

## 8. Completeness and held-away accounts — the one that can hurt someone

The advisor sees the accounts the advisor custodies. The client has others. The packet, read
plainly, looks complete.

**Two mandatory inputs, both defaulting to `unknown`, both blocking:**

```
heldAwayRetirementAccounts: 'none' | 'yes' | 'unknown'    // default 'unknown'
heldAwayTaxableAccounts:    'none' | 'yes' | 'unknown'    // default 'unknown'
```

Page 1 carries a **scope box** listing every account included by name and registration, followed by
one of:

- `none` → "The client has confirmed no retirement accounts are held outside this firm."
- `yes` → "**The client holds retirement accounts outside this firm that are not reflected here.**"
- `unknown` → "**It has not been confirmed whether the client holds accounts outside this firm. Amounts below may be incomplete.**"

### The RMD trap, specifically

RMDs for traditional IRAs are computed per account but may be **aggregated and satisfied from any
one of them**. An advisor who sees two of a client's four IRAs can compute a perfectly correct
"RMD satisfied" for the two visible ones while the client has a real deficiency. The excise tax is
25% (10% if corrected in the correction window). The client will produce your document.

**Therefore:**

- The packet **never prints a conclusion** like "RMD satisfied ✓". It prints the components —
  prior 12/31 balance and its source, applicable age and divisor, calculated amount, distributions
  taken, QCDs applied, remaining — and lets the reader conclude.
- If `heldAwayRetirementAccounts !== 'none'`, the RMD section header is forced to
  **`CPA Review Required`** and prints: *"RMD aggregation across all of the client's IRAs cannot be
  confirmed from advisor records."*
- The prior-year 12/31 balance must show its source and date. A balance the advisor typed is
  `advisor_entered`, not `custodian_verified`.
- Employer plans do **not** aggregate with IRAs, and each 401(k) must satisfy its own RMD. If the
  household has both, print that distinction rather than a combined number.

### Form 8606 basis, per person

Master Spec §6 already forbids combining spouses' IRA basis. In an aggregation layer this is easy
to get wrong. Page 5 shows 8606 data **per individual**, labeled with the owner, with no household
subtotal. Add a test that fails on any household-level basis figure.

---

## 9. Pages

The requirements document's page-by-page field lists are **adopted as written** and are the
authority for which columns appear where. Pages 1–10 as specified. Not repeated here.

Three additions:

- **Every page** carries: household name, tax year, page N of M, report version, and the mode
  label from §2. **No name, firm, logo, or contact information — ever.** Add a test that fails if
  the rendered output contains an `advisorName` or `firmName` field.
- **Page 1** additionally carries the scope box (§8), the data as-of date and form-issuance status
  (§5.2), and the CPA Attention box.
- The mode label (§2) appears in the footer of every page in both modes.
- **Suppression**: a page renders only if at least one field in it is `verified` or `unknown`.
  All-`not_applicable` suppresses. The suppressed page list appears in the audit record so you can
  prove what the client did and did not receive.

---

## 10. CPA attention flags — a registry, not string literals

Mirror the discontinuity-registry pattern already in the repo.

```ts
// src/packet/flags/registry.ts
{
  id: 'FLAG_ROTH_CONVERSION',
  severity: 'informational' | 'review' | 'action_needed',
  title: 'Roth conversion completed',
  detail: (ctx) => `Total conversions of ${money(ctx.conversionTotal)} during ${ctx.taxYear}.`,
  trigger: (ctx) => ctx.conversionTotal > 0,
  authority: null,          // set ONLY if the flag encodes a tax rule
  isConclusion: false,      // MUST be false. Always.
}
```

Rules:

- Every flag on the requirements doc's list gets an id. Flags are **observations**, never
  conclusions — the type system enforces `isConclusion: false` and there is no other value.
- A flag whose trigger depends on a tax rule cites the rule and its version. A flag that is purely
  "this happened" cites nothing.
- **`unknown` data raises flags too.** Missing basis is a flag. Unconfirmed held-away accounts is a
  flag. Silence about an unknown is the failure mode this whole document exists to prevent.
- Flags sort by severity, then by dollar magnitude.
- Test: every registry entry has a fixture that triggers it and a fixture that does not.

---

## 11. Tax-treatment boundary

Adopted verbatim from the requirements doc. Restated as a build rule:

> A number may be **computed and presented as a tax result** only if the underlying rule exists in
> `src/rules/**` with a primary citation, is implemented in the validated engine, and is covered by
> passing fixtures. Otherwise the packet reports the **amount and its source** and states that
> treatment is for the tax professional.

| Never print | Print instead |
|---|---|
| "Advisory fees are deductible." | "Advisory fees paid: $4,850. Tax treatment to be determined by tax professional." |
| "Client owes $18,342." | "Estimated-tax review recommended due to Roth conversions and realized gains." |
| "RMD satisfied ✓" | the components (§8) |
| "Taxable portion of conversion: $X" *(unless 8606 inputs are complete)* | "Taxable portion of Roth conversion to be determined by tax professional." |
| "Form 8283 required." | "Noncash contribution over $5,000 — Form 8283 review suggested." |

Every computed figure in the packet carries its `ruleId` and rules-file version in the underlying
data, exactly as R5 already requires of engine output.

---

## 12. Report identity and supersession

A packet is an issued document. Treat it like one.

```
Report ID:  TCR-2026-{clientId}-v{n}
Version:    2         Generated: 2027-03-04
Supersedes: v1 (generated 2027-01-18)
Reason:     Corrected Form 1099 received for Account ...4471
```

- Version increments on every generation that goes out. Page 1 shows version, date, and what it
  supersedes.
- The audit record (§2) is written on every generation, superseded or not.
- Never silently reissue the same version number with different numbers inside it.

---

## 13. Fixtures and tests

Same discipline as Phase 0. **Fixtures are JSON; the runner is table-driven; adding a case never
means editing the runner.**

New fixture class: `tests/fixtures/packet/`.

**Synthetic households** (no real client data, ever — `CLAUDE.md` rule 6):

| Fixture | Exercises |
|---|---|
| `PKT-01` Simple | Two accounts, dividends only. Most pages suppress. Proves suppression works. |
| `PKT-02` Full retiree | RMD + QCD + conversion + gains + fees + withholding. The workhorse. |
| `PKT-03` Held-away unknown | Same as 02 with `heldAwayRetirementAccounts: 'unknown'`. RMD section must force `CPA Review Required`. |
| `PKT-04` Missing basis | Noncovered lots, `unknown` basis. Must render `—`, never `0`, and must flag. |
| `PKT-05` Verified zeros | Every optional field verified at `0`. Nothing may render as `—`, nothing may suppress. |
| `PKT-06` Cross-reference | One QCD. Must appear on P4 and P7 with a cross-reference and no double-count. |
| `PKT-07` Spousal basis | Both spouses hold 8606 basis. No household subtotal may appear. |
| `PKT-08` Corrected form | Generated in January; `CORRECTED_FORM_EXPECTED` must fire. |
| `PKT-09` Supersession | v2 after a corrected 1099. Header must name v1. |
| `PKT-10` Mode switch | `educational` renders the footer label; `client_delivery` without an approval record renders the watermark on every page. |

**Required tests**, beyond the requirements doc's list:

- `render` produces no arithmetic — lint/AST rule over `src/packet/render/**`.
- `src/packet/**` does not import `src/rules/**` or the legacy engine.
- Import is idempotent: importing the same file twice yields identical ledger state.
- Every flag in the registry has a positive and a negative fixture.
- Golden-file snapshot of rendered HTML for `PKT-02`, so layout regressions are visible in a diff.
- Print check: `PKT-02` renders to PDF with no clipped table columns.

---

## 14. Phase plan — Track B, parallel to the engine work

Read-only against the engine, so it does not block or get blocked by Phases 3–5.

| Phase | Deliverable | Exit criterion |
|---|---|---|
| **B0** | Ledger + provenance + value-state types. Compliance gate and watermark. Ten fixtures with expected page-level output. **No renderer.** | Fixtures exist; suite red |
| **B1** | Ledger, importers (CSV), aggregation queries, section-status derivation | PKT-01…07 pass at the data layer |
| **B2** | Flag registry + triggers | Every flag has a passing positive and negative fixture |
| **B3** | Renderer + print CSS. Zero arithmetic. | Golden file matches; PDF clean; PKT-08…10 pass |
| **B4** | *Only if the tool ever moves to client delivery* — compliance review, then the approval record | A human signs the attestation |

**B0 ends with a red suite**, same as Phase 0. Same reason.

### Session prompt — B0

```
Read CLAUDE.md, then cpa-packet/CPA-PACKET-SPEC.md. Branch: track-b-0-ledger.

This is a READ-ONLY layer over the engine. You will not modify src/engine or src/rules.

1. Create src/ledger/types.ts and src/packet/types.ts from cpa-packet/types/packet-types.ts.
2. Implement the output-mode switch (spec section 2): `educational` default with a footer
   label, `client_delivery` with the watermark and audit record.
3. Author the ten PKT fixtures in tests/fixtures/packet/ with expected page-level output.
   Synthetic data only.
4. Add the two guard tests: src/packet must not import src/rules or the legacy engine.
5. Run the suite.

EXPECTED: all red. Do not implement the ledger or the renderer.

Report: confirmation that no file under src/engine or src/rules was modified.
```

---

## 15. Out of scope for v1 — do not scaffold these

- **Custodian API integration.** You will not get API access. The realistic path is CSV import of
  reports you can already download. Build the importer against a CSV you actually have.
- Tax-return preparation, in any form.
- e-delivery, client portal, or CPA portal.
- Multi-year packets. One tax year per document.
- OCR of 1099s.

---

## A closing observation

This is a data-provenance problem wearing a reporting problem's clothes. The hard part is not the
eight pages; it is that the advisor holds seven grades of knowledge about the client's money and
the profession's normal habit is to print all of them in the same font.

The packet's actual product is not the numbers. It is the CPA being able to tell, at a glance,
which numbers they can rely on and which ones they need to go get. Build for that and the rest
follows.

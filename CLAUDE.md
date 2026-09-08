# CLAUDE.md — Roth Conversion & Lifetime Tax Planning Engine

Claude Code loads this file automatically every session. It is the standing contract for this repository. Read it before doing anything.

---

> ## ⚠️ Repo status reconciliation — read first (added 2026-09-08)
>
> This standing contract was authored against the early Phase-0 snapshot. The engine track
> ("Track A") has since advanced past several statements below. The rules below still govern; these
> are factual corrections so no session is misled:
>
> - **§2 — `roth-conversion-projector.html` no longer exists.** It was consolidated into `index.html`
>   (the single deployed page) at the owner's direction. "Do not rewrite the prototype" now applies to
>   `index.html` and the legacy engine inlined into it (`src/engine/legacy/projectorEngine.ts`).
> - **§8 — OPEN-1 and OPEN-2 are RESOLVED** (with citations), by owner decision: exact brackets vs.
>   the <$100k Tax Table, and carry-cents rounding. See `docs/tax-rules/modeling-decisions.md`. No
>   open rule decisions remain.
> - **§9 — the optimizer IS built and deployed** (Phase 5, the "Optimal conversion" panel on the live
>   page), at the owner's direction, on the validated engine. Phases 0–5 are complete and hardened;
>   engine version `0.3.0-hardening`, suite 94/94, CI gating.
> - **Reading-order docs not present in this repo:** `CLAUDE-CODE-ADDENDUM.md` and
>   `PHASE-0-FIXTURE-SPEC.md` were never committed here. `MASTER-BUILD-SPEC.md` present is the
>   Track-A build reference generated this session, which may differ from the "background
>   requirements" doc §1 refers to.
> - **Track B ASSETS are installed (2026-09-08); the MODULE is not built yet.** Installed:
>   `cpa-packet/` specs+types+specimen (at repo root, matching §8.5's `cpa-packet/` paths — NOT
>   `docs/cpa-packet/`), the five new `src/rules/federal/*.json`, `tests/fixtures/inheritance/`
>   (16, not yet runner-wired — await B1a), `tests/fixtures/differential/DIFF-EJ-01`, and
>   `tests/fixtures/rmd/RMD-09..11`. Engine fixtures now 66/66; suite 98/98. **Still missing from the
>   bundle:** the updated `tools/oracle.py` (ULT reaches only 90 here, so RMD-10/11 at ages 95/100 are
>   engine-verified but not independently oracle-generated) and the updated `tools/build_fixtures.py`
>   (does not emit RMD-09..11 or DIFF-EJ-01 — they are preserved in INDEX by a merge shim). The
>   `src/ledger/**` and `src/packet/**` module code does not exist — that is sessions B0→B3.

---

## 1. Reading order — earlier document always wins

1. **This file** (`CLAUDE.md`) — standing rules
2. `CLAUDE-CODE-ADDENDUM.md` v1.1 — controlling build document
3. `PHASE-0-FIXTURE-SPEC.md` — the test oracle
4. `MASTER-BUILD-SPEC.md` — background requirements

Where any two conflict, the earlier one controls. Say so explicitly when you notice a conflict; do not silently pick one.

---

## 2. What this project is

A fiduciary-grade Roth conversion planning engine used with **real clients** by a CFP-level planner. Wrong numbers here produce wrong tax advice and real financial harm. This is not a demo.

The existing app is `roth-conversion-projector.html` — a working single-file prototype with no tests. **It is not to be rewritten.** It is to be extracted, hardened, and validated.

---

## 3. The five hard rules

**R1 — The engine is a pure module with zero I/O.**
Everything in `src/engine/` is pure TypeScript: no `fetch`, no `localStorage`, no DOM, no `Date.now()`, no file access, no network. Input is one plain object, output is one plain object. Inject the tax year and any dates as parameters.

**R2 — Client data never leaves the browser.**
This deploys to GitHub Pages as a static site. No backend, no analytics, no telemetry, no error reporting, no autosave, no third-party scripts. There is nothing to breach because nothing is transmitted. Do not add a dependency that phones home.

**R3 — Every tax constant lives in a versioned JSON rules file with `sourceUrl` and `verifiedDate`.**
No magic numbers in `src/engine/`. A constant with no cited source does not ship.

**R4 — The order of operations is frozen, and visible in the output.**
```
1  gross income (incl. Roth conversion)
2  provisional income
3  taxable Social Security          <- depends on income, NOT on deductions
4  AGI
5  the four MAGIs, computed SEPARATELY:
     magi.irmaa  = AGI + tax-exempt interest
     magi.niit   = AGI + foreign earned income exclusion
     magi.aca    = AGI + tax-exempt interest + NON-taxable SS + FEIE
     magi.senior = AGI + 911/931/933 exclusions
6  deductions: standard|itemized -> senior bonus (phased) -> QBI -> charitable floor
7  taxable income -> ordinary vs preferential split
8  bracket stacking: ordinary fills brackets first, preferential stacks on top
9  NIIT, AMT, additional Medicare tax
10 state tax
11 IRMAA (year N+2), ACA credit loss (year N)
```
Use branded/nominal TypeScript types so one MAGI cannot be passed where another is expected. Return every intermediate value — see R4a in the addendum.

**R5 — Every output carries provenance.**
`calculationMetadata` (engine version, each rules-file version, calculation date, tax year, law mode) plus a `ruleId` on every major calculated line. This is how the UI answers "why is taxable Social Security $18,422?" without an AI.

---

## 4. Never guess a tax rule

If you cannot establish authoritative treatment from a primary source:

```
STOP — TAX RULE REQUIRES REVIEW
Rule:        <what you were trying to determine>
Why blocked: <what you could not confirm>
Sources checked: <urls>
Recommended authority to consult: <irs form / reg / pub>
```

Emit `UNKNOWN`, surface a visible banner in the UI, and stop. **Never synthesize a plausible-looking formula.** A confident wrong number is far worse here than a blocked one.

Source hierarchy: Internal Revenue Code → Treasury Regulations → IRS Revenue Procedures/Notices → IRS forms & instructions → IRS publications → CMS → SSA → state revenue departments. Secondary sites may help you *locate* a rule; they are never the authority.

---

## 5. Rules of engagement

1. **One phase per branch, one branch per session.** Do not begin phase N+1 until phase N's exit criterion is met. Phases are defined in the addendum §4.
2. **No engine change without a failing test first.** Red → green → commit. If you are about to change calculation behavior and no test currently fails, write the failing test first and show it failing.
3. **Never refactor the UI in the same commit as an engine change.** Separate commits, ideally separate sessions.
4. **`tools/oracle.py` and `src/engine/` must never import from each other, in either direction.** The oracle is the independent check. If they share code, every test in this repo becomes worthless. Do not "DRY up" this duplication — it is deliberate.
5. **Do not edit fixture expected values to make tests pass.** If you believe a fixture is wrong, stop and say so with a citation. Changing the oracle to match the engine is the single worst thing you can do in this repository.
6. **No client data ever.** No real names, SSNs, account numbers, tax returns, `.env` files, or API keys. Synthetic fixtures only.
7. **When a tax rule is implemented, write its `docs/tax-rules/*.md` entry in the same PR:** Rule → Formula → Authority → Applicable years → Edge cases → Implementation → Tests.
8. **Ask before adding any dependency.** This project's dependency budget is near zero: TypeScript, Vitest, and a bundler. That is the list.

---

## 6. Kink vs. jump — enforce this distinction

- **Kinks** change the *slope* of the cost curve: bracket boundaries, the Social Security phase-in, the senior-deduction phaseout. They are smooth and continuous. **They do not belong in the discontinuity registry.**
- **Jumps** change the *level*: IRMAA tier boundaries, the ACA 400% FPL cliff. These are true discontinuities and every one must register a rule ID in `src/rules/discontinuities.ts`.

Confusing the two makes the tool report phantom cliffs to clients. Do not add a rule ID to the registry unless crossing it moves the level, not the slope.

---

## 7. Property-test philosophy

The invariant is **no unexplained movement** — not that any curve has a particular shape. Do not assert universal monotonicity; once credits, carryforwards, ACA, and state interactions are in the model, that assertion is too broad. Assert instead that every movement is explained by an enumerated deterministic rule, and that anything unexplained is a bug. See `PHASE-0-FIXTURE-SPEC.md` §5 for P1–P6.

---

## 8. Two open rule decisions — do not silently resolve these

- **OPEN-1 — Schedule 1-A rounding convention** for the senior deduction phaseout. Fixtures currently carry unrounded cents. Resolve against form instructions, record as `SENIOR_BONUS_DEDUCTION.roundingPolicy`, regenerate fixtures. Does not block Phase 1.
- **OPEN-2 — Tax Table vs. Tax Computation Worksheet.** All fixtures use exact bracket arithmetic. Real returns under $100,000 of taxable income use the Tax Table (midpoint of a $50 band), so historical validation may diverge by a few dollars. **That is the Tax Table, not a bug.** Document the tolerance; do not chase it.

Items marked `RE_VERIFY_BEFORE_SHIPPING` in the rules JSON must be cleared with a primary citation or remain visibly flagged in the UI. Do not quietly clear a flag.

---

## 8.5 Track B — the CPA Tax Coordination Packet

A separate READ-ONLY reporting layer. Spec: `cpa-packet/CPA-PACKET-SPEC.md`. Five standing rules:

1. **`src/packet/**` never imports `src/rules/**`,** and never imports the legacy engine. The
   validated engine only — the legacy engine omits the senior deduction and omits dividends from
   Social Security provisional income.
2. **One append-only ledger; every page is a query over it.** Pages never hold their own numbers.
3. **The renderer performs no arithmetic.** It formats finished values.
4. **`unknown` renders as an em dash, never as `0`.** A verified zero and an unknown are different
   documents to a CPA.
5. **The packet reports amounts and sources. It never states tax treatment** unless the rule is in
   `src/rules/**` with a citation, implemented in the validated engine, and covered by fixtures.

**Inheritance module** (`cpa-packet/INHERITANCE-MODULE-SPEC.md`): `BasisModel` is a discriminated
union on step-up eligibility. IRD assets — inherited traditional IRA, 401(k), 403(b), accrued
compensation — receive **no basis adjustment at all** under IRC 1014(c), and their branch of the
union has **no `taxBasis` field**. Copying a date-of-death value into basis must be a compile error,
not a bug caught in review.

**Output mode.** This project is educational — a tool for modeling and teaching tax-coordination
mechanics on synthetic households. It is not an advisor-signed, sealed, delivered document. The
default mode is `educational` and carries a light footer label; no attestation or approval ceremony
is required. **The output carries no individual name, no firm name, no logo and no letterhead** —
there are no `advisorName` or `firmName` fields in the data model at all, so branding cannot be
added by editing a template. A separate `client_delivery` mode exists so that if the tool ever crosses into real
client use the obligations attach at the switch rather than needing a retrofit. Build in
`educational` mode.

---

## 9. Things that are explicitly NOT in scope for v1

Do not build these, do not scaffold them, do not "prepare for" them:

- Tax-return parsing / OCR (Master Spec §3–4). Manual entry is fine for v1.
- State tax beyond the advisor's top three states.
- The AI explanation layer (Master Spec §34).
- Detailed beneficiary tax-arbitrage modeling beyond a single assumed-rate input.
- The optimizer, until Phases 0–4 are validated.

If you think one of these is needed to proceed, say so and stop — do not start it.

---

## 10. Commits and PRs

- Conventional commits: `feat(engine):`, `fix(rules):`, `test(fixtures):`, `docs(tax-rules):`.
- A commit touching a tax calculation must reference the authority in its body.
- **Never merge a tax calculation change unless:** (1) the authoritative source is documented, (2) tests exist, (3) all regression tests pass.
- Maintain `CHANGELOG-TAX-RULES.md` — every rules-file version bump gets an entry with the citation and the reason.

---

## 11. Definition of done for v1

For one married retired household, entered manually, the tool answers with sourced math:

1. Convert or not, this year?
2. How much — as a **range** with a preferred target?
3. What is the binding constraint that stops it there? (bracket / IRMAA tier / ACA cliff / SS torpedo / senior-deduction phaseout / NIIT)
4. What does doing nothing cost over the plan horizon?
5. What is the crossover year?
6. What happens if the higher-earning spouse dies first?

Nothing else. Resist scope expansion until these six are bulletproof.

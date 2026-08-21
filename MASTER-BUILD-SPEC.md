# MASTER BUILD SPEC — Retirement Tax Planning Engine

The authoritative reference for what this repository is, the rules it is built under, how it is
structured, and how to verify or extend it. If any other document conflicts with this one, the
non-negotiable rules in §1 win.

**Status (2026-08-21):** Phases 0–5 complete + hardening pass. 90/90 tests green, CI gating.
Engine version `0.3.0-hardening`. No open rule decisions.

---

## 1. Non-negotiable rules (R1–R5)

These are invariants, not preferences. Tooling enforces several of them; the rest are review gates.

- **R1 — Deterministic, auditable engine.** The engine is pure TypeScript with no hidden state,
  no network, no randomness in the tax math. Same inputs → same outputs, to the cent.
- **R2 — Independent oracle.** `tools/oracle.py` reproduces the IRS worksheets **by hand** and must
  **never import `src/engine`** (and vice versa). The duplication is deliberate: two independent
  implementations that must agree. Fixtures are generated from the oracle, never from the engine.
- **R3 — Versioned, sourced constants.** Every tax constant lives in `src/rules/**/<year>.json` with
  authority and provenance. The engine reads them only through `src/engine/rules.ts`. No tax numbers
  are hard-coded in the calculators (enforced by the magic-number guard, §6).
- **R4 — Never guess a tax rule.** If a rule or value is unknown, the engine emits an explicit
  NOT-MODELED / UNKNOWN signal and the number is flagged — it is never fabricated. The frozen order
  of operations (§4) is fixed and not reordered for convenience.
- **R5 — Never edit fixtures to pass.** A fixture expected value is ground truth. If the engine
  disagrees, either the engine is wrong (fix it) or the fixture is wrong (stop, document with a
  citation, get a decision, fix it **at the generator**). See `docs/tax-rules/RMD-08-discrepancy.md`
  for the one time this happened.

Plus the operational constraints: no client data / real names / SSNs / API keys in the repo; client
data never leaves the browser (no backend, analytics, or telemetry); develop on the designated
branch; do not open a PR unless asked.

---

## 2. What the engine computes

A single-year federal return and the multi-year, two-life consequences of Roth conversions:

- **Single-year federal (Phase 2):** gross income → provisional income → taxable Social Security
  (IRC 86) → AGI → four separate MAGIs → deductions (standard/itemized + age-65 + OBBBA senior
  bonus) → taxable income → ordinary tax + Qualified Dividends & Capital Gain stacking → NIIT.
  Plus IRMAA tier lookup, ACA 400% FPL cliff, and RMD amount/ordering.
- **Marginal conversion sweep (Phase 3):** incremental federal tax + IRMAA + ACA credit loss +
  state + total economic cost across a $0→cap conversion, with every inflection labeled by cause
  and rule id (kinks vs registry-tracked jumps).
- **Lifetime projection (Phase 4):** year-by-year to a horizon with SS COLA, pensions, per-spouse
  RMDs, conversions, growth, inflation-adjusted spending, the survivor transition at first death,
  and after-tax wealth valued two ways (beneficiary 10-year drawdown primary; flat haircut).
- **Optimizer (Phase 5):** the annual conversion amount maximizing lifetime after-tax wealth, as a
  **range** with a preferred target, the **binding constraint by rule id**, why-not-more/less,
  expected benefit, crossover year, and a sensitivity grid.
- **State tax (hardening):** v1 flat-rate — no-tax states at 0%, advisor-supplied rate otherwise,
  never guessed.

---

## 3. Directory map

```
src/
  engine/               pure TS engine (read rules only via rules.ts)
    rules.ts            typed accessors over the rules JSON (the only rules entry point)
    types.ts            branded MAGIs, YearInput/Result, CalculationMetadata
    money.ts            cents() rounding
    calculateSocialSecurity.ts  IRC 86 two-tier worksheet
    calculateDeductions.ts      standard/itemized + age-65 + OBBBA senior (Schedule 1-A)
    calculateTax.ts             ordinary brackets + QDCG stacking worksheet
    calculateNIIT.ts            IRC 1411
    calculateYear.ts            computeYear — the frozen R4 orchestration
    calculateIRMAA.ts           tier lookup (inclusive magiMax, per enrollee)
    calculateACA.ts             400% FPL cliff
    calculateRMD.ts             applicable age (SECURE 2.0) + ULT + first-dollars-out ordering
    calculateState.ts           v1 flat-rate resolver (never guesses)
    sweepConversion.ts          Phase 3 marginal sweep + adaptive refinement
    projectLifetime.ts          Phase 4 projection + survivor + crossover
    optimizeConversion.ts       Phase 5 optimizer
    notImplemented.ts           explicit UNKNOWN/STOP helper (R4)
    legacy/projectorEngine.ts   verbatim port of the ORIGINAL projector (@ts-nocheck; the engine
                                currently inlined into the live page — see §8)
  rules/
    federal/2026.json   Rev. Proc. 2025-32 + OBBBA; SS/NIIT/senior/RMD tables
    medicare/2026.json  CMS 2026 IRMAA tables
    aca/2026.json       IRC 36B cliff + HHS 2025 FPL
    state/2026.json     v1 no-income-tax list + advisor-rate mechanism

tools/
  oracle.py             INDEPENDENT hand-traced IRS worksheets (never imports the engine)
  build_fixtures.py     generates the 62 fixtures + INDEX.json from the oracle
  check-magic-numbers.mjs  CI guard: no stray numeric literals in src/engine/**
  build-site.mjs        inlines legacy/projectorEngine.ts into index.html (build-and-inline)

tests/
  unit/fixtures.test.ts   loads INDEX.json, dispatches per folder, asserts within tolerance
  unit/sweep.test.ts      Phase 3 — no unexplained marginal movement
  unit/lifetime.test.ts   Phase 4 — hand-checked year-by-year + survivor + crossover
  unit/optimize.test.ts   Phase 5 — range / binding constraint / sensitivity
  unit/state.test.ts      state resolver + lifetime integration
  property/properties.test.ts  P1–P6 invariants
tests/fixtures/           62 fixtures across 7 folders (see §5)

docs/tax-rules/
  README.md               rule-by-rule: Rule → Formula → Authority → Years → Edge cases → Tests
  modeling-decisions.md   OPEN-1 (rounding) + OPEN-2 (Tax Table vs Worksheet), resolved
  RMD-08-discrepancy.md   the one fixture discrepancy, resolved at the generator
```

---

## 4. Frozen order of operations (R4) and the four MAGIs

`computeYear` (`calculateYear.ts`) executes, in order: gross income → provisional income → taxable
Social Security → AGI → **four separate MAGIs** → deductions → taxable income → ordinary/preferential
split & stacking → NIIT. Intermediate values are returned (the "R4a" shape) and asserted by fixtures.

The four MAGIs are distinct and must not be interchanged:

| MAGI | Adds to AGI | Used by |
|---|---|---|
| IRMAA | tax-exempt interest | Medicare surcharge tiers (2-yr lookback) |
| NIIT | (AGI-based, per Form 8960) | 3.8% net investment income tax |
| ACA | tax-exempt interest + **non-taxable** SS + excluded FEIE | 400% FPL premium-credit cliff |
| Senior | tax-exempt interest (per Schedule 1-A) | OBBBA senior-deduction phaseout |

A Roth conversion is ordinary income: it raises all four MAGIs but is **not** net investment income.

---

## 5. Fixtures (62) — the oracle's ground truth

Generated by `tools/build_fixtures.py` from `tools/oracle.py` into `tests/fixtures/` + `INDEX.json`.

| Folder | Count | Covers |
|---|---|---|
| federal | 6 | end-to-end single-year returns |
| social-security | 11 | IRC 86 tiers, torpedo, phase-in, ceiling |
| senior-deduction | 14 | OBBBA Schedule 1-A phaseout (6%/person → 12% MFJ) |
| capital-gains | 10 | QDCG 0/15/20 stacking, NIIT interaction, triple compound |
| aca | 5 | 400% FPL cliff boundary |
| irmaa | 8 | tier boundaries (inclusive), per-enrollee |
| rmd | 8 | applicable age bands + ULT + first-dollars-out ordering |

Regenerate with `npm run fixtures:regen`. A regeneration must byte-diff to **nothing** unless a
generator change was intended and reviewed.

---

## 6. Invariants enforced by tooling

- **Magic-number guard** (`npm run lint:magic`): walks `src/engine/**` (skips `legacy/`) and fails on
  any numeric literal outside `{-1, 0, 1, 2, 100}`. Forces every tax number into the rules JSON (R3).
- **Fixture suite**: every fixture asserted within its stated tolerance (gating in CI).
- **Property tests P1–P6**: structural invariants (e.g., monotonicities, registry-tracked
  discontinuities, provenance present). The Phase 3 "no unexplained marginal movement" property
  caught two real modeling bugs during the build.
- **Typecheck** (`npm run typecheck`): strict TS, including `noUncheckedIndexedAccess`.

CI (`.github/workflows/ci.yml`): `lint:magic` + `typecheck` gate, then the full `npm test` gates.

---

## 7. Data provenance & verification

Every rules file carries `verifiedDate`, `verifiedBy`, authority, and `sourceUrl`.

- **`verifiedBy: PENDING_ADVISOR_REVIEW`** on every file — a human advisor sign-off is a **required
  gate** before client use and has not happened.
- **Machine verification (2026-08-21):** every numeric value in the federal, medicare, aca, and state
  files was cross-verified against multiple independent secondary sources reproducing the official
  releases (Rev. Proc. 2025-32 / IR-2025-103; CMS 2026 fact sheet pub. 2025-11-14; HHS 2025 poverty
  guidelines; OBBBA / P.L. 119-21). The primary `.gov` pages are egress-blocked from the build
  environment, so this is corroboration-by-secondary-source plus internal consistency — **not** a
  substitute for advisor sign-off. Recorded in each file's `machineVerification` field.

**Resolved decisions:** OPEN-1 (Schedule 1-A rounding → carry cents) and OPEN-2 (Tax Table vs Tax
Computation Worksheet → exact brackets everywhere), both in favor of exact computation with a
disclosed ≤~$6/yr and <$1/line divergence from a hand-filed 1040 (`modeling-decisions.md`).

---

## 8. Deployment status

- **Live site** (`index.html`, GitHub Pages at murphsmurph.github.io/Roth-Conversion/) currently
  runs the **legacy** engine (`src/engine/legacy/projectorEngine.ts`, inlined by `build-site.mjs`).
- **The validated Phase 2–5 engine is NOT yet wired into the page.** It is fully built, tested, and
  documented, but the UI still shows legacy math. Wiring it in is the natural next project (a product
  decision, not a defined phase).

---

## 9. What is NOT modeled (v1)

State progressive brackets / retirement-income exclusions / state SS treatment / state
Roth-conversion rules / local taxes / state capital gains (only the flat-rate model above);
taxable-account dividend/gain drag (simplified); AMT; QBI beyond a passthrough input; estate tax;
gift strategies. Each is disclosed in the optimizer's data-quality panel.

---

## 10. How to build, test, verify, extend

```
npm install
npm run typecheck          # strict TS
npm run lint:magic         # no stray tax numbers in the engine
npm test                   # 90/90: fixtures + properties + phase + state units
npm run fixtures:regen     # regenerate fixtures from the oracle (should byte-diff to nothing)
npm run build              # vite build
node tools/build-site.mjs  # inline the (legacy) engine into index.html
```

**Adding / updating a tax constant:** edit the rules JSON (with authority + sourceUrl +
verifiedDate), add a `rules.ts` accessor, and add or update a fixture via the oracle — never
hard-code the number in a calculator.

**A new tax year:** add `src/rules/**/<year>.json`, regenerate fixtures for that year, bump the
rules `ruleSetId`. Engine code should not need to change for pure inflation adjustments.

**A law change (the architecture test):** e.g., if the ACA enhanced credits are extended, bump
`src/rules/aca/<year>.json` (`subsidyCliff.active`) — **no engine code change should be required.**
That is the test of whether R3 was done correctly.

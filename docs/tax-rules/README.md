# Tax-rule documentation — Phase 2 (single-year federal engine)

Each implemented rule: **Rule → Formula → Authority → Applicable years → Edge cases → Tests.**
All constants live in `src/rules/**` (R3); the engine reads them via `src/engine/rules.ts`.
Tax year 2026, `current_law`. `verifiedBy: PENDING_ADVISOR_REVIEW` on every rules file — a human
advisor sign-off is still a required gate before client use.

**Machine verification pass (2026-08-21).** Every numeric value across the federal, medicare, and aca
rules files was cross-verified against multiple independent secondary sources reproducing the
official releases (Rev. Proc. 2025-32 / IR-2025-103; CMS 2026 fact sheet pub. 2025-11-14; HHS 2025
poverty guidelines; OBBBA / P.L. 119-21). All formerly-flagged `RE_VERIFY_*` constants
(IRMAA tables, non-itemizer charitable deduction, itemized 2/37 benefit cap, QCD limit) now agree
with source and are marked `*_CROSS_VERIFIED_2026-08-21`. The primary `.gov` pages were
egress-blocked from the build environment, so this is corroboration-by-secondary-source plus internal
consistency, **not** a substitute for the advisor sign-off. See each file's `machineVerification` field.

## Frozen order of operations (R4)
`computeYear` (`src/engine/calculateYear.ts`) executes: gross income → provisional income → taxable
Social Security → AGI → four MAGIs (separate) → deductions → taxable income → ordinary/preferential
split & stacking → NIIT. Intermediate values are returned (R4a) and asserted by fixtures.

## Rules implemented

### IRC_86_SS_TAXABILITY — taxable Social Security
- **Formula:** Social Security Benefits Worksheet, two-tier (50%/85%). Provisional income depends on
  income only, not deductions.
- **Authority:** IRC 86; Form 1040 SS Benefits Worksheet. **Years:** unindexed (base amounts fixed).
- **Edge cases:** tax-exempt interest enters provisional income but not AGI (SS-07); the 85% ceiling
  caps inclusion (SS-05); the torpedo applies inside the phase-in band (SS-08) and NOT after the
  ceiling (SS-09 control).
- **Tests:** `social-security/SS-01..09`. Engine: `calculateSocialSecurity.ts`.

### ORDINARY_BRACKETS_2026 + QDCG stacking
- **Formula:** progressive ordinary brackets fill first; QD + LTCG stack on top at 0/15/20% via the
  Qualified Dividends & Capital Gain Tax Worksheet (never computed separately and added).
- **Authority:** IRC 1(j), 1(h); Rev. Proc. 2025-32; QDCG worksheet. **Years:** 2026 (held flat).
- **Edge cases:** 0/15 straddle (CG-02); NIIT interaction (CG-03/04); the triple compound
  (CG-08 → 49.348% effective marginal on a 22% bracket).
- **Tests:** `federal/*`, `capital-gains/*`. Engine: `calculateTax.ts`.

### OBBBA_SENIOR_DEDUCTION — senior bonus deduction
- **Formula:** $6,000 per qualifying individual 65+, phased at **6% per person** on MAGI_SENIOR over
  the start ($150k MFJ / $75k single). Schedule 1-A computes one line-35 amount entered on BOTH 36a
  and 36b, so two 65+ spouses phase out at **12% combined**. Below the line — reduces taxable income
  only, never AGI or any MAGI.
- **Authority:** IRC 151(d)(5) as added by P.L. 119-21 (OBBBA); Schedule 1-A. **Years: 2025–2028 only**
  (`doNotExtrapolate`).
- **Edge cases:** SD-03 first phaseout dollar → **$11,999.88** (12%, not 6%); SD-13 does not move AGI.
  **OPEN-1** (Schedule 1-A rounding) is **RESOLVED**: carry cents, no intermediate whole-dollar
  rounding — see `modeling-decisions.md`.
- **Tests:** `senior-deduction/SD-01..13`. Engine: `calculateDeductions.ts`.

### IRC_1411_NIIT — net investment income tax
- **Formula:** 3.8% × min(net investment income, MAGI_NIIT − threshold). A Roth conversion is NOT in
  the NII base but raises MAGI. **Authority:** IRC 1411; Form 8960. **Years:** unindexed.
- **Tests:** `capital-gains/CG-03..08`. Engine: `calculateNIIT.ts`.

### IRMAA_2026_TIERS — Medicare surcharge
- **Formula:** tier by MAGI_IRMAA (2-yr lookback, magiMax inclusive); annual = ((partB − standard) +
  partD) × 12 × enrollees. Per enrollee, not per household. **Authority:** CMS 2026 fact sheet
  (pub. 2025-11-14). **Status:** all tier premiums, Part D amounts, and MAGI thresholds
  cross-verified 2026-08-21 (advisor sign-off still pending).
- **Edge cases:** boundary at exactly magiMax stays lower (IRMAA-01); per-enrollee, not doubled
  (IRMAA-08). **Tests:** `irmaa/IRMAA-01..08`. Engine: `calculateIRMAA.ts`.

### ACA_36B_400FPL_CLIFF — premium tax credit cliff
- **Formula:** MAGI_ACA (AGI + tax-exempt interest + **non-taxable** SS + FEIE); eligible iff MAGI ≤
  400.00% FPL; one dollar over → credit $0. A true JUMP (in the discontinuity registry).
- **Authority:** IRC 36B; Form 8962; HHS 2025 FPL. Enhanced subsidies expired 2025-12-31; watch item
  H.R. 5145 (not enacted). **Tests:** `aca/ACA-01..05`. Engine: `calculateACA.ts`.

### SECURE20_RMD_APPLICABLE_AGE + ULT
- **Formula:** applicable age by birth year (≤1950→72, 1951–1959→73, 1960+→75); RMD = prior-year-end
  balance ÷ Uniform Lifetime Table divisor for age at year end.
- **Authority:** SECURE 2.0 sec. 107; T.D. 10001, 89 FR 58886; Treas. Reg. 1.401(a)(9)-9(c).
- **Tests:** `rmd/RMD-01..08` (pass). `rmd/RMD-08` was a flagged discrepancy, now **RESOLVED at
  the generator** — see `RMD-08-discrepancy.md`. Engine: `calculateRMD.ts`.

## Status
62/62 fixtures + 6/6 property tests pass; the CI suite is gating. Both former open rule decisions
are now resolved with citations — **OPEN-1** (senior rounding) and **OPEN-2** (Tax Table vs. Tax
Computation Worksheet) both resolved in favor of exact, unrounded computation; see
`modeling-decisions.md`. No open rule decisions remain.

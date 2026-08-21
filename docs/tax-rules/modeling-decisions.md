# Resolved modeling decisions — OPEN-1 and OPEN-2

Two items were carried as open rule decisions during the Phase 0–2 build. Both concern *how
faithfully a planning engine should replicate the whole-dollar / bucketed rounding that appears on
an individually filed paper Form 1040* — not an unknown tax rate. Both are resolved here **in favor
of exact, unrounded computation**, with citations and the disclosed divergence from a filed return.

Neither resolution changes engine code: the engine (`calculateTax.ts`, `calculateDeductions.ts`) and
the independent oracle (`tools/oracle.py`) already compute this way, and the passing fixtures
(`federal/*`, `capital-gains/*`, `senior-deduction/*`) already lock the behavior in. Resolving them
is a matter of recording the decision and removing the "OPEN" flag.

---

## OPEN-2 — Tax Table vs. Tax Computation Worksheet → **RESOLVED: exact brackets at all income levels**

**The choice.** On a filed return, taxable income **under $100,000** must be looked up in the IRS
**Tax Table**, which taxes the **midpoint of a $50 band**; at or above $100,000 the **Tax
Computation Worksheet** (exact bracket math) is used. This engine uses the exact Tax Computation
Worksheet method at **every** income level.

**Why.**
1. **Bounded, tiny effect.** The Tax Table vs. exact-bracket difference is at most one $50 band times
   the marginal rate (≤ ~$18.50; typically ~$6).
2. **The bucketing is rounding noise that corrupts marginal analysis.** The whole point of the
   Phase 3 marginal sweep is to attribute *every* change in marginal cost to a *named tax rule*. The
   Tax Table's $50 steps are attributable to no rule; modeling them would inject spurious
   discontinuities into the sweep and the optimizer's binding-constraint logic.
3. **Consistency across a multi-decade projection.** Exact brackets are smooth and monotone; the
   lifetime projection and optimizer depend on that.
4. **Standard practice.** Professional planning software computes on exact brackets.

**Authority.** IRS Form 1040 Instructions — *Tax Table* and *Tax Computation Worksheet* sections;
Rev. Proc. 2025-32 (2026 bracket thresholds). Bracket rates live in `src/rules/federal/2026.json`.

**Disclosed divergence.** For a single year with ordinary taxable income < $100,000, this engine may
differ from a filed return by up to ~$6 (rarely more) purely from the Tax Table's midpoint
bucketing. This is intentional and is not a modeling error.

---

## OPEN-1 — Schedule 1-A rounding → **RESOLVED: carry cents; no intermediate whole-dollar rounding**

**The choice.** Whether to round the OBBBA senior-deduction phaseout (Schedule 1-A, Part V,
lines 33–36b) to whole dollars at each step, or carry full cents. This engine carries cents; the
line-35 per-person amount is `max(0, $6,000 − excess × 6%)` with no rounding, so the first phaseout
dollar produces the exact **$11,999.88** (12% combined for two qualifying spouses), which the SD-03
fixture asserts.

**Why.**
1. **Whole-dollar rounding on Form 1040 is optional, not required.** The Form 1040 Instructions
   ("Rounding Off to Whole Dollars") let a taxpayer *choose* to drop cents, and if they do they must
   round every amount. It is a filing convenience, not a computational rule, and moves any single
   line by less than $1.
2. **Precision compounds correctly.** Rounding intermediate lines would inject sub-dollar artifacts
   that propagate through four separate MAGIs and a multi-decade projection; carrying cents avoids
   that.
3. **Brand-new form, no special rounding step.** The senior deduction applies only to tax years
   **2025–2028** (OBBBA); the draft Schedule 1-A prescribes no rounding beyond the general
   whole-dollar option.

**Authority.** IRC 151(d)(5) as added by P.L. 119-21 (OBBBA); Schedule 1-A (Form 1040), Part V;
Form 1040 Instructions, "Rounding Off to Whole Dollars." Constants live in
`src/rules/federal/2026.json` (`OBBBA_SENIOR_DEDUCTION`).

**Disclosed divergence.** A filed return that elects whole-dollar rounding may differ from this
engine by less than $1 per affected line. This is intentional.

---

## Net effect

Both decisions favor exactness and are already enforced by the passing fixture suite. They are
surfaced in the calculator's assumptions / data-quality disclosures so an advisor and client see
that projected figures are computed on exact brackets and full cents, and may differ by a few
dollars from a hand-filed 1040 that uses the Tax Table and whole-dollar rounding.

# FLAGGED FIXTURE DISCREPANCY — `rmd/RMD-08`

Per CLAUDE.md Rule 5 ("if you believe a fixture is wrong, stop and say so with a citation; do NOT
edit the fixture"), this documents a disagreement between the engine and fixture RMD-08. The fixture
is **unmodified**; the engine follows the standard rule; RMD-08 is left failing pending a decision.

## The disagreement
`rmd/RMD-08` input: `birth_year: 1952`, `tax_year: 2026`, `prior_year_end_balance: 1,000,000`.

| Quantity | Fixture expects | Engine computes |
|---|---|---|
| `rmd_required_first` | **40,650.41** | **39,215.69** |
| implied divisor | 24.6 (ULT age **75**) | 25.5 (ULT age **74**) |

`amount_eligible_for_conversion` and `excess_contribution_this_fixture` in the fixture are both
derived from 40,650.41, so they inherit the same discrepancy.

## Why the engine value is 39,215.69
A person **born 1952** attains age **74** by the end of tax year **2026** (2026 − 1952 = 74). The
Uniform Lifetime Table divisor for age 74 is **25.5** (Treas. Reg. 1.401(a)(9)-9(c), 2022 final
regulations). 1,000,000 ÷ 25.5 = **39,215.69**.

The fixture's 40,650.41 = 1,000,000 ÷ **24.6**, and 24.6 is the ULT divisor for age **75**. Age 75
in 2026 implies **birth year 1951**, or age 75 for a 1952-born person implies **tax year 2027**. So
the fixture's expected value is internally inconsistent with its own `birth_year`/`tax_year` inputs
by one year of age.

Note the applicable-age rule is separate and correct: born 1952 → applicable age 73 (RMDs begin
2025). That does not change the 2026 divisor, which is indexed to age **74**.

## Suggested resolution (author/reviewer decision — not made here)
One of:
1. Change `birth_year` to **1951** (keeps the age-75 / 40,650.41 expectation), or
2. Change `tax_year` to **2027** (1952-born is 75 in 2027), or
3. Keep 1952/2026 and correct the expected values to the age-74 divisor:
   `rmd_required_first = 39,215.69`, `amount_eligible_for_conversion = 960,784.31`,
   `excess_contribution_this_fixture = 39,215.69`.

Since fixtures are regenerated from `tools/oracle.py` / `tools/build_fixtures.py`, the fix belongs
there (the RMD-08 expected values are currently hard-coded literals in `build_fixtures.py`).

Until resolved, the CI fixture suite is left non-gating; 61/62 fixtures + 6/6 property tests pass.

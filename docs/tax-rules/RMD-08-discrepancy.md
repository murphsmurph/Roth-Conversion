# RESOLVED FIXTURE DISCREPANCY — `rmd/RMD-08`

> **Status: RESOLVED (2026-08-21).** Resolution 3 below was applied at the generator: the
> fixture's expected values are now **derived from the oracle** (`tools/oracle.py`) for the
> fixture's own `birth_year: 1952` / `tax_year: 2026` inputs, rather than hard-coded. RMD-08 now
> expects `rmd_required_first = 39,215.69` (age-74 divisor 25.5) and the full suite gates at
> **62/62 fixtures + 6/6 properties**. The history below is retained for provenance.

---

Per CLAUDE.md Rule 5 ("if you believe a fixture is wrong, stop and say so with a citation; do NOT
edit the fixture"), this documented a disagreement between the engine and fixture RMD-08. The
fixture was left **unmodified and failing** until the author authorized a fix; the engine always
followed the standard rule.

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

## Resolution applied
The author authorized the fix; **Resolution 3** was chosen (keep the canonical `1952 / 2026`
inputs; correct the expected values to the age-74 divisor):
`rmd_required_first = 39,215.69`, `amount_eligible_for_conversion = 960,784.31`,
`excess_contribution_this_fixture = 39,215.69`.

The fix was made at the generator, not by hand-editing the fixture. `tools/build_fixtures.py` no
longer hard-codes RMD-08's expected values — it now computes them from the oracle for the fixture's
own stated inputs:

```python
rmd08_age = 2026 - 1952          # = 74, age attained by year end
rmd08_amt, _ = rmd_amount(rmd08_bal, rmd08_age)   # 1,000,000 / 25.5 = 39,215.69 (oracle ULT[74])
rmd08_eligible = cents(D(rmd08_bal) - D(rmd08_amt))
```

This makes the expectation self-consistent with the inputs by construction and immune to the
same one-year-of-age slip recurring. A byte-diff of a full regeneration against the prior canonical
fixture set confirmed **only `rmd/RMD-08` changed**. The CI fixture suite is now **gating** at
62/62 fixtures + 6/6 property tests (`.github/workflows/ci.yml`, `continue-on-error` removed).

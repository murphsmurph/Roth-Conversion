# Using advisor reference material in the engine

What to do with tax cards, firm intranet tables, and third-party calculators.
Added 2026-08-20 from advisor-supplied Edward Jones material.

---

## The three categories — do not mix them up

| What you have | What it is | Where it goes |
|---|---|---|
| Tax cards, JonesLink bracket tables, IRA/plan limit sheets | **Reference data** | `src/rules/**.json`, marked `RE_VERIFY`, then traced to the IRS source |
| The EJ Retirement Tax & Cash Flow Estimator | **A second implementation** | `tests/fixtures/differential/` — a disagreement detector, never a source of truth |
| The estimator's *layout* (cash received → tax → cash remaining) | **A UI idea** | Phase 5 output design |

The failure mode is treating category 2 as category 1 — copying a competitor's numbers because they look authoritative. Do not.

---

## 1. Reference data → rules JSON

Five new rules files, all seeded from the cards, all flagged for primary-source verification:

| File | Contents |
|---|---|
| `rules/federal/rmd-tables.json` | **Uniform Lifetime Table, full range 72–120+** |
| `rules/federal/contribution-limits-2026.json` | IRA & plan limits, catch-ups, Roth MAGI phaseout, Traditional IRA deductibility, saver's credit |
| `rules/federal/estates-trusts-2026.json` | Compressed trust brackets, 2025 and 2026 |
| `rules/federal/ltc-2026.json` | Deductible LTC premium by age, per-diem limits |
| `rules/federal/2025.json` | Prior-year brackets and limits, for historical validation |

**Three of these are not filler — they close real modeling gaps.**

**The Uniform Lifetime Table fixed a genuine bug in the Phase 0 bundle I gave you.** My oracle stopped at age 90. The Master Spec projects to 95. Every projection past age 90 would have thrown or silently produced garbage. The card's full table is now loaded through 120, with fixtures added at ages 90, 95, and 100. That is the single most useful thing in the stack of paper.

**Estates and trusts brackets are load-bearing for Master Spec §21.** A trust hits 37% at roughly $16,000 of retained taxable income, versus ~$768,700 for MFJ. When a trust is the IRA beneficiary and income is accumulated, inherited pre-tax dollars are taxed at near-top rates almost immediately. That is one of the strongest quantitative arguments for conversion that exists, and the tool cannot make it without this table. Compare the client's conversion cost against the *trust's* rate, not the individual beneficiary's.

**Two smaller interactions now modelable:**
- **Saver's credit** — a conversion raises MAGI and can destroy it outright for a lower-income client. A real marginal cost, currently invisible in every tool I have seen.
- **LTC premiums / medical deduction** — a conversion raises AGI and shrinks the 7.5%-floor medical deduction. Run in reverse, this is the Phase 3 "no-go years" play from your own Gemini research: a year with very large deductible medical or LTC costs absorbs a large conversion cheaply. The engine should flag high-medical years as conversion opportunities.

### Still missing, and now explicitly flagged

`rmd-tables.json` records two gaps as blockers rather than letting them pass silently:

- **Joint Life and Last Survivor Table** — required when the sole beneficiary is a spouse more than 10 years younger. Not on the card. Blocks that scenario.
- **Single Life Expectancy Table** — required for inherited accounts. Blocks Phase 9 entirely.

Both are in Treas. Reg. 1.401(a)(9)-9. Pull them from the eCFR, not from a card.

### One live example of why cards are not authority

The JonesLink estates-and-trusts table shows the 35% band beginning at **$11,702**. The 24% band ends at $11,700. There is a dollar unaccounted for — almost certainly a typo for $11,701. The rules file records the discrepancy and refuses to ship until it is confirmed against Rev. Proc. 2025-32.

That is exactly the behavior rule R3 exists to produce. Cards help you *locate* a rule. They are never the authority.

### Compliance note

These are Edward Jones branded materials. Transcribing the numeric limits is fine — tax figures are facts and they all originate with the IRS anyway — but **cite the IRS source in the rules files, not Edward Jones**, and do not commit the images, the PDF, or firm branding to a public GitHub repo. R3 already requires primary citations, so following the rule handles the licensing question for free. Worth a glance at your firm's policy on internal materials in public repositories before the repo goes public.

---

## 2. The EJ estimator → a differential fixture, and a finding

I ran your worked example — Single, 65+, SS $36,000, tax-exempt interest $2,500, QD/LTCG $30,000, other income $42,000 — through the Phase 0 oracle.

**Where we agree exactly:**

| Line | Edward Jones | Oracle |
|---|---|---|
| Taxable Social Security | $30,600.00 | $30,600.00 |
| AGI | $102,600.00 | $102,600.00 |
| Marginal bracket | 22% | 22% |

Their IRC 86 worksheet is right. That is a real cross-check of my oracle's hardest routine.

**Where we disagree:**

| Line | Edward Jones | Oracle | Delta |
|---|---|---|---|
| Total deductions | $30,544.00 | $22,494.00 | **−$8,050** |
| Taxable income | $72,056.00 | $80,106.00 | +$8,050 |
| Tax on ordinary income | $4,692.72 | $5,764.72 | |
| Tax on preferential income | $878.40 | $4,500.00 | |

Our deduction build-up, single filer age 65+, AGI $102,600:

```
2026 single standard deduction              16,100.00
age-65 additional (IRC 63(f))                2,050.00
senior bonus, phased:
   6% x (102,600 - 75,000) = 1,656
   6,000 - 1,656                             4,344.00
                                            ----------
TOTAL                                       22,494.00
```

**The leading hypothesis is exact:** `$32,200 − $1,656 = $30,544`. $32,200 is the **MFJ** standard deduction. Their worksheet appears to be applying the married standard deduction to a single filer, then subtracting the correctly-computed senior phaseout. The alternative, equally plausible, is that the fillable PDF did not recalculate line 8 after you changed the filing-status radio button — a classic Acrobat form field-order bug.

**A second, independent problem:** their line 14 does not reconcile with their *own* line 10. Taking their $72,056 of taxable income and their $30,000 of preferential income leaves $42,056 of ordinary income, which leaves $7,394 of room under the $49,450 zero-rate ceiling and puts $22,606 at 15% — $3,390.90. They report $878.40. That is not explained by the deduction issue.

**What I am not claiming.** I have not proven Edward Jones is wrong; I have proven that two independent professional implementations disagree, in a case where I can show my work line by line to a form. Confirm against a filed return or a third tool before trusting either number. But if you are using that estimator with clients today, this is worth ten minutes: re-enter the case fresh with Single selected first, and see whether line 8 comes out $22,494.

**The fixture is checked in as `differential/DIFF-EJ-01`.** Note carefully how it is built: **our** values are the assertions, **their** values are recorded as metadata only and are never asserted against. The fixture note says it in capitals — do not change our numbers to match theirs without a primary-source citation.

### The general pattern

Any third-party tool you have access to becomes a differential fixture: eMoney, RightCapital, Holistiplan, a CPA's software, the EJ estimator. Same shape every time — run the case through both, record the agreements and disagreements, resolve the disagreements against primary sources.

**Agreement is worth as much as disagreement.** Three independent implementations agreeing on taxable Social Security is real evidence. That is why the file records agreements too, not just deltas.

---

## 3. The one thing worth borrowing from their layout

Their section D — Total Cash Received → less taxes → **Estimated Cash Remaining** — is a better client-facing frame than a tax number alone. Clients understand spendable cash. They do not intuitively understand taxable income.

Worth carrying into your Phase 5 output as a companion to the tax comparison: *what actually lands in the checking account this year, with and without the conversion.* Note that it is a cash-flow view, not an economic one — it ignores the compounding value of what stays invested, which is the whole point of §18 and §19. Show both; never let the cash view drive the recommendation.

---

## Bundle now at 66 fixtures

| Class | Count | Change |
|---|---|---|
| federal | 6 | |
| social-security | 11 | |
| senior-deduction | 14 | |
| capital-gains | 10 | |
| aca | 5 | |
| irmaa | 8 | |
| rmd | 11 | **+3** — ages 90, 95, 100, now that the table reaches them |
| **differential** | **1** | **new class** |

Phase 2's exit criterion is now 66/66, and DIFF-EJ-01 is expected to pass against *our* values while continuing to disagree with the recorded third-party figures until that discrepancy is resolved.

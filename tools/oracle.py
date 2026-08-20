"""
PHASE 0 ORACLE — independent reimplementation of the IRS worksheets.

PURPOSE: generate expected values for test fixtures WITHOUT reference to the
application engine. This file is deliberately dumb, literal and worksheet-shaped.
It follows IRS form line numbers, not clean software design, so a CPA can read it
next to the form and check it line by line.

DO NOT import this into src/engine/. It is an oracle, not an implementation.
If the engine and this file ever share code, the tests become worthless.

All 2026 constants are sourced in rules/federal/2026.json.
"""

from decimal import Decimal as D, ROUND_HALF_UP
import json

# ----------------------------------------------------------------------------
# 2026 CONSTANTS  (source: Rev. Proc. 2025-32 / IRS IR-2025-103; see rules JSON)
# ----------------------------------------------------------------------------

STD_DEDUCTION = {"single": D("16100"), "mfj": D("32200"), "hoh": D("24150"), "mfs": D("16100")}
ADDL_65 = {"single": D("2050"), "hoh": D("2050"), "mfj": D("1650"), "mfs": D("1650")}  # per qualifying person

BRACKETS = {
    "single": [(D("12400"), D("0.10")), (D("50400"), D("0.12")), (D("105700"), D("0.22")),
               (D("201775"), D("0.24")), (D("256225"), D("0.32")), (D("640600"), D("0.35")),
               (None, D("0.37"))],
    "mfj": [(D("24800"), D("0.10")), (D("100800"), D("0.12")), (D("211400"), D("0.22")),
            (D("403550"), D("0.24")), (D("512450"), D("0.32")), (D("768700"), D("0.35")),
            (None, D("0.37"))],
    "hoh": [(D("17700"), D("0.10")), (D("67450"), D("0.12")), (D("105700"), D("0.22")),
            (D("201750"), D("0.24")), (D("256200"), D("0.32")), (D("640600"), D("0.35")),
            (None, D("0.37"))],
}

LTCG_0_TOP = {"single": D("49450"), "mfj": D("98900"), "hoh": D("66200")}
LTCG_15_TOP = {"single": D("545500"), "mfj": D("613700"), "hoh": D("579600")}

# IRC 86 — UNINDEXED since 1983/1993
SS_BASE1 = {"single": D("25000"), "hoh": D("25000"), "mfj": D("32000"), "mfs": D("0")}
SS_BASE2_ADDL = {"single": D("9000"), "hoh": D("9000"), "mfj": D("12000"), "mfs": D("0")}

# IRC 1411 — UNINDEXED
NIIT_THRESHOLD = {"single": D("200000"), "hoh": D("200000"), "mfj": D("250000"), "mfs": D("125000")}
NIIT_RATE = D("0.038")

# OBBBA senior deduction, tax years 2025-2028
SENIOR_DED_PER_PERSON = D("6000")
SENIOR_DED_PHASEOUT_START = {"single": D("75000"), "hoh": D("75000"), "mfj": D("150000"), "mfs": D("75000")}
SENIOR_DED_PHASEOUT_RATE = D("0.06")   # PER QUALIFYING INDIVIDUAL — see Schedule 1-A lines 35/36a/36b

# 2026 IRMAA — determined by 2024 MAGI. Part B standard $202.90.
IRMAA_2026 = {
    "single": [(D("109000"), D("202.90"), D("0")), (D("137000"), D("284.10"), D("14.50")),
               (D("171000"), D("405.80"), D("37.50")), (D("205000"), D("527.50"), D("60.40")),
               (D("500000"), D("649.20"), D("83.30")), (None, D("689.90"), D("91.00"))],
    "mfj": [(D("218000"), D("202.90"), D("0")), (D("274000"), D("284.10"), D("14.50")),
            (D("342000"), D("405.80"), D("37.50")), (D("410000"), D("527.50"), D("60.40")),
            (D("750000"), D("649.20"), D("83.30")), (None, D("689.90"), D("91.00"))],
}

# 2025 HHS poverty guidelines (48 states + DC), used for 2026 coverage year
FPL_2025 = {1: D("15650"), 2: D("21150"), 3: D("26650"), 4: D("32150")}

# Uniform Lifetime Table (Treas. Reg. 1.401(a)(9)-9, 2022 final regs)
ULT = {72: D("27.4"), 73: D("26.5"), 74: D("25.5"), 75: D("24.6"), 76: D("23.7"), 77: D("22.9"),
       78: D("22.0"), 79: D("21.1"), 80: D("20.2"), 81: D("19.4"), 82: D("18.5"), 83: D("17.7"),
       84: D("16.8"), 85: D("16.0"), 86: D("15.2"), 87: D("14.4"), 88: D("13.7"), 89: D("12.9"),
       90: D("12.2")}


def cents(x):
    return D(x).quantize(D("0.01"), rounding=ROUND_HALF_UP)


def dollars(x):
    return D(x).quantize(D("1"), rounding=ROUND_HALF_UP)


# ----------------------------------------------------------------------------
# WORKSHEET A — Social Security Benefits Worksheet (Form 1040 instructions)
# Reproduced line-for-line. IRC 86.
# ----------------------------------------------------------------------------

def ss_worksheet(gross_ss, other_income, tax_exempt_interest, adjustments, status):
    L = {}
    L[1] = D(gross_ss)
    L[2] = L[1] * D("0.5")
    L[3] = D(other_income)                       # all income other than SS
    L[4] = D(tax_exempt_interest)
    L[5] = L[2] + L[3] + L[4]
    L[6] = D(adjustments)                        # Schedule 1 adjustments (limited set)
    L[7] = max(D(0), L[5] - L[6])                # PROVISIONAL / COMBINED INCOME
    if L[7] <= 0:
        L["taxable"] = D(0)
        return D(0), L
    L[8] = SS_BASE1[status]
    L[9] = max(D(0), L[7] - L[8])
    if L[9] <= 0:
        L["taxable"] = D(0)
        return D(0), L
    L[10] = SS_BASE2_ADDL[status]
    L[11] = max(D(0), L[9] - L[10])
    L[12] = min(L[9], L[10])
    L[13] = L[12] * D("0.5")
    L[14] = min(L[2], L[13])
    L[15] = L[11] * D("0.85")
    L[16] = L[14] + L[15]
    L[17] = L[1] * D("0.85")
    L[18] = min(L[16], L[17])
    L["taxable"] = L[18]
    return L[18], L


# ----------------------------------------------------------------------------
# Senior bonus deduction — Schedule 1-A, Part V (lines 33-36b)
# ----------------------------------------------------------------------------

def senior_deduction(magi, status, n_qualifying):
    """n_qualifying = number of filers age 65+ (0, 1, or 2).
    Sch 1-A computes ONE phase-out amount on line 35 and enters it on BOTH
    line 36a (you) and 36b (spouse) -> combined 12% rate when both qualify."""
    L = {}
    if n_qualifying == 0:
        return D(0), {"note": "no qualifying individual"}
    L[33] = SENIOR_DED_PER_PERSON
    L[34] = max(D(0), D(magi) - SENIOR_DED_PHASEOUT_START[status])
    L[35] = max(D(0), L[33] - L[34] * SENIOR_DED_PHASEOUT_RATE)   # per person
    L["36a"] = L[35] if n_qualifying >= 1 else D(0)
    L["36b"] = L[35] if n_qualifying >= 2 else D(0)
    total = L["36a"] + L["36b"]
    L["total"] = total
    return total, L


# ----------------------------------------------------------------------------
# Ordinary tax — Tax Computation Worksheet method (exact brackets).
# NOTE: real returns with taxable income < $100,000 use the Tax Table, which
# taxes the MIDPOINT of a $50 band. Expect up to ~$6 divergence when validating
# against a filed return. Document that; do not chase it.
# ----------------------------------------------------------------------------

def ordinary_tax(taxable, status):
    taxable = max(D(0), D(taxable))
    tax = D(0)
    lower = D(0)
    for top, rate in BRACKETS[status]:
        if top is None or taxable <= top:
            tax += (taxable - lower) * rate
            return max(D(0), tax)
        tax += (top - lower) * rate
        lower = top
    return tax


# ----------------------------------------------------------------------------
# WORKSHEET B — Qualified Dividends and Capital Gain Tax Worksheet
# Reproduced line-for-line from the Form 1040 instructions.
# ----------------------------------------------------------------------------

def qdcg_worksheet(taxable_income, qualified_dividends, net_ltcg, status):
    L = {}
    L[1] = max(D(0), D(taxable_income))
    L[2] = D(qualified_dividends)
    L[3] = D(net_ltcg)
    L[4] = L[2] + L[3]
    L[5] = max(D(0), L[1] - L[4])                 # ORDINARY taxable income
    L[6] = min(L[1], LTCG_0_TOP[status])
    L[7] = min(L[5], L[6])
    L[8] = L[6] - L[7]                            # taxed at 0%
    L[9] = min(L[1], L[4])
    L[10] = L[8]
    L[11] = L[9] - L[10]
    L[12] = min(L[1], LTCG_15_TOP[status])
    L[13] = L[5] + L[8]
    L[14] = max(D(0), L[12] - L[13])
    L[15] = min(L[11], L[14])                     # taxed at 15%
    L[16] = L[15] * D("0.15")
    L[17] = L[8] + L[15]
    L[18] = L[9] - L[17]                          # taxed at 20%
    L[19] = L[18] * D("0.20")
    L[20] = ordinary_tax(L[5], status)
    L[21] = L[16] + L[19] + L[20]
    L[22] = ordinary_tax(L[1], status)
    L[23] = min(L[21], L[22])
    return L[23], L


# ----------------------------------------------------------------------------
# NIIT — Form 8960
# ----------------------------------------------------------------------------

def niit(magi_niit, net_investment_income, status):
    excess = max(D(0), D(magi_niit) - NIIT_THRESHOLD[status])
    base = min(D(net_investment_income), excess)
    return cents(base * NIIT_RATE), {"excess_over_threshold": excess, "nii": D(net_investment_income), "base": base}


# ----------------------------------------------------------------------------
# IRMAA — annual household cost above the standard premium
# ----------------------------------------------------------------------------

def irmaa_annual(magi_irmaa, status, n_enrolled):
    magi_irmaa = D(magi_irmaa)
    table = IRMAA_2026[status]
    std_b = D("202.90")
    for i, (top, partb, partd) in enumerate(table):
        if top is None or magi_irmaa <= top:
            surcharge_monthly = (partb - std_b) + partd
            return cents(surcharge_monthly * 12 * n_enrolled), {
                "tier": i, "part_b_monthly": partb, "part_d_irmaa_monthly": partd,
                "surcharge_monthly_per_person": surcharge_monthly, "enrolled": n_enrolled}
    raise AssertionError


# ----------------------------------------------------------------------------
# RMD
# ----------------------------------------------------------------------------

def rmd_age(birth_year):
    if birth_year <= 1950:
        return 72          # (pre-SECURE 2.0 cohorts; 70.5 for born before 7/1/1949)
    if 1951 <= birth_year <= 1959:
        return 73
    return 75


def rmd_amount(prior_year_end_balance, age_at_year_end):
    factor = ULT[age_at_year_end]
    return cents(D(prior_year_end_balance) / factor), {"factor": factor}


# ----------------------------------------------------------------------------
# FULL SINGLE-YEAR RETURN — the frozen order of operations (R4)
# ----------------------------------------------------------------------------

def compute_year(*, status, ages, gross_ss=0, wages=0, interest=0, tax_exempt_interest=0,
                 qualified_dividends=0, ordinary_dividends=None, net_ltcg=0,
                 ira_distributions=0, roth_conversion=0, pension=0, other_ordinary=0,
                 adjustments=0, itemized_deductions=None, qbi_deduction=0):
    """ages = list of ages at year end, one per filer."""
    if ordinary_dividends is None:
        ordinary_dividends = qualified_dividends
    non_qual_dividends = D(ordinary_dividends) - D(qualified_dividends)

    t = {}
    # STEP 1 — gross income other than Social Security
    other_income = (D(wages) + D(interest) + D(ordinary_dividends) + D(net_ltcg)
                    + D(ira_distributions) + D(roth_conversion) + D(pension) + D(other_ordinary))
    t["step1_other_income"] = other_income

    # STEP 2/3 — provisional income and taxable Social Security
    taxable_ss, ssL = ss_worksheet(gross_ss, other_income, tax_exempt_interest, adjustments, status)
    t["step2_provisional_income"] = ssL.get(7, D(0))
    t["step3_taxable_social_security"] = taxable_ss
    t["_ss_worksheet"] = {str(k): str(v) for k, v in ssL.items()}

    # STEP 4 — AGI
    agi = other_income + taxable_ss - D(adjustments)
    t["step4_agi"] = agi

    # STEP 5 — the four MAGIs, computed separately and never interchanged
    t["step5_magi"] = {
        "irmaa": agi + D(tax_exempt_interest),
        "niit": agi,                                            # + foreign earned income exclusion
        "aca": agi + D(tax_exempt_interest) + (D(gross_ss) - taxable_ss),
        "senior": agi,                                          # + 911/931/933 exclusions
    }

    # STEP 6 — deductions
    n65 = sum(1 for a in ages if a >= 65)
    if itemized_deductions is None:
        base = STD_DEDUCTION[status] + ADDL_65[status] * n65
        ded_kind = "standard"
    else:
        base = D(itemized_deductions)
        ded_kind = "itemized"
    senior_ded, seniorL = senior_deduction(t["step5_magi"]["senior"], status, n65)
    total_deductions = base + senior_ded + D(qbi_deduction)
    t["step6_deductions"] = {
        "kind": ded_kind, "base": base, "n_age_65_plus": n65,
        "senior_bonus_deduction": senior_ded, "qbi": D(qbi_deduction), "total": total_deductions,
        "_schedule_1a": {str(k): str(v) for k, v in seniorL.items()},
    }

    # STEP 7 — taxable income
    taxable_income = max(D(0), agi - total_deductions)
    t["step7_taxable_income"] = taxable_income

    # STEP 8 — stacking
    preferential = D(qualified_dividends) + D(net_ltcg)
    regular_tax, qL = qdcg_worksheet(taxable_income, qualified_dividends, net_ltcg, status)
    t["step8_ordinary_taxable_income"] = qL[5]
    t["step8_preferential_income"] = min(taxable_income, preferential)
    t["step8_taxed_at_0"] = qL[8]
    t["step8_taxed_at_15"] = qL[15]
    t["step8_taxed_at_20"] = qL[18]
    t["step8_regular_tax"] = cents(regular_tax)
    t["_qdcg_worksheet"] = {str(k): str(v) for k, v in qL.items()}

    # STEP 9 — NIIT
    nii = D(interest) + D(ordinary_dividends) + D(net_ltcg)
    niit_amt, niL = niit(t["step5_magi"]["niit"], nii, status)
    t["step9_niit"] = niit_amt
    t["_niit"] = {k: str(v) for k, v in niL.items()}

    t["total_federal_tax"] = cents(regular_tax + niit_amt)
    return t

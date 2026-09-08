// Fixture runner. Loads every JSON fixture from tests/fixtures/, dispatches each family to
// the corresponding engine entry point, and asserts the expected intermediate + final values
// within the fixture's dollar tolerance.
//
// Phase 0: the engine throws NotImplementedError, so EVERY fixture fails. That is success —
// a green suite here would mean the engine is testing itself. The oracle (tools/oracle.py)
// produced these expected values independently and is never imported by src/engine.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";

import { computeYear } from "../../src/engine/calculateYear";
import { rmdApplicableAge, rmdAmount, rmdOrdering } from "../../src/engine/calculateRMD";
import { calculateIrmaa } from "../../src/engine/calculateIRMAA";
import { calculateAca } from "../../src/engine/calculateACA";
import type { FilingStatus, MagiAca, MagiIrmaa, YearInput } from "../../src/engine/types";

const FIX_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures");

interface IndexRow { id: string; folder: string; title: string; tests: string[] }
interface Fixture {
  id: string; folder: string; title: string; tax_year: number; law_mode: string;
  input: Record<string, unknown>; expected: Record<string, unknown>; tolerance_dollars: number;
}

const index: IndexRow[] = JSON.parse(readFileSync(join(FIX_DIR, "INDEX.json"), "utf8"));

function load(row: IndexRow): Fixture {
  const doc = JSON.parse(readFileSync(join(FIX_DIR, row.folder, `${row.id}.json`), "utf8"));
  return { ...doc, folder: row.folder };
}

const num = (v: unknown): number => v as number;

// ---- build the engine input for the full-year families ----
function toYearInput(f: Fixture): YearInput {
  const i = f.input;
  const out: YearInput = {
    taxYear: f.tax_year,
    lawMode: f.law_mode as YearInput["lawMode"],
    status: i.status as FilingStatus,
    ages: i.ages as number[],
  };
  const map: Record<string, keyof YearInput> = {
    gross_ss: "grossSocialSecurity", wages: "wages", interest: "interest",
    tax_exempt_interest: "taxExemptInterest", qualified_dividends: "qualifiedDividends",
    ordinary_dividends: "ordinaryDividends", net_ltcg: "netLtcg",
    ira_distributions: "iraDistributions", roth_conversion: "rothConversion",
    pension: "pension", other_ordinary: "otherOrdinary", adjustments: "adjustments",
    itemized_deductions: "itemizedDeductions", qbi_deduction: "qbiDeduction",
  };
  for (const [k, v] of Object.entries(map)) {
    if (i[k] !== undefined) (out as unknown as Record<string, unknown>)[v] = i[k];
  }
  return out;
}

// Each adapter returns matching {expected, actual} flat maps in one key namespace.
type Flat = Record<string, number | boolean>;

function yearAdapter(f: Fixture): { expected: Flat; actual: Flat } {
  const r = computeYear(toYearInput(f));
  const e = f.expected;
  const magi = e.magi as Record<string, number>;
  const expected: Flat = {
    provisional_income: num(e.provisional_income),
    taxable_social_security: num(e.taxable_social_security),
    agi: num(e.agi),
    "magi.irmaa": num(magi.irmaa), "magi.niit": num(magi.niit), "magi.aca": num(magi.aca), "magi.senior": num(magi.senior),
    senior_bonus_deduction: num(e.senior_bonus_deduction),
    total_deductions: num(e.total_deductions),
    taxable_income: num(e.taxable_income),
    ordinary_taxable_income: num(e.ordinary_taxable_income),
    preferential_taxed_at_0: num(e.preferential_taxed_at_0),
    preferential_taxed_at_15: num(e.preferential_taxed_at_15),
    preferential_taxed_at_20: num(e.preferential_taxed_at_20),
    regular_tax: num(e.regular_tax),
    niit: num(e.niit),
    total_federal_tax: num(e.total_federal_tax),
  };
  const actual: Flat = {
    provisional_income: r.provisionalIncome,
    taxable_social_security: r.taxableSocialSecurity,
    agi: r.agi,
    "magi.irmaa": r.magi.irmaa, "magi.niit": r.magi.niit, "magi.aca": r.magi.aca, "magi.senior": r.magi.senior,
    senior_bonus_deduction: r.deductions.seniorBonusDeduction,
    total_deductions: r.deductions.total,
    taxable_income: r.taxableIncome,
    ordinary_taxable_income: r.ordinaryIncome,
    preferential_taxed_at_0: r.preferential.taxedAtZero,
    preferential_taxed_at_15: r.preferential.taxedAtFifteen,
    preferential_taxed_at_20: r.preferential.taxedAtTwenty,
    regular_tax: r.regularTax,
    niit: r.niit,
    total_federal_tax: r.totalFederalTax,
  };
  return { expected, actual };
}

function rmdAdapter(f: Fixture): { expected: Flat; actual: Flat } {
  const i = f.input, e = f.expected;
  if (i.attempted_roth_conversion !== undefined) {
    const r = rmdOrdering({
      birthYear: num(i.birth_year), taxYear: num(i.tax_year),
      priorYearEndBalance: num(i.prior_year_end_balance),
      attemptedRothConversion: num(i.attempted_roth_conversion),
    });
    return {
      expected: {
        rmd_required_first: num(e.rmd_required_first),
        amount_eligible_for_conversion: num(e.amount_eligible_for_conversion),
        conversion_of_rmd_amount_permitted: e.conversion_of_rmd_amount_permitted as boolean,
        excess_contribution_this_fixture: num(e.excess_contribution_this_fixture),
        allowable_regular_roth_contribution_this_fixture: num(e.allowable_regular_roth_contribution_this_fixture),
      },
      actual: {
        rmd_required_first: r.rmdRequiredFirst,
        amount_eligible_for_conversion: r.amountEligibleForConversion,
        conversion_of_rmd_amount_permitted: r.conversionOfRmdAmountPermitted,
        excess_contribution_this_fixture: r.excessContributionThisFixture,
        allowable_regular_roth_contribution_this_fixture: r.allowableRegularRothContributionThisFixture,
      },
    };
  }
  if (i.age_at_year_end !== undefined) {
    const r = rmdAmount(num(i.prior_year_end_balance), num(i.age_at_year_end));
    return {
      expected: { rmd: num(e.rmd), distribution_period: num(e.distribution_period) },
      actual: { rmd: r.rmd, distribution_period: r.distributionPeriod },
    };
  }
  const r = rmdApplicableAge(num(i.birth_year));
  return {
    expected: { rmd_applicable_age: num(e.rmd_applicable_age) },
    actual: { rmd_applicable_age: r.rmdApplicableAge },
  };
}

function irmaaAdapter(f: Fixture): { expected: Flat; actual: Flat } {
  const i = f.input, e = f.expected;
  const r = calculateIrmaa(num(i.magi_irmaa) as MagiIrmaa, i.filing_status as FilingStatus, num(i.medicare_enrollees));
  return {
    expected: {
      annual_household_surcharge_above_standard: num(e.annual_household_surcharge_above_standard),
      tier: num(e.tier), part_b_monthly: num(e.part_b_monthly),
      part_d_irmaa_monthly: num(e.part_d_irmaa_monthly),
      surcharge_monthly_per_person: num(e.surcharge_monthly_per_person), enrolled: num(e.enrolled),
    },
    actual: {
      annual_household_surcharge_above_standard: r.annualHouseholdSurchargeAboveStandard,
      tier: r.tier, part_b_monthly: r.partBMonthly, part_d_irmaa_monthly: r.partDIrmaaMonthly,
      surcharge_monthly_per_person: r.surchargeMonthlyPerPerson, enrolled: r.enrolled,
    },
  };
}

function acaAdapter(f: Fixture): { expected: Flat; actual: Flat } {
  const i = f.input, e = f.expected;
  const r = calculateAca(num(i.aca_magi) as MagiAca, num(i.household_size));
  return {
    expected: {
      fpl_100_percent: num(e.fpl_100_percent), fpl_400_percent: num(e.fpl_400_percent),
      fpl_percentage: num(e.fpl_percentage),
      premium_tax_credit_eligible: e.premium_tax_credit_eligible as boolean,
      credit_multiplier: num(e.credit_multiplier),
    },
    actual: {
      fpl_100_percent: r.fpl100Percent, fpl_400_percent: r.fpl400Percent,
      fpl_percentage: r.fplPercentage, premium_tax_credit_eligible: r.premiumTaxCreditEligible,
      credit_multiplier: r.creditMultiplier,
    },
  };
}

const ADAPTERS: Record<string, (f: Fixture) => { expected: Flat; actual: Flat }> = {
  federal: yearAdapter, "social-security": yearAdapter,
  "senior-deduction": yearAdapter, "capital-gains": yearAdapter,
  rmd: rmdAdapter, irmaa: irmaaAdapter, aca: acaAdapter,
  // Differential fixtures are full single-year returns; only OUR `expected` block is asserted.
  // Any recorded third-party figures live in `notes` and are never compared (see USING-REFERENCE-DATA.md).
  differential: yearAdapter,
};

const byFolder = new Map<string, IndexRow[]>();
for (const row of index) {
  if (!byFolder.has(row.folder)) byFolder.set(row.folder, []);
  byFolder.get(row.folder)!.push(row);
}

for (const [folder, rows] of byFolder) {
  describe(`fixtures/${folder}`, () => {
    for (const row of rows) {
      const f = load(row);
      it(`${f.id} — ${f.title}`, () => {
        const tol = f.tolerance_dollars ?? 0.01;
        const { expected, actual } = ADAPTERS[folder]!(f);
        for (const key of Object.keys(expected)) {
          const exp = expected[key]!;
          const act = actual[key]!;
          if (typeof exp === "boolean") {
            expect(act, `${f.id}:${key}`).toBe(exp);
          } else {
            expect(Math.abs((act as number) - exp), `${f.id}:${key} exp=${exp} act=${act}`).toBeLessThanOrEqual(tol);
          }
        }
      });
    }
  });
}

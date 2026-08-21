// Conversion optimizer (Phase 5). Searches the annual Roth-conversion amount that maximizes lifetime
// after-tax wealth (via projectLifetime), then reports a RANGE (never a false-precision point), a
// preferred target, the BINDING CONSTRAINT that stops it there by rule id (from the Phase 3 marginal
// sweep), why-not-more / why-not-less straight from the engine, the next important threshold above,
// the expected economic benefit and crossover year, and a sensitivity grid. Every output carries
// provenance, the law-mode label, an assumptions block, and a data-quality panel.
//
// All numbers are supplied by the caller, so this engine file holds no magic numbers.
import { projectLifetime, crossoverYear, type LifetimeInput } from "./projectLifetime";
import { sweepConversion, type SweepOpts } from "./sweepConversion";
import { rmdApplicableAge } from "./calculateRMD";
import { calculationMetadata, ultFactor } from "./rules";
import type { CalculationMetadata, YearInput } from "./types";

export interface OptimizerOpts {
  conversionYears: number;      // hold the chosen annual amount for this many years
  candidateStep: number;        // search grid step
  candidateMax: number;         // search cap
  rangeTolerance: number;       // fraction of best benefit that still counts as "in range" (0..1)
  roundTo: number;              // preferred target rounding (e.g. 1000)
  sweepOpts: SweepOpts;         // for binding-constraint detection on year 1
  growthDelta: number;          // sensitivity: +/- on growth
  horizonDelta: number;         // sensitivity: +/- years on horizon
  beneficiaryRateDelta: number; // sensitivity: +/- on beneficiary/future rate
}

export interface SensitivityRow {
  dimension: string;
  low: number;   // preferred target under the low case
  base: number;
  high: number;
}

export interface OptimizerResult {
  preferredTarget: number;
  optimalRangeLow: number;
  optimalRangeHigh: number;
  bindingConstraintRuleId: string | null;
  bindingConstraintCause: string;
  whyNotMore: string;
  whyNotLess: string;
  nextThresholdAbove: { conversion: number; ruleId: string; cause: string } | null;
  expectedBenefit: number;      // lifetime after-tax wealth vs converting nothing
  crossoverYear: number | null;
  sensitivity: SensitivityRow[];
  assumptions: Record<string, number | string>;
  lawMode: string;
  dataQuality: Array<{ item: string; status: string }>;
  calculationMetadata: CalculationMetadata;
  disclaimer: string;
}

const DISCLAIMER =
  "Planning projection, not tax advice. Figures are estimates under current 2026 law and the stated " +
  "assumptions, which will change. Roth conversions are irrevocable and affect Medicare (IRMAA), " +
  "taxation of Social Security, and other income-tested items. Confirm with a qualified tax " +
  "professional (CPA or EA) before acting.";

// Year-1 ordinary-income snapshot, used to run the marginal sweep for the binding constraint.
function yearZeroInput(base: LifetimeInput): YearInput {
  let ss = 0, pension = 0, rmd = 0;
  for (const s of base.spouses) {
    if (s.age >= s.ssClaimAge) ss += s.socialSecurityAnnual;
    pension += s.pensionAnnual;
    const applic = rmdApplicableAge(s.birthYear).rmdApplicableAge;
    if (s.age >= applic) { const f = ultFactor(s.age); if (f !== undefined) rmd += s.traditionalIra / f; }
  }
  return {
    taxYear: base.taxYear, lawMode: base.lawMode, status: base.filingStatus,
    ages: base.spouses.map(s => s.age), grossSocialSecurity: ss, pension,
    iraDistributions: rmd, otherOrdinary: base.otherOrdinaryAnnual,
  };
}

function wealthOf(base: LifetimeInput, annualAmount: number, years: number): number {
  const schedule = Array.from({ length: years }, () => annualAmount);
  return projectLifetime({ ...base, conversionByYear: schedule }).finalAfterTaxWealthBeneficiary;
}

// Search the annual amount maximizing lifetime after-tax wealth; return the argmax on the grid.
function bestAnnual(base: LifetimeInput, opts: OptimizerOpts): { best: number; wealthAt0: number; maxWealth: number; grid: Array<{ a: number; w: number }> } {
  const grid: Array<{ a: number; w: number }> = [];
  for (let a = 0; a <= opts.candidateMax; a += opts.candidateStep) grid.push({ a, w: wealthOf(base, a, opts.conversionYears) });
  let best = grid[0]!;
  for (const p of grid) if (p.w > best.w) best = p;
  return { best: best.a, wealthAt0: grid[0]!.w, maxWealth: best.w, grid };
}

export function optimizeConversion(base: LifetimeInput, opts: OptimizerOpts): OptimizerResult {
  const { best, wealthAt0, maxWealth, grid } = bestAnnual(base, opts);
  const maxBenefit = maxWealth - wealthAt0;

  // range = amounts whose benefit is within tolerance of the best
  const threshold = maxBenefit - opts.rangeTolerance * Math.max(0, maxBenefit);
  const inRange = grid.filter(p => (p.w - wealthAt0) >= threshold);
  const low = inRange.length ? Math.min(...inRange.map(p => p.a)) : 0;
  const high = inRange.length ? Math.max(...inRange.map(p => p.a)) : 0;
  const preferred = Math.round(best / opts.roundTo) * opts.roundTo;

  // binding constraint: the enumerated discontinuity nearest above the range top, from the marginal sweep
  const sweep = sweepConversion(yearZeroInput(base), opts.sweepOpts);
  const jumps = sweep.inflections
    .flatMap(s => s.crossings.filter(c => c.kind === "jump").map(c => ({ conversion: s.conversion, ruleId: c.ruleId, cause: c.cause })))
    .sort((x, y) => x.conversion - y.conversion);
  const binding = jumps.find(j => j.conversion >= high) ?? null;
  const nextThresholdAbove = jumps.find(j => binding ? j.conversion > binding.conversion : j.conversion > high) ?? null;

  const expectedBenefit = maxBenefit;
  const noConvert = projectLifetime({ ...base, conversionByYear: [] });
  const optimal = projectLifetime({ ...base, conversionByYear: Array.from({ length: opts.conversionYears }, () => best) });
  const cross = crossoverYear(optimal, noConvert, "beneficiary");

  // sensitivity
  const targetUnder = (mut: Partial<LifetimeInput>): number =>
    Math.round(bestAnnual({ ...base, ...mut }, opts).best / opts.roundTo) * opts.roundTo;
  const sensitivity: SensitivityRow[] = [
    { dimension: "returns (growth)", low: targetUnder({ growthRate: base.growthRate - opts.growthDelta }), base: preferred, high: targetUnder({ growthRate: base.growthRate + opts.growthDelta }) },
    { dimension: "longevity (horizon age)", low: targetUnder({ horizonAge: base.horizonAge - opts.horizonDelta }), base: preferred, high: targetUnder({ horizonAge: base.horizonAge + opts.horizonDelta }) },
    { dimension: "future / beneficiary tax rate", low: targetUnder({ beneficiaryTaxRate: base.beneficiaryTaxRate - opts.beneficiaryRateDelta }), base: preferred, high: targetUnder({ beneficiaryTaxRate: base.beneficiaryTaxRate + opts.beneficiaryRateDelta }) },
  ];

  const whyNotMore = binding
    ? `Converting past about $${high.toLocaleString()} crosses ${binding.cause} (${binding.ruleId}), whose added cost outweighs the benefit.`
    : (maxBenefit > 0
      ? `Beyond about $${high.toLocaleString()} the marginal conversion cost exceeds the projected benefit at this horizon.`
      : "Converting does not improve projected after-tax wealth for this household.");
  const whyNotLess = maxBenefit > 0
    ? `Below about $${low.toLocaleString()} low-cost bracket space is left unused, giving up projected after-tax wealth.`
    : "n/a — the recommendation is not to convert.";

  return {
    preferredTarget: maxBenefit > 0 ? preferred : 0,
    optimalRangeLow: low,
    optimalRangeHigh: high,
    bindingConstraintRuleId: binding ? binding.ruleId : null,
    bindingConstraintCause: binding ? binding.cause : (maxBenefit > 0 ? "marginal cost exceeds benefit" : "no benefit to converting"),
    whyNotMore,
    whyNotLess,
    nextThresholdAbove,
    expectedBenefit,
    crossoverYear: cross,
    sensitivity,
    assumptions: {
      growthRate: base.growthRate, inflationRate: base.inflationRate, horizonAge: base.horizonAge,
      beneficiaryTaxRate: base.beneficiaryTaxRate, conversionYears: opts.conversionYears,
      afterTaxWealthMethod: "beneficiary 10-year drawdown (primary)",
    },
    lawMode: base.lawMode,
    dataQuality: [
      { item: "federal / medicare / aca rules", status: "PENDING_ADVISOR_REVIEW" },
      { item: "state tax", status: "NOT MODELED (v1)" },
      { item: "taxable-account dividend/gain drag", status: "SIMPLIFIED" },
    ],
    calculationMetadata: calculationMetadata(base.taxYear, base.lawMode),
    disclaimer: DISCLAIMER,
  };
}

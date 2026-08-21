// Lifetime projection (Phase 4). Projects one household year by year to a horizon: Social Security
// (with COLA), pensions, RMDs per spouse, Roth conversions, deterministic growth, inflation-adjusted
// spending, and the survivor transition at first death. Each year's federal tax is computed by
// computeYear, so every year is consistent with the single-year oracle. After-tax wealth is valued
// two ways — a beneficiary 10-year drawdown at the beneficiary's own rate (primary) and a flat
// haircut (sensitivity) — with the method and rate reported. All numbers are supplied by the caller,
// so this engine holds no magic numbers.
//
// Documented simplifications (refined in later phases): spending-driven withdrawals draw
// taxable -> Roth -> traditional; taxable-account withdrawals are treated as not generating current
// tax (dividend/gain drag is a later refinement); IRMAA is evaluated on the current year's MAGI
// (the 2-year lookback is applied in the marginal engine, not here).
import { computeYear } from "./calculateYear";
import { calculateIrmaa } from "./calculateIRMAA";
import { rmdApplicableAge } from "./calculateRMD";
import { seniorMinAge, ultFactor } from "./rules";
import { cents } from "./money";
import type { FilingStatus, LawMode, MagiIrmaa } from "./types";

export interface LifetimeSpouse {
  label: string;
  birthYear: number;
  age: number;                    // age at the start of taxYear
  traditionalIra: number;
  socialSecurityAnnual: number;   // today's dollars, at claim
  ssClaimAge: number;
  pensionAnnual: number;          // today's dollars
  pensionSurvivorFraction: number;
}

export interface LifetimeInput {
  taxYear: number;
  lawMode: LawMode;
  filingStatus: FilingStatus;     // "mfj" (two spouses) or "single"
  spouses: LifetimeSpouse[];      // [A] or [A, B]
  rothBalance: number;
  taxableBalance: number;
  otherOrdinaryAnnual: number;
  spendingAnnual: number;         // today's dollars
  growthRate: number;
  inflationRate: number;
  horizonAge: number;             // project through spouses[0].age
  firstDeathAtAgeA: number;       // 0 = both survive to the horizon
  whoDiesFirst: string;           // "A" | "B"
  medicareEnrollees: number;
  beneficiaryTaxRate: number;
  beneficiaryWindowYears: number; // SECURE Act 10-year window
  conversionByYear: number[];     // conversion per projection-year index (missing = 0)
}

export interface LifetimeRow {
  year: number;
  ageA: number;
  ageB: number | null;
  filing: FilingStatus;
  socialSecurity: number;
  pension: number;
  rmd: number;
  conversion: number;
  taxableSocialSecurity: number;
  taxableIncome: number;
  federalTax: number;
  irmaa: number;
  spendingNeed: number;
  traditional: number;
  roth: number;
  taxable: number;
  afterTaxWealthFlat: number;
  afterTaxWealthBeneficiary: number;
  depleted: boolean;
}

export interface LifetimeResult {
  rows: LifetimeRow[];
  afterTaxWealthMethod: string;
  beneficiaryTaxRate: number;
  finalAfterTaxWealthFlat: number;
  finalAfterTaxWealthBeneficiary: number;
  survivorTransitionYear: number | null;
  depletionYear: number | null;
}

// Beneficiary inherits a pre-tax balance and drains it over N years at their own rate, the balance
// growing while it is held. Returns the after-tax total received.
function beneficiaryDrawdownNet(balance: number, growth: number, years: number, rate: number): number {
  let bal = balance, net = 0;
  for (let k = 0; k < years; k++) {
    bal *= 1 + growth;
    const w = bal / (years - k);       // drain the remainder over remaining years
    net += w * (1 - rate);
    bal -= w;
  }
  return net;
}

export function projectLifetime(input: LifetimeInput): LifetimeResult {
  const married = input.filingStatus === "mfj" && input.spouses.length >= 2;
  const N = input.beneficiaryWindowYears;
  const g = input.growthRate;

  // mutable per-spouse traditional balances
  const trad = input.spouses.map(s => s.traditionalIra);
  let roth = input.rothBalance;
  let taxable = input.taxableBalance;
  let bothAlive = married;
  let survivorTransitionYear: number | null = null;
  let depletionYear: number | null = null;

  const rows: LifetimeRow[] = [];
  const startAgeA = input.spouses[0]!.age;

  for (let i = 0; startAgeA + i <= input.horizonAge; i++) {
    const year = input.taxYear + i;
    const ageA = startAgeA + i;
    const ageB = married ? input.spouses[1]!.age + i : null;
    const infl = Math.pow(1 + input.inflationRate, i);

    // survivor transition at first death
    if (bothAlive && input.firstDeathAtAgeA > 0 && ageA >= input.firstDeathAtAgeA) {
      bothAlive = false;
      survivorTransitionYear = year;
      const goneIdx = input.whoDiesFirst === "A" ? 0 : 1;
      const survIdx = goneIdx === 0 ? 1 : 0;
      trad[survIdx]! += trad[goneIdx]!;
      trad[goneIdx] = 0;
    }
    const filing: FilingStatus = bothAlive ? "mfj" : married ? "single" : input.filingStatus;

    // per-spouse income
    let ssTotal = 0, pensionTotal = 0, rmdTotal = 0;
    const livingAges: number[] = [];
    input.spouses.forEach((s, idx) => {
      const ageS = s.age + i;
      const isGone = married && !bothAlive && (input.whoDiesFirst === "A" ? idx === 0 : idx === 1);
      if (isGone) return;
      livingAges.push(ageS);
      if (ageS >= s.ssClaimAge) ssTotal += s.socialSecurityAnnual * infl;
      pensionTotal += s.pensionAnnual * infl;
      const applic = rmdApplicableAge(s.birthYear).rmdApplicableAge;
      if (ageS >= applic && trad[idx]! > 0) {
        const f = ultFactor(ageS);
        if (f !== undefined) rmdTotal += trad[idx]! / f;
      }
    });
    // survivor inherits the larger Social Security benefit and a fraction of the deceased pension
    if (married && !bothAlive) {
      const goneIdx = input.whoDiesFirst === "A" ? 0 : 1;
      const survIdx = goneIdx === 0 ? 1 : 0;
      const gone = input.spouses[goneIdx]!, surv = input.spouses[survIdx]!;
      const goneSs = (surv.age + i) >= gone.ssClaimAge ? gone.socialSecurityAnnual * infl : 0;
      const ownSs = (surv.age + i) >= surv.ssClaimAge ? surv.socialSecurityAnnual * infl : 0;
      ssTotal = Math.max(ownSs, goneSs);
      pensionTotal = surv.pensionAnnual * infl + gone.pensionAnnual * gone.pensionSurvivorFraction * infl;
    }

    const totalTradBefore = trad.reduce((a, b) => a + b, 0);
    let conversion = input.conversionByYear[i] ?? 0;
    conversion = Math.max(0, Math.min(conversion, totalTradBefore - rmdTotal));
    const otherOrdinary = input.otherOrdinaryAnnual * infl;
    const spendingNeed = input.spendingAnnual * infl;

    // year tax as a function of an extra traditional withdrawal `w` for spending
    const yearOf = (w: number) => computeYear({
      taxYear: year, lawMode: input.lawMode, status: filing, ages: livingAges,
      grossSocialSecurity: ssTotal, pension: pensionTotal,
      iraDistributions: rmdTotal + w, rothConversion: conversion, otherOrdinary,
    });
    const base = yearOf(0);
    const tax0 = base.totalFederalTax;

    // spending waterfall: cash in = SS + pension + RMD + other (conversion is not cash)
    const cashIn = ssTotal + pensionTotal + rmdTotal + otherOrdinary;
    let shortfall = spendingNeed + tax0 - cashIn;
    let fromTaxable = 0, fromRoth = 0, tradWithdraw = 0, surplus = 0;

    if (shortfall <= 0) {
      surplus = -shortfall;
    } else {
      fromTaxable = Math.min(taxable, shortfall);
      shortfall -= fromTaxable;
      if (shortfall > 0) { fromRoth = Math.min(roth, shortfall); shortfall -= fromRoth; }
      if (shortfall > 0) {
        // gross up a traditional withdrawal so net-after-its-own-tax covers the remaining shortfall
        let w = shortfall;
        for (let k = 0; k < 100; k++) {
          const extra = yearOf(w).totalFederalTax - tax0;
          const nw = shortfall + extra;
          if (Math.abs(nw - w) < 1) { w = nw; break; }
          w = nw;
        }
        const avail = totalTradBefore - rmdTotal - conversion;
        tradWithdraw = Math.min(w, Math.max(0, avail));
        const netRaised = tradWithdraw - (yearOf(tradWithdraw).totalFederalTax - tax0);
        shortfall -= netRaised;
        if (shortfall > 1 && depletionYear === null) depletionYear = year;
      }
    }

    const fin = yearOf(tradWithdraw);
    const federalTax = fin.totalFederalTax;
    const onMedicare = input.medicareEnrollees > 0 && livingAges.some(a => a >= seniorMinAge());
    const irmaa = onMedicare
      ? calculateIrmaa(fin.magi.irmaa as unknown as MagiIrmaa, filing, bothAlive ? input.medicareEnrollees : 1).annualHouseholdSurchargeAboveStandard
      : 0;

    // apply account changes: draw ordinary IRA (rmd + conversion + spending withdrawal) pro-rata
    const iraOut = rmdTotal + conversion + tradWithdraw;
    const tt = totalTradBefore || 1;
    for (let idx = 0; idx < trad.length; idx++) trad[idx] = Math.max(0, trad[idx]! - iraOut * (trad[idx]! / tt));
    roth += conversion - fromRoth;
    taxable += surplus - fromTaxable;
    roth = Math.max(0, roth); taxable = Math.max(0, taxable);

    // grow at year end
    for (let idx = 0; idx < trad.length; idx++) trad[idx] = trad[idx]! * (1 + g);
    roth *= 1 + g; taxable *= 1 + g;

    const tradTot = trad.reduce((a, b) => a + b, 0);
    const flat = roth + taxable + tradTot * (1 - input.beneficiaryTaxRate);
    const benef = roth * Math.pow(1 + g, N) + taxable +
      beneficiaryDrawdownNet(tradTot, g, N, input.beneficiaryTaxRate);
    const depleted = tradTot + roth + taxable <= 1;
    if (depleted && depletionYear === null) depletionYear = year;

    rows.push({
      year, ageA, ageB, filing,
      socialSecurity: cents(ssTotal), pension: cents(pensionTotal), rmd: cents(rmdTotal),
      conversion: cents(conversion), taxableSocialSecurity: cents(fin.taxableSocialSecurity),
      taxableIncome: cents(fin.taxableIncome), federalTax: cents(federalTax), irmaa: cents(irmaa),
      spendingNeed: cents(spendingNeed), traditional: cents(tradTot), roth: cents(roth),
      taxable: cents(taxable), afterTaxWealthFlat: cents(flat), afterTaxWealthBeneficiary: cents(benef),
      depleted,
    });
  }

  const last = rows[rows.length - 1]!;
  return {
    rows,
    afterTaxWealthMethod: "beneficiary 10-year drawdown at beneficiary rate (primary); flat haircut (sensitivity)",
    beneficiaryTaxRate: input.beneficiaryTaxRate,
    finalAfterTaxWealthFlat: last.afterTaxWealthFlat,
    finalAfterTaxWealthBeneficiary: last.afterTaxWealthBeneficiary,
    survivorTransitionYear,
    depletionYear,
  };
}

// First year the convert strategy's after-tax wealth catches up to the do-nothing strategy.
export function crossoverYear(
  convert: LifetimeResult, nothing: LifetimeResult, method: "flat" | "beneficiary",
): number | null {
  const pick = (r: LifetimeRow) => method === "flat" ? r.afterTaxWealthFlat : r.afterTaxWealthBeneficiary;
  const n = Math.min(convert.rows.length, nothing.rows.length);
  for (let i = 0; i < n; i++) {
    if (pick(convert.rows[i]!) >= pick(nothing.rows[i]!)) return convert.rows[i]!.year;
  }
  return null;
}

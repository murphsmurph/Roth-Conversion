// Marginal conversion sweep (Phase 3). Sweeps a Roth conversion from $0 to a cap, computing the
// incremental federal tax, IRMAA surcharge (the year-N+2 Medicare cost), ACA credit loss (year N),
// state tax, and total economic cost at each step — plus the MARGINAL rate on the last dollar and
// the AVERAGE effective rate across the whole conversion. Every inflection in the curve is labeled
// with its deterministic cause and rule id; a jump (level change) carries a registry discontinuity id.
//
// All sweep configuration (step sizes, cap, window, epsilon) is passed in, so this engine file holds
// no magic numbers of its own.
import { computeYear } from "./calculateYear";
import { calculateIrmaa } from "./calculateIRMAA";
import {
  acaThresholdPercent, fplByHousehold, LTCG_RULE_ID, NIIT_RULE_ID, ORDINARY_BRACKETS_RULE_ID,
  niitThreshold, ordinaryBrackets, seniorMinAge, seniorPerPerson, seniorPhaseoutRate,
  seniorPhaseoutStart, SENIOR_RULE_ID, ssBase1, ssMaxRate, SS_RULE_ID, ACA_CLIFF_RULE_ID, irmaaTiers,
} from "./rules";
import type { FilingStatus, MagiAca, MagiIrmaa, YearInput } from "./types";

export interface SweepOpts {
  maxConversion: number;
  coarseStep: number;
  fineStep: number;
  fineWindow: number;
  marginalEpsilon: number;
  medicareEnrollees: number;   // 0 disables IRMAA cost
  householdSize: number;        // ACA household size
  annualAcaCredit: number;      // 0 disables ACA credit-loss modeling
  stateMarginalRate: number;    // v1: 0 (state engine not validated)
}

export interface Crossing {
  ruleId: string;
  cause: string;
  kind: "kink" | "jump";
}

export interface SweepStep {
  conversion: number;
  totalFederalTax: number;
  incrementalFederalTax: number;
  incrementalIrmaa: number;
  acaCreditLoss: number;
  stateTax: number;
  totalEconomicCost: number;
  marginalRate: number;   // on the last dollar of this step
  averageRate: number;    // across the whole conversion so far
  crossings: Crossing[];  // thresholds crossed entering this step
}

export interface SweepResult {
  steps: SweepStep[];
  inflections: SweepStep[]; // steps whose crossings are non-empty
}

interface Snap {
  c: number;
  fed: number;
  irmaaSurcharge: number;
  magiIrmaa: number;
  magiAca: number;
  brRate: number;
  ssState: string;
  seniorState: string;
  prefState: string;
  niitState: string;
  irmaaTier: number;
  irmaaRuleId: string;
  acaEligible: boolean;
}

function topOrdinaryRate(taxableIncome: number, status: FilingStatus): number {
  const bands = ordinaryBrackets(status);
  let rate = bands[0]![1];
  for (const band of bands) if (taxableIncome >= band[0]) rate = band[1];
  return rate;
}

export function sweepConversion(base: YearInput, opts: SweepOpts): SweepResult {
  const status = base.status;
  const ages = base.ages;
  const seniorMin = seniorMinAge();
  const nSeniors = ages.filter(a => a >= seniorMin).length;
  const grossSs = base.grossSocialSecurity ?? 0;
  // Net investment income is fixed by the base household (a conversion is NOT investment income).
  const nii = (base.interest ?? 0) + (base.ordinaryDividends ?? base.qualifiedDividends ?? 0) + (base.netLtcg ?? 0);
  const trackIrmaa = opts.medicareEnrollees > 0;
  const trackAca = opts.annualAcaCredit > 0;
  const seniorEnd = (s: FilingStatus): number => seniorPhaseoutStart(s) + seniorPerPerson() / seniorPhaseoutRate();

  const snap = (c: number): Snap => {
    const y = computeYear({ ...base, rothConversion: c });
    const magiIrmaa = y.magi.irmaa as number;
    const magiAca = y.magi.aca as number;
    const irmaa = trackIrmaa
      ? calculateIrmaa(magiIrmaa as unknown as MagiIrmaa, status, opts.medicareEnrollees)
      : { annualHouseholdSurchargeAboveStandard: 0, tier: 0, appliedRuleIds: ["IRMAA_TIER_0"] };
    const acaEligible = trackAca
      ? computeAcaEligible(magiAca as unknown as MagiAca, opts.householdSize)
      : true;

    let ssState = "na";
    if (grossSs > 0) {
      if (y.provisionalIncome <= ssBase1(status)) ssState = "none";
      else if (y.taxableSocialSecurity >= grossSs * ssMaxRate() - 1) ssState = "ceiling";
      else ssState = "phasing";
    }
    let seniorState = "na";
    if (nSeniors > 0) {
      const m = y.magi.senior as number;
      if (m < seniorPhaseoutStart(status)) seniorState = "full";
      else if (m >= seniorEnd(status)) seniorState = "gone";
      else seniorState = "phasing";
    }
    const p = y.preferential;
    const prefState = `${p.taxedAtZero > 0 ? 1 : 0}${p.taxedAtFifteen > 0 ? 1 : 0}${p.taxedAtTwenty > 0 ? 1 : 0}`;
    // NIIT has a phase-in: off below the threshold, +3.8% marginal while NII is being pulled in,
    // then flat (full) once all NII is included. Track all three so the completion kink is caught.
    const niitBaseTop = niitThreshold(status) + nii;
    const magiNiit = y.magi.niit as number;
    const niitState = nii <= 0 ? "na" : magiNiit <= niitThreshold(status) ? "off" : magiNiit >= niitBaseTop ? "full" : "phasing";

    return {
      c,
      fed: y.totalFederalTax,
      irmaaSurcharge: irmaa.annualHouseholdSurchargeAboveStandard,
      magiIrmaa,
      magiAca,
      // marginal ordinary bracket is set by ORDINARY taxable income (preferential stacks on top)
      brRate: topOrdinaryRate(y.ordinaryIncome, status),
      ssState,
      seniorState,
      prefState,
      niitState,
      irmaaTier: irmaa.tier,
      irmaaRuleId: irmaa.appliedRuleIds[0]!,
      acaEligible,
    };
  };

  const base0 = snap(0);

  // Build the adaptive grid: coarse steps, refined near each enumerated discontinuity crossing.
  const disc: number[] = [];
  if (trackIrmaa) {
    for (const t of irmaaTiers(status)) {
      if (t.magiMax !== null) {
        const conv = t.magiMax - base0.magiIrmaa;
        if (conv > 0 && conv < opts.maxConversion) disc.push(conv);
      }
    }
  }
  if (trackAca) {
    const fpl = fplByHousehold(opts.householdSize);
    if (fpl !== undefined) {
      const conv = fpl * (acaThresholdPercent() / 100) - base0.magiAca;
      if (conv > 0 && conv < opts.maxConversion) disc.push(conv);
    }
  }

  // memoized snapshots (refinement re-reads neighbors)
  const cache = new Map<number, Snap>();
  cache.set(0, base0);
  const snapAt = (c: number): Snap => {
    let s = cache.get(c);
    if (s === undefined) { s = snap(c); cache.set(c, s); }
    return s;
  };

  const diff = (prev: Snap, cur: Snap): Crossing[] => {
    const out: Crossing[] = [];
    if (cur.brRate !== prev.brRate) out.push({ ruleId: ORDINARY_BRACKETS_RULE_ID, cause: "ordinary bracket boundary", kind: "kink" });
    if (cur.ssState !== prev.ssState && cur.ssState !== "na") out.push({ ruleId: SS_RULE_ID, cause: `Social Security ${cur.ssState === "ceiling" ? "85% ceiling reached" : "phase-in / torpedo"}`, kind: "kink" });
    if (cur.seniorState !== prev.seniorState && cur.seniorState !== "na") out.push({ ruleId: SENIOR_RULE_ID, cause: "senior-deduction phaseout", kind: "kink" });
    if (cur.prefState !== prev.prefState) out.push({ ruleId: LTCG_RULE_ID, cause: "LTCG/QD rate-band stacking", kind: "kink" });
    if (cur.niitState !== prev.niitState && cur.niitState !== "na") out.push({ ruleId: NIIT_RULE_ID, cause: `NIIT ${cur.niitState === "full" ? "fully phased in" : "threshold"}`, kind: "kink" });
    if (trackIrmaa && cur.irmaaTier !== prev.irmaaTier) out.push({ ruleId: cur.irmaaRuleId, cause: `IRMAA tier ${prev.irmaaTier} -> ${cur.irmaaTier}`, kind: "jump" });
    if (trackAca && cur.acaEligible !== prev.acaEligible) out.push({ ruleId: ACA_CLIFF_RULE_ID, cause: "ACA 400% FPL cliff", kind: "jump" });
    return out;
  };

  const cost = (s: Snap): number => {
    const incFed = s.fed - base0.fed;
    const incIrmaa = s.irmaaSurcharge - base0.irmaaSurcharge;
    const acaLoss = s.acaEligible ? 0 : opts.annualAcaCredit;
    const state = s.c * opts.stateMarginalRate;
    return incFed + incIrmaa + acaLoss + state;
  };

  // Initial grid: coarse steps + fine steps near each enumerated jump discontinuity.
  const points = new Set<number>();
  for (let c = 0; c <= opts.maxConversion; c += opts.coarseStep) points.add(c);
  for (const d of disc) {
    const lo = Math.max(0, d - opts.fineWindow), hi = Math.min(opts.maxConversion, d + opts.fineWindow);
    for (let c = lo; c <= hi; c += opts.fineStep) points.add(Math.round(c));
  }
  let grid = [...points].sort((a, b) => a - b);

  // Adaptive refinement: isolate EVERY regime change (kink or jump) to fineStep resolution so each
  // inflection maps to exactly one interval and no blended marginal change goes unattributed.
  for (let pass = 0; pass < 2; pass++) {
    const add: number[] = [];
    for (let i = 1; i < grid.length; i++) {
      if (grid[i]! - grid[i - 1]! <= opts.fineStep) continue;
      if (diff(snapAt(grid[i - 1]!), snapAt(grid[i]!)).length > 0) {
        for (let c = grid[i - 1]! + opts.fineStep; c < grid[i]!; c += opts.fineStep) add.push(Math.round(c));
      }
    }
    if (add.length === 0) break;
    for (const c of add) points.add(c);
    grid = [...points].sort((a, b) => a - b);
  }

  const steps: SweepStep[] = [];
  let prevSnap = base0;
  let prevCost = 0;
  for (let i = 0; i < grid.length; i++) {
    const s = snapAt(grid[i]!);
    const c = s.c;
    const totalCost = cost(s);
    const crossings = i === 0 ? [] : diff(prevSnap, s);
    const dC = i === 0 ? 0 : c - prevSnap.c;
    const marginalRate = i === 0 || dC === 0 ? 0 : (totalCost - prevCost) / dC;
    steps.push({
      conversion: c,
      totalFederalTax: s.fed,
      incrementalFederalTax: s.fed - base0.fed,
      incrementalIrmaa: s.irmaaSurcharge - base0.irmaaSurcharge,
      acaCreditLoss: s.acaEligible ? 0 : opts.annualAcaCredit,
      stateTax: c * opts.stateMarginalRate,
      totalEconomicCost: totalCost,
      marginalRate,
      averageRate: c > 0 ? totalCost / c : 0,
      crossings,
    });
    prevSnap = s;
    prevCost = totalCost;
  }

  return { steps, inflections: steps.filter(s => s.crossings.length > 0) };
}

// Local ACA eligibility (avoids importing the full AcaResult shape here).
function computeAcaEligible(magiAca: MagiAca, householdSize: number): boolean {
  const fpl = fplByHousehold(householdSize);
  if (fpl === undefined) return false;
  return (magiAca as number) <= fpl * (acaThresholdPercent() / 100);
}

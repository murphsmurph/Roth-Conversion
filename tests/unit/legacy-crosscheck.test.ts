// Cross-check: the LEGACY projector engine (which drives the live projection UI) vs the VALIDATED
// computeYear (which powers the optimizer panel and is oracle-checked by the fixtures). Both are
// inlined into the same page, so a client could see numbers from each — this test pins the shared
// federal kernel together and documents, as explicit assertions, the two places the validated engine
// is deliberately MORE accurate than the legacy one.
//
// The legacy engine exposes its federal primitives via createProjectorEngine(...)._fed. We reconstruct
// its single-year federal tax exactly the way the legacy `yearStack` closure does (see
// src/engine/legacy/projectorEngine.ts), and compare to computeYear.
import { describe, it, expect } from "vitest";
// @ts-ignore - legacy module is @ts-nocheck
import { createProjectorEngine } from "../../src/engine/legacy/projectorEngine";
import { computeYear } from "../../src/engine/calculateYear";
import type { FilingStatus } from "../../src/engine/types";

const fed = (createProjectorEngine({} as any) as any)._fed;

// Legacy single-year federal tax (ordinary + LTCG + NIIT), mirroring yearStack. `ordinary` is all
// ordinary income before Social Security; `div` is qualified dividends (preferential + NII base);
// n65 is the number of filers 65+ (adds the age-65 STANDARD add-on only — legacy models no OBBBA
// senior bonus deduction). regMult is 1 here (no regime shift).
function legacyFederal(fil: FilingStatus, ordinary: number, ss: number, div: number, n65: number): number {
  const ssT = fed.taxableSS(fil, ordinary, ss);
  const ordInc = ordinary + ssT;
  const std = fed.STD[fil] + n65 * fed.STD65[fil];
  const ti = Math.max(0, ordInc - std);
  const shelter = Math.max(0, std - ordInc);
  const pref = Math.max(0, div - shelter);
  const ordinaryTax = fed.ordTax(fil, ti);
  const cg = fed.ltcgTax(fil, ti, pref);
  const magi = ordinary + ssT + div;
  const nii = fed.niitTax(fil, magi, div);
  return ordinaryTax + cg + nii;
}

function validatedFederal(fil: FilingStatus, ordinary: number, ss: number, div: number, ages: number[]): number {
  return computeYear({
    taxYear: 2026, lawMode: "current_law", status: fil, ages,
    grossSocialSecurity: ss, otherOrdinary: ordinary, qualifiedDividends: div,
  }).totalFederalTax;
}

const under65 = (fil: FilingStatus): number[] => (fil === "mfj" ? [60, 60] : [60]);
const over65 = (fil: FilingStatus): number[] => (fil === "mfj" ? [66, 66] : [66]);
const n65Over = (fil: FilingStatus): number => (fil === "mfj" ? 2 : 1);
const statuses: FilingStatus[] = ["single", "mfj"];

describe("legacy vs validated — shared federal kernel (must agree to the cent)", () => {
  // No dividends and under 65: isolates ordinary brackets + the Social Security worksheet. No senior
  // deduction and no SS/dividend interaction, so the two engines must produce the same federal tax.
  it("ordinary income + Social Security, no dividends, under 65", () => {
    for (const fil of statuses)
      for (const ordinary of [20_000, 50_000, 90_000, 150_000, 300_000])
        for (const ss of [0, 20_000, 40_000]) {
          const l = legacyFederal(fil, ordinary, ss, 0, 0);
          const v = validatedFederal(fil, ordinary, ss, 0, under65(fil));
          expect(Math.abs(v - l), `${fil} ord=${ordinary} ss=${ss}: legacy ${l.toFixed(2)} vs validated ${v.toFixed(2)}`).toBeLessThan(1);
        }
  });

  // Qualified dividends with NO Social Security and under 65: isolates the LTCG/QD 0/15/20 stacking
  // worksheet and NIIT. (With SS = 0 the SS-provisional-income difference below cannot arise.)
  it("ordinary income + qualified dividends, no Social Security, under 65", () => {
    for (const fil of statuses)
      for (const ordinary of [20_000, 50_000, 120_000, 260_000])
        for (const div of [10_000, 40_000, 100_000]) {
          const l = legacyFederal(fil, ordinary, 0, div, 0);
          const v = validatedFederal(fil, ordinary, 0, div, under65(fil));
          expect(Math.abs(v - l), `${fil} ord=${ordinary} div=${div}: legacy ${l.toFixed(2)} vs validated ${v.toFixed(2)}`).toBeLessThan(1);
        }
  });
});

describe("legacy vs validated — documented divergences (validated is the more accurate engine)", () => {
  // Divergence 1: the OBBBA senior bonus deduction. computeYear models it (up to $6,000/person 65+,
  // phasing out); the legacy engine does not. So at 65+ the validated engine gives a LOWER tax, by
  // roughly the senior deduction times the marginal rate.
  it("65+: validated tax is lower than legacy by (roughly) the OBBBA senior deduction effect", () => {
    for (const fil of statuses) {
      const ordinary = 60_000; // below the senior phaseout start, so the full bonus applies
      const l = legacyFederal(fil, ordinary, 0, 0, n65Over(fil));
      const v = validatedFederal(fil, ordinary, 0, 0, over65(fil));
      expect(v, `${fil}: validated ${v.toFixed(2)} should be < legacy ${l.toFixed(2)}`).toBeLessThan(l);
      // full bonus = $6,000 * (#65+); the gap is the bonus times the marginal rate it displaces,
      // so it sits inside a 10%–37% envelope (with slack for a bonus that spans two brackets).
      const bonus = 6_000 * n65Over(fil);
      expect(l - v).toBeGreaterThanOrEqual(bonus * 0.10);
      expect(l - v).toBeLessThanOrEqual(bonus * 0.40);
    }
  });

  // Divergence 2: dividends in the Social Security provisional-income base. IRC 86 provisional income
  // includes AGI (so qualified dividends count); the legacy engine omits dividends from its SS
  // provisional income, under-taxing Social Security. So when SS AND dividends are both present, the
  // validated engine taxes at least as much federal tax as legacy.
  it("SS + dividends: validated federal tax >= legacy (legacy omits dividends from SS provisional income)", () => {
    for (const fil of statuses)
      for (const ss of [20_000, 40_000])
        for (const div of [20_000, 60_000]) {
          const ordinary = 30_000;
          const l = legacyFederal(fil, ordinary, ss, div, 0);
          const v = validatedFederal(fil, ordinary, ss, div, under65(fil));
          expect(v, `${fil} ss=${ss} div=${div}: validated ${v.toFixed(2)} >= legacy ${l.toFixed(2)}`).toBeGreaterThanOrEqual(l - 1);
        }
  });
});

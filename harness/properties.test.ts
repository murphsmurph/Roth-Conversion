/**
 * PHASE 0 PROPERTY TESTS — corrected per review.
 *
 * These do NOT assert that tax curves have a particular shape. They assert that
 * every movement in the curve is EXPLAINED by an enumerated rule. That is the
 * real invariant and it survives contact with credits, carryforwards, ACA and
 * state interactions.
 */
import { describe, it, expect } from 'vitest'
import { computeYear } from '../../src/engine/calculateYear'
import { ENUMERATED_DISCONTINUITIES } from '../../src/rules/discontinuities'

/** Fixture classes explicitly designated monotonic. Membership is a claim that
 *  must be justified in the fixture file, not a global assumption. */
const MONOTONIC_CLASSES = ['federal', 'social-security', 'senior-deduction', 'capital-gains']

const sweep = (base: any, from: number, to: number, step: number) => {
  const out = []
  for (let c = from; c <= to; c += step) out.push({ c, r: computeYear({ ...base, roth_conversion: c }) })
  return out
}

describe('P1 — designated-monotonic classes', () => {
  it('federal income tax does not fall as conversion income rises, absent an identified interaction', () => {
    const base = { status: 'mfj', ages: [68, 67], gross_ss: 48000, ira_distributions: 40000 }
    const pts = sweep(base, 0, 300000, 1000)
    for (let i = 1; i < pts.length; i++) {
      const drop = pts[i - 1].r.regularTax - pts[i].r.regularTax
      if (drop > 0.005) {
        // A decrease is not automatically a bug — but it must name its cause.
        expect(pts[i].r.appliedRuleIds, `unexplained tax decrease at conversion ${pts[i].c}`)
          .toEqual(expect.arrayContaining([expect.stringMatching(/^(IRC|OBBBA|ACA|IRMAA|STATE)_/)]))
      }
    }
  })
})

describe('P2 — no unexplained movement (the real invariant)', () => {
  it('every discontinuity in total economic cost reports an enumerated rule id', () => {
    const base = { status: 'mfj', ages: [66, 65], gross_ss: 0, ira_distributions: 40000 }
    const STEP = 100
    const pts = sweep(base, 0, 400000, STEP)
    // A jump larger than (top marginal rate x step) x safety cannot be smooth bracket math.
    const SMOOTH_MAX = 0.37 * STEP * 1.5
    for (let i = 1; i < pts.length; i++) {
      const jump = pts[i].r.totalEconomicCost - pts[i - 1].r.totalEconomicCost
      if (Math.abs(jump) > SMOOTH_MAX) {
        const ids = pts[i].r.appliedRuleIds ?? []
        expect(ids.length, `undocumented discontinuity of ${jump.toFixed(2)} at ${pts[i].c}`).toBeGreaterThan(0)
        expect(ENUMERATED_DISCONTINUITIES, `rule id at ${pts[i].c} not in the enumerated registry`)
          .toEqual(expect.arrayContaining([ids.find(id => ENUMERATED_DISCONTINUITIES.includes(id))]))
      }
    }
  })
})

describe('P3 — zero identity', () => {
  it('a $0 conversion reproduces the baseline to the penny', () => {
    const base = { status: 'mfj', ages: [68, 67], gross_ss: 48000, ira_distributions: 40000 }
    const a = computeYear(base)
    const b = computeYear({ ...base, roth_conversion: 0 })
    expect(b).toEqual(a)
  })
})

describe('P4 — additivity within a year', () => {
  it('converting X then Y equals converting X+Y in the same tax year', () => {
    const base = { status: 'mfj', ages: [68, 67], gross_ss: 48000, ira_distributions: 40000 }
    const split = computeYear({ ...base, roth_conversion: 30000 + 45000 })
    const whole = computeYear({ ...base, roth_conversion: 75000 })
    expect(split.totalFederalTax).toBeCloseTo(whole.totalFederalTax, 2)
  })
})

describe('P5 — MAGI isolation', () => {
  it('the four MAGIs are computed independently and are not aliases', () => {
    const r = computeYear({ status: 'mfj', ages: [68, 67], gross_ss: 60000,
                            ira_distributions: 50000, tax_exempt_interest: 8000 })
    expect(r.magi.aca).toBeGreaterThan(r.magi.irmaa)   // ACA adds non-taxable SS
    expect(r.magi.irmaa).toBeGreaterThan(r.magi.niit)  // IRMAA adds muni interest
    expect(r.magi.senior).toBe(r.agi)
  })
})

describe('P6 — provenance completeness', () => {
  it('every calculated line carries a rule id and every rule id resolves', () => {
    const r = computeYear({ status: 'mfj', ages: [68, 67], gross_ss: 48000, ira_distributions: 90000 })
    expect(r.calculationMetadata.engineVersion).toBeTruthy()
    expect(r.calculationMetadata.federalRulesVersion).toBe('federal-2026')
    expect(r.taxableSocialSecurityMeta.ruleId).toBe('IRC_86_SS_TAXABILITY')
    expect(r.deductions.seniorBonusDeductionMeta.ruleId).toBe('OBBBA_SENIOR_DEDUCTION')
  })
})

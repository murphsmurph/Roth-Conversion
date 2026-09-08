/**
 * PHASE 0 HARNESS — table-driven fixture runner.
 * Drop at tests/unit/fixtures.test.ts. Requires vitest.
 *
 * This file must stay tiny. All intelligence lives in the fixture JSON.
 * Adding a test case must never mean editing this file.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { computeYear } from '../../src/engine/calculateYear'

const ROOT = join(__dirname, '..', 'fixtures')
const FOLDERS = ['federal', 'social-security', 'senior-deduction', 'capital-gains']

// Fixture expected-keys -> engine output path. The engine MUST expose these
// intermediate values (Addendum R4a); a fixture that can only check final tax
// tells you nothing about where a number went wrong.
const PATHS: Record<string, string> = {
  provisional_income:        'provisionalIncome',
  taxable_social_security:   'taxableSocialSecurity',
  agi:                       'agi',
  senior_bonus_deduction:    'deductions.seniorBonusDeduction',
  total_deductions:          'deductions.total',
  taxable_income:            'taxableIncome',
  ordinary_taxable_income:   'ordinaryIncome',
  preferential_taxed_at_0:   'preferential.taxedAtZero',
  preferential_taxed_at_15:  'preferential.taxedAtFifteen',
  preferential_taxed_at_20:  'preferential.taxedAtTwenty',
  regular_tax:               'regularTax',
  niit:                      'niit',
  total_federal_tax:         'totalFederalTax',
}

const dig = (o: any, p: string) => p.split('.').reduce((a, k) => a?.[k], o)

for (const folder of FOLDERS) {
  describe(folder, () => {
    const dir = join(ROOT, folder)
    for (const file of readdirSync(dir).filter(f => f.endsWith('.json'))) {
      const fx = JSON.parse(readFileSync(join(dir, file), 'utf8'))
      it(`${fx.id}: ${fx.title}`, () => {
        const got = computeYear(fx.input)
        for (const [key, expected] of Object.entries(fx.expected)) {
          if (key.startsWith('_') || key === 'magi') continue
          const actual = dig(got, PATHS[key])
          expect(actual, `${fx.id} -> ${key}`).toBeCloseTo(expected as number, 2)
        }
        // every MAGI is checked independently — they are NOT interchangeable
        if (fx.expected.magi) {
          for (const [k, v] of Object.entries(fx.expected.magi)) {
            expect(dig(got, `magi.${k}`), `${fx.id} -> magi.${k}`).toBeCloseTo(v as number, 2)
          }
        }
        // pair fixtures additionally assert the MARGINAL behaviour
        const pd = (fx.expected as any)._pair_delta
        if (pd) {
          const baseFx = JSON.parse(readFileSync(join(dir, `${pd.baseline_fixture}.json`), 'utf8'))
          const base = computeYear(baseFx.input)
          const dTax = got.totalFederalTax - base.totalFederalTax
          expect(dTax).toBeCloseTo(pd.delta_total_federal_tax, 2)
          expect(dTax / pd.delta_conversion).toBeCloseTo(pd.effective_marginal_rate_on_conversion, 6)
        }
      })
    }
  })
}

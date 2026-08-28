import { describe, expect, it } from 'vitest'
import {
  calculateModelErrorSummary,
  calculatePredictionRange,
  summarizeDamageRegression,
} from '../src/core/modelError'
import { DEFAULT_SCENARIO } from '../src/data/scenarios'
import type { DamageRegressionSample } from '../src/core/types'

const regressionSample: DamageRegressionSample = {
  id: 'bindings-no-enchants-001',
  gameVersion: '1.17.0.0',
  build: {
    weapon: {
      instanceId: 'bindings-regression',
      weaponId: 'fighters-bindings',
      powerLevel: 251,
      observedDamagePerHit: 100,
      enchantmentSlots: [{ candidates: ['critical-hit'] }],
    },
    enchantments: [{ enchantmentId: 'critical-hit', tier: 3, source: 'slot' }],
    artifacts: [],
  },
  scenario: DEFAULT_SCENARIO,
  observedSingleTargetDps: 700,
}

describe('model error summary', () => {
  it('does not invent an error range before five measurements exist', () => {
    const summary = calculateModelErrorSummary([
      { predicted: 100, observed: 100 },
      { predicted: 105, observed: 100 },
    ])

    expect(summary).toEqual({ status: 'pending', sampleCount: 2, minimumSampleCount: 5 })
    expect(calculatePredictionRange(100, summary)).toBeUndefined()
  })

  it('calculates MAPE, P90, maximum error, bias and a prediction range', () => {
    const summary = calculateModelErrorSummary([
      { predicted: 100, observed: 100 },
      { predicted: 110, observed: 100 },
      { predicted: 90, observed: 100 },
      { predicted: 120, observed: 100 },
      { predicted: 80, observed: 100 },
    ])

    expect(summary.status).toBe('available')
    if (summary.status !== 'available') throw new Error('Expected available model error summary.')
    expect(summary.meanAbsolutePercentageError).toBeCloseTo(0.12)
    expect(summary.p90AbsolutePercentageError).toBeCloseTo(0.2)
    expect(summary.maximumAbsolutePercentageError).toBeCloseTo(0.2)
    expect(summary.meanSignedPercentageError).toBeCloseTo(0)
    expect(calculatePredictionRange(200, summary)).toEqual({ lower: 160, upper: 240 })
  })

  it('rejects invalid values even when the sample count is below the threshold', () => {
    expect(() => calculateModelErrorSummary([
      { predicted: 100, observed: 0 },
    ])).toThrow('0より大きい有限値')
  })

  it('evaluates a reproducible build before summarizing its observed DPS', () => {
    expect(summarizeDamageRegression([regressionSample])).toEqual({
      status: 'pending', sampleCount: 1, minimumSampleCount: 5,
    })
  })

  it('rejects duplicate sample IDs', () => {
    expect(() => summarizeDamageRegression([
      regressionSample,
      regressionSample,
    ])).toThrow('重複しています')
  })

  it('rejects normalized ratings in an observed-DPS regression sample', () => {
    expect(() => summarizeDamageRegression([{
      ...regressionSample,
      build: {
        ...regressionSample.build,
        weapon: { ...regressionSample.build.weapon, observedDamagePerHit: undefined },
      },
    }])).toThrow('observedDamagePerHit')
  })
})

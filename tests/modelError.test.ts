import { describe, expect, it } from 'vitest'
import {
  calculateModelErrorSummary,
  calculatePredictionRange,
  summarizeDamageRegression,
  summarizeDamageRegressionByScope,
} from '../src/core/modelError'
import { DEFAULT_SCENARIO } from '../src/data/scenarios'
import type { DamageRegressionSample } from '../src/core/types'

const regressionSample: DamageRegressionSample = {
  id: 'bindings-no-enchants-001',
  auditEntryId: 'audit-bindings-no-enchants-001',
  gameVersion: '1.17.0.0',
  gameVersionConfidence: 'verified',
  source: {
    id: 'public-target-dummy-run',
    label: 'Public target-dummy run',
    url: 'https://example.com/measurement',
    kind: 'community-test',
  },
  sourceConfidence: 'high',
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
  measurement: {
    kind: 'total-damage-over-time',
    durationSeconds: 10,
    totalDamage: 7_000,
    note: 'Published total damage divided by the published duration.',
  },
  mechanicTags: ['critical-hit'],
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
    expect(summary.medianAbsolutePercentageError).toBeCloseTo(0.1)
    expect(summary.p90AbsolutePercentageError).toBeCloseTo(0.2)
    expect(summary.maximumAbsolutePercentageError).toBeCloseTo(0.2)
    expect(summary.meanSignedPercentageError).toBeCloseTo(0)
    expect(summary.medianSignedPercentageError).toBeCloseTo(0)
    expect(calculatePredictionRange(200, summary)).toEqual({ lower: 160, upper: 240 })
  })

  it('rejects invalid values even when the sample count is below the threshold', () => {
    expect(() => calculateModelErrorSummary([
      { predicted: 100, observed: 0 },
    ])).toThrow('0より大きい有限値')
    expect(() => calculatePredictionRange(Number.NaN, {
      status: 'pending', sampleCount: 0, minimumSampleCount: 5,
    })).toThrow('0より大きい有限値')
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

  it('keeps overall, final-version, weapon, and mechanic minimums independent', () => {
    const samples = Array.from({ length: 5 }, (_, index) => ({
      ...regressionSample,
      id: `bindings-${index}`,
      auditEntryId: `audit-bindings-${index}`,
    }))
    const summaries = summarizeDamageRegressionByScope(samples)
    expect(summaries.overall.status).toBe('available')
    expect(summaries.finalVersionOnly.status).toBe('available')
    expect(summaries.byWeapon['fighters-bindings'].status).toBe('available')
    expect(summaries.byWeapon.anchor).toEqual({
      status: 'pending', sampleCount: 0, minimumSampleCount: 5,
    })
    expect(summaries.byMechanic['critical-hit'].status).toBe('available')
    expect(summaries.byMechanic['void-strike'].status).toBe('pending')
  })

  it('rejects inconsistent raw totals and missing public provenance', () => {
    expect(() => summarizeDamageRegression([{
      ...regressionSample,
      source: { ...regressionSample.source, url: undefined },
    }])).toThrow('公開source')
    expect(() => summarizeDamageRegression([{
      ...regressionSample,
      measurement: { ...regressionSample.measurement, totalDamage: 8_000 },
    }])).toThrow('observed DPSが一致しません')
  })
})

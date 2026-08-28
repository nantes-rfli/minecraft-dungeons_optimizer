import { describe, expect, it } from 'vitest'
import { calculatePowerScaledHitDamage } from '../src/core/powerScaling'
import {
  evaluatePowerScalingSamples,
  POWER_SCALING_RANGE_ERROR_TOLERANCE,
  summarizePowerScalingValidation,
} from '../src/core/powerScalingValidation'
import type { WeaponId } from '../src/core/types'
import { GEAR_POWER_CURVE } from '../src/data/powerScaling'
import { POWER_SCALING_VALIDATION_SAMPLES } from '../src/data/powerScalingValidation'
import { WEAPONS } from '../src/data/weapons'

const predict = (weaponId: WeaponId, powerLevel: number) =>
  calculatePowerScaledHitDamage(
    WEAPONS[weaponId].baseHitDamage.value,
    powerLevel,
    GEAR_POWER_CURVE.value,
  )

const observations = evaluatePowerScalingSamples(POWER_SCALING_VALIDATION_SAMPLES, predict)

describe('published power scaling cross-validation', () => {
  it('keeps independent published samples for all three runtime weapons', () => {
    expect(POWER_SCALING_VALIDATION_SAMPLES).toHaveLength(29)
    expect(POWER_SCALING_VALIDATION_SAMPLES.filter(
      (sample) => sample.weaponId === 'fighters-bindings',
    )).toHaveLength(3)
    expect(POWER_SCALING_VALIDATION_SAMPLES.filter(
      (sample) => sample.weaponId === 'double-axe',
    )).toHaveLength(14)
    expect(POWER_SCALING_VALIDATION_SAMPLES.filter(
      (sample) => sample.weaponId === 'anchor',
    )).toHaveLength(12)
  })

  it('reproduces the published Anchor knots exactly', () => {
    const summary = summarizePowerScalingValidation('anchor', observations)
    expect(summary).toEqual({
      weaponId: 'anchor',
      sampleCount: 12,
      medianRelativeError: 0,
      p90RelativeError: 0,
      maximumRelativeError: 0,
      withinToleranceCount: 12,
    })
  })

  it('keeps all Double Axe samples within the documented 8% tolerance', () => {
    const summary = summarizePowerScalingValidation('double-axe', observations)
    expect(POWER_SCALING_RANGE_ERROR_TOLERANCE).toBe(0.08)
    expect(summary.sampleCount).toBe(14)
    expect(summary.medianRelativeError).toBeCloseTo(0.060156, 5)
    expect(summary.p90RelativeError).toBeCloseTo(0.061818, 5)
    expect(summary.maximumRelativeError).toBeCloseTo(0.062222, 5)
    expect(summary.withinToleranceCount).toBe(14)
  })

  it('records the Fighter\'s Bindings P114 outlier instead of calibrating it away', () => {
    const summary = summarizePowerScalingValidation('fighters-bindings', observations)
    expect(summary.sampleCount).toBe(3)
    expect(summary.medianRelativeError).toBe(0)
    expect(summary.p90RelativeError).toBeCloseTo(0.21347, 5)
    expect(summary.maximumRelativeError).toBeCloseTo(0.21347, 5)
    expect(summary.withinToleranceCount).toBe(2)

    const power114 = observations.find(
      (observation) => observation.sample.id === 'fighters-bindings-p114-wiki',
    )
    expect(power114).toMatchObject({
      predicted: 689,
      absoluteError: 187,
      withinPublishedRange: false,
      withinTolerance: false,
    })
  })

  it('uses zero range error inside a published interval and rejects invalid fixtures', () => {
    const power251 = observations.find(
      (observation) => observation.sample.id === 'fighters-bindings-p251-community',
    )
    expect(power251).toMatchObject({
      predicted: 188_334,
      absoluteError: 0,
      relativeError: 0,
      withinPublishedRange: true,
    })

    expect(() => evaluatePowerScalingSamples([
      POWER_SCALING_VALIDATION_SAMPLES[0]!,
      POWER_SCALING_VALIDATION_SAMPLES[0]!,
    ], predict)).toThrow('重複しています')
  })
})

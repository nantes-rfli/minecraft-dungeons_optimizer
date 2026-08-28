import { describe, expect, it } from 'vitest'
import {
  calculatePowerScaledHitDamage,
  resolveWeaponDamageCoefficient,
} from '../src/core/powerScaling'
import {
  evaluatePowerScalingSamples,
  summarizePowerScalingValidation,
} from '../src/core/powerScalingValidation'
import type { WeaponId } from '../src/core/types'
import {
  CROSS_WEAPON_DAMAGE_SCALING,
  GEAR_POWER_CURVE,
  WIKI_BASE_HIT_DAMAGE,
} from '../src/data/powerScaling'
import { POWER_SCALING_VALIDATION_SAMPLES } from '../src/data/powerScalingValidation'
import { WEAPONS } from '../src/data/weapons'

const referenceWeaponId = GEAR_POWER_CURVE.value.referenceWeaponId

const predictModelW = (weaponId: WeaponId, powerLevel: number) =>
  calculatePowerScaledHitDamage(
    WIKI_BASE_HIT_DAMAGE[weaponId].value,
    WIKI_BASE_HIT_DAMAGE[referenceWeaponId].value,
    powerLevel,
    GEAR_POWER_CURVE.value,
  )

const predictModelG = (weaponId: WeaponId, powerLevel: number) =>
  calculatePowerScaledHitDamage(
    WEAPONS[weaponId].internalPowerRating.value,
    WEAPONS[referenceWeaponId].internalPowerRating.value,
    powerLevel,
    GEAR_POWER_CURVE.value,
  )

const modelWObservations = evaluatePowerScalingSamples(
  POWER_SCALING_VALIDATION_SAMPLES,
  predictModelW,
)
const modelGObservations = evaluatePowerScalingSamples(
  POWER_SCALING_VALIDATION_SAMPLES,
  predictModelG,
)

describe('power rating meaning reconciliation', () => {
  it('keeps the 29 independent published fixtures unchanged', () => {
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

  it('records Model W fit for the two independent weapons and overall', () => {
    expect(summarizePowerScalingValidation('fighters-bindings', modelWObservations))
      .toEqual({
        scope: 'fighters-bindings',
        sampleCount: 3,
        medianRelativeError: 0,
        p90RelativeError: expect.closeTo(0.213470, 6),
        maximumRelativeError: expect.closeTo(0.213470, 6),
        withinToleranceCount: 2,
      })
    expect(summarizePowerScalingValidation('double-axe', modelWObservations))
      .toEqual({
        scope: 'double-axe',
        sampleCount: 14,
        medianRelativeError: expect.closeTo(0.060156, 6),
        p90RelativeError: expect.closeTo(0.061818, 6),
        maximumRelativeError: expect.closeTo(0.062222, 6),
        withinToleranceCount: 14,
      })

    const independent = modelWObservations.filter(
      (observation) => observation.sample.weaponId !== 'anchor',
    )
    expect(summarizePowerScalingValidation('overall', independent)).toEqual({
      scope: 'overall',
      sampleCount: 17,
      medianRelativeError: expect.closeTo(0.059721, 6),
      p90RelativeError: expect.closeTo(0.062222, 6),
      maximumRelativeError: expect.closeTo(0.213470, 6),
      withinToleranceCount: 16,
    })
  })

  it('records Model G conflict with version-unknown Wiki fixtures', () => {
    expect(summarizePowerScalingValidation('fighters-bindings', modelGObservations))
      .toEqual({
        scope: 'fighters-bindings',
        sampleCount: 3,
        medianRelativeError: expect.closeTo(0.002090, 6),
        p90RelativeError: expect.closeTo(0.366110, 6),
        maximumRelativeError: expect.closeTo(0.366110, 6),
        withinToleranceCount: 2,
      })
    expect(summarizePowerScalingValidation('double-axe', modelGObservations))
      .toEqual({
        scope: 'double-axe',
        sampleCount: 14,
        medianRelativeError: expect.closeTo(0.332994, 6),
        p90RelativeError: expect.closeTo(0.357798, 6),
        maximumRelativeError: expect.closeTo(0.450618, 6),
        withinToleranceCount: 0,
      })

    const independent = modelGObservations.filter(
      (observation) => observation.sample.weaponId !== 'anchor',
    )
    expect(summarizePowerScalingValidation('overall', independent)).toEqual({
      scope: 'overall',
      sampleCount: 17,
      medianRelativeError: expect.closeTo(0.332795, 6),
      p90RelativeError: expect.closeTo(0.366110, 6),
      maximumRelativeError: expect.closeTo(0.450618, 6),
      withinToleranceCount: 2,
    })
  })

  it('adopts Model G and pins representative Power predictions', () => {
    expect(CROSS_WEAPON_DAMAGE_SCALING.value).toEqual({
      method: 'internal-power-ratio',
    })
    expect([
      predictModelG('fighters-bindings', 50),
      predictModelG('fighters-bindings', 100),
      predictModelG('fighters-bindings', 251),
    ]).toEqual([70, 540, 261_897])
    expect([
      predictModelG('double-axe', 50),
      predictModelG('double-axe', 100),
      predictModelG('double-axe', 251),
    ]).toEqual([296, 2_295, 1_112_392])

    const finalModelPredict = (weaponId: WeaponId, powerLevel: number) =>
      calculatePowerScaledHitDamage(
        resolveWeaponDamageCoefficient(
          WEAPONS[weaponId],
          CROSS_WEAPON_DAMAGE_SCALING.value,
        ),
        resolveWeaponDamageCoefficient(
          WEAPONS[referenceWeaponId],
          CROSS_WEAPON_DAMAGE_SCALING.value,
        ),
        powerLevel,
        GEAR_POWER_CURVE.value,
      )
    expect(finalModelPredict('fighters-bindings', 251))
      .toBe(predictModelG('fighters-bindings', 251))
    expect(finalModelPredict('double-axe', 251))
      .toBe(predictModelG('double-axe', 251))
  })

  it('preserves exact Anchor regression and fixture validation errors', () => {
    expect(summarizePowerScalingValidation('anchor', modelGObservations)).toEqual({
      scope: 'anchor',
      sampleCount: 12,
      medianRelativeError: 0,
      p90RelativeError: 0,
      maximumRelativeError: 0,
      withinToleranceCount: 12,
    })
    expect(() => evaluatePowerScalingSamples([
      POWER_SCALING_VALIDATION_SAMPLES[0]!,
      POWER_SCALING_VALIDATION_SAMPLES[0]!,
    ], predictModelG)).toThrow('重複しています')
  })
})

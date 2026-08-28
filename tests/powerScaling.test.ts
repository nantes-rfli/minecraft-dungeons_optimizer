import { describe, expect, it } from 'vitest'
import { calculatePowerScaledHitDamage } from '../src/core/powerScaling'
import { GEAR_POWER_CURVE } from '../src/data/powerScaling'

const ANCHOR_INTERNAL_POWER = 14

describe('gear power scaling', () => {
  it('reproduces every published Anchor sample exactly', () => {
    for (const sample of GEAR_POWER_CURVE.value.points) {
      expect(calculatePowerScaledHitDamage(
        ANCHOR_INTERNAL_POWER,
        ANCHOR_INTERNAL_POWER,
        sample.powerLevel,
        GEAR_POWER_CURVE.value,
      )).toBe(sample.referenceDamage)
    }
  })

  it('applies the same curve multiplier to exact internal Power ratings', () => {
    expect(calculatePowerScaledHitDamage(2.045, 14, 251, GEAR_POWER_CURVE.value))
      .toBe(261_897)
    expect(calculatePowerScaledHitDamage(8.686, 14, 251, GEAR_POWER_CURVE.value))
      .toBe(1_112_392)
    expect(calculatePowerScaledHitDamage(14, 14, 251, GEAR_POWER_CURVE.value))
      .toBe(1_792_941)
  })

  it('uses log-linear interpolation between adjacent raw samples', () => {
    const position = (63 - 50) / (75 - 50)
    const expected = Math.round(Math.exp(
      Math.log(477) + position * (Math.log(1_329) - Math.log(477)),
    ))
    expect(calculatePowerScaledHitDamage(14, 14, 63, GEAR_POWER_CURVE.value)).toBe(expected)
    expect(() => calculatePowerScaledHitDamage(14, 14, 62.5, GEAR_POWER_CURVE.value))
      .toThrow('50以上263以下')
  })

  it('rejects extrapolation and invalid coefficients', () => {
    expect(() => calculatePowerScaledHitDamage(14, 14, 49, GEAR_POWER_CURVE.value))
      .toThrow('50以上263以下')
    expect(() => calculatePowerScaledHitDamage(14, 14, 264, GEAR_POWER_CURVE.value))
      .toThrow('50以上263以下')
    expect(() => calculatePowerScaledHitDamage(0, 14, 251, GEAR_POWER_CURVE.value))
      .toThrow('weaponDamageCoefficient')
    expect(() => calculatePowerScaledHitDamage(14, 0, 251, GEAR_POWER_CURVE.value))
      .toThrow('referenceDamageCoefficient')
  })
})

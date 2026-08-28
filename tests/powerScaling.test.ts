import { describe, expect, it } from 'vitest'
import { calculatePowerScaledHitDamage } from '../src/core/powerScaling'
import { GEAR_POWER_CURVE } from '../src/data/powerScaling'

describe('gear power scaling', () => {
  it('reproduces every published Anchor sample exactly', () => {
    for (const sample of GEAR_POWER_CURVE.value.points) {
      expect(calculatePowerScaledHitDamage(
        GEAR_POWER_CURVE.value.referenceBaseHitDamage,
        sample.powerLevel,
        GEAR_POWER_CURVE.value,
      )).toBe(sample.referenceDamage)
    }
  })

  it('applies the same curve multiplier to supported weapon base damage', () => {
    expect(calculatePowerScaledHitDamage(25, 251, GEAR_POWER_CURVE.value)).toBe(188_334)
    expect(calculatePowerScaledHitDamage(100, 251, GEAR_POWER_CURVE.value)).toBe(753_337)
    expect(calculatePowerScaledHitDamage(238, 251, GEAR_POWER_CURVE.value)).toBe(1_792_941)
  })

  it('uses log-linear interpolation between adjacent raw samples', () => {
    const position = (63 - 50) / (75 - 50)
    const expected = Math.round(Math.exp(
      Math.log(477) + position * (Math.log(1_329) - Math.log(477)),
    ))
    expect(calculatePowerScaledHitDamage(238, 63, GEAR_POWER_CURVE.value)).toBe(expected)
    expect(() => calculatePowerScaledHitDamage(238, 62.5, GEAR_POWER_CURVE.value))
      .toThrow('50以上263以下')
  })

  it('rejects extrapolation and invalid base damage', () => {
    expect(() => calculatePowerScaledHitDamage(238, 49, GEAR_POWER_CURVE.value))
      .toThrow('50以上263以下')
    expect(() => calculatePowerScaledHitDamage(238, 264, GEAR_POWER_CURVE.value))
      .toThrow('50以上263以下')
    expect(() => calculatePowerScaledHitDamage(0, 251, GEAR_POWER_CURVE.value))
      .toThrow('0より大きい有限値')
  })
})

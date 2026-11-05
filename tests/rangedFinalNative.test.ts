import { describe, expect, it } from 'vitest'
import { calculateConditionalRanged, float32Bits, RANGED_NATIVE_CONTRACT as contract } from '../src/domain/rangedFinalNative'
import type { ConditionalRangedInput } from '../src/domain/rangedFinalNative'
import { rangedNativeReadiness } from '../src/core/rangedNativeReadiness'
import { parseRangedWeapon, rangedWeaponUnsupportedReason } from '../src/core/ranged'
import replay from '../research/native/ranged-final-20261101/verification.json'
import fixtures from '../research/native/ranged-final-20261101/attribute-fixtures.json'
import example from '../research/native/ranged-final-20261101/conditional-input.example.json'
import promotion from '../research/runtime/runtime-promotion-manifest.json'

const input = example as ConditionalRangedInput
const ids: Record<string, string> = { Bow: 'bow', Shortbow: 'shortbow', Longbow: 'longbow', 'Power Bow': 'power-bow', 'Heavy Crossbow': 'heavy-crossbow' }

describe('conditional Native Ranged domain, no runtime adoption', () => {
  it('reproduces all 117 original examples from identity-bound Raw baselines and exact Power bits', () => {
    for (const row of replay.conditionalExamples) {
      const result = calculateConditionalRanged({ ...input, weaponId: ids[row.weapon]!, mode: row.mode as ConditionalRangedInput['mode'], power: { kind: 'internal-f32-bits', bits: row.itemPowerBits, sourceNote: 'synthetic replay' } })
      expect(result.state).toBe('known')
      if (result.state !== 'known') throw Error(result.reason)
      expect(float32Bits(result.positiveCustomMagnitude)).toBe(row.positiveCustomMagnitudeBits)
      expect(result.hpLoss.state).toBe('unknown')
      expect(result.combatDps.state).toBe('unknown')
      expect(result.runtimePromotion).toBe(false)
      expect(row.actualGameFinalDamage).toBeNull()
    }
  })
  it('matches 128 independent rational fixtures with every effective attribute non-neutral', () => {
    for (const row of fixtures.cases) {
      const result = calculateConditionalRanged({ ...input, power: { kind: 'internal-f32-bits', bits: row.itemPowerBits, sourceNote: 'synthetic rational fixture' }, attributes: row.attributes })
      expect(result.state).toBe('known')
      if (result.state !== 'known') throw Error(result.reason)
      expect(result.signedCustomMagnitudeBits).toBe(row.signedCustomMagnitudeBits)
    }
  })
  it('preserves the aggregation ULP and adjacent saved Power distinctions', () => {
    const at5 = calculateConditionalRanged({ ...input, power: { kind: 'parsed-save-double', value: 5, sourceNote: 'synthetic' } })
    expect(at5).toMatchObject({ powerScalarBits: '40e20739', effectivePowerFactorBits: '40e20738' })
    const first = calculateConditionalRanged(input)
    const next = calculateConditionalRanged({ ...input, power: { kind: 'internal-f32-bits', bits: '412e6667', sourceNote: 'synthetic' } })
    expect(first).toMatchObject({ positiveCustomMagnitude: 10217.6025390625 })
    expect(next).toMatchObject({ positiveCustomMagnitude: 10217.6064453125 })
    for (const [value, bits] of replay.inputTransport) expect(float32Bits(Number(value))).toBe(bits)
  })
  it('requires every effective attribute; known zero is preserved', () => {
    for (const name of Object.keys(input.attributes)) {
      const attrs = { ...input.attributes } as Record<string, unknown>
      delete attrs[name]
      expect(calculateConditionalRanged({ ...input, attributes: attrs as unknown as ConditionalRangedInput['attributes'] }).state).toBe('unknown')
      for (const value of [NaN, Infinity, -1, 0.1, 2 ** -149]) {
        expect(calculateConditionalRanged({ ...input, attributes: { ...input.attributes, [name]: value } }).state).toBe('unknown')
      }
    }
    const zero = calculateConditionalRanged({ ...input, attributes: { ...input.attributes, TakeDamageMultiplier: 0 } })
    expect(zero).toMatchObject({ state: 'known', positiveCustomMagnitude: 0, signedCustomMagnitudeBits: '80000000' })
  })
  it('does not substitute displayed Power, nearest table row, provider, projectile or aggregation defaults', () => {
    for (const patch of [
      { provider: undefined }, { provider: 'host-Math.pow' }, { projectile: 'water' }, { projectile: undefined },
      { powerEffect: 'two-stacks' }, { powerEffect: undefined }, { weaponId: 'crossbow' }, { weaponId: 'constructor' },
      { weaponId: 'guardian-bow' }, { mode: 'single' }, { weaponId: 'heavy-crossbow', mode: 'charged' },
      { power: { kind: 'displayed-power', value: 251, sourceNote: 'display' } },
      { power: { kind: 'internal-f32-bits', bits: '412e6668', sourceNote: 'no exact CRT row' } },
      { power: { kind: 'internal-f32-bits', bits: '7f800000', sourceNote: 'infinite' } },
      { power: { kind: 'parsed-save-double', value: 10.9, sourceNote: '' } },
    ]) expect(calculateConditionalRanged({ ...input, ...patch } as ConditionalRangedInput).state).toBe('unknown')
    expect(calculateConditionalRanged({ ...input, attributes: { ...input.attributes, DamageMultiplier: 2 ** 126 } }).state).toBe('unknown')
  })
  it('rejects malformed JSON and subnormal intermediates consistently with the Native CLI', () => {
    for (const value of [null, [], 1, 'bow', { ...input, weaponId: ['bow'] }, { ...input, power: [] }, { ...input, attributes: [] }, { ...input, power: { kind: 'internal-f32-bits', bits: 41266666, sourceNote: 'numeric bits' } }]) {
      expect(calculateConditionalRanged(value).state).toBe('unknown')
    }
    expect(calculateConditionalRanged({ ...input, attributes: { ...input.attributes, TakeDamageMultiplier: 2 ** -126, DamageMultiplier: 2 ** -10, DealDamageMul: 2 ** 100 } })).toMatchObject({ state: 'unknown', reason: 'arithmetic-outside-reviewed-normal-domain' })
  })
  it('keeps Optimizer on observed inputs even when conditional calculation succeeds', () => {
    const weapon = parseRangedWeapon({ instanceId: 'test', weaponId: 'bow', powerLevel: 251, enchantmentSlots: [] })
    const bound = { ...input, instanceId: 'test' }
    const ready = rangedNativeReadiness(weapon, bound)
    expect(ready.calculation.state).toBe('known')
    expect(ready.runtimeEligible).toBe(false)
    expect(ready.damageSource).toBeUndefined()
    expect(ready.remainingRuntimeInputs).toContain('observed-neutral-projectile-damage')
    expect(rangedWeaponUnsupportedReason(weapon)).toContain('必要')
    expect(rangedNativeReadiness(weapon).calculation.state).toBe('unknown')
    expect(rangedNativeReadiness(weapon, { ...bound, instanceId: 'other' }).calculation.state).toBe('unknown')
    expect(rangedNativeReadiness({ ...weapon, weaponId: 'shortbow' }, bound).calculation.state).toBe('unknown')
    const observed = { ...weapon, observation: { gameVersion: '1.17.0.0' as const, mode: 'charged' as const, projectileDamage: 10, shotCycleSeconds: 1, availableAmmo: 3, sourceNote: 'synthetic' } }
    expect(rangedNativeReadiness(observed, bound).damageSource).toBe('user-observed-unmodified-projectile')
    expect(rangedWeaponUnsupportedReason(observed)).toBeNull()
    expect(contract.runtimeAdoption.newCalculableRuntimeEquipment).toBe(0)
    expect(promotion.summary).toEqual({ candidates: 1, eligible: 0, promoted: 0 })
  })
})

import { describe, expect, it } from 'vitest'
import { evaluate, optimizeWithMetadata } from '../src/core'
import { rangedReuseIsEligible, type RangedReuseApproval } from '../src/core/rangedReuse'
import { nativeRangedReference } from '../src/domain/rangedNative'
import { deserializeInventory, serializeInventory } from '../src/inventory/storage'
import grants from '../research/runtime/ranged-observed-reuse.json'
import { RANGED_WEAPONS } from '../src/data/ranged'
import { DEFAULT_SCENARIO } from '../src/data/scenarios'
import type { Build, Inventory } from '../src/core/types'
import type { OwnedRangedWeapon } from '../src/core/rangedTypes'

// Synthetic software observations only, not independent gameplay Evidence.
const ids = ['shortbow', 'longbow', 'power-bow'] as const
const scenario = { ...DEFAULT_SCENARIO, encounterDurationSeconds: 20, rangedTimeShare: 0.5 }
const melee: Build = { weapon: { instanceId: 'melee', weaponId: 'double-axe', powerLevel: 251, observedDamagePerHit: 100, enchantmentSlots: [{ candidates: ['critical-hit'], selected: { enchantmentId: 'critical-hit', tier: 3 } }] }, enchantments: [{ enchantmentId: 'critical-hit', tier: 3, source: 'slot' }], artifacts: [] }
const weapon = (id: string): OwnedRangedWeapon => ({ instanceId: id, weaponId: id, powerLevel: 251, enchantmentSlots: [], observation: { gameVersion: '1.17.0.0', mode: 'uncharged', projectileDamage: 17, shotCycleSeconds: 1.25, availableAmmo: 3, sourceNote: 'SYNTHETIC own uncharged mode' } })
const build = (item: OwnedRangedWeapon): Build => ({ ...melee, rangedWeapon: item, rangedEnchantments: [] })
const inventory = (item: OwnedRangedWeapon): Inventory => ({ weapons: [melee.weapon], artifacts: [], rangedWeapons: [item] })

describe('mode-bound uncharged Ranged reuse', () => {
  it('adds exactly three mode pairs, preserving all six equipment identities and existing mode defaults', () => {
    expect(Object.keys(RANGED_WEAPONS)).toHaveLength(11)
    expect(Object.values(RANGED_WEAPONS).reduce((count, entry) => count + entry.modes.length, 0)).toBe(18)
    expect(grants.approvals.filter((grant) => grant.mode === 'uncharged').map((grant) => grant.targetId)).toEqual(ids)
    for (const id of ids) expect(RANGED_WEAPONS[id]!.modes).toEqual(['charged', 'uncharged'])
    expect(rangedReuseIsEligible('heavy-crossbow', 'uncharged')).toBe(false)
    expect(rangedReuseIsEligible('guardian-bow', 'uncharged')).toBe(false)
  })

  it.each(ids)('positive: %s evaluates and optimizes its own observed uncharged damage/cycle without a charged multiplier', (id) => {
    const item = weapon(id)
    const result = evaluate(build(item), scenario)
    expect(result.damage.ranged).toMatchObject({ mode: 'uncharged', shots: 3, ammoLimited: true, directSingleTargetDps: 17 * 3 / 20, shotCycleSeconds: 1.25, damageSource: 'user-observed-unmodified-projectile' })
    expect(optimizeWithMetadata(inventory(item), scenario).result.best.damage).toEqual(result.damage)
    expect(optimizeWithMetadata(inventory(item), scenario).evaluatedInstanceIds).toContain(id)
    expect(evaluate(build({ ...item, powerLevel: 1 }), scenario).damage.ranged).toEqual(result.damage.ranged)
    const changed = evaluate(build({ ...item, observation: { ...item.observation!, projectileDamage: 31, shotCycleSeconds: 2, availableAmmo: 100 } }), scenario)
    expect(changed.damage.ranged).toMatchObject({ mode: 'uncharged', shots: 5, directSingleTargetDps: 31 * 5 / 20 })
    expect(deserializeInventory(serializeInventory(inventory(item)))).toEqual(inventory(item))
    const emptyAmmo = evaluate(build({ ...item, observation: { ...item.observation!, availableAmmo: 0 } }), scenario)
    expect(emptyAmmo.damage.ranged).toMatchObject({ shots: 0, directSingleTargetDps: 0 })
    const reference = nativeRangedReference(id)
    if (reference.state !== 'known') throw new Error('reviewed source missing')
    expect(reference.chargeSwitch).toBe('completion-callback-boolean')
    expect(reference.finalProjectileDamage.state).toBe('unknown')
    expect(reference.effectiveShotCycleSeconds.state).toBe('unknown')
  })

  it.each(ids)('negative: %s uncharged grant is an independent tuple with exact mode/source/intrinsic boundaries', (id) => {
    const uncharged = grants.approvals.find((grant) => grant.targetId === id && grant.mode === 'uncharged')!
    const charged = grants.approvals.find((grant) => grant.targetId === id && grant.mode === 'charged')!
    expect(rangedReuseIsEligible(id, 'uncharged', [charged, uncharged])).toBe(true)
    expect(rangedReuseIsEligible(id, 'charged', [charged, uncharged])).toBe(true)
    expect(rangedReuseIsEligible(id, 'uncharged', [charged])).toBe(false)
    expect(rangedReuseIsEligible(id, 'charged', [charged])).toBe(true)
    expect(rangedReuseIsEligible(id, 'uncharged', [charged, uncharged, uncharged])).toBe(false)
    expect(rangedReuseIsEligible(id, 'charged', [charged, uncharged, uncharged])).toBe(true)
    for (const patch of [
      { rawIdentity: 'Bow' }, { gameVersion: 'other' }, { mode: 'single' }, { donorId: 'crossbow' },
      { sourceUrl: 'unknown' }, { intrinsicFacts: ['unsupported extra effect'] }, { inputPolicy: 'native CDO' },
      { modeEvidence: undefined }, { modeEvidence: { ...uncharged.modeEvidence!, chargeState: 'completion-callback-ran' } },
      { modeEvidence: { ...uncharged.modeEvidence!, chargeSwitch: 'continuous-held-time' } },
      { modeEvidence: { ...uncharged.modeEvidence!, ref: 'unknown' } },
      { nonInheritedEffects: charged.nonInheritedEffects }, { intrinsicDisposition: charged.intrinsicDisposition }, { testRef: charged.testRef },
    ]) {
      expect(rangedReuseIsEligible(id, 'uncharged', [{ ...uncharged, ...patch } as RangedReuseApproval])).toBe(false)
    }
  })

  it.each(ids)('negative: %s retains observation, finite input, unsupported-effect and interaction rejection', (id) => {
    const item = weapon(id)
    expect(() => evaluate(build({ ...item, observation: undefined }), scenario)).toThrow('必要')
    for (const patch of [{ projectileDamage: 0 }, { shotCycleSeconds: 0 }, { availableAmmo: -1 }, { sourceNote: '' }, { gameVersion: 'other' }]) {
      expect(() => evaluate(build({ ...item, observation: { ...item.observation!, ...patch } as OwnedRangedWeapon['observation'] }), scenario)).toThrow()
    }
    expect(() => evaluate(build({ ...item, observation: { ...item.observation!, mode: 'single' } }), scenario)).toThrow('mode')
    expect(() => optimizeWithMetadata(inventory({ ...item, enchantmentSlots: [{ candidates: ['power', 'multishot'] }] }), scenario)).toThrow('未対応候補')
    expect(() => optimizeWithMetadata(inventory({ ...item, gilded: { enchantmentId: 'growing', tier: 3 } }), scenario)).toThrow('Research-only')
    const voidBuild: Build = { ...build(item), weapon: { ...melee.weapon, enchantmentSlots: [{ candidates: ['void-strike'] }] }, enchantments: [{ enchantmentId: 'void-strike', tier: 3, source: 'slot' }] }
    expect(() => evaluate(voidBuild, scenario)).toThrow('未検証')
    expect(() => evaluate({ ...build(item), armor: { instanceId: 'armor', armorId: 'mercenary-armor', powerLevel: 251, observedHealthBonus: 400, enchantmentSlots: [{ candidates: ['chilling'] }] }, armorEnchantments: [{ enchantmentId: 'chilling', tier: 3, source: 'slot' }] }, { ...scenario, cooldownReduction: 0 })).toThrow('aura/Life Steal/Soul')
  })
})

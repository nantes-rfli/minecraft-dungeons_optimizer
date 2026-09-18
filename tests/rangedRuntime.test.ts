import { describe, expect, it } from 'vitest'
import { evaluate, optimize } from '../src/core'
import { DEFAULT_SCENARIO } from '../src/data/scenarios'
import type { Build, Inventory, Scenario } from '../src/core/types'
import type { OwnedRangedWeapon } from '../src/core/rangedTypes'
import { parseRangedWeapon } from '../src/core/ranged'

// Synthetic arithmetic fixtures. Not observations or regression evidence from the game.
const scenario: Scenario = { ...DEFAULT_SCENARIO, encounterDurationSeconds: 20, rangedTimeShare: 0.5, enemySupplyPerSecond: 100, averageEnemyHealth: 100, enemyComposition: { enchantedShare: 0, undeadShare: 0 } }
const legacy: Build = { weapon: { instanceId: 'melee', weaponId: 'double-axe', powerLevel: 251, observedDamagePerHit: 100, enchantmentSlots: [{ candidates: ['critical-hit'] }] }, enchantments: [{ enchantmentId: 'critical-hit', tier: 3, source: 'slot' }], artifacts: [] }
const ranged = (weaponId = 'bow'): OwnedRangedWeapon => ({ instanceId: weaponId, weaponId, powerLevel: 251, enchantmentSlots: [], observation: { gameVersion: '1.17.0.0', mode: weaponId === 'bow' ? 'charged' : 'single', projectileDamage: 100, shotCycleSeconds: 2, availableAmmo: 100, sourceNote: 'SYNTHETIC TEST ONLY' } })
const withRanged = (weapon = ranged()): Build => ({ ...legacy, rangedWeapon: weapon, rangedEnchantments: [] })
const inventory = (weapons: readonly OwnedRangedWeapon[]): Inventory => ({ weapons: [legacy.weapon], artifacts: [], rangedWeapons: weapons })

describe('observed ranged runtime and shared API', () => {
  it.each(['bow', 'crossbow'])('evaluates %s through evaluate and optimize with finite complete-cycle semantics', (id) => {
    const result = evaluate(withRanged(ranged(id)), scenario)
    expect(result.damage.ranged).toMatchObject({ supportLevel: 'limited', shots: 5, ammoConsumed: 5, directSingleTargetDps: 25, indirectAoeDps: 0 })
    expect(result.damage.directWeaponSingleTargetDps).toBe(evaluate(legacy, scenario).damage.directWeaponSingleTargetDps * 0.5)
    expect(result.damage.singleTargetDps).toBe(result.damage.directWeaponSingleTargetDps + 25)
    const optimized = optimize(inventory([ranged(id)]), scenario)
    expect(optimized.best.damage).toEqual(result.damage)
    expect(optimized.best.reasons.join(' ')).toContain('Limited')
    expect(optimized.best.confidence.factors.some((factor) => factor.id === 'ranged-user-observation' && factor.confidence === 'low')).toBe(true)
  })
  it('compares two archetypes and selects a candidate enchant with Gilded preserved', () => {
    const bow: OwnedRangedWeapon = { ...ranged(), enchantmentSlots: [{ candidates: ['power', 'unchanting'] }], gilded: { enchantmentId: 'critical-hit', tier: 2 } }
    const crossbow = ranged('crossbow')
    const result = optimize(inventory([bow, crossbow]), scenario)
    expect(result.evaluatedBuildCount).toBe(3)
    expect(result.best.build.rangedWeapon?.weaponId).toBe('bow')
    expect(result.best.build.rangedEnchantments).toEqual([{ enchantmentId: 'power', tier: 3, source: 'slot' }, { enchantmentId: 'critical-hit', tier: 2, source: 'gilded' }])
    expect(result.best.damage.ranged?.directSingleTargetDps).toBeCloseTo(25 * 1.33 * 1.3)
    expect(result.best.contributions.some((entry) => entry.sourceType === 'ranged-enchantment' && entry.sourceId === 'power' && entry.aoeDpsDelta > 0)).toBe(true)
    expect(result.paretoFrontier.length).toBeGreaterThan(0)
  })
  it('enforces ammo cap, does not assign idle time back to melee, and has no shot at time zero', () => {
    const weapon = ranged()
    const capped = evaluate(withRanged({ ...weapon, observation: { ...weapon.observation!, availableAmmo: 2 } }), scenario)
    expect(capped.damage.ranged).toMatchObject({ shots: 2, ammoConsumed: 2, ammoLimited: true, directSingleTargetDps: 10 })
    expect(capped.damage.hitsPerSecond).toBe(evaluate(withRanged(), scenario).damage.hitsPerSecond)
    expect(evaluate(withRanged(), { ...scenario, encounterDurationSeconds: 1 }).damage.ranged?.shots).toBe(0)
    const empty = evaluate(withRanged({ ...weapon, observation: { ...weapon.observation!, availableAmmo: 0 } }), scenario)
    expect(empty.damage.ranged?.directSingleTargetDps).toBe(0)
  })
  it('does not reuse Power curves, charge ratios, melee speed modifiers or melee target count', () => {
    const first = evaluate(withRanged(), scenario)
    const changed = evaluate({ ...withRanged({ ...ranged(), powerLevel: 1 }), artifacts: [{ instanceId: 'm', artifactId: 'death-cap-mushroom', powerLevel: 251 }] }, { ...scenario, averageTargetsInReach: 5 })
    expect(changed.damage.ranged).toEqual(first.damage.ranged)
    expect(evaluate(withRanged({ ...ranged(), observation: { ...ranged().observation!, mode: 'uncharged' } }), scenario).damage.ranged?.directSingleTargetDps).toBe(25)
  })
  it('separates ranged final-blow proxy from melee kills and indirect damage', () => {
    const base = evaluate(withRanged(), scenario)
    const kills = base.combatState
    expect(kills.directWeaponKillsPerSecond).toBeCloseTo(base.damage.directWeaponAoeDps / scenario.averageEnemyHealth * scenario.directKillShare)
    expect(kills.directRangedKillsPerSecond).toBeCloseTo(25 / scenario.averageEnemyHealth * scenario.directKillShare)
    expect(kills.indirectDamageShare).toBeCloseTo(0)
    const melee: Build = { ...legacy, weapon: { ...legacy.weapon, enchantmentSlots: [{ candidates: ['refreshment'] }] }, enchantments: [{ enchantmentId: 'refreshment', tier: 3, source: 'slot' }], rangedWeapon: ranged(), rangedEnchantments: [] }
    const weak = evaluate(melee, scenario)
    const strong = evaluate({ ...melee, rangedWeapon: { ...ranged(), observation: { ...ranged().observation!, projectileDamage: 200 } } }, scenario)
    expect(strong.potionState.directWeaponKillsPerSecond).toBeCloseTo(weak.potionState.directWeaponKillsPerSecond)
  })
  it('excludes Research-only gear/enchants rather than scoring them as zero', () => {
    const unknown = { ...ranged(), weaponId: 'harp-crossbow' }
    expect(() => evaluate(withRanged(unknown), scenario)).toThrow('Research-only')
    expect(() => optimize(inventory([unknown]), scenario)).toThrow('No supported Ranged')
    const result = optimize(inventory([unknown, ranged('crossbow')]), scenario)
    expect(result.evaluatedBuildCount).toBe(1)
    expect(result.unsupportedChoices.join(' ')).toContain('harp-crossbow')
  })
  it('rejects mixed free slots but permits an explicit supported lock', () => {
    const mixed: OwnedRangedWeapon = { ...ranged(), enchantmentSlots: [{ candidates: ['power', 'multishot'] }] }
    expect(() => optimize(inventory([mixed]), scenario)).toThrow('未対応候補')
    const locked = { ...mixed, enchantmentSlots: [{ ...mixed.enchantmentSlots[0]!, selected: { enchantmentId: 'power', tier: 2 as const } }] }
    expect(optimize(inventory([locked]), scenario).best.build.rangedEnchantments?.[0]?.tier).toBe(2)
    expect(() => evaluate({ ...withRanged(mixed), rangedEnchantments: [{ enchantmentId: 'power', tier: 2, source: 'slot' }] }, scenario)).toThrow('未対応候補')
  })
  it.each([1, 2, 3] as const)('evaluates fixed Gilded Tier %s separately', (tier) => {
    const weapon = { ...ranged(), gilded: { enchantmentId: 'critical-hit', tier } }
    const result = optimize(inventory([weapon]), scenario)
    expect(result.best.damage.ranged?.directSingleTargetDps).toBeCloseTo(25 * (1 + 2 * [0.1, 0.15, 0.2][tier - 1]!))
  })
  it('rejects Gilded omissions, unsupported Gilded, mismatched source/Tier and duplicate copies', () => {
    expect(() => evaluate(withRanged({ ...ranged(), gilded: { enchantmentId: 'power', tier: 2 } }), scenario)).toThrow('一致')
    expect(() => optimize(inventory([{ ...ranged(), gilded: { enchantmentId: 'void-strike', tier: 3 } }]), scenario)).toThrow('Research-only')
    const duplicate: OwnedRangedWeapon = { ...ranged(), enchantmentSlots: [{ candidates: ['power'] }], gilded: { enchantmentId: 'power', tier: 1 } }
    expect(() => optimize(inventory([duplicate]), scenario)).toThrow('stacking')
    expect(() => evaluate({ ...withRanged(), rangedEnchantments: [{ enchantmentId: 'power', tier: 3, source: 'slot' }] }, scenario)).toThrow('一致')
  })
  it('rejects missing inputs, wrong mode, impossible numbers and unmeasured interactions', () => {
    expect(() => evaluate(withRanged({ ...ranged(), observation: undefined }), scenario)).toThrow('必要')
    for (const value of [0, 1, NaN, Infinity, undefined]) expect(() => evaluate(withRanged(), { ...scenario, rangedTimeShare: value })).toThrow()
    expect(() => evaluate(withRanged({ ...ranged('crossbow'), observation: ranged().observation }), scenario)).toThrow('mode')
    const voidBuild: Build = { ...withRanged(), weapon: { ...legacy.weapon, enchantmentSlots: [{ candidates: ['void-strike'] }] }, enchantments: [{ enchantmentId: 'void-strike', tier: 3, source: 'slot' }] }
    expect(() => evaluate(voidBuild, scenario)).toThrow('未検証')
    for (const projectileDamage of [0, -1, NaN, Infinity]) expect(() => parseRangedWeapon({ ...ranged(), observation: { ...ranged().observation, projectileDamage } })).toThrow()
    for (const availableAmmo of [-1, 0.5, Infinity]) expect(() => parseRangedWeapon({ ...ranged(), observation: { ...ranged().observation, availableAmmo } })).toThrow()
    expect(() => parseRangedWeapon({ ...ranged(), observation: { ...ranged().observation, gameVersion: '1.16.0.0' } })).toThrow()
    expect(() => parseRangedWeapon({ ...ranged(), weaponId: 'constructor' })).toThrow()
  })
  it('rejects cross-category duplicate instance IDs', () => {
    expect(() => optimize(inventory([{ ...ranged(), instanceId: legacy.weapon.instanceId }]), scenario)).toThrow()
  })
  it('keeps Armor melee-only bonuses isolated and rejects unresolved ranged synergies', () => {
    const armor = { instanceId: 'armor', armorId: 'scale-mail', powerLevel: 251, observedHealthBonus: 100, enchantmentSlots: [{ candidates: ['cool-down'] }] }
    const result = optimize({ ...inventory([ranged()]), armors: [armor] }, scenario)
    expect(result.best.damage.ranged).toEqual(evaluate(withRanged(), scenario).damage.ranged)
    expect(result.best.damage.directWeaponAoeDps).toBeGreaterThan(evaluate(withRanged(), scenario).damage.directWeaponAoeDps)
    for (const armorId of ['renegade-armor', 'wither-armor', 'spider-armor', 'hunters-armor']) {
      expect(() => optimize({ ...inventory([ranged()]), armors: [{ ...armor, armorId }] }, scenario)).toThrow()
    }
    expect(() => optimize({ ...inventory([ranged()]), armors: [{ ...armor, enchantmentSlots: [{ candidates: ['cowardice'] }] }] }, { ...scenario, cowardiceFullHealthShare: 1 })).toThrow('Cowardice')
  })
  it('does not change legacy results or add ranged fields when no ranged gear is supplied', () => {
    const first = evaluate(legacy, DEFAULT_SCENARIO)
    expect(evaluate(legacy, { ...DEFAULT_SCENARIO, rangedTimeShare: 0.9 })).toEqual(first)
    expect(first.damage).not.toHaveProperty('ranged')
    const original = { weapons: [legacy.weapon], artifacts: [] }
    expect(optimize({ ...original, rangedWeapons: [] }, DEFAULT_SCENARIO)).toEqual(optimize(original, DEFAULT_SCENARIO))
  })
})

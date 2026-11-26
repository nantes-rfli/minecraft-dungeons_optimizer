import { describe, expect, it } from 'vitest'
import { optimize, optimizeForEquipment } from '../src/core/optimizer'
import { parseRangedWeapon, supportsRangedModeComparison } from '../src/core/ranged'
import type { OwnedRangedWeapon } from '../src/core/rangedTypes'
import { estimateSearchCandidates } from '../src/core/searchBudget'
import type { Inventory, Scenario } from '../src/core/types'
import { RANGED_WEAPONS } from '../src/data/ranged'
import { DEFAULT_SCENARIO } from '../src/data/scenarios'
import { deserializeInventory, serializeInventory } from '../src/inventory/storage'
import { updateRangedPower } from '../src/inventory/updateRangedPower'

const bow: OwnedRangedWeapon = {
  instanceId: 'my-bow', weaponId: 'bow', enchantmentSlots: [], powerLevel: 251,
  observation: {
    gameVersion: '1.17.0.0', mode: 'uncharged', projectileDamage: 1_000,
    shotCycleSeconds: 1, availableAmmo: 1, sourceNote: 'Synthetic uncharged record',
  },
  modeComparison: {
    powerLevel: 251,
    observation: {
      gameVersion: '1.17.0.0', mode: 'charged', projectileDamage: 2_200,
      shotCycleSeconds: 4, sourceNote: 'Synthetic charged record',
    },
  },
}
const inventory: Inventory = {
  weapons: [{ instanceId: 'axe', weaponId: 'double-axe', powerLevel: 251, observedDamagePerHit: 100, enchantmentSlots: [{ candidates: ['critical-hit'] }] }],
  rangedWeapons: [bow], artifacts: [],
}
const scenario: Scenario = {
  ...DEFAULT_SCENARIO, rangedTimeShare: 0.8, averageTargetsInReach: 1, encounterDurationSeconds: 20,
  weights: { damage: 1, defense: 0, healing: 0, control: 0 },
}
const eligibleBows = ['bow', 'shortbow', 'longbow', 'power-bow', 'elite-power-bow', 'phantom-bow', 'purple-storm']

describe('independent Ranged mode comparison', () => {
  it('takes both modes from every already-supported bow and does not add other targets', () => {
    expect(Object.keys(RANGED_WEAPONS).filter(supportsRangedModeComparison).sort()).toEqual([...eligibleBows].sort())
  })

  it.each(eligibleBows)('evaluates each separately recorded mode for %s', (weaponId) => {
    const binding = {
      ...(weaponId === 'elite-power-bow' || weaponId === 'phantom-bow' ? { fixedPowerObservation: { powerLevel: 251 } } : {}),
      ...(weaponId === 'purple-storm' ? { fixedCadenceObservation: { powerLevel: 251 } } : {}),
      arrowsConsumedPerShot: 1,
    }
    const item = {
      ...bow, weaponId, observation: { ...bow.observation!, ...binding },
      modeComparison: { ...bow.modeComparison!, observation: { ...bow.modeComparison!.observation, ...binding } },
    }
    const { result, bestByInstance } = optimizeForEquipment({ ...inventory, rangedWeapons: [item] }, scenario)
    expect(result.evaluatedBuildCount).toBe(2)
    expect(bestByInstance.get(bow.instanceId)).toEqual(result.best)
    expect(result.best.damage.ranged).toMatchObject({ mode: 'charged', ammoConsumed: 1, projectileDamage: 2_200, shotCycleSeconds: 4 })
    expect(result.alternatives[0]?.damage.ranged).toMatchObject({ mode: 'uncharged', ammoConsumed: 1, projectileDamage: 1_000, shotCycleSeconds: 1 })
    expect(result.best.build.rangedWeapon?.observation?.sourceNote).toBe('Synthetic charged record')
    expect(result.alternatives[0]?.build.rangedWeapon?.observation?.sourceNote).toBe('Synthetic uncharged record')
  })

  it('reuses the same encounter stock and retains distinct modes on ties', () => {
    const withAmmo = (availableAmmo: number) => ({
      ...inventory, rangedWeapons: [{ ...bow, observation: { ...bow.observation!, availableAmmo } }],
    })
    const stocked = optimize(withAmmo(20), scenario)
    expect(stocked.best.damage.ranged).toMatchObject({ mode: 'uncharged', ammoConsumed: 16 })
    expect(stocked.alternatives[0]?.damage.ranged).toMatchObject({ mode: 'charged', ammoConsumed: 4 })

    const empty = optimize(withAmmo(0), scenario)
    expect(empty.best.damage.ranged).toMatchObject({ mode: 'uncharged', ammoConsumed: 0 })
    expect(empty.alternatives[0]?.damage.ranged).toMatchObject({ mode: 'charged', ammoConsumed: 0 })
    expect(empty.best.objectiveScore).toBe(empty.alternatives[0]?.objectiveScore)
  })

  it('budgets each mode and explicit time reservation, with the empty Ranged slot counted once', () => {
    const allocations = { ...scenario, rangedTimeShareAlternatives: [0.2], includeBuildsWithoutRanged: true }
    expect(estimateSearchCandidates(inventory, allocations)).toBe(5)
    expect(optimize(inventory, allocations).evaluatedBuildCount).toBe(5)
  })

  it('keeps an owned reference loadout while selecting a mode that fits the target condition', () => {
    const recommended = optimize(inventory, scenario).best
    const short = optimizeForEquipment(inventory, { ...scenario, rangedTimeShare: 0.1 }, recommended.build)
    expect(short.referenceEvaluation?.build.rangedWeapon?.instanceId).toBe(bow.instanceId)
    expect(short.referenceEvaluation?.damage.ranged).toMatchObject({ mode: 'uncharged', timeShare: 0.1, ammoConsumed: 1 })
  })

  it('excludes unsupported mode-owned inputs and rejects stale pair Power', () => {
    const other = { ...bow.modeComparison!, observation: { ...bow.modeComparison!.observation, arrowsConsumedPerShot: 2 } }
    const unsupported = optimize({ ...inventory, rangedWeapons: [{ ...bow, modeComparison: other }] }, scenario)
    expect(unsupported.evaluatedBuildCount).toBe(1)
    expect(unsupported.best.damage.ranged?.mode).toBe('uncharged')
    expect(unsupported.unsupportedChoices).toEqual([expect.stringMatching(/charged: .*消費数2は未対応/)])
    const stale = { ...inventory, rangedWeapons: [{ ...bow, powerLevel: 252 }] }
    expect(() => optimize(stale, scenario)).toThrow(/現在のPowerと一致していません/)
    expect(optimize(stale, { ...scenario, includeBuildsWithoutRanged: true }).best.damage.ranged).toBeUndefined()
  })

  it('round-trips both observations and keeps one-mode backups readable', () => {
    expect(deserializeInventory(serializeInventory(inventory)).rangedWeapons).toEqual([bow])
    const legacy = { ...bow, modeComparison: undefined }
    const restoredLegacy = deserializeInventory(serializeInventory({ ...inventory, rangedWeapons: [legacy] })).rangedWeapons
    expect(restoredLegacy).toEqual([legacy])
    expect(restoredLegacy?.[0]).not.toHaveProperty('modeComparison')
    expect(updateRangedPower(bow, 253)).toMatchObject({ powerLevel: 253, observation: undefined, modeComparison: undefined })
    expect(updateRangedPower(legacy, 253).observation).toEqual(legacy.observation)
  })

  it('rejects same-mode pairs, absent primary or two independent stock values on import', () => {
    const pair = bow.modeComparison!
    expect(() => parseRangedWeapon({ ...bow, observation: undefined })).toThrow(/2件の観測/)
    expect(() => parseRangedWeapon({ ...bow, weaponId: 'crossbow' })).toThrow(/対応する弓/)
    expect(() => parseRangedWeapon({ ...bow, modeComparison: { ...pair, observation: { ...pair.observation, mode: 'uncharged' } } })).toThrow(/別々の観測/)
    expect(() => parseRangedWeapon({ ...bow, modeComparison: { ...pair, observation: { ...pair.observation, availableAmmo: 20 } } })).toThrow(/共通の矢数/)
  })
})

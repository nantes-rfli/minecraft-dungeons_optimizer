import { describe, expect, it } from 'vitest'
import source from '../research/sources/observed-rapid-fire-variants.json'
import { assessEquipment } from '../src/core/equipmentAssessment'
import { evaluate } from '../src/core/evaluate'
import { parameterEvidenceForBuild } from '../src/core/evidenceStatus'
import { FIXED_RAPID_FIRE, fixedRapidFireReuseIsEligible } from '../src/core/fixedRapidFireReuse'
import { inspectInventoryReadiness, optimize } from '../src/core/optimizer'
import { rangedReuseIsEligible } from '../src/core/rangedReuse'
import type { OwnedRangedWeapon, RangedShotMode } from '../src/core/rangedTypes'
import type { Build, Inventory } from '../src/core/types'
import { getEquipmentCatalogEntry } from '../src/data/equipmentCatalog'
import { isRuntimeRangedEnchantment } from '../src/data/ranged'
import { DEFAULT_SCENARIO } from '../src/data/scenarios'
import { deserializeInventory, serializeInventory } from '../src/inventory/storage'
import { updateRangedPower } from '../src/inventory/updateRangedPower'
import { readinessMelee, readinessRanged } from './inventoryReadinessFixtures'

const scenario = { ...DEFAULT_SCENARIO, encounterDurationSeconds: 20, rangedTimeShare: 0.5 }
const inventory = (item: OwnedRangedWeapon): Inventory => ({ ...readinessMelee, rangedWeapons: [item] })
const build = (item: OwnedRangedWeapon): Build => ({
  weapon: readinessMelee.weapons[0]!, enchantments: [{ enchantmentId: 'critical-hit', tier: 2, source: 'slot' }, { enchantmentId: 'radiance', tier: 1, source: 'gilded' }],
  artifacts: [], rangedWeapon: item, rangedEnchantments: [FIXED_RAPID_FIRE],
})

describe('fixed Rapid Fire I observed normal-arrow reuse', () => {
  it.each<[string, RangedShotMode]>([['azure-seeker', 'single'], ['purple-storm', 'uncharged'], ['purple-storm', 'charged']])('evaluates %s / %s with the included rate exactly once', (id, mode) => {
    const base = readinessRanged(id)
    const item = { ...base, observation: { ...base.observation!, mode, shotCycleSeconds: 2.1 } }
    expect(rangedReuseIsEligible(id, mode)).toBe(true)
    const result = evaluate(build(item), scenario)
    expect(result.damage.ranged).toMatchObject({ mode, shots: 4, ammoConsumed: 4, expectedMultiplier: 1, directSingleTargetDps: 20 })
    expect(result.contributions.some(({ sourceId }) => String(sourceId) === 'rapid-fire')).toBe(false)
    expect(result.reasons).toContainEqual(expect.stringContaining('完全発射周期は観測 2.1 秒'))
    expect(result.reasons).toContainEqual(expect.stringContaining('単独の寄与は算出対象外'))
    expect(parameterEvidenceForBuild(build(item))).toContainEqual(expect.objectContaining({ mechanicId: `ranged:${id}`, parameterId: 'fixed-builtin-ownership-tier', status: 'derived' }))
    expect(parameterEvidenceForBuild(build(item))).not.toContainEqual(expect.objectContaining({ mechanicId: 'ranged-enchantment:rapid-fire', status: 'unclassified' }))
    expect(optimize(inventory(item), scenario).best.build.rangedEnchantments).toEqual([FIXED_RAPID_FIRE])
    expect(assessEquipment(inventory(item), [{ id: 'fixed-cadence', name: 'Fixed cadence', scenario }])[0]).toMatchObject({
      status: 'complete', equipment: expect.arrayContaining([expect.objectContaining({ instanceId: id, status: 'evaluated', scoreGap: 0 })]),
    })
    expect(getEquipmentCatalogEntry('ranged', id)).toMatchObject({ runtimeSupport: 'limited', builtInEnchantments: [{ enchantmentId: 'rapid-fire', tier: 1 }] })
    expect(deserializeInventory(serializeInventory(inventory(item))).rangedWeapons).toEqual([item])
  })

  it('keeps selectable damage Power separate and only accepts the owned Rapid Fire tier', () => {
    const original = readinessRanged('azure-seeker')
    const item = { ...original, enchantmentSlots: [{ candidates: ['power'], selected: { enchantmentId: 'power', tier: 1 as const } }] }
    const result = optimize(inventory(item), scenario).best
    expect(result.build.rangedEnchantments).toEqual([{ enchantmentId: 'power', tier: 1, source: 'slot' }, FIXED_RAPID_FIRE])
    expect(result.damage.ranged?.directSingleTargetDps).toBeCloseTo(100 * 1.1 * 5 / 20)
    expect(isRuntimeRangedEnchantment('rapid-fire')).toBe(false)
    expect(() => evaluate({ ...build(original), rangedEnchantments: [] }, scenario)).toThrow('stacking')
    expect(() => evaluate({ ...build(original), rangedEnchantments: [{ ...FIXED_RAPID_FIRE, tier: 2 }] }, scenario)).toThrow('stacking')
    for (const item of [{ ...original, gilded: { enchantmentId: 'rapid-fire', tier: 1 as const } }, { ...original, enchantmentSlots: [{ candidates: ['rapid-fire'] }] }]) {
      expect(inspectInventoryReadiness(inventory(item), scenario).equipment.find(({ instanceId }) => instanceId === original.instanceId)?.status).toBe('unsupported')
    }
  })

  it('requires matching Power, mode and explicit one-arrow consumption even with an empty quiver', () => {
    const item = readinessRanged('purple-storm')
    expect(() => evaluate(build({ ...item, powerLevel: 252 }), scenario)).toThrow('現在のPowerで固定「速射 I」')
    for (const invalid of [{ ...item, powerLevel: 252 }, { ...item, observation: { ...item.observation!, mode: 'single' as const } }]) {
      const evidence = parameterEvidenceForBuild(build(invalid))
      for (const parameterId of ['projectile-damage', 'shot-cycle', 'arrows-consumed-per-shot']) {
        expect(evidence).toContainEqual(expect.objectContaining({ parameterId, status: 'unclassified' }))
      }
      expect(evidence).not.toContainEqual(expect.objectContaining({ basis: item.observation!.sourceNote }))
    }
    expect(() => evaluate(build({ ...item, observation: { ...item.observation!, fixedCadenceObservation: undefined } }), scenario)).toThrow('現在のPower')
    expect(() => evaluate(build({ ...item, observation: { ...item.observation!, mode: 'single' } }), scenario)).toThrow('mode')
    for (const arrowsConsumedPerShot of [undefined, 0, 2]) {
      expect(() => evaluate(build({ ...item, observation: { ...item.observation!, availableAmmo: 0, arrowsConsumedPerShot } }), scenario)).toThrow(/矢|消費数/)
    }
    expect(updateRangedPower(item, 252).observation).toBeUndefined()
    expect(() => evaluate(build({ ...item, research: { intrinsicProperties: [{ kind: 'intrinsicMechanicOwnership', raw: 'extra unsupported effect' }] } }), scenario)).toThrow('未対応固有効果')
  })

  it('migrates ownership and holds drifted sources and unsupported neighbors', () => {
    const legacy = { instanceId: 'old', category: 'ranged', catalogId: 'azure-seeker', powerLevel: 251, isFavorite: true, research: { enchantments: [FIXED_RAPID_FIRE] } }
    const migrated = deserializeInventory(JSON.stringify({ version: 6, inventory: { ...readinessMelee, catalogItems: [legacy] } }))
    expect(migrated.catalogItems).toEqual([])
    expect(migrated.rangedWeapons?.[0]).toMatchObject({ instanceId: 'old', weaponId: 'azure-seeker', isFavorite: true, research: legacy.research })
    expect(migrated.rangedWeapons?.[0]?.observation).toBeUndefined()
    const changed = structuredClone(source)
    changed.purpleChargeCue.base.scriptSha256 = 'unknown'
    expect(fixedRapidFireReuseIsEligible('purple-storm', 'charged', changed)).toBe(false)
    expect(fixedRapidFireReuseIsEligible('azure-seeker', 'single', changed)).toBe(true)
    for (const id of ['mechanical-shortbow', 'the-slicer', 'love-spell-bow']) expect(rangedReuseIsEligible(id, 'single')).toBe(false)
  })
})

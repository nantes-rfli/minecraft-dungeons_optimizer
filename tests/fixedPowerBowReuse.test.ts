import { describe, expect, it } from 'vitest'
import source from '../research/sources/observed-fixed-power-bows.json'
import donorGrants from '../research/runtime/ranged-observed-reuse.json'
import { assessEquipment } from '../src/core/equipmentAssessment'
import { evaluate } from '../src/core/evaluate'
import { parameterEvidenceForBuild } from '../src/core/evidenceStatus'
import { FIXED_RANGED_POWER, fixedPowerBowReuseIsEligible } from '../src/core/fixedPowerBowReuse'
import { inspectInventoryReadiness, optimize } from '../src/core/optimizer'
import { calculateRangedDamage, rangedWeaponUnsupportedReason } from '../src/core/ranged'
import { rangedReuseIsEligible } from '../src/core/rangedReuse'
import type { OwnedRangedWeapon } from '../src/core/rangedTypes'
import type { Build, Inventory } from '../src/core/types'
import { getEquipmentCatalogEntry } from '../src/data/equipmentCatalog'
import { DEFAULT_SCENARIO } from '../src/data/scenarios'
import { deserializeInventory, serializeInventory } from '../src/inventory/storage'
import { updateRangedPower } from '../src/inventory/updateRangedPower'
import { readinessMelee } from './inventoryReadinessFixtures'

const scenario = { ...DEFAULT_SCENARIO, encounterDurationSeconds: 20, rangedTimeShare: 0.5 }
const observed = (weaponId: string, mode: 'uncharged' | 'charged' = 'uncharged'): OwnedRangedWeapon => ({
  instanceId: weaponId, weaponId, powerLevel: 251, enchantmentSlots: [],
  observation: { gameVersion: '1.17.0.0', mode, projectileDamage: mode === 'charged' ? 330 : 110,
    shotCycleSeconds: mode === 'charged' ? 4 : 2, availableAmmo: 3, arrowsConsumedPerShot: 1,
    sourceNote: 'SYNTHETIC inclusive ordinary arrow', fixedPowerObservation: { powerLevel: 251 } },
})
const inventory = (item: OwnedRangedWeapon): Inventory => ({ ...readinessMelee, rangedWeapons: [item] })
const build = (item: OwnedRangedWeapon): Build => ({
  weapon: readinessMelee.weapons[0]!, enchantments: [{ enchantmentId: 'critical-hit', tier: 2, source: 'slot' }, { enchantmentId: 'radiance', tier: 1, source: 'gilded' }],
  artifacts: [], rangedWeapon: item, rangedEnchantments: [FIXED_RANGED_POWER],
})

describe('fixed Power I on the complete eligible variant set', () => {
  it.each(['elite-power-bow', 'phantom-bow'])('evaluates and scores %s with its own mode-specific inclusive observation', (id) => {
    for (const mode of ['uncharged', 'charged'] as const) {
      const item = observed(id, mode)
      const shots = mode === 'charged' ? 2 : 3
      const projectile = item.observation!.projectileDamage
      expect(rangedReuseIsEligible(id, mode)).toBe(true)
      const evaluated = evaluate(build(item), scenario)
      expect(evaluated.damage.ranged).toMatchObject({ mode, shots, projectileDamage: projectile, ammoConsumed: shots, damageSource: 'user-observed-projectile-including-fixed-power' })
      expect(evaluated.damage.ranged?.directSingleTargetDps).toBeCloseTo(projectile * shots / 20)
      expect(evaluated.contributions).toContainEqual(expect.objectContaining({
        sourceType: 'ranged-enchantment', sourceId: 'power', enchantmentSource: 'built-in', singleTargetDpsDelta: expect.closeTo((projectile - projectile / 1.1) * shots / 20),
      }))
      expect(optimize(inventory(item), scenario).best.build.rangedEnchantments).toEqual([FIXED_RANGED_POWER])
      expect(assessEquipment(inventory(item), [{ id: 'limited', name: 'Limited', scenario }])[0]).toMatchObject({
        status: 'complete', equipment: expect.arrayContaining([expect.objectContaining({ instanceId: id, status: 'evaluated', scoreGap: 0 })]),
      })
      expect(parameterEvidenceForBuild(build(item))).toContainEqual(expect.objectContaining({ mechanicId: `ranged:${id}`, parameterId: 'fixed-builtin-ownership-tier', status: 'derived' }))
      expect(deserializeInventory(serializeInventory(inventory(item))).rangedWeapons).toEqual([item])
    }
    expect(getEquipmentCatalogEntry('ranged', id)).toMatchObject({ runtimeSupport: 'limited', builtInEnchantments: [{ enchantmentId: 'power', tier: 1 }] })
  })

  it('keeps the fixed tuple once, with independent selectable modifiers and exact ammo/Power gates', () => {
    const item = observed('elite-power-bow')
    const choices: OwnedRangedWeapon = { ...item, enchantmentSlots: [{ candidates: ['power', 'critical-hit'] }] }
    const result = optimize(inventory(choices), scenario).best
    expect(result.build.rangedEnchantments).toEqual([{ enchantmentId: 'critical-hit', tier: 3, source: 'slot' }, FIXED_RANGED_POWER])
    expect(result.damage.ranged?.directSingleTargetDps).toBeCloseTo(110 * 1.4 * 3 / 20)
    expect(() => evaluate({ ...build(item), rangedEnchantments: [] }, scenario)).toThrow('stacking')
    expect(() => evaluate({ ...build(item), rangedEnchantments: [{ ...FIXED_RANGED_POWER, tier: 2 }] }, scenario)).toThrow('stacking')
    expect(rangedWeaponUnsupportedReason({ ...item, gilded: { enchantmentId: 'power', tier: 1 } })).toContain('金色')
    for (const arrowsConsumedPerShot of [0, 2, undefined]) {
      expect(() => evaluate(build({ ...item, observation: { ...item.observation!, availableAmmo: 0, arrowsConsumedPerShot } }), scenario)).toThrow(/矢/)
    }
    expect(() => evaluate(build({ ...item, observation: { ...item.observation!, fixedPowerObservation: undefined } }), scenario)).toThrow('現在のPower')
    expect(() => evaluate(build({ ...item, powerLevel: 252 }), scenario)).toThrow('現在のPower')
    expect(() => calculateRangedDamage(build({ ...item, powerLevel: 252 }), scenario)).toThrow('現在のPower')
    expect(updateRangedPower(item, 252).observation).toBeUndefined()
    expect(updateRangedPower(item, 251)).toBe(item)
  })

  it('preserves Catalog metadata and refuses conflicting Research facts', () => {
    const legacy = { instanceId: 'old', category: 'ranged', catalogId: 'phantom-bow', powerLevel: 251, isFavorite: true, notes: 'old', research: { enchantments: [FIXED_RANGED_POWER] } }
    const migrated = deserializeInventory(JSON.stringify({ version: 6, inventory: { ...readinessMelee, catalogItems: [legacy] } }))
    expect(migrated.catalogItems).toEqual([])
    expect(migrated.rangedWeapons?.[0]).toMatchObject({ instanceId: 'old', weaponId: 'phantom-bow', isFavorite: true, notes: 'old', research: legacy.research })
    expect(inspectInventoryReadiness(migrated, scenario).equipment.find((row) => row.instanceId === 'old')?.status).toBe('input-required')
    expect(rangedWeaponUnsupportedReason(migrated.rangedWeapons![0]!)).toContain('現在のPowerで固定パワー I を含む通常矢ダメージ')
    const item = { ...migrated.rangedWeapons![0]!, observation: observed('phantom-bow').observation }
    expect(evaluate(build(item), scenario).damage.ranged?.shots).toBe(3)
    const unknown: OwnedRangedWeapon = { ...item, research: { intrinsicProperties: [{ kind: 'intrinsicMechanicOwnership', raw: 'unreviewed extra effect' }] } }
    expect(() => evaluate(build(unknown), scenario)).toThrow('未対応固有効果')
  })

  it('fails closed on lost donor mode, altered target source and neighbors', () => {
    const changed = structuredClone(source)
    changed.rows[0]!.fixed.tier = 2
    expect(fixedPowerBowReuseIsEligible('elite-power-bow', 'uncharged', changed)).toBe(false)
    changed.rows[0]!.fixed.tier = 1
    changed.rows[0]!.localization.key = 'PowerBow_Unique2'
    expect(fixedPowerBowReuseIsEligible('elite-power-bow', 'uncharged', changed)).toBe(false)
    expect(fixedPowerBowReuseIsEligible('phantom-bow', 'uncharged', changed)).toBe(false)
    const grants = donorGrants.approvals.filter((entry) => !(entry.targetId === 'power-bow' && entry.mode === 'uncharged'))
    expect(rangedReuseIsEligible('phantom-bow', 'uncharged', grants)).toBe(false)
    expect(rangedReuseIsEligible('phantom-bow', 'charged', grants)).toBe(true)
    for (const id of ['master-s-bow', 'sabrewing', 'wind-bow', 'guardian-bow']) expect(rangedReuseIsEligible(id, 'charged')).toBe(false)
    expect(rangedReuseIsEligible('phantom-bow', 'single')).toBe(false)
  })
})

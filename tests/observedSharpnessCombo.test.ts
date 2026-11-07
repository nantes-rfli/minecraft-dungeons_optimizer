import { describe, expect, it } from 'vitest'
import { assessEquipment } from '../src/core/equipmentAssessment'
import { evaluate } from '../src/core/evaluate'
import { fixedObservedMeleeComboIsEligible } from '../src/core/observedMeleeComboReuse'
import { inspectInventoryReadiness, optimize } from '../src/core/optimizer'
import type { Build, Inventory } from '../src/core/types'
import { SHARPNESS_OBSERVED_MELEE_COMBO_SOURCE } from '../src/data/fixedObservedMeleeCombo'
import { SCENARIO_PROFILES } from '../src/data/scenarios'
import { deserializeInventory, serializeInventory } from '../src/inventory/storage'

const scenario = { ...SCENARIO_PROFILES.boss, enemyComposition: { undeadShare: 0, enchantedShare: 0 } }
const cycle = 0.4 + 0.4 + 0.242
const weapon: Build['weapon'] = {
  instanceId: 'diamond', weaponId: 'diamond-sword', powerLevel: 251,
  observedComboDamage: { powerLevel: 251, total: 1100 },
  enchantmentSlots: [{ candidates: ['unchanting'] }],
}
const neutralBuild: Build = {
  weapon, artifacts: [],
  enchantments: [{ enchantmentId: 'unchanting', tier: 3, source: 'slot' }, { enchantmentId: 'sharpness', tier: 1, source: 'built-in' }],
}

describe('Diamond Sword observed fixed Sharpness', () => {
  it('returns the observed inclusive rate and attributes a nonzero modeled Sharpness contribution', () => {
    expect(fixedObservedMeleeComboIsEligible('diamond-sword')).toBe(true)
    const evaluation = evaluate(neutralBuild, scenario)
    expect(evaluation.damage.directWeaponSingleTargetDps).toBeCloseTo(1100 / cycle, 10)
    expect(evaluation.damage.damagePerHit).toBeCloseTo(1000 / 3, 10)
    expect(evaluation.damage.sharpnessMultiplier).toBeCloseTo(1.1, 12)
    expect(evaluation.contributions).toContainEqual(expect.objectContaining({
      sourceId: 'sharpness', enchantmentSource: 'built-in', singleTargetDpsDelta: expect.closeTo(100 / cycle, 10),
    }))
  })

  it('applies an independent slot effect to the inclusive observation and reports per-condition scores', () => {
    const item: Build['weapon'] = { ...weapon, enchantmentSlots: [{ candidates: ['sharpness', 'critical-hit'] }] }
    const inventory = deserializeInventory(serializeInventory({ weapons: [item], artifacts: [] }))
    const result = optimize(inventory, scenario)
    expect(result.evaluatedBuildCount).toBe(1)
    expect(result.best.damage.directWeaponSingleTargetDps).toBeCloseTo(1100 / cycle * 1.4, 10)
    expect(result.best.build.enchantments.map(({ enchantmentId, source }) => [enchantmentId, source]))
      .toEqual([['critical-hit', 'slot'], ['sharpness', 'built-in']])
    expect(assessEquipment(inventory, [{ id: 'one', name: 'One target', scenario }])[0])
      .toMatchObject({ status: 'complete', equipment: [{ instanceId: weapon.instanceId, status: 'evaluated', scoreGap: 0 }] })
  })

  it('requires an eligible exact source, owned Tier and matching current Power', () => {
    const source = structuredClone(SHARPNESS_OBSERVED_MELEE_COMBO_SOURCE)
    source.rows[0]!.fixed.tier = 2
    expect(fixedObservedMeleeComboIsEligible('diamond-sword', { sharpnessSource: source })).toBe(false)
    expect(() => evaluate({ ...neutralBuild, enchantments: neutralBuild.enchantments.slice(0, 1) }, scenario)).toThrow()
    const gilded: Build['weapon'] = { ...weapon, gilded: { enchantmentId: 'sharpness', tier: 1 } }
    expect(inspectInventoryReadiness({ weapons: [gilded], artifacts: [] }, scenario).equipment[0]?.status).toBe('unsupported')
    const stale: Inventory = { weapons: [{ ...weapon, powerLevel: 252 }], artifacts: [] }
    expect(() => optimize(stale, scenario)).toThrow('現在のPower')
    expect(() => evaluate(neutralBuild, { ...scenario, averageTargetsInReach: 2 })).toThrow('UNSUPPORTED_COMBO_TARGETS')
  })

  it('migrates existing Catalog ownership while leaving the inclusive observation missing', () => {
    const legacy = { instanceId: 'legacy-diamond', category: 'melee', catalogId: 'diamond-sword', powerLevel: 251, isFavorite: true, notes: '保持するメモ' }
    const inventory = deserializeInventory(JSON.stringify({ version: 6, inventory: { weapons: [], artifacts: [], catalogItems: [legacy] } }))
    expect(inventory.catalogItems).toEqual([])
    expect(inventory.weapons[0]).toEqual({ instanceId: legacy.instanceId, weaponId: legacy.catalogId, powerLevel: legacy.powerLevel, isFavorite: true, notes: legacy.notes, enchantmentSlots: [] })
    expect(inspectInventoryReadiness(inventory, scenario).equipment[0]?.status).toBe('input-required')
  })
})

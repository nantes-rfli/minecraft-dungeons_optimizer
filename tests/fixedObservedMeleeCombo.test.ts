import { describe, expect, it } from 'vitest'
import { assessEquipment } from '../src/core/equipmentAssessment'
import { evaluate } from '../src/core/evaluate'
import { parameterEvidenceForBuild } from '../src/core/evidenceStatus'
import { fixedObservedMeleeComboIsEligible } from '../src/core/observedMeleeComboReuse'
import { inspectInventoryReadiness, optimize } from '../src/core/optimizer'
import type { Build, CatalogInventoryItem, Inventory } from '../src/core/types'
import { getEquipmentCatalogEntry } from '../src/data/equipmentCatalog'
import {
  CONDITIONAL_OBSERVED_MELEE_COMBO_IDS, FIXED_OBSERVED_MELEE_COMBO_SOURCE, fixedObservedMeleeComboEnchantments, type FixedObservedMeleeComboId,
} from '../src/data/fixedObservedMeleeCombo'
import { SCENARIO_PROFILES } from '../src/data/scenarios'
import { deserializeInventory, serializeInventory } from '../src/inventory/storage'

const scenario = { ...SCENARIO_PROFILES.boss, enemyComposition: { enchantedShare: 0, undeadShare: 1 } }
const owned = (id: FixedObservedMeleeComboId): Build['weapon'] => ({
  instanceId: id, weaponId: id, powerLevel: 251, observedComboDamage: { powerLevel: 251, total: 900 },
  enchantmentSlots: [{ candidates: ['unchanting'] }],
})
const build = (id: FixedObservedMeleeComboId): Build => ({
  weapon: owned(id), artifacts: [], enchantments: [{ enchantmentId: 'unchanting', tier: 3, source: 'slot' }, ...fixedObservedMeleeComboEnchantments(id)],
})
const inventory = (weapon: Build['weapon']): Inventory => ({ weapons: [weapon], artifacts: [] })

describe('observed combo with owned Tier I damage effects', () => {
  it.each(CONDITIONAL_OBSERVED_MELEE_COMBO_IDS)('injects and scores the target-owned Tier I exactly once for %s', (id) => {
    const source = FIXED_OBSERVED_MELEE_COMBO_SOURCE.rows.find((row) => row.id === id)!
    expect(fixedObservedMeleeComboIsEligible(id)).toBe(true)
    const seconds = source.hitDurationsSeconds.reduce((sum, value) => sum + value, 0)
    const baseline = 900 / seconds
    const value = build(id)
    const result = evaluate(value, scenario)
    const bonus = source.fixed.enchantmentId === 'smiting' ? 0.25 : 0.2
    expect(result.damage.directWeaponSingleTargetDps).toBeCloseTo(baseline * (1 + bonus), 10)
    expect(result.contributions).toContainEqual(expect.objectContaining({
      sourceId: source.fixed.enchantmentId, enchantmentSource: 'built-in', singleTargetDpsDelta: expect.closeTo(baseline * bonus, 10),
    }))
    expect(optimize(inventory(value.weapon), scenario).best.build.enchantments).toEqual(value.enchantments)
    expect(parameterEvidenceForBuild(value)).toContainEqual(expect.objectContaining({ mechanicId: `melee:${id}`, parameterId: 'fixed-builtin-ownership-tier', status: 'derived' }))
    expect(getEquipmentCatalogEntry('melee', id)).toMatchObject({
      runtimeSupport: 'limited', builtInEnchantments: [{ enchantmentId: source.fixed.enchantmentId, tier: 1 }],
    })
    const neutral = { ...scenario, enemyComposition: { ...scenario.enemyComposition, undeadShare: 0 } }
    expect(evaluate(value, neutral).damage.directWeaponSingleTargetDps).toBeCloseTo(baseline * (source.fixed.enchantmentId === 'smiting' ? 1 : 1.2), 10)
    expect(inspectInventoryReadiness(inventory(value.weapon), scenario).equipment[0]?.status).toBe('evaluated')
  })

  it('requires the fixed owner, Tier, scope and independent actual selections', () => {
    const value = build('dark-katana')
    const slot = value.enchantments[0]!
    const fixed = value.enchantments[1]!
    expect(() => evaluate({ ...value, enchantments: [slot] }, scenario)).toThrow()
    expect(() => evaluate({ ...value, enchantments: [slot, { ...fixed, tier: 2 }] }, scenario)).toThrow()
    expect(() => evaluate({ ...value, enchantments: [slot, { ...fixed, source: 'gilded' }] }, scenario)).toThrow()
    const onlyDuplicate = { ...value.weapon, enchantmentSlots: [{ candidates: ['smiting'] as const }] }
    expect(inspectInventoryReadiness(inventory(onlyDuplicate), scenario).equipment[0]?.status).toBe('constrained')
    const blocked = { ...value.weapon, gilded: { enchantmentId: 'smiting', tier: 1 as const } }
    expect(inspectInventoryReadiness(inventory(blocked), scenario).equipment[0]?.status).toBe('unsupported')
    const choices = { ...value.weapon, enchantmentSlots: [{ candidates: ['smiting', 'unchanting'] as const }] }
    expect(optimize(inventory(choices), scenario).best.build.enchantments).toEqual([slot, fixed])
    expect(() => evaluate(value, { ...scenario, averageTargetsInReach: 2 })).toThrow('UNSUPPORTED_COMBO_TARGETS')
    expect(() => evaluate({ ...value, artifacts: [{ instanceId: 'm', artifactId: 'death-cap-mushroom', powerLevel: 251 }] }, scenario)).toThrow('速度効果')
  })

  it('preserves Catalog-owned rolls and does not accept Research as an observation or erase an unknown effect', () => {
    const legacy: CatalogInventoryItem = {
      instanceId: 'legacy-hawk', category: 'melee', catalogId: 'hawkbrand', powerLevel: 251,
      rarity: 'unique', isFavorite: true,
      enchantmentSlots: [{ candidates: ['unchanting'], selected: { enchantmentId: 'unchanting', tier: 2 } }],
      research: { enchantments: [{ enchantmentId: 'critical-hit', tier: 1, source: 'built-in' }], intrinsicProperties: [{ kind: 'intrinsicMechanicOwnership', raw: 'Gives critical hit chance' }] },
    }
    const migrated = deserializeInventory(JSON.stringify({ version: 6, inventory: { weapons: [], artifacts: [], catalogItems: [legacy] } }))
    const item = migrated.weapons[0]!
    expect(item).toMatchObject({ instanceId: legacy.instanceId, enchantmentSlots: legacy.enchantmentSlots, rarity: 'unique', isFavorite: true, research: legacy.research })
    expect(item.observedComboDamage).toBeUndefined()
    const withObservation = { ...item, observedComboDamage: { powerLevel: 251, total: 900 } }
    expect(deserializeInventory(serializeInventory(inventory(withObservation))).weapons).toEqual([withObservation])
    const conditions = [{ id: 'single', name: 'Single', scenario }]
    expect(assessEquipment(inventory(withObservation), conditions)[0]).toMatchObject({
      status: 'complete', equipment: [{ instanceId: legacy.instanceId, status: 'evaluated', scoreGap: 0 }],
    })
    const extra = { ...withObservation, research: { intrinsicProperties: [{ kind: 'intrinsicMechanicOwnership', raw: 'unknown additional effect' }] } }
    expect(() => optimize(inventory(extra), scenario)).toThrow('未対応固有効果')
  })

  it('holds conflicting or different mechanics and fails closed on altered ownership or source', () => {
    for (const id of ['masters-katana', 'broadsword', 'frost-slayer']) {
      expect(fixedObservedMeleeComboIsEligible(id)).toBe(false)
      expect(getEquipmentCatalogEntry('melee', id)?.runtimeSupport).toBe('unsupported')
    }
    const source = structuredClone(FIXED_OBSERVED_MELEE_COMBO_SOURCE)
    source.rows.find((row) => row.id === 'hawkbrand')!.fixed.tier = 2
    expect(fixedObservedMeleeComboIsEligible('hawkbrand', { source })).toBe(false)
    const wrongTiming = structuredClone(FIXED_OBSERVED_MELEE_COMBO_SOURCE)
    wrongTiming.rows.find((row) => row.id === 'grave-bane')!.hitDurationsSeconds[1] = 1
    expect(fixedObservedMeleeComboIsEligible('grave-bane', { source: wrongTiming })).toBe(false)
  })
})

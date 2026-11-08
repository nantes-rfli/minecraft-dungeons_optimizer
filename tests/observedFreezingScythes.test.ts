import { describe, expect, it } from 'vitest'
import { assessEquipment } from '../src/core/equipmentAssessment'
import { evaluate } from '../src/core/evaluate'
import { parameterEvidenceForBuild } from '../src/core/evidenceStatus'
import { fixedObservedMeleeComboIsEligible } from '../src/core/observedMeleeComboReuse'
import { inspectInventoryReadiness, optimize } from '../src/core/optimizer'
import type { Build, Inventory, OwnedWeapon } from '../src/core/types'
import { getEquipmentCatalogEntry } from '../src/data/equipmentCatalog'
import { FREEZING_OBSERVED_MELEE_COMBO_IDS, FREEZING_OBSERVED_MELEE_COMBO_SOURCE } from '../src/data/fixedObservedMeleeCombo'
import { SCENARIO_PROFILES } from '../src/data/scenarios'
import { deserializeInventory, serializeInventory } from '../src/inventory/storage'

const scenario = { ...SCENARIO_PROFILES.boss, enemyComposition: { undeadShare: 0, enchantedShare: 0 }, crowdControl: { ...SCENARIO_PROFILES.boss.crowdControl, freezingEligibleTargetShare: 1 } }
const observed = (weaponId: (typeof FREEZING_OBSERVED_MELEE_COMBO_IDS)[number]): OwnedWeapon => ({
  instanceId: weaponId, weaponId, powerLevel: 251, observedComboDamage: { powerLevel: 251, total: 520 }, enchantmentSlots: [{ candidates: ['unchanting'] }],
})
const inventory = (weapon: OwnedWeapon): Inventory => ({ weapons: [weapon], artifacts: [] })
const build = (weapon: OwnedWeapon): Build => ({
  weapon, artifacts: [], enchantments: [{ enchantmentId: 'unchanting', tier: 3, source: 'slot' }, { enchantmentId: 'freezing', tier: 1, source: 'built-in' }],
})

describe('observed Frost Scythe and Skull Scythe', () => {
  it.each(FREEZING_OBSERVED_MELEE_COMBO_IDS)('evaluates %s with owned Freezing I and its own Soul Gathering', (id) => {
    expect(fixedObservedMeleeComboIsEligible(id)).toBe(true)
    const item = observed(id)
    const value = build(item)
    const result = evaluate(value, scenario)
    expect(result.damage.directWeaponSingleTargetDps).toBeCloseTo(520 / 1.04, 10)
    expect(result.control.freezing).toMatchObject({ attackSpeedReduction: 0.3, durationSeconds: 3, eligibleTargetShare: 1, triggerChance: 1 })
    expect(result.control.freezing?.attackSlowEquivalentCoverage).toBeGreaterThan(0)
    expect(result.soulState).toMatchObject({ baseSoulGathering: 1, totalSoulGathering: 1 })
    expect(result.contributions).toContainEqual(expect.objectContaining({ sourceId: 'freezing', enchantmentSource: 'built-in', controlUtilityDelta: expect.any(Number) }))
    expect(result.contributions.find(({ sourceId }) => sourceId === 'freezing')?.controlUtilityDelta).toBeGreaterThan(0)
    const immune = evaluate(value, { ...scenario, crowdControl: { ...scenario.crowdControl, freezingEligibleTargetShare: 0 } })
    expect(immune.control.freezing?.attackSlowEquivalentCoverage).toBe(0)
    expect(immune.soulState).toEqual(result.soulState)
    expect(optimize(inventory(item), scenario).best.build.enchantments).toEqual(value.enchantments)
    expect(assessEquipment(inventory(item), [{ id: 'single', name: 'Single target', scenario }])[0]).toMatchObject({ status: 'complete', equipment: [{ instanceId: id, status: 'evaluated', scoreGap: 0 }] })
    expect(parameterEvidenceForBuild(value)).toContainEqual(expect.objectContaining({ mechanicId: `melee:${id}`, parameterId: 'fixed-builtin-ownership-tier', status: 'derived' }))
    expect(getEquipmentCatalogEntry('melee', id)).toMatchObject({ runtimeSupport: 'limited', soulGear: true, builtInEnchantments: [{ enchantmentId: 'freezing', tier: 1 }] })
    expect(deserializeInventory(serializeInventory(inventory(item))).weapons).toEqual([item])
  })

  it('rejects stale damage, duplicate effects and unsupported scope', () => {
    const item = observed('skull-scythe')
    const value = build(item)
    expect(() => evaluate({ ...value, weapon: { ...item, powerLevel: 252 } }, scenario)).toThrow('現在のPower')
    expect(() => evaluate({ ...value, enchantments: value.enchantments.slice(0, 1) }, scenario)).toThrow()
    expect(() => evaluate(value, { ...scenario, averageTargetsInReach: 2 })).toThrow('UNSUPPORTED_COMBO_TARGETS')
    expect(inspectInventoryReadiness(inventory({ ...item, gilded: { enchantmentId: 'freezing', tier: 1 } }), scenario).equipment[0]?.status).toBe('unsupported')
    const source = structuredClone(FREEZING_OBSERVED_MELEE_COMBO_SOURCE)
    source.rows[0]!.soul.baseSoulGathering = 2
    expect(fixedObservedMeleeComboIsEligible('frost-scythe', { freezingSource: source })).toBe(false)
    for (const id of ['fangs-of-frost', 'freezing-foil', 'chill-gale-knife', 'jailors-scythe']) expect(fixedObservedMeleeComboIsEligible(id)).toBe(false)
  })

  it('combines the owned Soul Gathering with the existing Anima Conduit pickup-healing channel', () => {
    const item: OwnedWeapon = { ...observed('frost-scythe'), enchantmentSlots: [{ candidates: ['anima-conduit'] }] }
    const result = optimize(inventory(item), scenario).best
    expect(result.build.enchantments).toEqual([{ enchantmentId: 'anima-conduit', tier: 3, source: 'slot' }, { enchantmentId: 'freezing', tier: 1, source: 'built-in' }])
    expect(result.soulState).toMatchObject({ baseSoulGathering: 1, enchantmentSoulGathering: 1 })
    expect(result.healing.animaHealingCapacityPerSecond).toBeGreaterThan(0)
    expect(result.control.freezing?.attackSlowEquivalentCoverage).toBeGreaterThan(0)
  })

  it('migrates Catalog metadata without assuming a combo observation', () => {
    const legacy = { instanceId: 'old', category: 'melee', catalogId: 'frost-scythe', powerLevel: 251, isFavorite: true, enchantmentSlots: [{ candidates: ['unchanting'] }] }
    const migrated = deserializeInventory(JSON.stringify({ version: 6, inventory: { weapons: [], artifacts: [], catalogItems: [legacy] } }))
    expect(migrated.catalogItems).toEqual([])
    expect(migrated.weapons[0]).toMatchObject({ instanceId: 'old', weaponId: 'frost-scythe', isFavorite: true, enchantmentSlots: legacy.enchantmentSlots })
    expect(inspectInventoryReadiness(migrated, scenario).equipment[0]?.status).toBe('input-required')
  })
})

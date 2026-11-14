import { describe, expect, it } from 'vitest'
import { assessEquipment } from '../src/core/equipmentAssessment'
import { evaluate } from '../src/core/evaluate'
import { parameterEvidenceForBuild } from '../src/core/evidenceStatus'
import { fixedObservedMeleeComboIsEligible } from '../src/core/observedMeleeComboReuse'
import { inspectInventoryReadiness, optimize } from '../src/core/optimizer'
import type { Build, Inventory, OwnedWeapon } from '../src/core/types'
import { getEquipmentCatalogEntry } from '../src/data/equipmentCatalog'
import { fixedObservedMeleeComboEnchantments, SOUL_OBSERVED_MELEE_COMBO_IDS, SOUL_SIPHON_OBSERVED_MELEE_COMBO_SOURCE } from '../src/data/fixedObservedMeleeCombo'
import { SCENARIO_PROFILES } from '../src/data/scenarios'
import { deserializeInventory, serializeInventory } from '../src/inventory/storage'

const scenario = { ...SCENARIO_PROFILES.boss, maxHealth: 100, enemySupplyPerSecond: 0, enemyComposition: { undeadShare: 0, enchantedShare: 0 } }
const weapon: OwnedWeapon = { instanceId: 'eternal', weaponId: 'eternal-knife', powerLevel: 251, observedComboDamage: { powerLevel: 251, total: 850 }, enchantmentSlots: [{ candidates: ['unchanting'] }] }
const build: Build = { weapon, artifacts: [], enchantments: [{ enchantmentId: 'unchanting', tier: 3, source: 'slot' }, ...fixedObservedMeleeComboEnchantments('eternal-knife')] }
const inventory: Inventory = { weapons: [weapon], artifacts: [] }

describe('observed Soul Siphon melee population', () => {
  it('counts Eternal Knife’s displayed +2 Gathering as weapon +1 and required fixed +1 once', () => {
    expect(fixedObservedMeleeComboIsEligible('eternal-knife')).toBe(true)
    const result = evaluate(build, scenario)
    expect(result.damage.directWeaponSingleTargetDps).toBeCloseTo(1000, 10)
    expect(result.soulState).toMatchObject({ baseSoulGathering: 1, enchantmentSoulGathering: 1, totalSoulGathering: 2, siphonTriggerChance: 0.2, siphonPickupsPerProc: 1, eligibleSoulGeneratingKillsPerSecond: 0 })
    expect(result.soulState!.siphonPickupEventsPerSecond).toBeCloseTo(0.2 / 0.85, 12)
    expect(result.soulState!.siphonResourceUnitsPerSecond).toBeCloseTo(0.4 / 0.85, 12)
    expect(result.contributions).toContainEqual(expect.objectContaining({ sourceId: 'soul-siphon', enchantmentSource: 'built-in' }))
    expect(optimize(inventory, scenario).best.build.enchantments).toEqual(build.enchantments)
    expect(getEquipmentCatalogEntry('melee', 'eternal-knife')).toMatchObject({ runtimeSupport: 'limited', soulGear: true, builtInEnchantments: [{ enchantmentId: 'soul-siphon', tier: 1 }] })
    expect(deserializeInventory(serializeInventory(inventory)).weapons).toEqual([weapon])
  })

  it.each(SOUL_OBSERVED_MELEE_COMBO_IDS)('reuses %s hit opportunities for Soul Siphon and distinct Anima Conduit healing', (id) => {
    const eternal = id === 'eternal-knife'
    const item: OwnedWeapon = { ...weapon, instanceId: id, weaponId: id, enchantmentSlots: eternal ? [{ candidates: ['anima-conduit'] }] : [{ candidates: ['soul-siphon'] }, { candidates: ['anima-conduit'] }] }
    const result = optimize({ weapons: [item], artifacts: [] }, scenario).best
    const pickups = result.damage.hitsPerSecond * 0.2 * (eternal ? 1 : 5)
    expect(result.soulState).toMatchObject({ baseSoulGathering: 1, enchantmentSoulGathering: 2, totalSoulGathering: 3, normalPickupEventsPerSecond: 0 })
    expect(result.soulState!.siphonPickupEventsPerSecond).toBeCloseTo(pickups, 12)
    expect(result.soulState!.siphonResourceUnitsPerSecond).toBeCloseTo(pickups * 3, 12)
    expect(result.healing.animaHealingCapacityPerSecond).toBeCloseTo(pickups * 100 * 0.06, 12)
    expect(parameterEvidenceForBuild(result.build)).toContainEqual(expect.objectContaining({ parameterId: 'soul-siphon-per-profile-hit-model', status: 'estimated' }))
    const strict = inspectInventoryReadiness({ weapons: [item], artifacts: [] }, { ...scenario, evidencePolicy: 'high-confidence-only' })
    expect(strict.equipment[0]?.status).toBe('constrained')
    const scored = assessEquipment({ weapons: [item], artifacts: [] }, [{ id: 'boss', name: 'Boss', scenario }, { id: 'sustain', name: 'Sustain', scenario: { ...scenario, weights: { damage: 0, healing: 1, defense: 0, control: 0 } } }])
    expect(scored.every(({ status }) => status === 'complete')).toBe(true)
  })

  it('rejects missing/duplicate ownership, stale observations and unreviewed percent-Soul interactions', () => {
    expect(() => evaluate({ ...build, enchantments: build.enchantments.slice(0, 1) }, scenario)).toThrow()
    expect(() => evaluate({ ...build, weapon: { ...weapon, powerLevel: 252 } }, scenario)).toThrow('現在のPower')
    expect(() => evaluate(build, { ...scenario, averageTargetsInReach: 2 })).toThrow('UNSUPPORTED_COMBO_TARGETS')
    expect(inspectInventoryReadiness({ weapons: [{ ...weapon, gilded: { enchantmentId: 'soul-siphon', tier: 1 } }], artifacts: [] }, scenario).equipment[0]?.status).toBe('unsupported')
    const armor: Build = { ...build, armor: { instanceId: 'grim', armorId: 'grim-armor', powerLevel: 251, observedHealthBonus: 100, enchantmentSlots: [{ candidates: ['cool-down'] }] }, armorEnchantments: [{ enchantmentId: 'cool-down', tier: 3, source: 'slot' }] }
    expect(() => evaluate(armor, scenario)).toThrow('UNSUPPORTED_ARMOR_COMBINATION')
    const source = structuredClone(SOUL_SIPHON_OBSERVED_MELEE_COMBO_SOURCE)
    source.rows[0]!.soul.publishedTotalSoulGathering = 3
    expect(fixedObservedMeleeComboIsEligible('eternal-knife', { soulSiphonSource: source })).toBe(false)
  })

  it('migrates Catalog identity without inventing a damage observation', () => {
    const item = { instanceId: 'old', category: 'melee', catalogId: 'eternal-knife', powerLevel: 251, enchantmentSlots: [{ candidates: ['unchanting'] }] }
    const migrated = deserializeInventory(JSON.stringify({ version: 6, inventory: { weapons: [], artifacts: [], catalogItems: [item] } }))
    expect(migrated.weapons[0]).toMatchObject({ instanceId: 'old', weaponId: 'eternal-knife', powerLevel: 251 })
    expect(inspectInventoryReadiness(migrated, scenario).equipment[0]?.status).toBe('input-required')
  })
})

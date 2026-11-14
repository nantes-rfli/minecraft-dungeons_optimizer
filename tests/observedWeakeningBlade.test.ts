import { describe, expect, it } from 'vitest'
import { assessEquipment } from '../src/core/equipmentAssessment'
import { evaluate } from '../src/core/evaluate'
import { parameterEvidenceForBuild } from '../src/core/evidenceStatus'
import { fixedObservedMeleeComboIsEligible } from '../src/core/observedMeleeComboReuse'
import { inspectInventoryReadiness, optimize } from '../src/core/optimizer'
import type { Build, Inventory, OwnedWeapon } from '../src/core/types'
import { getEquipmentCatalogEntry } from '../src/data/equipmentCatalog'
import { WEAKENING_OBSERVED_MELEE_COMBO_SOURCE } from '../src/data/fixedObservedMeleeCombo'
import { SCENARIO_PROFILES } from '../src/data/scenarios'
import { deserializeInventory, serializeInventory } from '../src/inventory/storage'

const scenario = { ...SCENARIO_PROFILES.boss, enemyComposition: { undeadShare: 0, enchantedShare: 0 }, enemyDebuffs: { weakeningAffectedIncomingDamageShare: 0.5 } }
const weapon: OwnedWeapon = { instanceId: 'nameless', weaponId: 'nameless-blade', powerLevel: 251, observedComboDamage: { powerLevel: 251, total: 400 }, enchantmentSlots: [{ candidates: ['unchanting'] }] }
const build: Build = { weapon, artifacts: [], enchantments: [{ enchantmentId: 'unchanting', tier: 3, source: 'slot' }, { enchantmentId: 'weakening', tier: 1, source: 'built-in' }] }
const inventory: Inventory = { weapons: [weapon], artifacts: [] }

describe('Nameless Blade observed complete combo and fixed Weakening I', () => {
  it('uses its own two-hit cadence and applies the owned 20% debuff once to affected incoming damage', () => {
    expect(fixedObservedMeleeComboIsEligible('nameless-blade')).toBe(true)
    const result = evaluate(build, scenario)
    expect(result.damage.directWeaponSingleTargetDps).toBe(500)
    expect(result.defense).toMatchObject({ weakeningDamageReduction: 0.2, weakeningDurationSeconds: 5, weakeningAffectedIncomingDamageShare: 0.5, weakeningEnemyDamageMultiplier: 0.9 })
    expect(result.contributions.find(({ sourceId }) => sourceId === 'weakening')).toMatchObject({ enchantmentSource: 'built-in', singleTargetDpsDelta: 0, effectiveHealthDelta: expect.any(Number) })
    expect(result.contributions.find(({ sourceId }) => sourceId === 'weakening')!.effectiveHealthDelta).toBeGreaterThan(0)
    expect(optimize(inventory, scenario).best.build.enchantments).toEqual(build.enchantments)
    expect(getEquipmentCatalogEntry('melee', 'nameless-blade')).toMatchObject({ runtimeSupport: 'limited', builtInEnchantments: [{ enchantmentId: 'weakening', tier: 1 }] })
    expect(result.soulState).toBeUndefined()
    expect(deserializeInventory(serializeInventory(inventory)).weapons).toEqual([weapon])
  })

  it('supports per-item and per-condition defense comparisons with independent exposure', () => {
    const none = { ...scenario, enemyDebuffs: { weakeningAffectedIncomingDamageShare: 0 } }
    const all = { ...scenario, enemyDebuffs: { weakeningAffectedIncomingDamageShare: 1 } }
    const results = assessEquipment(inventory, [{ id: 'none', name: 'None', scenario: none }, { id: 'all', name: 'All', scenario: all }])
    expect(results.every(({ status }) => status === 'complete')).toBe(true)
    const [without, full] = results
    if (without?.status !== 'complete' || full?.status !== 'complete') throw Error('Both conditions must be evaluable')
    expect(full.equipment).toMatchObject([{ instanceId: 'nameless', status: 'evaluated', scoreGap: 0 }])
    expect(full.best.defense.weakeningEnemyDamageMultiplier).toBe(0.8)
    expect(without.best.defense.weakeningEnemyDamageMultiplier).toBe(1)
    expect(full.best.defense.effectiveHealth / without.best.defense.effectiveHealth).toBeCloseTo(1.25, 12)
    expect(full.best.damage).toEqual(without.best.damage)
  })

  it('keeps exposure estimated and respects existing armor defense composition gates', () => {
    expect(parameterEvidenceForBuild(build)).toContainEqual(expect.objectContaining({ parameterId: 'weakening-affected-incoming-damage-share', status: 'estimated' }))
    expect(inspectInventoryReadiness(inventory, { ...scenario, evidencePolicy: 'high-confidence-only' }).equipment[0]?.status).toBe('constrained')
    const drArmor: Build = { ...build, armor: { instanceId: 'armor', armorId: 'dark-armor', powerLevel: 251, observedHealthBonus: 100, enchantmentSlots: [{ candidates: ['cool-down'] }] }, armorEnchantments: [{ enchantmentId: 'cool-down', tier: 3, source: 'slot' }] }
    expect(() => evaluate(drArmor, scenario)).toThrow('UNSUPPORTED_ARMOR_DR_COMBINATION')
  })

  it('rejects stale observations, missing or duplicated ownership and incompatible effects', () => {
    expect(() => evaluate({ ...build, weapon: { ...weapon, powerLevel: 252 } }, scenario)).toThrow('現在のPower')
    expect(() => evaluate({ ...build, enchantments: build.enchantments.slice(0, 1) }, scenario)).toThrow()
    expect(() => evaluate(build, { ...scenario, averageTargetsInReach: 2 })).toThrow('UNSUPPORTED_COMBO_TARGETS')
    expect(inspectInventoryReadiness({ ...inventory, weapons: [{ ...weapon, gilded: { enchantmentId: 'weakening', tier: 1 } }] }, scenario).equipment[0]?.status).toBe('unsupported')
    const source = structuredClone(WEAKENING_OBSERVED_MELEE_COMBO_SOURCE)
    source.rows[0]!.fixed.enemyDamageReduction = 0.4
    expect(fixedObservedMeleeComboIsEligible('nameless-blade', { weakeningSource: source })).toBe(false)
  })

  it('migrates old Catalog records while requiring a current-Power observation', () => {
    const item = { instanceId: 'old', category: 'melee', catalogId: 'nameless-blade', powerLevel: 251, enchantmentSlots: [{ candidates: ['unchanting'] }] }
    const migrated = deserializeInventory(JSON.stringify({ version: 6, inventory: { weapons: [], artifacts: [], catalogItems: [item] } }))
    expect(migrated.weapons[0]).toMatchObject({ instanceId: 'old', weaponId: 'nameless-blade', powerLevel: 251 })
    expect(inspectInventoryReadiness(migrated, scenario).equipment[0]?.status).toBe('input-required')
  })
})

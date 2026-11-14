import { describe, expect, it } from 'vitest'
import { assessEquipment } from '../src/core/equipmentAssessment'
import { evaluate } from '../src/core/evaluate'
import { parameterEvidenceForBuild } from '../src/core/evidenceStatus'
import { fixedObservedMeleeComboIsEligible } from '../src/core/observedMeleeComboReuse'
import { inspectInventoryReadiness, optimize } from '../src/core/optimizer'
import type { Build, Inventory, OwnedWeapon } from '../src/core/types'
import { getEquipmentCatalogEntry } from '../src/data/equipmentCatalog'
import { COMMITTED_OBSERVED_MELEE_COMBO_SOURCE } from '../src/data/fixedObservedMeleeCombo'
import { SCENARIO_PROFILES } from '../src/data/scenarios'
import { deserializeInventory, serializeInventory } from '../src/inventory/storage'

const scenario = { ...SCENARIO_PROFILES.boss, enemyComposition: { undeadShare: 0, enchantedShare: 0 } }
const weapon: OwnedWeapon = { instanceId: 'truth', weaponId: 'truthseeker', powerLevel: 251, observedComboDamage: { powerLevel: 251, total: 850 }, enchantmentSlots: [{ candidates: ['unchanting'] }] }
const build: Build = { weapon, artifacts: [], enchantments: [{ enchantmentId: 'unchanting', tier: 3, source: 'slot' }, { enchantmentId: 'committed', tier: 1, source: 'built-in' }] }
const inventory: Inventory = { weapons: [weapon], artifacts: [] }

describe('Truthseeker first-strike observation and fixed Committed I', () => {
  it('uses the owned one-hit cadence and integrates the fixed 0–50% bonus once', () => {
    expect(fixedObservedMeleeComboIsEligible('truthseeker')).toBe(true)
    const result = evaluate(build, scenario)
    const multiplier = 0.5 / Math.log1p(0.5)
    expect(result.damage.hitsPerSecond).toBeCloseTo(1 / 0.85, 12)
    expect(result.damage.committedSingleTargetMultiplier).toBeCloseTo(multiplier, 12)
    expect(result.damage.directWeaponSingleTargetDps).toBeCloseTo(1000 * multiplier, 10)
    expect(result.soulState).toMatchObject({ baseSoulGathering: 1, totalSoulGathering: 1 })
    expect(result.contributions.find(({ sourceId }) => sourceId === 'committed')).toMatchObject({ enchantmentSource: 'built-in', singleTargetDpsDelta: expect.any(Number) })
    expect(result.contributions.find(({ sourceId }) => sourceId === 'committed')!.singleTargetDpsDelta).toBeCloseTo(1000 * (multiplier - 1), 10)
    expect(optimize(inventory, scenario).best.build.enchantments).toEqual(build.enchantments)
    expect(getEquipmentCatalogEntry('melee', 'truthseeker')).toMatchObject({ runtimeSupport: 'limited', soulGear: true, builtInEnchantments: [{ enchantmentId: 'committed', tier: 1 }] })
    expect(deserializeInventory(serializeInventory(inventory)).weapons).toEqual([weapon])
  })

  it('combines the distinct flat Soul income and Anima Conduit pickup healing', () => {
    const healingWeapon: OwnedWeapon = { ...weapon, enchantmentSlots: [{ candidates: ['anima-conduit'] }] }
    const result = optimize({ ...inventory, weapons: [healingWeapon] }, scenario).best
    expect(result.build.enchantments).toEqual([{ enchantmentId: 'anima-conduit', tier: 3, source: 'slot' }, { enchantmentId: 'committed', tier: 1, source: 'built-in' }])
    expect(result.soulState).toMatchObject({ baseSoulGathering: 1, enchantmentSoulGathering: 1, totalSoulGathering: 2 })
    expect(result.healing.animaHealingCapacityPerSecond).toBeGreaterThan(0)
    const scored = assessEquipment({ ...inventory, weapons: [healingWeapon] }, [
      { id: 'boss', name: 'Boss', scenario }, { id: 'sustain', name: 'Sustain', scenario: { ...scenario, weights: { damage: 0, healing: 1, defense: 0, control: 0 } } },
    ])
    expect(scored.every(({ status }) => status === 'complete')).toBe(true)
    for (const condition of scored) if (condition.status === 'complete') expect(condition.equipment).toMatchObject([{ instanceId: 'truth', status: 'evaluated', scoreGap: 0 }])
  })

  it('keeps fresh-target continuous combat estimated and blocks incompatible conditions', () => {
    expect(parameterEvidenceForBuild(build)).toContainEqual(expect.objectContaining({ parameterId: 'committed-fresh-target-model', status: 'estimated' }))
    expect(inspectInventoryReadiness(inventory, { ...scenario, evidencePolicy: 'high-confidence-only' }).equipment[0]?.status).toBe('constrained')
    expect(() => evaluate(build, { ...scenario, averageTargetsInReach: 2 })).toThrow('UNSUPPORTED_COMBO_TARGETS')
    expect(() => evaluate({ ...build, weapon: { ...weapon, powerLevel: 252 } }, scenario)).toThrow('現在のPower')
    expect(() => evaluate({ ...build, enchantments: build.enchantments.slice(0, 1) }, scenario)).toThrow()
    expect(inspectInventoryReadiness({ ...inventory, weapons: [{ ...weapon, gilded: { enchantmentId: 'committed', tier: 1 } }] }, scenario).equipment[0]?.status).toBe('unsupported')
    const source = structuredClone(COMMITTED_OBSERVED_MELEE_COMBO_SOURCE)
    source.rows[0]!.fixed.maxBonus = 1
    expect(fixedObservedMeleeComboIsEligible('truthseeker', { committedSource: source })).toBe(false)
    for (const id of ['growing-staff', 'resolute-tempest-knife']) expect(fixedObservedMeleeComboIsEligible(id)).toBe(false)
  })

  it('migrates historical Catalog identity without manufacturing a neutral observation', () => {
    const item = { instanceId: 'old', category: 'melee', catalogId: 'truthseeker', powerLevel: 251, enchantmentSlots: [{ candidates: ['unchanting'] }] }
    const migrated = deserializeInventory(JSON.stringify({ version: 6, inventory: { weapons: [], artifacts: [], catalogItems: [item] } }))
    expect(migrated.weapons[0]).toMatchObject({ instanceId: 'old', weaponId: 'truthseeker', powerLevel: 251 })
    expect(inspectInventoryReadiness(migrated, scenario).equipment[0]?.status).toBe('input-required')
  })
})

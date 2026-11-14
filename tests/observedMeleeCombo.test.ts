import { describe, expect, it } from 'vitest'
import identities from '../research/domain/formal/identity-evidence-v1.json'
import values from '../research/domain/formal/value-availability-v2.json'
import approvals from '../research/runtime/observed-melee-combo-reuse.json'
import { SCENARIO_PROFILES } from '../src/data/scenarios'
import { OBSERVED_MELEE_COMBO_IDS, OBSERVED_MELEE_COMBO_SOURCE, observedMeleeComboRow } from '../src/data/observedMeleeCombo'
import { EQUIPMENT_CATALOG, getEquipmentCatalogEntry } from '../src/data/equipmentCatalog'
import { collectObservedMeleeComboReuseErrors, observedMeleeComboIsEligible } from '../src/core/observedMeleeComboReuse'
import { parameterEvidenceForBuild } from '../src/core/evidenceStatus'
import { estimateSearchCandidates } from '../src/core/searchBudget'
import { evaluate } from '../src/core/evaluate'
import { inspectInventoryReadiness, optimize } from '../src/core/optimizer'
import { assessEquipment } from '../src/core/equipmentAssessment'
import { deserializeInventory, serializeInventory } from '../src/inventory/storage'
import type { Build, CatalogInventoryItem, EnchantmentId, Inventory, WeaponId } from '../src/core/types'

const scenario = SCENARIO_PROFILES.boss
const build = (weaponId: WeaponId = 'coral-blade', enchantmentId: EnchantmentId = 'critical-hit'): Build => ({
  weapon: { instanceId: weaponId, weaponId, powerLevel: 251, observedComboDamage: { powerLevel: 251, total: 900 }, enchantmentSlots: [{ candidates: [enchantmentId] }] },
  enchantments: [{ enchantmentId, tier: 3, source: 'slot' }],
  artifacts: [],
})
const inventory = (value: Build): Inventory => ({ weapons: [value.weapon], artifacts: value.artifacts })

describe('observed complete melee combo reuse', () => {
  it('accepts the exact finite population and keeps conflicting or extra-effect weapons Research-only', () => {
    expect(collectObservedMeleeComboReuseErrors()).toEqual([])
    expect(approvals.targets).toEqual(OBSERVED_MELEE_COMBO_IDS)
    const catalog = EQUIPMENT_CATALOG.filter(({ category }) => category === 'melee')
    expect(catalog).toHaveLength(82)
    expect(catalog.filter(({ runtimeSupport }) => runtimeSupport === 'full')).toHaveLength(4)
    expect(catalog.filter(({ runtimeSupport }) => runtimeSupport === 'limited')).toHaveLength(28)
    for (const id of ['axe', 'sword', 'boneclub', 'claymore', 'sponge-striker', 'broken-sawblade']) {
      expect(observedMeleeComboIsEligible(id)).toBe(false)
      expect(getEquipmentCatalogEntry('melee', id)?.runtimeSupport).toBe('unsupported')
    }
  })

  it.each(OBSERVED_MELEE_COMBO_IDS)('calculates and recommends %s from its own complete cadence and total', (id) => {
    const value = build(id)
    const row = observedMeleeComboRow(id)!
    const seconds = row.hitDurationsSeconds.reduce((sum, duration) => sum + duration, 0)
    const evaluated = evaluate(value, scenario)
    expect(getEquipmentCatalogEntry('melee', id)?.runtimeSupport).toBe('limited')
    expect(evaluated.damage.hitsPerSecond).toBeCloseTo(row.hitDurationsSeconds.length / seconds, 12)
    expect(evaluated.damage.directWeaponSingleTargetDps).toBeCloseTo(900 / seconds * 1.4, 10)
    expect(evaluated.damage.aoeDps).toBe(evaluated.damage.singleTargetDps)
    expect(evaluated.reasons).toContainEqual(expect.stringContaining('コンボ全段の観測合計が必須'))
    expect(optimize(inventory(value), scenario).best.damage).toEqual(evaluated.damage)
    expect(parameterEvidenceForBuild(value)).toContainEqual(expect.objectContaining({ parameterId: 'combo-damage', status: 'measured' }))
    expect(parameterEvidenceForBuild(value)).not.toContainEqual(expect.objectContaining({ parameterId: 'gear-power-curve' }))
  })

  it('uses existing direct modifiers and supports per-item and per-condition scores', () => {
    const value = build()
    const withArmor: Inventory = {
      ...inventory(value),
      armors: [{ instanceId: 'scale', armorId: 'scale-mail', powerLevel: 251, observedHealthBonus: 300, enchantmentSlots: [{ candidates: ['health-synergy'] }] }],
      artifacts: [{ instanceId: 'powder', artifactId: 'shock-powder', powerLevel: 250 }],
    }
    const conditions = [
      { id: 'boss', name: 'Boss', scenario },
      { id: 'crowd', name: 'Crowd', scenario: { ...scenario, averageTargetsInReach: 2 } },
    ]
    const [single, crowd] = assessEquipment(withArmor, conditions)
    expect(single).toMatchObject({ status: 'complete', equipment: expect.arrayContaining([expect.objectContaining({ instanceId: value.weapon.instanceId, status: 'evaluated', scoreGap: 0 })]) })
    if (single?.status !== 'complete') throw new Error('Single target should be computable')
    expect(single.best.damage.directWeaponSingleTargetDps).toBeCloseTo(900 / 0.9 * 1.4 * 1.3)
    expect(crowd).toMatchObject({ status: 'error', error: expect.stringContaining('UNSUPPORTED_COMBO_TARGETS') })
  })

  it('fails closed for unavailable or conflicting observation, target, speed, ordered effects and ranged', () => {
    const value = build()
    const missing = { ...value, weapon: { ...value.weapon, observedComboDamage: undefined } }
    expect(() => evaluate(missing, scenario)).toThrow('コンボ全段')
    const stale = { ...value, weapon: { ...value.weapon, powerLevel: 252 } }
    expect(() => evaluate(stale, scenario)).toThrow('現在のPower')
    const restored = deserializeInventory(serializeInventory(inventory(stale)))
    expect(inspectInventoryReadiness(restored, scenario).equipment[0]?.status).toBe('input-required')
    expect(() => optimize(restored, scenario)).toThrow('現在のPower')
    expect(() => evaluate({ ...missing, weapon: { ...missing.weapon, observedDamagePerHit: 300 } }, scenario)).toThrow()
    expect(() => evaluate({ ...value, weapon: { ...value.weapon, observedComboDamage: { powerLevel: 251, total: 0 } } }, scenario)).toThrow()
    expect(() => evaluate(value, { ...scenario, averageTargetsInReach: 2 })).toThrow('UNSUPPORTED_COMBO_TARGETS')
    expect(() => evaluate({ ...value, artifacts: [{ instanceId: 'm', artifactId: 'death-cap-mushroom', powerLevel: 251 }] }, scenario)).toThrow('速度効果')
    for (const id of ['void-strike', 'committed', 'leeching', 'shockwave', 'artifact-synergy'] as const) {
      expect(() => evaluate(build('coral-blade', id), scenario)).toThrow('不均一ヒット列')
    }
    const rangedWeapon = { instanceId: 'bow', weaponId: 'bow', powerLevel: 251, enchantmentSlots: [] }
    expect(() => evaluate({ ...value, rangedWeapon }, { ...scenario, rangedTimeShare: 0.5 })).toThrow('遠距離')
    const readiness = inspectInventoryReadiness(inventory(missing), scenario)
    expect(readiness.equipment[0]).toMatchObject({ status: 'input-required', issues: expect.arrayContaining([expect.objectContaining({ target: 'equipment' })]) })
  })

  it('preserves previous-scale builds and excludes unsupported new rolls without dropping the effects', () => {
    const value = build()
    const old = { ...value.weapon, instanceId: 'old', weaponId: 'double-axe' as const, observedComboDamage: undefined, observedDamagePerHit: 100 }
    const missing = { ...value.weapon, observedComboDamage: undefined }
    expect(optimize({ weapons: [old, missing], artifacts: [] }, scenario).best.build.weapon).toBe(old)
    const blocked = { ...value.weapon, enchantmentSlots: [{ candidates: ['void-strike'] as const }] }
    expect(optimize({ weapons: [old, blocked], artifacts: [] }, scenario).best.build.weapon).toBe(old)
    const mixedSlot = { ...value.weapon, enchantmentSlots: [{ candidates: ['void-strike', 'critical-hit'] as const }] }
    const optimized = optimize({ weapons: [mixedSlot], artifacts: [] }, scenario)
    expect(optimized.evaluatedBuildCount).toBe(1)
    expect(optimized.best.build.enchantments).toEqual(value.enchantments)
    const estimated = { ...old, observedDamagePerHit: undefined }
    const mixed = { weapons: [estimated, value.weapon], artifacts: [] }
    expect(() => optimize(mixed, scenario)).toThrow('すべての武器')
    const crowd = { ...scenario, averageTargetsInReach: 2 }
    expect(optimize(mixed, crowd).best.build.weapon).toBe(estimated)
    expect(inspectInventoryReadiness(mixed, crowd).equipment.map(({ status }) => status)).toEqual(['evaluated', 'constrained'])
    expect(inspectInventoryReadiness(mixed, scenario).equipment[0]?.status).toBe('input-required')
  })

  it('keeps excluded migrated combos outside the budget before materializing combinations', () => {
    const legacy: Inventory = {
      weapons: [{ ...build('double-axe').weapon, observedComboDamage: undefined }],
      artifacts: Array.from({ length: 12 }, (_, index) => ({ instanceId: `mushroom-${index}`, artifactId: 'death-cap-mushroom', powerLevel: 251 })),
    }
    const slots = Array.from({ length: 3 }, () => ({ candidates: ['critical-hit', 'sharpness', 'smiting'] as const }))
    const migrated = Array.from({ length: 5 }, (_, index) => ({ ...build().weapon, instanceId: `migrated-${index}`, observedComboDamage: undefined, enchantmentSlots: slots }))
    const inventory = { ...legacy, weapons: [...legacy.weapons, ...migrated] }
    expect(estimateSearchCandidates(inventory, scenario)).toBe(220)
    expect(optimize(inventory, scenario).best.damage).toEqual(optimize(legacy, scenario).best.damage)
    const ready = { ...inventory, weapons: [...legacy.weapons, ...migrated.map((item) => ({ ...item, observedComboDamage: { powerLevel: 251, total: 900 } }))] }
    expect(estimateSearchCandidates(ready, scenario)).toBe(29_920)
    expect(() => optimize(ready, scenario)).toThrow('安全上限')
  })

  it('rejects source drift in identity, raw damage, configured loops, fixed enchantments and grants', () => {
    const id = 'coral-blade'
    const mismatchedIdentity = structuredClone(identities)
    mismatchedIdentity.identityAssertions.find((row) => row.domainId === id)!.reviewState = 'pending'
    expect(observedMeleeComboIsEligible(id, { identities: mismatchedIdentity })).toBe(false)
    const changedDamage = structuredClone(values)
    changedDamage.semantic.melee[id].attacks[0]!.configuredDamage.value++
    expect(observedMeleeComboIsEligible(id, { values: changedDamage })).toBe(false)
    const changedLoop = structuredClone(values)
    changedLoop.semantic.melee[id].attacks[0]!.configuredVariantLoopAmount.value = 2
    expect(observedMeleeComboIsEligible(id, { values: changedLoop })).toBe(false)
    const source = structuredClone(OBSERVED_MELEE_COMBO_SOURCE)
    source.rows.find((row) => row.id === id)!.calculatorRow.builtIn = ['Gravity'] as never[]
    expect(observedMeleeComboIsEligible(id, { source })).toBe(false)
    expect(observedMeleeComboIsEligible(id, { approvals: { ...approvals, targets: [...approvals.targets, id] } })).toBe(false)
  })

  it.each([1, 2, 3, 4, 5, 6])('migrates v%s Catalog without manufacturing a combo observation', (version) => {
    const legacy: CatalogInventoryItem = {
      instanceId: 'legacy-coral', category: 'melee', catalogId: 'coral-blade', powerLevel: 251,
      rarity: 'rare', isFavorite: true, notes: 'synthetic',
      enchantmentSlots: [{ candidates: ['critical-hit'], selected: { enchantmentId: 'critical-hit', tier: 2 } }],
      research: { intrinsicProperties: [{ kind: 'intrinsicMechanicOwnership', raw: 'Rapid slashes' }] },
    }
    const migrated = deserializeInventory(JSON.stringify({ version, inventory: { weapons: [], artifacts: [], catalogItems: [legacy] } }))
    expect(migrated.catalogItems).toEqual([])
    const weapon = migrated.weapons[0]!
    expect(weapon).toMatchObject({ instanceId: legacy.instanceId, powerLevel: legacy.powerLevel, rarity: legacy.rarity, isFavorite: true, notes: legacy.notes, enchantmentSlots: legacy.enchantmentSlots, research: legacy.research })
    expect(weapon.observedComboDamage).toBeUndefined()
    const observed = { ...migrated, weapons: [{ ...weapon, observedComboDamage: { powerLevel: 251, total: 900 } }] }
    expect(deserializeInventory(serializeInventory(observed))).toEqual(observed)
    expect(optimize(observed, scenario).best.build.enchantments).toEqual([{ enchantmentId: 'critical-hit', tier: 2, source: 'slot' }])
    const invalid = { ...observed, weapons: [{ ...observed.weapons[0]!, research: { intrinsicProperties: [{ kind: 'unknown', raw: 'unsupported additional effect' }] } }] }
    expect(() => optimize(invalid, scenario)).toThrow('未対応固有効果')
  })
})

import { describe, expect, it } from 'vitest'
import { evaluate } from '../src/core/evaluate'
import { assessEquipment } from '../src/core/equipmentAssessment'
import { inspectInventoryReadiness, optimize } from '../src/core/optimizer'
import { isolatedChainsMeleeIsEligible } from '../src/core/isolatedChainsReuse'
import { fixedObservedMeleeComboIsEligible } from '../src/core/observedMeleeComboReuse'
import { parameterEvidenceForBuild } from '../src/core/evidenceStatus'
import { describeControl } from '../src/core/control'
import type { Build, Inventory, OwnedWeapon, Scenario } from '../src/core/types'
import { getEquipmentCatalogEntry } from '../src/data/equipmentCatalog'
import { ISOLATED_CHAINS_MELEE_COMBO_IDS, ISOLATED_CHAINS_MELEE_COMBO_SOURCE } from '../src/data/fixedObservedMeleeCombo'
import { SCENARIO_PROFILES } from '../src/data/scenarios'
import proof from '../research/native/coverage-integration-20261121/chains-dispatch-proof.json'
import { deserializeInventory, serializeInventory } from '../src/inventory/storage'
import { deserializeScenarioPresets, serializeScenarioPresets } from '../src/scenario/presets'

const scenario: Scenario = {
  ...SCENARIO_PROFILES.boss,
  enemyComposition: { undeadShare: 0, enchantedShare: 0 },
  crowdControl: { ...SCENARIO_PROFILES.boss.crowdControl,
    chainsIsolation: { encounterDurationSeconds: SCENARIO_PROFILES.boss.encounterDurationSeconds, noOtherEligibleCandidates: true, initiallyUnchained: true },
  },
}
const weapon = (weaponId: (typeof ISOLATED_CHAINS_MELEE_COMBO_IDS)[number]): OwnedWeapon => ({
  instanceId: weaponId, weaponId, powerLevel: 251, observedComboDamage: { powerLevel: 251, total: 520 }, enchantmentSlots: [{ candidates: ['unchanting'] }],
})
const inventory = (item: OwnedWeapon): Inventory => ({ weapons: [item], artifacts: [] })
const build = (item: OwnedWeapon): Build => ({ weapon: item, artifacts: [], enchantments: [
  { enchantmentId: 'unchanting', tier: 3, source: 'slot' }, { enchantmentId: 'chains', tier: 1, source: 'built-in' },
] })

describe('fixed Chains I on an initially unchained isolated target', () => {
  it.each(ISOLATED_CHAINS_MELEE_COMBO_IDS)('connects %s through evaluate, optimization and per-condition assessment', (id) => {
    expect(isolatedChainsMeleeIsEligible(id)).toBe(true)
    expect(fixedObservedMeleeComboIsEligible(id)).toBe(true)
    const item = weapon(id)
    const value = build(item)
    const result = evaluate(value, scenario)
    expect(result.damage.directWeaponSingleTargetDps).toBeCloseTo(520 / (id === 'flail' ? 1.65 : 1.04), 10)
    expect(result.control.chains).toBeUndefined()
    expect(result.control.chainsNoApplication).toEqual({ state: 'no-application-call', source: 'built-in', tier: 1, encounterDurationSeconds: scenario.encounterDurationSeconds })
    expect(result.control.rootCoverage).toBe(0)
    expect(describeControl(result.control).join(' ')).toContain('主対象への適用callなし')
    expect(result.confidence.factors.map((factor) => factor.id)).toContain('chains-no-application')
    expect(result.confidence.factors.map((factor) => factor.id)).not.toEqual(expect.arrayContaining(['enchant-chains']))
    expect(result.confidence.factors.some((factor) => factor.id.startsWith('cc-'))).toBe(false)
    expect(result.confidence.caveats.join(' ')).toContain('発動確率・持続時間・refresh式は計算に使いません')
    expect(result.confidence.caveats.join(' ')).not.toContain('Chainsは30%')
    expect(result.soulState?.baseSoulGathering ?? 0).toBe(id === 'jailors-scythe' ? 1 : 0)
    const rows = parameterEvidenceForBuild(value)
    expect(rows).toContainEqual(expect.objectContaining({ mechanicId: `melee:${id}`, parameterId: 'fixed-builtin-ownership-tier', status: 'derived' }))
    expect(rows.some((r) => r.mechanicId === 'melee-enchantment:chains')).toBe(false)
    expect(optimize(inventory(item), scenario).best.build.enchantments).toEqual(value.enchantments)
    expect(optimize(inventory(item), { ...scenario, evidencePolicy: 'high-confidence-only' }).best.control.chainsNoApplication?.state).toBe('no-application-call')
    expect(assessEquipment(inventory(item), [{ id: 'isolated', name: 'Isolated', scenario }])[0]).toMatchObject({ status: 'complete', equipment: [{ instanceId: id, status: 'evaluated', scoreGap: 0 }] })
    expect(getEquipmentCatalogEntry('melee', id)).toMatchObject({ runtimeSupport: 'limited', builtInEnchantments: [{ enchantmentId: 'chains', tier: 1 }] })
    expect(deserializeInventory(serializeInventory(inventory(item))).weapons).toEqual([item])
  })

  it.each(ISOLATED_CHAINS_MELEE_COMBO_IDS)('does not infer isolation for %s from one target or a zero eligible share', (id) => {
    const item = weapon(id)
    const unknown = { ...scenario, crowdControl: { ...scenario.crowdControl, chainsEligibleTargetShare: 0, chainsIsolation: undefined } }
    expect(() => evaluate(build(item), unknown)).toThrow('MISSING_CHAINS_ISOLATION')
    expect(inspectInventoryReadiness(inventory(item), unknown).equipment[0]).toMatchObject({ status: 'input-required', issues: expect.arrayContaining([expect.objectContaining({ target: 'scenario' })]) })
    for (const c of [
      { noOtherEligibleCandidates: true }, { initiallyUnchained: true },
      { noOtherEligibleCandidates: false, initiallyUnchained: true },
      { noOtherEligibleCandidates: true, initiallyUnchained: false },
    ]) expect(() => evaluate(build(item), { ...scenario, crowdControl: { ...scenario.crowdControl, chainsIsolation: { encounterDurationSeconds: scenario.encounterDurationSeconds, ...c } } })).toThrow('CHAINS_ISOLATION')
    expect(() => evaluate(build(item), { ...scenario, encounterDurationSeconds: scenario.encounterDurationSeconds + 1 })).toThrow('MISSING_CHAINS_ISOLATION')
    expect(() => evaluate(build(item), { ...scenario, averageTargetsInReach: 2 })).toThrow('UNSUPPORTED_COMBO_TARGETS')
  })

  it('retains valid alternatives when an isolated item cannot be evaluated in a saved condition', () => {
    const item = weapon('flail')
    const normal: OwnedWeapon = { ...item, instanceId: 'normal', weaponId: 'mace' }
    const unknown = { ...scenario, crowdControl: { ...scenario.crowdControl, chainsIsolation: undefined } }
    const result = optimize({ weapons: [item, normal], artifacts: [] }, unknown)
    expect(result.best.build.weapon.instanceId).toBe('normal')
    expect(inspectInventoryReadiness({ weapons: [item, normal], artifacts: [] }, unknown).equipment.find((r) => r.instanceId === item.instanceId)?.status).toBe('input-required')
    const scores = assessEquipment(inventory(item), [{ id: 'ok', name: 'isolated', scenario }, { id: 'unknown', name: 'unknown', scenario: unknown }])
    expect(scores[0]).toMatchObject({ status: 'complete', equipment: [{ status: 'evaluated' }] })
    expect(scores[1]).toMatchObject({ status: 'error', error: expect.stringContaining('MISSING_CHAINS_ISOLATION') })
  })

  it('keeps Jailor’s own Soul Gathering and existing Anima channel without inheriting Soul Siphon', () => {
    const item: OwnedWeapon = { ...weapon('jailors-scythe'), enchantmentSlots: [{ candidates: ['anima-conduit'] }] }
    const result = optimize(inventory(item), scenario).best
    expect(result.soulState).toMatchObject({ baseSoulGathering: 1, enchantmentSoulGathering: 1 })
    expect(result.healing.animaHealingCapacityPerSecond).toBeGreaterThan(0)
    expect(inspectInventoryReadiness(inventory({ ...item, enchantmentSlots: [{ candidates: ['soul-siphon'] }] }), scenario).equipment[0]?.status).not.toBe('evaluated')
  })

  it('uses reviewed own package images for the reversed historical ordinal pairs', () => {
    expect(getEquipmentCatalogEntry('melee', 'flail')?.icon).toBe('/assets/equipment/melee/suns-grace.webp')
    expect(getEquipmentCatalogEntry('melee', 'suns-grace')?.icon).toBe('/assets/equipment/melee/flail.webp')
    expect(getEquipmentCatalogEntry('melee', 'jailors-scythe')?.icon).toBe('/assets/equipment/melee/frost-scythe.webp')
    expect(getEquipmentCatalogEntry('melee', 'frost-scythe')?.icon).toBe('/assets/equipment/melee/jailors-scythe.webp')
  })

  it('rejects malformed saved confirmation values without coercion', () => {
    for (const value of ['true', 1, null, []]) {
      const invalid = { ...scenario, crowdControl: { ...scenario.crowdControl, chainsIsolation: { ...scenario.crowdControl.chainsIsolation, noOtherEligibleCandidates: value } } } as unknown as Scenario
      expect(() => evaluate(build(weapon('flail')), invalid)).toThrow(/CHAINS_ISOLATION|Chains孤立条件の形式/)
    }
  })

  it('rejects missing/stale observation, duplicated ownership and unsupported interactions', () => {
    const item = weapon('flail')
    const value = build(item)
    expect(() => evaluate({ ...value, weapon: { ...item, powerLevel: 252 } }, scenario)).toThrow('現在のPower')
    expect(() => evaluate({ ...value, weapon: { ...item, observedComboDamage: undefined } }, scenario)).toThrow()
    expect(() => evaluate({ ...value, enchantments: value.enchantments.slice(0, 1) }, scenario)).toThrow()
    expect(() => evaluate({ ...value, enchantments: [...value.enchantments, { enchantmentId: 'chains', tier: 1, source: 'slot' }] }, scenario)).toThrow()
    expect(inspectInventoryReadiness(inventory({ ...item, gilded: { enchantmentId: 'chains', tier: 1 } }), scenario).equipment[0]?.status).not.toBe('evaluated')
    expect(() => evaluate({ ...value, artifacts: [{ instanceId: 'speed', artifactId: 'death-cap-mushroom', powerLevel: 251 }] }, scenario)).toThrow('UNSUPPORTED_COMBO_INTERACTION')
  })

  it('fails closed on wrong ordinal identity, fixed Tier/class drift and target-owned Soul drift', () => {
    for (const raw of ['Mace_Unique1', 'SoulScythe_Unique2']) {
      const source = structuredClone(ISOLATED_CHAINS_MELEE_COMBO_SOURCE)
      source.rows[0]!.rawIdentity = raw
      expect(isolatedChainsMeleeIsEligible('flail', { source })).toBe(false)
    }
    const source = structuredClone(ISOLATED_CHAINS_MELEE_COMBO_SOURCE)
    source.rows[1]!.soul!.baseSoulGathering = 2
    expect(isolatedChainsMeleeIsEligible('jailors-scythe', { source })).toBe(false)
    const nativeProof = structuredClone(proof)
    nativeProof.fixedRecords[0]!.tier = 2
    expect(isolatedChainsMeleeIsEligible('flail', { nativeProof })).toBe(false)
    const changedClass = structuredClone(proof)
    changedClass.registry.record.tags.NativeParentClass = "Class'/Script/Dungeons.Enchantment'"
    expect(isolatedChainsMeleeIsEligible('flail', { nativeProof: changedClass })).toBe(false)
    expect(isolatedChainsMeleeIsEligible('mace')).toBe(false)
  })

  it('migrates historical catalog entries without inventing damage or isolation and round-trips saved conditions', () => {
    for (const id of ISOLATED_CHAINS_MELEE_COMBO_IDS) {
      const legacy = { instanceId: `old-${id}`, category: 'melee', catalogId: id, powerLevel: 251, isFavorite: true, notes: 'keep', enchantmentSlots: [{ candidates: ['unchanting'] }], research: { enchantments: [{ enchantmentId: 'chains', tier: 1, source: 'built-in' }] } }
      const migrated = deserializeInventory(JSON.stringify({ version: 6, inventory: { weapons: [], artifacts: [], catalogItems: [legacy] } }))
      expect(migrated.catalogItems).toEqual([])
      expect(migrated.weapons[0]).toMatchObject({ instanceId: legacy.instanceId, weaponId: id, isFavorite: true, notes: 'keep', research: legacy.research })
      expect(migrated.weapons[0]?.observedComboDamage).toBeUndefined()
      expect(inspectInventoryReadiness(migrated, scenario).equipment[0]?.status).toBe('input-required')
    }
    const old = { ...scenario, crowdControl: { ...scenario.crowdControl, chainsIsolation: undefined } }
    const restored = deserializeScenarioPresets(serializeScenarioPresets([{ id: 'new', name: 'new', scenario }, { id: 'old', name: 'old', scenario: old }]))
    expect(restored[0]?.scenario.crowdControl.chainsIsolation).toEqual(scenario.crowdControl.chainsIsolation)
    expect(restored[1]?.scenario.crowdControl.chainsIsolation).toBeUndefined()
  })
})

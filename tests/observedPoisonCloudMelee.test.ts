import { describe, expect, it } from 'vitest'
import { assessEquipment } from '../src/core/equipmentAssessment'
import { evaluate } from '../src/core/evaluate'
import { parameterEvidenceForBuild } from '../src/core/evidenceStatus'
import { fixedObservedMeleeComboIsEligible } from '../src/core/observedMeleeComboReuse'
import { inspectInventoryReadiness, optimize } from '../src/core/optimizer'
import { estimateSearchCandidates } from '../src/core/searchBudget'
import type { Build, Inventory, OwnedWeapon } from '../src/core/types'
import { getEquipmentCatalogEntry } from '../src/data/equipmentCatalog'
import { POISON_CLOUD_OBSERVED_MELEE_COMBO_SOURCE } from '../src/data/fixedObservedMeleeCombo'
import { SCENARIO_PROFILES } from '../src/data/scenarios'
import { deserializeInventory, serializeInventory } from '../src/inventory/storage'

const scenario = {
  ...SCENARIO_PROFILES.boss,
  enemyComposition: { undeadShare: 0, enchantedShare: 0 },
  persistentAreaTargeting: { poisonCloudSingleTargetResidenceSeconds: 2, poisonCloudTargetSecondsPerEvent: 2 },
}
const build = (weaponId: 'nightmares-bite' | 'venom-glaive', powerLevel = 184): Build => ({
  weapon: { instanceId: weaponId, weaponId, powerLevel, observedComboDamage: { powerLevel, total: 510 }, enchantmentSlots: [{ candidates: ['unchanting'] }] },
  artifacts: [],
  enchantments: [{ enchantmentId: 'unchanting', tier: 3, source: 'slot' }, { enchantmentId: 'poison-cloud', tier: 1, source: 'built-in' }],
})
const inventory = (weapon: OwnedWeapon): Inventory => ({ weapons: [weapon], artifacts: [] })

describe('observed complete combos with fixed Poison Cloud I', () => {
  it.each([['nightmares-bite', 6, 1.7], ['venom-glaive', 3, 2.1]] as const)('separates %s ordinary hits from fixed Poison Cloud I', (id, hits, duration) => {
    expect(fixedObservedMeleeComboIsEligible(id)).toBe(true)
    const value = build(id)
    const result = evaluate(value, scenario)
    const opportunities = hits / duration
    const poisonDps = 7559 * (1 - Math.exp(-opportunities * 0.3 * 2))
    expect(result.damage.directWeaponSingleTargetDps).toBeCloseTo(510 / duration, 10)
    expect(result.damage.dotDamageEvents).toHaveLength(1)
    expect(result.damage.dotDamageEvents[0]).toMatchObject({
      sourceId: 'poison-cloud', tier: 1, durationSeconds: 3, triggerProbability: 0.3, damagePerSecond: 7559,
      singleTargetResidenceSeconds: 2, qualifiesAsDirectWeaponKill: false,
    })
    expect(result.damage.dotDamageEvents[0]?.singleTargetDps).toBeCloseTo(poisonDps, 9)
    expect(result.contributions).toContainEqual(expect.objectContaining({ sourceId: 'poison-cloud', enchantmentSource: 'built-in' }))
    expect(result.contributions.find(({ sourceId }) => sourceId === 'poison-cloud')?.singleTargetDpsDelta).toBeCloseTo(poisonDps, 9)
    expect(optimize(inventory(value.weapon), scenario).best.build.enchantments).toEqual(value.enchantments)
    expect(getEquipmentCatalogEntry('melee', id)).toMatchObject({ runtimeSupport: 'limited', builtInEnchantments: [{ enchantmentId: 'poison-cloud', tier: 1 }] })
    expect(parameterEvidenceForBuild(value)).toContainEqual(expect.objectContaining({ parameterId: 'fixed-builtin-ownership-tier', conditions: expect.stringContaining('excludes poison ticks') }))
    expect(deserializeInventory(serializeInventory(inventory(value.weapon))).weapons).toEqual([value.weapon])
  })

  it('changes per-condition equipment scores with poison residence while preserving direct DPS', () => {
    const weapons = [build('nightmares-bite').weapon, build('venom-glaive').weapon]
    const absent = { ...scenario, persistentAreaTargeting: { poisonCloudSingleTargetResidenceSeconds: 0, poisonCloudTargetSecondsPerEvent: 0 } }
    const [active, noExposure] = assessEquipment({ weapons, artifacts: [] }, [
      { id: 'in-cloud', name: 'In cloud', scenario }, { id: 'outside', name: 'Outside', scenario: absent },
    ])
    expect(active?.status).toBe('complete')
    expect(noExposure?.status).toBe('complete')
    if (active?.status !== 'complete' || noExposure?.status !== 'complete') throw Error('Both conditions must be evaluable')
    expect(active.equipment).toHaveLength(2)
    expect(active.equipment.every(({ status }) => status === 'evaluated')).toBe(true)
    expect(active.best.damage.singleTargetDps).toBeGreaterThan(noExposure.best.damage.singleTargetDps)
    expect(active.best.damage.directWeaponSingleTargetDps).toBe(noExposure.best.damage.directWeaponSingleTargetDps)
  })

  it('keeps fixed Power constraints out of the mixed candidate search', () => {
    const unsupported = build('nightmares-bite', 252)
    const legal = build('venom-glaive', 251)
    expect(() => evaluate(unsupported, scenario)).toThrow('UNSUPPORTED_COMBO_POWER')
    expect(evaluate(legal, scenario).damage.dotDamageEvents[0]?.damagePerSecond).toBe(113598)
    const mixed = { weapons: [{ ...unsupported.weapon, observedComboDamage: undefined }, legal.weapon], artifacts: [] }
    expect(estimateSearchCandidates(mixed)).toBe(1)
    expect(optimize(mixed, scenario).best.build.weapon).toEqual(legal.weapon)
    expect(inspectInventoryReadiness(mixed, scenario).equipment).toMatchObject([
      { instanceId: 'nightmares-bite', status: 'unsupported', issues: [{ message: expect.stringContaining('184–251') }] },
      { instanceId: 'venom-glaive', status: 'evaluated' },
    ])
  })

  it('rejects incomplete, duplicated, altered and out-of-scope effect sources', () => {
    const value = build('venom-glaive')
    expect(() => evaluate({ ...value, weapon: { ...value.weapon, powerLevel: 185 } }, scenario)).toThrow('現在のPower')
    expect(() => evaluate({ ...value, enchantments: value.enchantments.slice(0, 1) }, scenario)).toThrow()
    expect(() => evaluate(value, { ...scenario, averageTargetsInReach: 2 })).toThrow('UNSUPPORTED_COMBO_TARGETS')
    expect(inspectInventoryReadiness(inventory({ ...value.weapon, gilded: { enchantmentId: 'poison-cloud', tier: 2 } }), scenario).equipment[0]?.status).toBe('unsupported')
    const source = structuredClone(POISON_CLOUD_OBSERVED_MELEE_COMBO_SOURCE)
    source.rows[1]!.fixed.triggerChance = 0.4
    expect(fixedObservedMeleeComboIsEligible('venom-glaive', { poisonCloudSource: source })).toBe(false)
    expect(getEquipmentCatalogEntry('ranged', 'the-green-menace')?.runtimeSupport).toBe('unsupported')
  })

  it('keeps the overlap assumption estimated and outside high-confidence recommendations', () => {
    const value = build('venom-glaive')
    expect(parameterEvidenceForBuild(value)).toContainEqual(expect.objectContaining({ parameterId: 'poison-cloud-overlap-model', status: 'estimated' }))
    const strict = { ...scenario, evidencePolicy: 'high-confidence-only' as const }
    expect(inspectInventoryReadiness(inventory(value.weapon), strict).equipment[0]).toMatchObject({
      status: 'constrained', issues: [expect.objectContaining({ message: expect.stringContaining('poison-cloud-overlap-model:estimated') })],
    })
  })
})

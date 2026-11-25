import { describe, expect, it } from 'vitest'
import { distinctRecommendations } from '../src/core/distinctRecommendations'
import { assessEquipment, summarizeMultiConditionBestScores } from '../src/core/equipmentAssessment'
import { optimize, optimizeForEquipment } from '../src/core/optimizer'
import { estimateSearchCandidates } from '../src/core/searchBudget'
import type { Inventory, Scenario } from '../src/core/types'
import { DEFAULT_SCENARIO } from '../src/data/scenarios'
import { deserializeScenarioPresets, serializeScenarioPresets } from '../src/scenario/presets'
import { PERFORMANCE_SCENARIO, performanceInventory } from './performanceFixtures'

const ranged = {
  instanceId: 'bow', weaponId: 'bow', enchantmentSlots: [], powerLevel: 251,
  observation: { gameVersion: '1.17.0.0', mode: 'uncharged', projectileDamage: 1_000, shotCycleSeconds: 1, availableAmmo: 1, sourceNote: 'Synthetic application fixture' },
} as const
const inventory: Inventory = {
  weapons: [{ instanceId: 'axe', weaponId: 'double-axe', powerLevel: 251, observedDamagePerHit: 100, enchantmentSlots: [{ candidates: ['critical-hit'] }] }],
  rangedWeapons: [ranged],
  artifacts: [],
}
const scenario: Scenario = {
  ...DEFAULT_SCENARIO, rangedTimeShare: 0.8, averageTargetsInReach: 1, encounterDurationSeconds: 20,
  weights: { damage: 1, defense: 0, healing: 0, control: 0 },
}

describe('Ranged time allocations', () => {
  it('recommends the shorter reservation when both use the same stock, and reports each candidate with its own allocation', () => {
    const short = optimize(inventory, { ...scenario, rangedTimeShare: 0.2 }).best
    const long = optimize(inventory, scenario).best
    const both = { ...scenario, rangedTimeShareAlternatives: [0.2] }
    const result = optimizeForEquipment(inventory, both)
    expect(result.result.best).toEqual(short)
    expect(result.bestByInstance.get('bow')).toEqual(short)
    expect(result.result.alternatives).toEqual([long])
    expect(result.result.best.damage.ranged).toMatchObject({ timeShare: 0.2, ammoConsumed: 1, ammoLimited: true })
    expect(result.result.evaluatedBuildCount).toBe(2)
    expect(short.damage.directWeaponSingleTargetDps).toBeGreaterThan(long.damage.directWeaponSingleTargetDps)
    expect(optimize(inventory, { ...scenario, rangedTimeShareAlternatives: [] }).best).toEqual(long)

    const stocked = { ...ranged, observation: { ...ranged.observation, availableAmmo: 20 } }
    expect(optimize({ ...inventory, rangedWeapons: [stocked] }, both).best.damage.ranged).toMatchObject({ timeShare: 0.8, ammoConsumed: 16 })
  })

  it('retains different allocations even if all ranking and other numeric comparison metrics tie', () => {
    const noShots = { ...ranged, observation: { ...ranged.observation, shotCycleSeconds: 100 } }
    const source = { ...inventory, rangedWeapons: [noShots] }
    const result = optimize(source, { ...scenario, rangedTimeShareAlternatives: [0.20002], rangedTimeShare: 0.2, weights: { damage: 0, defense: 1, healing: 0, control: 0 } })
    expect(result.best.objectiveScore).toBe(result.alternatives[0]?.objectiveScore)
    expect(result.best.damage.ranged?.timeShare).toBe(0.2)
    expect(result.alternatives[0]?.damage.ranged?.timeShare).toBe(0.20002)
    const alternateShareWithIdenticalMetrics = { ...result.best, damage: {
      ...result.best.damage, ranged: { ...result.best.damage.ranged!, timeShare: 0.20002 },
    } }
    expect(distinctRecommendations([result.best, alternateShareWithIdenticalMetrics])).toHaveLength(2)
  })

  it('counts no-Ranged candidates once and accepts explicit alternatives with an unset primary share', () => {
    const combined = { ...scenario, rangedTimeShare: undefined, rangedTimeShareAlternatives: [0.2, 0.4], includeBuildsWithoutRanged: true }
    expect(estimateSearchCandidates(inventory, combined)).toBe(3)
    const result = optimize(inventory, combined)
    expect(result.evaluatedBuildCount).toBe(3)
    expect([result.best, ...result.alternatives].flatMap(({ damage }) => damage.ranged ? [damage.ranged.timeShare] : []).sort()).toEqual([0.2, 0.4])
    expect(estimateSearchCandidates({ ...inventory, rangedWeapons: [] }, combined)).toBe(1)
    expect(optimize({ ...inventory, rangedWeapons: [] }, combined).evaluatedBuildCount).toBe(1)

    const missingObservation = { ...inventory, rangedWeapons: [{ ...ranged, observation: undefined }] }
    expect(() => optimize(missingObservation, { ...combined, includeBuildsWithoutRanged: false })).toThrow('No supported Ranged candidates')
    expect(optimize(missingObservation, combined).best.damage.ranged).toBeUndefined()
  })

  it('applies the candidate limit independently to each saved condition', () => {
    const source = performanceInventory('large')
    const crowded = { ...PERFORMANCE_SCENARIO, rangedTimeShareAlternatives: [0.1, 0.3, 0.4] }
    expect(estimateSearchCandidates(source, crowded)).toBe(27_648)
    const [over, legacy] = assessEquipment(source, [
      { id: 'several', name: 'Several', scenario: crowded },
      { id: 'legacy', name: 'Legacy', scenario: PERFORMANCE_SCENARIO },
    ])
    expect(over).toMatchObject({ status: 'error', error: expect.stringContaining('27,648') })
    expect(legacy).toMatchObject({ status: 'complete', evaluatedBuildCount: 6912 })
  })

  it('preserves saved allocations, rejects invalid numbers and deduplicates an empty list with the legacy setting', () => {
    const valid = [
      { id: 'legacy', name: 'Legacy', scenario },
      { id: 'empty', name: 'Empty', scenario: { ...scenario, rangedTimeShareAlternatives: [] } },
      { id: 'allocations', name: 'Several', scenario: { ...scenario, rangedTimeShareAlternatives: [0.2, 0.4] } },
    ]
    expect(deserializeScenarioPresets(serializeScenarioPresets(valid))).toEqual(valid)
    expect(summarizeMultiConditionBestScores(assessEquipment(inventory, valid)).distinctCompletedConditionCount).toBe(2)
    for (const shares of [[0], [1], [NaN], [0.8], [0.2, 0.2], [null], '0.2']) {
      expect(() => deserializeScenarioPresets(JSON.stringify({ version: 1, presets: [
        { id: 'invalid', name: 'Invalid', scenario: { ...scenario, rangedTimeShareAlternatives: shares } },
      ] }))).toThrow('現在のOptimizerで使える条件ではありません')
    }
  })
})

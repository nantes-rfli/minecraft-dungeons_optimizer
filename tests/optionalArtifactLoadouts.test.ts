import { describe, expect, it, vi } from 'vitest'
import * as catalog from '../src/core/catalog'
import { assessEquipment, summarizeMultiConditionBestScores } from '../src/core/equipmentAssessment'
import { inspectInventoryReadiness, optimizeForEquipment, optimizeWithMetadata } from '../src/core/optimizer'
import { estimateSearchCandidates } from '../src/core/searchBudget'
import { compareTrialAcrossConditions } from '../src/core/trialConditionComparison'
import type { OwnedArtifact, OwnedWeapon, Scenario, WeaponId } from '../src/core/types'
import { DEFAULT_SCENARIO } from '../src/data/scenarios'
import { deserializeScenarioPresets, serializeScenarioPresets } from '../src/scenario/presets'
import { PERFORMANCE_SCENARIO, performanceInventory } from './performanceFixtures'

const scenario: Scenario = { ...DEFAULT_SCENARIO, averageTargetsInReach: 1 }
const expanded = { ...scenario, includeUnequippedArtifacts: true }
const weapon = (weaponId: WeaponId): OwnedWeapon => ({ instanceId: weaponId, weaponId, powerLevel: 251, enchantmentSlots: [{ candidates: ['critical-hit'] }] })
const artifact = (instanceId: string, artifactId: OwnedArtifact['artifactId'], powerLevel = 251): OwnedArtifact => ({ instanceId, artifactId, powerLevel })
const amulet = artifact('amulet', 'iron-hide-amulet')
const mushroom = artifact('mushroom', 'death-cap-mushroom')
const axe = weapon('double-axe')

describe('optional Artifact loadouts', () => {
  it('counts every subset before filtering while preserving the legacy search estimate', () => {
    const legacyCounts = [1, 1, 1, 1, 4, 10]
    const expandedCounts = [1, 2, 4, 8, 15, 26]
    for (const [count, expected] of expandedCounts.entries()) {
      const inventory = { weapons: [axe], artifacts: Array.from({ length: count }, (_, index) => ({ ...amulet, instanceId: `a${index}` })) }
      expect(estimateSearchCandidates(inventory)).toBe(legacyCounts[count])
      expect(estimateSearchCandidates(inventory, expanded)).toBe(expected)
      expect(optimizeWithMetadata(inventory, expanded).result.evaluatedBuildCount).toBe(expected)
    }
  })

  it('recovers all seven base-cadence weapons without altering their guards or required effects', () => {
    const weapons = (['cutlass', 'pickaxe', 'soul-knife', 'whip', 'great-hammer', 'whirlwind', 'stormlander'] as const).map(weapon)
    const inventory = { weapons, artifacts: [mushroom, amulet] }
    const before = structuredClone(inventory)
    expect(() => optimizeForEquipment(inventory, scenario)).toThrow('No supported Melee candidates')
    const { result, bestByInstance } = optimizeForEquipment(inventory, expanded)
    expect(result.evaluatedBuildCount).toBe(14)
    for (const item of weapons) {
      expect(bestByInstance.get(item.instanceId)?.build.artifacts.map(({ instanceId }) => instanceId)).toEqual(['amulet'])
    }
    expect(bestByInstance.has(mushroom.instanceId)).toBe(false)
    expect(bestByInstance.get('whirlwind')?.build.enchantments).toContainEqual({ enchantmentId: 'shockwave', tier: 1, source: 'built-in' })
    expect(bestByInstance.get('stormlander')?.build.enchantments).toContainEqual({ enchantmentId: 'thundering', tier: 1, source: 'built-in' })
    expect(() => optimizeForEquipment(inventory, { ...expanded, averageTargetsInReach: 2 })).toThrow('No supported Melee candidates')
    expect(inventory).toEqual(before)
  })

  it('skips only range and copy violations, and credits the successfully evaluated individuals', () => {
    const powder1 = artifact('powder1', 'shock-powder')
    const powder2 = artifact('powder2', 'shock-powder')
    const outside = artifact('outside', 'shock-powder', 263)
    const inventory = { weapons: [axe], artifacts: [powder1, powder2, outside] }
    expect(() => optimizeWithMetadata(inventory, scenario)).toThrow()
    const { result, evaluatedInstanceIds } = optimizeWithMetadata(inventory, expanded)
    expect(result.evaluatedBuildCount).toBe(3)
    expect(evaluatedInstanceIds).toEqual(['double-axe', 'powder1', 'powder2'])
    expect(result.unsupportedChoices).toEqual(expect.arrayContaining([
      expect.stringMatching(/^outside: .*extrapolation/),
      expect.stringMatching(/^powder1: .*shock-powder\/stacking-interaction:unclassified/),
      expect.stringMatching(/^powder2: .*shock-powder\/stacking-interaction:unclassified/),
    ]))
    const readiness = inspectInventoryReadiness(inventory, expanded)
    expect(readiness.equipment.map(({ status }) => status)).toEqual(['evaluated', 'evaluated', 'evaluated', 'unsupported'])
    expect(readiness.error).toBeUndefined()
    expect(() => optimizeWithMetadata({ ...inventory, artifacts: [{ ...powder1, powerLevel: 0 }] }, expanded)).toThrow()
  })

  it('propagates an unexpected artifact model failure instead of treating it as an empty slot', () => {
    const spy = vi.spyOn(catalog, 'getArtifactDefinition').mockImplementationOnce(() => { throw new Error('broken artifact model') })
    try {
      expect(() => optimizeWithMetadata({ weapons: [axe], artifacts: [amulet] }, expanded)).toThrow('broken artifact model')
    } finally {
      spy.mockRestore()
    }
  })

  it('preserves legacy outputs and leads score ties with the existing full-sized build', () => {
    const inventory = { weapons: [axe], artifacts: [amulet] }
    const damage = { ...scenario, weights: { damage: 1, defense: 0, healing: 0, control: 0 } }
    const legacy = optimizeWithMetadata(inventory, damage)
    expect(optimizeWithMetadata(inventory, { ...damage, includeUnequippedArtifacts: false })).toEqual(legacy)
    const optional = optimizeWithMetadata(inventory, { ...damage, includeUnequippedArtifacts: true })
    expect(optional.result.best).toEqual(legacy.result.best)
    expect(optional.result.alternatives[0]?.build.artifacts).toEqual([])
  })

  it('isolates per-condition budgets in equipment assessment', () => {
    const inventory = performanceInventory('large')
    const optional = { ...PERFORMANCE_SCENARIO, includeUnequippedArtifacts: true }
    expect(estimateSearchCandidates(inventory, PERFORMANCE_SCENARIO)).toBe(6_912)
    expect(estimateSearchCandidates(inventory, optional)).toBe(55_296)
    const assessments = assessEquipment(inventory, [
      { id: 'expanded', name: 'Expanded', scenario: optional },
      { id: 'legacy', name: 'Legacy', scenario: PERFORMANCE_SCENARIO },
    ])
    expect(assessments[0]).toMatchObject({ status: 'error', error: expect.stringContaining('55,296') })
    expect(assessments[1]).toMatchObject({ status: 'complete', evaluatedBuildCount: 6_912 })
  }, 60_000)

  it('bounds subset preparation even when a direct Core input has an empty Armor slot', () => {
    const inventory = {
      weapons: [axe],
      artifacts: Array.from({ length: 54 }, (_, index) => ({ ...amulet, instanceId: `a${index}` })),
      armors: [{ instanceId: 'empty-armor', armorId: 'battle-robe', powerLevel: 251, observedHealthBonus: 100, enchantmentSlots: [{ candidates: [] }] }],
    }
    expect(estimateSearchCandidates(inventory, expanded)).toBe(26_290)
    expect(() => optimizeWithMetadata(inventory, expanded)).toThrow(expect.objectContaining({ code: 'SEARCH_LIMIT_EXCEEDED' }))
  })

  it('applies each saved condition to both baseline and staged drop searches', () => {
    const baseline = { weapons: [axe], artifacts: [mushroom] }
    const drop = weapon('whirlwind')
    const trial = { ...baseline, weapons: [...baseline.weapons, drop] }
    const [legacy, optional] = compareTrialAcrossConditions(baseline, trial, drop.instanceId, [
      { id: 'legacy', name: 'Legacy', scenario },
      { id: 'expanded', name: 'Expanded', scenario: expanded },
    ])
    expect(legacy).toMatchObject({ status: 'complete', candidate: { status: 'excluded' } })
    expect(optional).toMatchObject({ status: 'complete', candidate: { status: 'evaluated', best: { build: { artifacts: [], weapon: drop } } } })
    expect(optional?.status === 'complete' && optional.baselineBest).toEqual(optimizeWithMetadata(baseline, expanded).result.best)
  })

  it('round-trips through saved conditions, rejects a non-boolean and deduplicates false and omitted', () => {
    const presets = [
      { id: 'legacy', name: 'Legacy', scenario },
      { id: 'explicit-false', name: 'Explicit false', scenario: { ...scenario, includeUnequippedArtifacts: false } },
      { id: 'expanded', name: 'Expanded', scenario: expanded },
    ]
    const parsed = deserializeScenarioPresets(serializeScenarioPresets(presets))
    expect(parsed).toEqual(presets)
    const assessments = assessEquipment({ weapons: [axe], artifacts: [amulet] }, parsed)
    expect(summarizeMultiConditionBestScores(assessments).distinctCompletedConditionCount).toBe(2)
    const invalid = { ...scenario, includeUnequippedArtifacts: 'true' }
    expect(() => deserializeScenarioPresets(JSON.stringify({ version: 1, presets: [{ id: 'invalid', name: 'Invalid', scenario: invalid }] }))).toThrow('現在のOptimizerで使える条件ではありません')
  })
})

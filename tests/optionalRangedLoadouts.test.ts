import { describe, expect, it } from 'vitest'
import { assessEquipment, summarizeMultiConditionBestScores } from '../src/core/equipmentAssessment'
import { compareRemovalAcrossConditions } from '../src/core/inventoryRemovalComparison'
import { inspectInventoryReadiness, optimizeForEquipment, optimizeWithMetadata } from '../src/core/optimizer'
import { estimateSearchCandidates } from '../src/core/searchBudget'
import { compareTrialAcrossConditions } from '../src/core/trialConditionComparison'
import type { OwnedRangedWeapon } from '../src/core/rangedTypes'
import type { Inventory, OwnedWeapon, Scenario } from '../src/core/types'
import { OBSERVED_MELEE_COMBO_WEAPONS } from '../src/data/observedMeleeCombo'
import { DEFAULT_SCENARIO } from '../src/data/scenarios'
import { deserializeScenarioPresets, serializeScenarioPresets } from '../src/scenario/presets'

const condition: Scenario = { ...DEFAULT_SCENARIO, averageTargetsInReach: 1, rangedTimeShare: 0.5 }
const optional = { ...condition, includeBuildsWithoutRanged: true }
const axe: OwnedWeapon = { instanceId: 'axe', weaponId: 'double-axe', powerLevel: 251, observedDamagePerHit: 100, enchantmentSlots: [{ candidates: ['critical-hit'] }] }
const bow: OwnedRangedWeapon = {
  instanceId: 'bow', weaponId: 'bow', powerLevel: 251, enchantmentSlots: [],
  observation: { gameVersion: '1.17.0.0', mode: 'uncharged', projectileDamage: 100, shotCycleSeconds: 1, availableAmmo: 0, sourceNote: 'Synthetic application fixture' },
}
const inventory: Inventory = { weapons: [axe], rangedWeapons: [bow], artifacts: [] }

describe('optional Ranged loadouts', () => {
  it('compares a no-Ranged candidate at full melee cadence even when the observed arrow stock is zero', () => {
    const damage = { ...condition, weights: { damage: 1, defense: 0, healing: 0, control: 0 } }
    const legacy = optimizeWithMetadata(inventory, damage)
    expect(optimizeWithMetadata(inventory, { ...damage, includeBuildsWithoutRanged: false })).toEqual(legacy)

    const result = optimizeWithMetadata(inventory, { ...damage, includeBuildsWithoutRanged: true })
    const meleeOnly = optimizeWithMetadata({ ...inventory, rangedWeapons: [] }, damage).result.best
    expect(result.result.best).toEqual(meleeOnly)
    expect(result.result.alternatives).toEqual([legacy.result.best])
    expect(result.result.alternatives[0]?.damage.ranged?.ammoConsumed).toBe(0)
    expect(result.evaluatedInstanceIds).toEqual(['axe', 'bow'])
    expect(result.result.evaluatedBuildCount).toBe(2)

    const strongBow = { ...bow, observation: { ...bow.observation!, availableAmmo: 30, projectileDamage: 5_000 } }
    expect(optimizeForEquipment({ ...inventory, rangedWeapons: [strongBow] }, { ...damage, includeBuildsWithoutRanged: true }).result.best.build.rangedWeapon).toEqual(strongBow)

    const defense = { ...optional, weights: { damage: 0, defense: 1, healing: 0, control: 0 } }
    expect(optimizeForEquipment(inventory, defense).result.best.build.rangedWeapon).toEqual(bow)
  })

  it('recovers the complete observed-combo family without accepting any ranged interaction', () => {
    const isolated = {
      ...optional,
      crowdControl: {
        ...optional.crowdControl,
        chainsIsolation: { encounterDurationSeconds: optional.encounterDurationSeconds, noOtherEligibleCandidates: true, initiallyUnchained: true },
      },
    }
    const weapons: OwnedWeapon[] = Object.values(OBSERVED_MELEE_COMBO_WEAPONS).map(({ id }) => ({
      instanceId: id, weaponId: id, powerLevel: 251, enchantmentSlots: [{ candidates: ['unchanting'] }],
      observedComboDamage: { powerLevel: 251, total: 500 },
      ...(id === 'suns-grace' ? { observedFixedRadiance: { powerLevel: 251, healPerProc: 50 } } : {}),
    }))
    const source = { ...inventory, weapons }
    expect(() => optimizeForEquipment(source, { ...isolated, includeBuildsWithoutRanged: false })).toThrow('No supported Ranged candidates')
    const noRanged = optimizeForEquipment({ ...source, rangedWeapons: [] }, isolated)
    const result = optimizeForEquipment(source, isolated)
    expect(result.bestByInstance).toEqual(noRanged.bestByInstance)
    expect(result.bestByInstance.size).toBe(weapons.length)
    expect(result.result.evaluatedBuildCount).toBe(weapons.length)
    expect(result.result.unsupportedChoices).toEqual([expect.stringMatching(/^bow: .*完全コンボ/)])
  })

  it('retains input and support exclusions and never reports omitted Ranged equipment as evaluated', () => {
    const missing = { ...bow, instanceId: 'missing', observation: undefined }
    const unsupported = { ...bow, instanceId: 'unsupported', observation: { ...bow.observation!, arrowsConsumedPerShot: 2 } }
    const source = { ...inventory, rangedWeapons: [bow, missing, unsupported] }
    const noTiming = { ...optional, rangedTimeShare: undefined }
    expect(() => optimizeWithMetadata(source, { ...condition, rangedTimeShare: undefined })).toThrow('No supported Ranged candidates')
    expect(optimizeWithMetadata(source, noTiming).evaluatedInstanceIds).toEqual(['axe'])
    const readiness = inspectInventoryReadiness(source, noTiming)
    expect(readiness.error).toBeUndefined()
    expect(readiness.equipment.map(({ status }) => status)).toEqual(['evaluated', 'constrained', 'input-required', 'unsupported'])
    expect(optimizeWithMetadata(source, optional, 'unsupported').equipmentEvaluation).toBeUndefined()
    expect(() => optimizeWithMetadata({ ...inventory, rangedWeapons: [{ ...bow, powerLevel: 0 }] }, optional)).toThrow('powerLevel')
    expect(() => optimizeWithMetadata(inventory, { ...optional, rangedTimeShare: NaN })).toThrow('rangedTimeShare')
  })

  it('adds one candidate per base build and preserves per-condition budget isolation', () => {
    const rangedWeapons = [{ ...bow, enchantmentSlots: [{ candidates: ['power', 'unchanting'] }] }, { ...bow, instanceId: 'other' }]
    const source = { ...inventory, rangedWeapons, artifacts: [{ instanceId: 'amulet', artifactId: 'iron-hide-amulet' as const, powerLevel: 251 }] }
    expect(estimateSearchCandidates(source, condition)).toBe(3)
    expect(estimateSearchCandidates(source, optional)).toBe(4)
    const bothOptional = { ...optional, includeUnequippedArtifacts: true }
    expect(estimateSearchCandidates(source, bothOptional)).toBe(8)
    expect(optimizeWithMetadata(source, bothOptional).result.evaluatedBuildCount).toBe(8)
    expect(estimateSearchCandidates({ ...source, rangedWeapons: [] }, bothOptional)).toBe(2)

    const nearLimit = {
      ...inventory,
      weapons: Array.from({ length: 25 }, (_, index) => ({ ...axe, instanceId: `melee-${index}` })),
      rangedWeapons: [bow, ...Array.from({ length: 37 }, (_, index) => ({
        ...bow,
        instanceId: `unobserved-${index}`,
        observation: undefined,
        enchantmentSlots: Array.from({ length: 3 }, () => ({ candidates: ['power', 'critical-hit', 'unchanting'] })),
      }))],
    }
    expect(estimateSearchCandidates(nearLimit, condition)).toBe(25_000)
    expect(estimateSearchCandidates(nearLimit, optional)).toBe(25_025)
    const assessments = assessEquipment(nearLimit, [
      { id: 'optional', name: 'Optional', scenario: optional },
      { id: 'ordinary', name: 'Ordinary', scenario: condition },
    ])
    expect(assessments[0]).toMatchObject({ status: 'error', error: expect.stringContaining('25,025') })
    expect(assessments[1]).toMatchObject({ status: 'complete', evaluatedBuildCount: 25 })
  })

  it('round-trips the opt-in and uses each saved condition for drop and removal decisions', () => {
    const scenarios = [
      { id: 'ordinary', name: 'Ordinary', scenario: condition },
      { id: 'false', name: 'Disabled', scenario: { ...condition, includeBuildsWithoutRanged: false } },
      { id: 'optional', name: 'Optional', scenario: optional },
    ]
    expect(deserializeScenarioPresets(serializeScenarioPresets(scenarios))).toEqual(scenarios)
    const assessment = assessEquipment(inventory, scenarios)
    expect(summarizeMultiConditionBestScores(assessment).distinctCompletedConditionCount).toBe(2)
    const invalid = { ...optional, includeBuildsWithoutRanged: 'true' }
    expect(() => deserializeScenarioPresets(JSON.stringify({ version: 1, presets: [{ id: 'invalid', name: 'Invalid', scenario: invalid }] }))).toThrow('現在のOptimizerで使える条件ではありません')

    const alone = { ...inventory, rangedWeapons: [] }
    const comparisons = compareTrialAcrossConditions(alone, inventory, bow.instanceId, [scenarios[0]!, scenarios[2]!])
    expect(comparisons[0]).toMatchObject({ status: 'complete', withCandidateBest: { build: { rangedWeapon: bow } } })
    expect(comparisons[1]).toMatchObject({ status: 'complete', withCandidateBest: optimizeForEquipment(alone, optional).result.best, candidate: { status: 'evaluated', best: { build: { rangedWeapon: bow } } } })

    const best = optimizeForEquipment(inventory, optional).result.best
    const [removal] = compareRemovalAcrossConditions(inventory, bow.instanceId, [scenarios[2]!], [
      { conditionId: 'optional', status: 'complete', best, target: { status: 'evaluated' } },
    ])
    expect(removal).toMatchObject({ status: 'complete', baselineBestUsesInstance: false, afterRemovalBest: best })
  })
})

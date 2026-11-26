import { describe, expect, it } from 'vitest'
import { assertSearchBudget, estimateSearchCandidates, SEARCH_MAX_CANDIDATES } from '../src/core/searchBudget'
import { optimize } from '../src/core/optimizer'
import { assessEquipment } from '../src/core/equipmentAssessment'
import { DEFAULT_SCENARIO } from '../src/data/scenarios'
import type { Inventory } from '../src/core/types'

const inventory: Inventory = { weapons: [{ instanceId: 'w', weaponId: 'double-axe', powerLevel: 251, enchantmentSlots: [{ candidates: ['critical-hit', 'radiance'] }] }], artifacts: [] }
describe('search budget', () => {
  it('counts optional equipment, locks, candidate slots and unordered artifact triples', () => {
    expect(estimateSearchCandidates(inventory)).toBe(2)
    const input: Inventory = { ...inventory, weapons: [{ ...inventory.weapons[0]!, enchantmentSlots: [{ candidates: ['critical-hit', 'radiance'], selected: { enchantmentId: 'critical-hit', tier: 3 as const } }] }], artifacts: Array.from({ length: 4 }, (_, i) => ({ instanceId: `a${i}`, artifactId: 'death-cap-mushroom', powerLevel: 251 })) }
    expect(estimateSearchCandidates(input)).toBe(4)
    expect(optimize(input, DEFAULT_SCENARIO).evaluatedBuildCount).toBe(4)
  })
  it('rejects excessive exploration before materializing candidate builds', () => {
    const huge: Inventory = { ...inventory, artifacts: Array.from({ length: 100 }, (_, i) => ({ instanceId: `a${i}`, artifactId: 'death-cap-mushroom', powerLevel: 251 })) }
    expect(estimateSearchCandidates(huge)).toBeGreaterThan(SEARCH_MAX_CANDIDATES)
    expect(() => assertSearchBudget(huge)).toThrow('探索は実行していません')
    expect(() => optimize(huge, DEFAULT_SCENARIO)).toThrow('安全上限')
  })

  it('budgets the Artifacts admitted by the current policy and searches valid saved conditions independently', () => {
    const large: Inventory = {
      ...inventory,
      artifacts: Array.from({ length: 55 }, (_, index) => ({ instanceId: `mushroom-${index}`, artifactId: 'death-cap-mushroom', powerLevel: 251 })),
    }
    const strict = { ...DEFAULT_SCENARIO, evidencePolicy: 'high-confidence-only' as const }
    expect(estimateSearchCandidates(large, DEFAULT_SCENARIO)).toBe(52_470)
    expect(() => optimize(large, DEFAULT_SCENARIO)).toThrow('安全上限')
    expect(estimateSearchCandidates(large, strict)).toBe(2)
    expect(estimateSearchCandidates(large, { ...strict, includeUnequippedArtifacts: true })).toBe(2)
    const result = optimize(large, strict)
    expect(result.best.build.artifacts).toEqual([])
    expect(result.evaluatedBuildCount).toBe(2)
    expect(result.unsupportedChoices).toHaveLength(55)

    const [ordinary, highConfidence] = assessEquipment(large, [
      { id: 'ordinary', name: '通常条件', scenario: DEFAULT_SCENARIO },
      { id: 'strict', name: '高確度のみ', scenario: strict },
    ], true)
    expect(ordinary).toMatchObject({ status: 'error', error: expect.stringContaining('安全上限') })
    expect(highConfidence).toMatchObject({ status: 'complete', evaluatedBuildCount: 2, best: result.best })
    expect(large.artifacts).toHaveLength(55)
  })

  it('ignores only the range exclusions already used in optional Artifact searches', () => {
    const eligible = { instanceId: 'in-range', artifactId: 'shock-powder', powerLevel: 251 } as const
    const large: Inventory = {
      ...inventory,
      artifacts: [eligible, ...Array.from({ length: 55 }, (_, index) => ({ ...eligible, instanceId: `out-of-range-${index}`, powerLevel: index % 2 === 0 ? 1 : 263 }))],
    }
    const optional = { ...DEFAULT_SCENARIO, includeUnequippedArtifacts: true }
    expect(estimateSearchCandidates(large, DEFAULT_SCENARIO)).toBe(55_440)
    expect(() => optimize(large, DEFAULT_SCENARIO)).toThrow('安全上限')
    expect(estimateSearchCandidates(large, optional)).toBe(4)
    const result = optimize(large, optional)
    expect(result.evaluatedBuildCount).toBe(4)
    expect(result.unsupportedChoices).toHaveLength(55)
    expect(new Set([result.best, ...result.alternatives].flatMap(({ build }) =>
      build.artifacts.map((artifact) => artifact.instanceId)))).toEqual(new Set([eligible.instanceId]))

    const invalid: Inventory = { ...inventory, artifacts: [{ ...eligible, powerLevel: 0 }] }
    expect(estimateSearchCandidates(invalid, optional)).toBe(4)
    expect(() => optimize(invalid, optional)).toThrow()
    expect(large.artifacts).toHaveLength(56)
  })
})

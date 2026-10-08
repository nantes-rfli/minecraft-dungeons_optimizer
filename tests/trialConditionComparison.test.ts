import { describe, expect, it } from 'vitest'
import { compareTrialAcrossConditions } from '../src/core/trialConditionComparison'
import { optimize } from '../src/core/optimizer'
import { DEFAULT_SCENARIO } from '../src/data/scenarios'
import type { Inventory, Scenario } from '../src/core/types'

const inventory: Inventory = {
  weapons: [
    { instanceId: 'damage', weaponId: 'fighters-bindings', powerLevel: 251, observedDamagePerHit: 10, enchantmentSlots: [{ candidates: ['critical-hit'] }] },
    { instanceId: 'healing', weaponId: 'fighters-bindings', powerLevel: 251, observedDamagePerHit: 10, enchantmentSlots: [{ candidates: ['radiance'] }] },
  ],
  artifacts: [],
}
const damage: Scenario = { ...DEFAULT_SCENARIO, averageEnemyHealth: 1000, enemySupplyPerSecond: 1, weights: { damage: 1, healing: 0, defense: 0, control: 0 } }
const healing: Scenario = { ...damage, weights: { damage: 0, healing: 1, defense: 0, control: 0 } }
const conditions = [
  { id: 'damage', name: '火力用', scenario: damage },
  { id: 'healing', name: '回復用', scenario: healing },
]

describe('staged equipment comparison across saved conditions', () => {
  it('compares before and after per condition and exposes the candidate-constrained build', () => {
    const candidateInventory: Inventory = {
      ...inventory,
      weapons: [...inventory.weapons, { ...inventory.weapons[0]!, instanceId: 'new-drop', observedDamagePerHit: 50 }],
    }
    const original = JSON.stringify({ inventory, candidateInventory, conditions })
    const results = compareTrialAcrossConditions(inventory, candidateInventory, 'new-drop', conditions)

    expect(results).toHaveLength(2)
    for (const result of results) {
      if (result.status !== 'complete') throw new Error(result.error)
      expect(result.baselineBest).toEqual(optimize(inventory, result.condition.scenario).best)
      expect(result.withCandidateBest).toEqual(optimize(candidateInventory, result.condition.scenario).best)
      expect(result.candidate.status).toBe('evaluated')
      if (result.candidate.status === 'evaluated') {
        expect(result.candidate.best.build.weapon.instanceId).toBe('new-drop')
        expect(result.candidate.scoreGap).toBeGreaterThanOrEqual(0)
      }
    }
    expect(results[0]?.status === 'complete' && results[0].withCandidateBest.build.weapon.instanceId).toBe('new-drop')
    expect(JSON.stringify({ inventory, candidateInventory, conditions })).toBe(original)
  })

  it('keeps catalog-only candidates excluded without score or score-gap fallbacks', () => {
    const candidateInventory: Inventory = {
      ...inventory,
      catalogItems: [{ instanceId: 'research-only-drop', category: 'artifact', catalogId: 'gong-of-weakening', powerLevel: 251 }],
    }
    const result = compareTrialAcrossConditions(inventory, candidateInventory, 'research-only-drop', [conditions[0]!])[0]!
    if (result.status !== 'complete') throw new Error(result.error)
    expect(result.candidate.status).toBe('excluded')
    expect(result.candidate).not.toHaveProperty('best')
    expect(result.candidate).not.toHaveProperty('scoreGap')
    expect(result.candidate.status === 'excluded' && result.candidate.reasons.length).toBeGreaterThan(0)
  })

  it('keeps a failed condition separate from a condition that can be compared', () => {
    const candidateInventory: Inventory = {
      ...inventory,
      weapons: [...inventory.weapons, { ...inventory.weapons[0]!, instanceId: 'new-drop', observedDamagePerHit: 50 }],
    }
    const results = compareTrialAcrossConditions(inventory, candidateInventory, 'new-drop', [
      conditions[0]!,
      { ...conditions[1]!, scenario: { ...healing, averageEnemyHealth: 0 } },
    ])
    expect(results[0]?.status).toBe('complete')
    expect(results[1]?.status).toBe('error')
    expect(results[1]).not.toHaveProperty('baselineBest')
    expect(results[1]).not.toHaveProperty('withCandidateBest')
  })

  it('rejects an absent candidate and malformed condition batches', () => {
    expect(() => compareTrialAcrossConditions(inventory, inventory, 'missing', [conditions[0]!])).toThrow(/一時Inventoryにありません/)
    expect(() => compareTrialAcrossConditions(inventory, inventory, 'damage', [])).toThrow(/重複しない条件/)
    expect(() => compareTrialAcrossConditions(inventory, inventory, 'damage', [conditions[0]!, conditions[0]!])).toThrow(/重複しない条件/)
  })
})

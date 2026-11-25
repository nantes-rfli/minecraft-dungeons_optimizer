import { describe, expect, it } from 'vitest'
import { assessEquipment } from '../src/core/equipmentAssessment'
import { compareRemovalAcrossConditions, removalBaselineFor, type RemovalBaselineCondition } from '../src/core/inventoryRemovalComparison'
import { optimize } from '../src/core/optimizer'
import { DEFAULT_SCENARIO } from '../src/data/scenarios'
import type { AssessmentCondition } from '../src/core/equipmentAssessment'
import type { Inventory, Scenario } from '../src/core/types'

// Synthetic software fixtures, not gameplay observations or promotion Evidence.
const inventory: Inventory = {
  weapons: [
    { instanceId: 'damage', weaponId: 'fighters-bindings', powerLevel: 251, observedDamagePerHit: 10, enchantmentSlots: [{ candidates: ['critical-hit'] }] },
    { instanceId: 'healing', weaponId: 'fighters-bindings', powerLevel: 251, observedDamagePerHit: 10, enchantmentSlots: [{ candidates: ['radiance'] }] },
    { instanceId: 'weaker', weaponId: 'fighters-bindings', powerLevel: 251, observedDamagePerHit: 1, enchantmentSlots: [{ candidates: ['sharpness'] }] },
  ],
  artifacts: [],
}
const damageScenario: Scenario = { ...DEFAULT_SCENARIO, averageEnemyHealth: 1000, enemySupplyPerSecond: 1, weights: { damage: 1, healing: 0, defense: 0, control: 0 } }
const healingScenario: Scenario = { ...damageScenario, weights: { damage: 0, healing: 1, defense: 0, control: 0 } }
const conditions: readonly AssessmentCondition[] = [
  { id: 'damage', name: '火力用', scenario: damageScenario },
  { id: 'healing', name: '回復用', scenario: healingScenario },
]

function baselineFor(input: Inventory, selectedConditions: readonly AssessmentCondition[], instanceId: string): readonly RemovalBaselineCondition[] {
  return removalBaselineFor(assessEquipment(input, selectedConditions), [instanceId])
}

describe('inventory removal comparison', () => {
  it('compares current and removed best builds per condition without changing Inventory', () => {
    const original = JSON.stringify({ inventory, conditions })
    const results = compareRemovalAcrossConditions(inventory, 'damage', conditions, baselineFor(inventory, conditions, 'damage'))

    expect(results).toHaveLength(2)
    const damage = results[0]!
    const healing = results[1]!
    if (damage.status !== 'complete' || healing.status !== 'complete') throw new Error('expected both conditions to compare')
    expect(damage.baselineBest).toEqual(optimize(inventory, damageScenario).best)
    expect(damage.baselineBestUsesInstance).toBe(true)
    expect(damage.afterRemovalBest.build.weapon.instanceId).not.toBe('damage')
    expect(damage.afterRemovalBest.objectiveScore).toBeLessThan(damage.baselineBest.objectiveScore)
    expect(healing.baselineBestUsesInstance).toBe(false)
    expect(healing.afterRemovalBest.objectiveScore).toBe(healing.baselineBest.objectiveScore)
    expect(JSON.stringify({ inventory, conditions })).toBe(original)
  })

  it('keeps unsupported catalog equipment excluded without numeric removal results', () => {
    const extended: Inventory = {
      ...inventory,
      catalogItems: [{ instanceId: 'research-only', category: 'artifact', catalogId: 'gong-of-weakening', powerLevel: 251 }],
    }
    const result = compareRemovalAcrossConditions(extended, 'research-only', [conditions[0]!], baselineFor(extended, [conditions[0]!], 'research-only'))[0]!
    expect(result.status).toBe('excluded')
    expect(result).not.toHaveProperty('baselineBest')
    expect(result).not.toHaveProperty('afterRemovalBest')
    expect(result.status === 'excluded' && result.reasons.length).toBeGreaterThan(0)
  })

  it('reveals a loss from removing interchangeable individuals together while another purpose keeps its best build', () => {
    const copies = ['damage', 'damage-copy']
    const source = { ...inventory, weapons: [...inventory.weapons, { ...inventory.weapons[0]!, instanceId: copies[1]! }] }
    const original = structuredClone(source)
    const assessment = assessEquipment(source, conditions)
    for (const id of copies) {
      const [single] = compareRemovalAcrossConditions(source, id, conditions, removalBaselineFor(assessment, [id]))
      expect(single?.status).toBe('complete')
      if (single?.status !== 'complete') throw new Error('expected a single comparison')
      expect(single.afterRemovalBest.objectiveScore).toBe(single.baselineBest.objectiveScore)
    }

    const [damage, healing] = compareRemovalAcrossConditions(source, copies, conditions, removalBaselineFor(assessment, copies))
    expect(damage?.status).toBe('complete')
    expect(healing?.status).toBe('complete')
    if (damage?.status !== 'complete' || healing?.status !== 'complete') throw new Error('expected both group comparisons')
    expect(damage.baselineBestUsesInstance).toBe(true)
    expect(damage.afterRemovalBest.build.weapon.instanceId).toBe('healing')
    expect(damage.afterRemovalBest.objectiveScore).toBeLessThan(damage.baselineBest.objectiveScore)
    expect(healing.baselineBestUsesInstance).toBe(false)
    expect(healing.afterRemovalBest).toEqual(healing.baselineBest)
    expect(source).toEqual(original)
  })

  it('compares the group only in conditions where every selected individual was evaluated', () => {
    const source: Inventory = {
      ...inventory,
      rangedWeapons: [{
        instanceId: 'bow', weaponId: 'bow', powerLevel: 251, enchantmentSlots: [],
        observation: { gameVersion: '1.17.0.0', mode: 'uncharged', projectileDamage: 5, shotCycleSeconds: 1, availableAmmo: 10, sourceNote: 'Synthetic application fixture' },
      }],
      artifacts: [{ instanceId: 'amulet', artifactId: 'iron-hide-amulet', powerLevel: 251 }],
    }
    const group = ['damage', 'bow', 'amulet']
    const testConditions = [
      { id: 'missing-time', name: 'Missing time share', scenario: { ...damageScenario, includeBuildsWithoutRanged: true } },
      { id: 'with-time', name: 'With time share', scenario: { ...damageScenario, rangedTimeShare: 0.5 } },
    ]
    const assessment = assessEquipment(source, testConditions)
    const baseline = removalBaselineFor(assessment, group)
    const [excluded, allowed] = compareRemovalAcrossConditions(source, group, testConditions, baseline)
    expect(excluded).toMatchObject({ status: 'excluded', reasons: [expect.stringMatching(/^bow: .*時間割合/)] })
    expect(excluded).not.toHaveProperty('afterRemovalBest')
    expect(allowed).toMatchObject({ status: 'complete', baselineBestUsesInstance: true, afterRemovalBest: { build: { weapon: { instanceId: 'healing' }, artifacts: [] } } })
    expect(allowed?.status === 'complete' && allowed.afterRemovalBest.build.rangedWeapon).toBeUndefined()

    const current = assessment[0]!
    if (current.status !== 'complete') throw new Error('expected a baseline with exclusions')
    const withEmptyReason = { ...current, equipment: current.equipment.map((item) => item.status === 'excluded' ? { ...item, reasons: [] } : item) }
    expect(removalBaselineFor([withEmptyReason], group)[0]).toMatchObject({ status: 'complete', target: { status: 'excluded', reasons: [expect.stringMatching(/^bow: /)] } })
  })

  it('preserves a per-condition error when removing the last valid melee weapon', () => {
    const singleWeapon: Inventory = { weapons: [inventory.weapons[0]!], artifacts: [] }
    const result = compareRemovalAcrossConditions(singleWeapon, 'damage', [conditions[0]!], baselineFor(singleWeapon, [conditions[0]!], 'damage'))[0]!
    expect(result.status).toBe('error')
    expect(result).not.toHaveProperty('baselineBest')
    expect(result).not.toHaveProperty('afterRemovalBest')

    const allIds = inventory.weapons.map(({ instanceId }) => instanceId)
    const [removedAll] = compareRemovalAcrossConditions(inventory, allIds, conditions, removalBaselineFor(assessEquipment(inventory, conditions), allIds))
    expect(removedAll).toMatchObject({ status: 'error' })
    expect(removedAll).not.toHaveProperty('afterRemovalBest')
  })

  it('rejects missing or duplicate identities and malformed condition batches', () => {
    expect(() => compareRemovalAcrossConditions(inventory, [], [conditions[0]!], [])).toThrow(/個体ID/)
    expect(() => compareRemovalAcrossConditions(inventory, ['damage', 'damage'], [conditions[0]!], [])).toThrow(/重複/)
    expect(() => compareRemovalAcrossConditions(inventory, ['damage', 'missing'], conditions, baselineFor(inventory, conditions, 'damage'))).toThrow(/ありません/)
    expect(() => compareRemovalAcrossConditions(inventory, 'missing', [conditions[0]!], baselineFor(inventory, [conditions[0]!], 'missing'))).toThrow(/ありません/)
    expect(() => compareRemovalAcrossConditions({ ...inventory, weapons: [...inventory.weapons, inventory.weapons[0]!] }, 'damage', [conditions[0]!], baselineFor(inventory, [conditions[0]!], 'damage'))).toThrow(/重複/)
    expect(() => compareRemovalAcrossConditions(inventory, 'damage', [], [])).toThrow(/条件/)
    expect(() => compareRemovalAcrossConditions(inventory, 'damage', [conditions[0]!, conditions[0]!], [])).toThrow(/条件/)
    expect(() => compareRemovalAcrossConditions(inventory, ' ', [conditions[0]!], baselineFor(inventory, [conditions[0]!], ' '))).toThrow(/個体ID/)
    expect(() => compareRemovalAcrossConditions(inventory, 'damage', conditions, baselineFor(inventory, [conditions[1]!], 'damage'))).toThrow(/基準評価/)
  })
})

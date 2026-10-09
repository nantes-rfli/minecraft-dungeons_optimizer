import { describe, expect, it } from 'vitest'
import { assessEquipment, MAX_ASSESSMENT_CONDITIONS, summarizeMultiConditionBestScores } from '../src/core/equipmentAssessment'
import { optimize, optimizeForEquipment } from '../src/core/optimizer'
import { DEFAULT_SCENARIO } from '../src/data/scenarios'
import type { Inventory, Scenario } from '../src/core/types'

// Synthetic software fixtures, not gameplay observations or promotion Evidence.
const inventory: Inventory = {
  weapons: [
    { instanceId: 'damage', weaponId: 'fighters-bindings', powerLevel: 251, observedDamagePerHit: 10, enchantmentSlots: [{ candidates: ['critical-hit'] }] },
    { instanceId: 'healing', weaponId: 'fighters-bindings', powerLevel: 251, observedDamagePerHit: 10, enchantmentSlots: [{ candidates: ['radiance'] }] },
    { instanceId: 'weaker', weaponId: 'fighters-bindings', powerLevel: 251, observedDamagePerHit: 1, enchantmentSlots: [{ candidates: ['sharpness'] }] },
  ], artifacts: [],
}
const scenario: Scenario = { ...DEFAULT_SCENARIO, averageEnemyHealth: 1000, enemySupplyPerSecond: 1, weights: { damage: 1, healing: 0, defense: 0, control: 0 } }
const condition = { id: 'damage', name: '火力用', scenario }

describe('equipment value across independent conditions', () => {
  it('finds each instance-constrained optimum and reveals a different useful item in another purpose', () => {
    const survival = { id: 'survival', name: '回復用', scenario: { ...scenario, weights: { damage: 0, healing: 1, defense: 0, control: 0 } } }
    const before = JSON.stringify({ inventory, conditions: [condition, survival] })
    const results = assessEquipment(inventory, [condition, survival])
    expect(results.map((result) => result.status === 'complete' && result.best.build.weapon.instanceId)).toEqual(['damage', 'healing'])
    for (const result of results) {
      if (result.status !== 'complete') throw new Error(result.error)
      expect(result.best).toEqual(optimize(inventory, result.condition.scenario).best)
      for (const item of result.equipment) {
        if (item.status !== 'evaluated') throw new Error('unexpected exclusion')
        const constrained = optimize({ ...inventory, weapons: inventory.weapons.filter((weapon) => weapon.instanceId === item.instanceId) }, result.condition.scenario)
        expect(item.best).toEqual(constrained.best)
        expect(item.scoreGap).toBe(result.best.objectiveScore - constrained.best.objectiveScore)
        expect(item.scoreGap).toBeGreaterThanOrEqual(0)
      }
    }
    expect(JSON.stringify({ inventory, conditions: [condition, survival] })).toBe(before)
  })

  it('covers individuals beyond all recommendation display limits and preserves exact ties', () => {
    const many: Inventory = { weapons: Array.from({ length: 15 }, (_, index) => ({ ...inventory.weapons[0]!, instanceId: `item-${index}`, observedDamagePerHit: index < 2 ? 50 : 50 - index })), artifacts: [] }
    const ordinary = optimize(many, scenario)
    const { result, bestByInstance } = optimizeForEquipment(many, scenario)
    expect(result).toEqual(ordinary)
    expect(bestByInstance.size).toBe(15)
    expect(ordinary.alternatives.some((item) => item.build.weapon.instanceId === 'item-14')).toBe(false)
    expect(bestByInstance.get('item-14')?.build.weapon.instanceId).toBe('item-14')
    const assessed = assessEquipment(many, [condition])[0]!
    if (assessed.status !== 'complete') throw new Error(assessed.error)
    expect(assessed.equipment.slice(0, 2).map((item) => item.status === 'evaluated' ? item.scoreGap : null)).toEqual([0, 0])
  })

  it('summarizes exact best-score ties across completed conditions without combining their scores', () => {
    const tiedInventory: Inventory = {
      ...inventory,
      weapons: [
        inventory.weapons[0]!,
        { ...inventory.weapons[0]!, instanceId: 'damage-copy' },
        inventory.weapons[1]!,
        inventory.weapons[2]!,
      ],
      catalogItems: [{ instanceId: 'research-only', category: 'artifact', catalogId: 'gong-of-weakening', powerLevel: 251 }],
    }
    const duplicateDamageCondition = { ...condition, id: 'damage-copy-condition', name: '火力確認用', scenario: { ...scenario, name: '火力確認用', weights: { healing: 0, damage: 1, defense: 0, control: 0 } } }
    const distinctDamageCondition = { ...condition, id: 'damage-longer-condition', name: '長期火力用', scenario: { ...scenario, encounterDurationSeconds: scenario.encounterDurationSeconds + 1 } }
    const failedCondition = { ...condition, id: 'failed', name: '失敗条件', scenario: { ...scenario, averageEnemyHealth: 0 } }
    const assessments = assessEquipment(tiedInventory, [condition, duplicateDamageCondition, distinctDamageCondition, failedCondition])
    const summary = summarizeMultiConditionBestScores(assessments)

    expect(assessments.map((assessment) => assessment.status)).toEqual(['complete', 'complete', 'complete', 'error'])
    expect(summary.distinctCompletedConditionCount).toBe(2)
    expect(summary.items.map((item) => item.instanceId)).toEqual(['damage', 'damage-copy'])
    expect(summary.items[0]?.conditionIds).toEqual(['damage', 'damage-longer-condition'])
    expect(summary.items[0]?.conditionNames).toEqual(['火力用', '長期火力用'])
    expect(summary.items.some((item) => item.instanceId === 'healing' || item.instanceId === 'weaker')).toBe(false)
    expect(summary.items.some((item) => item.instanceId === 'research-only')).toBe(false)
    expect(summarizeMultiConditionBestScores([assessments[0]!])).toEqual({ distinctCompletedConditionCount: 1, items: [] })
    expect(summarizeMultiConditionBestScores(assessments.slice(0, 2))).toEqual({ distinctCompletedConditionCount: 1, items: [] })
    for (const assessment of assessments.slice(0, 3)) {
      if (assessment.status !== 'complete') throw new Error(assessment.error)
      expect(assessment.equipment.find((item) => item.instanceId === 'research-only')?.status).toBe('excluded')
    }
  })

  it('optimizes full loadouts for armor, ranged, artifacts and alternative enchantments, retaining locks and tiers', () => {
    const full: Inventory = {
      weapons: [{ ...inventory.weapons[0]!, enchantmentSlots: [{ candidates: ['critical-hit', 'sharpness'] }] }],
      armors: [100, 200].map((health) => ({ instanceId: `armor-${health}`, armorId: 'scale-mail', powerLevel: 251, observedHealthBonus: health, enchantmentSlots: [{ candidates: ['cool-down'], selected: { enchantmentId: 'cool-down', tier: 2 } }] })),
      rangedWeapons: ['bow', 'crossbow'].map((id) => ({ instanceId: id, weaponId: id, powerLevel: 251, enchantmentSlots: [{ candidates: ['power', 'unchanting'] }], gilded: { enchantmentId: 'critical-hit', tier: 1 }, observation: { gameVersion: '1.17.0.0', mode: id === 'bow' ? 'charged' : 'single', projectileDamage: 10, shotCycleSeconds: 2, availableAmmo: 20, sourceNote: 'SYNTHETIC TEST ONLY' } })),
      artifacts: Array.from({ length: 4 }, (_, i) => ({ instanceId: `mushroom-${i}`, artifactId: 'death-cap-mushroom', powerLevel: 251 })),
    }
    const current = { ...scenario, rangedTimeShare: 0.4 }
    const { result, bestByInstance } = optimizeForEquipment(full, current)
    expect(bestByInstance.size).toBe(9)
    expect(result).toEqual(optimize(full, current))
    for (const [id, best] of bestByInstance) {
      const contains = [best.build.weapon.instanceId, best.build.armor?.instanceId, best.build.rangedWeapon?.instanceId, ...best.build.artifacts.map((item) => item.instanceId)].includes(id)
      expect(contains).toBe(true)
      expect(best.build.armorEnchantments).toEqual([{ enchantmentId: 'cool-down', tier: 2, source: 'slot' }])
      expect(best.build.rangedEnchantments?.at(-1)).toEqual({ enchantmentId: 'critical-hit', tier: 1, source: 'gilded' })
      const constrained: Inventory = {
        ...full,
        armors: id.startsWith('armor-') ? full.armors!.filter((item) => item.instanceId === id) : full.armors,
        rangedWeapons: id === 'bow' || id === 'crossbow' ? full.rangedWeapons!.filter((item) => item.instanceId === id) : full.rangedWeapons,
      }
      const choices = id.startsWith('mushroom-')
        ? full.artifacts.filter((item) => item.instanceId !== id).map((omitted) => optimize({ ...constrained, artifacts: full.artifacts.filter((item) => item.instanceId !== omitted.instanceId) }, current).best.objectiveScore)
        : [optimize(constrained, current).best.objectiveScore]
      expect(best.objectiveScore).toBe(Math.max(...choices))
    }
  })

  it('keeps catalog-only, policy-excluded and unsupported armor instances non-numerical', () => {
    const extended: Inventory = { ...inventory,
      artifacts: [{ instanceId: 'estimated', artifactId: 'death-cap-mushroom', powerLevel: 251 }],
      armors: [
        { instanceId: 'ok', armorId: 'scale-mail', powerLevel: 251, observedHealthBonus: 100, enchantmentSlots: [{ candidates: ['cool-down'] }] },
        { instanceId: 'missing-health', armorId: 'scale-mail', powerLevel: 251, enchantmentSlots: [{ candidates: ['cool-down'] }] },
      ],
      catalogItems: [{ instanceId: 'research', category: 'artifact', catalogId: 'gong-of-weakening', powerLevel: 251 }],
    }
    const result = assessEquipment(extended, [{ ...condition, scenario: { ...scenario, evidencePolicy: 'high-confidence-only' } }])[0]!
    if (result.status !== 'complete') throw new Error(result.error)
    for (const id of ['research', 'estimated', 'missing-health']) {
      const item = result.equipment.find((entry) => entry.instanceId === id)!
      expect(item.status).toBe('excluded')
      expect(item).not.toHaveProperty('scoreGap')
      expect(item).not.toHaveProperty('best')
      expect(item.status === 'excluded' && item.reasons.length).toBeGreaterThan(0)
    }
  })

  it('preserves errors per condition without substituting scores or blocking a valid condition', () => {
    const results = assessEquipment(inventory, [condition, { ...condition, id: 'invalid', scenario: { ...scenario, averageEnemyHealth: 0 } }])
    expect(results[0]?.status).toBe('complete')
    expect(results[1]?.status).toBe('error')
    expect(results[1]).not.toHaveProperty('equipment')
    expect(results[1]).not.toHaveProperty('best')
    const unsupported = { ...inventory, weapons: [{ ...inventory.weapons[0]!, enchantmentSlots: [{ candidates: ['echo'] }] }] }
    expect(assessEquipment(unsupported, [condition])[0]?.status).toBe('error')
  })

  it('rejects invalid batches, duplicate identities and excessive search size before evaluating', () => {
    const maximum = Array.from({ length: MAX_ASSESSMENT_CONDITIONS }, (_, i) => ({ ...condition, id: `${i}` }))
    expect(assessEquipment(inventory, maximum).every((result) => result.status === 'complete')).toBe(true)
    for (const conditions of [[], [condition, condition], Array.from({ length: MAX_ASSESSMENT_CONDITIONS + 1 }, (_, i) => ({ ...condition, id: `${i}` })), [{ ...condition, id: ' ' }]]) {
      expect(() => assessEquipment(inventory, conditions)).toThrow()
    }
    expect(() => assessEquipment({ ...inventory, weapons: [inventory.weapons[0]!, inventory.weapons[0]!] }, [condition])).toThrow(/重複/)
    expect(() => assessEquipment({ ...inventory, artifacts: Array.from({ length: 80 }, (_, i) => ({ instanceId: `a-${i}`, artifactId: 'death-cap-mushroom', powerLevel: 251 })) }, [condition])).toThrow(/安全上限/)
  })
})

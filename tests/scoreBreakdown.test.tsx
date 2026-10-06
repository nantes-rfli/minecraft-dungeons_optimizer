import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { optimize } from '../src/core'
import type { Evaluation, Inventory } from '../src/core/types'
import { DEFAULT_SCENARIO, SCENARIO_PROFILES } from '../src/data/scenarios'
import { ScoreBreakdown } from '../src/views/ScoreBreakdown'
import { scoreBreakdown } from '../src/views/objectiveScoreBreakdown'
import { OptimizeResults } from '../src/screens/OptimizeResults'

const inventory: Inventory = {
  weapons: [{ instanceId: 'score-test', weaponId: 'fighters-bindings', powerLevel: 251,
    enchantmentSlots: [{ candidates: ['critical-hit', 'radiance', 'guarding-strike'] }] }],
  artifacts: [],
}
const sum = (rows: ReturnType<typeof scoreBreakdown>) => rows.reduce((total, row) => total + row.scorePoints, 0)

describe('evaluated score explanation', () => {
  it.each(Object.entries(SCENARIO_PROFILES))('reconstructs best and all alternative/Pareto scores for %s', (_id, scenario) => {
    const result = optimize(inventory, scenario)
    for (const evaluation of [result.best, ...result.alternatives, ...result.paretoFrontier]) {
      const rows = scoreBreakdown(evaluation.utilities, scenario.weights)
      expect(rows.map((row) => row.axis)).toEqual(['damage', 'healing', 'defense', 'control'])
      expect(sum(rows)).toBeCloseTo(evaluation.objectiveScore, 10)
      const baseline = scoreBreakdown(result.best.utilities, scenario.weights)
      const delta = rows.reduce((total, row, index) => total + row.scorePoints - baseline[index]!.scorePoints, 0)
      expect(delta).toBeCloseTo(evaluation.objectiveScore - result.best.objectiveScore, 10)
    }
  })

  it('preserves negative healing and genuine zero-weight contributions', () => {
    const utilities = { damage: 0.8, healing: -0.4, defense: 0.3, control: 0.5 }
    const weights = { damage: 2, healing: 1, defense: 1, control: 0 }
    const rows = scoreBreakdown(utilities, weights)
    expect(rows.map((row) => row.scorePoints)).toEqual([40, -10, 7.5, 0])
    expect(rows.map((row) => row.weightPercent)).toEqual([50, 25, 25, 0])
    expect(utilities.healing).toBe(-0.4)
    const best = optimize(inventory, DEFAULT_SCENARIO).best
    const evaluation: Evaluation = { ...best, utilities }
    const html = renderToStaticMarkup(<ScoreBreakdown evaluation={evaluation} weights={weights} />)
    expect(html).toContain('<td>-40</td><td>-10点</td>')
    expect(html).toContain('Healingは負の加点')
  })

  it('shows a negative contribution from an evaluated Pain Cycle build', () => {
    const result = optimize({ weapons: [{ ...inventory.weapons[0]!, enchantmentSlots: [{ candidates: ['pain-cycle'] }] }], artifacts: [] }, DEFAULT_SCENARIO)
    expect(result.best.healing.totalPerSecond).toBeLessThan(0)
    const rows = scoreBreakdown(result.best.utilities, DEFAULT_SCENARIO.weights)
    expect(rows.find((row) => row.axis === 'healing')!.scorePoints).toBeLessThan(0)
    expect(sum(rows)).toBeCloseTo(result.best.objectiveScore, 10)
  })

  it('compares all four axes against a zero baseline without percent division', () => {
    const best = optimize(inventory, DEFAULT_SCENARIO).best
    const weights = { damage: 1, healing: 1, defense: 1, control: 1 }
    const baseline = { ...best, utilities: { damage: 0, healing: 0, defense: 0, control: 0 } }
    const alternative = { ...best, utilities: { damage: 0.5, healing: -0.2, defense: 0.1, control: 0.4 } }
    const html = renderToStaticMarkup(<ScoreBreakdown evaluation={alternative} best={baseline} weights={weights} />)
    for (const value of ['+12.5点', '-5点', '+2.5点', '+10点']) expect(html).toContain(value)
    expect(html).not.toMatch(/NaN|Infinity|比較不可/)
    expect(html).toContain('scope="row">Healing')
    expect(html).toContain('scope="row">Control')
  })

  it('uses the selected weights throughout results and keeps unsupported disclosures', () => {
    const scenario = { ...DEFAULT_SCENARIO, weights: { damage: 1, healing: 0, defense: 0, control: 0 } }
    const result = optimize(inventory, scenario)
    const serialized = JSON.stringify(result)
    const html = renderToStaticMarkup(<OptimizeResults weights={scenario.weights} result={{ ...result, unsupportedChoices: ['unverified test candidate'] }} error={null} status="complete" />)
    expect(html).toContain('総合スコアの内訳')
    expect(html).toContain('1位とのスコア差の内訳')
    expect(html).toContain('100%')
    expect(html).toContain('0点として採用しません')
    expect(html).toContain('unverified test candidate')
    expect(html).toContain('現在のモデルとEvidence適用方針の範囲内')
    expect(JSON.stringify(result)).toBe(serialized)
  })
})

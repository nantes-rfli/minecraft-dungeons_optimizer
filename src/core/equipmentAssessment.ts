import { optimizeForEquipment } from './optimizer'
import { assertSearchBudget } from './searchBudget'
import { validateInventory } from './validation'
import type { Evaluation, Inventory, Scenario } from './types'

export interface AssessmentCondition {
  readonly id: string
  readonly name: string
  readonly scenario: Scenario
}

export type EquipmentAssessment =
  | { readonly instanceId: string; readonly status: 'evaluated'; readonly best: Evaluation; readonly scoreGap: number }
  | { readonly instanceId: string; readonly status: 'excluded'; readonly reasons: readonly string[] }

export type ConditionAssessment =
  | { readonly condition: AssessmentCondition; readonly status: 'complete'; readonly best: Evaluation; readonly evaluatedBuildCount: number; readonly unsupportedChoices: readonly string[]; readonly equipment: readonly EquipmentAssessment[] }
  | { readonly condition: AssessmentCondition; readonly status: 'error'; readonly error: string }

export interface MultiConditionBestScoreEquipment {
  readonly instanceId: string
  readonly conditionIds: readonly string[]
  readonly conditionNames: readonly string[]
}

export interface MultiConditionBestScoreSummary {
  readonly distinctCompletedConditionCount: number
  readonly items: readonly MultiConditionBestScoreEquipment[]
}

function stableScenarioInputJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableScenarioInputJson).join(',')}]`
  if (typeof value === 'object' && value !== null) {
    const record = value as Record<string, unknown>
    const keys = Object.keys(record).filter((key) => record[key] !== undefined).sort()
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableScenarioInputJson(record[key])}`).join(',')}}`
  }
  return JSON.stringify(value) ?? 'null'
}

function scenarioInputKey(scenario: Scenario): string {
  const inputs = Object.fromEntries(Object.entries(scenario).filter(([key]) => key !== 'name'))
  return stableScenarioInputJson(inputs)
}

/**
 * Finds equipment that can appear in a best-scoring loadout when required
 * individually across multiple distinct scenario inputs. Display names do not
 * make otherwise identical inputs count twice. Scores are only compared within
 * each scenario; this summary never combines different objectives.
 */
export function summarizeMultiConditionBestScores(assessments: readonly ConditionAssessment[]): MultiConditionBestScoreSummary {
  const seenScenarioInputs = new Set<string>()
  const completed: Extract<ConditionAssessment, { readonly status: 'complete' }>[] = []
  for (const assessment of assessments) {
    if (assessment.status !== 'complete') continue
    const key = scenarioInputKey(assessment.condition.scenario)
    if (seenScenarioInputs.has(key)) continue
    seenScenarioInputs.add(key)
    completed.push(assessment)
  }
  const usage = new Map<string, { readonly order: number; readonly conditionIds: string[]; readonly conditionNames: string[] }>()
  let order = 0

  for (const assessment of completed) {
    for (const equipment of assessment.equipment) {
      if (equipment.status !== 'evaluated' || equipment.scoreGap !== 0) continue
      let entry = usage.get(equipment.instanceId)
      if (!entry) {
        entry = { order: order++, conditionIds: [], conditionNames: [] }
        usage.set(equipment.instanceId, entry)
      }
      if (entry.conditionIds.includes(assessment.condition.id)) continue
      entry.conditionIds.push(assessment.condition.id)
      entry.conditionNames.push(assessment.condition.name)
    }
  }

  const items = [...usage.entries()]
    .filter(([, entry]) => entry.conditionIds.length > 1)
    .sort(([, left], [, right]) => right.conditionIds.length - left.conditionIds.length || left.order - right.order)
    .map(([instanceId, entry]) => ({
      instanceId,
      conditionIds: entry.conditionIds,
      conditionNames: entry.conditionNames,
    }))

  return { distinctCompletedConditionCount: completed.length, items }
}

export const MAX_ASSESSMENT_CONDITIONS = 9 // current condition + up to eight saved conditions

/** Independent exhaustive searches; scores are compared only within a condition. */
export function assessEquipment(inventory: Inventory, conditions: readonly AssessmentCondition[]): readonly ConditionAssessment[] {
  if (conditions.length < 1 || conditions.length > MAX_ASSESSMENT_CONDITIONS
    || conditions.some((condition) => !condition.id.trim() || !condition.name.trim())
    || new Set(conditions.map((condition) => condition.id)).size !== conditions.length) {
    throw new Error(`用途別評価には重複しない条件を1〜${MAX_ASSESSMENT_CONDITIONS}件指定してください。`)
  }
  validateInventory(inventory)
  assertSearchBudget(inventory)
  const instances = [...inventory.weapons, ...(inventory.armors ?? []), ...(inventory.rangedWeapons ?? []), ...inventory.artifacts, ...(inventory.catalogItems ?? [])]
  const catalogIds = new Set(inventory.catalogItems?.map((item) => item.instanceId))
  return conditions.map((condition): ConditionAssessment => {
    try {
      const { result, bestByInstance } = optimizeForEquipment(inventory, condition.scenario)
      return {
        condition, status: 'complete', best: result.best,
        evaluatedBuildCount: result.evaluatedBuildCount, unsupportedChoices: result.unsupportedChoices,
        equipment: instances.map(({ instanceId }): EquipmentAssessment => {
          const best = bestByInstance.get(instanceId)
          if (best) return { instanceId, status: 'evaluated', best, scoreGap: result.best.objectiveScore - best.objectiveScore }
          const reasons = result.unsupportedChoices.filter((reason) => reason.startsWith(`${instanceId}:`))
            .map((reason) => reason.slice(instanceId.length + 1).trim())
          return { instanceId, status: 'excluded', reasons: catalogIds.has(instanceId)
            ? ['この装備は現在の計算対象外です。未対応の効果を0点として評価しません。']
            : reasons.length ? reasons : ['この条件と所持装備で評価可能な構成がありません。組合せ・Evidenceの除外理由を確認してください。'] }
        }),
      }
    } catch (error) {
      return { condition, status: 'error', error: error instanceof Error ? error.message : 'この条件では評価できませんでした。' }
    }
  })
}

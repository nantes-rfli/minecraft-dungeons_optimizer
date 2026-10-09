import { MAX_ASSESSMENT_CONDITIONS, type AssessmentCondition } from './equipmentAssessment'
import { optimize } from './optimizer'
import type { Evaluation, Inventory } from './types'

export type RemovalBaselineCondition =
  | {
    readonly conditionId: string
    readonly status: 'complete'
    readonly best: Evaluation
    readonly target: { readonly status: 'evaluated' } | { readonly status: 'excluded'; readonly reasons: readonly string[] }
  }
  | { readonly conditionId: string; readonly status: 'error'; readonly error: string }

export type RemovalConditionComparison =
  | {
    readonly condition: AssessmentCondition
    readonly status: 'complete'
    readonly baselineBest: Evaluation
    readonly afterRemovalBest: Evaluation
    readonly baselineBestUsesInstance: boolean
  }
  | { readonly condition: AssessmentCondition; readonly status: 'excluded'; readonly reasons: readonly string[] }
  | { readonly condition: AssessmentCondition; readonly status: 'error'; readonly error: string }

function inventoryWithoutInstance(inventory: Inventory, instanceId: string): Inventory {
  const allItems = [
    ...inventory.weapons,
    ...(inventory.armors ?? []),
    ...(inventory.rangedWeapons ?? []),
    ...inventory.artifacts,
    ...(inventory.catalogItems ?? []),
  ]
  const matches = allItems.filter((item) => item.instanceId === instanceId).length
  if (matches !== 1) throw new Error(matches === 0 ? '対象の装備がInventoryにありません。' : '個体IDが重複しているため比較できません。')

  return {
    ...inventory,
    weapons: inventory.weapons.filter((item) => item.instanceId !== instanceId),
    ...(inventory.armors ? { armors: inventory.armors.filter((item) => item.instanceId !== instanceId) } : {}),
    ...(inventory.rangedWeapons ? { rangedWeapons: inventory.rangedWeapons.filter((item) => item.instanceId !== instanceId) } : {}),
    artifacts: inventory.artifacts.filter((item) => item.instanceId !== instanceId),
    ...(inventory.catalogItems ? { catalogItems: inventory.catalogItems.filter((item) => item.instanceId !== instanceId) } : {}),
  }
}

function buildUsesInstance(evaluation: Evaluation, instanceId: string): boolean {
  return evaluation.build.weapon.instanceId === instanceId
    || evaluation.build.armor?.instanceId === instanceId
    || evaluation.build.rangedWeapon?.instanceId === instanceId
    || evaluation.build.artifacts.some((item) => item.instanceId === instanceId)
}

/** Compares a current assessment with the best builds after removing one owned instance. */
export function compareRemovalAcrossConditions(
  inventory: Inventory,
  instanceId: string,
  conditions: readonly AssessmentCondition[],
  baseline: readonly RemovalBaselineCondition[],
): readonly RemovalConditionComparison[] {
  if (!instanceId.trim()) throw new Error('比較する装備の個体IDを指定してください。')
  if (conditions.length < 1 || conditions.length > MAX_ASSESSMENT_CONDITIONS
    || conditions.some((condition) => !condition.id.trim() || !condition.name.trim())
    || new Set(conditions.map((condition) => condition.id)).size !== conditions.length) {
    throw new Error(`装備を外す比較には重複しない条件を1〜${MAX_ASSESSMENT_CONDITIONS}件指定してください。`)
  }
  if (baseline.length !== conditions.length || baseline.some((entry, index) => entry.conditionId !== conditions[index]?.id)
    || new Set(baseline.map((entry) => entry.conditionId)).size !== baseline.length) {
    throw new Error('比較の基準評価と条件が一致しません。')
  }

  const reducedInventory = inventoryWithoutInstance(inventory, instanceId)
  return conditions.map((condition, index): RemovalConditionComparison => {
    const baselineCondition = baseline[index]!
    if (baselineCondition.status === 'error') return { condition, status: 'error', error: baselineCondition.error }
    if (baselineCondition.target.status === 'excluded') return { condition, status: 'excluded', reasons: baselineCondition.target.reasons }
    try {
      const afterRemovalBest = optimize(reducedInventory, condition.scenario).best
      return {
        condition,
        status: 'complete',
        baselineBest: baselineCondition.best,
        afterRemovalBest,
        baselineBestUsesInstance: buildUsesInstance(baselineCondition.best, instanceId),
      }
    } catch (error) {
      return { condition, status: 'error', error: error instanceof Error ? error.message : 'この条件では比較できませんでした。' }
    }
  })
}

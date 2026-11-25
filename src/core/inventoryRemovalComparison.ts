import { MAX_ASSESSMENT_CONDITIONS, type AssessmentCondition, type ConditionAssessment } from './equipmentAssessment'
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
    /** Whether the baseline best contains any selected instance. */
    readonly baselineBestUsesInstance: boolean
  }
  | { readonly condition: AssessmentCondition; readonly status: 'excluded'; readonly reasons: readonly string[] }
  | { readonly condition: AssessmentCondition; readonly status: 'error'; readonly error: string }

/** Prepare a condition baseline only when every selected item had a feasible build. */
export function removalBaselineFor(
  assessments: readonly ConditionAssessment[],
  instanceIds: readonly string[],
): readonly RemovalBaselineCondition[] {
  return assessments.map((assessment) => {
    const { id: conditionId } = assessment.condition
    if (assessment.status === 'error') return { conditionId, status: 'error', error: assessment.error }
    const equipment = new Map(assessment.equipment.map((item) => [item.instanceId, item]))
    const reasons = instanceIds.flatMap((instanceId) => {
      const item = equipment.get(instanceId)
      if (item?.status === 'evaluated') return []
      const exclusion = item?.reasons.length ? item.reasons : ['この条件の基準評価で対象装備を数値評価できませんでした。']
      return instanceIds.length === 1 ? exclusion : exclusion.map((reason) => `${instanceId}: ${reason}`)
    })
    return {
      conditionId,
      status: 'complete',
      best: assessment.best,
      target: reasons.length ? { status: 'excluded', reasons } : { status: 'evaluated' },
    }
  })
}

function inventoryWithoutInstances(inventory: Inventory, instanceIds: ReadonlySet<string>): Inventory {
  const allItems = [
    ...inventory.weapons,
    ...(inventory.armors ?? []),
    ...(inventory.rangedWeapons ?? []),
    ...inventory.artifacts,
    ...(inventory.catalogItems ?? []),
  ]
  const found = new Set<string>()
  for (const { instanceId } of allItems) {
    if (!instanceIds.has(instanceId)) continue
    if (found.has(instanceId)) throw new Error('個体IDが重複しているため比較できません。')
    found.add(instanceId)
  }
  if (found.size !== instanceIds.size) throw new Error('対象の装備がInventoryにありません。')

  const keep = ({ instanceId }: { readonly instanceId: string }) => !instanceIds.has(instanceId)
  return {
    ...inventory,
    weapons: inventory.weapons.filter(keep),
    ...(inventory.armors ? { armors: inventory.armors.filter(keep) } : {}),
    ...(inventory.rangedWeapons ? { rangedWeapons: inventory.rangedWeapons.filter(keep) } : {}),
    artifacts: inventory.artifacts.filter(keep),
    ...(inventory.catalogItems ? { catalogItems: inventory.catalogItems.filter(keep) } : {}),
  }
}

function buildUsesAnyInstance({ build }: Evaluation, instanceIds: ReadonlySet<string>): boolean {
  return [build.weapon, build.armor, build.rangedWeapon, ...build.artifacts]
    .some((item) => item !== undefined && instanceIds.has(item.instanceId))
}

/** Compares the baseline with the best builds after removing the selected owned instances together. */
export function compareRemovalAcrossConditions(
  inventory: Inventory,
  selection: string | readonly string[],
  conditions: readonly AssessmentCondition[],
  baseline: readonly RemovalBaselineCondition[],
): readonly RemovalConditionComparison[] {
  const selectedIds = typeof selection === 'string' ? [selection] : selection
  if (!selectedIds.length || selectedIds.some((id) => !id.trim())) throw new Error('比較する装備の個体IDを指定してください。')
  const instanceIds = new Set(selectedIds)
  if (instanceIds.size !== selectedIds.length) throw new Error('比較対象の個体IDが重複しています。')
  if (conditions.length < 1 || conditions.length > MAX_ASSESSMENT_CONDITIONS
    || conditions.some((condition) => !condition.id.trim() || !condition.name.trim())
    || new Set(conditions.map((condition) => condition.id)).size !== conditions.length) {
    throw new Error(`装備を外す比較には重複しない条件を1〜${MAX_ASSESSMENT_CONDITIONS}件指定してください。`)
  }
  if (baseline.length !== conditions.length || baseline.some((entry, index) => entry.conditionId !== conditions[index]?.id)
    || new Set(baseline.map((entry) => entry.conditionId)).size !== baseline.length) {
    throw new Error('比較の基準評価と条件が一致しません。')
  }

  const reducedInventory = inventoryWithoutInstances(inventory, instanceIds)
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
        baselineBestUsesInstance: buildUsesAnyInstance(baselineCondition.best, instanceIds),
      }
    } catch (error) {
      return { condition, status: 'error', error: error instanceof Error ? error.message : 'この条件では比較できませんでした。' }
    }
  })
}

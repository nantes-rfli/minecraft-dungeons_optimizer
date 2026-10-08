import { MAX_ASSESSMENT_CONDITIONS, type AssessmentCondition } from './equipmentAssessment'
import { optimize, optimizeForEquipment } from './optimizer'
import type { Evaluation, Inventory } from './types'

export type TrialConditionComparison =
  | {
    readonly condition: AssessmentCondition
    readonly status: 'complete'
    readonly baselineBest: Evaluation
    readonly withCandidateBest: Evaluation
    readonly candidate:
      | { readonly status: 'evaluated'; readonly best: Evaluation; readonly scoreGap: number }
      | { readonly status: 'excluded'; readonly reasons: readonly string[] }
  }
  | { readonly condition: AssessmentCondition; readonly status: 'error'; readonly error: string }

/** Compares a staged item against the current best independently for each saved condition. */
export function compareTrialAcrossConditions(
  baselineInventory: Inventory,
  candidateInventory: Inventory,
  candidateInstanceId: string,
  conditions: readonly AssessmentCondition[],
): readonly TrialConditionComparison[] {
  if (!candidateInstanceId.trim()) throw new Error('比較候補の個体IDを指定してください。')
  if (conditions.length < 1 || conditions.length > MAX_ASSESSMENT_CONDITIONS
    || conditions.some((condition) => !condition.id.trim() || !condition.name.trim())
    || new Set(conditions.map((condition) => condition.id)).size !== conditions.length) {
    throw new Error(`保存条件の比較には重複しない条件を1〜${MAX_ASSESSMENT_CONDITIONS}件指定してください。`)
  }

  const candidateExists = [
    ...candidateInventory.weapons,
    ...(candidateInventory.armors ?? []),
    ...(candidateInventory.rangedWeapons ?? []),
    ...candidateInventory.artifacts,
    ...(candidateInventory.catalogItems ?? []),
  ].some((item) => item.instanceId === candidateInstanceId)
  if (!candidateExists) throw new Error('比較候補が一時Inventoryにありません。候補を選び直してください。')

  return conditions.map((condition): TrialConditionComparison => {
    try {
      const baselineBest = optimize(baselineInventory, condition.scenario).best
      const candidateRun = optimizeForEquipment(candidateInventory, condition.scenario)
      const candidateBest = candidateRun.bestByInstance.get(candidateInstanceId)
      const reasons = candidateRun.result.unsupportedChoices
        .filter((reason) => reason.startsWith(`${candidateInstanceId}:`))
        .map((reason) => reason.slice(candidateInstanceId.length + 1).trim())
      return {
        condition,
        status: 'complete',
        baselineBest,
        withCandidateBest: candidateRun.result.best,
        candidate: candidateBest
          ? { status: 'evaluated', best: candidateBest, scoreGap: candidateRun.result.best.objectiveScore - candidateBest.objectiveScore }
          : { status: 'excluded', reasons: reasons.length ? reasons : ['この条件では候補を含む実行可能な構成を評価できませんでした。'] },
      }
    } catch (error) {
      return { condition, status: 'error', error: error instanceof Error ? error.message : 'この保存条件では比較できませんでした。' }
    }
  })
}

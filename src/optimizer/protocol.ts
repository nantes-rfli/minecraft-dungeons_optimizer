import type { Inventory, OptimizationResult, Scenario } from '../core/types'
import type { AssessmentCondition, ConditionAssessment } from '../core/equipmentAssessment'

export interface OptimizeRequest {
  readonly id: number
  readonly inventory: Inventory
  readonly scenario: Scenario
  readonly includeEvaluationMetadata?: boolean
  readonly assessmentConditions?: readonly AssessmentCondition[]
}
export type OptimizeResponse =
  | { readonly id: number; readonly type: 'assessment-complete'; readonly assessments: readonly ConditionAssessment[]; readonly durationMs: number }
  | { readonly id: number; readonly type: 'complete'; readonly result: OptimizationResult; readonly evaluatedInstanceIds?: readonly string[]; readonly durationMs: number }
  | { readonly id: number; readonly type: 'error'; readonly error: string }

import type { Inventory, OptimizationResult, Scenario } from '../core/types'
import type { AssessmentCondition, ConditionAssessment } from '../core/equipmentAssessment'
import type { TrialConditionComparison } from '../core/trialConditionComparison'

export interface TrialComparisonInput {
  readonly baselineInventory: Inventory
  readonly candidateInstanceId: string
}

export interface OptimizeRequest {
  readonly id: number
  readonly inventory: Inventory
  readonly scenario: Scenario
  readonly includeEvaluationMetadata?: boolean
  readonly assessmentConditions?: readonly AssessmentCondition[]
  readonly trialComparison?: TrialComparisonInput
}
export type OptimizeResponse =
  | { readonly id: number; readonly type: 'assessment-complete'; readonly assessments: readonly ConditionAssessment[]; readonly durationMs: number }
  | { readonly id: number; readonly type: 'trial-comparison-complete'; readonly comparisons: readonly TrialConditionComparison[]; readonly durationMs: number }
  | { readonly id: number; readonly type: 'complete'; readonly result: OptimizationResult; readonly evaluatedInstanceIds?: readonly string[]; readonly durationMs: number }
  | { readonly id: number; readonly type: 'error'; readonly error: string }

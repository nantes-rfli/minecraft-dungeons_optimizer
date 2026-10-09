import type { Evaluation, Inventory, OptimizationResult, Scenario } from '../core/types'
import type { AssessmentCondition, ConditionAssessment } from '../core/equipmentAssessment'
import type { TrialConditionComparison } from '../core/trialConditionComparison'
import type { RemovalBaselineCondition, RemovalConditionComparison } from '../core/inventoryRemovalComparison'

export interface TrialComparisonInput {
  readonly baselineInventory: Inventory
  readonly candidateInstanceId: string
}

export interface RemovalComparisonInput {
  readonly instanceId: string
  readonly baseline: readonly RemovalBaselineCondition[]
}

export interface OptimizeRequest {
  readonly id: number
  readonly inventory: Inventory
  readonly scenario: Scenario
  readonly includeEvaluationMetadata?: boolean
  readonly equipmentInstanceId?: string
  readonly assessmentConditions?: readonly AssessmentCondition[]
  readonly trialComparison?: TrialComparisonInput
  readonly removalComparison?: RemovalComparisonInput
}
export type OptimizeResponse =
  | { readonly id: number; readonly type: 'assessment-complete'; readonly assessments: readonly ConditionAssessment[]; readonly durationMs: number }
  | { readonly id: number; readonly type: 'trial-comparison-complete'; readonly comparisons: readonly TrialConditionComparison[]; readonly durationMs: number }
  | { readonly id: number; readonly type: 'removal-comparison-complete'; readonly comparisons: readonly RemovalConditionComparison[]; readonly durationMs: number }
  | { readonly id: number; readonly type: 'complete'; readonly result: OptimizationResult; readonly evaluatedInstanceIds?: readonly string[]; readonly equipmentEvaluation?: Evaluation; readonly durationMs: number }
  | { readonly id: number; readonly type: 'error'; readonly error: string }

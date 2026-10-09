import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import type { Inventory, Scenario } from '../core/types'
import type { AssessmentCondition } from '../core/equipmentAssessment'
import type { RemovalComparisonInput, TrialComparisonInput } from './protocol'
import OptimizerWorker from './worker?worker'
import { IDLE_SEARCH, OptimizerController } from './controller'

export function useOptimizer(inventory: Inventory, scenario: Scenario, includeEvaluationMetadata = false, assessmentConditions?: readonly AssessmentCondition[], trialComparison?: TrialComparisonInput, removalComparison?: RemovalComparisonInput, equipmentInstanceId?: string) {
  const [controller] = useState(() => new OptimizerController(() => new OptimizerWorker()))
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot, () => IDLE_SEARCH)
  useEffect(() => {
    controller.reset()
    return () => controller.reset()
  }, [controller, inventory, scenario, assessmentConditions, trialComparison, removalComparison, equipmentInstanceId])
  // Hide the previous inputs' results immediately, before passive effect cleanup.
  const state = snapshot.request?.inventory === inventory && snapshot.request.scenario === scenario && snapshot.request.assessmentConditions === assessmentConditions && snapshot.request.trialComparison === trialComparison && snapshot.request.removalComparison === removalComparison && snapshot.request.equipmentInstanceId === equipmentInstanceId ? snapshot : IDLE_SEARCH
  const start = useCallback(() => controller.start({ inventory, scenario, includeEvaluationMetadata, assessmentConditions, trialComparison, removalComparison, equipmentInstanceId }), [controller, inventory, scenario, includeEvaluationMetadata, assessmentConditions, trialComparison, removalComparison, equipmentInstanceId])
  return { ...state, start, cancel: controller.cancel }
}

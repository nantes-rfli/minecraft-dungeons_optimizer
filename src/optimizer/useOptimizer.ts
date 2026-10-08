import { useEffect, useState, useSyncExternalStore } from 'react'
import type { Inventory, Scenario } from '../core/types'
import type { AssessmentCondition } from '../core/equipmentAssessment'
import OptimizerWorker from './worker?worker'
import { IDLE_SEARCH, OptimizerController } from './controller'

export function useOptimizer(inventory: Inventory, scenario: Scenario, includeEvaluationMetadata = false, assessmentConditions?: readonly AssessmentCondition[]) {
  const [controller] = useState(() => new OptimizerController(() => new OptimizerWorker()))
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot, () => IDLE_SEARCH)
  useEffect(() => {
    controller.reset()
    return () => controller.reset()
  }, [controller, inventory, scenario, assessmentConditions])
  // Hide the previous inputs' results immediately, before passive effect cleanup.
  const state = snapshot.request?.inventory === inventory && snapshot.request.scenario === scenario && snapshot.request.assessmentConditions === assessmentConditions ? snapshot : IDLE_SEARCH
  return { ...state, start: () => controller.start({ inventory, scenario, includeEvaluationMetadata, assessmentConditions }), cancel: controller.cancel }
}

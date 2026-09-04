import { useEffect, useState, useSyncExternalStore } from 'react'
import type { Inventory, Scenario } from '../core/types'
import OptimizerWorker from './worker?worker'
import { IDLE_SEARCH, OptimizerController } from './controller'

export function useOptimizer(inventory: Inventory, scenario: Scenario) {
  const [controller] = useState(() => new OptimizerController(() => new OptimizerWorker()))
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot, () => IDLE_SEARCH)
  useEffect(() => {
    controller.reset()
    return () => controller.reset()
  }, [controller, inventory, scenario])
  // Hide the previous inputs' results immediately, before passive effect cleanup.
  const state = snapshot.request?.inventory === inventory && snapshot.request.scenario === scenario ? snapshot : IDLE_SEARCH
  return { ...state, start: () => controller.start({ inventory, scenario }), cancel: controller.cancel }
}

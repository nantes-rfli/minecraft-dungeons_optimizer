import type { Inventory, OptimizationResult, Scenario } from '../core/types'

export interface OptimizeRequest {
  readonly id: number
  readonly inventory: Inventory
  readonly scenario: Scenario
}
export type OptimizeResponse =
  | { readonly id: number; readonly type: 'complete'; readonly result: OptimizationResult; readonly durationMs: number }
  | { readonly id: number; readonly type: 'error'; readonly error: string }

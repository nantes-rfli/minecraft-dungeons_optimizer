import { optimize, optimizeWithMetadata } from '../core/optimizer'
import type { OptimizeRequest, OptimizeResponse } from './protocol'

self.onmessage = (event: MessageEvent<OptimizeRequest>) => {
  const { id, inventory, scenario, includeEvaluationMetadata } = event.data
  let response: OptimizeResponse
  try {
    const start = performance.now()
    const execution = includeEvaluationMetadata ? optimizeWithMetadata(inventory, scenario) : undefined
    const result = execution?.result ?? optimize(inventory, scenario)
    response = {
      id,
      type: 'complete',
      result,
      ...(execution ? { evaluatedInstanceIds: execution.evaluatedInstanceIds } : {}),
      durationMs: performance.now() - start,
    }
  } catch (error) {
    response = { id, type: 'error', error: error instanceof Error ? error.message : '探索に失敗しました。' }
  }
  self.postMessage(response)
}

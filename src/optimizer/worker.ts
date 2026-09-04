import { optimize } from '../core/optimizer'
import type { OptimizeRequest, OptimizeResponse } from './protocol'

self.onmessage = (event: MessageEvent<OptimizeRequest>) => {
  const { id, inventory, scenario } = event.data
  let response: OptimizeResponse
  try {
    const start = performance.now()
    const result = optimize(inventory, scenario)
    response = { id, type: 'complete', result, durationMs: performance.now() - start }
  } catch (error) {
    response = { id, type: 'error', error: error instanceof Error ? error.message : '探索に失敗しました。' }
  }
  self.postMessage(response)
}

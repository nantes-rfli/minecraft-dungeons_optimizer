import { afterEach, describe, expect, it, vi } from 'vitest'
import { IDLE_SEARCH, OptimizerController, type WorkerPort } from '../src/optimizer/controller'
import type { OptimizeRequest, OptimizeResponse } from '../src/optimizer/protocol'
import { DEFAULT_SCENARIO } from '../src/data/scenarios'
import { optimizeWithMetadata } from '../src/core/optimizer'

const input = { inventory: { weapons: [{ instanceId: 'w', weaponId: 'double-axe' as const, powerLevel: 251, enchantmentSlots: [{ candidates: ['critical-hit' as const] }] }], artifacts: [] }, scenario: DEFAULT_SCENARIO }
class FakeWorker implements WorkerPort {
  onmessage: WorkerPort['onmessage'] = null
  onerror: WorkerPort['onerror'] = null
  onmessageerror: WorkerPort['onmessageerror'] = null
  postMessage = vi.fn<(message: OptimizeRequest) => void>()
  terminate = vi.fn()
  reply(data: OptimizeResponse) { this.onmessage?.({ data } as MessageEvent<OptimizeResponse>) }
}
afterEach(() => vi.useRealTimers())
describe('worker lifecycle', () => {
  it('completes with exactly the core exhaustive result and releases the worker', () => {
    const worker = new FakeWorker()
    const controller = new OptimizerController(() => worker)
    controller.start({ ...input, includeEvaluationMetadata: true })
    expect(controller.getSnapshot().status).toBe('working')
    const { result, evaluatedInstanceIds } = optimizeWithMetadata(input.inventory, input.scenario)
    worker.reply({ id: worker.postMessage.mock.calls[0]![0].id, type: 'complete', result, evaluatedInstanceIds, durationMs: 5 })
    expect(controller.getSnapshot()).toMatchObject({ status: 'complete', result, evaluatedInstanceIds, durationMs: 5 })
    expect(worker.terminate).toHaveBeenCalledOnce()
  })
  it('discards stale completion on cancel, restart, changed inputs and unmount reset', () => {
    const workers: FakeWorker[] = []
    const controller = new OptimizerController(() => { const w = new FakeWorker(); workers.push(w); return w })
    controller.start(input)
    const old = workers[0]!
    controller.cancel()
    old.reply({ id: old.postMessage.mock.calls[0]![0].id, type: 'error', error: 'stale' })
    expect(controller.getSnapshot().status).toBe('cancelled')
    expect(controller.getSnapshot().result).toBeNull()
    controller.start(input)
    old.reply({ id: old.postMessage.mock.calls[0]![0].id, type: 'error', error: 'stale' })
    expect(controller.getSnapshot().status).toBe('working')
    controller.reset()
    workers[1]!.reply({ id: workers[1]!.postMessage.mock.calls[0]![0].id, type: 'error', error: 'stale' })
    expect(controller.getSnapshot()).toEqual(IDLE_SEARCH)
    expect(workers[1]!.terminate).toHaveBeenCalledOnce()
  })
  it('reports input failures, runtime/transfer failures, startup failure and timeouts without partial results', () => {
    vi.useFakeTimers()
    const worker = new FakeWorker()
    const controller = new OptimizerController(() => worker, 100)
    controller.start(input)
    worker.reply({ id: worker.postMessage.mock.calls[0]![0].id, type: 'error', error: 'invalid input' })
    expect(controller.getSnapshot().error).toBe('invalid input')
    controller.start(input)
    worker.onerror?.({} as ErrorEvent)
    expect(controller.getSnapshot().status).toBe('error')
    controller.start(input)
    worker.onmessageerror?.({} as MessageEvent)
    expect(controller.getSnapshot().error).toContain('読み取れません')
    controller.start(input)
    vi.advanceTimersByTime(100)
    expect(controller.getSnapshot().error).toContain('時間上限')
    expect(controller.getSnapshot().result).toBeNull()
    const broken = new OptimizerController(() => { throw new Error('unavailable') })
    broken.start(input)
    expect(broken.getSnapshot().error).toContain('unavailable')
  })
})

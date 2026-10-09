import type { Evaluation, OptimizationResult } from '../core/types'
import type { ConditionAssessment } from '../core/equipmentAssessment'
import type { TrialConditionComparison } from '../core/trialConditionComparison'
import type { RemovalConditionComparison } from '../core/inventoryRemovalComparison'
import type { OptimizeRequest, OptimizeResponse } from './protocol'

export interface WorkerPort {
  onmessage: ((event: MessageEvent<OptimizeResponse>) => void) | null
  onerror: ((event: ErrorEvent) => void) | null
  onmessageerror: ((event: MessageEvent) => void) | null
  postMessage(message: OptimizeRequest): void
  terminate(): void
}
export interface SearchState {
  readonly status: 'idle' | 'working' | 'complete' | 'error' | 'cancelled'
  readonly result: OptimizationResult | null
  readonly evaluatedInstanceIds?: readonly string[]
  readonly equipmentEvaluation?: Evaluation
  readonly assessments?: readonly ConditionAssessment[]
  readonly trialComparisons?: readonly TrialConditionComparison[]
  readonly removalComparisons?: readonly RemovalConditionComparison[]
  readonly error: string | null
  readonly request?: OptimizeRequest
  readonly durationMs?: number
}
export const IDLE_SEARCH: SearchState = { status: 'idle', result: null, error: null }
export const SEARCH_TIMEOUT_MS = 60_000

export class OptimizerController {
  private worker: WorkerPort | null = null
  private timer: ReturnType<typeof setTimeout> | undefined
  private sequence = 0
  private state: SearchState = IDLE_SEARCH
  private listeners = new Set<() => void>()
  constructor(private readonly createWorker: () => WorkerPort, private readonly timeoutMs = SEARCH_TIMEOUT_MS) {}
  getSnapshot = (): SearchState => this.state
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }
  private publish(state: SearchState) {
    this.state = state
    this.listeners.forEach((listener) => listener())
  }
  private stop() {
    ++this.sequence
    clearTimeout(this.timer)
    this.worker?.terminate()
    this.worker = null
  }
  reset = () => { this.stop(); this.publish(IDLE_SEARCH) }
  cancel = () => {
    const request = this.state.request
    this.stop()
    this.publish({ status: 'cancelled', result: null, error: null, request })
  }
  start = (input: Omit<OptimizeRequest, 'id'>) => {
    this.stop()
    const id = this.sequence
    const request = { ...input, id }
    this.publish({ status: 'working', result: null, error: null, request })
    const fail = (error: string) => {
      if (id !== this.sequence) return
      this.stop()
      this.publish({ status: 'error', result: null, error, request })
    }
    try {
      const worker = this.createWorker()
      this.worker = worker
      worker.onmessage = ({ data }) => {
        if (id !== this.sequence || data.id !== id) return
        if (data.type === 'error') { fail(data.error); return }
        this.stop()
        if (data.type === 'assessment-complete') {
          this.publish({ status: 'complete', result: null, assessments: data.assessments, error: null, durationMs: data.durationMs, request })
          return
        }
        if (data.type === 'trial-comparison-complete') {
          this.publish({ status: 'complete', result: null, trialComparisons: data.comparisons, error: null, durationMs: data.durationMs, request })
          return
        }
        if (data.type === 'removal-comparison-complete') {
          this.publish({ status: 'complete', result: null, removalComparisons: data.comparisons, error: null, durationMs: data.durationMs, request })
          return
        }
        this.publish({ status: 'complete', result: data.result, evaluatedInstanceIds: data.evaluatedInstanceIds, ...(data.equipmentEvaluation ? { equipmentEvaluation: data.equipmentEvaluation } : {}), error: null, durationMs: data.durationMs, request })
      }
      worker.onerror = () => fail('探索Workerでエラーが発生しました。再度開始してください。')
      worker.onmessageerror = () => fail('探索結果を読み取れませんでした。再度開始してください。')
      this.timer = setTimeout(() => fail('探索の時間上限に達しました。結果は表示していません。候補を減らして再実行してください。'), this.timeoutMs)
      worker.postMessage(request)
    } catch (error) {
      fail(`探索Workerを開始できません: ${error instanceof Error ? error.message : '不明なエラー'}`)
    }
  }
}

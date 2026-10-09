import { optimize, optimizeWithMetadata } from '../core/optimizer'
import { assessEquipment } from '../core/equipmentAssessment'
import { compareTrialAcrossConditions } from '../core/trialConditionComparison'
import { compareRemovalAcrossConditions } from '../core/inventoryRemovalComparison'
import type { OptimizeRequest, OptimizeResponse } from './protocol'

self.onmessage = (event: MessageEvent<OptimizeRequest>) => {
  const { id, inventory, scenario, includeEvaluationMetadata, equipmentInstanceId, assessmentConditions, trialComparison, removalComparison } = event.data
  let response: OptimizeResponse
  try {
    const start = performance.now()
    if ((trialComparison || removalComparison) && !assessmentConditions) throw new Error('比較する条件を選んでください。')
    if (trialComparison && removalComparison) throw new Error('追加と除去の比較を同時に実行できません。')
    if (equipmentInstanceId !== undefined && (assessmentConditions || trialComparison || removalComparison)) throw new Error('個体別評価は単独の最適化で指定してください。')
    if (assessmentConditions && trialComparison) {
      response = { id, type: 'trial-comparison-complete', comparisons: compareTrialAcrossConditions(trialComparison.baselineInventory, inventory, trialComparison.candidateInstanceId, assessmentConditions), durationMs: performance.now() - start }
      self.postMessage(response)
      return
    }
    if (assessmentConditions && removalComparison) {
      response = { id, type: 'removal-comparison-complete', comparisons: compareRemovalAcrossConditions(inventory, removalComparison.instanceId, assessmentConditions, removalComparison.baseline), durationMs: performance.now() - start }
      self.postMessage(response)
      return
    }
    if (assessmentConditions) {
      response = { id, type: 'assessment-complete', assessments: assessEquipment(inventory, assessmentConditions), durationMs: performance.now() - start }
      self.postMessage(response)
      return
    }
    const execution = includeEvaluationMetadata || equipmentInstanceId !== undefined
      ? optimizeWithMetadata(inventory, scenario, equipmentInstanceId)
      : undefined
    const result = execution?.result ?? optimize(inventory, scenario)
    response = {
      id,
      type: 'complete',
      result,
      ...(execution ? { evaluatedInstanceIds: execution.evaluatedInstanceIds } : {}),
      ...(execution?.equipmentEvaluation ? { equipmentEvaluation: execution.equipmentEvaluation } : {}),
      durationMs: performance.now() - start,
    }
  } catch (error) {
    response = { id, type: 'error', error: error instanceof Error ? error.message : '探索に失敗しました。' }
  }
  self.postMessage(response)
}

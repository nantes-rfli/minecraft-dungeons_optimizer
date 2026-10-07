import { useEffect, useState } from 'react'
import type { Build, Inventory, Scenario } from '../core/types'
import { useOptimizer } from '../optimizer/useOptimizer'
import { estimateSearchCandidates, SEARCH_MAX_CANDIDATES } from '../core/searchBudget'
import { inventoryGridItems } from '../inventory/gridPresentation'
import { rangedWeaponUnsupportedReason } from '../core/ranged'
import { BuildAlternative } from '../views/RecommendedBuild'

const numberFormat = new Intl.NumberFormat('ja-JP', { maximumFractionDigits: 2 })

export interface NewDropTrial {
  readonly inventory: Inventory
  readonly instanceId: string
}

type OptimizerState = ReturnType<typeof useOptimizer>

function buildUsesInstance(build: Build, instanceId: string): boolean {
  return build.weapon.instanceId === instanceId
    || build.armor?.instanceId === instanceId
    || build.rangedWeapon?.instanceId === instanceId
    || build.artifacts.some((artifact) => artifact.instanceId === instanceId)
}

function MetricSummary({ label, evaluation }: { label: string; evaluation: NonNullable<OptimizerState['result']>['best'] }) {
  return <section className="drop-metric-card" aria-label={label}>
    <h3>{label}</h3>
    <p className="drop-objective-score">総合スコア <strong>{numberFormat.format(evaluation.objectiveScore)}</strong></p>
    <dl>
      <div><dt>単体DPS</dt><dd>{numberFormat.format(evaluation.damage.singleTargetDps)}</dd></div>
      <div><dt>AoE DPS</dt><dd>{numberFormat.format(evaluation.damage.aoeDps)}</dd></div>
      <div><dt>回復 / 秒</dt><dd>{numberFormat.format(evaluation.healing.totalPerSecond)}</dd></div>
      <div><dt>実効HP</dt><dd>{numberFormat.format(evaluation.defense.effectiveHealth)}</dd></div>
      <div><dt>Control / 100</dt><dd>{numberFormat.format(evaluation.control.utility * 100)}</dd></div>
    </dl>
  </section>
}

export function NewDropComparison({
  inventory,
  scenario,
  baseline,
  trial,
  onOpenPicker,
  onClearTrial,
}: {
  readonly inventory: Inventory
  readonly scenario: Scenario
  readonly baseline: OptimizerState
  readonly trial: NewDropTrial | null
  readonly onOpenPicker: () => void
  readonly onClearTrial: () => void
}) {
  const trialInventory = trial?.inventory ?? inventory
  const comparison = useOptimizer(trialInventory, scenario)
  const { start: startComparisonWorker, status: comparisonStatus, result: comparisonResult, error: comparisonError } = comparison
  const [pendingBaseline, setPendingBaseline] = useState<{ instanceId: string; inventory: Inventory } | null>(null)
  const candidate = trial ? inventoryGridItems(trial.inventory).find((item) => item.instanceId === trial.instanceId) : undefined
  const researchOnly = trial?.inventory.catalogItems?.find((item) => item.instanceId === trial.instanceId)
  const rangedCandidate = trial?.inventory.rangedWeapons?.find((item) => item.instanceId === trial.instanceId)
  const rangedBlocker = rangedCandidate ? rangedWeaponUnsupportedReason(rangedCandidate) : undefined
  const candidateEstimate = trial ? estimateSearchCandidates(trial.inventory) : 0
  const candidateOverBudget = trial !== null && candidateEstimate > SEARCH_MAX_CANDIDATES
  const resultsReady = Boolean(baseline.result && comparisonResult && comparisonStatus === 'complete')
  const candidateIncluded = trial && comparisonResult ? buildUsesInstance(comparisonResult.best.build, trial.instanceId) : false

  useEffect(() => {
    if (!trial || pendingBaseline?.instanceId !== trial.instanceId || pendingBaseline.inventory !== trial.inventory) return
    if (baseline.status === 'complete' && baseline.result && comparisonStatus === 'idle') startComparisonWorker()
  }, [baseline.status, baseline.result, comparisonStatus, startComparisonWorker, pendingBaseline, trial])

  const waitingForBaseline = Boolean(trial && pendingBaseline?.instanceId === trial.instanceId && pendingBaseline.inventory === trial.inventory && baseline.status !== 'complete' && baseline.status !== 'error' && baseline.status !== 'cancelled')

  const startComparison = () => {
    if (!trial || researchOnly || rangedBlocker || candidateOverBudget) return
    if (baseline.status === 'complete' && baseline.result) {
      startComparisonWorker()
      return
    }
    setPendingBaseline({ instanceId: trial.instanceId, inventory: trial.inventory })
    baseline.start()
  }

  const running = waitingForBaseline || baseline.status === 'working' || comparisonStatus === 'working'
  const blocker = researchOnly
    ? 'この装備は現在の計算対象外です。未対応の効果を0点として比較しません。'
    : rangedBlocker
  const scoreDelta = baseline.result && comparisonResult
    ? comparisonResult.best.objectiveScore - baseline.result.best.objectiveScore
    : undefined

  return <section className="new-drop-comparison" aria-labelledby="new-drop-title">
    <header><div><p className="section-label">NEW DROP</p><h2 id="new-drop-title">新しい装備を試す</h2></div></header>
    <p>ドロップした装備を1件だけ仮追加して、現在の最良ビルドと比べます。比較候補はInventoryへ保存されません。</p>
    {!trial ? <button className="secondary-button" type="button" onClick={onOpenPicker}>比較候補を選ぶ</button> : <>
      <div className="drop-candidate-summary"><strong>{candidate?.catalog.name.ja ?? candidate?.catalog.name.en ?? researchOnly?.catalogId ?? trial.instanceId}</strong><span>{candidate?.category ?? researchOnly?.category} · Power {candidate?.powerLevel ?? researchOnly?.powerLevel}</span></div>
      <div className="drop-candidate-actions"><button className="secondary-button" type="button" onClick={onOpenPicker}>候補を変更</button><button type="button" onClick={onClearTrial}>候補を外す</button></div>
      {blocker && <p className="drop-comparison-warning" role="note">{blocker}</p>}
      {candidateOverBudget && <p className="drop-comparison-warning" role="alert">この候補を含めると探索上限 {SEARCH_MAX_CANDIDATES.toLocaleString()} 通りを超えます。候補を減らしてください。</p>}
      <button className="primary-button" type="button" onClick={startComparison} disabled={running || Boolean(blocker) || candidateOverBudget}>現在の最良ビルドと比較</button>
      <p className="drop-comparison-status" role="status">{waitingForBaseline ? '現在のInventoryを探索しています…' : comparisonStatus === 'working' ? '仮追加後の候補を探索しています…' : comparisonStatus === 'complete' ? '比較が完了しました。' : comparisonStatus === 'error' || (pendingBaseline?.instanceId === trial.instanceId && baseline.status === 'error') ? '比較できませんでした。' : blocker ? '入力条件を確認してください。' : '同じ目的と条件で比較します。'}</p>
      {baseline.error && pendingBaseline?.instanceId === trial.instanceId && <p className="drop-comparison-warning" role="alert">{baseline.error}</p>}
      {comparisonError && <p className="drop-comparison-warning" role="alert">{comparisonError}</p>}
      {resultsReady && baseline.result && comparisonResult && <>
        <div className="drop-comparison-results">
          <MetricSummary label="現在の最良ビルド" evaluation={baseline.result.best} />
          <MetricSummary label="仮追加後の最良ビルド" evaluation={comparisonResult.best} />
        </div>
        <p className="drop-comparison-outcome">総合スコア差: {scoreDelta! >= 0 ? '+' : ''}{numberFormat.format(scoreDelta!)} · {candidateIncluded ? '新しい装備が最良ビルドに含まれています。' : '新しい装備は最良ビルドに選ばれませんでした。'}</p>
        <details className="drop-build-details"><summary>仮追加後の構成と現在との差を見る</summary><BuildAlternative title="仮追加後の最良構成" evaluation={comparisonResult.best} best={baseline.result.best} weights={scenario.weights} /></details>
      </>}
    </>}
  </section>
}

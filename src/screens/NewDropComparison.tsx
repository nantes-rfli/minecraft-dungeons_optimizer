import { useEffect, useMemo, useState } from 'react'
import type { AssessmentCondition } from '../core/equipmentAssessment'
import type { Build, Evaluation, Inventory, Scenario } from '../core/types'
import { useOptimizer } from '../optimizer/useOptimizer'
import { estimateSearchCandidates, SEARCH_MAX_CANDIDATES } from '../core/searchBudget'
import { inventoryGridItems } from '../inventory/gridPresentation'
import { rangedWeaponUnsupportedReason } from '../core/ranged'
import type { SavedScenarioPreset } from '../scenario/presets'
import { BuildAlternative } from '../views/RecommendedBuild'

const numberFormat = new Intl.NumberFormat('ja-JP', { maximumFractionDigits: 2 })
const formatGap = (gap: number) => gap > 0 && gap < 0.005 ? '0.01未満' : numberFormat.format(gap)

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

function MetricSummary({ label, evaluation }: { label: string; evaluation: Evaluation }) {
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

function formatSignedDifference(value: number): string {
  const formatted = numberFormat.format(value)
  if (formatted === '0' || formatted === '-0') return '0'
  return value > 0 ? `+${formatted}` : formatted
}

function MetricDeltaSummary({ before, after }: { before: Evaluation; after: Evaluation }) {
  const metrics = [
    { label: '単体DPS', value: after.damage.singleTargetDps - before.damage.singleTargetDps },
    { label: 'AoE DPS', value: after.damage.aoeDps - before.damage.aoeDps },
    { label: '回復 / 秒', value: after.healing.totalPerSecond - before.healing.totalPerSecond },
    { label: '実効HP', value: after.defense.effectiveHealth - before.defense.effectiveHealth },
    { label: 'Control / 100', value: (after.control.utility - before.control.utility) * 100 },
  ]

  return <section className="drop-metric-deltas" aria-label="候補追加前後の最良ビルドの指標差">
    <p><strong>候補追加前後の最良ビルドの指標差</strong></p>
    <p>同じ条件で評価した最良ビルド同士の差です。各指標は別々に表示します。</p>
    <dl>{metrics.map(({ label, value }) => <div key={label}><dt>{label}</dt><dd>{formatSignedDifference(value)}</dd></div>)}</dl>
  </section>
}

export function NewDropComparison({
  inventory,
  scenario,
  baseline,
  trial,
  presets,
  onOpenPicker,
  onClearTrial,
  onKeepCandidate,
}: {
  readonly inventory: Inventory
  readonly scenario: Scenario
  readonly baseline: OptimizerState
  readonly trial: NewDropTrial | null
  readonly presets: readonly SavedScenarioPreset[]
  readonly onOpenPicker: () => void
  readonly onClearTrial: () => void
  readonly onKeepCandidate: () => void
}) {
  const trialInventory = trial?.inventory ?? inventory
  const comparison = useOptimizer(trialInventory, scenario, true, undefined, undefined, undefined, trial?.instanceId)
  const { start: startComparisonWorker, status: comparisonStatus, result: comparisonResult, evaluatedInstanceIds, equipmentEvaluation, error: comparisonError } = comparison
  const [selectedPresetIds, setSelectedPresetIds] = useState<readonly string[]>([])
  const comparisonConditions = useMemo<readonly AssessmentCondition[]>(() => presets
    .filter((preset) => selectedPresetIds.includes(preset.id))
    .map((preset) => ({ id: `saved:${preset.id}`, name: preset.name, scenario: preset.scenario })), [presets, selectedPresetIds])
  const candidateInstanceId = trial?.instanceId
  const trialComparisonInput = useMemo(() => candidateInstanceId && comparisonConditions.length > 0
    ? { baselineInventory: inventory, candidateInstanceId }
    : undefined, [inventory, candidateInstanceId, comparisonConditions.length])
  const savedComparison = useOptimizer(trialInventory, scenario, false,
    comparisonConditions.length > 0 ? comparisonConditions : undefined, trialComparisonInput)
  const [pendingBaseline, setPendingBaseline] = useState<{ instanceId: string; inventory: Inventory } | null>(null)
  const candidate = trial ? inventoryGridItems(trial.inventory).find((item) => item.instanceId === trial.instanceId) : undefined
  const researchOnly = trial?.inventory.catalogItems?.find((item) => item.instanceId === trial.instanceId)
  const rangedCandidate = trial?.inventory.rangedWeapons?.find((item) => item.instanceId === trial.instanceId)
  const rangedBlocker = rangedCandidate ? rangedWeaponUnsupportedReason(rangedCandidate) : undefined
  const candidateEstimate = trial ? estimateSearchCandidates(trial.inventory) : 0
  const candidateOverBudget = trial !== null && candidateEstimate > SEARCH_MAX_CANDIDATES
  const candidateEvaluated = Boolean(trial && evaluatedInstanceIds?.includes(trial.instanceId))
  const candidateExclusionReasons = trial && comparisonResult
    ? comparisonResult.unsupportedChoices
      .filter((choice) => choice.startsWith(`${trial.instanceId}:`))
      .map((choice) => choice.slice(trial.instanceId.length + 1).trim())
    : []
  const candidateExcluded = Boolean(trial && comparisonResult && comparisonStatus === 'complete' && !candidateEvaluated)
  const candidateExclusionMessage = candidateExclusionReasons.length
    ? `この候補は比較に使えませんでした: ${candidateExclusionReasons.join(' / ')}`
    : 'この候補が評価対象に含まれていないため、比較結果を表示しません。'
  const resultsReady = Boolean(baseline.result && comparisonResult && comparisonStatus === 'complete' && candidateEvaluated && equipmentEvaluation)
  const candidateIncluded = trial && comparisonResult ? buildUsesInstance(comparisonResult.best.build, trial.instanceId) : false
  const savedComparisons = savedComparison.trialComparisons
  const savedCandidateEvaluated = Boolean(savedComparisons?.some((item) => item.status === 'complete' && item.candidate.status === 'evaluated'))

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

  const startSavedComparison = () => {
    if (!trial || comparisonConditions.length === 0 || researchOnly || rangedBlocker || candidateOverBudget) return
    savedComparison.start()
  }

  const running = waitingForBaseline || baseline.status === 'working' || comparisonStatus === 'working' || savedComparison.status === 'working'
  const blocker = researchOnly
    ? 'この装備は現在の計算対象外です。未対応の効果を0点として比較しません。'
    : rangedBlocker
  const scoreDelta = baseline.result && comparisonResult
    ? comparisonResult.best.objectiveScore - baseline.result.best.objectiveScore
    : undefined
  const savedComparisonStatus = savedComparison.status === 'working' ? '選んだ保存条件を比較しています…'
    : savedComparison.status === 'complete' ? savedCandidateEvaluated ? '保存済み条件の比較が完了しました。' : '選んだ保存条件では候補を数値評価できませんでした。'
      : savedComparison.status === 'error' ? '保存済み条件を比較できませんでした。'
        : savedComparison.status === 'cancelled' ? '保存済み条件の比較を中止しました。'
          : '選んだ条件ごとに追加前後を比べます。'

  return <section className="new-drop-comparison" aria-labelledby="new-drop-title">
    <header><div><p className="section-label">NEW DROP</p><h2 id="new-drop-title">新しい装備を試す</h2></div></header>
    <p>ドロップした装備を1件だけ仮追加して、現在の最良ビルドと比べます。比較結果を確認して残す場合は、候補をInventoryへ登録できます。</p>
    {!trial ? <button className="secondary-button" type="button" onClick={onOpenPicker}>比較候補を選ぶ</button> : <>
      <div className="drop-candidate-summary"><strong>{candidate?.catalog.name.ja ?? candidate?.catalog.name.en ?? researchOnly?.catalogId ?? trial.instanceId}</strong><span>{candidate?.category ?? researchOnly?.category} · Power {candidate?.powerLevel ?? researchOnly?.powerLevel}</span></div>
      <div className="drop-candidate-actions"><button className="secondary-button" type="button" onClick={onOpenPicker}>候補を変更</button><button type="button" onClick={onClearTrial}>候補を外す</button></div>
      {presets.length > 0 && <fieldset className="drop-condition-picker"><legend>保存済み条件でも比較</legend><p>選んだ条件では、現在のInventoryと候補追加後を別々に探索します。</p>{presets.map((preset) => <label key={preset.id}><input type="checkbox" checked={selectedPresetIds.includes(preset.id)} onChange={(event) => setSelectedPresetIds((current) => event.target.checked ? [...current, preset.id] : current.filter((id) => id !== preset.id))} />{preset.name}</label>)}</fieldset>}
      {blocker && <p className="drop-comparison-warning" role="note">{blocker}</p>}
      {candidateOverBudget && <p className="drop-comparison-warning" role="alert">この候補を含めると探索上限 {SEARCH_MAX_CANDIDATES.toLocaleString()} 通りを超えます。候補を減らしてください。</p>}
      <div className="drop-comparison-actions"><button className="primary-button" type="button" onClick={startComparison} disabled={running || Boolean(blocker) || candidateOverBudget || candidateExcluded}>現在の最良ビルドと比較</button>{comparisonConditions.length > 0 && <button type="button" onClick={startSavedComparison} disabled={running || Boolean(blocker) || candidateOverBudget}>選んだ保存条件で比較</button>}</div>
      <p className="drop-comparison-status" role="status">{candidateExcluded ? '仮候補は今回の探索で評価されませんでした。' : waitingForBaseline ? '現在のInventoryを探索しています…' : comparisonStatus === 'working' ? '仮追加後の候補を探索しています…' : comparisonStatus === 'complete' ? '比較が完了しました。' : comparisonStatus === 'error' || (pendingBaseline?.instanceId === trial.instanceId && baseline.status === 'error') ? '比較できませんでした。' : blocker ? '入力条件を確認してください。' : '同じ目的と条件で比較します。'}</p>
      {candidateExcluded && <p className="drop-comparison-warning" role="alert">{candidateExclusionMessage}</p>}
      {baseline.error && pendingBaseline?.instanceId === trial.instanceId && <p className="drop-comparison-warning" role="alert">{baseline.error}</p>}
      {comparisonError && <p className="drop-comparison-warning" role="alert">{comparisonError}</p>}
      {comparisonConditions.length > 0 && <>
        <div className="drop-saved-comparison-actions"><button type="button" onClick={() => savedComparison.cancel()} disabled={savedComparison.status !== 'working'}>保存条件の比較を中止</button><p className="drop-comparison-status" role="status">{savedComparisonStatus}</p></div>
        {savedComparison.error && <p className="drop-comparison-warning" role="alert">{savedComparison.error}</p>}
        {savedComparisons && <section className="drop-saved-comparisons" aria-label="保存済み条件のドロップ比較">
          <h3>保存済み条件の比較結果</h3>
          {savedComparisons.map((result) => <article key={result.condition.id} className="drop-saved-comparison">
            <h4>{result.condition.name}</h4>
            {result.status === 'error' ? <p className="drop-comparison-warning" role="alert">この条件は比較できませんでした: {result.error}</p> : <>
              <div className="drop-comparison-results">
                <MetricSummary label="候補追加前の最良ビルド" evaluation={result.baselineBest} />
                <MetricSummary label="候補追加後の最良ビルド" evaluation={result.withCandidateBest} />
              </div>
              {result.candidate.status === 'evaluated' && <MetricDeltaSummary before={result.baselineBest} after={result.withCandidateBest} />}
              <p className="drop-comparison-outcome">総合スコア差: {result.withCandidateBest.objectiveScore - result.baselineBest.objectiveScore >= 0 ? '+' : ''}{numberFormat.format(result.withCandidateBest.objectiveScore - result.baselineBest.objectiveScore)} · {buildUsesInstance(result.withCandidateBest.build, trial.instanceId) ? '候補が最良ビルドに含まれています。' : '候補は最良ビルドに選ばれませんでした。'}</p>
              {result.candidate.status === 'evaluated' ? <>
                <p>候補を必須にした最良スコア: {numberFormat.format(result.candidate.best.objectiveScore)} · 追加後の最良との差 {formatGap(result.candidate.scoreGap)}pt</p>
                <details className="drop-build-details"><summary>候補を使う構成と差を見る</summary><BuildAlternative title="候補を必須にした最良構成" evaluation={result.candidate.best} best={result.withCandidateBest} weights={result.condition.scenario.weights} /></details>
              </> : <p className="drop-comparison-warning" role="note">この条件では候補を数値評価できませんでした。{result.candidate.reasons.join(' / ')}</p>}
            </>}
          </article>)}
        </section>}
      </>}
      {resultsReady && baseline.result && comparisonResult && <>
        <div className="drop-comparison-results">
          <MetricSummary label="現在の最良ビルド" evaluation={baseline.result.best} />
          <MetricSummary label="仮追加後の最良ビルド" evaluation={comparisonResult.best} />
        </div>
        <MetricDeltaSummary before={baseline.result.best} after={comparisonResult.best} />
        <p className="drop-comparison-outcome">総合スコア差: {scoreDelta! >= 0 ? '+' : ''}{numberFormat.format(scoreDelta!)} · {candidateIncluded ? '新しい装備が最良ビルドに含まれています。' : '新しい装備は最良ビルドに選ばれませんでした。'}</p>
        <details className="drop-build-details"><summary>仮追加後の構成と現在との差を見る</summary><BuildAlternative title="仮追加後の最良構成" evaluation={comparisonResult.best} best={baseline.result.best} weights={scenario.weights} /></details>
        <section className="drop-candidate-build" aria-label="仮候補を使う最良構成">
          <MetricSummary label="候補を使う最良ビルド" evaluation={equipmentEvaluation!} />
          <p>候補を必須にした最良スコア: {numberFormat.format(equipmentEvaluation!.objectiveScore)} · 仮追加後の全体最良との差 {formatGap(comparisonResult.best.objectiveScore - equipmentEvaluation!.objectiveScore)}pt</p>
          <details className="drop-build-details"><summary>候補を使う構成と全体最良との差を見る</summary><BuildAlternative title="候補を使う最良構成" evaluation={equipmentEvaluation!} best={comparisonResult.best} weights={scenario.weights} /></details>
        </section>
        <button className="primary-button" type="button" onClick={onKeepCandidate}>この候補をInventoryに追加</button>
      </>}
    </>}
  </section>
}

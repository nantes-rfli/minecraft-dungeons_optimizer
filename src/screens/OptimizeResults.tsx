import type { OptimizationResult } from '../core/types'
import { estimatedParametersForBuild, type EvidencePolicy } from '../core/evidenceStatus'
import { summarizeDamageRegression } from '../core/modelError'
import { DAMAGE_REGRESSION_SAMPLES } from '../data/regressionSamples'
import { BuildAlternative, RecommendedBuild } from '../views/RecommendedBuild'
import { DpsRegressionPanel } from '../views/DpsRegressionPanel'
import { DirectDamageDetails } from '../views/DirectDamageDetails'
import { StateModelDetails } from '../views/StateModelDetails'
import { ControlDetails } from '../views/ControlDetails'
import { TemporalStateDetails } from '../views/TemporalStateDetails'
import { RuntimeSupportWarnings } from '../views/RuntimeSupport'
import { ChargeConsumeDetails } from '../views/ChargeConsumeDetails'
import { SoulStateDetails } from '../views/SoulStateDetails'
import { DamageEventDetails } from '../views/DamageEventControls'
import { RangedResult } from '../views/RangedEquipment'

const numberFormat = new Intl.NumberFormat('ja-JP', { maximumFractionDigits: 2 })
const CONFIDENCE_LABELS = { high: '高', medium: '中', low: '低' } as const
const DAMAGE_MODEL_ERROR = summarizeDamageRegression(DAMAGE_REGRESSION_SAMPLES)

export interface OptimizeResultsProps {
  readonly error: string | null
  readonly result: OptimizationResult | null
  readonly status: 'idle' | 'working' | 'complete' | 'cancelled' | 'error'
  readonly evidencePolicy?: EvidencePolicy
}

export function OptimizeResults({ error, result, status, evidencePolicy = 'include-estimated' }: OptimizeResultsProps) {
  const estimatedParameters = result ? estimatedParametersForBuild(result.best.build) : []
  return <section className="results optimize-results" aria-label="最適化結果">
    {error && <div className="error-panel" role="alert">{error}</div>}
    {!result && status !== 'working' && <div className="empty-state"><span aria-hidden="true">◎</span><h2>結果はここに表示されます</h2><p>まず目的を選び、「最適化する」を押してください。</p></div>}
    {status === 'working' && <div className="empty-state working"><span className="spinner" aria-hidden="true" /><h2>すべての候補を比較しています</h2><p>この間も探索を中止できます。</p></div>}
    {result && <>
      {result.unsupportedChoices.length > 0 && <div className="model-warning" role="note"><strong>未対応の候補は評価から除外しました（0点として採用しません）</strong>{result.unsupportedChoices.map((reason) => <p key={reason}>{reason}</p>)}</div>}
      <div className={`evidence-result ${estimatedParameters.length ? 'estimated' : 'strict'}`} role="note"><strong>{evidencePolicy === 'include-estimated' ? 'Estimatedを含めて評価' : '確度の高い情報のみで評価'}</strong>{estimatedParameters.length > 0 ? <><p>次のmechanic / parameterに推定値を使用しました。</p><ul>{estimatedParameters.map((parameter) => <li key={`${parameter.mechanicId}-${parameter.parameterId}`}><strong>{parameter.label}</strong><span>{parameter.basis}</span><small>{parameter.conditions} · version: {parameter.gameVersion} · confidence: {parameter.confidence}</small></li>)}</ul></> : <p>この結果には登録済みのEstimated parameterを使用していません。</p>}</div>
      <div className="result-meta"><span>{result.evaluatedBuildCount}通りを全探索</span><span>Evidence coverage {Math.round(result.best.confidence.coverageScore * 100)} / 100（{CONFIDENCE_LABELS[result.best.confidence.label]}）</span></div>
      <RecommendedBuild evaluation={result.best} />
      <section className="result-reasons" aria-labelledby="result-reasons-title"><h3 id="result-reasons-title">選ばれた理由</h3><ul>{result.best.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul></section>
      <h3 className="alternatives-title">次点候補</h3>
      <div className="alternatives">{result.alternatives.slice(0, 4).map((evaluation, index) => <BuildAlternative evaluation={evaluation} best={result.best} key={`alternative-${evaluation.build.weapon.instanceId}-${index}`} />)}</div>
      <details className="secondary-results"><summary>パレート候補を見る</summary><h3>Pareto前線</h3><div className="alternatives">{result.paretoFrontier.slice(0, 3).map((evaluation, index) => <BuildAlternative title={`PARETO ${index + 1}`} evaluation={evaluation} best={result.best} key={`pareto-${evaluation.build.weapon.instanceId}-${index}`} />)}</div></details>
      <details className="technical-results"><summary>計算と Evidence の詳細を見る</summary>
        <DpsRegressionPanel summary={DAMAGE_MODEL_ERROR} predictedDps={result.best.damage.singleTargetDps} />
        <RangedResult evaluation={result.best} />
        <DirectDamageDetails evaluation={result.best} />
        <StateModelDetails evaluation={result.best} />
        <ControlDetails evaluation={result.best} />
        <TemporalStateDetails evaluation={result.best} />
        <RuntimeSupportWarnings enchantments={result.best.build.enchantments} />
        <ChargeConsumeDetails evaluation={result.best} />
        <SoulStateDetails evaluation={result.best} />
        <DamageEventDetails evaluation={result.best} />
        <details className="contributions"><summary>効果ごとの数値寄与を見る</summary>
          {result.best.damage.painCycleState && <p>回復列は自己damageを差し引いたNet sustainの差分です。自己damageそのものは上の内訳に分離表示しています。</p>}
          {result.best.build.enchantments.some((item) => item.enchantmentId === 'refreshment') && <p>回復の差分にはRefreshmentの追加ポーション回復容量（実回復ではない近似）を含みます。</p>}
          <table className="contribution-table"><caption>効果別の寄与度</caption><thead><tr><th scope="col">効果</th><th scope="col">Score</th><th scope="col">AoE</th><th scope="col">回復</th><th scope="col">EHP</th><th scope="col">Control Δ</th></tr></thead><tbody>{result.best.contributions.map((item, index) => <tr key={`${item.sourceType}-${item.sourceId}-${index}`}><th scope="row">{item.label.ja}<small>{item.label.en}</small></th><td>{item.objectiveDelta >= 0 ? '+' : ''}{numberFormat.format(item.objectiveDelta)}</td><td>{numberFormat.format(item.aoeDpsDelta)}</td><td>{numberFormat.format(item.healingPerSecondDelta)}</td><td>{numberFormat.format(item.effectiveHealthDelta)}</td><td>{numberFormat.format(item.controlUtilityDelta * 100)}pt</td></tr>)}</tbody></table>
        </details>
        <section className="result-caveats"><h3>計算上の注意</h3><ul>{result.best.confidence.caveats.map((caveat) => <li key={caveat}>{caveat}</li>)}</ul></section>
      </details>
    </>}
  </section>
}

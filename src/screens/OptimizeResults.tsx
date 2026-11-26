import type { OptimizationResult, Scenario } from '../core/types'
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
import { EstimatedParameterDetails } from '../views/BuildEvidenceDetails'

const numberFormat = new Intl.NumberFormat('ja-JP', { maximumFractionDigits: 2 })
const minimumFormat = new Intl.NumberFormat('ja-JP', { maximumSignificantDigits: 17 })
const CONFIDENCE_LABELS = { high: '高', medium: '中', low: '低' } as const
const DAMAGE_MODEL_ERROR = summarizeDamageRegression(DAMAGE_REGRESSION_SAMPLES)

export interface OptimizeResultsProps {
  readonly weights: Scenario['weights']
  readonly error: string | null
  readonly result: OptimizationResult | null
  readonly status: 'idle' | 'working' | 'complete' | 'cancelled' | 'error'
  readonly evidencePolicy?: EvidencePolicy
  readonly showRecommendationMinimums?: boolean
}

export function OptimizeResults({ weights, error, result, status, evidencePolicy = 'include-estimated', showRecommendationMinimums }: OptimizeResultsProps) {
  const estimatedParameters = result ? estimatedParametersForBuild(result.best.build) : []
  const minimums = showRecommendationMinimums ? result?.recommendationMinimums : undefined
  return <section className="results optimize-results" aria-label="最適化結果">
    {error && <div className="error-panel" role="alert">{error}</div>}
    {!result && status !== 'working' && <div className="empty-state"><span aria-hidden="true">◎</span><h2>結果はここに表示されます</h2><p>まず目的を選び、「最適化する」を押してください。</p></div>}
    {status === 'working' && <div className="empty-state working"><span className="spinner" aria-hidden="true" /><h2>すべての候補を比較しています</h2><p>この間も探索を中止できます。</p></div>}
    {result && <>
      {result.unsupportedChoices.length > 0 && <div className="model-warning" role="note"><strong>未対応の候補は評価から除外しました（0点として採用しません）</strong>{result.unsupportedChoices.map((reason) => <p key={reason}>{reason}</p>)}</div>}
      <div className={`evidence-result ${estimatedParameters.length ? 'estimated' : 'strict'}`} role="note"><strong>{evidencePolicy === 'include-estimated' ? 'Estimatedを含めて評価' : '確度の高い情報のみで評価'}</strong><EstimatedParameterDetails parameters={estimatedParameters} /></div>
      <div className="result-meta"><span>{result.evaluatedBuildCount}通りを全探索</span><span>Evidence coverage {Math.round(result.best.confidence.coverageScore * 100)} / 100（{CONFIDENCE_LABELS[result.best.confidence.label]}）</span></div>
      <RecommendedBuild evaluation={result.best} weights={weights} />
      <section className="result-reasons" aria-labelledby="result-reasons-title"><h3 id="result-reasons-title">選ばれた理由</h3><ul>{result.best.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul></section>
      {minimums && <section className="result-reasons" aria-labelledby="recommendation-minimums-title">
        <h3 id="recommendation-minimums-title">下限を満たす最良構成</h3>
        <p>{[
          minimums.requested.singleTargetDps !== undefined && `単体DPS ${minimumFormat.format(minimums.requested.singleTargetDps)} 以上`,
          minimums.requested.effectiveHealth !== undefined && `実効HP ${minimumFormat.format(minimums.requested.effectiveHealth)} 以上`,
        ].filter(Boolean).join(' ／ ')}</p>
        {minimums.match.status === 'none' && <p>現在の探索で評価できた構成に、指定した下限をすべて満たすものはありません。</p>}
        {minimums.match.status === 'overall-best' && <p>通常の1位が、指定した下限をすべて満たしています。</p>}
        {minimums.match.status === 'alternative' && <>
          <p>単体DPS {minimumFormat.format(minimums.match.best.damage.singleTargetDps)} ／ 実効HP {minimumFormat.format(minimums.match.best.defense.effectiveHealth)}</p>
          <BuildAlternative title="下限を満たす候補" evaluation={minimums.match.best} best={result.best} weights={weights} />
        </>}
      </section>}
      <h3 className="alternatives-title">次点候補</h3>
      <p>Enchantの枠順だけが異なる同じ構成はまとめて表示します。個体・Tier・通常枠／Gildedが違う候補は別構成として残します。</p>
      {result.alternatives.length === 0 && <p>現在の条件で評価できる別構成の候補はありません。</p>}
      <div className="alternatives">{result.alternatives.slice(0, 4).map((evaluation, index) => <BuildAlternative evaluation={evaluation} best={result.best} weights={weights} key={`alternative-${evaluation.build.weapon.instanceId}-${index}`} />)}</div>
      <details className="secondary-results"><summary>パレート候補を見る</summary><h3>Pareto前線</h3><div className="alternatives">{result.paretoFrontier.slice(0, 3).map((evaluation, index) => <BuildAlternative title={`PARETO ${index + 1}`} evaluation={evaluation} best={result.best} weights={weights} key={`pareto-${evaluation.build.weapon.instanceId}-${index}`} />)}</div></details>
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
          <table className="contribution-table"><caption>効果別の寄与度</caption><thead><tr><th scope="col">効果</th><th scope="col">Score</th><th scope="col">AoE</th><th scope="col">回復</th><th scope="col">EHP</th><th scope="col">Control Δ</th></tr></thead><tbody>{result.best.contributions.map((item, index) => <tr key={`${item.sourceType}-${item.sourceId}-${index}`}><th scope="row">{item.enchantmentSource === 'built-in' && <span>Built-in </span>}{item.label.ja}<small>{item.label.en}</small></th><td>{item.objectiveDelta >= 0 ? '+' : ''}{numberFormat.format(item.objectiveDelta)}</td><td>{numberFormat.format(item.aoeDpsDelta)}</td><td>{numberFormat.format(item.healingPerSecondDelta)}</td><td>{numberFormat.format(item.effectiveHealthDelta)}</td><td>{numberFormat.format(item.controlUtilityDelta * 100)}pt</td></tr>)}</tbody></table>
        </details>
        <section className="result-caveats"><h3>計算上の注意</h3><ul>{result.best.confidence.caveats.map((caveat) => <li key={caveat}>{caveat}</li>)}</ul></section>
      </details>
    </>}
  </section>
}

import type { Scenario } from '../core/types'
import { SCENARIO_PROFILES } from '../data/scenarios'
import { SCORE_AXES, SCORE_AXIS_LABELS } from './objectiveScoreBreakdown'

const OBJECTIVE_AXES = [
  ...SCORE_AXES.map((key) => ({ key, label: SCORE_AXIS_LABELS[key] })),
] as const satisfies readonly { key: keyof Scenario['weights']; label: string }[]

const percentFormat = new Intl.NumberFormat('ja-JP', { maximumFractionDigits: 1 })

export function ObjectiveWeightsControls({ scenario, onChange }: { scenario: Scenario; onChange: (scenario: Scenario) => void }) {
  const total = OBJECTIVE_AXES.reduce((sum, { key }) => sum + scenario.weights[key], 0)
  const hasValidTotal = Number.isFinite(total) && total > 0
  const summary = hasValidTotal
    ? OBJECTIVE_AXES.map(({ key, label }) => `${label} ${percentFormat.format(scenario.weights[key] / total * 100)}%`).join(' · ')
    : '1つ以上の重みを0より大きくしてください'

  return <details className="objective-weight-settings">
    <summary><span>評価の重みを調整</span><small>{summary}</small></summary>
    <div className="objective-weight-controls">
      <p>数値が大きい軸ほど相対的に重視します。合計で正規化して総合スコアへ反映し、評価指標やゲーム効果の値は変更しません。</p>
      {OBJECTIVE_AXES.map(({ key, label }) => <label key={key}>
        <span>{label}<output>{hasValidTotal ? `${percentFormat.format(scenario.weights[key] / total * 100)}%` : '—'}</output></span>
        <input
          aria-label={`${label}の重み`}
          type="number"
          min="0"
          step="0.05"
          value={scenario.weights[key]}
          onChange={(event) => {
            const value = Number(event.currentTarget.value)
            if (!Number.isFinite(value) || value < 0) return
            onChange({ ...scenario, weights: { ...scenario.weights, [key]: value } })
          }}
        />
      </label>)}
      {!hasValidTotal && <p className="objective-weight-error" role="alert">最適化するには、少なくとも1つの重みを0より大きくしてください。</p>}
      <button
        className="objective-weight-reset"
        type="button"
        onClick={() => onChange({ ...scenario, weights: SCENARIO_PROFILES[scenario.profileId].weights })}
      >選択中の目的の重みに戻す</button>
    </div>
  </details>
}

import { calculatePredictionRange } from '../core/modelError'
import type { ModelErrorSummary } from '../core/types'

const numberFormat = new Intl.NumberFormat('ja-JP', { maximumFractionDigits: 2 })
const percent = (value: number): string => `${(value * 100).toFixed(1)}%`
const signedPercent = (value: number): string =>
  `${value >= 0 ? '+' : ''}${(value * 100).toFixed(1)}%`

export function DpsRegressionPanel({
  summary,
  predictedDps,
}: {
  readonly summary: ModelErrorSummary
  readonly predictedDps?: number
}) {
  const range = predictedDps === undefined
    ? undefined
    : calculatePredictionRange(predictedDps, summary)

  if (summary.status === 'pending') {
    return (
      <section className="regression-panel pending" aria-label="DPS実測回帰">
        <div><span>DPS実測回帰</span><strong>pending</strong></div>
        <p>公開条件を再現できる実測sample: {summary.sampleCount} / {summary.minimumSampleCount}</p>
        <small>参考範囲はまだ表示しません</small>
      </section>
    )
  }

  return (
    <section className="regression-panel available" aria-label="DPS実測回帰">
      <div><span>DPS実測回帰</span><strong>available</strong></div>
      <dl>
        <div><dt>P90誤差</dt><dd>±{percent(summary.p90AbsolutePercentageError)}</dd></div>
        <div><dt>MAPE</dt><dd>{percent(summary.meanAbsolutePercentageError)}</dd></div>
        <div><dt>Bias</dt><dd>{signedPercent(summary.meanSignedPercentageError)}</dd></div>
        <div><dt>sample</dt><dd>n = {summary.sampleCount}</dd></div>
      </dl>
      {predictedDps !== undefined && range && <p>
        予測DPS {numberFormat.format(predictedDps)} · 実測誤差P90ベース参考範囲{' '}
        {numberFormat.format(range.lower)}–{numberFormat.format(range.upper)}
      </p>}
      <small>既存実測の絶対誤差P90を使った参考値であり、90%信頼区間ではありません。</small>
    </section>
  )
}

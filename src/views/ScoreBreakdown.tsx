import type { Evaluation, Scenario } from '../core/types'
import { SCORE_AXIS_LABELS, scoreBreakdown } from './objectiveScoreBreakdown'

const numberFormat = new Intl.NumberFormat('ja-JP', { maximumFractionDigits: 2 })
const signed = (value: number) => `${value > 0 ? '+' : ''}${numberFormat.format(value)}`

export function ScoreBreakdown({ evaluation, weights, best }: { evaluation: Evaluation; weights: Scenario['weights']; best?: Evaluation }) {
  const rows = scoreBreakdown(evaluation.utilities, weights)
  const baseline = best ? scoreBreakdown(best.utilities, weights) : undefined
  return <details className="score-breakdown">
    <summary>{best ? '1位とのスコア差の内訳' : '総合スコアの内訳'}</summary>
    <p>評価した4軸に目的の重みを掛けて合計しています。DamageはAoE、Healingは自己ダメージを含む回復、Defenseは被ダメージ軽減、Controlは制御の評価です。値は現在のモデルとEvidence適用方針の範囲内です。</p>
    <div className="score-breakdown-scroll"><table>
      <caption>{best ? '目的ごとの加点と1位との差' : '目的ごとの評価と加点'}</caption>
      <thead><tr><th scope="col">評価軸</th><th scope="col">重み</th><th scope="col">評価 / 100</th><th scope="col">加点</th>{best && <th scope="col">1位との差</th>}</tr></thead>
      <tbody>{rows.map((row, index) => <tr key={row.axis}>
        <th scope="row">{SCORE_AXIS_LABELS[row.axis]}</th>
        <td>{numberFormat.format(row.weightPercent)}%</td>
        <td>{numberFormat.format(row.utilityPoints)}</td>
        <td>{numberFormat.format(row.scorePoints)}点</td>
        {baseline && <td>{signed(row.scorePoints - baseline[index]!.scorePoints)}点</td>}
      </tr>)}</tbody>
    </table></div>
    <p>自己ダメージが回復を上回るとHealingは負の加点になります。表示の丸めにより合計と総合スコアに差が出る場合があります。</p>
  </details>
}

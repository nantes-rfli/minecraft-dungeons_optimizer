import type { Evaluation, Scenario } from '../core/types'
import { describeChargeConsume } from '../core/chargeConsumeReasons'

export function ChargeConsumeControls({ scenario, onChange }: { scenario: Scenario; onChange: (value: Scenario) => void }) {
  return <details className="scenario-values"><summary>Charge / Consume 詳細設定（仮定）</summary>
    <label><span>平均ロール回数/秒</span><input aria-label="平均ロール回数/秒" type="number" min="0" step="0.1" value={scenario.rollsPerSecond ?? 0} onChange={(event) => onChange({ ...scenario, rollsPerSecond: Number(event.target.value) })} /></label>
    <label><span>Dynamo開始stack</span><input aria-label="Dynamo開始stack" type="number" min="0" max="20" step="1" value={scenario.dynamoInitialStacks ?? 0} onChange={(event) => onChange({ ...scenario, dynamoInitialStacks: Number(event.target.value) })} /></label>
    <p>初期値は両方0。DynamoはPower210–263、初期stackは整数0〜20。ロール時間による攻撃機会損失は未計上のため上限寄りの評価です。</p>
    <p>Pain Cycle / DynamoとCritical・Void・Sharpness・Unchanting・Ambush・Smiting・Artifact Synergy・Committedの組合せ、Pain + Dynamoは合成のEvidence不足で除外します。</p>
  </details>
}

export function ChargeConsumeDetails({ evaluation }: { evaluation: Evaluation }) {
  const { painCycleState: pain, dynamoState: dynamo } = evaluation.damage
  if (!pain && !dynamo) return null
  return <details className="contributions" open><summary>Charge / Consume・自己ダメージ</summary>
    {describeChargeConsume(evaluation).map((reason) => <p key={reason}>{reason}</p>)}
    {pain && <>
      <p>Gross healing {evaluation.healing.grossHealingCapacityPerSecond.toFixed(3)} HP/s ／ Pain Cycle self damage {evaluation.healing.selfDamagePerSecond.toFixed(3)} HP/s ／ Net sustain {evaluation.healing.netSustainPerSecond.toFixed(3)} HP/s</p>
      <p>有限列: base {pain.finiteBaseDamage.toFixed(3)} + bonus {pain.bonusDamage.toFixed(3)} = {pain.finiteTotalDamage.toFixed(3)} damage、自己damage合計 {pain.selfDamage.toFixed(3)}。主DPSは従来の平均baseに有限bonus/戦闘秒数を加算します。</p>
      <p>Net sustainは負値もranking/Paretoへ反映。自己damageにIron Hide・Guarding Strike・Weakeningは適用しません。死亡・最低HP・実回復の時系列は未モデル化です。</p>
    </>}
    {dynamo && <>
      <p>攻撃 {dynamo.attackActionsPerSecond.toFixed(4)}/秒（有限 {dynamo.totalAttackActions}回）、消費容量 {dynamo.consumptionCapacityPerSecond.toFixed(4)} stack/秒。長期消費 {dynamo.sustainedConsumedStacksPerSecond.toFixed(4)}/秒、有限消費 {dynamo.consumedStacksPerSecond.toFixed(4)}/秒（合計 {dynamo.totalConsumedStacks.toFixed(4)}）。</p>
      <p>overflow {dynamo.overflowStacksPerSecond.toFixed(4)}/秒、終了時未使用 {dynamo.unusedStacksAtEncounterEnd.toFixed(4)} stack。初期分は最初の攻撃で全消費し、終了後の攻撃へ先取りしません。</p>
    </>}
    <p>4武器限定のprofile hit≒攻撃action・初撃t=0・全攻撃命中のlow-confidence近似。AoEは既存の近接平均命中数へbonusを加算します。間接proc/DoTは増幅せず、直接撃破率は既存damage-share近似で再計算します。</p>
  </details>
}

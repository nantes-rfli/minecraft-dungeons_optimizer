import type { Evaluation } from '../core/types'

export function TemporalStateDetails({ evaluation }: { evaluation: Evaluation }) {
  const { artifactActivation, artifactSynergy, rampaging, attackSpeedMultiplier } = evaluation.temporalState
  const has = (id: string) => evaluation.build.enchantments.some((item) => item.enchantmentId === id)
  return <>
    {has('artifact-synergy') && <details className="contributions">
      <summary>Artifact Synergyの使用頻度・次攻撃の強化割合</summary>
      <p>Artifact使用 {artifactActivation.totalActivationsPerSecond.toFixed(4)}回/秒。持続中の稼働率とは別の値です。</p>
      <ul>{artifactActivation.activations.map((item) => <li key={item.instanceId}>{item.instanceId}: 推定CD {item.effectiveCooldownSeconds.toFixed(2)}秒 → {item.activationsPerSecond.toFixed(4)}回/秒</li>)}</ul>
      <p>攻撃機会 {artifactSynergy.eligibleDirectAttacksPerSecond.toFixed(4)}/秒 → 強化攻撃 {artifactSynergy.chargedAttacksPerSecond.toFixed(4)}/秒（{(artifactSynergy.chargedAttackShare * 100).toFixed(2)}%）。直接ダメージ期待倍率 {artifactSynergy.expectedDirectMultiplier.toFixed(4)}倍。</p>
      <p>{artifactActivation.activations.length === 0 ? 'Artifact未装備のため発動源がなく、寄与は0です。' : 'CDごとに使用し、別々の攻撃へ最適に分散できると仮定します。'} pending capacity 1、profile hitを1攻撃とみなすlow-confidence近似です。倍率はCommitted前に適用し、procは増幅しません。</p>
    </details>}
    {has('rampaging') && <details className="contributions">
      <summary>Rampagingの発動・稼働率・固定点計算</summary>
      <p>直接撃破 {rampaging.directWeaponKillsPerSecond.toFixed(4)}/秒 × {(rampaging.triggerChance * 100).toFixed(0)}% → 発動 {rampaging.triggerEventsPerSecond.toFixed(4)}/秒。合計持続 {rampaging.effectiveDurationSeconds}秒、推定稼働率 {(rampaging.uptime * 100).toFixed(2)}%。</p>
      <p>発動中 +{(rampaging.activeAttackSpeedBonus * 100).toFixed(0)}%、平均攻撃速度 +{(rampaging.averageAttackSpeedBonus * 100).toFixed(2)}%。Artifact速度倍率 {evaluation.artifactEffects.attackSpeedMultiplier.toFixed(4)} + Rampaging bonus = 最終 {attackSpeedMultiplier.toFixed(4)}倍。</p>
      <p>固定点 {rampaging.iterations}回、初回稼働率 {(rampaging.firstIterationUptime * 100).toFixed(2)}%、最終残差 {rampaging.residual.toExponential(2)}。許容誤差 1e-8・上限100回。速度→Void/proc/direct DPS→直接撃破→稼働率を再計算します。</p>
      <p>共通10%発動・コピーの秒数加算・再発動時refresh・Poisson近似。proc撃破は発動源に含めません。実際のon/off分布や高速武器のframe上限は未再現で、寄与を過大評価し得ます。</p>
    </details>}
  </>
}

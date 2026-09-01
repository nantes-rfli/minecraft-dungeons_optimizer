import type { Evaluation } from '../core/types'

export function SoulStateDetails({ evaluation }: { evaluation: Evaluation }) {
  const state = evaluation.soulState
  if (!state) return null
  const schedule = state.schedule
  const inferredLegacyDuration = state.fillTimeSeconds !== undefined && state.endSoulFraction === 1 && state.encounterAverageSoulFraction < 1
    ? state.fillTimeSeconds / (2 * (1 - state.encounterAverageSoulFraction))
    : 0
  const overflow = schedule?.overflowUnits ?? Math.max(0, state.totalResourceUnitsPerSecond * inferredLegacyDuration - state.capacity)
  return <details className="contributions">
    <summary>Soul Gathering・吸収回数・ゲージ推移</summary>
    <p>Soul Gathering {state.totalSoulGathering}（武器 {state.baseSoulGathering} + エンチャント {state.enchantmentSoulGathering} + Artifact {state.artifactSoulGathering ?? 0} + 外部 {state.externalSoulGathering}）。開始 {state.initialSouls}、容量 {state.capacity}。</p>
    <p>通常pickup {state.normalPickupEventsPerSecond.toFixed(3)}回/秒 + Siphon pickup {state.siphonPickupEventsPerSecond.toFixed(3)}回/秒 = 吸収 {state.totalPickupEventsPerSecond.toFixed(3)}回/秒。</p>
    <p>Resource収入 {state.totalResourceUnitsPerSecond.toFixed(3)}/秒（通常 {state.normalResourceUnitsPerSecond.toFixed(3)} + Siphon {state.siphonResourceUnitsPerSecond.toFixed(3)}）。満タン後の超過分も含む潜在収入で、実際のゲージ増分ではありません。</p>
    <p>平均Soul {schedule?.averageSouls.toFixed(2) ?? (state.encounterAverageSoulFraction * state.capacity).toFixed(2)}（{(state.encounterAverageSoulFraction * 100).toFixed(2)}%）、終了Soul {schedule?.endSouls.toFixed(2) ?? (state.endSoulFraction * state.capacity).toFixed(2)}（{(state.endSoulFraction * 100).toFixed(2)}%）。消費 {schedule?.totalSpentUnits.toFixed(2) ?? '0.00'}、overflow {overflow.toFixed(2)}。</p>
    {schedule?.consumers.map((consumer) => <p key={consumer.instanceId}>Soul Artifact実使用 {consumer.realizedUses}回（{consumer.realizedUsesPerSecond.toFixed(3)}回/秒）。CD上限 {consumer.cooldownLimitedUses}回、resource上限 {consumer.resourceLimitedUses}回、Soul不足 {consumer.missedForInsufficientSouls}回。</p>)}
    {state.siphonTriggerChance > 0 && <p>Soul Siphon: HPS {state.siphonOpportunitiesPerSecond.toFixed(3)} × 20% → proc {state.siphonProcEventsPerSecond.toFixed(3)}回/秒 × {state.siphonPickupsPerProc} pickups。profile hitごとに1回抽選し、AoE命中数は掛けない限定モデルです。</p>}
    {evaluation.build.enchantments.some((item) => item.enchantmentId === 'anima-conduit') && <p>Anima回復容量 {evaluation.healing.animaHealingCapacityPerSecond.toFixed(3)}/秒。Resource量でなくpickup回数を使います。満タン後も名目容量へ計上しますが、満タン時の実回復は未確認です。吸収遅延・overheal・HPが満タンに近い場合の回復低下を再現しません。</p>}
    <p>{schedule ? '一定収入と離散消費をevent単位で積分するmaximum feasible activation policyです。複数Soul spenderはpriority未指定のため拒否します。' : '開始0・一定収入・消費なしのlow-confidence連続近似です。'} Soul Artifact 3候補とEnigma ResonatorはEvidence不足のためresearch-onlyです。</p>
  </details>
}

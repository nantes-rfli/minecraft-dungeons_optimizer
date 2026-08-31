import type { Evaluation } from '../core/types'

export function SoulStateDetails({ evaluation }: { evaluation: Evaluation }) {
  const state = evaluation.soulState
  if (!state) return null
  return <details className="contributions">
    <summary>Soul Gathering・吸収回数・ゲージ推移</summary>
    <p>Soul Gathering {state.totalSoulGathering}（武器 {state.baseSoulGathering} + エンチャント {state.enchantmentSoulGathering} + 外部 {state.externalSoulGathering}）。開始 {state.initialSouls}、容量 {state.capacity}、消費 {state.spendingUnitsPerSecond}/秒。</p>
    <p>通常pickup {state.normalPickupEventsPerSecond.toFixed(3)}回/秒 + Siphon pickup {state.siphonPickupEventsPerSecond.toFixed(3)}回/秒 = 吸収 {state.totalPickupEventsPerSecond.toFixed(3)}回/秒。</p>
    <p>Resource収入 {state.totalResourceUnitsPerSecond.toFixed(3)}/秒（通常 {state.normalResourceUnitsPerSecond.toFixed(3)} + Siphon {state.siphonResourceUnitsPerSecond.toFixed(3)}）。満タン後の超過分も含む潜在収入で、実際のゲージ増分ではありません。</p>
    <p>平均Soulゲージ {(state.encounterAverageSoulFraction * 100).toFixed(2)}%、終了時 {(state.endSoulFraction * 100).toFixed(2)}%。満タンまで {state.fillTimeSeconds === undefined ? '収入なし' : `${state.fillTimeSeconds.toFixed(2)}秒`}。</p>
    {state.siphonTriggerChance > 0 && <p>Soul Siphon: HPS {state.siphonOpportunitiesPerSecond.toFixed(3)} × 20% → proc {state.siphonProcEventsPerSecond.toFixed(3)}回/秒 × {state.siphonPickupsPerProc} pickups。profile hitごとに1回抽選し、AoE命中数は掛けない限定モデルです。</p>}
    {evaluation.build.enchantments.some((item) => item.enchantmentId === 'anima-conduit') && <p>Anima回復容量 {evaluation.healing.animaHealingCapacityPerSecond.toFixed(3)}/秒。Resource量でなくpickup回数を使います。満タン後も名目容量へ計上しますが、満タン時の実回復は未確認です。吸収遅延・overheal・HPが満タンに近い場合の回復低下を再現しません。</p>}
    <p>開始0・一定収入・消費なしのlow-confidence連続近似です。Soul消費Artifact・防具・遠距離は未実装。Enigma Resonatorは発動率の換算式が未確認のためresearch-onlyです。</p>
  </details>
}

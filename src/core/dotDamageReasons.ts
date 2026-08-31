import type { AttachedDotDamageEvent, OnKillExplosionDamageEvent, PersistentAreaDotDamageEvent } from './types'

export function describeDotOrExplosion(event: AttachedDotDamageEvent | PersistentAreaDotDamageEvent | OnKillExplosionDamageEvent): string {
  const tier = ['I', 'II', 'III'][event.tier - 1]
  switch (event.kind) {
    case 'attached-dot':
      return `Fire Aspect ${tier}: burn ${event.damagePerSecond.toFixed(1)} DPS × 3秒refresh coverage ${(event.targetUptime * 100).toFixed(2)}% → 単体${event.singleTargetDps.toFixed(1)} / AoE ${event.aoeDps.toFixed(1)} indirect DPS（初撃t=0・有限encounter、同じ平均${event.expectedTargetsHit.toFixed(2)}体へ継続命中、1copy限定）`
    case 'persistent-area-dot':
      return `Poison Cloud ${tier}: HPS ${event.opportunitiesPerSecond.toFixed(3)} × 30% → cloud ${event.cloudSpawnsPerSecond.toFixed(3)}個/秒、${event.damagePerSecond.toFixed(1)} DPS、3秒cloud中の滞在${event.singleTargetResidenceSeconds}秒 / ${event.targetSecondsPerEvent} target-seconds/cloud → 飽和近似で単体${event.singleTargetDps.toFixed(1)} / AoE ${event.aoeDps.toFixed(1)} indirect DPS（Poisson定常・overlap未検証、low）`
    case 'on-kill-explosion':
      return `Exploding ${tier}: 直接撃破${event.sourceKillsPerSecond.toFixed(6)}/秒 × 敵HP${event.sourceHealth} × ${(event.healthFraction * 100).toFixed(0)}% × 二次対象${event.expectedSecondaryTargets}体 → ${event.aoeDps.toFixed(3)} AoE DPS（単体0・source自身を除外・連鎖なし、固定点で整合）`
  }
}

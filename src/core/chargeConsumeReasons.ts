import type { Evaluation } from './types'

export function describeChargeConsume(evaluation: Pick<Evaluation, 'damage' | 'healing'>): string[] {
  const { painCycleState: pain, dynamoState: dynamo } = evaluation.damage
  const reasons: string[] = []
  if (pain) reasons.push(`Pain Cycle: 5回charging × 最大HP3% → 6回目${pain.chargedMultiplier}x。攻撃${pain.totalAttackActions}回 / charging ${pain.chargingAttacks}回 / empowered ${pain.empoweredAttacks}回 / 終了stack ${pain.unusedStacksAtEncounterEnd}（${pain.endPhase}）。damage +${pain.directDps.toFixed(3)} direct DPS / self damage ${pain.selfDamagePerSecond.toFixed(3)} HP/s / net sustain ${evaluation.healing.netSustainPerSecond.toFixed(3)} HP/s。6回目はHP消費なし・stack0へresetのlow-confidence限定モデル。`)
  if (dynamo) reasons.push(`Dynamo: +${dynamo.damagePerStack.toFixed(3)}/stack、roll ${dynamo.rollsPerSecond}/秒、初期${dynamo.initialStacks} → 平均${dynamo.averageStacksPerAttack.toFixed(4)} stack/attack → +${dynamo.directDps.toFixed(3)} direct DPS。cap20、最初の攻撃 +${dynamo.firstAttackBonusDamage.toFixed(1)}。連続roll収入近似・roll時間コスト未計上（上限寄り）。`)
  return reasons
}

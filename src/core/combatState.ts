import type { CombatState, DamageMetrics, Scenario } from './types'

export function deriveCombatState(
  damage: DamageMetrics,
  scenario: Scenario,
): CombatState {
  const effectiveDamagePerSecond = damage.aoeDps
  const damageLimitedKillsPerSecond = effectiveDamagePerSecond / scenario.averageEnemyHealth
  const estimatedKillsPerSecond = Math.min(
    scenario.enemySupplyPerSecond,
    damageLimitedKillsPerSecond,
  )
  // Damage share is only an expected final-blow proxy, not an exact attribution.
  const directDamageShare = effectiveDamagePerSecond > 0
    ? damage.directWeaponAoeDps / effectiveDamagePerSecond : 1
  const directRangedDamageShare = damage.ranged && effectiveDamagePerSecond > 0 ? damage.ranged.directAoeDps / effectiveDamagePerSecond : 0
  const indirectDamageShare = damage.ranged ? Math.max(0, 1 - directDamageShare - directRangedDamageShare) : 1 - directDamageShare
  return {
    ...(damage.ranged ? { directRangedDamageShare, directRangedKillsPerSecond: estimatedKillsPerSecond * scenario.directKillShare * directRangedDamageShare } : {}),
    directDamageShare,
    indirectDamageShare,
    indirectEstimatedKillsPerSecond: estimatedKillsPerSecond * indirectDamageShare,
    effectiveDamagePerSecond,
    damageLimitedKillsPerSecond,
    estimatedKillsPerSecond,
    directWeaponKillsPerSecond: estimatedKillsPerSecond * scenario.directKillShare * directDamageShare,
  }
}

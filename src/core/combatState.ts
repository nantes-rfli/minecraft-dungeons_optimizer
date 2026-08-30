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
  const indirectDamageShare = 1 - directDamageShare
  return {
    directDamageShare,
    indirectDamageShare,
    indirectEstimatedKillsPerSecond: estimatedKillsPerSecond * indirectDamageShare,
    effectiveDamagePerSecond,
    damageLimitedKillsPerSecond,
    estimatedKillsPerSecond,
    directWeaponKillsPerSecond: estimatedKillsPerSecond * scenario.directKillShare * directDamageShare,
  }
}

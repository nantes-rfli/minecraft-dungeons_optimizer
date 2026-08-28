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
  return {
    effectiveDamagePerSecond,
    damageLimitedKillsPerSecond,
    estimatedKillsPerSecond,
    directWeaponKillsPerSecond: estimatedKillsPerSecond * scenario.directKillShare,
  }
}

import type { CombatState, DamageMetrics, Scenario } from './types'

export function deriveCombatState(
  damage: DamageMetrics,
  scenario: Scenario,
): CombatState {
  const effectiveDamagePerSecond = damage.aoeDps
  const damageLimitedKillsPerSecond = effectiveDamagePerSecond / scenario.averageEnemyHealth
  return {
    effectiveDamagePerSecond,
    damageLimitedKillsPerSecond,
    estimatedKillsPerSecond: Math.min(
      scenario.enemySupplyPerSecond,
      damageLimitedKillsPerSecond,
    ),
  }
}

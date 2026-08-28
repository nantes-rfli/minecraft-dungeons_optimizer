import { enchantmentsById, getTierValues } from './enchantment'
import type {
  ArtifactEffects,
  CombatState,
  DefenseMetrics,
  Scenario,
  SelectedEnchantment,
} from './types'

export function calculateDefense(
  enchantments: readonly SelectedEnchantment[],
  artifactEffects: ArtifactEffects,
  combatState: CombatState,
  scenario: Scenario,
): DefenseMetrics {
  const guarding = enchantmentsById(enchantments, 'guarding-strike')[0]
  const values = guarding ? getTierValues(guarding) : undefined
  const guardingStrikeUptime = guarding
    ? 1 - Math.exp(-combatState.directWeaponKillsPerSecond * (values?.durationSeconds ?? 0))
    : 0
  const guardingDamageMultiplier =
    1 - guardingStrikeUptime * (values?.damageReduction ?? 0)
  const damageTakenMultiplier =
    artifactEffects.damageTakenMultiplier * guardingDamageMultiplier
  const damageTakenPerSecond = scenario.incomingDamagePerSecond * damageTakenMultiplier

  return {
    guardingStrikeUptime,
    damageTakenMultiplier,
    damageTakenPerSecond,
    preventedDamagePerSecond: scenario.incomingDamagePerSecond - damageTakenPerSecond,
    effectiveHealth: scenario.maxHealth / damageTakenMultiplier,
  }
}

import { getEnchantmentDefinition } from './catalog'
import type { ArtifactEffects, DefenseMetrics, EnchantmentId, Scenario } from './types'

export function calculateDefense(
  enchantments: readonly EnchantmentId[],
  artifactEffects: ArtifactEffects,
  scenario: Scenario,
): DefenseMetrics {
  const guarding = getEnchantmentDefinition('guarding-strike')
  const guardingStrikeUptime = enchantments.includes('guarding-strike')
    ? 1 - Math.exp(-scenario.killsPerSecond * (guarding.durationSeconds?.value ?? 0))
    : 0
  const guardingDamageMultiplier =
    1 - guardingStrikeUptime * (guarding.damageReduction?.value ?? 0)
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

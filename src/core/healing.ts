import { getEnchantmentDefinition } from './catalog'
import type { DamageMetrics, EnchantmentId, HealingMetrics, Scenario } from './types'

export function calculateHealing(
  enchantments: readonly EnchantmentId[],
  damage: DamageMetrics,
  scenario: Scenario,
): HealingMetrics {
  const radiance = getEnchantmentDefinition('radiance')
  const leeching = getEnchantmentDefinition('leeching')
  const radiancePerSecond = enchantments.includes('radiance')
    ? damage.hitsPerSecond * (radiance.triggerChance?.value ?? 0) * scenario.radianceHealPerProc
    : 0
  const leechingPerSecond = enchantments.includes('leeching')
    ? scenario.killsPerSecond *
      scenario.averageEnemyHealth *
      scenario.directKillShare *
      (leeching.healingFraction?.value ?? 0)
    : 0

  return {
    radiancePerSecond,
    leechingPerSecond,
    totalPerSecond: radiancePerSecond + leechingPerSecond,
  }
}

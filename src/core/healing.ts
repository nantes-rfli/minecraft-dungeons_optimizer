import { combineEnchantmentValues } from './enchantment'
import type {
  CombatState,
  DamageMetrics,
  HealingMetrics,
  Scenario,
  SelectedEnchantment,
} from './types'

export function calculateHealing(
  enchantments: readonly SelectedEnchantment[],
  damage: DamageMetrics,
  combatState: CombatState,
  scenario: Scenario,
): HealingMetrics {
  const radianceProcHealing = combineEnchantmentValues(
    enchantments,
    'radiance',
    (values) => (values.triggerChance ?? 0) * (values.radianceHealMultiplier ?? 0),
  )
  const leechingFraction = combineEnchantmentValues(
    enchantments,
    'leeching',
    (values) => values.healingFraction ?? 0,
  )
  const radiancePerSecond = damage.hitsPerSecond * radianceProcHealing * scenario.radianceHealPerProc
  const leechingPerSecond = leechingFraction > 0
    ? combatState.directWeaponKillsPerSecond *
      scenario.averageEnemyHealth *
      leechingFraction
    : 0

  return {
    radiancePerSecond,
    leechingPerSecond,
    totalPerSecond: radiancePerSecond + leechingPerSecond,
  }
}

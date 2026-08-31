import { combineEnchantmentValues, getTierValues } from './enchantment'
import { animaHealingCapacity } from './souls'
import { derivePotionState } from './potion'
import type {
  CombatState,
  DamageMetrics,
  HealingMetrics,
  PotionState,
  Scenario,
  SelectedEnchantment,
  SoulState,
} from './types'

export function calculateHealing(
  enchantments: readonly SelectedEnchantment[],
  damage: DamageMetrics,
  combatState: CombatState,
  scenario: Scenario,
  potionState: PotionState = derivePotionState(enchantments, combatState, scenario),
  soulState?: SoulState,
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

  const anima = enchantments.find((item) => item.enchantmentId === 'anima-conduit')
  const animaEffect = anima ? getTierValues(anima).effect : undefined
  if (anima && (!soulState || animaEffect?.kind !== 'soul-pickup-healing')) throw new Error('Anima Conduit requires a resolved SoulState and healing effect')
  const animaHealingCapacityPerSecond = animaEffect?.kind === 'soul-pickup-healing'
    ? animaHealingCapacity(soulState!.totalPickupEventsPerSecond, scenario.maxHealth, animaEffect.maxHealthFractionPerPickup)
    : 0
  const grossHealingCapacityPerSecond = radiancePerSecond + leechingPerSecond + potionState.incrementalHealingCapacityPerSecond + animaHealingCapacityPerSecond
  const selfDamagePerSecond = damage.painCycleState?.selfDamagePerSecond ?? 0
  const netSustainPerSecond = grossHealingCapacityPerSecond - selfDamagePerSecond
  return {
    grossHealingCapacityPerSecond, selfDamagePerSecond, netSustainPerSecond,
    animaHealingCapacityPerSecond,
    radiancePerSecond,
    leechingPerSecond,
    refreshmentPotionCapacityPerSecond: potionState.incrementalHealingCapacityPerSecond,
    totalPerSecond: netSustainPerSecond,
  }
}

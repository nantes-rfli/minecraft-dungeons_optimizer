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
  resolvedMaxHealth = scenario.maxHealth,
  lifeStealFraction = 0,
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
    ? animaHealingCapacity(soulState!.totalPickupEventsPerSecond, resolvedMaxHealth, animaEffect.maxHealthFractionPerPickup)
    : 0
  const lifeStealPerSecond = damage.directWeaponAoeDps * lifeStealFraction
  const grossHealingCapacityPerSecond = radiancePerSecond + leechingPerSecond + potionState.incrementalHealingCapacityPerSecond + animaHealingCapacityPerSecond + lifeStealPerSecond
  const selfDamagePerSecond = damage.painCycleState?.selfDamagePerSecond ?? 0
  const netSustainPerSecond = grossHealingCapacityPerSecond - selfDamagePerSecond
  return {
    grossHealingCapacityPerSecond, selfDamagePerSecond, netSustainPerSecond,
    ...(lifeStealFraction > 0 ? { lifeStealPerSecond } : {}),
    animaHealingCapacityPerSecond,
    radiancePerSecond,
    leechingPerSecond,
    refreshmentPotionCapacityPerSecond: potionState.incrementalHealingCapacityPerSecond,
    totalPerSecond: netSustainPerSecond,
  }
}

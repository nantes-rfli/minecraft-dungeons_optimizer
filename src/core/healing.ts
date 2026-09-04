import { combineEnchantmentValues, getTierValues } from './enchantment'
import { animaHealingCapacity } from './souls'
import { derivePotionState } from './potion'
import type {
  ArtifactActivationState,
  CombatState,
  DamageMetrics,
  HealingMetrics,
  PotionState,
  Scenario,
  SelectedEnchantment,
  SoulState,
} from './types'
import type { SelectedArmorEnchantment } from './armor'
import { ARMOR_ENCHANTMENTS } from '../data/armors'

/** Cooldown-only runtime Artifacts supply steady-state capacity, not finite encounter uses. */
export function healthSynergyCapacity(steadyStateActivationCapacityPerSecond: number, resolvedMaxHealth: number, maxHealthFraction: number): number {
  return steadyStateActivationCapacityPerSecond * resolvedMaxHealth * maxHealthFraction
}

export function calculateHealing(
  enchantments: readonly SelectedEnchantment[],
  damage: DamageMetrics,
  combatState: CombatState,
  scenario: Scenario,
  potionState: PotionState = derivePotionState(enchantments, combatState, scenario),
  soulState?: SoulState,
  resolvedMaxHealth = scenario.maxHealth,
  lifeStealFraction = 0,
  armorEnchantments: readonly SelectedArmorEnchantment[] = [],
  artifactActivation?: ArtifactActivationState,
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
  const healthSynergy = armorEnchantments.find((item) => item.enchantmentId === 'health-synergy')
  const healthSynergyCapacityPerSecond = healthSynergy
    ? healthSynergyCapacity(artifactActivation?.totalActivationsPerSecond ?? 0, resolvedMaxHealth, ARMOR_ENCHANTMENTS['health-synergy'].tiers[healthSynergy.tier])
    : 0
  const grossHealingCapacityPerSecond = radiancePerSecond + leechingPerSecond + potionState.incrementalHealingCapacityPerSecond + animaHealingCapacityPerSecond + lifeStealPerSecond + healthSynergyCapacityPerSecond
  const selfDamagePerSecond = damage.painCycleState?.selfDamagePerSecond ?? 0
  const netSustainPerSecond = grossHealingCapacityPerSecond - selfDamagePerSecond
  return {
    grossHealingCapacityPerSecond, selfDamagePerSecond, netSustainPerSecond,
    ...(lifeStealFraction > 0 ? { lifeStealPerSecond } : {}),
    ...(healthSynergy ? { healthSynergyCapacityPerSecond } : {}),
    animaHealingCapacityPerSecond,
    radiancePerSecond,
    leechingPerSecond,
    refreshmentPotionCapacityPerSecond: potionState.incrementalHealingCapacityPerSecond,
    totalPerSecond: netSustainPerSecond,
  }
}

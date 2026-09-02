import { enchantmentsById, getTierValues } from './enchantment'
import { deriveEnemyDebuffState } from './enemyDebuffs'
import { ARMOR_ENCHANTMENTS } from '../data/armors'
import type {
  ArtifactEffects,
  CombatState,
  DefenseMetrics,
  Scenario,
  SelectedEnchantment,
  ArmorState,
  PotionState,
} from './types'

export function calculateDefense(
  enchantments: readonly SelectedEnchantment[],
  artifactEffects: ArtifactEffects,
  combatState: CombatState,
  scenario: Scenario,
  armorState?: ArmorState,
  potionState?: PotionState,
  resolvedMaxHealth = scenario.maxHealth,
): DefenseMetrics {
  const enemyDebuffs = deriveEnemyDebuffState(enchantments, scenario)
  const guarding = enchantmentsById(enchantments, 'guarding-strike')[0]
  const values = guarding ? getTierValues(guarding) : undefined
  const guardingStrikeUptime = guarding
    ? 1 - Math.exp(-combatState.directWeaponKillsPerSecond * (values?.durationSeconds ?? 0))
    : 0
  const guardingDamageMultiplier =
    1 - guardingStrikeUptime * (values?.damageReduction ?? 0)
  const armorDamageTakenMultiplier = 1 - (armorState?.armorDamageReduction ?? 0)
  const barrier = armorState?.selectedEnchantments.find((item) => item.enchantmentId === 'potion-barrier')
  const potionBarrierCoverage = barrier && potionState
    ? Math.min(1, ARMOR_ENCHANTMENTS['potion-barrier'].tiers[barrier.tier] / potionState.effectiveCooldownSeconds)
    : 0
  const potionBarrierDamageTakenMultiplier = 1 - 0.9 * potionBarrierCoverage
  const damageTakenMultiplier =
    enemyDebuffs.weakeningEnemyDamageMultiplier * artifactEffects.damageTakenMultiplier * guardingDamageMultiplier * armorDamageTakenMultiplier * potionBarrierDamageTakenMultiplier
  const damageTakenPerSecond = scenario.incomingDamagePerSecond * damageTakenMultiplier

  return {
    ...enemyDebuffs,
    guardingStrikeUptime,
    guardingStrikeDamageTakenMultiplier: guardingDamageMultiplier,
    artifactDamageTakenMultiplier: artifactEffects.damageTakenMultiplier,
    damageTakenMultiplier,
    damageTakenPerSecond,
    preventedDamagePerSecond: scenario.incomingDamagePerSecond - damageTakenPerSecond,
    effectiveHealth: resolvedMaxHealth / damageTakenMultiplier,
    ...(armorState ? { armorDamageTakenMultiplier } : {}),
    ...(barrier ? { potionBarrierCoverage } : {}),
  }
}

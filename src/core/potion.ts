import { HEALTH_POTION_BASE_COOLDOWN, HEALTH_POTION_HEAL_FRACTION } from '../data/potions'
import { enchantmentsById, getTierValues } from './enchantment'
import type { CombatState, PotionState, Scenario, SelectedEnchantment } from './types'

export function derivePotionState(
  enchantments: readonly SelectedEnchantment[],
  combatState: CombatState,
  scenario: Scenario,
): PotionState {
  const refreshment = enchantmentsById(enchantments, 'refreshment')[0]
  let refreshmentReductionPerDirectKillSeconds = 0
  if (refreshment) {
    const effect = getTierValues(refreshment).effect
    if (effect?.kind !== 'potion-cooldown-on-direct-kill') {
      throw new Error('Missing potion cooldown effect for refreshment')
    }
    refreshmentReductionPerDirectKillSeconds = effect.potionCooldownReductionSeconds
  }
  // Artifact cooldownReduction must never enter this independent health-potion channel.
  const baseCooldownSeconds = HEALTH_POTION_BASE_COOLDOWN.value
  const directWeaponKillsPerSecond = combatState.directWeaponKillsPerSecond
  const cooldownProgressRate = 1 + directWeaponKillsPerSecond * refreshmentReductionPerDirectKillSeconds
  const effectiveCooldownSeconds = baseCooldownSeconds / cooldownProgressRate
  const baseUsesPerSecond = 1 / baseCooldownSeconds
  const estimatedUsesPerSecond = 1 / effectiveCooldownSeconds
  const healPerUse = scenario.maxHealth * HEALTH_POTION_HEAL_FRACTION.value

  return {
    baseCooldownSeconds,
    refreshmentReductionPerDirectKillSeconds,
    directWeaponKillsPerSecond,
    cooldownProgressRate,
    effectiveCooldownSeconds,
    baseUsesPerSecond,
    estimatedUsesPerSecond,
    healPerUse,
    incrementalHealingCapacityPerSecond: healPerUse * (estimatedUsesPerSecond - baseUsesPerSecond),
  }
}

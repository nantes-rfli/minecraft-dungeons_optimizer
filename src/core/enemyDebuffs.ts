import { enchantmentsById, getTierValues } from './enchantment'
import type { EnemyDebuffState, Scenario, SelectedEnchantment } from './types'

export function deriveEnemyDebuffState(
  enchantments: readonly SelectedEnchantment[],
  scenario: Scenario,
): EnemyDebuffState {
  const weakening = enchantmentsById(enchantments, 'weakening')[0]
  if (!weakening) {
    return {
      weakeningAffectedIncomingDamageShare: 0,
      weakeningDamageReduction: 0,
      weakeningDurationSeconds: 0,
      weakeningEnemyDamageMultiplier: 1,
    }
  }
  const effect = getTierValues(weakening).effect
  if (effect?.kind !== 'enemy-damage-debuff') {
    throw new Error('Missing enemy damage debuff effect for weakening')
  }
  const share = scenario.enemyDebuffs.weakeningAffectedIncomingDamageShare
  return {
    weakeningAffectedIncomingDamageShare: share,
    weakeningDamageReduction: effect.enemyDamageReduction,
    weakeningDurationSeconds: effect.durationSeconds,
    // The share already includes five-second duration and attack/position coverage.
    weakeningEnemyDamageMultiplier: 1 - share * effect.enemyDamageReduction,
  }
}

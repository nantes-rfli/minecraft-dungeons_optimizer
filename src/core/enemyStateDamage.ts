import { combineDirectWeaponBonuses, enchantmentsById, getTierValues } from './enchantment'
import type { DirectDamageCondition, EnchantmentId, Scenario, SelectedEnchantment } from './types'

export function conditionExposure(condition: DirectDamageCondition, scenario: Scenario): number {
  switch (condition) {
    case 'enchanted-enemy': return scenario.enemyComposition.enchantedShare
    case 'undead-enemy': return scenario.enemyComposition.undeadShare
    case 'not-targeting-hero': return scenario.enemyState.ambushEligibleDirectDamageShare
  }
}

export function conditionalDirectDamage(
  enchantments: readonly SelectedEnchantment[],
  id: EnchantmentId,
  scenario: Scenario,
): { activeMultiplier: number; expectedMultiplier: number } {
  const selected = enchantmentsById(enchantments, id)[0]
  if (!selected) return { activeMultiplier: 1, expectedMultiplier: 1 }
  const effect = getTierValues(selected).effect
  if (effect?.kind !== 'conditional-weapon-damage') throw new Error(`Missing conditional weapon effect for ${id}`)
  // Copies share ONE condition. Combine while active, then mix once, never per copy.
  const bonus = combineDirectWeaponBonuses(enchantments, id)
  return { activeMultiplier: 1 + bonus, expectedMultiplier: 1 + conditionExposure(effect.condition, scenario) * bonus }
}

function validateBonus(bonus: number): void {
  if (!Number.isFinite(bonus) || bonus < 0 || bonus > 1) {
    throw new RangeError('Committed maxBonus must be finite and between 0 and 1')
  }
}

export function instantCommittedMultiplier(remainingHealthFraction: number, maxBonus: number): number {
  validateBonus(maxBonus)
  if (!Number.isFinite(remainingHealthFraction) || remainingHealthFraction < 0 || remainingHealthFraction > 1) {
    throw new RangeError('Committed remaining health fraction must be finite and between 0 and 1')
  }
  return 1 + maxBonus * (1 - remainingHealthFraction)
}

/** Fresh target -> defeat under continuous constant pre-boost direct D and proc P.
 * T/H = log1p(D*b/(D+P))/(D*b); proc itself is never boosted.
 */
export function committedTrajectory(directDps: number, indirectDps: number, maxBonus: number): {
  directMultiplier: number; effectiveDirectDps: number; effectiveTotalDps: number
} {
  validateBonus(maxBonus)
  for (const rate of [directDps, indirectDps]) {
    if (!Number.isFinite(rate) || rate < 0) throw new RangeError('Committed DPS inputs must be finite and nonnegative')
  }
  // Scale the ratio without overflowing D+P or losing a tiny direct channel.
  const directShare = directDps === 0 ? 0 : directDps >= indirectDps
    ? 1 / (1 + indirectDps / directDps)
    : (directDps / indirectDps) / (1 + directDps / indirectDps)
  const x = maxBonus * directShare
  // (effectiveTotal-P)/D = 1 + b * (x/log1p(x)-1)/x.
  // The series avoids cancellation for b->0 or P>>D (including underflow x=0).
  const healthLostAverage = x < 1e-4
    ? 0.5 - x / 12 + x * x / 24 - 19 * x * x * x / 720
    : (x / Math.log1p(x) - 1) / x
  const directMultiplier = directDps === 0 ? 1 : 1 + maxBonus * healthLostAverage
  const effectiveDirectDps = directDps * directMultiplier
  const effectiveTotalDps = effectiveDirectDps + indirectDps
  if (!Number.isFinite(effectiveTotalDps)) throw new RangeError('Committed resulting DPS exceeds finite numeric range')
  return { directMultiplier, effectiveDirectDps, effectiveTotalDps }
}

import type { AttackProfile, OwnedWeapon } from './types'
import { OptimizerInputError } from './errors'
import { combineDirectWeaponBonuses } from './enchantment'
import { fixedObservedMeleeComboEnchantments, RADIANCE_OBSERVED_MELEE_COMBO_ID, SHARPNESS_OBSERVED_MELEE_COMBO_ID } from '../data/fixedObservedMeleeCombo'
import { isObservedMeleeComboId } from '../data/observedMeleeCombo'

type MeleeDamageInput = Pick<OwnedWeapon, 'weaponId' | 'powerLevel' | 'observedDamagePerHit' | 'observedComboDamage'>

export function observedFixedRadianceHeal(weapon: OwnedWeapon): number | undefined {
  const observation = weapon.observedFixedRadiance
  return weapon.weaponId === RADIANCE_OBSERVED_MELEE_COMBO_ID && observation?.powerLevel === weapon.powerLevel
    && Number.isFinite(observation.healPerProc) && observation.healPerProc >= Number.EPSILON ? observation.healPerProc : undefined
}

export function hasObservedMeleeDamage(weapon: MeleeDamageInput): boolean {
  return isObservedMeleeComboId(weapon.weaponId)
    ? weapon.observedComboDamage?.powerLevel === weapon.powerLevel
    : weapon.observedDamagePerHit !== undefined
}

export function observedMeleeDamagePerHit(weapon: MeleeDamageInput, profile: AttackProfile): number | undefined {
  if (!isObservedMeleeComboId(weapon.weaponId)) return weapon.observedDamagePerHit
  const observation = weapon.observedComboDamage
  if (!observation || observation.powerLevel !== weapon.powerLevel || !Number.isFinite(observation.total)
    || observation.total <= 0 || weapon.observedDamagePerHit !== undefined
    || profile.method !== 'published-hit-timings' || profile.hitDurationsSeconds.length === 0) {
    throw new OptimizerInputError('MISSING_OBSERVED_COMBO_DAMAGE', 'この武器にはコンボ全段の観測ダメージ合計が必要です。')
  }
  // The legacy calculator consumes a hit average. For sustained complete combos
  // mean × hits/second = observed combo total / published combo seconds.
  const mean = observation.total / profile.hitDurationsSeconds.length
  if (weapon.weaponId !== SHARPNESS_OBSERVED_MELEE_COMBO_ID) return mean
  // Sharpness I already contributes to every recorded hit. Remove the owned
  // multiplier from the input so the existing direct model applies it once.
  const fixed = fixedObservedMeleeComboEnchantments(weapon.weaponId)
  return mean / (1 + combineDirectWeaponBonuses(fixed, 'sharpness'))
}

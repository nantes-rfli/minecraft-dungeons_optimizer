import type { AttackProfile, OwnedWeapon } from './types'
import { OptimizerInputError } from './errors'
import { isObservedMeleeComboId } from '../data/observedMeleeCombo'

type MeleeDamageInput = Pick<OwnedWeapon, 'weaponId' | 'observedDamagePerHit' | 'observedComboDamage'>

export function hasObservedMeleeDamage(weapon: MeleeDamageInput): boolean {
  return (isObservedMeleeComboId(weapon.weaponId) ? weapon.observedComboDamage : weapon.observedDamagePerHit) !== undefined
}

export function observedMeleeDamagePerHit(weapon: MeleeDamageInput, profile: AttackProfile): number | undefined {
  if (!isObservedMeleeComboId(weapon.weaponId)) return weapon.observedDamagePerHit
  if (weapon.observedComboDamage === undefined || !Number.isFinite(weapon.observedComboDamage)
    || weapon.observedComboDamage <= 0 || weapon.observedDamagePerHit !== undefined
    || profile.method !== 'published-hit-timings' || profile.hitDurationsSeconds.length === 0) {
    throw new OptimizerInputError('MISSING_OBSERVED_COMBO_DAMAGE', 'この武器にはコンボ全段の観測ダメージ合計が必要です。')
  }
  // The legacy calculator consumes a hit average. For sustained complete combos
  // mean × hits/second = observed combo total / published combo seconds.
  return weapon.observedComboDamage / profile.hitDurationsSeconds.length
}

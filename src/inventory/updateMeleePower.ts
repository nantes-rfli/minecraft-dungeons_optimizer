import type { OwnedWeapon } from '../core/types'

export function updateMeleePower(weapon: OwnedWeapon, powerLevel: number): OwnedWeapon {
  if (powerLevel === weapon.powerLevel) return weapon
  return { ...weapon, powerLevel, ...(weapon.observedComboDamage ? { observedComboDamage: undefined } : {}), ...(weapon.observedFixedRadiance ? { observedFixedRadiance: undefined } : {}) }
}

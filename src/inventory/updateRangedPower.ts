import { requiresBoundRangedObservation } from '../core/rangedFixedEffects'
import type { OwnedRangedWeapon } from '../core/rangedTypes'

export function updateRangedPower(weapon: OwnedRangedWeapon, powerLevel: number): OwnedRangedWeapon {
  if (weapon.powerLevel === powerLevel) return weapon
  return requiresBoundRangedObservation(weapon.weaponId) ? { ...weapon, powerLevel, observation: undefined } : { ...weapon, powerLevel }
}

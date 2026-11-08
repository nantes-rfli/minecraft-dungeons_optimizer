import { FIXED_RANGED_POWER, isFixedPowerBow } from './fixedPowerBowReuse.ts'
import { FIXED_RAPID_FIRE, isFixedRapidFireWeapon } from './fixedRapidFireReuse.ts'
import type { OwnedRangedWeapon } from './rangedTypes'

export const rangedFixedEffect = (id: string) => isFixedPowerBow(id) ? FIXED_RANGED_POWER : isFixedRapidFireWeapon(id) ? FIXED_RAPID_FIRE : undefined
export const requiresBoundRangedObservation = (id: string) => isFixedPowerBow(id) || isFixedRapidFireWeapon(id)

export function rangedObservationMatchesPower(weapon: OwnedRangedWeapon): boolean {
  if (isFixedPowerBow(weapon.weaponId)) return weapon.observation?.fixedPowerObservation?.powerLevel === weapon.powerLevel
  if (isFixedRapidFireWeapon(weapon.weaponId)) return weapon.observation?.fixedCadenceObservation?.powerLevel === weapon.powerLevel
  return true
}

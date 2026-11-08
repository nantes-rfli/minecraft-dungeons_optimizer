import { isFixedPowerBow } from '../core/fixedPowerBowReuse'
import type { OwnedRangedWeapon } from '../core/rangedTypes'

export function updateRangedPower(weapon: OwnedRangedWeapon, powerLevel: number): OwnedRangedWeapon {
  if (weapon.powerLevel === powerLevel) return weapon
  return isFixedPowerBow(weapon.weaponId) ? { ...weapon, powerLevel, observation: undefined } : { ...weapon, powerLevel }
}

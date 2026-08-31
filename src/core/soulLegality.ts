import { isSoulEnchantmentId } from '../data/souls'
import { getWeaponDefinition } from './catalog'
import { OptimizerInputError } from './errors'
import type { OwnedWeapon } from './types'

export function soulEnchantmentUnsupportedReason(weaponId: OwnedWeapon['weaponId'], id: string): string | undefined {
  if (!isSoulEnchantmentId(id)) return undefined
  if (!getWeaponDefinition(weaponId).soul.acceptsSoulEnchantments) return `${id}はSoul gear限定です。${weaponId}には装着できません。`
  if (id === 'enigma-resonator') return 'Enigma ResonatorはSoul量→発動率の根拠不足のためresearch-onlyです。'
  return undefined
}

/** Reject even unselected illegal inventory candidates, including fixed and gilded slots. */
export function validateWeaponSoulLegality(weapon: OwnedWeapon): void {
  const ids = weapon.enchantmentSlots.flatMap((slot) => [...slot.candidates, ...(slot.locked ? [slot.locked] : [])])
  if (weapon.gilded) ids.push(weapon.gilded.enchantmentId)
  for (const id of ids) {
    const reason = soulEnchantmentUnsupportedReason(weapon.weaponId, id)
    if (reason) throw new OptimizerInputError('INVALID_SOUL_ENCHANTMENT', reason)
  }
}

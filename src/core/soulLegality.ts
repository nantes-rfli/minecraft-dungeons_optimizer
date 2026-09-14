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

/**
 * Inventory validation only enforces whether an enchantment can exist on the
 * equipment. Runtime/research support is intentionally checked by the Optimizer
 * so a faithful owned-item record is never lost.
 */
export function validateWeaponSoulLegality(weapon: OwnedWeapon): void {
  const ids = weapon.enchantmentSlots.flatMap((slot) => [
    ...slot.candidates.map((candidate) => typeof candidate === 'string' ? candidate : (candidate as { enchantmentId: string }).enchantmentId),
    ...(slot.selected ? [slot.selected.enchantmentId] : (slot as { locked?: string }).locked ? [(slot as { locked: string }).locked] : []),
  ])
  if (weapon.gilded) ids.push(weapon.gilded.enchantmentId)
  for (const id of ids) {
    if (isSoulEnchantmentId(id) && !getWeaponDefinition(weapon.weaponId).soul.acceptsSoulEnchantments) {
      throw new OptimizerInputError('INVALID_SOUL_ENCHANTMENT', `${id}はSoul gear限定です。${weapon.weaponId}には装着できません。`)
    }
  }
}

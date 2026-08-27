import { ARTIFACTS } from '../data/artifacts'
import { ENCHANTMENTS } from '../data/enchantments'
import { WEAPONS } from '../data/weapons'
import type {
  ArtifactDefinition,
  ArtifactId,
  EnchantmentDefinition,
  EnchantmentId,
  WeaponDefinition,
  WeaponId,
} from './types'
import { OptimizerInputError } from './errors'

export function getWeaponDefinition(id: WeaponId): WeaponDefinition {
  const weapon = WEAPONS[id]
  if (!weapon) {
    throw new OptimizerInputError('UNKNOWN_WEAPON', `Unsupported weapon: ${id}`)
  }
  return weapon
}

export function getEnchantmentDefinition(id: EnchantmentId): EnchantmentDefinition {
  const enchantment = ENCHANTMENTS[id]
  if (!enchantment) {
    throw new OptimizerInputError('UNKNOWN_ENCHANTMENT', `Unsupported enchantment: ${id}`)
  }
  return enchantment
}

export function getArtifactDefinition(id: ArtifactId): ArtifactDefinition {
  const artifact = ARTIFACTS[id]
  if (!artifact) {
    throw new OptimizerInputError('UNKNOWN_ARTIFACT', `Unsupported artifact: ${id}`)
  }
  return artifact
}

import { ARTIFACTS } from '../data/artifacts'
import { ATTACK_PROFILES } from '../data/attackProfiles'
import { ENCHANTMENTS } from '../data/enchantments'
import { WEAPONS } from '../data/weapons'
import { ARMORS, ARMOR_ENCHANTMENTS } from '../data/armors'
import type { ArmorId, ArmorEnchantmentId } from './armor'
import type {
  ArtifactDefinition,
  ArtifactId,
  AttackProfile,
  Evidence,
  EnchantmentDefinition,
  EnchantmentId,
  WeaponDefinition,
  WeaponId,
} from './types'
import { OptimizerInputError } from './errors'

export function getWeaponDefinition(id: WeaponId): WeaponDefinition {
  const weapon = WEAPONS[id]
  if (!weapon) {
    throw new OptimizerInputError('UNKNOWN_WEAPON', `未対応の武器です: ${id}`)
  }
  return weapon
}

export function getAttackProfile(id: WeaponId): Evidence<AttackProfile> {
  const profile = ATTACK_PROFILES[id]
  if (!profile) {
    throw new OptimizerInputError('UNKNOWN_WEAPON', `Attack Profileがない武器です: ${id}`)
  }
  return profile
}

export function getEnchantmentDefinition(id: EnchantmentId): EnchantmentDefinition {
  const enchantment = ENCHANTMENTS[id]
  if (!enchantment) {
    throw new OptimizerInputError('UNKNOWN_ENCHANTMENT', `未対応のエンチャントです: ${id}`)
  }
  return enchantment
}

export function getArtifactDefinition(id: ArtifactId): ArtifactDefinition {
  const artifact = ARTIFACTS[id]
  if (!artifact) {
    throw new OptimizerInputError('UNKNOWN_ARTIFACT', `未対応のアーティファクトです: ${id}`)
  }
  return artifact
}

export function isRuntimeArmorId(id: string): id is ArmorId {
  return id in ARMORS
}

export function isRuntimeArmorEnchantmentId(id: string): id is ArmorEnchantmentId {
  return id in ARMOR_ENCHANTMENTS
}

export function getArmorDefinition(id: string) {
  if (!isRuntimeArmorId(id)) throw new OptimizerInputError('UNSUPPORTED_ARMOR_ID', `未対応のArmorです: ${id}`)
  return ARMORS[id]
}

export function getArmorEnchantmentDefinition(id: string) {
  if (!isRuntimeArmorEnchantmentId(id)) throw new OptimizerInputError('UNSUPPORTED_ARMOR_ENCHANTMENT', `未対応のArmor Enchantmentです: ${id}`)
  return ARMOR_ENCHANTMENTS[id]
}

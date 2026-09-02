import type { ArmorDefinition, ArmorEnchantmentId, ArmorEnchantmentTier, ArmorId } from '../core/armor'
import type { LocalizedName } from '../core/types'

export interface RuntimeArmorDefinition extends ArmorDefinition<ArmorId, ArmorEnchantmentId> {
  readonly name: LocalizedName
  readonly directMeleeDamageBonus: number
  readonly meleeAttackSpeedBonus: number
  readonly armorDamageReduction: number
  readonly soulGatheringMultiplier: number
  readonly lifeStealFraction: number
  readonly artifactCooldownReduction: number
  readonly supportLevel: 'limited'
}

export interface RuntimeArmorEnchantmentDefinition {
  readonly id: ArmorEnchantmentId
  readonly name: LocalizedName
  readonly tiers: Readonly<Record<ArmorEnchantmentTier, number>>
  readonly effect: 'artifact-cooldown-reduction' | 'potion-barrier-duration' | 'chilling-speed-reduction'
  readonly runtimeMaxCopies: 1
  readonly supportLevel: 'limited'
}

export const ARMORS: Readonly<Record<ArmorId, RuntimeArmorDefinition>> = {
  'battle-robe': {
    id: 'battle-robe', name: { en: 'Battle Robe', ja: 'バトルローブ' }, family: 'Battle Robe',
    soul: { acceptsSoulEnchantments: false }, builtInEnchantments: [],
    intrinsicProperties: [{ kind: 'artifact-cooldown', raw: '-40% artifact cooldown' }, { kind: 'melee-damage', raw: '+30% melee damage' }],
    directMeleeDamageBonus: 0.3, meleeAttackSpeedBonus: 0, armorDamageReduction: 0,
    soulGatheringMultiplier: 1, lifeStealFraction: 0, artifactCooldownReduction: 0.4, supportLevel: 'limited',
  },
  'renegade-armor': {
    id: 'renegade-armor', name: { en: 'Renegade Armor', ja: 'レネゲイドアーマー' }, family: 'Mercenary Armor',
    soul: { acceptsSoulEnchantments: false }, builtInEnchantments: [],
    intrinsicProperties: [{ kind: 'melee-attack-speed', raw: '+25% melee attack speed' }, { kind: 'weapon-damage-aura', raw: '+20% weapon damage boost aura' }, { kind: 'damage-reduction', raw: '35% damage reduction' }],
    directMeleeDamageBonus: 0.2, meleeAttackSpeedBonus: 0.25, armorDamageReduction: 0.35,
    soulGatheringMultiplier: 1, lifeStealFraction: 0, artifactCooldownReduction: 0, supportLevel: 'limited',
  },
  'wither-armor': {
    id: 'wither-armor', name: { en: 'Wither Armor', ja: 'ウィザーアーマー' }, family: 'Grim Armor',
    soul: { acceptsSoulEnchantments: true }, builtInEnchantments: [],
    intrinsicProperties: [{ kind: 'damage-reduction', raw: '35% damage reduction' }, { kind: 'soul-gathering', raw: '+50% souls gathered' }, { kind: 'life-steal-aura', raw: '6% life steal aura' }],
    directMeleeDamageBonus: 0, meleeAttackSpeedBonus: 0, armorDamageReduction: 0.35,
    soulGatheringMultiplier: 1.5, lifeStealFraction: 0.06, artifactCooldownReduction: 0, supportLevel: 'limited',
  },
}

export const ARMOR_ENCHANTMENTS: Readonly<Record<ArmorEnchantmentId, RuntimeArmorEnchantmentDefinition>> = {
  'cool-down': { id: 'cool-down', name: { en: 'Cool Down', ja: 'クールダウン' }, tiers: { 1: 0.18, 2: 0.29, 3: 0.37 }, effect: 'artifact-cooldown-reduction', runtimeMaxCopies: 1, supportLevel: 'limited' },
  'potion-barrier': { id: 'potion-barrier', name: { en: 'Potion Barrier', ja: 'ポーションバリア' }, tiers: { 1: 5, 2: 7, 3: 9 }, effect: 'potion-barrier-duration', runtimeMaxCopies: 1, supportLevel: 'limited' },
  chilling: { id: 'chilling', name: { en: 'Chilling', ja: '冷気' }, tiers: { 1: 0.2, 2: 0.4, 3: 0.6 }, effect: 'chilling-speed-reduction', runtimeMaxCopies: 1, supportLevel: 'limited' },
}

import type { ArmorDefinition, ArmorEnchantmentId, ArmorEnchantmentTier, ArmorId } from '../core/armor'
import type { LocalizedName } from '../core/types'

export interface RuntimeArmorDefinition extends ArmorDefinition<ArmorId, ArmorEnchantmentId> {
  readonly name: LocalizedName
  readonly meleeDamageBonus: number
  readonly weaponDamageAuraBonus: number
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
  readonly effect:
    | 'artifact-cooldown-reduction'
    | 'potion-barrier-duration'
    | 'chilling-speed-reduction'
    | 'artifact-activation-healing'
    | 'periodic-single-target-stun'
    | 'full-health-direct-melee-damage'
    | 'sole-source-damage-reduction'
  readonly runtimeMaxCopies: 1
  readonly supportLevel: 'limited'
}

export const ARMORS: Readonly<Record<ArmorId, RuntimeArmorDefinition>> = {
  'battle-robe': {
    id: 'battle-robe', name: { en: 'Battle Robe', ja: 'バトルローブ' }, family: 'Battle Robe',
    soul: { acceptsSoulEnchantments: false }, builtInEnchantments: [],
    intrinsicProperties: [{ kind: 'artifact-cooldown', raw: '-40% artifact cooldown' }, { kind: 'melee-damage', raw: '+30% melee damage' }],
    meleeDamageBonus: 0.3, weaponDamageAuraBonus: 0, meleeAttackSpeedBonus: 0, armorDamageReduction: 0,
    soulGatheringMultiplier: 1, lifeStealFraction: 0, artifactCooldownReduction: 0.4, supportLevel: 'limited',
  },
  'renegade-armor': {
    id: 'renegade-armor', name: { en: 'Renegade Armor', ja: 'レネゲイドアーマー' }, family: 'Mercenary Armor',
    soul: { acceptsSoulEnchantments: false }, builtInEnchantments: [],
    intrinsicProperties: [{ kind: 'melee-attack-speed', raw: '+25% melee attack speed' }, { kind: 'weapon-damage-aura', raw: '+20% weapon damage boost aura' }, { kind: 'damage-reduction', raw: '35% damage reduction' }],
    meleeDamageBonus: 0, weaponDamageAuraBonus: 0.2, meleeAttackSpeedBonus: 0.25, armorDamageReduction: 0.35,
    soulGatheringMultiplier: 1, lifeStealFraction: 0, artifactCooldownReduction: 0, supportLevel: 'limited',
  },
  'wither-armor': {
    id: 'wither-armor', name: { en: 'Wither Armor', ja: 'ウィザーアーマー' }, family: 'Grim Armor',
    soul: { acceptsSoulEnchantments: true }, builtInEnchantments: [],
    intrinsicProperties: [{ kind: 'damage-reduction', raw: '35% damage reduction' }, { kind: 'soul-gathering', raw: '+50% souls gathered' }, { kind: 'life-steal-aura', raw: '6% life steal aura' }],
    meleeDamageBonus: 0, weaponDamageAuraBonus: 0, meleeAttackSpeedBonus: 0, armorDamageReduction: 0.35,
    soulGatheringMultiplier: 1.5, lifeStealFraction: 0.06, artifactCooldownReduction: 0, supportLevel: 'limited',
  },
  'mercenary-armor': {
    id: 'mercenary-armor', name: { en: 'Mercenary Armor', ja: 'マーセナリーアーマー' }, family: 'Mercenary Armor',
    soul: { acceptsSoulEnchantments: false }, builtInEnchantments: [],
    intrinsicProperties: [{ kind: 'damage-reduction', raw: '35% damage reduction' }, { kind: 'weapon-damage-aura', raw: '+20% weapon damage boost aura' }],
    meleeDamageBonus: 0, weaponDamageAuraBonus: 0.2, meleeAttackSpeedBonus: 0, armorDamageReduction: 0.35,
    soulGatheringMultiplier: 1, lifeStealFraction: 0, artifactCooldownReduction: 0, supportLevel: 'limited',
  },
  'grim-armor': {
    id: 'grim-armor', name: { en: 'Grim Armor', ja: 'グリムアーマー' }, family: 'Grim Armor',
    soul: { acceptsSoulEnchantments: true }, builtInEnchantments: [],
    intrinsicProperties: [{ kind: 'soul-gathering', raw: '+50% souls gathered' }, { kind: 'life-steal-aura', raw: '6% life steal aura' }],
    meleeDamageBonus: 0, weaponDamageAuraBonus: 0, meleeAttackSpeedBonus: 0, armorDamageReduction: 0,
    soulGatheringMultiplier: 1.5, lifeStealFraction: 0.06, artifactCooldownReduction: 0, supportLevel: 'limited',
  },
  'scale-mail': {
    id: 'scale-mail', name: { en: 'Scale Mail', ja: 'スケイルメイル' }, family: 'Scale Mail',
    soul: { acceptsSoulEnchantments: false }, builtInEnchantments: [],
    intrinsicProperties: [{ kind: 'damage-reduction', raw: '35% damage reduction' }, { kind: 'melee-damage', raw: '+30% melee damage' }],
    meleeDamageBonus: 0.3, weaponDamageAuraBonus: 0, meleeAttackSpeedBonus: 0, armorDamageReduction: 0.35,
    soulGatheringMultiplier: 1, lifeStealFraction: 0, artifactCooldownReduction: 0, supportLevel: 'limited',
  },
  'spider-armor': {
    id: 'spider-armor', name: { en: 'Spider Armor', ja: 'スパイダーアーマー' }, family: 'Thief Armor',
    soul: { acceptsSoulEnchantments: false }, builtInEnchantments: [],
    intrinsicProperties: [{ kind: 'melee-attack-speed', raw: '+25% melee attack speed' }, { kind: 'life-steal-aura', raw: '6% life steal aura' }],
    meleeDamageBonus: 0, weaponDamageAuraBonus: 0, meleeAttackSpeedBonus: 0.25, armorDamageReduction: 0,
    soulGatheringMultiplier: 1, lifeStealFraction: 0.06, artifactCooldownReduction: 0, supportLevel: 'limited',
  },
}

export const ARMOR_ENCHANTMENTS: Readonly<Record<ArmorEnchantmentId, RuntimeArmorEnchantmentDefinition>> = {
  'cool-down': { id: 'cool-down', name: { en: 'Cool Down', ja: 'クールダウン' }, tiers: { 1: 0.18, 2: 0.29, 3: 0.37 }, effect: 'artifact-cooldown-reduction', runtimeMaxCopies: 1, supportLevel: 'limited' },
  'potion-barrier': { id: 'potion-barrier', name: { en: 'Potion Barrier', ja: 'ポーションバリア' }, tiers: { 1: 5, 2: 7, 3: 9 }, effect: 'potion-barrier-duration', runtimeMaxCopies: 1, supportLevel: 'limited' },
  chilling: { id: 'chilling', name: { en: 'Chilling', ja: '冷気' }, tiers: { 1: 0.2, 2: 0.4, 3: 0.6 }, effect: 'chilling-speed-reduction', runtimeMaxCopies: 1, supportLevel: 'limited' },
  'health-synergy': { id: 'health-synergy', name: { en: 'Health Synergy', ja: 'ヘルスシナジー' }, tiers: { 1: 0.03, 2: 0.04, 3: 0.05 }, effect: 'artifact-activation-healing', runtimeMaxCopies: 1, supportLevel: 'limited' },
  snowball: { id: 'snowball', name: { en: 'Snowball', ja: '雪玉' }, tiers: { 1: 5, 2: 3, 3: 1 }, effect: 'periodic-single-target-stun', runtimeMaxCopies: 1, supportLevel: 'limited' },
  cowardice: { id: 'cowardice', name: { en: 'Cowardice', ja: '臆病' }, tiers: { 1: 0.2, 2: 0.3, 3: 0.4 }, effect: 'full-health-direct-melee-damage', runtimeMaxCopies: 1, supportLevel: 'limited' },
  protection: { id: 'protection', name: { en: 'Protection', ja: '防護' }, tiers: { 1: 0.06, 2: 0.11, 3: 0.15 }, effect: 'sole-source-damage-reduction', runtimeMaxCopies: 1, supportLevel: 'limited' },
}

export const BASE_HERO_HEALTH = 100

export type ArmorIntrinsicPropertyKind =
  | 'damage-reduction'
  | 'chance-to-negate-hit'
  | 'melee-attack-speed'
  | 'melee-damage'
  | 'ranged-damage'
  | 'artifact-damage'
  | 'weapon-damage-aura'
  | 'artifact-cooldown'
  | 'potion-cooldown'
  | 'life-steal-aura'
  | 'soul-gathering'
  | 'move-speed-aura'
  | 'positive-status-duration'
  | 'roll-cooldown'
  | 'roll-speed'
  | 'roll-invulnerability'
  | 'roll-teleport'
  | 'roll-damage-or-control'
  | 'potion-heals-allies'
  | 'artifact-reset-on-potion'
  | 'pet-or-summon'
  | 'arrows-per-bundle'
  | 'threat-modifier'
  | 'environment-damage-reduction'
  | 'built-in-enchantment'
  | 'other'

export const ARMOR_INTRINSIC_PROPERTY_KINDS: readonly ArmorIntrinsicPropertyKind[] = [
  'damage-reduction', 'chance-to-negate-hit', 'melee-attack-speed', 'melee-damage',
  'ranged-damage', 'artifact-damage', 'weapon-damage-aura', 'artifact-cooldown',
  'potion-cooldown', 'life-steal-aura', 'soul-gathering', 'move-speed-aura',
  'positive-status-duration', 'roll-cooldown', 'roll-speed', 'roll-invulnerability',
  'roll-teleport', 'roll-damage-or-control', 'potion-heals-allies',
  'artifact-reset-on-potion', 'pet-or-summon', 'arrows-per-bundle', 'threat-modifier',
  'environment-damage-reduction', 'built-in-enchantment', 'other',
]

export interface ArmorIntrinsicProperty {
  readonly kind: ArmorIntrinsicPropertyKind
  readonly raw: string
}

export interface ArmorBuiltInEnchantment<TArmorEnchantmentId extends string = string> {
  readonly enchantmentId: TArmorEnchantmentId
  readonly tier?: 1 | 2 | 3
}

export interface ArmorDefinition<TArmorId extends string = string, TArmorEnchantmentId extends string = string> {
  readonly id: TArmorId
  readonly name: { readonly en: string; readonly ja?: string }
  readonly family: string
  readonly soul: {
    readonly acceptsSoulEnchantments: boolean
    readonly intrinsicSoulModifier?: unknown
  }
  readonly intrinsicProperties: readonly ArmorIntrinsicProperty[]
  readonly builtInEnchantments: readonly ArmorBuiltInEnchantment<TArmorEnchantmentId>[]
}

export interface EquipmentEnchantmentSlot<TEnchantmentId extends string> {
  readonly candidates: readonly TEnchantmentId[]
  readonly locked?: TEnchantmentId
}

export interface ArmorGildedEnchantment<TArmorEnchantmentId extends string = string> {
  readonly enchantmentId: TArmorEnchantmentId
  readonly tier: 1 | 2 | 3
}

export interface OwnedArmor<TArmorId extends string = string, TArmorEnchantmentId extends string = string> {
  readonly instanceId: string
  readonly armorId: TArmorId
  readonly powerLevel: number
  /** Exact +X Health shown on this owned Armor card. */
  readonly observedHealthBonus?: number
  readonly enchantmentSlots: readonly EquipmentEnchantmentSlot<TArmorEnchantmentId>[]
  readonly gilded?: ArmorGildedEnchantment<TArmorEnchantmentId>
  readonly locked?: boolean
  /** Required for Mystery Armor and any future variable intrinsic roll. */
  readonly actualIntrinsicRolls?: readonly ArmorIntrinsicProperty[]
}

export type HealthSource =
  | { readonly kind: 'legacy-scenario'; readonly maxHealth: number }
  | { readonly kind: 'armor-observed'; readonly armorHealthBonus: number }
  | { readonly kind: 'armor-model'; readonly armorHealthBonus: number; readonly powerLevel: number; readonly modelId: string }

export interface ResolvedHealthState {
  readonly source: HealthSource
  readonly baseHeroHealth: number
  readonly armorHealthBonus: number
  readonly preModifierMaxHealth: number
  readonly finalMaxHealth: number
}

const finiteNonNegative = (value: number, label: string) => {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${label} must be finite and non-negative`)
}

/**
 * Isolated migration contract. The current evaluator intentionally continues to use Scenario.maxHealth.
 * Armor and legacy final-health sources cannot be combined or silently averaged.
 */
export function resolveHealthState(source: HealthSource): ResolvedHealthState {
  if (source.kind === 'legacy-scenario') {
    finiteNonNegative(source.maxHealth, 'legacy maxHealth')
    return { source, baseHeroHealth: BASE_HERO_HEALTH, armorHealthBonus: 0, preModifierMaxHealth: source.maxHealth, finalMaxHealth: source.maxHealth }
  }
  finiteNonNegative(source.armorHealthBonus, 'armor health bonus')
  if (source.kind === 'armor-model') {
    if (!Number.isFinite(source.powerLevel) || source.powerLevel <= 0 || !source.modelId.trim()) throw new Error('modeled Armor health requires a positive Power and model ID')
  }
  const preModifierMaxHealth = BASE_HERO_HEALTH + source.armorHealthBonus
  return { source, baseHeroHealth: BASE_HERO_HEALTH, armorHealthBonus: source.armorHealthBonus, preModifierMaxHealth, finalMaxHealth: preModifierMaxHealth }
}

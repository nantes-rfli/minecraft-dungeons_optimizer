import { ARMORS, ARMOR_ENCHANTMENTS } from '../data/armors'
import type { Build, Scenario } from './types'

export const BASE_HERO_HEALTH = 100

export type ArmorId = 'battle-robe' | 'renegade-armor' | 'wither-armor'
export type ArmorEnchantmentId = 'cool-down' | 'potion-barrier' | 'chilling'
export type ArmorEnchantmentTier = 1 | 2 | 3

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

export interface ArmorEnchantmentRoll<TArmorEnchantmentId extends string = string> {
  readonly enchantmentId: TArmorEnchantmentId
  readonly tier: ArmorEnchantmentTier
}

export interface ArmorEnchantmentSlot<TArmorEnchantmentId extends string = string> {
  readonly candidates: readonly ArmorEnchantmentRoll<TArmorEnchantmentId>[]
  readonly locked?: TArmorEnchantmentId
}

export interface OwnedArmor<TArmorId extends string = string, TArmorEnchantmentId extends string = string> {
  readonly instanceId: string
  readonly armorId: TArmorId
  readonly powerLevel: number
  /** Exact +X Health shown on this owned Armor card. */
  readonly observedHealthBonus?: number
  readonly enchantmentSlots: readonly ArmorEnchantmentSlot<TArmorEnchantmentId>[]
  readonly gilded?: ArmorGildedEnchantment<TArmorEnchantmentId>
  readonly locked?: boolean
  /** Required for Mystery Armor and any future variable intrinsic roll. */
  readonly actualIntrinsicRolls?: readonly ArmorIntrinsicProperty[]
}

export interface SelectedArmorEnchantment {
  readonly enchantmentId: ArmorEnchantmentId
  readonly tier: ArmorEnchantmentTier
  readonly source: 'slot' | 'gilded' | 'built-in'
}

export interface ArtifactCooldownModifierState {
  readonly externalScenarioReduction: number
  readonly armorIntrinsicReduction: number
  readonly armorEnchantReductions: readonly number[]
  readonly compositionModel: 'external-only' | 'armor-only' | 'enchant-only'
  readonly effectiveCooldownMultiplier: number
}

export interface RuntimeArmorState {
  readonly armorId: ArmorId
  readonly instanceId: string
  readonly observedHealthBonus: number
  readonly finalMaxHealth: number
  readonly selectedEnchantments: readonly SelectedArmorEnchantment[]
  readonly directMeleeDamageMultiplier: number
  readonly meleeAttackSpeedBonus: number
  readonly armorDamageReduction: number
  readonly soulGatheringMultiplier: number
  readonly lifeStealFraction: number
  readonly artifactCooldown: ArtifactCooldownModifierState
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
 * Isolated migration contract. Armor and legacy final-health sources cannot be
 * combined or silently averaged.
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

export function selectedArmorEnchantments(build: Build): readonly SelectedArmorEnchantment[] {
  return build.armorEnchantments ?? []
}

export function resolveBuildHealth(build: Build, scenario: Scenario): ResolvedHealthState {
  if (!build.armor) return resolveHealthState({ kind: 'legacy-scenario', maxHealth: scenario.maxHealth })
  if (build.armor.observedHealthBonus === undefined) throw new Error('MISSING_OBSERVED_ARMOR_HEALTH: runtime Armorにはカード表示の+Healthが必要です。')
  return resolveHealthState({ kind: 'armor-observed', armorHealthBonus: build.armor.observedHealthBonus })
}

export function armorCombinationUnsupportedReason(build: Build, scenario: Scenario): string | undefined {
  if (!build.armor) return undefined
  const armor = ARMORS[build.armor.armorId as ArmorId]
  if (!armor) return `UNSUPPORTED_ARMOR_ID: ${build.armor.armorId}`
  if (build.armor.observedHealthBonus === undefined) return 'MISSING_OBSERVED_ARMOR_HEALTH: Armor cardの+Healthを入力してください。'
  const selected = selectedArmorEnchantments(build)
  const counts = new Map<string, number>()
  for (const enchantment of selected) {
    if (!(enchantment.enchantmentId in ARMOR_ENCHANTMENTS)) return `UNSUPPORTED_ARMOR_ENCHANTMENT: ${enchantment.enchantmentId}`
    const count = (counts.get(enchantment.enchantmentId) ?? 0) + 1
    counts.set(enchantment.enchantmentId, count)
    if (count > 1) return `UNSUPPORTED_ARMOR_COMBINATION: ${enchantment.enchantmentId}はruntimeで1個までです。`
  }
  const coolDown = selected.some((item) => item.enchantmentId === 'cool-down')
  if (armor.artifactCooldownReduction > 0 && coolDown) return 'UNSUPPORTED_ARTIFACT_COOLDOWN_COMBINATION: Armor固有CDRとCool Downの合成は未確定です。'
  if (scenario.cooldownReduction > 0 && (armor.artifactCooldownReduction > 0 || coolDown)) return 'UNSUPPORTED_ARTIFACT_COOLDOWN_COMBINATION: external Scenario CDRとの合成は未確定です。'
  if (armor.id === 'renegade-armor' && (build.artifacts.some((item) => item.artifactId === 'death-cap-mushroom') || build.enchantments.some((item) => item.enchantmentId === 'rampaging'))) return 'UNSUPPORTED_ATTACK_SPEED_COMBINATION: Renegade ArmorとDeath Cap/Rampagingのspeed bucketは未確定です。'
  const potionBarrier = selected.some((item) => item.enchantmentId === 'potion-barrier')
  const otherDefense = build.artifacts.some((item) => item.artifactId === 'iron-hide-amulet') || build.enchantments.some((item) => item.enchantmentId === 'guarding-strike' || item.enchantmentId === 'weakening')
  if (armor.armorDamageReduction > 0 && (potionBarrier || otherDefense)) return 'UNSUPPORTED_ARMOR_DR_COMBINATION: 35% Armor DRと他の防御sourceの合成は未確定です。'
  if (potionBarrier && otherDefense) return 'UNSUPPORTED_ARMOR_DR_COMBINATION: Potion Barrierと他の防御sourceの合成は未確定です。'
  if (armor.id === 'wither-armor' && build.enchantments.some((item) => item.enchantmentId === 'soul-siphon')) return 'UNSUPPORTED_ARMOR_COMBINATION: Wither Armorの+50% soulsとSoul Siphonの合成は未確定です。'
  return undefined
}

export function resolveArtifactCooldownState(build: Build, scenario: Scenario): ArtifactCooldownModifierState {
  const armor = build.armor ? ARMORS[build.armor.armorId as ArmorId] : undefined
  const armorIntrinsicReduction = armor?.artifactCooldownReduction ?? 0
  const armorEnchantReductions = selectedArmorEnchantments(build)
    .filter((item) => item.enchantmentId === 'cool-down')
    .map((item) => ARMOR_ENCHANTMENTS['cool-down'].tiers[item.tier])
  const externalScenarioReduction = scenario.cooldownReduction
  const activeSources = Number(externalScenarioReduction > 0) + Number(armorIntrinsicReduction > 0) + Number(armorEnchantReductions.length > 0)
  if (activeSources > 1) throw new Error('UNSUPPORTED_ARTIFACT_COOLDOWN_COMBINATION')
  const effectiveCooldownMultiplier = armorIntrinsicReduction > 0
    ? 1 - armorIntrinsicReduction
    : armorEnchantReductions.length > 0
      ? 1 - armorEnchantReductions[0]!
      : 1 - externalScenarioReduction
  return {
    externalScenarioReduction,
    armorIntrinsicReduction,
    armorEnchantReductions,
    compositionModel: armorIntrinsicReduction > 0 ? 'armor-only' : armorEnchantReductions.length > 0 ? 'enchant-only' : 'external-only',
    effectiveCooldownMultiplier,
  }
}

export function resolveArtifactCooldown(baseCooldownSeconds: number, build: Build, scenario: Scenario): number {
  if (!Number.isFinite(baseCooldownSeconds) || baseCooldownSeconds <= 0) throw new Error('Artifact cooldown must be finite and positive')
  const result = baseCooldownSeconds * resolveArtifactCooldownState(build, scenario).effectiveCooldownMultiplier
  if (!Number.isFinite(result) || result <= 0) throw new Error('Artifact cooldown exceeds finite numeric range')
  return result
}

export function deriveArmorState(build: Build, scenario: Scenario): RuntimeArmorState | undefined {
  if (!build.armor) return undefined
  const armor = ARMORS[build.armor.armorId as ArmorId]
  if (!armor || build.armor.observedHealthBonus === undefined) return undefined
  return {
    armorId: armor.id,
    instanceId: build.armor.instanceId,
    observedHealthBonus: build.armor.observedHealthBonus,
    finalMaxHealth: resolveBuildHealth(build, scenario).finalMaxHealth,
    selectedEnchantments: selectedArmorEnchantments(build),
    directMeleeDamageMultiplier: 1 + armor.directMeleeDamageBonus,
    meleeAttackSpeedBonus: armor.meleeAttackSpeedBonus,
    armorDamageReduction: armor.armorDamageReduction,
    soulGatheringMultiplier: armor.soulGatheringMultiplier,
    lifeStealFraction: armor.lifeStealFraction,
    artifactCooldown: resolveArtifactCooldownState(build, scenario),
  }
}

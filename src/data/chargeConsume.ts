import type { EnchantmentId, EnchantmentTier, Evidence, SourceReference, WeaponId } from '../core/types'

export const PAIN_SOURCE: SourceReference = { id: 'pain-cycle-1.17', label: 'dungeons.tools: Pain Cycle tiers, five charges then next attack, non-stackable', url: 'https://www.dungeons.tools/enchantments/pain-cycle', kind: 'game-files' }
export const DYNAMO_SOURCE: SourceReference = { id: 'dynamo-1.17', label: 'dungeons.tools: Dynamo roll, cap and next-attack reset', url: 'https://www.dungeons.tools/enchantments/dynamo', kind: 'published-reference' }
export const PAIN_HEALTH_SOURCE: SourceReference = { id: 'pain-health', label: 'Minecraft Wiki: Pain Cycle 3% maximum health per charging attack', url: 'https://minecraft.wiki/w/Dungeons:Pain_Cycle', kind: 'published-reference' }
export const DYNAMO_TABLE_SOURCE: SourceReference = { id: 'dynamo-table', label: 'Minecraft Wiki: Dynamo independent Tier I/II/III Power table; version/roll unspecified', url: 'https://minecraft.wiki/w/Dungeons:Dynamo', kind: 'published-reference' }

export const CHARGE_WEAPONS: readonly WeaponId[] = ['fighters-bindings', 'double-axe', 'anchor', 'soul-scythe']
export const PAIN_REQUIRED_CHARGES = 5
export const PAIN_CHARGED_MULTIPLIERS: Readonly<Record<EnchantmentTier, number>> = { 1: 3, 2: 4, 3: 5 }
export const PAIN_HEALTH_COST: Evidence<number> = { value: 0.03, source: PAIN_HEALTH_SOURCE, confidence: 'high' }
export const DYNAMO_CAP = 20
export const DYNAMO_POWER_RANGE = { min: 210, max: 263 } as const

// Do not derive tiers from the +X/+1.25X/+1.5X display labels.
export const DYNAMO_DAMAGE_POINTS = [
  { powerLevel: 210, damage: [35214, 56343, 77471] },
  { powerLevel: 216, damage: [45964, 73542, 101120] },
  { powerLevel: 227, damage: [72060, 115296, 158532] },
  { powerLevel: 228, damage: [75559, 120894, 166229] },
  { powerLevel: 240, damage: [123208, 197132, 271057] },
  { powerLevel: 246, damage: [152094, 243350, 334607] },
  { powerLevel: 247, damage: [161636, 258617, 355599] },
  { powerLevel: 249, damage: [171751, 274802, 377852] },
  { powerLevel: 251, damage: [191087, 305739, 420391] },
  { powerLevel: 263, damage: [300090, 480144, 660198] },
] as const

export const DYNAMO_NUMERIC_EVIDENCE = { value: DYNAMO_DAMAGE_POINTS, source: DYNAMO_TABLE_SOURCE, confidence: 'medium' } as const

// Descriptions establish standalone effects, not composition. Reject uncertain
// pairs instead of silently applying the legacy scalar product.
export const CHARGE_UNVERIFIED_MODIFIERS: readonly EnchantmentId[] = [
  'critical-hit', 'void-strike', 'sharpness', 'unchanting', 'ambush', 'smiting', 'artifact-synergy', 'committed',
]

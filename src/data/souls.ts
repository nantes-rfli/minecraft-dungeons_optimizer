import type { Evidence, OnHitSoulGenerationEffect, SoulDependentCriticalEffect, SoulPickupHealingEffect, SourceReference } from '../core/types'

export const SOUL_SCYTHE_SOURCE: SourceReference = { id: 'soul-scythe-game-data', label: 'Soul Scythe / 1.17.0.0 serialized calculator stats', url: 'https://www.dungeons.tools/damage-calculator', kind: 'game-files' }
export const SOUL_SCYTHE_PROFILE_SOURCE: SourceReference = { id: 'soul-scythe-profile', label: 'Phase 1A / Soul Scythe published hit timings', url: 'https://minecraft.wiki/w/Dungeons:Soul_Scythe', kind: 'published-reference' }
export const SOUL_METER_SOURCE: SourceReference = { id: 'soul-meter', label: 'Minecraft Wiki / Soul meter', url: 'https://minecraft.wiki/w/Dungeons:Utility_Bar', kind: 'published-reference' }
export const SOUL_GATHERING_SOURCE: SourceReference = { id: 'soul-gathering-history', label: 'Soul Gathering changes / 1.3.2.0', url: 'https://minecraft.wiki/w/Dungeons:1.3.2.0', kind: 'published-reference' }
export const SOUL_MODEL_SOURCE: SourceReference = { id: 'soul-model', label: 'Phase 2-1G continuous no-spending model', kind: 'model-assumption' }
export const SOUL_COMMUNITY_SOURCE: SourceReference = { id: 'soul-orb-report', label: '2023 soul guide / five orbs and gathering', url: 'https://www.reddit.com/r/MinecraftDungeons/comments/14o1lub/', kind: 'community-test' }
export const BASE_SOUL_CAPACITY: Evidence<number> = { value: 300, confidence: 'high', source: SOUL_METER_SOURCE }
export const INITIAL_SOULS: Evidence<number> = { value: 0, confidence: 'high', source: SOUL_METER_SOURCE }
export const SOUL_GATHERING_PER_ENCHANTMENT: Evidence<number> = { value: 1, confidence: 'medium', source: SOUL_GATHERING_SOURCE, note: 'Additive weapon + selected soul enchant properties; gilded equivalence is a separate low-confidence assumption.' }
export const SOUL_TRAJECTORY_MODEL: Evidence<string> = { value: 'constant-rate-zero-start-no-spending', confidence: 'low', source: SOUL_MODEL_SOURCE }
export const SOUL_NORMAL_KILL_MODEL: Evidence<string> = { value: 'one-pickup-per-eligible-estimated-kill', confidence: 'low', source: SOUL_MODEL_SOURCE }
export const SOUL_SIPHON_ROLL_MODEL: Evidence<string> = { value: 'one-roll-per-profile-hit', confidence: 'low', source: SOUL_MODEL_SOURCE, note: 'Per-target AoE claims lack controlled 1.17 measurements. No target-count multiplier.' }
export const SOUL_SIPHON_PICKUPS: Evidence<string> = { value: 'tier-amount-is-visual-pickup-count', confidence: 'medium', source: SOUL_COMMUNITY_SOURCE }
export const ANIMA_CAPACITY_MODEL: Evidence<string> = { value: 'nominal-capacity-including-full-meter', confidence: 'low', source: SOUL_MODEL_SOURCE, note: 'Full-meter healing not independently established. Travel, overheal and near-full-health reduction omitted.' }
export const SOUL_GILDED_GATHERING_MODEL: Evidence<string> = { value: 'same-property-for-normal-and-gilded', confidence: 'low', source: SOUL_MODEL_SOURCE }

const enchantSource = (id: string): SourceReference => ({ id: `soul-${id}`, label: `dungeons.tools / ${id} / 1.17.0.0`, url: `https://www.dungeons.tools/enchantments/${id}`, kind: 'game-files' })
const soul = { soulGearOnly: true, soulGathering: SOUL_GATHERING_PER_ENCHANTMENT } as const

// Research metadata is distinct from ENCHANTMENTS: Enigma must never become a zero-effect candidate.
export const SOUL_ENCHANTMENT_METADATA = {
  'anima-conduit': {
    ...soul,
    tiers: { value: {
      1: { kind: 'soul-pickup-healing', maxHealthFractionPerPickup: 0.02 },
      2: { kind: 'soul-pickup-healing', maxHealthFractionPerPickup: 0.04 },
      3: { kind: 'soul-pickup-healing', maxHealthFractionPerPickup: 0.06 },
    }, source: enchantSource('anima-conduit'), confidence: 'high' } satisfies Evidence<Record<1 | 2 | 3, SoulPickupHealingEffect>>,
  },
  'soul-siphon': {
    ...soul,
    tiers: { value: {
      1: { kind: 'on-hit-soul-generation', triggerChance: 0.2, extraPickupCount: 1 },
      2: { kind: 'on-hit-soul-generation', triggerChance: 0.2, extraPickupCount: 3 },
      3: { kind: 'on-hit-soul-generation', triggerChance: 0.2, extraPickupCount: 5 },
    }, source: enchantSource('soul-siphon'), confidence: 'high' } satisfies Evidence<Record<1 | 2 | 3, OnHitSoulGenerationEffect>>,
  },
  'enigma-resonator': {
    ...soul,
    tiers: { value: {
      1: { kind: 'soul-dependent-critical', maximumTriggerChance: 0.15, damageMultiplier: 3 },
      2: { kind: 'soul-dependent-critical', maximumTriggerChance: 0.20, damageMultiplier: 3 },
      3: { kind: 'soul-dependent-critical', maximumTriggerChance: 0.25, damageMultiplier: 3 },
    }, source: enchantSource('enigma-resonator'), confidence: 'high' } satisfies Evidence<Record<1 | 2 | 3, SoulDependentCriticalEffect>>,
  },
} as const

export function isSoulEnchantmentId(id: string): id is keyof typeof SOUL_ENCHANTMENT_METADATA {
  return Object.hasOwn(SOUL_ENCHANTMENT_METADATA, id)
}

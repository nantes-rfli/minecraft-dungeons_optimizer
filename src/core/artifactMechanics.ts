import type { ArtifactId, ArtifactStacking, Evidence, LocalizedName } from './types'

export const ARTIFACT_MECHANIC_FAMILIES = [
  'timed-self-buff', 'timed-enemy-debuff', 'instant-heal', 'placed-healing-zone',
  'instant-damage', 'persistent-damage', 'channeled-soul-damage', 'attack-limited-buff',
  'soul-spending-heal', 'soul-spending-damage', 'hard-control', 'positional-control',
  'mobility', 'summon', 'consumable-generation', 'random-effect', 'other',
] as const
export type ArtifactMechanicFamily = (typeof ARTIFACT_MECHANIC_FAMILIES)[number]

export interface ArtifactPowerRange { readonly min: number; readonly max: number }
export type ArtifactDurationModel =
  | { readonly kind: 'fixed'; readonly seconds: Evidence<number> }
  | { readonly kind: 'linear-power'; readonly intercept: Evidence<number>; readonly perPower: Evidence<number>; readonly supportedPowerRange?: ArtifactPowerRange }
  | { readonly kind: 'published-table'; readonly points: readonly { readonly power: number; readonly seconds: Evidence<number> }[]; readonly supportedPowerRange: ArtifactPowerRange }

// An event budget is not a duration model: expiry alone cannot determine uptime.
export interface ArtifactTriggerBudget {
  readonly kind: 'event-limited'
  readonly expiresAfterSeconds: Evidence<number>
  readonly maximumTriggers: Evidence<number>
}
export type ArtifactUseModel =
  | { readonly kind: 'cooldown-only'; readonly cooldownStarts: 'use' }
  | { readonly kind: 'soul-spending'; readonly cooldownStarts: 'use'; readonly soulGathering: Evidence<number>; readonly cost: Evidence<number> }
  | { readonly kind: 'soul-channel'; readonly cooldownStarts: 'deactivation'; readonly soulGathering: Evidence<number>; readonly soulsPerSecond: Evidence<number> }

interface ArtifactDefinitionBase {
  readonly id: ArtifactId
  readonly name: LocalizedName
  readonly cooldownSeconds: Evidence<number>
  readonly use: ArtifactUseModel
  readonly stacking: Evidence<ArtifactStacking>
}
export interface TimedSelfBuffArtifactDefinition extends ArtifactDefinitionBase {
  readonly mechanic: 'timed-self-buff'
  readonly duration: ArtifactDurationModel
  readonly effect:
    | { readonly kind: 'attack-speed'; readonly bonus: Evidence<number> }
    | { readonly kind: 'damage-reduction'; readonly reduction: Evidence<number> }
}

export interface HardControlArtifactDefinition extends ArtifactDefinitionBase {
  readonly mechanic: 'hard-control'
  readonly duration: ArtifactDurationModel
  readonly effect: {
    readonly kind: 'hard-stun'
    readonly semantics: Evidence<'movement-and-attacks-disabled'>
  }
}

// Extension contracts only. No unimplemented IDs or zero effects enter the catalog.
export type ArtifactAmountModel =
  | { readonly kind: 'fixed'; readonly amount: Evidence<number> }
  | { readonly kind: 'published-table'; readonly points: readonly { readonly power: number; readonly amount: Evidence<number> }[]; readonly supportedPowerRange: ArtifactPowerRange }
export interface InstantHealingArtifactDefinition extends ArtifactDefinitionBase {
  readonly mechanic: 'instant-heal'
  readonly use: Extract<ArtifactUseModel, { readonly kind: 'cooldown-only' }>
  readonly healing: ArtifactAmountModel
  readonly targeting: 'self' | 'most-injured-ally'
}
export interface SoulSpendingHealingArtifactDefinition extends ArtifactDefinitionBase {
  readonly mechanic: 'soul-spending-heal'
  readonly use: Extract<ArtifactUseModel, { readonly kind: 'soul-spending' }>
  readonly healing: ArtifactAmountModel
  readonly targeting: 'self' | 'most-injured-ally'
}
export interface AttackLimitedArtifactDefinition extends ArtifactDefinitionBase {
  readonly mechanic: 'attack-limited-buff'
  readonly budget: ArtifactTriggerBudget
  readonly damage: ArtifactAmountModel
}
export type ArtifactDefinition = TimedSelfBuffArtifactDefinition | HardControlArtifactDefinition | InstantHealingArtifactDefinition | SoulSpendingHealingArtifactDefinition | AttackLimitedArtifactDefinition

/** Scheduler contract for future resource/channel implementations; never assume infinite souls. */
export interface ArtifactActivationCapacity {
  readonly cooldownLimitedActivationsPerSecond: number
  readonly resourceLimitedActivationsPerSecond: number
  readonly realizedActivationsPerSecond: number
}

/** One use action, not a damage pulse, aura tick, or channel OFF transition. */
export interface ArtifactActivationOpportunity {
  readonly instanceId: string
  readonly artifactId: ArtifactId
  readonly effectiveCooldownSeconds: number
}

export type Confidence = 'high' | 'medium' | 'low'
export type EnchantmentTier = 1 | 2 | 3

export interface SourceReference {
  readonly id: string
  readonly label: string
  readonly url?: string
  readonly kind:
    | 'game-files'
    | 'frame-analysis'
    | 'published-reference'
    | 'community-test'
    | 'model-assumption'
}

export interface Evidence<T> {
  readonly value: T
  readonly source: SourceReference
  readonly confidence: Confidence
  readonly note?: string
}

export interface LocalizedName {
  readonly ja: string
  readonly en: string
}

export type WeaponId = 'fighters-bindings' | 'double-axe' | 'anchor' | 'soul-scythe'
export type EnchantmentId =
  | 'critical-hit'
  | 'radiance'
  | 'leeching'
  | 'void-strike'
  | 'guarding-strike'
  | 'sharpness'
  | 'unchanting'
  | 'refreshment'
  | 'weakening'
  | 'shockwave'
  | 'swirling'
  | 'thundering'
  | 'ambush'
  | 'smiting'
  | 'committed'
  | 'artifact-synergy'
  | 'rampaging'
  | 'anima-conduit'
  | 'soul-siphon'
  | 'fire-aspect'
  | 'poison-cloud'
  | 'exploding'
  | 'chains'
  | 'stunning'
  | 'freezing'
  | 'gravity'
export type ArtifactId = 'death-cap-mushroom' | 'iron-hide-amulet'
export type ScenarioProfileId =
  | 'balanced'
  | 'damage'
  | 'survival'
  | 'boss'
  | 'mobbing'
  | 'apocalypse-plus'

export interface WeaponDefinition {
  readonly id: WeaponId
  readonly name: LocalizedName
  readonly internalPowerRating: Evidence<number>
  readonly speed: Evidence<number>
  readonly area: Evidence<number>
  readonly soul: {
    readonly acceptsSoulEnchantments: boolean
    readonly baseSoulGathering: Evidence<number>
  }
}

export interface GearPowerCurvePoint {
  readonly powerLevel: number
  readonly referenceDamage: number
}

export interface GearPowerCurve {
  readonly referenceWeaponId: WeaponId
  readonly points: readonly GearPowerCurvePoint[]
}

export interface CrossWeaponDamageScaling {
  readonly method: 'internal-power-ratio'
}

export type PublishedDamage =
  | { readonly kind: 'exact'; readonly value: number }
  | { readonly kind: 'range'; readonly min: number; readonly max: number }

export interface WeaponPowerValidationSample {
  readonly id: string
  readonly weaponId: WeaponId
  readonly powerLevel: number
  readonly publishedDamage: PublishedDamage
  readonly publishedGameVersion: string
  readonly source: SourceReference
  readonly note?: string
}

export interface PowerScalingValidationObservation {
  readonly sample: WeaponPowerValidationSample
  readonly predicted: number
  readonly absoluteError: number
  readonly relativeError: number
  readonly withinPublishedRange: boolean
  readonly withinTolerance: boolean
}

export interface PowerScalingValidationSummary {
  readonly scope: WeaponId | 'overall'
  readonly sampleCount: number
  readonly medianRelativeError: number
  readonly p90RelativeError: number
  readonly maximumRelativeError: number
  readonly withinToleranceCount: number
}

export interface SpeedRatingProxyAttackProfile {
  readonly method: 'speed-rating-proxy'
  readonly hitsPerSecond: number
}

export interface FrameMeasuredAttackProfile {
  readonly method: 'frame-measured'
  readonly hitsPerCombo: number
  readonly framesPerSecond: number
  readonly comboFrameSamples: readonly number[]
}

export interface PublishedHitTimingAttackProfile {
  readonly method: 'published-hit-timings'
  readonly hitDurationsSeconds: readonly number[]
  readonly comboFinisherHit: number
}

export type AttackProfile =
  | SpeedRatingProxyAttackProfile
  | PublishedHitTimingAttackProfile
  | FrameMeasuredAttackProfile

export interface VoidStrikeCurvePoint {
  readonly elapsedSeconds: number
  readonly multiplier: number
}

interface VoidStrikeCurveBase {
  /** The hit which first applies Void Strike is not amplified. */
  readonly applicationHitMultiplier: number
  /** The first armed frame can jump above the application-hit multiplier. */
  readonly armedMinimumMultiplier: number
  /** Curve points are recorded against this tier maximum (Tier III melee = 7×). */
  readonly referenceMaximumMultiplier: number
  readonly expiresAfterSeconds?: number
}

export interface VoidStrikeMeasurementPoint {
  readonly elapsedSeconds: number
  readonly multiplierSamples: readonly number[]
}

export interface LinearProxyVoidStrikeCurve extends VoidStrikeCurveBase {
  readonly method: 'linear-proxy'
  readonly points: readonly VoidStrikeCurvePoint[]
}

export interface PublishedMeasurementsVoidStrikeCurve extends VoidStrikeCurveBase {
  readonly method: 'published-measurements'
  readonly points: readonly VoidStrikeCurvePoint[]
}

export interface FrameMeasuredVoidStrikeCurve extends VoidStrikeCurveBase {
  readonly method: 'frame-measured'
  readonly points: readonly VoidStrikeMeasurementPoint[]
}

export type VoidStrikeCurve =
  | LinearProxyVoidStrikeCurve
  | PublishedMeasurementsVoidStrikeCurve
  | FrameMeasuredVoidStrikeCurve

/** Only direct melee hits; independent proc effects must never enter this channel. */
export type DirectDamageCondition = 'enchanted-enemy' | 'undead-enemy' | 'not-targeting-hero'

export type DirectWeaponEffect =
  | { readonly kind: 'passive-weapon-damage'; readonly bonus: number }
  | {
      readonly kind: 'conditional-weapon-damage'
      readonly condition: DirectDamageCondition
      readonly bonus: number
    }
  | { readonly kind: 'target-health-weapon-damage'; readonly maxBonus: number }

export interface PotionCooldownOnKillEffect {
  readonly kind: 'potion-cooldown-on-direct-kill'
  readonly potionCooldownReductionSeconds: number
}

export interface EnemyDamageDebuffEffect {
  readonly kind: 'enemy-damage-debuff'
  readonly enemyDamageReduction: number
  readonly durationSeconds: number
}

export type ProcDamageId = 'shockwave' | 'swirling' | 'thundering'

export type DotDamageId = 'fire-aspect' | 'poison-cloud'
export interface DotDamageCurve {
  readonly method: 'log-linear'
  readonly points: readonly { readonly powerLevel: number; readonly tierOneDps: number }[]
}
export type DotDamageEffect =
  | { readonly kind: 'attached-dot'; readonly dotId: 'fire-aspect'; readonly durationSeconds: 3; readonly tierMultiplier: number }
  | { readonly kind: 'persistent-area-dot'; readonly dotId: 'poison-cloud'; readonly durationSeconds: 3; readonly triggerChance: 0.3; readonly tierMultiplier: number }
export interface OnKillExplosionEffect {
  readonly kind: 'on-direct-kill-explosion'
  readonly healthFraction: number
}

export interface PersistentAreaTargetingAssumptions {
  readonly poisonCloudSingleTargetResidenceSeconds: number
  readonly poisonCloudTargetSecondsPerEvent: number
}

interface IndirectDamageContribution {
  readonly sourceId: EnchantmentId
  readonly channel: 'enchantment-proc'
  readonly tier: EnchantmentTier
  readonly singleTargetDps: number
  readonly aoeDps: number
  readonly qualifiesAsDirectWeaponKill: false
  readonly confidence: Confidence
}

export interface AttachedDotDamageEvent extends IndirectDamageContribution {
  readonly kind: 'attached-dot'
  readonly sourceId: 'fire-aspect'
  readonly durationSeconds: 3
  readonly damagePerSecond: number
  readonly targetUptime: number
  readonly expectedTargetsHit: number
  readonly timeModel: 'finite-first-hit-at-zero'
}

export interface PersistentAreaDotDamageEvent extends IndirectDamageContribution {
  readonly kind: 'persistent-area-dot'
  readonly sourceId: 'poison-cloud'
  readonly durationSeconds: 3
  readonly damagePerSecond: number
  readonly opportunitiesPerSecond: number
  readonly triggerProbability: 0.3
  readonly cloudSpawnsPerSecond: number
  readonly singleTargetResidenceSeconds: number
  readonly targetSecondsPerEvent: number
  readonly singleTargetUptime: number
  readonly effectiveAoeTargets: number
  readonly overlapModel: 'poisson-saturation-assumption'
}

export interface OnKillExplosionDamageEvent extends IndirectDamageContribution {
  readonly kind: 'on-kill-explosion'
  readonly sourceId: 'exploding'
  readonly sourceKillsPerSecond: number
  readonly sourceHealth: number
  readonly healthFraction: number
  readonly damagePerSecondaryTarget: number
  readonly expectedSecondaryTargets: number
  readonly singleTargetDps: 0
  readonly chainReaction: false
}

export type DamageEventModel = DamageEventContribution | AttachedDotDamageEvent | PersistentAreaDotDamageEvent | OnKillExplosionDamageEvent

export type ProcDamageEffect =
  | { readonly kind: 'combo-finisher-damage'; readonly procDamageId: 'shockwave' | 'swirling'; readonly tierMultiplier: number }
  | { readonly kind: 'on-hit-proc-damage'; readonly procDamageId: 'thundering'; readonly triggerChance: number; readonly tierMultiplier: number }

export interface ArtifactNextAttackEffect {
  readonly kind: 'artifact-next-attack-damage'
  readonly bonus: number
}

export interface OnKillAttackSpeedEffect {
  readonly kind: 'on-direct-kill-attack-speed'
  readonly triggerChance: number
  readonly durationSeconds: number
  readonly attackSpeedBonus: number
}

export interface SoulPickupHealingEffect {
  readonly kind: 'soul-pickup-healing'
  readonly maxHealthFractionPerPickup: number
}

export interface OnHitSoulGenerationEffect {
  readonly kind: 'on-hit-soul-generation'
  readonly triggerChance: number
  readonly extraPickupCount: number
}

/** Research schema only until the soul-to-probability mapping is verified. */
export interface SoulDependentCriticalEffect {
  readonly kind: 'soul-dependent-critical'
  readonly maximumTriggerChance: number
  readonly damageMultiplier: number
}

export type ControlEnchantmentId = 'chains' | 'stunning' | 'freezing' | 'gravity'
export type ControlEffect =
  | { readonly kind: 'hard-stun'; readonly triggerChance: number; readonly durationSeconds: number }
  | { readonly kind: 'root-cluster'; readonly triggerChance: number; readonly durationSeconds: number }
  | { readonly kind: 'enemy-attack-speed-slow'; readonly attackSpeedReduction: number; readonly durationSeconds: number }
  | { readonly kind: 'group-pull'; readonly durationSeconds: number }

export type EnchantmentEffect = DirectWeaponEffect | PotionCooldownOnKillEffect | EnemyDamageDebuffEffect | ProcDamageEffect | DotDamageEffect | OnKillExplosionEffect | ArtifactNextAttackEffect | OnKillAttackSpeedEffect | SoulPickupHealingEffect | OnHitSoulGenerationEffect | ControlEffect

export type DamageChannel = 'direct-melee' | 'enchantment-proc'

/** Steady-state expected contribution; not a timestamped simulation event. */
export interface DamageEventContribution {
  readonly kind: 'instant'
  readonly sourceId: EnchantmentId
  readonly channel: 'enchantment-proc'
  readonly tier: EnchantmentTier
  readonly triggerKind: 'combo-finisher' | 'on-hit-probability'
  readonly requiresTargetHit: boolean
  readonly opportunitiesPerSecond: number
  readonly triggerProbability: number
  readonly eventsPerSecond: number
  readonly damagePerEvent: number
  readonly expectedTargetsHit: number
  readonly singleTargetDps: number
  readonly aoeDps: number
  readonly qualifiesAsDirectWeaponKill: false
  readonly confidence: Confidence
}

export interface ProcDamageCurve {
  readonly method: 'log-linear'
  readonly points: readonly { readonly powerLevel: number; readonly tierOneDamage: number }[]
}

export interface ProcDamageDefinition {
  readonly id: ProcDamageId
  readonly damageCurve: Evidence<ProcDamageCurve>
  readonly samples: Evidence<readonly { readonly powerLevel: number; readonly tier: EnchantmentTier; readonly damage: number }[]>
  readonly targeting: Evidence<{ readonly geometry: 'directional-wave' | 'local-radius' | 'nearby-lightning'; readonly defaultExpectedTargets: number }>
  readonly attribution: Evidence<{ readonly qualifiesAsDirectWeaponKill: false }>
  readonly voidInteraction: Evidence<{ readonly amplification: 'uncertain'; readonly consumesVoid: 'uncertain' }>
  readonly requiresTargetHit: boolean
}

export type DamageEventTargetingAssumptions = Readonly<Record<ProcDamageId, number>>

export interface EnchantmentTierValues {
  readonly effect?: EnchantmentEffect
  readonly triggerChance?: number
  readonly damageMultiplier?: number
  readonly healingFraction?: number
  readonly radianceHealMultiplier?: number
  readonly durationSeconds?: number
  readonly damageReduction?: number
  readonly maxBonusDamage?: number
}

export interface EnchantmentStacking {
  readonly maxCopies: number
  readonly behavior: 'non-stackable' | 'additive' | 'multiplicative' | 'special'
  readonly additionalCopyMultiplier?: number
  readonly copyEffectMultipliers?: readonly number[]
}

export interface EnchantmentDefinition {
  readonly id: EnchantmentId
  readonly name: LocalizedName
  readonly tiers: Evidence<Readonly<Record<EnchantmentTier, EnchantmentTierValues>>>
  readonly stacking: Evidence<EnchantmentStacking>
  readonly soul?: {
    readonly soulGearOnly: true
    readonly soulGathering: Evidence<number>
  }
  readonly applicability?: Evidence<{
    readonly melee: boolean
    readonly ranged: boolean
    readonly armor: boolean
  }>
}

export interface ArtifactDefinition {
  readonly id: ArtifactId
  readonly name: LocalizedName
  readonly cooldownSeconds: Evidence<number>
  readonly durationIntercept: Evidence<number>
  readonly durationPerPower: Evidence<number>
  readonly attackSpeedBonus?: Evidence<number>
  readonly damageReduction?: Evidence<number>
  readonly stacking: Evidence<ArtifactStacking>
}

export interface ArtifactStacking {
  readonly maxCopies: number
  readonly behavior: 'stack' | 'refresh' | 'independent' | 'non-stackable'
}

export interface EnchantmentSlot {
  readonly candidates: readonly EnchantmentId[]
  readonly locked?: EnchantmentId
}

export interface GildedEnchantment {
  readonly enchantmentId: EnchantmentId
  readonly tier: EnchantmentTier
}

export interface SelectedEnchantment {
  readonly enchantmentId: EnchantmentId
  readonly tier: EnchantmentTier
  readonly source: 'slot' | 'gilded' | 'built-in'
}

export interface OwnedWeapon {
  readonly instanceId: string
  readonly weaponId: WeaponId
  readonly powerLevel: number
  readonly observedDamagePerHit?: number
  readonly enchantmentSlots: readonly EnchantmentSlot[]
  readonly gilded?: GildedEnchantment
  readonly locked?: boolean
}

export interface OwnedArtifact {
  readonly instanceId: string
  readonly artifactId: ArtifactId
  readonly powerLevel: number
}

export interface Inventory {
  readonly weapons: readonly OwnedWeapon[]
  readonly artifacts: readonly OwnedArtifact[]
}

export interface Build {
  readonly weapon: OwnedWeapon
  readonly enchantments: readonly SelectedEnchantment[]
  readonly artifacts: readonly OwnedArtifact[]
}

export interface ScenarioWeights {
  readonly damage: number
  readonly healing: number
  readonly defense: number
  readonly control: number
}

/** Ranking preferences, never game-mechanics evidence. */
export interface ControlPolicyWeights {
  readonly hardDisable: number
  readonly attackSlow: number
  readonly root: number
  readonly grouping: number
}

export interface CrowdControlAssumptions {
  readonly stunningEligibleTargetShare: number
  readonly chainsEligibleTargetShare: number
  readonly freezingEligibleTargetShare: number
  readonly gravityEligibleTargetShare: number
  readonly stunningEffectiveDurationMultiplier: number
  readonly chainsExpectedTargetsPerProc: number
  readonly gravityExpectedTargetsPerHit: number
}

export interface RefreshControlState {
  readonly triggerChance: number
  readonly opportunitiesPerSecond: number
  readonly durationSeconds: number
  readonly activeCoverage: number
  readonly eligibleTargetShare: number
}
export interface StunningState extends RefreshControlState {
  readonly baseDurationSeconds: number
  readonly durationConfidence: Confidence
  readonly effectiveHardDisableCoverage: number
}
export interface FreezingState extends RefreshControlState {
  readonly attackSpeedReduction: number
  readonly attackSlowEquivalentCoverage: number
}
export interface ChainsState extends RefreshControlState {
  readonly expectedTargetsPerProc: number
  readonly affectedTargetFraction: number
  readonly rootCoverage: number
}
export interface GravityState extends RefreshControlState {
  readonly expectedTargetsPerHit: number
  readonly affectedTargetFraction: number
  readonly groupingCoverage: number
}
export interface ControlMetrics {
  readonly hardDisableCoverage: number
  readonly attackSlowEquivalentCoverage: number
  readonly rootCoverage: number
  readonly groupingCoverage: number
  readonly stunning?: StunningState
  readonly freezing?: FreezingState
  readonly chains?: ChainsState
  readonly gravity?: GravityState
  /** Preference score, not the union of suppressed enemy actions. */
  readonly utility: number
}

export interface EnemyComposition {
  /** Expected share of direct weapon damage targets, with equal baseline damage weights. */
  readonly enchantedShare: number
  /** Baseline-direct-damage-weighted undead target share, not a global spawn rate. */
  readonly undeadShare: number
}

export interface EnemyStateAssumptions {
  /** Direct damage opportunities where the target is not actively targeting the hero. */
  readonly ambushEligibleDirectDamageShare: number
}

export interface Scenario {
  readonly profileId: ScenarioProfileId
  readonly name: string
  readonly encounterDurationSeconds: number
  readonly averageEnemyHealth: number
  readonly enemySupplyPerSecond: number
  readonly directKillShare: number
  readonly enemyComposition: EnemyComposition
  readonly enemyState: EnemyStateAssumptions
  readonly enemyDebuffs: EnemyDebuffAssumptions
  readonly damageEventTargeting: DamageEventTargetingAssumptions
  readonly persistentAreaTargeting?: PersistentAreaTargetingAssumptions
  readonly incomingDamagePerSecond: number
  readonly maxHealth: number
  readonly averageTargetsInReach: number
  readonly cooldownReduction: number
  readonly radianceHealPerProc: number
  readonly weights: ScenarioWeights
  readonly crowdControl: CrowdControlAssumptions
  readonly controlPolicy: ControlPolicyWeights
}

export interface EnemyDebuffAssumptions {
  /** Damage-weighted share from enemies weakened at the time of damage, including duration/positioning/attack uptime. */
  readonly weakeningAffectedIncomingDamageShare: number
}

export interface ArtifactUptime {
  readonly instanceId: string
  readonly artifactId: ArtifactId
  readonly durationSeconds: number
  readonly effectiveCooldownSeconds: number
  readonly uptime: number
}

export interface ArtifactStackingGroup {
  readonly artifactId: ArtifactId
  readonly instanceIds: readonly string[]
  readonly behavior: ArtifactStacking['behavior']
  readonly combinedUptime: number
}

export interface ArtifactEffects {
  readonly attackSpeedMultiplier: number
  readonly damageTakenMultiplier: number
  readonly uptimes: readonly ArtifactUptime[]
  readonly stackingGroups: readonly ArtifactStackingGroup[]
}

export interface ArtifactActivationState {
  readonly totalActivationsPerSecond: number
  readonly activations: readonly {
    readonly instanceId: string
    readonly artifactId: ArtifactId
    readonly effectiveCooldownSeconds: number
    readonly activationsPerSecond: number
  }[]
}

export interface ArtifactSynergyState {
  readonly pendingChargeCapacity: 1
  readonly eligibleDirectAttacksPerSecond: number
  readonly chargedAttacksPerSecond: number
  readonly chargedAttackShare: number
  readonly bonus: number
  readonly expectedDirectMultiplier: number
}

export interface RampagingState {
  readonly triggerChance: number
  readonly effectiveDurationSeconds: number
  readonly directWeaponKillsPerSecond: number
  readonly triggerEventsPerSecond: number
  readonly uptime: number
  readonly activeAttackSpeedBonus: number
  readonly averageAttackSpeedBonus: number
  readonly iterations: number
  readonly firstIterationUptime: number
  readonly residual: number
}

export interface OffensiveTemporalState {
  readonly exploding?: {
    readonly initialDirectKillsPerSecond: number
    readonly firstExplodingAoeDps: number
    readonly convergedExplodingAoeDps: number
    readonly directDamageShare: number
    readonly directWeaponKillsPerSecond: number
    readonly iterations: number
    /** Relative source-rate fixed-point residual. */
    readonly residual: number
  }
  readonly artifactActivation: ArtifactActivationState
  readonly artifactSynergy: ArtifactSynergyState
  readonly rampaging: RampagingState
  readonly attackSpeedMultiplier: number
}

export interface DamageMetrics {
  readonly artifactSynergyState: ArtifactSynergyState
  readonly damageSource: 'power-curve-estimate' | 'observed-input'
  readonly damagePerHit: number
  readonly hitsPerSecond: number
  readonly baseDps: number
  readonly directWeaponSingleTargetDps: number
  readonly directWeaponAoeDps: number
  readonly indirectSingleTargetDps: number
  readonly indirectAoeDps: number
  readonly damageEvents: readonly DamageEventContribution[]
  readonly dotDamageEvents: readonly (AttachedDotDamageEvent | PersistentAreaDotDamageEvent)[]
  readonly explosionDamageEvents: readonly OnKillExplosionDamageEvent[]
  readonly instantIndirectSingleTargetDps: number
  readonly instantIndirectAoeDps: number
  readonly dotSingleTargetDps: number
  readonly dotAoeDps: number
  readonly explosionAoeDps: number
  readonly singleTargetDps: number
  readonly aoeDps: number
  readonly expectedTargetsHit: number
  readonly criticalMultiplier: number
  readonly voidStrikeMultiplier: number
  readonly sharpnessMultiplier: number
  readonly unchantingMultiplier: number
  readonly smitingMultiplier: number
  readonly smitingActiveUndeadMultiplier: number
  readonly ambushMultiplier: number
  readonly undeadShare: number
  readonly ambushEligibleShare: number
  readonly preCommittedDirectWeaponSingleTargetDps: number
  readonly preCommittedDirectWeaponAoeDps: number
  readonly committedSingleTargetMultiplier: number
  readonly committedAoeMultiplier: number
  readonly enchantedShare: number
  /** Before Committed; includes other factorized direct modifiers, excludes proc. */
  readonly enchantedTargetDps: number
  /** Before Committed; includes other factorized direct modifiers, excludes proc. */
  readonly nonEnchantedTargetDps: number
}

export interface CombatState {
  readonly directDamageShare: number
  readonly indirectDamageShare: number
  readonly indirectEstimatedKillsPerSecond: number
  readonly effectiveDamagePerSecond: number
  readonly damageLimitedKillsPerSecond: number
  readonly estimatedKillsPerSecond: number
  readonly directWeaponKillsPerSecond: number
}

/** Potential absorbed income; resource overflow does not erase pickup events. */
export interface SoulIncome {
  readonly resourceUnitsPerSecond: number
  readonly pickupEventsPerSecond: number
}

export interface SoulTrajectory {
  readonly fillTimeSeconds?: number
  readonly encounterAverageSoulFraction: number
  readonly endSoulFraction: number
}

export interface SoulState extends SoulTrajectory {
  readonly capacity: number
  readonly initialSouls: number
  readonly baseSoulGathering: number
  readonly enchantmentSoulGathering: number
  readonly externalSoulGathering: number
  readonly totalSoulGathering: number
  readonly eligibleSoulGeneratingKillsPerSecond: number
  readonly siphonOpportunitiesPerSecond: number
  readonly siphonTriggerChance: number
  readonly siphonProcEventsPerSecond: number
  readonly siphonPickupsPerProc: number
  readonly normalPickupEventsPerSecond: number
  readonly siphonPickupEventsPerSecond: number
  readonly totalPickupEventsPerSecond: number
  readonly normalResourceUnitsPerSecond: number
  readonly siphonResourceUnitsPerSecond: number
  readonly totalResourceUnitsPerSecond: number
  readonly spendingUnitsPerSecond: 0
}

/** Continuous steady-state availability, not discrete potion events or actual healing. */
export interface PotionState {
  readonly baseCooldownSeconds: number
  readonly refreshmentReductionPerDirectKillSeconds: number
  readonly directWeaponKillsPerSecond: number
  readonly cooldownProgressRate: number
  readonly effectiveCooldownSeconds: number
  readonly baseUsesPerSecond: number
  readonly estimatedUsesPerSecond: number
  readonly healPerUse: number
  readonly incrementalHealingCapacityPerSecond: number
}

export interface HealingMetrics {
  readonly animaHealingCapacityPerSecond: number
  readonly radiancePerSecond: number
  readonly leechingPerSecond: number
  readonly refreshmentPotionCapacityPerSecond: number
  /** Includes the low-confidence incremental potion capacity proxy, excluding baseline potion healing. */
  readonly totalPerSecond: number
}

export interface EnemyDebuffState {
  readonly weakeningAffectedIncomingDamageShare: number
  readonly weakeningDamageReduction: number
  readonly weakeningDurationSeconds: number
  readonly weakeningEnemyDamageMultiplier: number
}

export interface DefenseMetrics extends EnemyDebuffState {
  readonly guardingStrikeUptime: number
  readonly guardingStrikeDamageTakenMultiplier: number
  readonly artifactDamageTakenMultiplier: number
  readonly damageTakenMultiplier: number
  readonly damageTakenPerSecond: number
  readonly preventedDamagePerSecond: number
  readonly effectiveHealth: number
}

export interface ConfidenceSummary {
  readonly coverageScore: number
  readonly label: Confidence
  readonly factors: readonly ConfidenceFactor[]
  readonly caveats: readonly string[]
}

export interface ConfidenceFactor {
  readonly id: string
  readonly label: string
  readonly confidence: Confidence
  readonly weight: number
}

export type DamageRegressionMechanicTag =
  | 'plain-weapon'
  | 'critical-hit'
  | 'void-strike'
  | 'attack-speed-modified'

export interface DamageRegressionSample {
  readonly id: string
  readonly auditEntryId: string
  readonly gameVersion: string
  readonly gameVersionConfidence: 'verified' | 'probable' | 'unknown'
  readonly source: SourceReference
  readonly sourceConfidence: Confidence
  readonly build: Build
  readonly scenario: Scenario
  readonly observedSingleTargetDps: number
  readonly measurement: {
    readonly kind: 'reported-dps' | 'total-damage-over-time' | 'frame-derived'
    readonly durationSeconds?: number
    readonly totalDamage?: number
    readonly hitCount?: number
    readonly sampleCount?: number
    readonly note: string
  }
  readonly mechanicTags: readonly DamageRegressionMechanicTag[]
}

export interface ModelErrorObservation {
  readonly predicted: number
  readonly observed: number
}

export type ModelErrorSummary =
  | {
      readonly status: 'pending'
      readonly sampleCount: number
      readonly minimumSampleCount: number
    }
  | {
      readonly status: 'available'
      readonly sampleCount: number
      readonly minimumSampleCount: number
      readonly meanAbsolutePercentageError: number
      readonly medianAbsolutePercentageError: number
      readonly p90AbsolutePercentageError: number
      readonly maximumAbsolutePercentageError: number
      readonly meanSignedPercentageError: number
      readonly medianSignedPercentageError: number
    }

export interface PredictionRange {
  readonly lower: number
  readonly upper: number
}

export interface DamageRegressionScopeSummary {
  readonly overall: ModelErrorSummary
  readonly finalVersionOnly: ModelErrorSummary
  readonly byWeapon: Readonly<Record<WeaponId, ModelErrorSummary>>
  readonly byMechanic: Readonly<Record<DamageRegressionMechanicTag, ModelErrorSummary>>
}

export interface Evaluation {
  readonly build: Build
  readonly damage: DamageMetrics
  readonly combatState: CombatState
  readonly potionState: PotionState
  readonly healing: HealingMetrics
  readonly defense: DefenseMetrics
  readonly control: ControlMetrics
  readonly artifactEffects: ArtifactEffects
  readonly temporalState: OffensiveTemporalState
  readonly soulState?: SoulState
  readonly objectiveScore: number
  readonly utilities: ObjectiveUtilities
  readonly confidence: ConfidenceSummary
  readonly reasons: readonly string[]
  readonly contributions: readonly EffectContribution[]
}

export interface ObjectiveUtilities {
  readonly damage: number
  readonly healing: number
  readonly defense: number
  readonly control: number
}

export interface EffectContribution {
  readonly sourceType: 'enchantment' | 'artifact'
  readonly sourceId: EnchantmentId | ArtifactId
  readonly label: LocalizedName
  readonly objectiveDelta: number
  readonly singleTargetDpsDelta: number
  readonly aoeDpsDelta: number
  readonly healingPerSecondDelta: number
  readonly effectiveHealthDelta: number
  readonly controlUtilityDelta: number
}

export interface OptimizationResult {
  /** Unsupported choices are excluded, never evaluated as zero-damage effects. */
  readonly unsupportedChoices: readonly string[]
  readonly best: Evaluation
  readonly alternatives: readonly Evaluation[]
  readonly paretoFrontier: readonly Evaluation[]
  readonly evaluatedBuildCount: number
  readonly searchMode: 'exhaustive'
}

/** @deprecated Use OwnedWeapon. */
export type WeaponInventoryItem = OwnedWeapon

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

export type WeaponId = 'fighters-bindings' | 'double-axe' | 'anchor'
export type EnchantmentId =
  | 'critical-hit'
  | 'radiance'
  | 'leeching'
  | 'void-strike'
  | 'guarding-strike'
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

export interface EnchantmentTierValues {
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
}

export interface Scenario {
  readonly profileId: ScenarioProfileId
  readonly name: string
  readonly encounterDurationSeconds: number
  readonly averageEnemyHealth: number
  readonly enemySupplyPerSecond: number
  readonly directKillShare: number
  readonly incomingDamagePerSecond: number
  readonly maxHealth: number
  readonly averageTargetsInReach: number
  readonly cooldownReduction: number
  readonly radianceHealPerProc: number
  readonly weights: ScenarioWeights
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

export interface DamageMetrics {
  readonly damageSource: 'power-curve-estimate' | 'observed-input'
  readonly damagePerHit: number
  readonly hitsPerSecond: number
  readonly baseDps: number
  readonly singleTargetDps: number
  readonly aoeDps: number
  readonly expectedTargetsHit: number
  readonly criticalMultiplier: number
  readonly voidStrikeMultiplier: number
}

export interface CombatState {
  readonly effectiveDamagePerSecond: number
  readonly damageLimitedKillsPerSecond: number
  readonly estimatedKillsPerSecond: number
  readonly directWeaponKillsPerSecond: number
}

export interface HealingMetrics {
  readonly radiancePerSecond: number
  readonly leechingPerSecond: number
  readonly totalPerSecond: number
}

export interface DefenseMetrics {
  readonly guardingStrikeUptime: number
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

export interface DamageRegressionSample {
  readonly id: string
  readonly gameVersion: string
  readonly build: Build
  readonly scenario: Scenario
  readonly observedSingleTargetDps: number
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
      readonly p90AbsolutePercentageError: number
      readonly maximumAbsolutePercentageError: number
      readonly meanSignedPercentageError: number
    }

export interface PredictionRange {
  readonly lower: number
  readonly upper: number
}

export interface Evaluation {
  readonly build: Build
  readonly damage: DamageMetrics
  readonly combatState: CombatState
  readonly healing: HealingMetrics
  readonly defense: DefenseMetrics
  readonly artifactEffects: ArtifactEffects
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
}

export interface OptimizationResult {
  readonly best: Evaluation
  readonly alternatives: readonly Evaluation[]
  readonly paretoFrontier: readonly Evaluation[]
  readonly evaluatedBuildCount: number
  readonly searchMode: 'exhaustive'
}

/** @deprecated Use OwnedWeapon. */
export type WeaponInventoryItem = OwnedWeapon

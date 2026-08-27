export type Confidence = 'high' | 'medium' | 'low'

export interface SourceReference {
  readonly id: string
  readonly label: string
  readonly url?: string
  readonly kind: 'game-files' | 'community-test' | 'model-assumption'
}

export interface Evidence<T> {
  readonly value: T
  readonly source: SourceReference
  readonly confidence: Confidence
  readonly note?: string
}

export type WeaponId = 'fighters-bindings' | 'double-axe' | 'anchor'
export type EnchantmentId =
  | 'critical-hit'
  | 'radiance'
  | 'leeching'
  | 'void-strike'
  | 'guarding-strike'
export type ArtifactId = 'death-cap-mushroom' | 'iron-hide-amulet'

export interface WeaponDefinition {
  readonly id: WeaponId
  readonly name: string
  readonly power: Evidence<number>
  readonly speed: Evidence<number>
  readonly area: Evidence<number>
}

export interface EnchantmentDefinition {
  readonly id: EnchantmentId
  readonly name: string
  readonly tier: 3
  readonly triggerChance?: Evidence<number>
  readonly damageMultiplier?: Evidence<number>
  readonly healingFraction?: Evidence<number>
  readonly durationSeconds?: Evidence<number>
  readonly damageReduction?: Evidence<number>
  readonly maxBonusDamage?: Evidence<number>
}

export interface ArtifactDefinition {
  readonly id: ArtifactId
  readonly name: string
  readonly cooldownSeconds: Evidence<number>
  readonly durationIntercept: Evidence<number>
  readonly durationPerPower: Evidence<number>
  readonly attackSpeedBonus?: Evidence<number>
  readonly damageReduction?: Evidence<number>
}

export interface WeaponInventoryItem {
  readonly instanceId: string
  readonly weaponId: WeaponId
  readonly enchantmentSlots: readonly (readonly EnchantmentId[])[]
}

export interface Inventory {
  readonly weapons: readonly WeaponInventoryItem[]
  readonly artifacts: readonly ArtifactId[]
}

export interface Build {
  readonly weapon: WeaponInventoryItem
  readonly enchantments: readonly EnchantmentId[]
  readonly artifacts: readonly ArtifactId[]
}

export interface ScenarioWeights {
  readonly damage: number
  readonly healing: number
  readonly defense: number
}

export interface Scenario {
  readonly name: string
  readonly encounterDurationSeconds: number
  readonly averageEnemyHealth: number
  readonly killsPerSecond: number
  readonly directKillShare: number
  readonly incomingDamagePerSecond: number
  readonly maxHealth: number
  readonly averageTargetsInReach: number
  readonly artifactPower: number
  readonly cooldownReduction: number
  readonly radianceHealPerProc: number
  readonly voidRampSeconds: number
  readonly weights: ScenarioWeights
}

export interface ArtifactUptime {
  readonly artifactId: ArtifactId
  readonly durationSeconds: number
  readonly effectiveCooldownSeconds: number
  readonly uptime: number
}

export interface ArtifactEffects {
  readonly attackSpeedMultiplier: number
  readonly damageTakenMultiplier: number
  readonly uptimes: readonly ArtifactUptime[]
}

export interface DamageMetrics {
  readonly damagePerHit: number
  readonly hitsPerSecond: number
  readonly baseDps: number
  readonly singleTargetDps: number
  readonly aoeDps: number
  readonly expectedTargetsHit: number
  readonly criticalMultiplier: number
  readonly voidStrikeMultiplier: number
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
  readonly score: number
  readonly label: Confidence
  readonly caveats: readonly string[]
}

export interface Evaluation {
  readonly build: Build
  readonly damage: DamageMetrics
  readonly healing: HealingMetrics
  readonly defense: DefenseMetrics
  readonly artifactEffects: ArtifactEffects
  readonly objectiveScore: number
  readonly confidence: ConfidenceSummary
  readonly reasons: readonly string[]
}

export interface OptimizationResult {
  readonly best: Evaluation
  readonly alternatives: readonly Evaluation[]
  readonly evaluatedBuildCount: number
}

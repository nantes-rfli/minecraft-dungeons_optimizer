import { isControlId, STUNNING_DURATION } from '../data/control'
import { resolveHitIntervalSequence } from './attackProfile'
import { getAttackProfile, getEnchantmentDefinition } from './catalog'
import { getTierValues } from './enchantment'
import { OptimizerInputError } from './errors'
import { calculateRefreshEffectCoverage } from './refreshCoverage'
import { ARMOR_ENCHANTMENTS } from '../data/armors'
import type { Build, ControlMetrics, ControlPolicyWeights, Scenario, ShockPowderControlState } from './types'

const unit = (value: number) => Math.max(0, Math.min(1, value))

export function validateControlAssumptions(scenario: Scenario): void {
  const bounded = (name: string, value: number | undefined, minimum: number, maximum: number) => {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum || value > maximum) {
      throw new OptimizerInputError('INVALID_SCENARIO', `${name}は${minimum}以上${maximum}以下の有限値を指定してください。`)
    }
  }
  for (const key of ['stunningEligibleTargetShare', 'chainsEligibleTargetShare', 'freezingEligibleTargetShare', 'gravityEligibleTargetShare', 'stunningEffectiveDurationMultiplier'] as const) {
    bounded(`crowdControl.${key}`, scenario.crowdControl?.[key], 0, 1)
  }
  // Pre-2-2B serialized scenarios do not contain these fields. They use the
  // documented 50% defaults when Shock Powder is later added to the build.
  for (const key of ['shockPowderEligibleTargetShare', 'shockPowderAffectedTargetShare'] as const) {
    const value = scenario.crowdControl?.[key]
    if (value !== undefined) bounded(`crowdControl.${key}`, value, 0, 1)
  }
  for (const key of ['chillingEligibleTargetShare', 'chillingAffectedTargetShare'] as const) {
    const value = scenario.crowdControl?.[key]
    if (value !== undefined) bounded(`crowdControl.${key}`, value, 0, 1)
  }
  for (const key of ['chainsExpectedTargetsPerProc', 'gravityExpectedTargetsPerHit'] as const) {
    bounded(`crowdControl.${key}`, scenario.crowdControl?.[key], 1, scenario.averageTargetsInReach)
  }
  for (const key of ['hardDisable', 'attackSlow', 'root', 'grouping'] as const) {
    bounded(`controlPolicy.${key}`, scenario.controlPolicy?.[key], 0, Number.MAX_VALUE)
  }
}

/** Normalizing before adding avoids overflow for large, finite policy weights. */
export function calculateControlUtility(metrics: Pick<ControlMetrics, 'hardDisableCoverage' | 'attackSlowEquivalentCoverage' | 'rootCoverage' | 'groupingCoverage'>, policy: ControlPolicyWeights): number {
  const weights = [policy.hardDisable, policy.attackSlow, policy.root, policy.grouping]
  const maximum = Math.max(...weights)
  if (maximum === 0) return 0
  const normalized = weights.map((weight) => weight / maximum)
  const values = [metrics.hardDisableCoverage, metrics.attackSlowEquivalentCoverage, metrics.rootCoverage, metrics.groupingCoverage]
  return unit(values.reduce((sum, value, i) => sum + value * normalized[i]!, 0) / normalized.reduce((sum, weight) => sum + weight, 0))
}

/** Downstream of the converged offensive state. Never feeds back into DPS/DR/kills. */
export function calculateControl(build: Build, scenario: Scenario, attackSpeedMultiplier: number, hitsPerSecond: number, artifactControl?: ShockPowderControlState): ControlMetrics {
  const assumptions = scenario.crowdControl
  let stunning: ControlMetrics['stunning']
  let freezing: ControlMetrics['freezing']
  let chains: ControlMetrics['chains']
  let gravity: ControlMetrics['gravity']
  const intervals = resolveHitIntervalSequence(getAttackProfile(build.weapon.weaponId).value)
  for (const selected of build.enchantments) {
    if (!isControlId(selected.enchantmentId)) continue
    const effect = getTierValues(selected).effect
    if (!effect || !('durationSeconds' in effect)) throw new Error('Missing Control effect metadata')
    const triggerChance = 'triggerChance' in effect ? effect.triggerChance : 1
    const durationSeconds = effect.durationSeconds * (effect.kind === 'hard-stun' ? assumptions.stunningEffectiveDurationMultiplier : 1)
    const activeCoverage = calculateRefreshEffectCoverage({ hitIntervalSequence: intervals, attackSpeedMultiplier, encounterDurationSeconds: scenario.encounterDurationSeconds, triggerChance, durationSeconds })
    const eligibleTargetShare = assumptions[`${selected.enchantmentId}EligibleTargetShare`]
    const common = { triggerChance, opportunitiesPerSecond: hitsPerSecond, durationSeconds, activeCoverage, eligibleTargetShare }
    if (effect.kind === 'hard-stun') {
      stunning = { ...common, baseDurationSeconds: effect.durationSeconds, durationConfidence: STUNNING_DURATION.confidence, effectiveHardDisableCoverage: unit(activeCoverage * eligibleTargetShare) }
    } else if (effect.kind === 'enemy-attack-speed-slow') {
      freezing = { ...common, attackSpeedReduction: effect.attackSpeedReduction, attackSlowEquivalentCoverage: unit(activeCoverage * effect.attackSpeedReduction * eligibleTargetShare) }
    } else if (effect.kind === 'root-cluster') {
      const affectedTargetFraction = Math.min(1, assumptions.chainsExpectedTargetsPerProc / scenario.averageTargetsInReach)
      chains = { ...common, expectedTargetsPerProc: assumptions.chainsExpectedTargetsPerProc, affectedTargetFraction, rootCoverage: unit(activeCoverage * affectedTargetFraction * eligibleTargetShare) }
    } else if (effect.kind === 'group-pull') {
      const affectedTargetFraction = Math.min(1, assumptions.gravityExpectedTargetsPerHit / scenario.averageTargetsInReach)
      gravity = { ...common, expectedTargetsPerHit: assumptions.gravityExpectedTargetsPerHit, affectedTargetFraction, groupingCoverage: unit(activeCoverage * affectedTargetFraction * eligibleTargetShare) }
    } else throw new Error('Unsupported Control effect kind')
  }
  const weaponHardDisableCoverage = stunning?.effectiveHardDisableCoverage ?? 0
  const artifactHardDisableCoverage = artifactControl?.hardDisableCoverage ?? 0
  const chillingEnchant = build.armorEnchantments?.find((item) => item.enchantmentId === 'chilling')
  const chilling = chillingEnchant ? {
    tier: chillingEnchant.tier,
    pulseIntervalSeconds: 2 as const,
    durationSeconds: 1 as const,
    rawTemporalCoverage: 0.5 as const,
    attackSpeedReduction: ARMOR_ENCHANTMENTS.chilling.tiers[chillingEnchant.tier],
    eligibleTargetShare: scenario.crowdControl.chillingEligibleTargetShare ?? 0.5,
    affectedTargetShare: scenario.crowdControl.chillingAffectedTargetShare ?? 0.5,
    attackSlowEquivalentCoverage: unit(0.5 * ARMOR_ENCHANTMENTS.chilling.tiers[chillingEnchant.tier] * (scenario.crowdControl.chillingEligibleTargetShare ?? 0.5) * (scenario.crowdControl.chillingAffectedTargetShare ?? 0.5)),
  } : undefined
  const weaponAttackSlow = freezing?.attackSlowEquivalentCoverage ?? 0
  const armorAttackSlow = chilling?.attackSlowEquivalentCoverage ?? 0
  const metrics = {
    hardDisableCoverage: artifactControl
      ? unit(1 - (1 - weaponHardDisableCoverage) * (1 - artifactHardDisableCoverage))
      : weaponHardDisableCoverage,
    attackSlowEquivalentCoverage: unit(1 - (1 - weaponAttackSlow) * (1 - armorAttackSlow)),
    rootCoverage: chains?.rootCoverage ?? 0, groupingCoverage: gravity?.groupingCoverage ?? 0,
    ...(stunning ? { stunning } : {}), ...(freezing ? { freezing } : {}),
    ...(chains ? { chains } : {}), ...(gravity ? { gravity } : {}),
    ...(artifactControl ? { shockPowder: artifactControl, artifactContributions: [artifactControl] } : {}),
    ...(chilling ? { chilling } : {}),
  }
  return { ...metrics, utility: calculateControlUtility(metrics, scenario.controlPolicy) }
}

const percent = (value: number) => `${(value * 100).toFixed(2)}%`
export function describeControl(control: ControlMetrics): string[] {
  const reasons: string[] = []
  for (const id of ['stunning', 'freezing', 'chains', 'gravity'] as const) {
    const s = control[id]
    if (!s) continue
    const name = getEnchantmentDefinition(id).name.en
    const common = `${name}: HPS ${s.opportunitiesPerSecond.toFixed(3)} × ${percent(s.triggerChance)}、${s.durationSeconds}秒 → active ${percent(s.activeCoverage)}、適用対象 ${percent(s.eligibleTargetShare)}`
    if (id === 'stunning' && control.stunning) reasons.push(`${common} → hard disable ${percent(control.stunning.effectiveHardDisableCoverage)}（基準2秒はcommunity由来・信頼度低、耐性補正後）`)
    if (id === 'freezing' && control.freezing) reasons.push(`${common} × 敵攻撃速度低下 ${percent(control.freezing.attackSpeedReduction)} → attack slow ${percent(control.attackSlowEquivalentCoverage)}（移動低下・被ダメージ削減へ換算しない）`)
    if (id === 'chains' && control.chains) reasons.push(`${common}、平均${control.chains.expectedTargetsPerProc}体/proc × 対象比率${percent(control.chains.affectedTargetFraction)} → root ${percent(control.rootCoverage)}（移動を束縛、近くには攻撃可能、1copy限定）`)
    if (id === 'gravity' && control.gravity) reasons.push(`${common}、平均${control.gravity.expectedTargetsPerHit}体/hit × 対象比率${percent(control.gravity.affectedTargetFraction)} → grouping ${percent(control.groupingCoverage)}（集敵のみ、DPS bonusなし）`)
  }
  if (control.shockPowder) {
    const state = control.shockPowder
    reasons.push(`Shock Powder: Power ${state.powerLevel} → stun ${state.durationSeconds.toFixed(3)}秒、CD ${state.effectiveCooldownSeconds.toFixed(3)}秒 → raw ${percent(state.rawActiveCoverage)} × 適用可能 ${percent(state.eligibleTargetShare)} × 影響対象 ${percent(state.affectedTargetShare)} = hard disable ${percent(state.hardDisableCoverage)}（常時使用・refresh saturation近似、DPS/防御へ変換しない）`)
  }
  if (control.chilling) {
    const state = control.chilling
    reasons.push(`Chilling ${['I', 'II', 'III'][state.tier - 1]}: 2秒ごとに1秒 → raw ${percent(state.rawTemporalCoverage)} × 攻撃速度低下 ${percent(state.attackSpeedReduction)} × 適用可能 ${percent(state.eligibleTargetShare)} × 影響対象 ${percent(state.affectedTargetShare)} = attack slow ${percent(state.attackSlowEquivalentCoverage)}（steady-state周期仮定、移動低下・Defenseへ換算しない）`)
  }
  if (control.stunning && control.shockPowder) reasons.push(`Combined hard-disable coverage: ${percent(control.hardDisableCoverage)}`)
  return reasons
}

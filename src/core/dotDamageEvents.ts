import { DEFAULT_PERSISTENT_AREA_TARGETING, DOT_DAMAGE_CURVES } from '../data/dotDamageEvents'
import { calculateBaseHitsPerSecond, resolveHitIntervalSequence } from './attackProfile'
import { getTierValues } from './enchantment'
import { OptimizerInputError } from './errors'
import type { AttackProfile, AttachedDotDamageEvent, DotDamageCurve, DotDamageId, EnchantmentId, OnKillExplosionDamageEvent, PersistentAreaDotDamageEvent, Scenario, SelectedEnchantment } from './types'

function finiteRange(value: number, min: number, max = Number.MAX_VALUE, name = 'DoT／爆発モデルの値'): void {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new OptimizerInputError('INVALID_SCENARIO', `${name}は${min}以上${max}以下の有限値を指定してください。`)
  }
}

export function isDotDamageId(id: EnchantmentId): id is DotDamageId {
  return id === 'fire-aspect' || id === 'poison-cloud'
}
export function dotPowerRange(id: DotDamageId): { min: number; max: number } {
  const points = DOT_DAMAGE_CURVES[id].value.points
  return { min: points[0]!.powerLevel, max: points.at(-1)!.powerLevel }
}

export function interpolateDotDps(curve: DotDamageCurve, powerLevel: number): number {
  const points = curve.points
  if (curve.method !== 'log-linear' || points.length < 2 || points.some((point, i) =>
    !Number.isFinite(point.powerLevel) || !Number.isFinite(point.tierOneDps) || point.tierOneDps <= 0 ||
    (i > 0 && point.powerLevel <= points[i - 1]!.powerLevel))) throw new Error('DoT curve requires ascending Power and positive finite DPS knots')
  if (!Number.isFinite(powerLevel) || powerLevel < points[0]!.powerLevel || powerLevel > points.at(-1)!.powerLevel) {
    throw new OptimizerInputError('UNSUPPORTED_DOT_POWER', `DoTはPower ${points[0]!.powerLevel}–${points.at(-1)!.powerLevel}のみ対応。範囲外は外挿しません。`)
  }
  const exact = points.find((point) => point.powerLevel === powerLevel)
  if (exact) return exact.tierOneDps
  const i = points.findIndex((point) => point.powerLevel > powerLevel)
  const lower = points[i - 1]!
  const upper = points[i]!
  const t = (powerLevel - lower.powerLevel) / (upper.powerLevel - lower.powerLevel)
  return Math.exp(Math.log(lower.tierOneDps) * (1 - t) + Math.log(upper.tierOneDps) * t)
}

/** First hit at t=0, like the existing Void cadence. Tail clipped at encounter end.
 * Whole cycles avoid per-hit loops even for very long encounters. */
export function finiteBurnUptime(intervals: readonly number[], speed: number, encounterSeconds: number, durationSeconds = 3): number {
  finiteRange(speed, Number.MIN_VALUE)
  finiteRange(encounterSeconds, Number.MIN_VALUE)
  finiteRange(durationSeconds, 0)
  if (intervals.length === 0) throw new Error('Burn coverage requires a nonempty cadence')
  const scaled = intervals.map((interval) => {
    finiteRange(interval, Number.MIN_VALUE)
    const value = interval / speed
    finiteRange(value, Number.MIN_VALUE)
    return value
  })
  const cycle = scaled.reduce((sum, interval) => sum + interval, 0)
  finiteRange(cycle, Number.MIN_VALUE)
  const coveredCycle = scaled.reduce((sum, interval) => sum + Math.min(interval, durationSeconds), 0)
  const cycles = Math.floor(encounterSeconds / cycle)
  finiteRange(cycles, 0)
  let remaining = Math.max(0, encounterSeconds - cycles * cycle)
  let burned = cycles * coveredCycle
  for (const interval of scaled) {
    burned += Math.min(remaining, interval, durationSeconds)
    remaining = Math.max(0, remaining - interval)
  }
  return Math.min(1, burned / encounterSeconds)
}

/** Explicit steady-state Poisson approximation, with no additive cloud stacking. */
export function saturatedTargetExposure(rate: number, targetSeconds: number, targets: number): number {
  finiteRange(rate, 0)
  finiteRange(targetSeconds, 0)
  finiteRange(targets, 1)
  finiteRange(targetSeconds / targets, 0, 3)
  return targets * -Math.expm1(-rate * (targetSeconds / targets))
}

export function validatePersistentAreaTargeting(scenario: Scenario): void {
  const targeting = scenario.persistentAreaTargeting ?? DEFAULT_PERSISTENT_AREA_TARGETING
  finiteRange(scenario.averageTargetsInReach, 1)
  finiteRange(targeting.poisonCloudSingleTargetResidenceSeconds, 0, 3, 'Poison Cloudの単体滞在秒数')
  finiteRange(targeting.poisonCloudTargetSecondsPerEvent, targeting.poisonCloudSingleTargetResidenceSeconds, scenario.averageTargetsInReach * 3, 'Poison Cloudのtarget-seconds')
  finiteRange(targeting.poisonCloudTargetSecondsPerEvent / scenario.averageTargetsInReach, 0, 3)
}

export function calculateDotDamageEvents(powerLevel: number, enchantments: readonly SelectedEnchantment[], profile: AttackProfile, speed: number, scenario: Scenario, expectedTargetsHit: number): (AttachedDotDamageEvent | PersistentAreaDotDamageEvent)[] {
  return enchantments.flatMap((selected): (AttachedDotDamageEvent | PersistentAreaDotDamageEvent)[] => {
    const effect = getTierValues(selected).effect
    if (effect?.kind !== 'attached-dot' && effect?.kind !== 'persistent-area-dot') return []
    const common = { channel: 'enchantment-proc' as const, tier: selected.tier, durationSeconds: effect.durationSeconds, qualifiesAsDirectWeaponKill: false as const, confidence: 'low' as const }
    const damagePerSecond = interpolateDotDps(DOT_DAMAGE_CURVES[effect.dotId].value, powerLevel) * effect.tierMultiplier
    finiteRange(speed, Number.MIN_VALUE)
    if (effect.kind === 'attached-dot') {
      const targetUptime = finiteBurnUptime(resolveHitIntervalSequence(profile), speed, scenario.encounterDurationSeconds, effect.durationSeconds)
      const singleTargetDps = damagePerSecond * targetUptime
      return [{ ...common, kind: 'attached-dot', sourceId: 'fire-aspect', damagePerSecond, targetUptime, expectedTargetsHit, timeModel: 'finite-first-hit-at-zero', singleTargetDps, aoeDps: singleTargetDps * expectedTargetsHit }]
    }
    validatePersistentAreaTargeting(scenario)
    const targeting = scenario.persistentAreaTargeting ?? DEFAULT_PERSISTENT_AREA_TARGETING
    const opportunitiesPerSecond = calculateBaseHitsPerSecond(profile) * speed
    const cloudSpawnsPerSecond = opportunitiesPerSecond * effect.triggerChance
    const singleTargetResidenceSeconds = targeting.poisonCloudSingleTargetResidenceSeconds
    const targetSecondsPerEvent = targeting.poisonCloudTargetSecondsPerEvent
    const singleTargetUptime = saturatedTargetExposure(cloudSpawnsPerSecond, singleTargetResidenceSeconds, 1)
    const effectiveAoeTargets = saturatedTargetExposure(cloudSpawnsPerSecond, targetSecondsPerEvent, scenario.averageTargetsInReach)
    return [{ ...common, kind: 'persistent-area-dot', sourceId: 'poison-cloud', damagePerSecond, opportunitiesPerSecond, triggerProbability: effect.triggerChance, cloudSpawnsPerSecond, singleTargetResidenceSeconds, targetSecondsPerEvent, singleTargetUptime, effectiveAoeTargets, overlapModel: 'poisson-saturation-assumption', singleTargetDps: damagePerSecond * singleTargetUptime, aoeDps: damagePerSecond * effectiveAoeTargets }]
  })
}

export function calculateExplosionDamageEvents(enchantments: readonly SelectedEnchantment[], scenario: Scenario, sourceKillsPerSecond: number | undefined): OnKillExplosionDamageEvent[] {
  return enchantments.flatMap((selected): OnKillExplosionDamageEvent[] => {
    const effect = getTierValues(selected).effect
    if (effect?.kind !== 'on-direct-kill-explosion') return []
    if (sourceKillsPerSecond === undefined) throw new Error('Exploding requires a source kill rate from the offensive steady-state solver')
    finiteRange(sourceKillsPerSecond, 0)
    finiteRange(scenario.averageEnemyHealth, Number.MIN_VALUE)
    finiteRange(scenario.averageTargetsInReach, 1)
    const expectedSecondaryTargets = Math.min(1, Math.max(0, scenario.averageTargetsInReach - 1))
    const damagePerSecondaryTarget = scenario.averageEnemyHealth * effect.healthFraction
    const aoeDps = sourceKillsPerSecond * damagePerSecondaryTarget * expectedSecondaryTargets
    finiteRange(aoeDps, 0)
    return [{ kind: 'on-kill-explosion', sourceId: 'exploding', tier: selected.tier, channel: 'enchantment-proc', sourceKillsPerSecond, sourceHealth: scenario.averageEnemyHealth, healthFraction: effect.healthFraction, damagePerSecondaryTarget, expectedSecondaryTargets, singleTargetDps: 0, aoeDps, chainReaction: false, qualifiesAsDirectWeaponKill: false, confidence: 'low' }]
  })
}

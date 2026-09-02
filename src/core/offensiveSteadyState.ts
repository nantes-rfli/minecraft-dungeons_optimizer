import { calculateArtifactActivationState, calculateArtifactActivationOpportunities } from './artifact'
import { deriveSoulState } from './souls'
import { deriveCombatState } from './combatState'
import { calculateDamage } from './damage'
import { solveUnitIntervalFixedPoint, solveBracketedUnitFixedPoint } from './fixedPoint'
import { hasEnchantment } from './enchantment'
import { combineRampagingEffects, temporaryBuffUptime } from './temporalEnchantments'
import { deriveArmorState, resolveBuildHealth } from './armor'
import { ARMOR_ENCHANTMENTS } from '../data/armors'
import type { ArmorState, ArtifactEffects, Build, CombatState, DamageMetrics, OffensiveTemporalState, Scenario, SoulState } from './types'

interface OffensiveState {
  readonly armorState?: ArmorState
  readonly soulState?: SoulState
  readonly damage: DamageMetrics
  readonly combatState: CombatState
  readonly temporalState: OffensiveTemporalState
}

export function resolveOffensiveSteadyState(build: Build, scenario: Scenario, artifactEffects: ArtifactEffects): OffensiveState {
  const armorState = deriveArmorState(build, scenario)
  const resolvedMaxHealth = resolveBuildHealth(build, scenario).finalMaxHealth
  const effect = combineRampagingEffects(build.enchantments)
  const artifactActivation = calculateArtifactActivationState(calculateArtifactActivationOpportunities(build.artifacts, scenario, build))
  const cowardice = build.armorEnchantments?.find((item) => item.enchantmentId === 'cowardice')
  const cowardiceExpectedMultiplier = cowardice
    ? 1 + scenario.cowardiceFullHealthShare! * ARMOR_ENCHANTMENTS.cowardice.tiers[cowardice.tier]
    : 1
  const usesExploding = hasEnchantment(build.enchantments, 'exploding')
  let initialDirectKillsPerSecond = 0
  let firstExplodingAoeDps = 0
  let explosionIterations = 0
  let firstEvaluation = true
  const atUptime = (uptime: number) => {
    const attackSpeedMultiplier = artifactEffects.attackSpeedMultiplier + (armorState?.meleeAttackSpeedBonus ?? 0) + (effect?.attackSpeedBonus ?? 0) * uptime
    const atSourceRate = (sourceRate: number) => {
      const damage = calculateDamage(
        build.weapon, build.enchantments, artifactEffects, scenario, attackSpeedMultiplier,
        sourceRate, artifactActivation, resolvedMaxHealth,
        armorState?.directMeleeDamageMultiplier ?? 1,
        armorState?.meleeDamageMultiplier ?? 1,
        armorState?.weaponDamageAuraMultiplier ?? 1,
        cowardiceExpectedMultiplier,
        cowardice ? scenario.cowardiceFullHealthShare : undefined,
      )
      return { damage, combatState: deriveCombatState(damage, scenario) }
    }
    const initial = atSourceRate(0)
    // Committed can increase the direct channel as indirect damage shortens
    // the HP trajectory, but never beyond twice its pre-boost damage.
    const maximumSourceRate = Math.min(
      scenario.enemySupplyPerSecond * scenario.directKillShare,
      initial.damage.directWeaponAoeDps / scenario.averageEnemyHealth * scenario.directKillShare * 2,
    )
    if (usesExploding && firstEvaluation) {
      initialDirectKillsPerSecond = initial.combatState.directWeaponKillsPerSecond
      firstExplodingAoeDps = atSourceRate(initialDirectKillsPerSecond).damage.explosionAoeDps
    }
    firstEvaluation = false
    // Inner source-rate solve is repeated for each outer Rampaging speed. Only
    // direct kills feed it; aggregate feedback never creates event chains.
    const explosionPoint = usesExploding && maximumSourceRate > 0
      ? solveBracketedUnitFixedPoint((fraction) => {
        const result = atSourceRate(fraction * maximumSourceRate)
        return { result, nextValue: result.combatState.directWeaponKillsPerSecond / maximumSourceRate }
      })
      : { result: initial, iterations: 0, residual: 0 }
    explosionIterations += explosionPoint.iterations
    const { damage, combatState } = explosionPoint.result
    const triggerEventsPerSecond = (effect?.triggerChance ?? 0) * combatState.directWeaponKillsPerSecond
    for (const value of [attackSpeedMultiplier, damage.singleTargetDps, damage.aoeDps, combatState.directWeaponKillsPerSecond, triggerEventsPerSecond]) {
      if (!Number.isFinite(value) || value < 0) throw new Error('Offensive steady state exceeds finite nonnegative numeric range')
    }
    const soulState = deriveSoulState(build, damage, combatState, scenario)
    return { damage, combatState, soulState, attackSpeedMultiplier, triggerEventsPerSecond, explosionResidual: explosionPoint.residual }
  }
  // Unaffected builds perform exactly one damage/combat evaluation, no iteration.
  const point = effect
    ? solveUnitIntervalFixedPoint((uptime) => {
      const result = atUptime(uptime)
      return { result, nextValue: temporaryBuffUptime(result.triggerEventsPerSecond, effect.durationSeconds) }
    })
    : { value: 0, result: atUptime(0), iterations: 0, firstIterationValue: 0, residual: 0 }
  const { damage, combatState, soulState, attackSpeedMultiplier, triggerEventsPerSecond } = point.result
  return {
    ...(armorState ? { armorState } : {}), damage, combatState, soulState,
    temporalState: {
      ...(usesExploding ? { exploding: {
        initialDirectKillsPerSecond, firstExplodingAoeDps,
        convergedExplodingAoeDps: damage.explosionAoeDps,
        directDamageShare: combatState.directDamageShare,
        directWeaponKillsPerSecond: combatState.directWeaponKillsPerSecond,
        iterations: explosionIterations, residual: point.result.explosionResidual,
      } } : {}),
      artifactActivation, artifactSynergy: damage.artifactSynergyState, attackSpeedMultiplier,
      rampaging: {
        triggerChance: effect?.triggerChance ?? 0,
        effectiveDurationSeconds: effect?.durationSeconds ?? 0,
        directWeaponKillsPerSecond: combatState.directWeaponKillsPerSecond,
        triggerEventsPerSecond, uptime: point.value,
        activeAttackSpeedBonus: effect?.attackSpeedBonus ?? 0,
        averageAttackSpeedBonus: (effect?.attackSpeedBonus ?? 0) * point.value,
        iterations: point.iterations, firstIterationUptime: point.firstIterationValue, residual: point.residual,
      },
    },
  }
}

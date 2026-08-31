import { calculateArtifactActivationState } from './artifact'
import { deriveCombatState } from './combatState'
import { calculateDamage } from './damage'
import { solveUnitIntervalFixedPoint } from './fixedPoint'
import { combineRampagingEffects, temporaryBuffUptime } from './temporalEnchantments'
import type { ArtifactEffects, Build, CombatState, DamageMetrics, OffensiveTemporalState, Scenario } from './types'

interface OffensiveState {
  readonly damage: DamageMetrics
  readonly combatState: CombatState
  readonly temporalState: OffensiveTemporalState
}

export function resolveOffensiveSteadyState(build: Build, scenario: Scenario, artifactEffects: ArtifactEffects): OffensiveState {
  const effect = combineRampagingEffects(build.enchantments)
  const artifactActivation = calculateArtifactActivationState(artifactEffects.uptimes)
  const atUptime = (uptime: number) => {
    const attackSpeedMultiplier = artifactEffects.attackSpeedMultiplier + (effect?.attackSpeedBonus ?? 0) * uptime
    const damage = calculateDamage(build.weapon, build.enchantments, artifactEffects, scenario, attackSpeedMultiplier)
    const combatState = deriveCombatState(damage, scenario)
    const triggerEventsPerSecond = (effect?.triggerChance ?? 0) * combatState.directWeaponKillsPerSecond
    for (const value of [attackSpeedMultiplier, damage.singleTargetDps, damage.aoeDps, combatState.directWeaponKillsPerSecond, triggerEventsPerSecond]) {
      if (!Number.isFinite(value) || value < 0) throw new Error('Offensive steady state exceeds finite nonnegative numeric range')
    }
    return { damage, combatState, attackSpeedMultiplier, triggerEventsPerSecond }
  }
  // Unaffected builds perform exactly one damage/combat evaluation, no iteration.
  const point = effect
    ? solveUnitIntervalFixedPoint((uptime) => {
      const result = atUptime(uptime)
      return { result, nextValue: temporaryBuffUptime(result.triggerEventsPerSecond, effect.durationSeconds) }
    })
    : { value: 0, result: atUptime(0), iterations: 0, firstIterationValue: 0, residual: 0 }
  const { damage, combatState, attackSpeedMultiplier, triggerEventsPerSecond } = point.result
  return {
    damage, combatState,
    temporalState: {
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

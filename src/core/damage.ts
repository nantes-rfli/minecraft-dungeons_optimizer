import { calculateArtifactActivationState } from './artifact'
import { calculatePainCycle, calculateDynamo, finiteAttackCadence, dynamoDamagePerStack } from './chargeConsume'
import { deriveArtifactSynergyState } from './temporalEnchantments'
import { MODEL } from '../data/model'
import { CROSS_WEAPON_DAMAGE_SCALING, GEAR_POWER_CURVE } from '../data/powerScaling'
import { VOID_STRIKE_CURVE } from '../data/voidStrike'
import { calculateBaseHitsPerSecond, resolveHitIntervalSequence } from './attackProfile'
import { getAttackProfile, getWeaponDefinition } from './catalog'
import { combineDirectWeaponBonuses, enchantmentsById, getTierValues } from './enchantment'
import {
  calculatePowerScaledHitDamage,
  resolveWeaponDamageCoefficient,
} from './powerScaling'
import { calculateAverageVoidStrikeMultiplier } from './voidStrike'
import { calculateDamageEvents, enchantmentCombinationUnsupportedReason } from './damageEvents'
import { calculateDotDamageEvents, calculateExplosionDamageEvents } from './dotDamageEvents'
import { OptimizerInputError } from './errors'
import { committedTrajectory, conditionalDirectDamage } from './enemyStateDamage'
import type {
  ArtifactActivationState,
  ArtifactEffects,
  DamageMetrics,
  OwnedWeapon,
  Scenario,
  SelectedEnchantment,
} from './types'

function criticalExpectedMultiplier(enchantments: readonly SelectedEnchantment[]): number {
  const selected = enchantmentsById(enchantments, 'critical-hit')[0]
  if (!selected) return 1
  const values = getTierValues(selected)
  const chance = values.triggerChance ?? 0
  const multiplier = values.damageMultiplier ?? 1
  return 1 + chance * (multiplier - 1)
}

function voidStrikeExpectedMultiplier(
  enchantments: readonly SelectedEnchantment[],
  hitIntervalSequence: readonly number[],
  attackSpeedMultiplier: number,
  scenario: Scenario,
): number {
  const selected = enchantmentsById(enchantments, 'void-strike')[0]
  if (!selected) return 1
  const maxBonus = getTierValues(selected).maxBonusDamage ?? 0
  return calculateAverageVoidStrikeMultiplier(
    VOID_STRIKE_CURVE.value,
    hitIntervalSequence,
    scenario.encounterDurationSeconds,
    attackSpeedMultiplier,
    1 + maxBonus,
  )
}

export function calculateDamage(
  ownedWeapon: Pick<OwnedWeapon, 'weaponId' | 'powerLevel' | 'observedDamagePerHit'>,
  enchantments: readonly SelectedEnchantment[],
  artifactEffects: ArtifactEffects,
  scenario: Scenario,
  attackSpeedMultiplier = artifactEffects.attackSpeedMultiplier,
  explosionSourceKillsPerSecond?: number,
  artifactActivation: ArtifactActivationState = calculateArtifactActivationState(artifactEffects.uptimes),
  resolvedMaxHealth = scenario.maxHealth,
  armorDirectMeleeMultiplier = 1,
): DamageMetrics {
  const unsupported = enchantmentCombinationUnsupportedReason(enchantments)
  if (unsupported) throw new OptimizerInputError('UNSUPPORTED_ENCHANTMENT_COMBINATION', unsupported)
  const { weaponId } = ownedWeapon
  const weapon = getWeaponDefinition(weaponId)
  const attackProfile = getAttackProfile(weaponId)
  const damageSource = ownedWeapon.observedDamagePerHit === undefined
    ? 'power-curve-estimate'
    : 'observed-input'
  const referenceWeapon = getWeaponDefinition(
    GEAR_POWER_CURVE.value.referenceWeaponId,
  )
  const damagePerHit = ownedWeapon.observedDamagePerHit ?? calculatePowerScaledHitDamage(
    resolveWeaponDamageCoefficient(weapon, CROSS_WEAPON_DAMAGE_SCALING.value),
    resolveWeaponDamageCoefficient(referenceWeapon, CROSS_WEAPON_DAMAGE_SCALING.value),
    ownedWeapon.powerLevel,
    GEAR_POWER_CURVE.value,
  )
  const hitsPerSecond =
    calculateBaseHitsPerSecond(attackProfile.value) *
    attackSpeedMultiplier
  const artifactSynergyState = deriveArtifactSynergyState(enchantments, artifactActivation, hitsPerSecond)
  const baseDps = damagePerHit * hitsPerSecond
  const pain = enchantmentsById(enchantments, 'pain-cycle')[0]
  const dynamo = enchantmentsById(enchantments, 'dynamo')[0]
  // No finite-cadence construction for unaffected builds.
  const cadence = pain || dynamo ? finiteAttackCadence(resolveHitIntervalSequence(attackProfile.value), attackSpeedMultiplier, scenario.encounterDurationSeconds) : undefined
  const painCycleState = pain ? calculatePainCycle(cadence!.totalAttackActions, pain.tier, damagePerHit, resolvedMaxHealth, scenario.encounterDurationSeconds) : undefined
  const dynamoState = dynamo ? calculateDynamo(cadence!, scenario.encounterDurationSeconds, scenario.rollsPerSecond ?? 0, scenario.dynamoInitialStacks ?? 0, dynamoDamagePerStack(ownedWeapon.powerLevel, dynamo.tier)) : undefined
  const chargeDirectDps = (painCycleState?.directDps ?? 0) + (dynamoState?.directDps ?? 0)
  const criticalMultiplier = criticalExpectedMultiplier(enchantments)
  const voidStrikeMultiplier = voidStrikeExpectedMultiplier(
    enchantments,
    resolveHitIntervalSequence(attackProfile.value),
    attackSpeedMultiplier,
    scenario,
  )
  // Direct melee channel only. Independent scalar expectations commute within
  // this model; proc/DoT and future additive damage bonuses must not enter here.
  const sharpnessMultiplier = 1 + combineDirectWeaponBonuses(enchantments, 'sharpness')
  const unchanting = conditionalDirectDamage(enchantments, 'unchanting', scenario)
  const smiting = conditionalDirectDamage(enchantments, 'smiting', scenario)
  const ambush = conditionalDirectDamage(enchantments, 'ambush', scenario)
  const enchantedShare = scenario.enemyComposition.enchantedShare
  const unchantingMultiplier = unchanting.expectedMultiplier
  const smitingMultiplier = smiting.expectedMultiplier
  const ambushMultiplier = ambush.expectedMultiplier
  // These two legacy diagnostics are explicitly PRE-Committed, with the other
  // condition expectations held fixed (the MVP independent-condition model).
  const nonEnchantedTargetDps = baseDps * armorDirectMeleeMultiplier * sharpnessMultiplier * criticalMultiplier * voidStrikeMultiplier * smitingMultiplier * ambushMultiplier * artifactSynergyState.expectedDirectMultiplier + chargeDirectDps
  const enchantedTargetDps = nonEnchantedTargetDps * unchanting.activeMultiplier
  // Standalone charge additions enter ONLY the direct channel. Unknown damage
  // modifier combinations have already been rejected, never silently factored.
  const preCommittedDirectWeaponSingleTargetDps = nonEnchantedTargetDps * unchantingMultiplier
  const areaCoverage = Math.min(1, weapon.area.value / MODEL.maximumAreaRating.value)
  const expectedTargetsHit =
    1 + (scenario.averageTargetsInReach - 1) * areaCoverage
  const preCommittedDirectWeaponAoeDps = preCommittedDirectWeaponSingleTargetDps * expectedTargetsHit
  const damageEvents = calculateDamageEvents(ownedWeapon.powerLevel, enchantments, attackProfile.value, attackSpeedMultiplier, scenario)
  const dotDamageEvents = calculateDotDamageEvents(ownedWeapon.powerLevel, enchantments, attackProfile.value, attackSpeedMultiplier, scenario, expectedTargetsHit)
  const explosionDamageEvents = calculateExplosionDamageEvents(enchantments, scenario, explosionSourceKillsPerSecond)
  const instantIndirectSingleTargetDps = damageEvents.reduce((sum, event) => sum + event.singleTargetDps, 0)
  const instantIndirectAoeDps = damageEvents.reduce((sum, event) => sum + event.aoeDps, 0)
  const dotSingleTargetDps = dotDamageEvents.reduce((sum, event) => sum + event.singleTargetDps, 0)
  const dotAoeDps = dotDamageEvents.reduce((sum, event) => sum + event.aoeDps, 0)
  const explosionAoeDps = explosionDamageEvents.reduce((sum, event) => sum + event.aoeDps, 0)
  const indirectSingleTargetDps = instantIndirectSingleTargetDps + dotSingleTargetDps
  const indirectAoeDps = instantIndirectAoeDps + dotAoeDps + explosionAoeDps
  const committed = enchantmentsById(enchantments, 'committed')[0]
  const committedEffect = committed ? getTierValues(committed).effect : undefined
  if (committed && committedEffect?.kind !== 'target-health-weapon-damage') throw new Error('Missing Committed health effect')
  const maxBonus = committedEffect?.kind === 'target-health-weapon-damage' ? committedEffect.maxBonus : 0
  const singleTrajectory = committedTrajectory(preCommittedDirectWeaponSingleTargetDps, indirectSingleTargetDps, maxBonus)
  const aoeTrajectory = committedTrajectory(preCommittedDirectWeaponAoeDps, indirectAoeDps, maxBonus)
  const directWeaponSingleTargetDps = singleTrajectory.effectiveDirectDps
  const directWeaponAoeDps = aoeTrajectory.effectiveDirectDps

  return {
    ...(armorDirectMeleeMultiplier !== 1 ? { armorDirectMeleeMultiplier } : {}),
    ...(painCycleState ? { painCycleState } : {}),
    ...(dynamoState ? { dynamoState } : {}),
    artifactSynergyState,
    damageSource,
    damagePerHit,
    hitsPerSecond,
    baseDps,
    directWeaponSingleTargetDps,
    directWeaponAoeDps,
    indirectSingleTargetDps,
    indirectAoeDps,
    damageEvents,
    dotDamageEvents,
    explosionDamageEvents,
    instantIndirectSingleTargetDps,
    instantIndirectAoeDps,
    dotSingleTargetDps,
    dotAoeDps,
    explosionAoeDps,
    singleTargetDps: directWeaponSingleTargetDps + indirectSingleTargetDps,
    aoeDps: directWeaponAoeDps + indirectAoeDps,
    expectedTargetsHit,
    criticalMultiplier,
    voidStrikeMultiplier,
    sharpnessMultiplier,
    unchantingMultiplier,
    smitingMultiplier,
    smitingActiveUndeadMultiplier: smiting.activeMultiplier,
    ambushMultiplier,
    undeadShare: scenario.enemyComposition.undeadShare,
    ambushEligibleShare: scenario.enemyState.ambushEligibleDirectDamageShare,
    preCommittedDirectWeaponSingleTargetDps,
    preCommittedDirectWeaponAoeDps,
    committedSingleTargetMultiplier: singleTrajectory.directMultiplier,
    committedAoeMultiplier: aoeTrajectory.directMultiplier,
    enchantedShare,
    enchantedTargetDps,
    nonEnchantedTargetDps,
  }
}

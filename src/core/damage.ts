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
import type {
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
): DamageMetrics {
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
    artifactEffects.attackSpeedMultiplier
  const baseDps = damagePerHit * hitsPerSecond
  const criticalMultiplier = criticalExpectedMultiplier(enchantments)
  const voidStrikeMultiplier = voidStrikeExpectedMultiplier(
    enchantments,
    resolveHitIntervalSequence(attackProfile.value),
    artifactEffects.attackSpeedMultiplier,
    scenario,
  )
  // Direct melee channel only. Independent scalar expectations commute within
  // this model; proc/DoT and future additive damage bonuses must not enter here.
  const sharpnessMultiplier = 1 + combineDirectWeaponBonuses(enchantments, 'sharpness')
  const unchantingBonus = combineDirectWeaponBonuses(enchantments, 'unchanting')
  const enchantedShare = scenario.enemyComposition.enchantedShare
  const unchantingMultiplier = 1 + enchantedShare * unchantingBonus
  const nonEnchantedTargetDps = baseDps * sharpnessMultiplier * criticalMultiplier * voidStrikeMultiplier
  const enchantedTargetDps = nonEnchantedTargetDps * (1 + unchantingBonus)
  const singleTargetDps = nonEnchantedTargetDps * unchantingMultiplier
  const areaCoverage = Math.min(1, weapon.area.value / MODEL.maximumAreaRating.value)
  const expectedTargetsHit =
    1 + (scenario.averageTargetsInReach - 1) * areaCoverage

  return {
    damageSource,
    damagePerHit,
    hitsPerSecond,
    baseDps,
    singleTargetDps,
    aoeDps: singleTargetDps * expectedTargetsHit,
    expectedTargetsHit,
    criticalMultiplier,
    voidStrikeMultiplier,
    sharpnessMultiplier,
    unchantingMultiplier,
    enchantedShare,
    enchantedTargetDps,
    nonEnchantedTargetDps,
  }
}

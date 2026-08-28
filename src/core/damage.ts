import { MODEL } from '../data/model'
import { GEAR_POWER_CURVE } from '../data/powerScaling'
import { VOID_STRIKE_CURVE } from '../data/voidStrike'
import { calculateBaseHitsPerSecond } from './attackProfile'
import { getAttackProfile, getEnchantmentDefinition, getWeaponDefinition } from './catalog'
import { enchantmentsById, getTierValues } from './enchantment'
import { calculatePowerScaledHitDamage } from './powerScaling'
import { calculateVoidStrikeMultiplier } from './voidStrike'
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
  hitsPerSecond: number,
  scenario: Scenario,
): number {
  const selected = enchantmentsById(enchantments, 'void-strike')[0]
  if (!selected || hitsPerSecond <= 0) return 1
  const maxBonus = getTierValues(selected).maxBonusDamage ?? 0
  const referenceMaxBonus =
    getEnchantmentDefinition('void-strike').tiers.value[3].maxBonusDamage ?? 0
  const intervalSeconds = 1 / hitsPerSecond
  const referenceFollowUpHitMultiplier = calculateVoidStrikeMultiplier(
    VOID_STRIKE_CURVE.value,
    intervalSeconds,
    1 + referenceMaxBonus,
  )
  const followUpHitMultiplier = referenceMaxBonus > 0
    ? 1 + (referenceFollowUpHitMultiplier - 1) * maxBonus / referenceMaxBonus
    : 1
  const expectedHitCount = hitsPerSecond * scenario.encounterDurationSeconds

  if (expectedHitCount <= 1) return 1
  return (1 + (expectedHitCount - 1) * followUpHitMultiplier) / expectedHitCount
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
  const damagePerHit = ownedWeapon.observedDamagePerHit ?? calculatePowerScaledHitDamage(
    weapon.baseHitDamage.value,
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
    hitsPerSecond,
    scenario,
  )
  const singleTargetDps = baseDps * criticalMultiplier * voidStrikeMultiplier
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
  }
}

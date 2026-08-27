import { MODEL } from '../data/model'
import { getEnchantmentDefinition, getWeaponDefinition } from './catalog'
import type {
  ArtifactEffects,
  DamageMetrics,
  EnchantmentId,
  Scenario,
  WeaponId,
} from './types'

function includes(enchantments: readonly EnchantmentId[], id: EnchantmentId): boolean {
  return enchantments.includes(id)
}

function criticalExpectedMultiplier(enchantments: readonly EnchantmentId[]): number {
  if (!includes(enchantments, 'critical-hit')) return 1
  const definition = getEnchantmentDefinition('critical-hit')
  const chance = definition.triggerChance?.value ?? 0
  const multiplier = definition.damageMultiplier?.value ?? 1
  return 1 + chance * (multiplier - 1)
}

function voidStrikeExpectedMultiplier(
  enchantments: readonly EnchantmentId[],
  hitsPerSecond: number,
  scenario: Scenario,
): number {
  if (!includes(enchantments, 'void-strike') || hitsPerSecond <= 0) return 1
  const maxBonus = getEnchantmentDefinition('void-strike').maxBonusDamage?.value ?? 0
  const intervalSeconds = 1 / hitsPerSecond
  const rampFraction = Math.min(1, intervalSeconds / scenario.voidRampSeconds)
  const followUpHitMultiplier = 1 + maxBonus * rampFraction
  const expectedHitCount = hitsPerSecond * scenario.encounterDurationSeconds

  if (expectedHitCount <= 1) return 1
  return (1 + (expectedHitCount - 1) * followUpHitMultiplier) / expectedHitCount
}

export function calculateDamage(
  weaponId: WeaponId,
  enchantments: readonly EnchantmentId[],
  artifactEffects: ArtifactEffects,
  scenario: Scenario,
): DamageMetrics {
  const weapon = getWeaponDefinition(weaponId)
  const damagePerHit = weapon.power.value
  const hitsPerSecond =
    weapon.speed.value *
    MODEL.attacksPerSecondPerSpeedPoint.value *
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

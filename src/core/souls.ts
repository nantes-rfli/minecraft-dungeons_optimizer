import { BASE_SOUL_CAPACITY, INITIAL_SOULS } from '../data/souls'
import { getEnchantmentDefinition, getWeaponDefinition } from './catalog'
import { getTierValues } from './enchantment'
import type { Build, CombatState, DamageMetrics, OnHitSoulGenerationEffect, Scenario, SoulIncome, SoulState, SoulTrajectory } from './types'

function nonnegative(name: string, value: number): number {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${name} must be finite and nonnegative`)
  return value
}

/** Zero-start, no-spending closed form; never assume a permanently full meter. */
export function soulTrajectory(incomePerSecond: number, capacity: number, durationSeconds: number): SoulTrajectory {
  nonnegative('Soul income', incomePerSecond)
  if (!Number.isFinite(capacity) || capacity <= 0 || !Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw new Error('Soul capacity and encounter duration must be finite and positive')
  }
  if (incomePerSecond === 0) return { encounterAverageSoulFraction: 0, endSoulFraction: 0 }
  const fillTimeSeconds = capacity / incomePerSecond
  // Overflow is explicit instead of returning an infinite diagnostic or NaN.
  if (!Number.isFinite(fillTimeSeconds)) throw new Error('Soul fill time exceeds finite numeric range')
  if (fillTimeSeconds >= durationSeconds) {
    const endSoulFraction = durationSeconds / fillTimeSeconds
    return { fillTimeSeconds, endSoulFraction, encounterAverageSoulFraction: endSoulFraction / 2 }
  }
  return { fillTimeSeconds, endSoulFraction: 1, encounterAverageSoulFraction: 1 - fillTimeSeconds / durationSeconds / 2 }
}

export function soulIncome(pickupEventsPerSecond: number, gathering: number): SoulIncome {
  nonnegative('Soul pickups', pickupEventsPerSecond)
  nonnegative('Soul gathering', gathering)
  return { pickupEventsPerSecond, resourceUnitsPerSecond: nonnegative('Soul resource income', pickupEventsPerSecond * gathering) }
}

export function siphonIncome(opportunitiesPerSecond: number, effect: OnHitSoulGenerationEffect, gathering: number): SoulIncome & { readonly procEventsPerSecond: number } {
  nonnegative('Soul Siphon opportunities', opportunitiesPerSecond)
  if (!Number.isFinite(effect.triggerChance) || effect.triggerChance < 0 || effect.triggerChance > 1 || !Number.isSafeInteger(effect.extraPickupCount) || effect.extraPickupCount < 1) {
    throw new Error('Invalid Soul Siphon probability or pickup count')
  }
  const procEventsPerSecond = opportunitiesPerSecond * effect.triggerChance
  return { ...soulIncome(procEventsPerSecond * effect.extraPickupCount, gathering), procEventsPerSecond }
}

export function animaHealingCapacity(pickupEventsPerSecond: number, maxHealth: number, fraction: number): number {
  nonnegative('Anima pickups', pickupEventsPerSecond)
  if (!Number.isFinite(maxHealth) || maxHealth <= 0 || !Number.isFinite(fraction) || fraction < 0 || fraction > 1) {
    throw new Error('Invalid Anima max health or healing fraction')
  }
  return nonnegative('Anima healing capacity', pickupEventsPerSecond * (maxHealth * fraction))
}

/** Called within the offensive resolver, sharing exactly its HPS and kill rate. */
export function deriveSoulState(build: Build, damage: DamageMetrics, combat: CombatState, scenario: Scenario): SoulState | undefined {
  const baseSoulGathering = getWeaponDefinition(build.weapon.weaponId).soul.baseSoulGathering.value
  if (baseSoulGathering === 0) return undefined
  const enchantmentSoulGathering = build.enchantments.reduce((sum, selected) => sum + (getEnchantmentDefinition(selected.enchantmentId).soul?.soulGathering.value ?? 0), 0)
  const externalSoulGathering = 0
  const totalSoulGathering = nonnegative('Total Soul Gathering', baseSoulGathering + enchantmentSoulGathering + externalSoulGathering)
  const normal = soulIncome(combat.estimatedKillsPerSecond, totalSoulGathering)
  const selected = build.enchantments.find((item) => item.enchantmentId === 'soul-siphon')
  const effect = selected ? getTierValues(selected).effect : undefined
  if (selected && effect?.kind !== 'on-hit-soul-generation') throw new Error('Missing Soul Siphon effect')
  const siphon = effect?.kind === 'on-hit-soul-generation'
    ? siphonIncome(damage.hitsPerSecond, effect, totalSoulGathering)
    : { resourceUnitsPerSecond: 0, pickupEventsPerSecond: 0, procEventsPerSecond: 0 }
  const totalResourceUnitsPerSecond = nonnegative('Total Soul income', normal.resourceUnitsPerSecond + siphon.resourceUnitsPerSecond)
  const totalPickupEventsPerSecond = nonnegative('Total Soul pickups', normal.pickupEventsPerSecond + siphon.pickupEventsPerSecond)
  return {
    capacity: BASE_SOUL_CAPACITY.value, initialSouls: INITIAL_SOULS.value,
    baseSoulGathering, enchantmentSoulGathering, externalSoulGathering, totalSoulGathering,
    eligibleSoulGeneratingKillsPerSecond: combat.estimatedKillsPerSecond,
    siphonOpportunitiesPerSecond: selected ? damage.hitsPerSecond : 0,
    siphonTriggerChance: effect?.kind === 'on-hit-soul-generation' ? effect.triggerChance : 0,
    siphonPickupsPerProc: effect?.kind === 'on-hit-soul-generation' ? effect.extraPickupCount : 0,
    siphonProcEventsPerSecond: siphon.procEventsPerSecond,
    normalPickupEventsPerSecond: normal.pickupEventsPerSecond,
    siphonPickupEventsPerSecond: siphon.pickupEventsPerSecond,
    totalPickupEventsPerSecond,
    normalResourceUnitsPerSecond: normal.resourceUnitsPerSecond,
    siphonResourceUnitsPerSecond: siphon.resourceUnitsPerSecond,
    totalResourceUnitsPerSecond, spendingUnitsPerSecond: 0,
    ...soulTrajectory(totalResourceUnitsPerSecond, BASE_SOUL_CAPACITY.value, scenario.encounterDurationSeconds),
  }
}

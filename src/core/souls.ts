import { BASE_SOUL_CAPACITY, INITIAL_SOULS } from '../data/souls'
import { getArtifactDefinition, getEnchantmentDefinition, getWeaponDefinition } from './catalog'
import { calculateArtifactEffectiveCooldown } from './artifact'
import { deriveArmorState, resolveArtifactCooldown } from './armor'
import { getTierValues } from './enchantment'
import type { ArmorState, Build, CombatState, DamageMetrics, OnHitSoulGenerationEffect, OwnedArtifact, Scenario, SoulConsumer, SoulIncome, SoulResourceSchedule, SoulState, SoulTrajectory } from './types'

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

const SCHEDULE_EPSILON = 1e-9

/**
 * Event-based finite resource policy for one shared pool and at most one spender.
 * A ready consumer fires immediately when it becomes affordable. Multiple spenders
 * are rejected because their ordering is a player policy, not a slot-order fact.
 */
export function simulateSoulResourceSchedule(input: {
  readonly durationSeconds: number
  readonly initialSouls: number
  readonly capacity: number
  readonly incomeUnitsPerSecond: number
  readonly consumers: readonly SoulConsumer[]
}): SoulResourceSchedule {
  const { durationSeconds, initialSouls, capacity, incomeUnitsPerSecond, consumers } = input
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0 || !Number.isFinite(capacity) || capacity <= 0) {
    throw new Error('Soul schedule duration and capacity must be finite and positive')
  }
  nonnegative('Soul schedule initial Souls', initialSouls)
  nonnegative('Soul schedule income', incomeUnitsPerSecond)
  if (initialSouls > capacity) throw new Error('Soul schedule initial Souls cannot exceed capacity')
  if (consumers.length > 1) throw new Error('Multiple Soul spenders require an explicit player priority policy')
  const consumer = consumers[0]
  if (consumer) {
    if (!consumer.instanceId || !Number.isFinite(consumer.costPerUse) || consumer.costPerUse <= 0 || !Number.isFinite(consumer.effectiveCooldownSeconds) || consumer.effectiveCooldownSeconds <= 0) {
      throw new Error('Soul consumer cost and cooldown must be finite and positive')
    }
  }
  const totalIncomeUnits = incomeUnitsPerSecond * durationSeconds
  if (!Number.isFinite(totalIncomeUnits) || !Number.isFinite(initialSouls + totalIncomeUnits)) throw new Error('Soul schedule total income exceeds finite numeric range')
  const cooldownLimitedUses = consumer ? Math.floor((durationSeconds + SCHEDULE_EPSILON) / consumer.effectiveCooldownSeconds) + 1 : 0
  const resourceLimitedUses = consumer && consumer.costPerUse <= capacity
    ? Math.floor((initialSouls + totalIncomeUnits + SCHEDULE_EPSILON) / consumer.costPerUse)
    : 0
  if (!Number.isSafeInteger(cooldownLimitedUses) || !Number.isSafeInteger(resourceLimitedUses) || Math.min(cooldownLimitedUses, resourceLimitedUses) > 1_000_000) {
    throw new Error('Soul schedule event count exceeds the supported finite range')
  }

  let now = 0
  let souls = initialSouls
  let soulTimeIntegral = 0
  const advanceTo = (target: number) => {
    const dt = target - now
    if (dt < -SCHEDULE_EPSILON) throw new Error('Soul schedule events must be ordered')
    if (dt <= SCHEDULE_EPSILON) { now = target; return }
    if (incomeUnitsPerSecond === 0 || souls >= capacity) {
      soulTimeIntegral += souls * dt
    } else {
      const timeToCapacity = (capacity - souls) / incomeUnitsPerSecond
      const risingSeconds = Math.min(dt, timeToCapacity)
      const risingEnd = souls + incomeUnitsPerSecond * risingSeconds
      soulTimeIntegral += (souls + risingEnd) * risingSeconds / 2
      const plateauSeconds = dt - risingSeconds
      if (plateauSeconds > 0) {
        soulTimeIntegral += capacity * plateauSeconds
      }
      souls = Math.min(capacity, souls + incomeUnitsPerSecond * dt)
    }
    now = target
  }

  const useTimesSeconds: number[] = []
  if (consumer && consumer.costPerUse <= capacity) {
    let readyAt = 0
    while (readyAt <= durationSeconds + SCHEDULE_EPSILON) {
      advanceTo(Math.min(readyAt, durationSeconds))
      let useAt = readyAt
      if (souls + SCHEDULE_EPSILON < consumer.costPerUse) {
        if (incomeUnitsPerSecond === 0) break
        useAt += (consumer.costPerUse - souls) / incomeUnitsPerSecond
      }
      if (useAt > durationSeconds + SCHEDULE_EPSILON) break
      advanceTo(Math.min(useAt, durationSeconds))
      if (souls + SCHEDULE_EPSILON < consumer.costPerUse) throw new Error('Soul affordability event was scheduled before its resource threshold')
      souls = Math.max(0, souls - consumer.costPerUse)
      useTimesSeconds.push(Math.min(useAt, durationSeconds))
      readyAt = useAt + consumer.effectiveCooldownSeconds
    }
  }
  advanceTo(durationSeconds)

  const totalSpentUnits = (consumer?.costPerUse ?? 0) * useTimesSeconds.length
  // Conservation is the authoritative overflow value; this also removes tiny
  // floating-point drift accumulated across plateau intervals.
  const overflowUnits = Math.max(0, initialSouls + totalIncomeUnits - totalSpentUnits - souls)
  const scheduleConsumer = consumer ? [{
    instanceId: consumer.instanceId,
    artifactId: consumer.artifactId,
    effectiveCooldownSeconds: consumer.effectiveCooldownSeconds,
    realizedUses: useTimesSeconds.length,
    realizedUsesPerSecond: useTimesSeconds.length / durationSeconds,
    cooldownLimitedUses,
    resourceLimitedUses,
    missedForInsufficientSouls: Math.max(0, cooldownLimitedUses - useTimesSeconds.length),
    spentSoulUnits: totalSpentUnits,
    useTimesSeconds,
  }] : []
  return {
    durationSeconds, initialSouls, endSouls: souls,
    averageSouls: soulTimeIntegral / durationSeconds,
    averageSoulFraction: soulTimeIntegral / durationSeconds / capacity,
    endSoulFraction: souls / capacity,
    totalIncomeUnits, totalSpentUnits, overflowUnits,
    consumers: scheduleConsumer,
  }
}

export function artifactSoulGathering(artifacts: readonly OwnedArtifact[]): number {
  return nonnegative('Artifact Soul Gathering', artifacts.reduce((sum, owned) => {
    const use = getArtifactDefinition(owned.artifactId).use
    return sum + (use.kind === 'soul-spending' || use.kind === 'soul-channel' ? use.soulGathering.value : 0)
  }, 0))
}

function soulConsumers(build: Build, scenario: Scenario): SoulConsumer[] {
  return build.artifacts.flatMap((owned) => {
    const artifact = getArtifactDefinition(owned.artifactId)
    if (artifact.use.kind !== 'soul-spending') return []
    return [{
      instanceId: owned.instanceId,
      artifactId: owned.artifactId,
      costPerUse: artifact.use.cost.value,
      effectiveCooldownSeconds: build.armor
        ? resolveArtifactCooldown(artifact.cooldownSeconds.value, build, scenario)
        : calculateArtifactEffectiveCooldown(artifact.cooldownSeconds.value, scenario.cooldownReduction),
    }]
  })
}

/** Called within the offensive resolver, sharing exactly its HPS and kill rate. */
export function deriveSoulState(build: Build, damage: DamageMetrics, combat: CombatState, scenario: Scenario, armorState: ArmorState | undefined = deriveArmorState(build, scenario)): SoulState | undefined {
  const baseSoulGathering = getWeaponDefinition(build.weapon.weaponId).soul.baseSoulGathering.value
  const enchantmentSoulGathering = build.enchantments.reduce((sum, selected) => sum + (getEnchantmentDefinition(selected.enchantmentId).soul?.soulGathering.value ?? 0), 0)
  const artifactGathering = artifactSoulGathering(build.artifacts)
  const externalSoulGathering = 0
  const flatSoulGathering = nonnegative('Flat Soul Gathering', baseSoulGathering + enchantmentSoulGathering + artifactGathering + externalSoulGathering)
  if (flatSoulGathering === 0) return undefined
  const armorSoulGatheringMultiplier = armorState?.soulGatheringMultiplier ?? 1
  const totalSoulGathering = nonnegative('Total Soul Gathering', flatSoulGathering * armorSoulGatheringMultiplier)
  const normal = soulIncome(combat.estimatedKillsPerSecond, totalSoulGathering)
  const selected = build.enchantments.find((item) => item.enchantmentId === 'soul-siphon')
  const effect = selected ? getTierValues(selected).effect : undefined
  if (selected && effect?.kind !== 'on-hit-soul-generation') throw new Error('Missing Soul Siphon effect')
  const siphon = effect?.kind === 'on-hit-soul-generation'
    ? siphonIncome(damage.hitsPerSecond, effect, totalSoulGathering)
    : { resourceUnitsPerSecond: 0, pickupEventsPerSecond: 0, procEventsPerSecond: 0 }
  const totalResourceUnitsPerSecond = nonnegative('Total Soul income', normal.resourceUnitsPerSecond + siphon.resourceUnitsPerSecond)
  const totalPickupEventsPerSecond = nonnegative('Total Soul pickups', normal.pickupEventsPerSecond + siphon.pickupEventsPerSecond)
  const consumers = soulConsumers(build, scenario)
  const initialSouls = scenario.initialSoulUnits ?? INITIAL_SOULS.value
  const schedule = simulateSoulResourceSchedule({
    durationSeconds: scenario.encounterDurationSeconds,
    initialSouls,
    capacity: BASE_SOUL_CAPACITY.value,
    incomeUnitsPerSecond: totalResourceUnitsPerSecond,
    consumers,
  })
  const legacyNoSpending = initialSouls === INITIAL_SOULS.value && consumers.length === 0
  return {
    capacity: BASE_SOUL_CAPACITY.value, initialSouls,
    baseSoulGathering, enchantmentSoulGathering,
    ...(artifactGathering > 0 ? { artifactSoulGathering: artifactGathering } : {}),
    externalSoulGathering, totalSoulGathering,
    ...(armorSoulGatheringMultiplier !== 1 ? { armorSoulGatheringMultiplier } : {}),
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
    totalResourceUnitsPerSecond, spendingUnitsPerSecond: schedule.totalSpentUnits / scenario.encounterDurationSeconds,
    ...(legacyNoSpending
      ? soulTrajectory(totalResourceUnitsPerSecond, BASE_SOUL_CAPACITY.value, scenario.encounterDurationSeconds)
      : {
          encounterAverageSoulFraction: schedule.averageSoulFraction,
          endSoulFraction: schedule.endSoulFraction,
          schedule,
        }),
  }
}

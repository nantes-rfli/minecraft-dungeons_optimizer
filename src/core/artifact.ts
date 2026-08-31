import { getArtifactDefinition } from './catalog'
import type { ArtifactActivationOpportunity, ArtifactDefinition, ArtifactDurationModel, TimedSelfBuffArtifactDefinition } from './artifactMechanics'
import type {
  ArtifactEffects,
  ArtifactActivationState,
  ArtifactId,
  ArtifactStackingGroup,
  ArtifactUptime,
  OwnedArtifact,
  Scenario,
} from './types'

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value))

/** Activation frequency is independent of duration and combined buff uptime. */
export function calculateArtifactActivationState(opportunities: readonly ArtifactActivationOpportunity[]): ArtifactActivationState {
  const activations = opportunities.map(({ instanceId, artifactId, effectiveCooldownSeconds }) => {
    if (!Number.isFinite(effectiveCooldownSeconds) || effectiveCooldownSeconds <= 0) {
      throw new Error('Artifact activation cooldown must be finite and positive')
    }
    return { instanceId, artifactId, effectiveCooldownSeconds, activationsPerSecond: 1 / effectiveCooldownSeconds }
  })
  const totalActivationsPerSecond = activations.reduce((sum, item) => sum + item.activationsPerSecond, 0)
  if (!Number.isFinite(totalActivationsPerSecond)) throw new Error('Artifact activation rate exceeds finite numeric range')
  return { totalActivationsPerSecond, activations }
}

function timedSelfBuff(artifact: ArtifactDefinition): TimedSelfBuffArtifactDefinition {
  if (artifact.mechanic !== 'timed-self-buff') throw new Error(`Unsupported artifact mechanics: ${artifact.mechanic}`)
  return artifact
}

export function calculateArtifactEffectiveCooldown(baseCooldownSeconds: number, cooldownReduction: number): number {
  if (!Number.isFinite(baseCooldownSeconds) || baseCooldownSeconds <= 0 || !Number.isFinite(cooldownReduction) || cooldownReduction < 0 || cooldownReduction >= 1) {
    throw new Error('Artifact cooldown must be positive and reduction must be in [0, 1)')
  }
  const result = baseCooldownSeconds * (1 - cooldownReduction)
  if (!Number.isFinite(result) || result <= 0) throw new Error('Artifact cooldown exceeds finite numeric range')
  return result
}

export function calculateArtifactActivationOpportunities(ownedArtifacts: readonly OwnedArtifact[], scenario: Scenario): ArtifactActivationOpportunity[] {
  return ownedArtifacts.map(({ instanceId, artifactId }) => {
    const artifact = getArtifactDefinition(artifactId)
    // Future soul/channel schedulers must supply realized uses; CD capacity is insufficient.
    if (artifact.use.kind !== 'cooldown-only') throw new Error(`Artifact ${artifactId} requires a resource/channel activation model`)
    return { instanceId, artifactId, effectiveCooldownSeconds: calculateArtifactEffectiveCooldown(artifact.cooldownSeconds.value, scenario.cooldownReduction) }
  })
}

export function calculateArtifactDuration(model: ArtifactDurationModel, power: number): number {
  if (!Number.isFinite(power) || power <= 0) throw new Error('Artifact Power must be finite and positive')
  const range = model.kind === 'fixed' ? undefined : model.supportedPowerRange
  if (range && (!Number.isFinite(range.min) || !Number.isFinite(range.max) || range.min <= 0 || range.max < range.min || power < range.min || power > range.max)) throw new Error('Artifact duration Power outside supported range; extrapolation is forbidden')
  let seconds: number
  switch (model.kind) {
    case 'fixed': seconds = model.seconds.value; break
    case 'linear-power': seconds = model.intercept.value + model.perPower.value * power; break
    case 'published-table': {
      const points = model.points
      if (points.length < 2 || points[0]!.power !== model.supportedPowerRange.min || points[points.length - 1]!.power !== model.supportedPowerRange.max || points.some((point, index) => !Number.isFinite(point.power) || point.power <= 0 || !Number.isFinite(point.seconds.value) || point.seconds.value < 0 || (index > 0 && point.power <= points[index - 1]!.power))) throw new Error('Invalid artifact duration table')
      const exact = points.find((point) => point.power === power)
      if (exact) { seconds = exact.seconds.value; break }
      const upper = points.findIndex((point) => point.power > power)
      if (upper <= 0) throw new Error('Artifact duration table cannot extrapolate')
      const left = points[upper - 1]!, right = points[upper]!
      seconds = left.seconds.value + (right.seconds.value - left.seconds.value) * (power - left.power) / (right.power - left.power)
      break
    }
    default: throw new Error('Unsupported artifact duration model')
  }
  if (!Number.isFinite(seconds) || seconds < 0) throw new Error('Artifact duration must be finite and nonnegative')
  return seconds
}

export function calculateTimedArtifactUptime(
  ownedArtifact: OwnedArtifact,
  scenario: Scenario,
): ArtifactUptime {
  const { artifactId } = ownedArtifact
  const artifact = timedSelfBuff(getArtifactDefinition(artifactId))
  if (artifact.use.kind !== 'cooldown-only') throw new Error('Timed artifact requires a resource/channel activation model')
  const durationSeconds = calculateArtifactDuration(artifact.duration, ownedArtifact.powerLevel)
  const effectiveCooldownSeconds = calculateArtifactEffectiveCooldown(artifact.cooldownSeconds.value, scenario.cooldownReduction)

  return {
    instanceId: ownedArtifact.instanceId,
    artifactId,
    durationSeconds,
    effectiveCooldownSeconds,
    uptime: clamp01(durationSeconds / effectiveCooldownSeconds),
  }
}

export function calculateArtifactEffects(
  ownedArtifacts: readonly OwnedArtifact[],
  scenario: Scenario,
): ArtifactEffects {
  let attackSpeedMultiplier = 1
  let damageTakenMultiplier = 1

  const uptimes = ownedArtifacts.map((ownedArtifact) =>
    calculateTimedArtifactUptime(ownedArtifact, scenario),
  )
  const grouped = new Map<ArtifactId, ArtifactUptime[]>()
  for (const uptime of uptimes) {
    grouped.set(uptime.artifactId, [...(grouped.get(uptime.artifactId) ?? []), uptime])
  }
  const stackingGroups: ArtifactStackingGroup[] = []

  for (const [artifactId, groupUptimes] of grouped) {
    const artifact = timedSelfBuff(getArtifactDefinition(artifactId))
    if (groupUptimes.length > artifact.stacking.value.maxCopies) {
      throw new Error(
        `${artifact.name.ja}は最大${artifact.stacking.value.maxCopies}個まで装備できます。`,
      )
    }
    if (artifact.stacking.value.behavior === 'non-stackable' && groupUptimes.length > 1) {
      throw new Error(`${artifact.name.ja}は複数装備できません。`)
    }

    const combinedUptime = clamp01(
      groupUptimes.reduce((sum, uptime) => sum + uptime.uptime, 0),
    )
    stackingGroups.push({
      artifactId,
      instanceIds: groupUptimes.map((uptime) => uptime.instanceId),
      behavior: artifact.stacking.value.behavior,
      combinedUptime,
    })

    if (artifact.stacking.value.behavior === 'refresh') {
      if (artifact.effect.kind === 'attack-speed') {
        attackSpeedMultiplier += artifact.effect.bonus.value * combinedUptime
      }
      if (artifact.effect.kind === 'damage-reduction') {
        damageTakenMultiplier *= 1 - artifact.effect.reduction.value * combinedUptime
      }
      continue
    }

    for (const uptime of groupUptimes) {
      if (artifact.effect.kind === 'attack-speed') {
        attackSpeedMultiplier += artifact.effect.bonus.value * uptime.uptime
      }
      if (artifact.effect.kind === 'damage-reduction') {
        damageTakenMultiplier *= 1 - artifact.effect.reduction.value * uptime.uptime
      }
    }
  }

  return { attackSpeedMultiplier, damageTakenMultiplier, uptimes, stackingGroups }
}

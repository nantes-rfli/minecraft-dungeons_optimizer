import { getArtifactDefinition } from './catalog'
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
export function calculateArtifactActivationState(uptimes: readonly ArtifactUptime[]): ArtifactActivationState {
  const activations = uptimes.map(({ instanceId, artifactId, effectiveCooldownSeconds }) => {
    if (!Number.isFinite(effectiveCooldownSeconds) || effectiveCooldownSeconds <= 0) {
      throw new Error('Artifact activation cooldown must be finite and positive')
    }
    return { instanceId, artifactId, effectiveCooldownSeconds, activationsPerSecond: 1 / effectiveCooldownSeconds }
  })
  const totalActivationsPerSecond = activations.reduce((sum, item) => sum + item.activationsPerSecond, 0)
  if (!Number.isFinite(totalActivationsPerSecond)) throw new Error('Artifact activation rate exceeds finite numeric range')
  return { totalActivationsPerSecond, activations }
}

export function calculateArtifactUptime(
  ownedArtifact: OwnedArtifact,
  scenario: Scenario,
): ArtifactUptime {
  const { artifactId } = ownedArtifact
  const artifact = getArtifactDefinition(artifactId)
  const durationSeconds =
    artifact.durationIntercept.value + artifact.durationPerPower.value * ownedArtifact.powerLevel
  const effectiveCooldownSeconds =
    artifact.cooldownSeconds.value * (1 - scenario.cooldownReduction)

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
    calculateArtifactUptime(ownedArtifact, scenario),
  )
  const grouped = new Map<ArtifactId, ArtifactUptime[]>()
  for (const uptime of uptimes) {
    grouped.set(uptime.artifactId, [...(grouped.get(uptime.artifactId) ?? []), uptime])
  }
  const stackingGroups: ArtifactStackingGroup[] = []

  for (const [artifactId, groupUptimes] of grouped) {
    const artifact = getArtifactDefinition(artifactId)
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
      if (artifact.attackSpeedBonus) {
        attackSpeedMultiplier += artifact.attackSpeedBonus.value * combinedUptime
      }
      if (artifact.damageReduction) {
        damageTakenMultiplier *= 1 - artifact.damageReduction.value * combinedUptime
      }
      continue
    }

    for (const uptime of groupUptimes) {
      if (artifact.attackSpeedBonus) {
        attackSpeedMultiplier += artifact.attackSpeedBonus.value * uptime.uptime
      }
      if (artifact.damageReduction) {
        damageTakenMultiplier *= 1 - artifact.damageReduction.value * uptime.uptime
      }
    }
  }

  return { attackSpeedMultiplier, damageTakenMultiplier, uptimes, stackingGroups }
}

import { getArtifactDefinition } from './catalog'
import type { ArtifactEffects, ArtifactUptime, OwnedArtifact, Scenario } from './types'

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value))

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

  const uptimes = ownedArtifacts.map((ownedArtifact) => {
    const { artifactId } = ownedArtifact
    const artifact = getArtifactDefinition(artifactId)
    const uptime = calculateArtifactUptime(ownedArtifact, scenario)
    if (artifact.attackSpeedBonus) {
      attackSpeedMultiplier += artifact.attackSpeedBonus.value * uptime.uptime
    }
    if (artifact.damageReduction) {
      damageTakenMultiplier *= 1 - artifact.damageReduction.value * uptime.uptime
    }
    return uptime
  })

  return { attackSpeedMultiplier, damageTakenMultiplier, uptimes }
}

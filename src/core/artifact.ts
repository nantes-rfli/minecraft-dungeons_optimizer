import { getArtifactDefinition } from './catalog'
import type { ArtifactEffects, ArtifactId, ArtifactUptime, Scenario } from './types'

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value))

export function calculateArtifactUptime(
  artifactId: ArtifactId,
  scenario: Scenario,
): ArtifactUptime {
  const artifact = getArtifactDefinition(artifactId)
  const durationSeconds =
    artifact.durationIntercept.value + artifact.durationPerPower.value * scenario.artifactPower
  const effectiveCooldownSeconds =
    artifact.cooldownSeconds.value * (1 - scenario.cooldownReduction)

  return {
    artifactId,
    durationSeconds,
    effectiveCooldownSeconds,
    uptime: clamp01(durationSeconds / effectiveCooldownSeconds),
  }
}

export function calculateArtifactEffects(
  artifactIds: readonly ArtifactId[],
  scenario: Scenario,
): ArtifactEffects {
  let attackSpeedMultiplier = 1
  let damageTakenMultiplier = 1

  const uptimes = artifactIds.map((artifactId) => {
    const artifact = getArtifactDefinition(artifactId)
    const uptime = calculateArtifactUptime(artifactId, scenario)
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

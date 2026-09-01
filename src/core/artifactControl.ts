import { getArtifactDefinition } from './catalog'
import { calculateArtifactDuration, calculateArtifactEffectiveCooldown } from './artifact'
import type { HardControlArtifactDefinition } from './artifactMechanics'
import type { OwnedArtifact, Scenario, ShockPowderControlState } from './types'

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value))

function hardControlArtifact(artifactId: OwnedArtifact['artifactId']): HardControlArtifactDefinition {
  const artifact = getArtifactDefinition(artifactId)
  if (artifact.mechanic !== 'hard-control') {
    throw new Error(`Unsupported artifact control mechanics: ${artifact.mechanic}`)
  }
  return artifact
}

/** Artifact use and successful control application are deliberately separate. */
export function deriveArtifactControlState(
  ownedArtifacts: readonly OwnedArtifact[],
  scenario: Scenario,
): ShockPowderControlState | undefined {
  const controlArtifacts = ownedArtifacts.filter((owned) =>
    getArtifactDefinition(owned.artifactId).mechanic === 'hard-control',
  )
  if (controlArtifacts.length === 0) return undefined

  const counts = new Map<OwnedArtifact['artifactId'], number>()
  for (const owned of controlArtifacts) {
    const artifact = hardControlArtifact(owned.artifactId)
    const count = (counts.get(owned.artifactId) ?? 0) + 1
    counts.set(owned.artifactId, count)
    if (count > artifact.stacking.value.maxCopies) {
      throw new Error(`${artifact.name.ja}はruntimeでは最大${artifact.stacking.value.maxCopies}個までです。`)
    }
  }

  const owned = controlArtifacts[0]!
  if (owned.artifactId !== 'shock-powder' || controlArtifacts.length !== 1) {
    throw new Error('Unsupported hard-control artifact combination')
  }
  const artifact = hardControlArtifact(owned.artifactId)
  const durationSeconds = calculateArtifactDuration(artifact.duration, owned.powerLevel)
  const effectiveCooldownSeconds = calculateArtifactEffectiveCooldown(
    artifact.cooldownSeconds.value,
    scenario.cooldownReduction,
  )
  const rawActiveCoverage = clamp01(durationSeconds / effectiveCooldownSeconds)
  const eligibleTargetShare = scenario.crowdControl.shockPowderEligibleTargetShare ?? 0.5
  const affectedTargetShare = scenario.crowdControl.shockPowderAffectedTargetShare ?? 0.5
  const hardDisableCoverage = clamp01(
    rawActiveCoverage * eligibleTargetShare * affectedTargetShare,
  )

  return {
    instanceId: owned.instanceId,
    sourceArtifactId: 'shock-powder',
    powerLevel: owned.powerLevel,
    durationSeconds,
    effectiveCooldownSeconds,
    rawActiveCoverage,
    eligibleTargetShare,
    affectedTargetShare,
    hardDisableCoverage,
    attackSlowEquivalentCoverage: 0,
    rootCoverage: 0,
    groupingCoverage: 0,
    positionalControlCoverage: 0,
    timeModel: 'steady-state-use-when-ready',
    overlapModel: 'refresh-saturation-assumption',
  }
}

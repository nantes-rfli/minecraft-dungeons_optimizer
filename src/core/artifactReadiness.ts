import { ARTIFACTS } from '../data/artifacts'
import { artifactDurationPowerStatus, calculateArtifactDuration } from './artifact'
import { getArtifactDefinition } from './catalog'
import { OptimizerInputError } from './errors'
import type { ReadinessIssue } from './readiness'
import type { OwnedArtifact } from './types'

export function isArtifactOutsideDurationPowerRange(artifact: OwnedArtifact): boolean {
  // This estimate uses only declared bounds. The search handles model and input failures.
  const definition = ARTIFACTS[artifact.artifactId]
  return !!definition && 'duration' in definition
    && artifactDurationPowerStatus(definition.duration, artifact.powerLevel) === 'outside-range'
}

/** Only a known, out-of-range Power is eligible for optional-slot exclusion. */
export function artifactPowerIssue(artifact: OwnedArtifact, diagnosticOnly = false): ReadinessIssue | undefined {
  try {
    const definition = getArtifactDefinition(artifact.artifactId)
    if ('duration' in definition) calculateArtifactDuration(definition.duration, artifact.powerLevel)
  } catch (error) {
    if (error instanceof OptimizerInputError && error.code === 'UNSUPPORTED_ARTIFACT_POWER_RANGE') {
      return { kind: 'unsupported', message: `${error.message}。この個体のPowerは現在の対応範囲外です。実装備のPowerを書き換えたり、未承認の値を入力して解決しないでください。` }
    }
    // A diagnostic keeps other invalid inputs in scope for the actual search.
    if (!diagnosticOnly) throw error
  }
  return undefined
}

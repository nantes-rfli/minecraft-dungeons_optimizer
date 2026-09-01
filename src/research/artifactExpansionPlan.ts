import planJson from '../../research/artifact-expansion-plan.json'
import { ARTIFACT_AUDIT } from './artifactAudit'

export const ARTIFACT_EXPANSION_PLAN = planJson
export const ARTIFACT_PRIORITY_DIMENSIONS = ['gameplayUsefulness', 'buildDiversity', 'subsystemReuse', 'evidenceQuality', 'powerAvailability', 'implementationComplexity', 'feedbackComplexity', 'targetingUncertainty'] as const
export type ArtifactPriorityScores = Readonly<Record<(typeof ARTIFACT_PRIORITY_DIMENSIONS)[number], number>>
export function artifactImplementationPriority(s: ArtifactPriorityScores): number {
  for (const key of ARTIFACT_PRIORITY_DIMENSIONS) if (!Number.isInteger(s[key]) || s[key] < 1 || s[key] > 5) throw new Error(`Invalid artifact priority score: ${key}`)
  return 2 * s.gameplayUsefulness + s.buildDiversity + 2 * s.subsystemReuse + 2 * s.evidenceQuality + 2 * s.powerAvailability - s.implementationComplexity - s.feedbackComplexity - s.targetingUncertainty
}
export function collectArtifactExpansionPlanErrors(): string[] {
  const errors: string[] = []
  const entries = ARTIFACT_EXPANSION_PLAN.entries
  if (new Set(entries.map((entry) => entry.id)).size !== 44 || entries.map((entry) => entry.id).sort().join('|') !== ARTIFACT_AUDIT.entries.map((entry) => entry.id).sort().join('|')) errors.push('Plan must partition the entire source population exactly once')
  const targets = entries.filter((entry) => entry.classification === 'target-shortlist')
  if (targets.length !== ARTIFACT_EXPANSION_PLAN.targetRuntimeCount || targets.length < 10 || targets.length > 15) errors.push('Target shortlist must contain 10–15 artifacts, including retained runtime')
  for (const batch of ['2-2B', '2-2C', '2-2D']) {
    const candidates = entries.filter((entry) => entry.batch === batch)
    if (candidates.length < 3 || candidates.length > 4) errors.push(`${batch}: requires 3–4 conditional candidates`)
  }
  for (const entry of entries) {
    if (!['target-shortlist', 'deferred', 'research-only'].includes(entry.classification)) errors.push(`${entry.id}: invalid plan class`)
    if (entry.scores) artifactImplementationPriority(entry.scores)
    if (entry.classification === 'target-shortlist' && entry.batch !== 'existing' && (!entry.scores || !['evidence-required', 'evidence-blocked', 'runtime'].includes(entry.gateStatus))) errors.push(`${entry.id}: missing score or evidence/runtime gate`)
  }
  if (ARTIFACT_EXPANSION_PLAN.nextPhaseDecision.selected !== 'artifact-evidence-acquisition-and-curve-extraction' || ARTIFACT_EXPANSION_PLAN.nextPhaseDecision.alternatives.length !== 2) errors.push('Phase 2-2D next-phase reevaluation missing')
  return errors
}

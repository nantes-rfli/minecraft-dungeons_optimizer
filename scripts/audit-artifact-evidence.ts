import fs from 'node:fs'
import path from 'node:path'
import {
  ARTIFACT_CURVE_HYPOTHESES,
  ARTIFACT_EVIDENCE_DECISIONS,
  ARTIFACT_PUBLISHED_SAMPLES,
  buildArtifactCurveAudit,
  buildArtifactCurveValidation,
  collectArtifactEvidenceErrors,
  renderArtifactCurveAnalysis,
  renderArtifactEvidenceMatrix,
  renderArtifactEvidenceReport,
} from '../src/research/artifactEvidence.ts'
import soulAudit from '../research/artifact-soul-batch-audit.json' with { type: 'json' }
import eventAudit from '../research/artifact-event-healing-control-audit.json' with { type: 'json' }
import controlAudit from '../research/artifact-control-debuff-audit.json' with { type: 'json' }

const errors = collectArtifactEvidenceErrors()
const check = (condition: boolean, message: string) => { if (!condition) errors.push(message) }
const expected = new Map<string, string>([
  ['research/artifact-evidence/curve-validation.json', `${JSON.stringify(buildArtifactCurveValidation(), null, 2)}\n`],
  ['research/artifact-curve-audit.json', `${JSON.stringify(buildArtifactCurveAudit(), null, 2)}\n`],
  ['docs/artifact-evidence-matrix.md', renderArtifactEvidenceMatrix()],
  ['docs/artifact-curve-analysis.md', renderArtifactCurveAnalysis()],
  ['docs/artifact-evidence-acquisition.md', renderArtifactEvidenceReport()],
])

for (const [relativePath, content] of expected) {
  const absolutePath = path.join(process.cwd(), relativePath)
  check(fs.existsSync(absolutePath), `missing generated output ${relativePath}`)
  if (fs.existsSync(absolutePath)) check(fs.readFileSync(absolutePath, 'utf8') === content, `generated output drift: ${relativePath}`)
}

const hypothesisIds = ARTIFACT_CURVE_HYPOTHESES.hypotheses.map((entry) => entry.id)
check(JSON.stringify(hypothesisIds) === JSON.stringify(['H-AD-01', 'H-AD-02', 'H-AD-03', 'H-AH-01', 'H-DU-01', 'H-WH-01']), 'hypothesis inventory drift')
check(ARTIFACT_CURVE_HYPOTHESES.hypotheses.every((entry) => new Set(entry.fitSampleIds.filter((id) => entry.validationSampleIds.includes(id))).size === 0), 'fit/validation overlap')
check(ARTIFACT_PUBLISHED_SAMPLES.samples.every((sample) => sample.gameVersion && sample.unit && sample.sourceField), 'sample provenance tags missing')
check(ARTIFACT_EVIDENCE_DECISIONS.candidates.every((candidate) => candidate.nextStatus === 'Research-only' && candidate.highPowerReady === false), 'runtime promotion occurred without endgame Evidence')
check(ARTIFACT_EVIDENCE_DECISIONS.candidates.every((candidate) => candidate.sourceRoutesChecked.length >= 3 && candidate.evidenceStop === 'public-evidence-exhausted'), 'public source stop condition missing')
check(ARTIFACT_EVIDENCE_DECISIONS.nextPhaseDecision.selected === 'Armor subsystem' && ARTIFACT_EVIDENCE_DECISIONS.nextPhaseDecision.evidenceReadyArtifactCount === 0, 'next Phase gate drift')
check(ARTIFACT_PUBLISHED_SAMPLES.samples.length === ARTIFACT_EVIDENCE_DECISIONS.researchCoverage.numericSnapshot.allSamples, 'numeric snapshot total drift')
check(ARTIFACT_PUBLISHED_SAMPLES.samples.filter((sample) => sample.metric === 'damage' && sample.artifactId !== 'weapon-anchor-reference').length === ARTIFACT_EVIDENCE_DECISIONS.researchCoverage.numericSnapshot.artifactDamageSamples, 'Artifact damage sample count drift')
check(soulAudit.phase22eEvidence.auditRef === 'research/artifact-curve-audit.json' && soulAudit.phase22eEvidence.conclusion === 'public-evidence-exhausted', 'Soul audit is not synced to Phase 2-2E')
check(eventAudit.phase22eEvidence.auditRef === 'research/artifact-curve-audit.json' && eventAudit.phase22eEvidence.conclusion === 'public-evidence-exhausted', 'event/healing/control audit is not synced to Phase 2-2E')
check(controlAudit.phase22eEvidence.auditRef === 'research/artifact-curve-audit.json' && controlAudit.phase22eEvidence.runtimeDecision === 'unchanged', 'control audit is not synced to Phase 2-2E')

const audit = buildArtifactCurveAudit()
const weaponCurve = audit.hypotheses.find((entry) => entry.id === 'H-AD-02')!
check(weaponCurve.status === 'rejected' && weaponCurve.metrics !== undefined && weaponCurve.metrics.p90APE > ARTIFACT_CURVE_HYPOTHESES.acceptanceGate.maximumP90APE, 'weapon curve rejection is not backed by hold-out metrics')
check(weaponCurve.metrics !== undefined && weaponCurve.metrics.meanAPE > 0, 'weapon curve MAPE missing')
const durationCurve = audit.hypotheses.find((entry) => entry.id === 'H-DU-01')!
check(durationCurve.status === 'rejected' && durationCurve.metrics !== undefined && durationCurve.metrics.maxAPE > ARTIFACT_CURVE_HYPOTHESES.acceptanceGate.maximumAPE, 'duration common curve rejection is not backed by hold-out metrics')
check(audit.hypotheses.every((entry) => entry.highPowerReady === false), 'unversioned high-Power sample passed the high-Power gate')
check(audit.conflicts.every((entry) => entry.conclusion === 'unresolved' && entry.selectedValue === null), 'source conflict was silently averaged or selected')

if (errors.length) throw new Error(errors.join('\n'))
console.log('Artifact Evidence audit passed: snapshots/provenance/hold-outs/conflicts are consistent; 0 candidates are endgame promotion-ready.')

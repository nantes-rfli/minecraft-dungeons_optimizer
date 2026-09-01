import { describe, expect, it } from 'vitest'
import {
  ARTIFACT_CURVE_HYPOTHESES,
  ARTIFACT_EVIDENCE_DECISIONS,
  ARTIFACT_EVIDENCE_SOURCES,
  ARTIFACT_PATCH_COEFFICIENTS,
  ARTIFACT_PUBLISHED_SAMPLES,
  buildArtifactCurveAudit,
  buildArtifactCurveValidation,
  collectArtifactEvidenceErrors,
  renderArtifactCurveAnalysis,
  renderArtifactEvidenceMatrix,
  renderArtifactEvidenceReport,
} from '../src/research/artifactEvidence'

function snapshotInput() {
  return structuredClone({
    sources: ARTIFACT_EVIDENCE_SOURCES,
    samples: ARTIFACT_PUBLISHED_SAMPLES,
    coefficients: ARTIFACT_PATCH_COEFFICIENTS,
    hypotheses: ARTIFACT_CURVE_HYPOTHESES,
    decisions: ARTIFACT_EVIDENCE_DECISIONS,
  })
}

describe('Phase 2-2E Artifact evidence', () => {
  it('keeps the checked-in evidence snapshot internally consistent', () => {
    expect(collectArtifactEvidenceErrors()).toEqual([])
    expect(ARTIFACT_PUBLISHED_SAMPLES.samples).toHaveLength(85)
    expect(ARTIFACT_EVIDENCE_DECISIONS.researchCoverage.damageArtifacts).toEqual([
      'powershaker', 'harvester', 'lightning-rod', 'ice-wand', 'scatter-mines',
      'updraft-tome', 'blast-fungus', 'spinblade', 'eye-of-the-guardian', 'corrupted-beacon',
    ])
    expect(ARTIFACT_EVIDENCE_SOURCES.sources.some((source) => source.normalizedContentSha256 === '563d306edccdd7f732735b943cc7c4794cefdbcb35cb60d001349250173c0b9b')).toBe(true)
  })

  it('preserves unresolved ranges and excludes them instead of averaging them into a fit', () => {
    const soulRows = ARTIFACT_PUBLISHED_SAMPLES.samples.filter((sample) => sample.artifactId === 'soul-healer')
    expect(soulRows).toHaveLength(23)
    expect(soulRows.every((sample) => sample.valueKind === 'range' && sample.rangeEnd !== undefined && sample.secondaryRange !== undefined && sample.exclusionReason)).toBe(true)
    const fittedIds = new Set(ARTIFACT_CURVE_HYPOTHESES.hypotheses.flatMap((entry) => [...entry.fitSampleIds, ...entry.validationSampleIds]))
    expect(soulRows.every((sample) => !fittedIds.has(sample.id))).toBe(true)
  })

  it('uses disjoint hold-outs and records rejected alternatives with error metrics', () => {
    const validation = buildArtifactCurveValidation()
    for (const hypothesis of ARTIFACT_CURVE_HYPOTHESES.hypotheses) {
      const validationIds = new Set<string>(hypothesis.validationSampleIds)
      expect(hypothesis.fitSampleIds.some((id) => validationIds.has(id))).toBe(false)
    }
    const weapon = validation.hypotheses.find((entry) => entry.id === 'H-AD-02')!
    expect(weapon.validationMetrics).toMatchObject({
      sampleCount: 4,
      artifactCount: 1,
      powerRange: { min: 111, max: 114 },
    })
    expect(weapon.validationMetrics!.meanAPE).toBeGreaterThan(0.1)
    expect(weapon.validationMetrics!.p90APE).toBeGreaterThan(ARTIFACT_CURVE_HYPOTHESES.acceptanceGate.maximumP90APE)
    const duration = validation.hypotheses.find((entry) => entry.id === 'H-DU-01')!
    expect(duration.validationMetrics!.maxAPE).toBeGreaterThan(ARTIFACT_CURVE_HYPOTHESES.acceptanceGate.maximumAPE)
    expect(buildArtifactCurveAudit().hypotheses.every((entry) => entry.highPowerReady === false)).toBe(true)
  })

  it('keeps all six candidates research-only and selects Armor after the promotion gate fails', () => {
    expect(ARTIFACT_EVIDENCE_DECISIONS.candidates).toHaveLength(6)
    expect(ARTIFACT_EVIDENCE_DECISIONS.candidates.every((candidate) => candidate.nextStatus === 'Research-only' && !candidate.highPowerReady && candidate.evidenceStop === 'public-evidence-exhausted')).toBe(true)
    expect(ARTIFACT_EVIDENCE_DECISIONS.nextPhaseDecision).toMatchObject({
      selected: 'Armor subsystem',
      evidenceReadyArtifactCount: 0,
      artifactPromotionGateMet: false,
    })
  })

  it('renders the matrix, analysis and completion report from the same snapshot', () => {
    expect(renderArtifactEvidenceMatrix()).toContain('Runtime remains **3 / 45 (Full 2, Limited 1, Research-only 42)**')
    expect(renderArtifactCurveAnalysis()).toContain('MAPE')
    expect(renderArtifactCurveAnalysis()).toContain('powershaker, harvester, lightning-rod')
    expect(renderArtifactEvidenceReport()).toContain('**Armor subsystem**')
  })

  it('rejects malformed provenance, duplicate IDs and unsupported sample ranges', () => {
    const malformed = snapshotInput()
    malformed.sources.sources[0]!.route = 'private-dump'
    malformed.samples.samples[0]!.sourceId = 'missing-source'
    malformed.samples.samples[1]!.id = malformed.samples.samples[0]!.id
    malformed.samples.samples[2]!.rangeEnd = 1
    const errors = collectArtifactEvidenceErrors(malformed)
    expect(errors).toContain('dt-damage-calculator-117 has an invalid source route')
    expect(errors).toContain('lightning-rod-p1 references an unknown source')
    expect(errors).toContain('samples has duplicate IDs')
    expect(errors).toContain('lightning-rod-p109 has an invalid range end')
  })

  it('rejects fit/validation overlap, declared extrapolation and unsupported acceptance', () => {
    const malformed = snapshotInput()
    const commonDamage = malformed.hypotheses.hypotheses[0]!
    commonDamage.validationSampleIds = [commonDamage.fitSampleIds[0]!]
    commonDamage.supportedPowerRange = { min: 2, max: 20 }
    commonDamage.status = 'accepted'
    const errors = collectArtifactEvidenceErrors(malformed)
    expect(errors).toContain('H-AD-01 reuses fit data as validation')
    expect(errors).toContain('H-AD-01 extrapolates beyond its declared range')
    expect(errors).toContain('H-AD-01 is accepted below the evidence-count gate')
  })

  it('rejects a silent runtime promotion or an incomplete public-source stop condition', () => {
    const malformed = snapshotInput()
    malformed.decisions.candidates[0]!.nextStatus = 'Limited implementation ready'
    malformed.decisions.candidates[1]!.sourceRoutesChecked = ['dungeons-tools']
    const errors = collectArtifactEvidenceErrors(malformed)
    expect(errors).toContain('powershaker violates the runtime/high-Power gate')
    expect(errors).toContain('harvester did not check three source routes')
  })
})

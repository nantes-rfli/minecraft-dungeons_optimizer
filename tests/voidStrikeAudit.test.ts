import { describe, expect, it } from 'vitest'
import audit from '../research/void-strike-audit.json'

describe('Void Strike public research fixture', () => {
  it('keeps mechanics evidence and measurements separate from runtime data', () => {
    expect(audit.runtimeDataGeneratedFromThisFile).toBe(false)
    expect(audit.curveDecision).toBe('B')
    expect(audit.mechanicsEvidence.map((entry) => entry.topic)).toEqual([
      'tier-maximum',
      'application-hit',
      'minimum-multiplier',
      'ramp-duration',
      'ramp-shape',
      'expiration',
      'same-weapon-reset',
      'external-consume',
      'tier-scaling',
    ])
    expect(audit.measurementSamples.length).toBeGreaterThan(0)
  })

  it('has unique ids and only references declared public sources', () => {
    const sourceIds = audit.sources.map((source) => source.id)
    const sampleIds = audit.measurementSamples.map((sample) => sample.id)
    expect(new Set(sourceIds).size).toBe(sourceIds.length)
    expect(new Set(sampleIds).size).toBe(sampleIds.length)

    const declaredSources = new Set(sourceIds)
    for (const evidence of audit.mechanicsEvidence) {
      expect(evidence.sourceIds.length).toBeGreaterThan(0)
      evidence.sourceIds.forEach((sourceId) => expect(declaredSources.has(sourceId)).toBe(true))
    }
    audit.measurementSamples.forEach((sample) => {
      expect(declaredSources.has(sample.sourceId)).toBe(true)
    })
  })

  it('does not invent elapsed time for published continuous-attack tables', () => {
    const continuousSamples = audit.measurementSamples.filter(
      (sample) => sample.timing.kind === 'continuous-attacks',
    )
    expect(continuousSamples.length).toBeGreaterThan(0)
    continuousSamples.forEach((sample) => {
      expect(sample.timing.elapsedSeconds).toBeNull()
    })
  })
})

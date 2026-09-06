import { describe, expect, it } from 'vitest'
import { buildEvidenceGapMap, buildPhase5MeasurementProtocols, collectEvidenceGapMapErrors, summarizeEvidenceGapMap } from '../src/research/evidenceGapMap'
import { buildSourceHarvest } from '../src/research/sourceHarvest'

describe('Phase 5 Evidence Gap Map', () => {
  it('classifies every Source Harvest gap without changing the source layer', () => {
    const harvestBefore = JSON.stringify(buildSourceHarvest())
    const map = buildEvidenceGapMap()
    const summary = summarizeEvidenceGapMap(map)

    expect(summary.totalGaps).toBe(2_105)
    expect(summary.unclassified).toBe(0)
    expect(map.gaps).toHaveLength(buildSourceHarvest().gaps.length)
    expect(new Set(map.gaps.map((gap) => gap.gapId)).size).toBe(map.gaps.length)
    expect(JSON.stringify(buildSourceHarvest())).toBe(harvestBefore)
    expect(map.methodology).toEqual(expect.objectContaining({ priorityCalculated: false, ownershipSignalUsed: false, runtimePromotionAllowed: false }))
  })

  it('separates cause from resolution and only attaches protocols to game work', () => {
    const map = buildEvidenceGapMap()
    const sourceExtractable = map.gaps.filter((gap) => gap.resolutionClass === 'source-extractable')
    expect(sourceExtractable).toHaveLength(63)
    expect(sourceExtractable.every((gap) => gap.gapCause === 'source-missing' && gap.sourceAttempts.some((attempt) => attempt.result === 'value-found'))).toBe(true)

    const observationCause = map.gaps.filter((gap) => gap.gapCause === 'requires-game-observation')
    expect(observationCause).toHaveLength(428)
    expect(observationCause.every((gap) => ['observe', 'measure', 'experiment'].includes(gap.resolutionClass))).toBe(true)

    const nonMeasurement = map.gaps.filter((gap) => ['implementation', 'objective-design'].includes(gap.resolutionClass))
    expect(nonMeasurement).toHaveLength(300)
    expect(nonMeasurement.every((gap) => gap.protocolId === undefined)).toBe(true)
  })

  it('provides reusable audited protocols for every observe, measure and experiment gap', () => {
    const map = buildEvidenceGapMap()
    const protocols = buildPhase5MeasurementProtocols()
    expect(protocols).toHaveLength(14)
    expect(new Set(protocols.map((protocol) => protocol.id)).size).toBe(protocols.length)
    expect(collectEvidenceGapMapErrors(map, protocols)).toEqual([])
    expect(map.gaps.filter((gap) => ['observe', 'measure', 'experiment'].includes(gap.resolutionClass)).every((gap) => protocols.some((protocol) => protocol.id === gap.protocolId))).toBe(true)
    expect(protocols.filter((protocol) => protocol.resolutionClass === 'experiment').every((protocol) => protocol.controls?.length && protocol.variants?.length && protocol.hypothesis?.length)).toBe(true)
  })
})

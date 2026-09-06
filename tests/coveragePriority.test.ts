import { describe, expect, it } from 'vitest'
import { buildEvidenceGapMap } from '../src/research/evidenceGapMap'
import { buildCoveragePriority, collectCoveragePriorityErrors, SYNTHETIC_OWNED_ENTITY_IDS } from '../src/research/coveragePriority'

describe('Phase 6 Coverage Priority', () => {
  it('prioritizes every gap deterministically without changing runtime data', () => {
    const before = JSON.stringify(buildEvidenceGapMap())
    const first = buildCoveragePriority()
    const second = buildCoveragePriority()

    expect(first.gapPriorities).toHaveLength(2_105)
    expect(new Set(first.gapPriorities.map((gap) => gap.gapId)).size).toBe(2_105)
    expect(collectCoveragePriorityErrors(first)).toEqual([])
    expect(JSON.stringify(second)).toBe(JSON.stringify(first))
    expect(JSON.stringify(buildEvidenceGapMap())).toBe(before)
  })

  it('keeps sensitivity analysis bounded, attributable and outside runtime', () => {
    const model = buildCoveragePriority()
    const computed = model.gapPriorities.filter((gap) => gap.rankSensitivity.status === 'computed')
    expect(computed.length).toBeGreaterThan(0)
    expect(computed.every((gap) => gap.rankSensitivity.range && gap.rankSensitivity.rangeSource?.length)).toBe(true)
    expect(computed.every((gap) => gap.rankSensitivity.method === 'bounded-proxy')).toBe(true)
    expect(computed.every((gap) => gap.global.confidence !== 'high' && gap.personal.confidence !== 'high')).toBe(true)
    expect(model.methodology.rankSensitivityPolicy).toContain('analysis-only')
    expect(model.gapPriorities.filter((gap) => gap.resolutionClass === 'implementation').every((gap) => gap.rankSensitivity.status === 'unsupported')).toBe(true)
  })

  it('separates global priority from owned-only personal research', () => {
    const model = buildCoveragePriority()
    expect(model.ownedResearchQueue.length).toBeGreaterThan(0)
    expect(model.ownedResearchQueue.every((item) => SYNTHETIC_OWNED_ENTITY_IDS.includes(item.entityId as typeof SYNTHETIC_OWNED_ENTITY_IDS[number]))).toBe(true)
    expect(model.ownedResearchQueue.every((item) => item.protocolId && item.reasons.length && item.prerequisites.length)).toBe(true)
    expect(model.objectiveDesignPriorities.length).toBeGreaterThan(0)
    expect(model.ownedResearchQueue.every((item) => !model.gapPriorities.find((gap) => gap.gapId === item.gapId)?.resolutionClass.includes('objective'))).toBe(true)
    expect(model.ownedResearchQueue.every((item) => model.gapPriorities.find((gap) => gap.gapId === item.gapId)?.availability === 'owned')).toBe(true)
  })

  it('uses confirmed equipment families instead of category equality', () => {
    const model = buildCoveragePriority({ ownedEntityIds: new Set(['ranged-weapon:bow']) })
    const availabilityFor = (entityId: string) => model.gapPriorities.find((gap) => gap.entityId === entityId)?.availability

    expect(availabilityFor('ranged-weapon:bonebow')).toBe('same-family-only')
    expect(availabilityFor('ranged-weapon:crossbow')).toBe('not-owned')
    expect(model.gapPriorities.filter((gap) => gap.availability === 'same-family-only').every((gap) => gap.availabilityBasis?.familyId === 'bow')).toBe(true)
  })

  it('separates global and personal weight sensitivity and feeds stability into confidence', () => {
    const model = buildCoveragePriority()
    const global = model.weightSensitivity.filter((item) => item.scope === 'global')
    const personal = model.weightSensitivity.filter((item) => item.scope === 'personal')
    const unstable = model.gapPriorities.filter((gap) => gap.stability.personal.level === 'low')

    expect(global.map((item) => item.variant)).toEqual(['default', 'rank-heavy', 'unlock-heavy', 'coverage-heavy'])
    expect(personal.map((item) => item.variant)).toEqual(['default', 'ownership-heavy', 'rank-heavy', 'unlock-heavy'])
    expect(global.some((item) => item.variant === 'ownership-heavy')).toBe(false)
    expect(personal.find((item) => item.variant === 'ownership-heavy')?.top20GapIds.some((id) => SYNTHETIC_OWNED_ENTITY_IDS.some((entityId) => id.startsWith(`${entityId}:`)))).toBe(true)
    expect(unstable.length).toBeGreaterThan(0)
    expect(unstable.every((gap) => gap.personal.confidence !== 'high')).toBe(true)
  })

  it('builds phase 7 handoff queues and unlock bundles', () => {
    const model = buildCoveragePriority()
    expect(model.unlockBundles.length).toBe(386)
    expect(model.groupedResearchQueue.every((group) => group.entityIds.length > 0)).toBe(true)
    expect(model.weightSensitivity).toHaveLength(8)
    expect(model.weightSensitivity.every((variant) => variant.top20GapIds.length === 20)).toBe(true)
  })
})

import { describe, expect, it } from 'vitest'
import { evaluateLimitedDrValidation, legacyDamageTaken, proposedDamageTaken, type LimitedDrAcceptancePlan, type LimitedDrRun } from '../src/research/limitedDrValidation'
import { buildPhase8cValidation } from '../scripts/audit-phase8c-limited-dr'

const plan: LimitedDrAcceptancePlan = {
  frozenAt: '2026-09-10T06:00:00+09:00', gameVersion: '1.17.0.0', damageChannel: 'direct-mob-attack',
  requiredConditions: ['baseline', 'armor-35', 'iron-hide', 'guarding-strike', 'armor-iron', 'armor-guarding', 'iron-guarding', 'armor-iron-guarding'],
  minimumIndependentRunsPerCondition: 3, independentRunIdentity: 'distinct-run-id-and-raw-trace', originGroupRole: 'evidence-provenance', minimumHitsPerRun: 10, maximumMeanAbsoluteFractionError: 0.005, maximumPerHitRawDamageError: 1, rankingComparatorDamageTaken: 0.18,
}

const run = (condition: LimitedDrRun['condition'], index: number, originGroup = `holdout-${index}`): LimitedDrRun => {
  const baselineDamage = 100000
  const traceIdentity = plan.requiredConditions.indexOf(condition) * 100 + index
  return { id: `${condition}-${index}`, condition, partition: 'holdout', originGroup, gameVersion: '1.17.0.0', damageChannel: 'direct-mob-attack', incomingHitId: 'zombie-melee-fixed', equipment: condition === 'baseline' ? [] : [{ id: `fixture:${condition}`, power: 251 }], activationFrameLocators: condition === 'baseline' ? [] : ['frames 10-20'], rawTraceLocator: `trace/${condition}-${index}.csv`, rawTraceSha256: traceIdentity.toString(16).padStart(64, '0'), capturedAt: new Date(Date.UTC(2026, 8, 10, 1, 0, traceIdentity)).toISOString(), baselineDamage, observedDamage: Array(10).fill(Math.round(baselineDamage * proposedDamageTaken(condition))) }
}

describe('Phase 8C Limited DR validation', () => {
  it('stores hold when no independent raw trace exists without promoting or closing Gaps', () => {
    const result = buildPhase8cValidation()
    expect(result.adoptionDecision).toMatchObject({ decision: 'hold', promotionCount: 0, newGapClosures: 0 })
    expect(result.evidenceBoundary.eligibleIndependentHoldoutRuns).toBe(0)
    expect(result.adoptionDecision.blockers).toContain('no-eligible-independent-raw-trace')
  })

  it('compares old and proposed models and exposes rank sensitivity', () => {
    expect(proposedDamageTaken('armor-iron-guarding')).toBeCloseTo(0.1969697)
    expect(legacyDamageTaken('armor-iron-guarding')).toBeCloseTo(0.1625)
    expect(buildPhase8cValidation().rankingSensitivity).toMatchObject({ proposedRank: 'candidate-after-comparator', legacyRank: 'candidate-before-comparator', rankChanges: true })
  })

  it('counts three separately performed runs from the same origin group', () => {
    const runs = plan.requiredConditions.flatMap((condition, conditionIndex) => [1, 2, 3].map((index) => ({ ...run(condition, conditionIndex * 3 + index, 'same-player'), id: `${condition}-${index}` })))
    const result = evaluateLimitedDrValidation({ plan, calibrationOriginGroups: ['calibration'], runs, excludedReferenceRows: [] })
    expect(result.adoptionDecision.decision).toBe('adopt')
    expect(result.reproducibility).toMatchObject({ commonIncomingHit: true, measurementRunsAvailable: true, complete: true })
    expect(result.comparison.proposedWithinTolerance).toBe(true)
    expect(result.comparison.proposedOutperformsLegacy).toBe(true)
  })

  it('does not count copied runs or reused raw traces as independent repetitions', () => {
    const first = run('baseline', 1, 'same-player')
    const copiedRun = { ...first, id: 'baseline-copy', rawTraceLocator: 'trace/baseline-copy.csv', rawTraceSha256: 'b'.repeat(64) }
    const reusedTrace = { ...run('baseline', 2, 'same-player'), id: 'baseline-reused-trace', rawTraceLocator: first.rawTraceLocator, rawTraceSha256: first.rawTraceSha256 }
    const result = evaluateLimitedDrValidation({ plan, calibrationOriginGroups: [], runs: [first, copiedRun, reusedTrace], excludedReferenceRows: [] })
    expect(result.conditionCoverage.baseline).toMatchObject({ eligibleRuns: 1, pass: false })
    expect(result.evidenceBoundary.excludedDuplicateRunIds).toEqual(['baseline-copy', 'baseline-reused-trace'])
    expect(result.evidenceBoundary).toMatchObject({ runIdDefinesIndependentRepetition: true, originGroupDefinesProvenanceNotRunUniqueness: true, repeatedRawTraceCounts: false })
  })

  it('rejects duplicate run IDs while retaining calibration/holdout origin separation', () => {
    const duplicate = { ...run('baseline', 2), id: 'baseline-1' }
    expect(() => evaluateLimitedDrValidation({ plan, calibrationOriginGroups: [], runs: [run('baseline', 1), duplicate], excludedReferenceRows: [] })).toThrow('duplicate run')
    const sameCalibrationOrigin = [1, 2, 3].map((index) => run('baseline', index, 'calibration'))
    expect(evaluateLimitedDrValidation({ plan, calibrationOriginGroups: ['calibration'], runs: sameCalibrationOrigin, excludedReferenceRows: [] }).conditionCoverage.baseline.eligibleRuns).toBe(0)
  })

  it('does not treat calibration-origin or short synthetic probes as eligible holdout', () => {
    const rows = [run('baseline', 1, 'calibration'), { ...run('baseline', 2), id: 'short', observedDamage: [100000] }]
    const result = evaluateLimitedDrValidation({ plan, calibrationOriginGroups: ['calibration'], runs: rows, excludedReferenceRows: [] })
    expect(result.evidenceBoundary.eligibleIndependentHoldoutRuns).toBe(0)
    expect(result.adoptionDecision.decision).toBe('hold')
  })

  it('rejects a fully covered proposed model when frozen tolerances fail', () => {
    const runs = plan.requiredConditions.flatMap((condition) => [1, 2, 3].map((index) => ({ ...run(condition, index), observedDamage: Array(10).fill(90000) })))
    expect(evaluateLimitedDrValidation({ plan, calibrationOriginGroups: [], runs, excludedReferenceRows: [] }).adoptionDecision.decision).toBe('reject')
  })
})

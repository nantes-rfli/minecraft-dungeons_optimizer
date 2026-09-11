import { describe, expect, it } from 'vitest'
import { buildCurrentRuntimePromotionManifest } from '../scripts/audit-runtime-promotion'
import regressionArtifact from '../research/runtime-promotion-regression.json'
import { buildRuntimePromotionManifest, collectRuntimePromotionErrors, collectRuntimePromotionRegressionSourceErrors, PROMOTION_ARTIFACT_KINDS, type PromotionBundle, type PromotionCandidateInput, type RuntimePromotionRegressionArtifact } from '../src/research/runtimePromotion'

const accepted: PromotionCandidateInput = {
  targetId: 'fixture.damage', targetKind: 'parameter', decisionRef: 'research/fixture.json#/decision', outcome: 'accepted',
  gameVersion: '1.17.0.0', valueStatus: 'known', regression: 'passed',
  regressionRef: 'research/runtime-promotion-regression.fixture.json#/targets/0', regressionGameVersion: '1.17.0.0',
  regressionSourceRef: 'tests/runtimePromotion.test.ts#passed-regression', blockers: [],
}
const artifacts = Object.fromEntries(PROMOTION_ARTIFACT_KINDS.map((kind) => [kind, { path: `${kind}.json`, sha256: 'a'.repeat(64) }])) as PromotionBundle['artifacts']
const bundle: PromotionBundle = { targetId: accepted.targetId, decisionRef: accepted.decisionRef, supportLevel: 'limited', artifacts, rollback: { strategy: 'revert-commit', note: 'Revert the fixture promotion commit.' } }

describe('P3 runtime promotion pipeline', () => {
  it('represents the current zero-eligible state without promoting held evidence', () => {
    const manifest = buildCurrentRuntimePromotionManifest()
    expect(manifest.summary).toEqual({ candidates: 1, eligible: 0, promoted: 0 })
    expect(manifest.candidates[0]).toMatchObject({ outcome: 'held', regression: 'not-run', eligibility: { status: 'ineligible' } })
    expect(manifest.promotions).toEqual([])
  })

  it('does not infer a regression pass from accepted adoption', () => {
    const manifest = buildRuntimePromotionManifest({ gameVersion: '1.17.0.0', candidates: [{ ...accepted, regression: 'not-run', regressionSourceRef: null }], promotions: [] })
    expect(manifest.candidates[0]?.eligibility).toEqual({ status: 'ineligible', reasons: ['regression-not-run'] })
  })

  it('keeps an accepted target ineligible after a failed regression', () => {
    const manifest = buildRuntimePromotionManifest({ gameVersion: '1.17.0.0', candidates: [{ ...accepted, regression: 'failed' }], promotions: [] })
    expect(manifest.candidates[0]?.eligibility).toEqual({ status: 'ineligible', reasons: ['regression-failed'] })
  })

  it('requires an atomic bundle for every eligible target', () => {
    expect(() => buildRuntimePromotionManifest({ gameVersion: '1.17.0.0', candidates: [accepted], promotions: [] })).toThrow('eligible target and promotion bundle must be atomic')
    const manifest = buildRuntimePromotionManifest({ gameVersion: '1.17.0.0', candidates: [accepted], promotions: [bundle] })
    expect(manifest.summary).toEqual({ candidates: 1, eligible: 1, promoted: 1 })
    expect(manifest.candidates[0]?.eligibility).toEqual({ status: 'eligible', reasons: [] })
    expect(collectRuntimePromotionErrors(manifest)).toEqual([])
  })

  it('detects drift from the independent regression source', () => {
    const manifest = buildCurrentRuntimePromotionManifest()
    const drifted = { ...manifest, candidates: [{ ...manifest.candidates[0]!, regression: 'failed' as const }] }
    expect(collectRuntimePromotionRegressionSourceErrors(drifted, regressionArtifact as RuntimePromotionRegressionArtifact, 'research/runtime-promotion-regression.json')).toContain('defense.damage-taken-composition: regression status drift')
  })

  it.each([
    ['held adoption', { ...accepted, outcome: 'held' }],
    ['unknown value', { ...accepted, valueStatus: 'unknown' }],
    ['unpassed regression', { ...accepted, regression: 'not-run' }],
    ['version mismatch', { ...accepted, gameVersion: 'other' }],
    ['active blocker', { ...accepted, blockers: ['needs-holdout'] }],
  ] as const)('does not promote %s', (_label, candidate) => {
    const matching = { ...bundle, targetId: candidate.targetId, decisionRef: candidate.decisionRef }
    expect(() => buildRuntimePromotionManifest({ gameVersion: '1.17.0.0', candidates: [candidate], promotions: [matching] })).toThrow('ineligible target cannot be promoted')
  })

  it('rejects an incomplete or drifting atomic artifact declaration', () => {
    const manifest = buildRuntimePromotionManifest({ gameVersion: '1.17.0.0', candidates: [accepted], promotions: [bundle] })
    const mutated = {
      ...manifest,
      promotions: [{
        ...manifest.promotions[0]!,
        artifacts: { ...manifest.promotions[0]!.artifacts, coverage: { ...manifest.promotions[0]!.artifacts.coverage, sha256: 'not-a-hash' } },
      }],
    }
    expect(collectRuntimePromotionErrors(mutated)).toContain('fixture.damage: invalid coverage hash')
  })
})

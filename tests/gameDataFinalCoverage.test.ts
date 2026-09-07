import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { auditInputs, buildFinalCoverage, classifyGap, DISPOSITIONS, loadInputs, renderReports, serialize, TAXONOMY } from '../scripts/game-data-final-coverage.ts'
import type { EvidenceGap } from '../src/research/evidenceGapMap.ts'
import type { GapReconciliationRecord } from '../scripts/game-data-gap-reconciliation.ts'
const input = loadInputs(fileURLToPath(new URL('..', import.meta.url)))
const result = buildFinalCoverage(input)
const gap = (patch: Partial<EvidenceGap> = {}): EvidenceGap => ({ ...input.gaps[0]!, ...patch })
const resolution = (status: GapReconciliationRecord['status']): GapReconciliationRecord => ({ ...input.reconciliation.resolutions.find(r => r.status === 'closed')!, status })

describe('Phase 6.5F model difference decisions', () => {
  it('keeps exact configured projectile closure and records the naming difference independently', () => {
    const mapping = input.semantic.mappings.find(m => m.ruleId === 'ranged-instance-projectile-count-v1')!
    expect(classifyGap(gap(), resolution('closed'), [mapping])).toMatchObject({ differenceKind: 'exact-match', secondaryDifferenceKinds: ['rename-or-alias'], disposition: 'already-resolved' })
  })
  it('routes structural support to alignment only when no empirical protocol is displaced', () => {
    const mapping = input.semantic.mappings.find(m => m.raw.propertyPath === 'Effect')!
    expect(classifyGap(gap({ resolutionClass: 'source-extractable' }), resolution('partial'), [mapping])).toMatchObject({ differenceKind: 'structural-transform', disposition: 'phase-6.6-model-alignment' })
    expect(classifyGap(gap({ resolutionClass: 'experiment' }), resolution('partial'), [mapping]).disposition).toBe('phase-7-experiment')
  })
  it('treats AttackRateSeconds as ambiguity and preserves timing measurement', () => {
    const mapping = input.semantic.mappings.find(m => m.interpretation.status === 'tentative')!
    expect(classifyGap(gap({ property: 'shotsPerSecond', resolutionClass: 'measure' }), resolution('evidence-added'), [mapping])).toMatchObject({ differenceKind: 'semantic-ambiguity', disposition: 'phase-7-measure' })
  })
  it.each([
    ['procOwnership', 'experiment', 'empirical-required', 'phase-7-experiment'],
    ['powerScaling', 'experiment', 'native-or-runtime-only', 'phase-7-experiment'],
    ['finalDamage', 'measure', 'native-or-runtime-only', 'phase-7-measure'],
    ['projectileCount', 'observe', 'empirical-required', 'phase-7-observe'],
    ['runtimeBoundary', 'implementation', 'implementation-required', 'implementation'],
    ['objective', 'objective-design', 'objective-required', 'objective-design'],
  ] as const)('%s retains original decision boundary', (property, resolutionClass, differenceKind, disposition) => {
    expect(classifyGap(gap({ property, resolutionClass }))).toMatchObject({ differenceKind, disposition })
  })
  it('routes version and public conflicts independently of empirical defaults', () => {
    expect(classifyGap(gap({ property: 'versionHistory', gapCause: 'version-unknown' }))).toMatchObject({ differenceKind: 'version-boundary', disposition: 'version-public-research' })
    expect(classifyGap(gap({ gapCause: 'conflicting-public-sources' }))).toMatchObject({ differenceKind: 'source-conflict', disposition: 'version-public-research' })
  })
  it('does not invent parser impact or closure potential from no-match', () => {
    expect(classifyGap(gap({ resolutionClass: 'source-extractable' }))).toMatchObject({ differenceKind: 'no-game-data-match', disposition: 'manual-review', gameDataFurtherResearchPotential: { level: 'low' } })
  })
})

describe('Phase 6.5F artifact and trace audit', () => {
  it('partitions every baseline Gap once without changing reconciliation', () => {
    const { gapClassifications: records, summary } = result.modelDifferences
    expect(new Set(records.map(g => g.gapId)).size).toBe(input.gaps.length)
    expect(records).toHaveLength(input.gaps.length)
    expect(records.filter(g => g.reconciliationStatus === 'closed').map(g => g.gapId)).toEqual(input.reconciliation.closedGapIds)
    expect(Object.values(summary.dispositions).reduce((a, b) => a + b, 0)).toBe(input.gaps.length)
    expect(Object.values(summary.remainingByDisposition).reduce((a, b) => a + b, 0)).toBe(input.reconciliation.summary.remainingGapCount)
    for (const record of records) {
      expect(Object.keys(TAXONOMY)).toContain(record.differenceKind)
      expect(DISPOSITIONS).toContain(record.disposition)
      expect(record.reason.length).toBeGreaterThan(0)
      expect(record.gameDataFurtherResearchPotential.basis.length).toBeGreaterThan(0)
    }
    expect(summary.dispositions.implementation).toBe(271)
    expect(summary.dispositions['objective-design']).toBe(29)
  })
  it('derives the funnel from assets, records and mappings', () => {
    const f = result.finalCoverage.coverageFunnel
    expect(f.parser.parsedAssets).toBe(input.bulk.selection.parsedCount)
    expect(f.structural.totalParsedProperties).toBe(input.bulk.assets.reduce((sum, a) => sum + a.parsedPropertyCount, 0))
    expect(f.structural.semanticRuleRecognizedPropertyCount + f.structural.syntheticStructuralObservations).toBe(input.bulk.records.length)
    for (const status of ['accepted', 'tentative', 'unresolved', 'rejected'] as const) expect(f.semantic[status]).toBe(input.semantic.summary[status])
    expect(f.gap.closedCount).toBe(input.reconciliation.summary.closedCount)
    expect(f.gap.remainingGapCount).toBe(input.reconciliation.summary.remainingGapCount)
    expect(f.gap.directEvidenceTouchedCount).toBe(77)
  })
  it('traces every closed, partial and evidence-added Gap to the exact asset content hash', () => {
    for (const record of result.modelDifferences.gapClassifications.filter(g => ['closed', 'partial', 'evidence-added'].includes(g.reconciliationStatus))) {
      expect(record.evidence.semanticMappingIds.length).toBeGreaterThan(0)
      for (const id of record.evidence.semanticMappingIds) {
        const mapping = input.semantic.mappings.find(m => m.id === id)!
        expect(mapping.entity).toBe(record.entity)
        for (const sourceId of mapping.sourceRecordIds) {
          expect(record.evidence.sourceRecordIds).toContain(sourceId)
          const source = input.bulk.records.find(r => r.id === sourceId)!
          expect(source.datasetId).toBe(input.bulk.datasetId)
          expect(source.asset.contentHash?.value).toMatch(/^[a-f0-9]{64}$/)
          expect(input.bulk.assets.find(a => a.path === source.asset.path)?.contentHash).toEqual(source.asset.contentHash)
        }
      }
    }
    expect(auditInputs(input)).toEqual([])
  })
  it.each(['fingerprint', 'dataset', 'parser', 'hash', 'source', 'mapping', 'blocked'] as const)('rejects corrupted %s linkage', kind => {
    const broken = structuredClone(input)
    if (kind === 'fingerprint') broken.inventory.sourceFingerprint.value = 'broken'
    if (kind === 'dataset') broken.provenance.dataset.id = 'broken'
    if (kind === 'parser') Object.assign(broken.samples, { parser: { id: 'broken', schemaVersion: 1 } })
    if (kind === 'hash') Object.assign(broken.bulk.records[0]!.asset, { contentHash: { algorithm: 'sha256', value: 'broken' } })
    if (kind === 'source') Object.assign(broken.semantic.mappings[0]!, { sourceRecordIds: ['missing'] })
    if (kind === 'mapping') Object.assign(broken.reconciliation.resolutions.find(r => r.status === 'closed')!, { semanticMappingIds: ['missing'] })
    if (kind === 'blocked') Object.assign(broken.reconciliation.resolutions.find(r => r.status === 'closed')!, { status: 'blocked' })
    expect(auditInputs(broken).length).toBeGreaterThan(0)
    expect(() => buildFinalCoverage(broken)).toThrow()
  })
  it('reproduces machine artifacts and reports deterministically', () => {
    expect(serialize(buildFinalCoverage(input))).toBe(serialize(result))
    expect(renderReports(buildFinalCoverage(input))).toEqual(renderReports(result))
  })
})

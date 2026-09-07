import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { EvidenceGap } from '../src/research/evidenceGapMap'
import { canCloseGap } from '../src/research/gameDataGapReconciliation'
import { resolveGameDataEntity } from '../src/research/gameDataEntityResolver'
import { validateSemanticRuleRegistry } from '../src/research/gameDataSemanticRules'
import { buildBulkSemanticArtifact, buildGapReconciliationArtifact, serializeReconciliation, type GameDataBulkSemanticArtifact, type GameDataGapReconciliationArtifact } from '../scripts/game-data-gap-reconciliation'
import { discoverBulkCandidates, serializeBulkArtifact, walkBoundedReferences, type GameDataAssetIndex, type GameDataBulkHarvestArtifact } from '../scripts/game-data-bulk-harvest'

const index = JSON.parse(fs.readFileSync('research/game-data-asset-index.json', 'utf8')) as GameDataAssetIndex
const bulk = JSON.parse(fs.readFileSync('research/game-data-bulk-harvest.json', 'utf8')) as GameDataBulkHarvestArtifact
const semantic = JSON.parse(fs.readFileSync('research/game-data-bulk-semantic-mappings.json', 'utf8')) as GameDataBulkSemanticArtifact
const reconciliation = JSON.parse(fs.readFileSync('research/game-data-gap-reconciliation.json', 'utf8')) as GameDataGapReconciliationArtifact
const gapMap = JSON.parse(fs.readFileSync('research/evidence-gap-map.json', 'utf8')) as { gaps: readonly EvidenceGap[] }

const syntheticGap = (overrides: Partial<EvidenceGap> = {}): EvidenceGap => ({
  gapId: 'ranged-weapon:test:projectileCount', entity: 'ranged-weapon:test', category: 'ranged-weapon', property: 'projectileCount',
  gapCause: 'source-missing', resolutionClass: 'observe', taskFamilyId: 'test', sourceAttempts: [], runtimeRelevance: 'high',
  expectedOutcome: 'numeric-value', acquisitionCost: 'low', unlockEffect: 'runtime-eligibility', notes: 'synthetic', ...overrides,
})

const acceptedCandidate = {
  entityExact: true, propertyExact: true, sourceRecordExists: true, extractionConfidence: 'high' as const,
  semanticStatus: 'accepted' as const, semanticConfidence: 'high' as const, normalizedProperty: 'ranged.projectileCount',
  normalizedValue: 3, crossCheckStatus: 'matches', expectedOutcomeCompatible: true,
  closePolicy: 'may-close-static-gap' as const, canReplaceEmpiricalProtocol: true,
}

describe('Phase 6.5E entity resolver', () => {
  const known = new Set(['ranged-weapon:scatter-crossbow', 'melee-weapon:double-axe', 'artifact:death-cap-mushroom', 'ranged-enchantment:rapid-fire', 'armor-enchantment:cool-down'])
  it.each([
    ['ranged-weapon', 'ScatterCrossbow', 'ranged-weapon:scatter-crossbow'],
    ['melee-weapon', 'DoubleAxe', 'melee-weapon:double-axe'],
    ['artifact', 'DeathCapMushroom', 'artifact:death-cap-mushroom'],
    ['enchantment', 'RapidFire', 'ranged-enchantment:rapid-fire'],
    ['armor-property', 'ItemCooldownDecrease', 'armor-enchantment:cool-down'],
  ] as const)('resolves %s identity %s to %s', (category, identity, expected) => {
    expect(resolveGameDataEntity({ category, assetIndexEntity: identity, knownEntities: known })).toMatchObject({ status: 'resolved', entity: expected })
  })

  it('fails safe when normalized fallback has multiple candidates', () => {
    const result = resolveGameDataEntity({ category: 'ranged-weapon', assetIndexEntity: 'FooBar_Unique1', knownEntities: new Set(['ranged-weapon:foo-bar', 'ranged-weapon:fo-ob-ar']) })
    expect(result).toMatchObject({ status: 'ambiguous' })
  })
})

describe('Phase 6.5E Gap close gate', () => {
  it('closes only the accepted exact static projectile count case', () => expect(canCloseGap(syntheticGap(), acceptedCandidate)).toBe(true))
  it.each([
    ['tentative', syntheticGap(), { ...acceptedCandidate, semanticStatus: 'tentative' as const }],
    ['raw Damage', syntheticGap({ property: 'powerScaling' }), { ...acceptedCandidate, propertyExact: false, normalizedProperty: undefined, normalizedValue: undefined }],
    ['version unknown', syntheticGap({ gapCause: 'version-unknown' }), acceptedCandidate],
    ['implementation', syntheticGap({ resolutionClass: 'implementation', expectedOutcome: 'implementation-decision' }), acceptedCandidate],
    ['objective design', syntheticGap({ resolutionClass: 'objective-design', expectedOutcome: 'objective-definition' }), acceptedCandidate],
    ['experiment default', syntheticGap({ resolutionClass: 'experiment' }), { ...acceptedCandidate, canReplaceEmpiricalProtocol: false }],
    ['conflict', syntheticGap(), { ...acceptedCandidate, crossCheckStatus: 'conflicts' }],
  ])('does not close %s', (_label, gap, candidate) => expect(canCloseGap(gap as EvidenceGap, candidate)).toBe(false))
})

describe('Phase 6.5E deterministic artifacts', () => {
  it('selects a deterministic paired gameplay candidate set', () => {
    const candidates = discoverBulkCandidates(index)
    expect(candidates).toHaveLength(bulk.selection.candidateCount)
    expect(candidates.map((candidate) => candidate.path)).toEqual([...candidates.map((candidate) => candidate.path)].sort((left, right) => left.localeCompare(right)))
    expect(candidates.every((candidate) => candidate.files.length === 2)).toBe(true)
  })

  it('bounds reference traversal and detects cycles', () => {
    const graph: Readonly<Record<string, readonly string[]>> = { a: ['b'], b: ['c'], c: ['a', 'd'], d: ['e'], e: [] }
    const result = walkBoundedReferences('dataset', ['a'], (assetPath) => graph[assetPath] ?? [], 3)
    expect(result.visited).toEqual(['a', 'b', 'c', 'd'])
    expect(result.cycleCount).toBe(1)
    expect(result.depthLimitCount).toBe(1)
  })

  it('regenerates semantic mappings and reconciliation exactly', () => {
    const generatedSemantic = buildBulkSemanticArtifact(bulk, gapMap.gaps)
    const generatedReconciliation = buildGapReconciliationArtifact(bulk.datasetId, gapMap.gaps, generatedSemantic)
    expect(serializeReconciliation(generatedSemantic)).toBe(serializeReconciliation(semantic))
    expect(serializeReconciliation(generatedReconciliation)).toBe(serializeReconciliation(reconciliation))
    expect(validateSemanticRuleRegistry()).toEqual([])
  })

  it('partitions the immutable baseline and retains negative controls', () => {
    const summary = reconciliation.summary
    expect(summary.closedCount + summary.partialCount + summary.evidenceAddedCount + summary.conflictCount + summary.blockedCount + summary.noMatchCount).toBe(summary.baselineGapCount)
    expect(summary.closedCount + summary.remainingGapCount).toBe(summary.baselineGapCount)
    expect(summary.baselineGapCount).toBe(gapMap.gaps.length)
    expect(semantic.mappings.filter((mapping) => /damage/i.test(mapping.raw.propertyPath)).every((mapping) => mapping.interpretation.normalizedProperty === undefined)).toBe(true)
    expect(semantic.mappings.filter((mapping) => mapping.ruleId === 'presentation-priority-negative-control-v1').every((mapping) => mapping.interpretation.status === 'rejected')).toBe(true)
    expect(serializeBulkArtifact(bulk)).not.toMatch(/\/Users\/|file:\/\//)
  })
})

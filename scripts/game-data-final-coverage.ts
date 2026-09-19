import fs from 'node:fs'
import path from 'node:path'
import type { EvidenceGap } from '../src/research/evidenceGapMap.ts'
import { resolveGameDataEntity } from '../src/research/gameDataEntityResolver.ts'
import type { GameDataBulkHarvestArtifact } from './game-data-bulk-harvest.ts'
import { buildBulkSemanticArtifact, buildGapReconciliationArtifact, collectBulkSemanticErrors, collectGapReconciliationErrors, type BulkSemanticMapping, type GameDataBulkSemanticArtifact, type GameDataGapReconciliationArtifact, type GapReconciliationRecord } from './game-data-gap-reconciliation.ts'

export const TAXONOMY = {
  'exact-match': 'Accepted exact entity/property mapping compatible with the closure gates.',
  'rename-or-alias': 'Equivalent names requiring an explicit alias; closure is a separate axis.',
  'structural-transform': 'A nested value or reference needs normalization, not merely renaming.',
  'game-only-property': 'Observed retained field without a Gap property; not a whole-game inventory.',
  'optimizer-only-expected-property': 'Expected property has no current direct evidence; absence is not proven.',
  'semantic-ambiguity': 'A raw value exists but its effective meaning is unresolved.',
  'native-or-runtime-only': 'Static evidence does not determine final runtime/scaled values.',
  'empirical-required': 'Observation, measurement or controlled interaction remains necessary.',
  'parser-unsupported': 'A demonstrated property-specific parser limitation blocks evidence.',
  'inheritance-unresolved': 'Empty declared CDO leaves inherited/native/reference storage unresolved.',
  'version-boundary': 'Root-label version claim cannot establish version history.',
  'source-conflict': 'Conflicting public sources or direct evidence require reconciliation.',
  'implementation-required': 'A software implementation decision remains required.',
  'objective-required': 'A product objective decision remains required.',
  'entity-resolution-failed': 'No exact canonical entity or authoritative alias was resolved.',
  'no-game-data-match': 'No match under current parser + candidate + semantic-rule scope.',
} as const
export const DISPOSITIONS = ['already-resolved', 'phase-6.6-model-alignment', 'deeper-game-data-research', 'phase-7-observe', 'phase-7-measure', 'phase-7-experiment', 'implementation', 'objective-design', 'version-public-research', 'parser-hardening', 'manual-review'] as const
export type DifferenceKind = keyof typeof TAXONOMY
export type Disposition = typeof DISPOSITIONS[number]
type Potential = 'high' | 'medium' | 'low' | 'none'
const unique = (values: readonly string[]) => [...new Set(values)].sort()
const counts = (values: readonly string[], keys: readonly string[] = unique(values)) => Object.fromEntries(keys.map(key => [key, values.filter(value => value === key).length]))
const rate = (n: number, d: number) => d ? n / d : 0
export const serialize = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`

export function classifyGap(gap: EvidenceGap, resolution?: GapReconciliationRecord, mappings: readonly BulkSemanticMapping[] = []) {
  let differenceKind: DifferenceKind = 'no-game-data-match'
  let disposition: Disposition = 'manual-review'
  let potential: Potential = 'low'
  let reason = 'No match under current parser + candidate + semantic-rule scope; this does not establish absence in game files.'
  if (resolution?.status === 'closed') {
    differenceKind = 'exact-match'; disposition = 'already-resolved'; potential = 'none'
    reason = 'Existing conservative closure proves the exact configured property; no new closure.'
  } else if (gap.resolutionClass === 'implementation' || gap.resolutionClass === 'objective-design') {
    const implementation = gap.resolutionClass === 'implementation'
    differenceKind = implementation ? 'implementation-required' : 'objective-required'
    disposition = implementation ? 'implementation' : 'objective-design'; potential = 'none'
    reason = 'A static fact cannot complete the original implementation/objective decision.'
  } else if (gap.gapCause === 'version-unknown' || gap.gapCause === 'conflicting-public-sources' || resolution?.status === 'conflict') {
    differenceKind = gap.gapCause === 'version-unknown' ? 'version-boundary' : 'source-conflict'
    disposition = 'version-public-research'; potential = 'none'; reason = 'Version provenance or public-source conflict survives structural evidence.'
  } else {
    const empirical = ['observe', 'measure', 'experiment'].includes(gap.resolutionClass)
    if (empirical) {
      disposition = `phase-7-${gap.resolutionClass}` as Disposition
      differenceKind = /powerScaling|finalDamage/i.test(gap.property) ? 'native-or-runtime-only' : 'empirical-required'
      reason = `Original ${gap.resolutionClass} protocol (${gap.expectedOutcome}) is not replaced by direct semantic evidence.`
    }
    if (resolution && ['partial', 'evidence-added'].includes(resolution.status)) {
      const tentative = mappings.some(m => m.interpretation.status === 'tentative')
      differenceKind = tentative ? 'semantic-ambiguity' : 'structural-transform'
      // Keep empirical routing: partial structural support is not permission to replace a protocol.
      if (!empirical) disposition = tentative ? 'deeper-game-data-research' : 'phase-6.6-model-alignment'
      potential = 'medium'
      reason = `${tentative ? 'Raw timing needs effective-cadence semantics' : 'Configured structure differs from the requested outcome'}; ${empirical ? 'retain the original empirical protocol' : 'review normalization before model changes'}.`
    }
  }
  return {
    gapId: gap.gapId, entity: gap.entity, category: gap.category, property: gap.property,
    baseline: { resolutionClass: gap.resolutionClass, gapCause: gap.gapCause, expectedOutcome: gap.expectedOutcome, protocolId: gap.protocolId, taskFamilyId: gap.taskFamilyId },
    reconciliationStatus: resolution?.status ?? 'no-match', differenceKind,
    secondaryDifferenceKinds: resolution?.status === 'closed' && mappings.some(m => m.raw.propertyPath.split('.').at(-1) !== gap.property) ? ['rename-or-alias'] : [],
    evidence: { sourceRecordIds: unique(resolution?.sourceRecordIds ?? []), semanticMappingIds: unique(resolution?.semanticMappingIds ?? []) },
    disposition, reason, gameDataFurtherResearchPotential: { level: potential as Potential, basis: reason },
  }
}

export function loadInputs(root: string) {
  const artifactPaths: Record<string, string> = {
    'game-data-inventory': 'raw/game-data-inventory',
    'game-data-asset-index': 'raw/game-data-asset-index',
    'game-data-source-provenance': 'sources/game-data-source-provenance',
    'game-data-extractor-samples': 'raw/game-data-extractor-samples',
    'game-data-semantic-source-samples': 'raw/game-data-semantic-source-samples',
    'game-data-semantic-mappings': 'domain/game-data-semantic-mappings',
    'game-data-bulk-harvest': 'raw/game-data-bulk-harvest',
    'game-data-bulk-semantic-mappings': 'domain/game-data-bulk-semantic-mappings',
    'game-data-gap-reconciliation': 'analysis/game-data-gap-reconciliation',
  }
  const read = (name: string) => JSON.parse(fs.readFileSync(path.join(root, `research/${artifactPaths[name] ?? name}.json`), 'utf8'))
  return {
    inventory: read('game-data-inventory') as { totals: { files: number }; companions: Record<string, number>; expectedRoots: unknown[]; sourceFingerprint: { value: string } },
    index: read('game-data-asset-index') as { sourceFingerprint: string; assets: { path: string }[] },
    provenance: read('game-data-source-provenance') as { dataset: { id: string; sourceFingerprint: { value: string } } },
    extractor: read('game-data-extractor-samples') as Pick<GameDataBulkHarvestArtifact, 'schemaVersion' | 'datasetId' | 'parser' | 'records'>,
    samples: read('game-data-semantic-source-samples') as Pick<GameDataBulkHarvestArtifact, 'schemaVersion' | 'datasetId' | 'parser' | 'records'>,
    representative: read('game-data-semantic-mappings') as { datasetId: string; sourceExtractor: { parserId: string; parserSchemaVersion: number }; mappings: BulkSemanticMapping[] },
    bulk: read('game-data-bulk-harvest') as GameDataBulkHarvestArtifact,
    semantic: read('game-data-bulk-semantic-mappings') as GameDataBulkSemanticArtifact,
    reconciliation: read('game-data-gap-reconciliation') as GameDataGapReconciliationArtifact,
    gaps: (read('evidence-gap-map') as { gaps: EvidenceGap[] }).gaps,
    publicHarvest: read('source-harvest') as { sources: { id: string }[] },
    priority: read('analysis/coverage-priority') as { gapPriorities: { gapId: string }[] },
  }
}
export type CoverageInputs = ReturnType<typeof loadInputs>

export function auditInputs(input: CoverageInputs): string[] {
  const { inventory, index, provenance, bulk, semantic, reconciliation, gaps, samples, extractor, representative } = input
  const errors = [...collectBulkSemanticErrors(semantic, bulk), ...collectGapReconciliationErrors(reconciliation, gaps, semantic)]
  const check = (ok: boolean, message: string) => { if (!ok) errors.push(message) }
  check(bulk.schemaVersion === 1 && semantic.schemaVersion === 1 && reconciliation.schemaVersion === 1 && extractor.schemaVersion === 1 && samples.schemaVersion === 1, 'Unsupported artifact schema')
  check(serialize(buildBulkSemanticArtifact(bulk, gaps)) === serialize(semantic), 'Semantic artifact/rule registry drift')
  check(serialize(buildGapReconciliationArtifact(bulk.datasetId, gaps, semantic)) === serialize(reconciliation), 'Reconciliation artifact/status/impact drift')
  const fingerprint = inventory.sourceFingerprint.value
  check([index.sourceFingerprint, provenance.dataset.sourceFingerprint.value, bulk.sourceFingerprint].every(f => f === fingerprint), 'Source fingerprint chain mismatch')
  for (const artifact of [bulk, semantic, reconciliation, samples, extractor, representative]) check(artifact.datasetId === provenance.dataset.id, 'Dataset chain mismatch')
  check(unique(input.priority.gapPriorities.map(g => g.gapId)).join() === unique(gaps.map(g => g.gapId)).join(), 'Priority Gap registry mismatch')
  const publicSourceIds = new Set(input.publicHarvest.sources.map(source => source.id))
  for (const gap of gaps) for (const attempt of gap.sourceAttempts) check(publicSourceIds.has(attempt.sourceId), `${gap.gapId}: missing public source attempt`)
  const paths = new Set(index.assets.map(a => a.path))
  for (const artifact of [bulk, samples, extractor]) {
    check(serialize(artifact.parser) === serialize(bulk.parser), 'Parser identity mismatch')
    check(new Set(artifact.records.map(r => r.id)).size === artifact.records.length, 'Duplicate provenance record')
    for (const record of artifact.records) {
      check(record.datasetId === bulk.datasetId && paths.has(record.asset.path), `${record.id}: invalid dataset/asset trace`)
      check(record.asset.contentHash?.algorithm === 'sha256' && /^[a-f0-9]{64}$/.test(record.asset.contentHash.value), `${record.id}: missing asset hash`)
      check(record.extraction?.parserId === bulk.parser.id && record.extraction.parserSchemaVersion === bulk.parser.schemaVersion, `${record.id}: parser mismatch`)
      check(record.promotionStatus === 'research-only', `${record.id}: runtime promotion`)
    }
  }
  check(representative.sourceExtractor.parserId === bulk.parser.id && representative.sourceExtractor.parserSchemaVersion === bulk.parser.schemaVersion, 'Representative parser mismatch')
  const sampleIds = new Set([...samples.records, ...extractor.records].map(r => r.id))
  for (const mapping of representative.mappings) check(mapping.sourceRecordIds.length > 0 && mapping.sourceRecordIds.every(id => sampleIds.has(id)) && mapping.runtimePromotion === 'not-performed', `${mapping.id}: representative trace broken`)
  const bulkAssets = new Map(bulk.assets.map(a => [a.path, a]))
  for (const record of bulk.records) check(serialize(bulkAssets.get(record.asset.path)?.contentHash) === serialize(record.asset.contentHash), `${record.id}: asset summary hash mismatch`)
  const mappingById = new Map(semantic.mappings.map(m => [m.id, m]))
  for (const resolution of reconciliation.resolutions) {
    const gap = gaps.find(g => g.gapId === resolution.gapId)
    check(Boolean(gap), `${resolution.gapId}: missing Gap`)
    check((resolution.status === 'blocked') === Boolean(gap && ['implementation', 'objective-design'].includes(gap.resolutionClass)), `${resolution.gapId}: invalid blocked partition`)
    if (resolution.status !== 'blocked') {
      check(resolution.semanticMappingIds.length > 0 && resolution.sourceRecordIds.length > 0, `${resolution.gapId}: empty evidence trace`)
      const linked = resolution.semanticMappingIds.flatMap(id => mappingById.get(id)?.sourceRecordIds ?? [])
      check(unique(linked).join() === unique(resolution.sourceRecordIds).join(), `${resolution.gapId}: mapping/source trace mismatch`)
    }
    if (gap?.gapCause === 'version-unknown' || gap?.resolutionClass === 'experiment') check(resolution.status !== 'closed', `${resolution.gapId}: forbidden closure`)
  }
  check(bulk.diagnosticsSummary.reduce((sum, d) => sum + d.count, 0) === bulk.summary.diagnosticCount, 'Diagnostic count mismatch')
  check(bulk.assets.length === bulk.selection.candidateCount, 'Candidate count mismatch')
  check(bulk.assets.filter(a => a.status === 'parsed').length === bulk.selection.parsedCount, 'Parsed count mismatch')
  check(bulk.assets.filter(a => a.status === 'failed').length === bulk.selection.failedCount, 'Failure count mismatch')
  check(bulk.assets.reduce((sum, a) => sum + a.selectedRecordCount, 0) === bulk.records.length, 'Retained fact count mismatch')
  return unique(errors)
}

export function buildFinalCoverage(input: CoverageInputs) {
  const errors = auditInputs(input)
  if (errors.length) throw new Error(errors.join('\n'))
  const { bulk, semantic, reconciliation, gaps, inventory } = input
  const resolutions = new Map(reconciliation.resolutions.map(r => [r.gapId, r]))
  const mappings = new Map(semantic.mappings.map(m => [m.id, m]))
  const gapClassifications = gaps.map(g => {
    const resolution = resolutions.get(g.gapId)
    return classifyGap(g, resolution, resolution?.semanticMappingIds.map(id => mappings.get(id)!) ?? [])
  }).sort((a, b) => a.gapId.localeCompare(b.gapId))
  const touched = gapClassifications.filter(g => !['blocked', 'no-match'].includes(g.reconciliationStatus))
  const remaining = gapClassifications.filter(g => g.reconciliationStatus !== 'closed')
  const totalParsedProperties = bulk.assets.reduce((sum, a) => sum + a.parsedPropertyCount, 0)
  const structuralObservations = bulk.records.filter(r => r.extraction?.propertyType === 'StructuralObservation').length
  const semanticStatuses = ['accepted', 'tentative', 'unresolved', 'rejected'] as const
  const semanticCounts = counts(semantic.mappings.map(m => m.interpretation.status), semanticStatuses) as Record<'accepted' | 'tentative' | 'unresolved' | 'rejected', number>
  const coverageFunnel = {
    source: { totalFiles: inventory.totals.files, logicalPackages: inventory.companions.logicalPackagesWithHeader, uassetPackages: inventory.companions.uassetPackages, umapPackages: inventory.companions.umapPackages, gameplayResearchRoots: inventory.expectedRoots },
    gameplayCandidate: { candidateAssets: bulk.assets.length, policy: bulk.selection.candidatePolicy, boundary: 'Selected gameplay mechanics candidates, not whole-game coverage.' },
    parser: { parsedAssets: bulk.selection.parsedCount, failedAssets: bulk.selection.failedCount, skippedAssets: bulk.selection.skippedCount, gameplayCandidateParseCoverage: rate(bulk.selection.parsedCount, bulk.assets.length), fatalParseRate: rate(bulk.selection.failedCount, bulk.assets.length), byRoot: Object.fromEntries(Object.entries(bulk.summary.byGameplayRoot).map(([root, values]) => [root, { ...values, parseSuccessRate: rate(values.parsed, values.candidates), fatalParseRate: rate(values.failed, values.candidates) }])) },
    structural: { totalParsedProperties, retainedFacts: bulk.records.length, syntheticStructuralObservations: structuralObservations, semanticRuleRecognizedPropertyCount: bulk.records.length - structuralObservations, retentionRatio: rate(bulk.records.length, totalParsedProperties), semanticRuleFilteringRatio: rate(bulk.records.length - structuralObservations, totalParsedProperties), boundary: 'Filtering ratio, not quality; retained facts include synthetic empty-CDO observations, which are not parsed properties.' },
    semantic: { ...semanticCounts, rates: Object.fromEntries(semanticStatuses.map(status => [status, rate(semanticCounts[status]!, semantic.mappings.length)])), byCategory: Object.fromEntries(unique(semantic.mappings.map(m => m.category)).map(category => [category, counts(semantic.mappings.filter(m => m.category === category).map(m => m.interpretation.status), semanticStatuses)])) },
    gap: { ...reconciliation.summary, closedRate: rate(reconciliation.summary.closedCount, gaps.length), directEvidenceTouchedCount: touched.length, directEvidenceTouchedRate: rate(touched.length, gaps.length) },
  }
  const semanticRuleCoverage = semantic.ruleRegistry.map(rule => {
    const matched = semantic.mappings.filter(m => m.ruleId === rule.id)
    const ids = new Set(matched.map(m => m.id))
    const linked = gapClassifications.filter(g => g.evidence.semanticMappingIds.some(id => ids.has(id)))
    return { ruleId: rule.id, category: rule.category, matchedFacts: matched.length, resolvedEntities: unique(matched.filter(m => m.entityResolution.status === 'resolved').map(m => m.entity)).length, mappedGaps: linked.length, closedGaps: linked.filter(g => g.reconciliationStatus === 'closed').length, partialGaps: linked.filter(g => g.reconciliationStatus === 'partial').length, evidenceAddedGaps: linked.filter(g => g.reconciliationStatus === 'evidence-added').length }
  })
  const knownEntities = new Set(gaps.map(g => g.entity))
  const failedAssets = bulk.assets.filter(a => a.status === 'failed').map(a => {
    const entityResolution = resolveGameDataEntity({ category: a.category, assetIndexEntity: a.entity, serializedItemId: a.serializedItemId, knownEntities })
    const affectedGapIds = entityResolution.status === 'resolved' ? gaps.filter(g => g.entity === entityResolution.entity).map(g => g.gapId) : []
    return { assetPath: a.path, gameplayRoot: a.path.includes('/Actors/Equipment/MeleeWeapons/') ? 'MeleeWeapons' : a.path.includes('/Actors/Items/') ? 'Items' : a.path.includes('/Components/Enchantments/') ? 'Enchantments' : 'other', failureReason: a.failureReason, entityResolution, affectedGapIds, affectedGapCount: affectedGapIds.length, boundary: 'Entity-level exposure only; no property-specific blocking is proven.' }
  })
  const factDifferences = semantic.mappings.map(m => ({
    semanticMappingId: m.id, sourceRecordIds: m.sourceRecordIds, entity: m.entity, rawProperty: m.raw.propertyPath,
    normalizedProperty: m.interpretation.normalizedProperty ?? null,
    differenceKind: (m.entityResolution.status !== 'resolved' ? 'entity-resolution-failed'
      : m.raw.propertyPath === 'Effect' ? 'structural-transform'
        : m.raw.propertyPath === '$cdo.declaredPropertyCount' ? 'inheritance-unresolved'
          : m.interpretation.status === 'tentative' ? 'semantic-ambiguity'
            : m.interpretation.status === 'unresolved' ? 'native-or-runtime-only'
              : m.gapProperties.length === 0 ? 'game-only-property' : 'rename-or-alias') as DifferenceKind,
    secondaryDifferenceKinds: unique([...(m.gapProperties.length === 0 && m.interpretation.status === 'accepted' ? ['game-only-property'] : []), ...(m.raw.propertyPath === 'Effect' ? ['structural-transform'] : []), ...(m.raw.propertyPath === '$cdo.declaredPropertyCount' ? ['inheritance-unresolved'] : [])]),
    boundary: 'Observed within retained facts only. Missing Gap linkage is not proof that a new runtime field is needed.',
  }))
  const workstreamSpecs = [
    ['canonical-property-aliases', 'Explicit aliases for configured counts and angles', 'rename-or-alias', 'alias'],
    ['structural-reference-mapping', 'Normalize artifact/armor GameplayEffect references', 'structural-transform', 'add-structural-reference'],
    ['new-game-property-review', 'Review configured animation durations as research metadata', 'game-only-property', 'add-canonical-property'],
    ['entity-alias-cleanup', 'Review unresolved canonical entity identities', 'entity-resolution-failed', 'alias'],
    ['semantic-rule-expansion', 'Review raw timing semantics before approved rule expansion', 'semantic-ambiguity', 'split-property'],
  ] as const
  const phase66Workstreams = workstreamSpecs.map(([id, title, kind, type]) => {
    const facts = factDifferences.filter(f => (f.differenceKind === kind || f.secondaryDifferenceKinds.includes(kind)) && (kind !== 'game-only-property' || mappings.get(f.semanticMappingId)?.interpretation.status === 'accepted'))
    const ids = new Set(facts.map(f => f.semanticMappingId))
    const affectedGapIds = gapClassifications.filter(g => g.evidence.semanticMappingIds.some(id => ids.has(id))).map(g => g.gapId)
    return { id, title, affectedGapIds, affectedGapCount: affectedGapIds.length, expectedClosePotential: 'unproven; no forecast of new closures', directEvidenceCount: facts.length, complexity: kind === 'structural-transform' ? 'high' : 'medium', recommendation: 'Review research-layer normalization first. Empirical/runtime, version, implementation and objective gaps retain their disposition.', changeCandidate: { id: `${id}-review`, type, affectedGapIds, sourceRecordIds: unique(facts.flatMap(f => f.sourceRecordIds)), semanticMappingIds: unique(facts.map(f => f.semanticMappingId)), confidence: 'medium', recommendation: 'Candidate only; do not change canonical or runtime fields in Phase 6.5F.' } }
  })
  const expectedPropertyReviews = remaining.filter(g => g.disposition === 'manual-review')
  const missingExpectedPropertyReview = { id: 'missing-optimizer-property-review', title: 'Review expected fields with no current semantic match; deprecation is not authorized', affectedGapCount: expectedPropertyReviews.length, affectedGapIds: expectedPropertyReviews.map(g => g.gapId), expectedClosePotential: 'unknown; absence is not evidence of obsolescence', directEvidenceCount: 0, complexity: 'medium', recommendation: 'Compare expected-property meaning to the public source model and candidate/rule selection. Preserve public-research/source-extractable provenance; require positive evidence before adding or deprecating a canonical field.' }
  const highPotentialGapCount = remaining.filter(g => g.gameDataFurtherResearchPotential.level === 'high').length
  const mediumPotentialGapCount = remaining.filter(g => g.gameDataFurtherResearchPotential.level === 'medium').length
  const deepGameDataFollowupRecommendation = { status: highPotentialGapCount > 0 ? 'recommended' : mediumPotentialGapCount > 0 || factDifferences.some(f => f.rawProperty === 'Effect') ? 'optional' : 'not-recommended', highPotentialGapCount, mediumPotentialGapCount, reason: `No property-specific high-potential blocker is proven. ${mediumPotentialGapCount} remaining Gaps have partial/timing evidence. GameplayEffect references and empty CDOs justify a bounded feasibility study, but entity-level association must not inflate closure ROI. Prioritize Phase 6.6 review and preserve empirical protocols; no Phase 6.7 is scheduled.` }
  const summary = { differenceKinds: counts(gapClassifications.map(g => g.differenceKind), Object.keys(TAXONOMY)), dispositions: counts(gapClassifications.map(g => g.disposition), DISPOSITIONS), remainingByDisposition: counts(remaining.map(g => g.disposition), DISPOSITIONS), remainingByPotential: counts(remaining.map(g => g.gameDataFurtherResearchPotential.level), ['high', 'medium', 'low', 'none']), factDifferenceKinds: counts(factDifferences.map(f => f.differenceKind), Object.keys(TAXONOMY)) }
  const common = { schemaVersion: 1, datasetId: bulk.datasetId, sourceFingerprint: bulk.sourceFingerprint, runtimePromotion: 'not-performed' }
  const finalCoverage = { ...common, coverageFunnel, semanticRuleCoverage, gapCoverage: { touchedByCategory: counts(touched.map(g => g.category)), touchedByProperty: counts(touched.map(g => g.property)), highRuntimeRelevance: reconciliation.impact.byRuntimeRelevance.high, rankAccuracy: reconciliation.impact.byUnlockEffect['rank-accuracy'] }, parserDiagnostics: { summary: bulk.diagnosticsSummary, classification: { fatal: bulk.diagnosticsSummary.filter(d => d.fatal).reduce((sum, d) => sum + d.count, 0), safeSkipped: { count: null, basis: 'Bulk summary does not retain per-diagnostic skipped flags. Nonfatal is not automatically equivalent to safely skipped.' }, potentiallyRelevant: bulk.diagnosticsSummary.filter(d => ['struct-parse-failed', 'unsupported-property-type'].includes(d.code)).reduce((sum, d) => sum + d.count, 0), likelyIrrelevant: { count: 0, basis: 'No retained property context proves irrelevance.' }, relevanceUnknown: bulk.diagnosticsSummary.filter(d => d.code === 'trailing-bytes').reduce((sum, d) => sum + d.count, 0) }, hardeningRecommendation: 'First retain diagnostic property paths and safe-skip flags in a bounded future probe; investigate Map/Set/struct and malformed tags only with a canonical entity/property link. Current aggregates do not demonstrate high closure ROI.', failedAssets, boundary: 'Aggregate unsupported diagnostics cannot be assigned to individual Gaps. Fatal assets identify entity exposure only.' }, traceAudit: { status: 'passed', closed: touched.filter(g => g.reconciliationStatus === 'closed').length, partialAndEvidenceAdded: touched.filter(g => ['partial', 'evidence-added'].includes(g.reconciliationStatus)).length, chain: 'Gap → mapping → provenance record → indexed asset path → SHA256 → dataset → source path-size fingerprint' }, entityResolution: { ambiguous: semantic.summary.ambiguousEntityCount, unresolved: semantic.summary.unresolvedEntityCount } }
  const modelDifferences = { ...common, baselineGapCount: gaps.length, coverageFunnel, differenceTaxonomy: Object.entries(TAXONOMY).map(([kind, definition]) => ({ kind, definition })), gapClassifications, factDifferences, summary, phase66Workstreams, missingExpectedPropertyReview, deepGameDataFollowupRecommendation, readiness: { phase66CanStart: true, canonicalAndRuntimeModelChanged: false, phase67Scheduled: false } }
  return { finalCoverage, modelDifferences }
}

export function renderReports(result: ReturnType<typeof buildFinalCoverage>) {
  const { finalCoverage: c, modelDifferences: m } = result
  const escape = (value: unknown) => String(value).replaceAll('|', '\\|').replaceAll('\n', ' ')
  const table = (values: Record<string, unknown>): string => {
    const scalars = Object.entries(values).filter(([, value]) => value === null || typeof value !== 'object')
    const nested = Object.entries(values).filter(([, value]) => value !== null && typeof value === 'object')
    const rows = scalars.length ? `| Metric | Value |\n| --- | --- |\n${scalars.map(([k, v]) => `| ${escape(k)} | ${escape(v)} |`).join('\n')}\n` : ''
    return rows + nested.map(([key, value]) => {
      if (Array.isArray(value)) {
        if (!value.length) return `\n**${key}**: none\n`
        if (value.every(v => typeof v !== 'object')) return `\n**${key}**: ${value.map(escape).join(', ')}\n`
        return `\n**${key}**\n\n${value.map(v => table(v as Record<string, unknown>)).join('\n')}`
      }
      return `\n**${key}**\n\n${table(value as Record<string, unknown>)}`
    }).join('\n')
  }
  const workstreamTable = table(Object.fromEntries(m.phase66Workstreams.map(w => [w.id, { title: w.title, affectedGapCount: w.affectedGapCount, directEvidenceCount: w.directEvidenceCount, complexity: w.complexity, expectedClosePotential: w.expectedClosePotential, recommendation: w.recommendation, proposedChange: w.changeCandidate.type }])))

  const coverage = `# Direct Game Data Final Coverage — Phase 6.5F\n\n## Executive Summary\n\nCurrent explicit semantic rules and conservative closure gates prove ${c.coverageFunnel.gap.closedCount} closed Gaps. A further ${c.traceAudit.partialAndEvidenceAdded} received partial structural support or direct evidence. The remaining count does not imply game files contain no useful data.\n\n## What Phase 6.5 proved\n\nThe selected gameplay assets are largely readable; semantic normalization and effective runtime behavior are separate limits. Inventory is path/size identity, not authentication of every byte or version.\n\n## Coverage Funnel\n\n${Object.entries(c.coverageFunnel).map(([level, values]) => `### ${level}\n\n${table(values)}`).join('\n')}\n## Semantic Rule Coverage\n\n${c.semanticRuleCoverage.length} explicit rules. Raw parser coverage is not semantic normalization coverage.\n\n${c.semanticRuleCoverage.map(r => table(r)).join('\n')}\n## Parser Diagnostics\n\n${table(c.parserDiagnostics)}\n## Gap Reconciliation Coverage\n\n${table(c.gapCoverage)}\n${table(c.traceAudit)}\n## Why only ${c.coverageFunnel.gap.closedCount} Gaps closed\n\nExact NumberOfProjectiles → ranged.projectileCount → projectileCount proves configured static counts. AngleSpan supports spread but does not prove effective behavior; AttackRateSeconds does not establish effective cadence. High-runtime-relevance and rank-accuracy results above describe current rule scope, not the usefulness of game data in general. Blocked implementation/objective records are not direct-evidence hits.\n\n## Model Differences\n\nSee [the decision report](./game-data-model-differences.md) for every taxonomy, retained-fact differences and workstream. Melee configured animation duration is a retained field without Gap linkage; Effect references require structural normalization. Expected powerScaling, ownership, distribution and version history are not established by current static facts. No-match alone never justifies deprecating an expected field.\n\n## Remaining Gap Disposition\n\n${table(m.summary.remainingByDisposition)}\n## Phase 6.6 Workstreams\n\n${m.phase66Workstreams.map(w => `- ${w.id}: ${w.title}; ${w.affectedGapCount} traced Gaps, ${w.directEvidenceCount} mappings; closure potential unproven.`).join('\n')}\n\n## Deep Game Data Follow-up Recommendation\n\n${table(m.deepGameDataFollowupRecommendation)}\n## What Phase 7 should contain\n\nAfter Phase 6.6 alignment, regenerate the handoff for remaining Observe / Measure / Experiment. Partial evidence does not replace an empirical protocol.\n\n## Runtime boundary\n\nWeb source model → direct game-data structural model → Optimizer canonical model are distinct evidence layers. Direct assets strongly support serialized counts, configured values, references, enums and booleans. Final damage, Power scaling, native curves, proc ownership, stacking, cadence and interactions need runtime or empirical evidence.\n\nRaw Game Property → Canonical Research Property → Runtime Optimizer Property is the Phase 6.6 direction. UI need not expose raw UE names. Runtime promotion not performed; catalog, score and worker unchanged.\n\n## Known limitations\n\nFull unknown property trees were not retained. Synthetic empty-CDO observations are counted separately from parsed properties. Aggregate diagnostics cannot prove a particular Gap is blocked. Failed-asset entity exposure is not a closure estimate. Deep reference magnitudes and inheritance remain unproven; version is a root-label claim. No new harvest, semantic rules or Gap closures.\n`
  const differences = `# Game Data Model Differences — Phase 6.5F\n\nPrimary Gap differences and retained-fact differences are separate partitions. A zero Gap count does not mean the kind is absent from game assets.\n\n## Taxonomy\n\n${Object.entries(TAXONOMY).map(([k,v]) => `- **${k}**: ${v}`).join('\n')}\n\n## Gap differences\n\n${table(m.summary.differenceKinds)}\n## Retained-fact differences\n\n${table(m.summary.factDifferenceKinds)}\n## Dispositions\n\n${table(m.summary.dispositions)}\n## Decision rules\n\nPrecedence: unchanged closed → implementation/objective → version/conflict → original empirical protocol → partial/evidence normalization → scoped no-match/manual review. Reasons and evidence IDs are attached to every Gap. Native/scaling flags describe an evidence boundary, not proof that a property exists only in executable code. Parser-hardening requires a demonstrated property-specific blocker; aggregate diagnostics and entity coincidence are insufficient.\n\n## Phase 6.6 change candidates\n\n${workstreamTable}\n${table({ missingExpectedPropertyReview: { ...m.missingExpectedPropertyReview, affectedGapIds: 'See machine-readable decision artifact for all Gap IDs.' } })}\nReview useful game-only fields and missing expected fields without assuming missing means obsolete. Add/split/merge/deprecation require approved semantics. Runtime-only and empirical-only flags are research-boundary candidates, never automatic runtime changes.\n\n## ROI and readiness\n\n${table(m.deepGameDataFollowupRecommendation)}\n${table(m.readiness)}\n\nFull Gap records, retained-fact records, traceable change candidates and deterministic partitions are in [game-data-model-differences.json](../research/analysis/game-data-model-differences.json).\n`
  return { coverage, differences }
}

import type { EvidenceGap } from '../src/research/evidenceGapMap.ts'
import { canCloseGap, GAP_RECONCILIATION_STATUSES, isExpectedOutcomeCompatible, type GameDataGapResolutionStatus } from '../src/research/gameDataGapReconciliation.ts'
import { resolveGameDataEntity, type EntityResolution } from '../src/research/gameDataEntityResolver.ts'
import type { CrossCheckStatus, GameDataConfidenceAxes, JsonValue, MappingBasis } from '../src/research/gameDataProvenance.ts'
import type { SemanticMappingCategory, SemanticMappingStatus } from '../src/research/gameDataSemanticMapping.ts'
import { GAME_DATA_SEMANTIC_RULES, type GameDataRuleClosePolicy } from '../src/research/gameDataSemanticRules.ts'
import type { GameDataBulkHarvestArtifact } from './game-data-bulk-harvest.ts'

export const BULK_SEMANTIC_SCHEMA_VERSION = 1 as const
export const GAP_RECONCILIATION_SCHEMA_VERSION = 1 as const

export interface BulkSemanticMapping {
  readonly id: string
  readonly ruleId: string
  readonly datasetId: string
  readonly sourceRecordIds: readonly string[]
  readonly category: SemanticMappingCategory
  readonly entity: string
  readonly entityResolution: EntityResolution
  readonly raw: { readonly assetPath: string; readonly propertyPath: string; readonly propertyType: string; readonly value: JsonValue }
  readonly interpretation: {
    readonly status: SemanticMappingStatus
    readonly normalizedProperty?: string
    readonly normalizedValue?: JsonValue
    readonly mappingBasis: readonly MappingBasis[]
    readonly note: string
  }
  readonly confidence: GameDataConfidenceAxes
  readonly crossCheck: { readonly status: CrossCheckStatus; readonly note: string }
  readonly gapProperties: readonly string[]
  readonly expectedOutcomes: readonly string[]
  readonly closePolicy: GameDataRuleClosePolicy
  readonly canReplaceEmpiricalProtocol: boolean
  readonly runtimePromotion: 'not-performed'
}

export interface GameDataBulkSemanticArtifact {
  readonly schemaVersion: 1
  readonly datasetId: string
  readonly ruleRegistry: readonly { readonly id: string; readonly category: SemanticMappingCategory; readonly semanticStatus: SemanticMappingStatus; readonly semanticConfidence: string; readonly scope: string; readonly gapProperties: readonly string[]; readonly closePolicy: GameDataRuleClosePolicy; readonly canReplaceEmpiricalProtocol: boolean; readonly empiricalReplacementReason?: string }[]
  readonly mappings: readonly BulkSemanticMapping[]
  readonly summary: { readonly total: number; readonly accepted: number; readonly tentative: number; readonly unresolved: number; readonly rejected: number; readonly ambiguousEntityCount: number; readonly unresolvedEntityCount: number }
  readonly runtimePromotion: 'not-performed'
}

export interface GapReconciliationRecord {
  readonly gapId: string
  readonly entity: string
  readonly property: string
  readonly baseline: { readonly cause: string; readonly resolutionClass: string; readonly expectedOutcome: string }
  readonly status: Exclude<GameDataGapResolutionStatus, 'no-match'>
  readonly sourceRecordIds: readonly string[]
  readonly semanticMappingIds: readonly string[]
  readonly normalizedProperty?: string
  readonly normalizedValue?: JsonValue
  readonly reason: string
  readonly remainingNeed?: string
}

type StatusCounts = Readonly<Record<GameDataGapResolutionStatus, number>>

export interface GameDataGapReconciliationArtifact {
  readonly schemaVersion: 1
  readonly datasetId: string
  readonly baselineSource: 'research/evidence-gap-map.json'
  readonly summary: {
    readonly baselineGapCount: number
    readonly closedCount: number
    readonly partialCount: number
    readonly evidenceAddedCount: number
    readonly conflictCount: number
    readonly blockedCount: number
    readonly noMatchCount: number
    readonly remainingGapCount: number
  }
  readonly closedGapIds: readonly string[]
  readonly resolutions: readonly GapReconciliationRecord[]
  readonly impact: {
    readonly byCategory: Readonly<Record<string, StatusCounts>>
    readonly byProperty: Readonly<Record<string, StatusCounts>>
    readonly byGapCause: Readonly<Record<string, StatusCounts>>
    readonly byResolutionClass: Readonly<Record<string, StatusCounts>>
    readonly byRuntimeRelevance: Readonly<Record<string, StatusCounts>>
    readonly byUnlockEffect: Readonly<Record<string, StatusCounts>>
    readonly byStatus: StatusCounts
  }
  readonly runtimePromotion: 'not-performed'
}

export function buildBulkSemanticArtifact(bulk: GameDataBulkHarvestArtifact, gaps: readonly EvidenceGap[]): GameDataBulkSemanticArtifact {
  const knownEntities = new Set(gaps.map((gap) => gap.entity))
  const assets = new Map(bulk.assets.map((asset) => [asset.path, asset]))
  const mappings = bulk.records.flatMap((record): BulkSemanticMapping[] => {
    const asset = assets.get(record.asset.path)
    const propertyPath = record.extraction?.propertyPath
    if (!asset || !propertyPath || !record.extraction?.propertyType || record.rawObservation === undefined) return []
    const rule = GAME_DATA_SEMANTIC_RULES.find((candidate) => candidate.category === asset.category
      && candidate.assetNamePattern.test(baseName(asset.path)) && candidate.propertyPathPattern.test(propertyPath))
    if (!rule) return []
    const entityResolution = resolveGameDataEntity({ category: asset.category, assetIndexEntity: asset.entity, serializedItemId: asset.serializedItemId, knownEntities })
    const normalizedValue = rule.normalizedProperty ? normalizeValue(rule.normalizedProperty, record.rawObservation.value) : undefined
    return [{
      id: `mapping-${record.id}`, ruleId: rule.id, datasetId: bulk.datasetId, sourceRecordIds: [record.id],
      category: asset.category, entity: entityResolution.status === 'resolved' ? entityResolution.entity : `unresolved:${asset.entity ?? baseName(asset.path)}`,
      entityResolution,
      raw: { assetPath: record.asset.path, propertyPath, propertyType: record.extraction.propertyType, value: record.rawObservation.value },
      interpretation: {
        status: rule.semanticStatus, ...(rule.normalizedProperty && normalizedValue !== undefined ? { normalizedProperty: rule.normalizedProperty, normalizedValue } : {}),
        mappingBasis: rule.mappingBasis, note: rule.description,
      },
      confidence: { source: 'medium', extraction: 'high', semantics: rule.semanticConfidence, version: 'low' },
      crossCheck: { status: 'not-compared', note: 'Bulk mapping is reconciled against exact Gap identity and expected-outcome gates; public evidence is not treated as automatic agreement.' },
      gapProperties: rule.gapProperties, expectedOutcomes: rule.expectedOutcomes, closePolicy: rule.closePolicy,
      canReplaceEmpiricalProtocol: rule.canReplaceEmpiricalProtocol, runtimePromotion: 'not-performed',
    }]
  }).sort((left, right) => left.id.localeCompare(right.id))
  markDuplicateConflicts(mappings)
  const count = (status: SemanticMappingStatus) => mappings.filter((mapping) => mapping.interpretation.status === status).length
  return {
    schemaVersion: BULK_SEMANTIC_SCHEMA_VERSION, datasetId: bulk.datasetId,
    ruleRegistry: GAME_DATA_SEMANTIC_RULES.map((rule) => ({
      id: rule.id, category: rule.category, semanticStatus: rule.semanticStatus, semanticConfidence: rule.semanticConfidence,
      scope: `${rule.assetNamePattern.source} :: ${rule.propertyPathPattern.source}`, gapProperties: rule.gapProperties,
      closePolicy: rule.closePolicy, canReplaceEmpiricalProtocol: rule.canReplaceEmpiricalProtocol,
      ...(rule.empiricalReplacementReason ? { empiricalReplacementReason: rule.empiricalReplacementReason } : {}),
    })).sort((left, right) => left.id.localeCompare(right.id)),
    mappings, summary: {
      total: mappings.length, accepted: count('accepted'), tentative: count('tentative'), unresolved: count('unresolved'), rejected: count('rejected'),
      ambiguousEntityCount: mappings.filter((mapping) => mapping.entityResolution.status === 'ambiguous').length,
      unresolvedEntityCount: mappings.filter((mapping) => mapping.entityResolution.status === 'unresolved').length,
    }, runtimePromotion: 'not-performed',
  }
}

export function buildGapReconciliationArtifact(datasetId: string, gaps: readonly EvidenceGap[], semantic: GameDataBulkSemanticArtifact): GameDataGapReconciliationArtifact {
  const resolutions: GapReconciliationRecord[] = []
  const statusByGap = new Map<string, GameDataGapResolutionStatus>()
  for (const gap of gaps) {
    if (gap.resolutionClass === 'implementation' || gap.resolutionClass === 'objective-design') {
      statusByGap.set(gap.gapId, 'blocked')
      resolutions.push({
        gapId: gap.gapId, entity: gap.entity, property: gap.property,
        baseline: { cause: gap.gapCause, resolutionClass: gap.resolutionClass, expectedOutcome: gap.expectedOutcome },
        status: 'blocked', sourceRecordIds: [], semanticMappingIds: [],
        reason: gap.resolutionClass === 'implementation' ? 'A static game-data fact cannot make the required implementation decision.' : 'Game data cannot define the product objective.',
        remainingNeed: gap.resolutionClass === 'implementation' ? 'Implementation decision and validation remain required.' : 'An explicit objective definition remains required.',
      })
      continue
    }
    const matching = semantic.mappings.filter((mapping) => mapping.entityResolution.status === 'resolved'
      && mapping.entity === gap.entity && mapping.gapProperties.includes(gap.property))
    if (matching.length === 0) { statusByGap.set(gap.gapId, 'no-match'); continue }
    const conflicts = matching.filter((mapping) => mapping.crossCheck.status === 'conflicts')
    const preferred = matching.find((mapping) => mapping.interpretation.status === 'accepted') ?? matching[0]!
    const candidate = {
      entityExact: preferred.entity === gap.entity, propertyExact: preferred.gapProperties.includes(gap.property), sourceRecordExists: preferred.sourceRecordIds.length > 0,
      extractionConfidence: preferred.confidence.extraction, semanticStatus: preferred.interpretation.status, semanticConfidence: preferred.confidence.semantics,
      normalizedProperty: preferred.interpretation.normalizedProperty, normalizedValue: preferred.interpretation.normalizedValue,
      crossCheckStatus: preferred.crossCheck.status, expectedOutcomeCompatible: isExpectedOutcomeCompatible(gap.expectedOutcome, preferred.interpretation.normalizedValue),
      closePolicy: preferred.closePolicy, canReplaceEmpiricalProtocol: preferred.canReplaceEmpiricalProtocol,
    } as const
    const status: Exclude<GameDataGapResolutionStatus, 'no-match'> = conflicts.length ? 'conflict'
      : canCloseGap(gap, candidate) ? 'closed'
        : preferred.interpretation.status === 'accepted' ? 'partial' : 'evidence-added'
    statusByGap.set(gap.gapId, status)
    resolutions.push({
      gapId: gap.gapId, entity: gap.entity, property: gap.property,
      baseline: { cause: gap.gapCause, resolutionClass: gap.resolutionClass, expectedOutcome: gap.expectedOutcome }, status,
      sourceRecordIds: matching.flatMap((mapping) => mapping.sourceRecordIds).sort(), semanticMappingIds: matching.map((mapping) => mapping.id).sort(),
      ...(preferred.interpretation.normalizedProperty ? { normalizedProperty: preferred.interpretation.normalizedProperty } : {}),
      ...(preferred.interpretation.normalizedValue !== undefined ? { normalizedValue: preferred.interpretation.normalizedValue } : {}),
      reason: reconciliationReason(status, preferred),
      ...(status === 'closed' ? {} : { remainingNeed: remainingNeed(status, gap) }),
    })
  }
  const byStatus = emptyStatusCounts()
  for (const gap of gaps) byStatus[statusByGap.get(gap.gapId) ?? 'no-match'] += 1
  const closedGapIds = resolutions.filter((resolution) => resolution.status === 'closed').map((resolution) => resolution.gapId).sort()
  return {
    schemaVersion: GAP_RECONCILIATION_SCHEMA_VERSION, datasetId, baselineSource: 'research/evidence-gap-map.json',
    summary: {
      baselineGapCount: gaps.length, closedCount: byStatus.closed, partialCount: byStatus.partial,
      evidenceAddedCount: byStatus['evidence-added'], conflictCount: byStatus.conflict, blockedCount: byStatus.blocked,
      noMatchCount: byStatus['no-match'], remainingGapCount: gaps.length - byStatus.closed,
    },
    closedGapIds, resolutions: resolutions.sort((left, right) => left.gapId.localeCompare(right.gapId)),
    impact: {
      byCategory: aggregate(gaps, statusByGap, (gap) => gap.category),
      byProperty: aggregate(gaps, statusByGap, (gap) => gap.property),
      byGapCause: aggregate(gaps, statusByGap, (gap) => gap.gapCause),
      byResolutionClass: aggregate(gaps, statusByGap, (gap) => gap.resolutionClass),
      byRuntimeRelevance: aggregate(gaps, statusByGap, (gap) => gap.runtimeRelevance),
      byUnlockEffect: aggregate(gaps, statusByGap, (gap) => gap.unlockEffect), byStatus,
    }, runtimePromotion: 'not-performed',
  }
}

export function collectBulkSemanticErrors(artifact: GameDataBulkSemanticArtifact, bulk: GameDataBulkHarvestArtifact): string[] {
  const errors: string[] = []
  const records = new Map(bulk.records.map((record) => [record.id, record]))
  const ruleIds = new Set(GAME_DATA_SEMANTIC_RULES.map((rule) => rule.id))
  if (artifact.datasetId !== bulk.datasetId) errors.push('Bulk semantic datasetId does not match harvest')
  if (artifact.runtimePromotion !== 'not-performed') errors.push('Bulk semantics must not perform runtime promotion')
  if (new Set(artifact.mappings.map((mapping) => mapping.id)).size !== artifact.mappings.length) errors.push('Bulk mappings contain duplicate IDs')
  for (const mapping of artifact.mappings) {
    if (!ruleIds.has(mapping.ruleId)) errors.push(`${mapping.id}: semantic rule does not exist`)
    const rule = GAME_DATA_SEMANTIC_RULES.find((candidate) => candidate.id === mapping.ruleId)
    if (rule && (rule.category !== mapping.category || !rule.assetNamePattern.test(baseName(mapping.raw.assetPath)) || !rule.propertyPathPattern.test(mapping.raw.propertyPath))) errors.push(`${mapping.id}: accepted rule scope does not match category/class/property path`)
    if (rule && JSON.stringify(rule.gapProperties) !== JSON.stringify(mapping.gapProperties)) errors.push(`${mapping.id}: normalized property-to-Gap mapping differs from the explicit rule`)
    if (mapping.sourceRecordIds.some((id) => !records.has(id))) errors.push(`${mapping.id}: source record does not exist`)
    const source = records.get(mapping.sourceRecordIds[0] ?? '')
    if (!source || JSON.stringify(source.rawObservation?.value) !== JSON.stringify(mapping.raw.value)) errors.push(`${mapping.id}: raw value does not match source record`)
    if (mapping.interpretation.status === 'tentative' && mapping.closePolicy === 'may-close-static-gap') errors.push(`${mapping.id}: tentative mapping cannot close a Gap`)
    if (['unresolved', 'rejected'].includes(mapping.interpretation.status) && (mapping.interpretation.normalizedProperty || mapping.interpretation.normalizedValue !== undefined)) errors.push(`${mapping.id}: unresolved/rejected mapping has a normalized fact`)
    if (/damage/i.test(mapping.raw.propertyPath) && /damage/i.test(mapping.interpretation.normalizedProperty ?? '')) errors.push(`${mapping.id}: raw Damage negative control was normalized as damage`)
  }
  return [...new Set(errors)].sort()
}

export function collectGapReconciliationErrors(artifact: GameDataGapReconciliationArtifact, gaps: readonly EvidenceGap[], semantic: GameDataBulkSemanticArtifact): string[] {
  const errors: string[] = []
  const gapById = new Map(gaps.map((gap) => [gap.gapId, gap]))
  const mappingById = new Map(semantic.mappings.map((mapping) => [mapping.id, mapping]))
  const summaryPartition = artifact.summary.closedCount + artifact.summary.partialCount + artifact.summary.evidenceAddedCount + artifact.summary.conflictCount + artifact.summary.blockedCount + artifact.summary.noMatchCount
  if (artifact.summary.baselineGapCount !== gaps.length || summaryPartition !== gaps.length) errors.push('Gap reconciliation summary does not partition the baseline')
  if (artifact.summary.remainingGapCount !== gaps.length - artifact.summary.closedCount) errors.push('Remaining Gap count is inconsistent')
  if (new Set(artifact.resolutions.map((resolution) => resolution.gapId)).size !== artifact.resolutions.length) errors.push('Duplicate Gap resolution')
  if (JSON.stringify(artifact.closedGapIds) !== JSON.stringify(artifact.resolutions.filter((resolution) => resolution.status === 'closed').map((resolution) => resolution.gapId).sort())) errors.push('closedGapIds differs from closed resolutions')
  if (artifact.runtimePromotion !== 'not-performed') errors.push('Gap reconciliation must not perform runtime promotion')
  for (const resolution of artifact.resolutions) {
    const gap = gapById.get(resolution.gapId)
    if (!gap) { errors.push(`${resolution.gapId}: referenced Gap does not exist`); continue }
    if (resolution.semanticMappingIds.some((id) => !mappingById.has(id))) errors.push(`${resolution.gapId}: semantic mapping does not exist`)
    if (resolution.status === 'closed') {
      const mapping = mappingById.get(resolution.semanticMappingIds[0] ?? '')
      if (!mapping || mapping.interpretation.status !== 'accepted' || !['medium', 'high', 'verified'].includes(mapping.confidence.semantics) || mapping.confidence.extraction !== 'high') errors.push(`${resolution.gapId}: closed gate confidence/status failed`)
      if (gap.gapCause === 'version-unknown' || gap.gapCause === 'conflicting-public-sources') errors.push(`${resolution.gapId}: version/conflict Gap cannot close`)
      if (gap.resolutionClass === 'implementation' || gap.resolutionClass === 'objective-design') errors.push(`${resolution.gapId}: implementation/objective Gap cannot close`)
      if (['observe', 'measure', 'experiment'].includes(gap.resolutionClass) && !mapping?.canReplaceEmpiricalProtocol) errors.push(`${resolution.gapId}: empirical protocol replacement is not explicit`)
    }
  }
  return [...new Set(errors)].sort()
}

export function renderGapReconciliationReport(artifact: GameDataGapReconciliationArtifact, semantic: GameDataBulkSemanticArtifact): string {
  const s = artifact.summary
  const closedCategoryRows = Object.entries(artifact.impact.byCategory).filter(([, counts]) => counts.closed > 0).map(([key, counts]) => `| ${key} | ${counts.closed} | ${counts.partial} | ${counts['evidence-added']} |`).join('\n') || '| — | 0 | 0 | 0 |'
  const closedPropertyRows = Object.entries(artifact.impact.byProperty).filter(([, counts]) => counts.closed > 0).sort((a, b) => b[1].closed - a[1].closed).map(([key, counts]) => `| ${key} | ${counts.closed} |`).join('\n') || '| — | 0 |'
  return `# Game Data Gap Reconciliation — Phase 6.5E

## Baseline

The immutable Phase 5 baseline contains ${s.baselineGapCount} Gaps, derived from \`${artifact.baselineSource}\`; the count is not hardcoded by the reconciliation engine.

## Result

| Status | Count |
| --- | ---: |
| closed | ${s.closedCount} |
| partial | ${s.partialCount} |
| evidence-added | ${s.evidenceAddedCount} |
| conflict | ${s.conflictCount} |
| blocked | ${s.blockedCount} |
| no-match | ${s.noMatchCount} |
| remaining | ${s.remainingGapCount} |

## Closed by category

| Category | Closed | Partial | Evidence added |
| --- | ---: | ---: | ---: |
${closedCategoryRows}

## Closed by property

| Property | Closed |
| --- | ---: |
${closedPropertyRows}

Every closed Gap traces through an accepted semantic mapping and extracted record to an asset content hash, dataset ID, and source fingerprint. The only empirical replacement rule is the exact static \`projectileCount\` configuration.

## Partial / evidence-added

Accepted angle-span facts remain partial for categorical \`spread\` Gaps. Tentative \`AttackRateSeconds\` facts add evidence but do not replace effective cadence measurement. Structural effect-class links and empty CDO observations do not stand in for magnitude, duration, stacking, or runtime behavior.

## Conflicts

${s.conflictCount === 0 ? 'No duplicate exact entity/property mapping produced different normalized values.' : `${s.conflictCount} Gap(s) retain conflicting direct values; no source was automatically preferred.`}

## What direct game data could not solve

Implementation (${artifact.impact.byResolutionClass.implementation?.blocked ?? 0}) and objective-design (${artifact.impact.byResolutionClass['objective-design']?.blocked ?? 0}) Gaps remain blocked by definition. Version research, public conflicts, Power curves, proc ownership, damage distribution, effective cadence, stacking, and native/runtime behavior remain open unless an exact accepted static rule proves the requested fact.

Bulk semantic mappings: ${semantic.summary.total} total — ${semantic.summary.accepted} accepted, ${semantic.summary.tentative} tentative, ${semantic.summary.unresolved} unresolved, ${semantic.summary.rejected} rejected.

Runtime promotion was not performed. Runtime catalogs, Optimizer values, support manifests, score models, and objective weights remain unchanged.

## Next: 6.5F

Phase 6.5F — Audit / Report / Coverage will consolidate final direct-game-data coverage and impact.
`
}

export function serializeReconciliation(value: unknown): string { return `${JSON.stringify(value, null, 2)}\n` }

function normalizeValue(property: string, value: JsonValue): JsonValue | undefined {
  if (property.endsWith('gameplayEffectClass') && value && typeof value === 'object' && !Array.isArray(value) && 'objectName' in value) {
    const name = (value as { objectName?: unknown }).objectName
    return typeof name === 'string' ? name : undefined
  }
  return value
}

function markDuplicateConflicts(mappings: BulkSemanticMapping[]): void {
  const groups = new Map<string, BulkSemanticMapping[]>()
  for (const mapping of mappings) {
    if (mapping.entityResolution.status !== 'resolved' || !mapping.interpretation.normalizedProperty) continue
    const key = `${mapping.entity}\0${mapping.interpretation.normalizedProperty}`
    groups.set(key, [...(groups.get(key) ?? []), mapping])
  }
  for (const group of groups.values()) {
    const values = new Set(group.map((mapping) => JSON.stringify(mapping.interpretation.normalizedValue)))
    if (values.size > 1) group.forEach((mapping) => Object.assign(mapping.crossCheck, { status: 'conflicts', note: 'Different direct values were retained for the same canonical entity and normalized property.' }))
  }
}

function aggregate(gaps: readonly EvidenceGap[], statusByGap: ReadonlyMap<string, GameDataGapResolutionStatus>, keyOf: (gap: EvidenceGap) => string): Record<string, ReturnType<typeof emptyStatusCounts>> {
  const result: Record<string, ReturnType<typeof emptyStatusCounts>> = {}
  for (const gap of gaps) {
    const key = keyOf(gap)
    result[key] ??= emptyStatusCounts()
    result[key]![statusByGap.get(gap.gapId) ?? 'no-match'] += 1
  }
  return Object.fromEntries(Object.entries(result).sort(([left], [right]) => left.localeCompare(right)))
}

function emptyStatusCounts(): Record<GameDataGapResolutionStatus, number> { return Object.fromEntries(GAP_RECONCILIATION_STATUSES.map((status) => [status, 0])) as Record<GameDataGapResolutionStatus, number> }

function reconciliationReason(status: Exclude<GameDataGapResolutionStatus, 'no-match'>, mapping: BulkSemanticMapping): string {
  if (status === 'closed') return 'Exact canonical entity and explicit property rule matched an accepted high-confidence extracted static fact.'
  if (status === 'partial') return `Accepted direct fact ${mapping.interpretation.normalizedProperty ?? mapping.raw.propertyPath} narrows the Gap but does not satisfy its expected outcome or close policy.`
  if (status === 'conflict') return 'Different direct values exist for the same canonical entity/property; no value was automatically preferred.'
  if (status === 'evidence-added') return 'Direct evidence narrows follow-up research, but its semantic status or empirical boundary prevents closure.'
  return 'Static game data cannot satisfy this Gap class.'
}

function remainingNeed(status: string, gap: EvidenceGap): string {
  if (status === 'conflict') return 'Resolve version/current-behavior provenance without automatic source precedence.'
  if (gap.resolutionClass === 'observe' || gap.resolutionClass === 'measure' || gap.resolutionClass === 'experiment') return `Complete the ${gap.resolutionClass} protocol unless an explicit static replacement rule is added.`
  return 'Obtain an exact compatible accepted fact or complete the original research class.'
}

function baseName(value: string): string { return value.slice(value.lastIndexOf('/') + 1) }

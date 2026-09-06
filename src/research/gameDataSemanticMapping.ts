import {
  CROSS_CHECK_STATUSES, GAME_DATA_CONFIDENCE_LEVELS, MAPPING_BASES,
  isCanonicalGameDataPath, isFiniteJsonTree,
  type CrossCheckStatus, type GameDataConfidence, type GameDataConfidenceAxes,
  type GameDataProvenanceRecord, type JsonValue, type MappingBasis,
} from './gameDataProvenance.ts'

export const SEMANTIC_MAPPING_SCHEMA_VERSION = 1 as const
export const SEMANTIC_MAPPING_STATUSES = ['accepted', 'tentative', 'unresolved', 'rejected'] as const
export const SEMANTIC_MAPPING_CATEGORIES = ['ranged-weapon', 'enchantment', 'artifact', 'armor-property', 'melee-weapon'] as const

export type SemanticMappingStatus = typeof SEMANTIC_MAPPING_STATUSES[number]
export type SemanticMappingCategory = typeof SEMANTIC_MAPPING_CATEGORIES[number]

export interface GameDataNormalizedProperty {
  readonly id: string
  readonly label: string
  readonly category: SemanticMappingCategory
  readonly unit?: 'count' | 'seconds' | 'asset-reference'
  readonly description: string
}

export interface GameDataSemanticMappingRecord {
  readonly id: string
  readonly datasetId: string
  readonly sourceRecordIds: readonly string[]
  readonly category: SemanticMappingCategory
  readonly entity: string
  readonly raw: {
    readonly assetPath: string
    readonly objectName?: string
    readonly propertyPath: string
    readonly propertyType: string
    readonly value: JsonValue
  }
  readonly interpretation: {
    readonly statement: string
    readonly normalizedProperty?: string
    readonly normalizedValue?: JsonValue
    readonly normalizationRule?: string
    readonly mappingBasis: readonly MappingBasis[]
    readonly status: SemanticMappingStatus
    readonly note: string
  }
  readonly confidence: GameDataConfidenceAxes
  readonly crossCheck: {
    readonly status: CrossCheckStatus
    readonly sourceIds?: readonly string[]
    readonly note: string
  }
  readonly runtimePromotion: 'not-performed'
}

export interface GameDataSemanticMappingArtifact {
  readonly schemaVersion: 1
  readonly datasetId: string
  readonly sourceExtractor: { readonly parserId: string; readonly parserSchemaVersion: number }
  readonly normalizedProperties: readonly GameDataNormalizedProperty[]
  readonly mappings: readonly GameDataSemanticMappingRecord[]
  readonly summary: {
    readonly total: number
    readonly accepted: number
    readonly tentative: number
    readonly unresolved: number
    readonly rejected: number
    readonly byCategory: Readonly<Record<SemanticMappingCategory, number>>
  }
}

export const NORMALIZED_GAME_DATA_PROPERTIES: readonly GameDataNormalizedProperty[] = [
  {
    id: 'artifact.gameplayEffectClass', label: 'Artifact gameplay effect class', category: 'artifact', unit: 'asset-reference',
    description: 'The gameplay-effect class structurally referenced by an artifact instance; it does not establish modifier magnitude or duration.',
  },
  {
    id: 'armor.gameplayEffectClass', label: 'Armor property gameplay effect class', category: 'armor-property', unit: 'asset-reference',
    description: 'The gameplay-effect class structurally referenced by an armor property; it does not establish the effect magnitude.',
  },
  {
    id: 'melee.attackAnimationDurationSeconds', label: 'Melee attack animation duration', category: 'melee-weapon', unit: 'seconds',
    description: 'Serialized duration for one configured melee attack animation variant; not a complete effective attack-cycle measurement.',
  },
  {
    id: 'ranged.attackRateSeconds', label: 'Ranged attack-rate interval', category: 'ranged-weapon', unit: 'seconds',
    description: 'Serialized AttackRateSeconds value retained as a research property while exact runtime cadence semantics remain tentative.',
  },
  {
    id: 'ranged.projectileCount', label: 'Ranged projectile count', category: 'ranged-weapon', unit: 'count',
    description: 'Number of projectile spawn entries emitted by the configured ranged attack definition.',
  },
] as const

const confidenceRank: Readonly<Record<GameDataConfidence, number>> = {
  unknown: 0, low: 1, medium: 2, high: 3, verified: 4,
}

const sameJson = (left: unknown, right: unknown): boolean => JSON.stringify(left) === JSON.stringify(right)

export function buildSemanticMappingSummary(mappings: readonly GameDataSemanticMappingRecord[]): GameDataSemanticMappingArtifact['summary'] {
  const byCategory = Object.fromEntries(SEMANTIC_MAPPING_CATEGORIES.map((category) => [category, 0])) as Record<SemanticMappingCategory, number>
  const statusCounts = Object.fromEntries(SEMANTIC_MAPPING_STATUSES.map((status) => [status, 0])) as Record<SemanticMappingStatus, number>
  for (const mapping of mappings) {
    byCategory[mapping.category] += 1
    statusCounts[mapping.interpretation.status] += 1
  }
  return { total: mappings.length, ...statusCounts, byCategory }
}

export function collectSemanticMappingErrors(
  artifact: GameDataSemanticMappingArtifact,
  sourceRecords: readonly GameDataProvenanceRecord[],
  knownCrossCheckSourceIds: ReadonlySet<string> = new Set(),
): string[] {
  const errors: string[] = []
  const serialized = JSON.stringify(artifact)
  const sourceById = new Map(sourceRecords.map((record) => [record.id, record]))
  const propertyById = new Map(artifact.normalizedProperties.map((property) => [property.id, property]))
  const mappingIds = artifact.mappings.map((mapping) => mapping.id)
  const propertyIds = artifact.normalizedProperties.map((property) => property.id)

  if (artifact.schemaVersion !== SEMANTIC_MAPPING_SCHEMA_VERSION) errors.push('Unsupported semantic mapping schema version')
  if (!artifact.datasetId.trim()) errors.push('Semantic mapping datasetId is required')
  if (artifact.sourceExtractor.parserId !== 'ue4-package-property-parser' || artifact.sourceExtractor.parserSchemaVersion !== 1) errors.push('Semantic mapping parser identity is invalid')
  if (new Set(mappingIds).size !== mappingIds.length) errors.push('Semantic mapping artifact contains duplicate mapping IDs')
  if (new Set(propertyIds).size !== propertyIds.length) errors.push('Normalized property registry contains duplicate IDs')
  if (!sameJson(mappingIds, [...mappingIds].sort())) errors.push('Semantic mappings are not deterministically ordered')
  if (!sameJson(propertyIds, [...propertyIds].sort())) errors.push('Normalized properties are not deterministically ordered')
  if (/\/Users\/|\\Users\\|file:\/\/|~\/Downloads|\/home\/|\/root\//.test(serialized)) errors.push('Semantic mapping artifact contains a local absolute or private path')
  if (!isFiniteJsonTree(artifact)) errors.push('Semantic mapping artifact contains a non-finite number')

  for (const property of artifact.normalizedProperties) {
    if (!property.id.trim() || !property.label.trim() || !property.description.trim()) errors.push(`Normalized property ${property.id || '<missing>'} is incomplete`)
    if (!SEMANTIC_MAPPING_CATEGORIES.includes(property.category)) errors.push(`${property.id}: normalized property category is invalid`)
  }

  for (const mapping of artifact.mappings) {
    const prefix = `${mapping.id}: `
    if (!mapping.id.trim()) errors.push(`${prefix}mapping ID is required`)
    if (mapping.datasetId !== artifact.datasetId) errors.push(`${prefix}datasetId does not match artifact`)
    if (!SEMANTIC_MAPPING_CATEGORIES.includes(mapping.category)) errors.push(`${prefix}category is invalid`)
    if (!SEMANTIC_MAPPING_STATUSES.includes(mapping.interpretation.status)) errors.push(`${prefix}status is invalid`)
    if (!isCanonicalGameDataPath(mapping.raw.assetPath)) errors.push(`${prefix}asset path is not canonical`)
    if (!mapping.raw.propertyPath.trim() || !mapping.raw.propertyType.trim()) errors.push(`${prefix}raw property identity is incomplete`)
    if (!mapping.interpretation.statement.trim() || !mapping.interpretation.note.trim()) errors.push(`${prefix}interpretation statement and note are required`)
    if (mapping.interpretation.mappingBasis.length === 0) errors.push(`${prefix}mapping basis is required`)
    if (mapping.interpretation.mappingBasis.some((basis) => !MAPPING_BASES.includes(basis))) errors.push(`${prefix}mapping basis is invalid`)
    if (Object.values(mapping.confidence).some((confidence) => !GAME_DATA_CONFIDENCE_LEVELS.includes(confidence))) errors.push(`${prefix}confidence is invalid`)
    if (!CROSS_CHECK_STATUSES.includes(mapping.crossCheck.status)) errors.push(`${prefix}cross-check status is invalid`)
    if (!mapping.crossCheck.note.trim()) errors.push(`${prefix}cross-check note is required`)
    if (mapping.runtimePromotion !== 'not-performed') errors.push(`${prefix}runtime promotion must not be performed in Phase 6.5D`)
    if (mapping.confidence.version === 'verified') errors.push(`${prefix}version confidence must preserve the unverified 6.5B boundary`)
    if (mapping.sourceRecordIds.length === 0) errors.push(`${prefix}at least one source record is required`)
    const linked = mapping.sourceRecordIds.map((id) => sourceById.get(id))
    mapping.sourceRecordIds.forEach((id, index) => { if (!linked[index]) errors.push(`${prefix}source record does not exist: ${id}`) })
    const matchingRaw = linked.some((record) => record
      && record.asset.path === mapping.raw.assetPath
      && record.extraction?.objectName === mapping.raw.objectName
      && record.extraction?.propertyPath === mapping.raw.propertyPath
      && record.extraction?.propertyType === mapping.raw.propertyType
      && sameJson(record.rawObservation?.value, mapping.raw.value))
    if (!matchingRaw) errors.push(`${prefix}raw property or value does not match a linked extracted record`)
    for (const record of linked) {
      if (record && (record.datasetId !== artifact.datasetId || record.status !== 'extracted' || record.interpretation || record.promotionStatus !== 'research-only')) errors.push(`${prefix}source record violates the immutable extracted boundary`)
    }
    const normalizedProperty = mapping.interpretation.normalizedProperty
    const normalizedValuePresent = mapping.interpretation.normalizedValue !== undefined
    if (normalizedProperty && !propertyById.has(normalizedProperty)) errors.push(`${prefix}normalized property is not registered`)
    if (normalizedProperty && propertyById.get(normalizedProperty)?.category !== mapping.category) errors.push(`${prefix}normalized property category does not match mapping category`)
    if ((normalizedProperty === undefined) !== !normalizedValuePresent) errors.push(`${prefix}normalized property and value must be present together`)
    if (mapping.interpretation.status === 'accepted') {
      if (!normalizedProperty || !normalizedValuePresent) errors.push(`${prefix}accepted mapping requires a normalized property and value`)
      if (mapping.confidence.extraction !== 'high') errors.push(`${prefix}accepted mapping requires high extraction confidence`)
      if (confidenceRank[mapping.confidence.semantics] < confidenceRank.medium) errors.push(`${prefix}accepted mapping requires medium or higher semantic confidence`)
      if (!mapping.interpretation.mappingBasis.some((basis) => basis === 'class-context' || basis === 'property-name-direct')) errors.push(`${prefix}accepted mapping requires direct property or class context`)
      if (mapping.crossCheck.status === 'conflicts') errors.push(`${prefix}accepted mapping cannot conflict with cross-check evidence`)
    }
    if (mapping.interpretation.status === 'tentative' && !['low', 'medium'].includes(mapping.confidence.semantics)) errors.push(`${prefix}tentative mapping requires low or medium semantic confidence`)
    if (['unresolved', 'rejected'].includes(mapping.interpretation.status)) {
      if (normalizedProperty || normalizedValuePresent) errors.push(`${prefix}unresolved/rejected mapping must not formalize a normalized property or value`)
    }
    if (mapping.interpretation.status === 'unresolved' && !['unknown', 'low'].includes(mapping.confidence.semantics)) errors.push(`${prefix}unresolved mapping requires unknown or low semantic confidence`)
    for (const sourceId of mapping.crossCheck.sourceIds ?? []) {
      if (!knownCrossCheckSourceIds.has(sourceId)) errors.push(`${prefix}cross-check source does not exist: ${sourceId}`)
    }
  }

  if (!sameJson(artifact.summary, buildSemanticMappingSummary(artifact.mappings))) errors.push('Semantic mapping summary does not match mappings')
  for (const category of SEMANTIC_MAPPING_CATEGORIES) {
    if (!artifact.mappings.some((mapping) => mapping.category === category)) errors.push(`Representative category is missing: ${category}`)
  }
  for (const status of SEMANTIC_MAPPING_STATUSES) {
    if (!artifact.mappings.some((mapping) => mapping.interpretation.status === status)) errors.push(`Representative status is missing: ${status}`)
  }
  const scatterDamage = artifact.mappings.find((mapping) => mapping.raw.propertyPath === 'damage' && mapping.raw.value === 50)
  if (scatterDamage?.interpretation.status !== 'unresolved') errors.push('Scatter Crossbow damage=50 must remain an unresolved negative control')
  const negativeControls = artifact.mappings.filter((mapping) => ['unresolved', 'rejected'].includes(mapping.interpretation.status))
  if (negativeControls.length < 2) errors.push('At least two negative controls are required')
  return [...new Set(errors)].sort()
}

export function serializeSemanticMapping(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`
}

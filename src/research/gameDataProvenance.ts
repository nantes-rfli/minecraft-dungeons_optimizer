export const VERIFICATION_STATUSES = ['verified', 'supported', 'claimed', 'unknown', 'not-applicable'] as const
export type VerificationStatus = typeof VERIFICATION_STATUSES[number]

export const GAME_DATA_CONFIDENCE_LEVELS = ['verified', 'high', 'medium', 'low', 'unknown'] as const
export type GameDataConfidence = typeof GAME_DATA_CONFIDENCE_LEVELS[number]

export const CROSS_CHECK_STATUSES = [
  'not-compared', 'matches', 'partially-matches', 'conflicts',
  'public-source-missing', 'semantics-not-comparable',
] as const
export type CrossCheckStatus = typeof CROSS_CHECK_STATUSES[number]

export const PROVENANCE_RECORD_STATUSES = ['source-only', 'extracted', 'interpreted', 'normalized', 'conflict', 'rejected'] as const
export type ProvenanceRecordStatus = typeof PROVENANCE_RECORD_STATUSES[number]

export const MAPPING_BASES = [
  'property-name-direct', 'class-context', 'inheritance-context',
  'cross-source-match', 'manual-review', 'game-observation',
] as const
export type MappingBasis = typeof MAPPING_BASES[number]

export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue }

export interface GameDataConfidenceAxes {
  readonly source: GameDataConfidence
  readonly extraction: GameDataConfidence
  readonly semantics: GameDataConfidence
  readonly version: GameDataConfidence
}

export interface GameDataProvenanceRecord {
  readonly id: string
  readonly datasetId: string
  readonly asset: {
    readonly path: string
    readonly files: readonly string[]
    readonly contentHash?: { readonly algorithm: 'sha256'; readonly value: string }
  }
  readonly extraction?: {
    readonly parserId: string
    readonly parserSchemaVersion: number
    readonly parserVersion?: string
    readonly objectName?: string
    readonly className?: string
    readonly propertyName?: string
    readonly propertyPath?: string
    readonly propertyType?: string
  }
  readonly rawObservation?: { readonly value: JsonValue }
  readonly interpretation?: {
    readonly normalizedProperty?: string
    readonly normalizedValue?: JsonValue
    readonly statement?: string
    readonly mappingBasis: readonly MappingBasis[]
  }
  readonly confidence: GameDataConfidenceAxes
  readonly crossCheckStatus?: CrossCheckStatus
  readonly promotionStatus: 'research-only'
  readonly status: ProvenanceRecordStatus
}

/** Minimum parser handoff required from Phase 6.5C onward. */
export interface GameDataExtractionRecordInput {
  readonly id: string
  readonly datasetId: string
  readonly assetPath: string
  readonly sourceFiles: readonly string[]
  readonly contentHash?: { readonly algorithm: 'sha256'; readonly value: string }
  readonly extraction: NonNullable<GameDataProvenanceRecord['extraction']>
  readonly rawObservation: NonNullable<GameDataProvenanceRecord['rawObservation']>
  readonly confidence: GameDataConfidenceAxes
  readonly crossCheckStatus?: CrossCheckStatus
  readonly status: 'extracted'
}

export interface VerificationItem {
  readonly status: VerificationStatus
  readonly basis: string
  readonly note: string
}

export const EVIDENCE_LAYERS = [
  { order: 0, id: 'source-dataset', label: 'Source Dataset' },
  { order: 1, id: 'raw-asset-observation', label: 'Raw Asset Observation' },
  { order: 2, id: 'extracted-structural-fact', label: 'Extracted Structural Fact' },
  { order: 3, id: 'semantic-interpretation', label: 'Semantic Interpretation' },
  { order: 4, id: 'normalized-optimizer-fact', label: 'Normalized Optimizer Fact' },
  { order: 5, id: 'runtime-promotion', label: 'Runtime Promotion' },
] as const

export const CONFIDENCE_AXES = [
  { id: 'source', label: 'Source confidence', description: 'Dataset and asset source identity confidence.' },
  { id: 'extraction', label: 'Extraction confidence', description: 'Binary parser structural accuracy confidence.' },
  { id: 'semantics', label: 'Semantic confidence', description: 'Game-mechanics interpretation confidence.' },
  { id: 'version', label: 'Version confidence', description: 'Applicability to claimed Minecraft Dungeons version confidence.' },
] as const

export interface GameDataSourceProvenance {
  readonly schemaVersion: 2
  readonly dataset: {
    readonly id: string
    readonly game: 'Minecraft Dungeons'
    readonly claimedVersion: string
    readonly sourceType: 'local-extracted-game-data'
    readonly sourceClass: 'direct-local-game-asset'
    readonly rootLabel: string
    readonly sourceFingerprint: { readonly algorithm: 'sha256-path-size-v1'; readonly value: string }
    readonly totals: { readonly files: number; readonly bytes: number }
  }
  readonly verification: {
    readonly gameIdentity: VerificationItem
    readonly claimedVersion: VerificationItem
    readonly sourceTreeIdentity: VerificationItem
    readonly originalPackageIdentity: VerificationItem
    readonly extractionTool: VerificationItem & { readonly name: 'QuickBMS' }
    readonly extractionProcedure: VerificationItem
    readonly archiveOrigin: VerificationItem
    readonly completeness: VerificationItem
  }
  readonly boundaries: {
    readonly rawAssetsCommitted: false
    readonly absolutePathsCommitted: false
    readonly ciRequiresLocalSource: false
    readonly runtimePromotionAutomatic: false
  }
  readonly evidenceLayers: typeof EVIDENCE_LAYERS
  readonly confidenceAxes: typeof CONFIDENCE_AXES
  readonly allowedCommittedMetadata: readonly string[]
  readonly prohibitedCommittedRawData: readonly string[]
  readonly parserContract: {
    readonly parserIdRequired: true
    readonly parserSchemaVersionRequired: true
    readonly provenanceRequiredForFormalArtifact: true
    readonly defaultPromotionStatus: 'research-only'
  }
}

const isRelativeCanonicalPath = (value: string): boolean => Boolean(value)
  && !value.startsWith('/')
  && !value.startsWith('\\')
  && !/^[a-zA-Z]:[\\/]/.test(value)
  && !value.includes('\\')
  && !value.split('/').includes('..')

const containsNonFiniteNumber = (value: unknown): boolean => {
  if (typeof value === 'number') return !Number.isFinite(value)
  if (Array.isArray(value)) return value.some(containsNonFiniteNumber)
  if (value && typeof value === 'object') return Object.values(value).some(containsNonFiniteNumber)
  return false
}

export function validateGameDataProvenanceRecord(record: GameDataProvenanceRecord): string[] {
  const errors: string[] = []
  const serialized = JSON.stringify(record)
  if (!record.id.trim()) errors.push('Record ID is required')
  if (!record.datasetId.trim()) errors.push('Dataset ID is required')
  if (!isRelativeCanonicalPath(record.asset.path)) errors.push('Asset path must be a canonical dataset-relative path')
  if (record.asset.files.length === 0 || record.asset.files.some((file) => !isRelativeCanonicalPath(file))) errors.push('Source files must be non-empty dataset-relative paths')
  if (record.asset.files.some((file) => file.slice(0, file.lastIndexOf('.')) !== record.asset.path)) errors.push('Source files must belong to the logical asset path')
  if (record.asset.contentHash && !/^[a-f0-9]{64}$/.test(record.asset.contentHash.value)) errors.push('Content hash must be lowercase SHA-256')
  if (record.extraction && (!record.extraction.parserId.trim() || !Number.isInteger(record.extraction.parserSchemaVersion) || record.extraction.parserSchemaVersion < 1)) errors.push('Extraction requires parserId and a positive parserSchemaVersion')
  if (['extracted', 'interpreted', 'normalized'].includes(record.status) && (!record.extraction || !record.rawObservation)) errors.push(`${record.status} records require extraction and rawObservation`)
  if (record.status === 'extracted' && record.interpretation) errors.push('Extracted records must not contain interpretation')
  if (['interpreted', 'normalized'].includes(record.status) && !record.interpretation) errors.push(`${record.status} records require interpretation`)
  if (record.status === 'normalized' && (!record.interpretation?.normalizedProperty || record.interpretation.normalizedValue === undefined)) errors.push('Normalized records require a separate normalized property and value')
  if (record.interpretation && record.interpretation.mappingBasis.length === 0) errors.push('Interpretation requires at least one mapping basis')
  if (record.interpretation?.mappingBasis.some((basis) => !MAPPING_BASES.includes(basis))) errors.push('Interpretation contains an invalid mapping basis')
  if (Object.values(record.confidence).some((confidence) => !GAME_DATA_CONFIDENCE_LEVELS.includes(confidence))) errors.push('Record contains an invalid confidence level')
  if (record.crossCheckStatus && !CROSS_CHECK_STATUSES.includes(record.crossCheckStatus)) errors.push('Record contains an invalid cross-check status')
  if (!PROVENANCE_RECORD_STATUSES.includes(record.status)) errors.push('Record contains an invalid status')
  if (record.promotionStatus !== 'research-only') errors.push('Game data provenance records must remain research-only during Direct Game Data Research')
  if (/\/Users\/|\\Users\\|file:\/\/|~\/Downloads|\/home\/|\/root\//.test(serialized)) errors.push('Record contains a local absolute or private path')
  if (containsNonFiniteNumber(record)) errors.push('Record contains a non-finite number')
  return [...new Set(errors)].sort()
}

export function createExtractedProvenanceRecord(input: Omit<GameDataProvenanceRecord, 'promotionStatus' | 'status'>): GameDataProvenanceRecord {
  const record: GameDataProvenanceRecord = { ...input, promotionStatus: 'research-only', status: 'extracted' }
  const errors = validateGameDataProvenanceRecord(record)
  if (errors.length) throw new Error(errors.join('\n'))
  return record
}

export function createPhase65CExtractionRecord(input: GameDataExtractionRecordInput): GameDataProvenanceRecord {
  return createExtractedProvenanceRecord({
    id: input.id,
    datasetId: input.datasetId,
    asset: {
      path: input.assetPath,
      files: input.sourceFiles,
      ...(input.contentHash ? { contentHash: input.contentHash } : {}),
    },
    extraction: input.extraction,
    rawObservation: input.rawObservation,
    confidence: input.confidence,
    ...(input.crossCheckStatus ? { crossCheckStatus: input.crossCheckStatus } : {}),
  })
}

export const isFiniteJsonTree = (value: unknown): boolean => !containsNonFiniteNumber(value)
export const isCanonicalGameDataPath = isRelativeCanonicalPath

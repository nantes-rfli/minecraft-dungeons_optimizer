import type {
  Confidence,
  DamageRegressionSample,
  SourceReference,
  WeaponId,
} from '../core/types'

export const GAME_VERSION_CONFIDENCE = ['verified', 'probable', 'unknown'] as const
export const DPS_MEASUREMENT_TYPES = [
  'target-dummy',
  'video-frame-analysis',
  'community-test',
  'other-controlled-test',
] as const
export const REPRODUCIBILITY_LEVELS = ['complete', 'partial', 'insufficient'] as const

export type GameVersionConfidence = (typeof GAME_VERSION_CONFIDENCE)[number]
export type DpsMeasurementType = (typeof DPS_MEASUREMENT_TYPES)[number]
export type Reproducibility = (typeof REPRODUCIBILITY_LEVELS)[number]

export interface DpsRegressionAuditEntry {
  readonly id: string
  readonly weaponId: WeaponId
  readonly source: SourceReference
  readonly gameVersion?: string
  readonly gameVersionConfidence: GameVersionConfidence
  readonly measurementType: DpsMeasurementType
  readonly conditions: {
    readonly powerLevel?: number
    readonly observedDamagePerHit?: number
    readonly enchantments?: readonly string[]
    readonly artifacts?: readonly string[]
    readonly attackSpeedModifier?: number
    readonly encounterDurationSeconds?: number
    readonly target?: string
    readonly targetArmorOrReduction?: string
    readonly difficulty?: string
    readonly otherRelevantConditions?: readonly string[]
  }
  readonly rawObservation?: {
    readonly totalDamage?: number
    readonly durationSeconds?: number
    readonly hitCount?: number
    readonly damageSequence?: readonly number[]
    readonly reportedDps?: number
    readonly derivationNote?: string
  }
  readonly reproducibility: Reproducibility
  readonly eligibleForRegression: boolean
  readonly rejectionReason?: string
  readonly confidence: Confidence
}

export interface DpsRegressionAudit {
  readonly schemaVersion: 1
  readonly targetGameVersion: string
  readonly auditedAt: string
  readonly searchScope: readonly string[]
  readonly eligibilityPolicy: readonly string[]
  readonly entries: readonly DpsRegressionAuditEntry[]
}

export interface DpsRegressionAuditSummary {
  readonly candidateCount: number
  readonly eligibleCount: number
  readonly rejectedCount: number
  readonly eligibleByWeapon: Readonly<Record<WeaponId, number>>
  readonly versionConfidenceCounts: Readonly<Record<GameVersionConfidence, number>>
}

const WEAPON_IDS = ['fighters-bindings', 'double-axe', 'anchor'] as const
const CONFIDENCE_LEVELS = ['high', 'medium', 'low'] as const
const SOURCE_KINDS = [
  'game-files',
  'frame-analysis',
  'published-reference',
  'community-test',
  'model-assumption',
] as const

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0

const isPositiveNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0

const isHttpUrl = (value: unknown): boolean => {
  if (!isNonEmptyString(value)) return false
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol)
  } catch {
    return false
  }
}

const isStringArray = (value: unknown): value is readonly string[] =>
  Array.isArray(value) && value.every(isNonEmptyString)

const hasObservedDps = (observation: Record<string, unknown>): boolean =>
  isPositiveNumber(observation.reportedDps)
  || (
    isPositiveNumber(observation.totalDamage)
    && isPositiveNumber(observation.durationSeconds)
    && isNonEmptyString(observation.derivationNote)
  )
  || (
    Array.isArray(observation.damageSequence)
    && observation.damageSequence.length > 0
    && observation.damageSequence.every(isPositiveNumber)
    && isPositiveNumber(observation.durationSeconds)
    && isNonEmptyString(observation.derivationNote)
  )

const collectEligibleConditionErrors = (
  entry: Record<string, unknown>,
  path: string,
): string[] => {
  const errors: string[] = []
  const conditions = isRecord(entry.conditions) ? entry.conditions : {}
  const observation = isRecord(entry.rawObservation) ? entry.rawObservation : {}
  if (!isPositiveNumber(conditions.observedDamagePerHit)) {
    errors.push(`${path} eligible entry requires observedDamagePerHit`)
  }
  if (typeof conditions.attackSpeedModifier !== 'number'
    || !Number.isFinite(conditions.attackSpeedModifier)
    || conditions.attackSpeedModifier < 0) {
    errors.push(`${path} eligible entry requires a non-negative attackSpeedModifier`)
  }
  if (!isStringArray(conditions.enchantments)) {
    errors.push(`${path} eligible entry requires an enchantments array`)
  }
  if (!isStringArray(conditions.artifacts)) {
    errors.push(`${path} eligible entry requires an artifacts array`)
  }
  if (!isNonEmptyString(conditions.target)) {
    errors.push(`${path} eligible entry requires a single-target condition`)
  }
  if (!isNonEmptyString(conditions.targetArmorOrReduction)) {
    errors.push(`${path} eligible entry requires target armor/reduction information`)
  }
  if (!hasObservedDps(observation)) {
    errors.push(`${path} eligible entry requires independently observed DPS or derivable raw totals`)
  }
  if (entry.reproducibility !== 'complete') {
    errors.push(`${path} eligible entry must be completely reproducible`)
  }
  return errors
}

export function collectDpsRegressionAuditErrors(value: unknown): string[] {
  if (!isRecord(value)) return ['audit must be an object']
  const errors: string[] = []
  if (value.schemaVersion !== 1) errors.push('schemaVersion must be 1')
  if (!isNonEmptyString(value.targetGameVersion)) errors.push('targetGameVersion is required')
  if (!isNonEmptyString(value.auditedAt)) errors.push('auditedAt is required')
  if (!isStringArray(value.searchScope) || value.searchScope.length === 0) {
    errors.push('searchScope must contain at least one public source class')
  }
  if (!isStringArray(value.eligibilityPolicy) || value.eligibilityPolicy.length === 0) {
    errors.push('eligibilityPolicy must contain at least one rule')
  }
  if (!Array.isArray(value.entries)) return [...errors, 'entries must be an array']

  const ids = new Set<string>()
  value.entries.forEach((rawEntry, index) => {
    const path = `entries[${index}]`
    if (!isRecord(rawEntry)) {
      errors.push(`${path} must be an object`)
      return
    }
    if (!isNonEmptyString(rawEntry.id)) errors.push(`${path}.id is required`)
    else if (ids.has(rawEntry.id)) errors.push(`duplicate entry id: ${rawEntry.id}`)
    else ids.add(rawEntry.id)
    if (!WEAPON_IDS.includes(rawEntry.weaponId as WeaponId)) {
      errors.push(`${path}.weaponId is unsupported`)
    }
    if (!GAME_VERSION_CONFIDENCE.includes(rawEntry.gameVersionConfidence as GameVersionConfidence)) {
      errors.push(`${path}.gameVersionConfidence is invalid`)
    }
    if (!DPS_MEASUREMENT_TYPES.includes(rawEntry.measurementType as DpsMeasurementType)) {
      errors.push(`${path}.measurementType is invalid`)
    }
    if (!REPRODUCIBILITY_LEVELS.includes(rawEntry.reproducibility as Reproducibility)) {
      errors.push(`${path}.reproducibility is invalid`)
    }
    if (!CONFIDENCE_LEVELS.includes(rawEntry.confidence as Confidence)) {
      errors.push(`${path}.confidence is invalid`)
    }
    if (!isRecord(rawEntry.conditions)) errors.push(`${path}.conditions must be an object`)

    const source = rawEntry.source
    if (!isRecord(source)) errors.push(`${path}.source must be an object`)
    else {
      if (!isNonEmptyString(source.id)) errors.push(`${path}.source.id is required`)
      if (!isNonEmptyString(source.label)) errors.push(`${path}.source.label is required`)
      if (!SOURCE_KINDS.includes(source.kind as SourceReference['kind'])) {
        errors.push(`${path}.source.kind is invalid`)
      }
      if (!isHttpUrl(source.url)) errors.push(`${path}.source.url must be an HTTP(S) URL`)
    }

    if (rawEntry.eligibleForRegression === true) {
      errors.push(...collectEligibleConditionErrors(rawEntry, path))
      if (isNonEmptyString(rawEntry.rejectionReason)) {
        errors.push(`${path} eligible entry must not have a rejectionReason`)
      }
    } else if (rawEntry.eligibleForRegression === false) {
      if (!isNonEmptyString(rawEntry.rejectionReason)) {
        errors.push(`${path} rejected entry requires a rejectionReason`)
      }
    } else {
      errors.push(`${path}.eligibleForRegression must be boolean`)
    }
  })
  return errors
}

export function summarizeDpsRegressionAudit(
  audit: DpsRegressionAudit,
): DpsRegressionAuditSummary {
  const eligible = audit.entries.filter((entry) => entry.eligibleForRegression)
  const eligibleByWeapon: Record<WeaponId, number> = {
    'fighters-bindings': 0,
    'double-axe': 0,
    anchor: 0,
  }
  const versionConfidenceCounts: Record<GameVersionConfidence, number> = {
    verified: 0,
    probable: 0,
    unknown: 0,
  }
  for (const entry of audit.entries) {
    versionConfidenceCounts[entry.gameVersionConfidence] += 1
    if (entry.eligibleForRegression) eligibleByWeapon[entry.weaponId] += 1
  }
  return {
    candidateCount: audit.entries.length,
    eligibleCount: eligible.length,
    rejectedCount: audit.entries.length - eligible.length,
    eligibleByWeapon,
    versionConfidenceCounts,
  }
}

export function collectRegressionFixtureAuditErrors(
  audit: DpsRegressionAudit,
  samples: readonly DamageRegressionSample[],
): string[] {
  const errors: string[] = []
  const entries = new Map(audit.entries.map((entry) => [entry.id, entry]))
  const sampleAuditIds = new Set<string>()
  for (const sample of samples) {
    const entry = entries.get(sample.auditEntryId)
    if (!entry) {
      errors.push(`runtime sample ${sample.id} references missing audit entry ${sample.auditEntryId}`)
      continue
    }
    if (!entry.eligibleForRegression) {
      errors.push(`runtime sample ${sample.id} references rejected audit entry ${sample.auditEntryId}`)
    }
    if (sampleAuditIds.has(sample.auditEntryId)) {
      errors.push(`audit entry ${sample.auditEntryId} is used by more than one runtime sample`)
    }
    sampleAuditIds.add(sample.auditEntryId)
  }
  for (const entry of audit.entries) {
    if (entry.eligibleForRegression && !sampleAuditIds.has(entry.id)) {
      errors.push(`eligible audit entry ${entry.id} is missing from runtime samples`)
    }
  }
  return errors
}

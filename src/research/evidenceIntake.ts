export type EvidenceOriginKind = 'external' | 'self-observation'
export type ValidationPartition = 'calibration' | 'holdout' | 'unassigned'
export type IntakeOutcome = 'accepted' | 'quarantined' | 'rejected'

export interface EvidenceLocator {
  readonly kind: 'image' | 'video' | 'text' | 'table'
  readonly locator: string
  readonly url: string | null
}

export interface EvidenceObservation {
  readonly value: unknown
  readonly locator: string
}

export interface EvidenceIntakeRecord {
  readonly id: string
  readonly recordId: string
  readonly revision: number
  readonly source: {
    readonly sourceId: string
    readonly revision: number
    readonly url: string
    readonly label: string
    readonly retrievedAt: string
    readonly snapshotSha256: string
    readonly originKind: EvidenceOriginKind
    readonly originGroup: string | null
    readonly repostOfSourceRevisionId: string | null
    readonly reviewed: boolean
  }
  readonly claim: {
    readonly claimId: string
    readonly entity: string
    readonly property: string
    readonly statement: string
    readonly value: unknown
  }
  readonly context: {
    readonly gameVersion: string | null
    readonly equipment: readonly { readonly id: string; readonly power: number | null }[]
    readonly conditions: Readonly<Record<string, string | number | boolean | null>>
  }
  readonly measurement: {
    readonly unit: string | null
    readonly repetitions: number | null
    readonly observations: readonly EvidenceObservation[]
    readonly missingReasons: readonly string[]
  }
  readonly locators: readonly EvidenceLocator[]
  readonly partition: ValidationPartition
  readonly corrects: string | null
  readonly correctionReason: string | null
  readonly capturedAt: string
}

export interface EvidenceIntakeAssessment {
  readonly outcome: IntakeOutcome
  readonly reasons: readonly string[]
}

export interface EvidenceIntakeEntry {
  readonly record: EvidenceIntakeRecord
  readonly assessment: EvidenceIntakeAssessment
  readonly changedFields: readonly string[]
}

export interface EvidenceRepository {
  readonly schemaVersion: 1
  readonly entries: readonly EvidenceIntakeEntry[]
}

const required = (condition: unknown, message: string): asserts condition => {
  if (!condition) throw new Error(`Evidence intake: ${message}`)
}

const isKnown = (value: unknown): boolean => {
  if (value === null || value === undefined) return false
  if (typeof value === 'number') return Number.isFinite(value)
  if (typeof value === 'string') return value.trim().length > 0
  if (typeof value === 'boolean') return true
  if (Array.isArray(value)) return value.length > 0 && value.every(isKnown)
  return typeof value === 'object' && Object.keys(value).length > 0 && Object.values(value).every(isKnown)
}

const isStructurallySafe = (value: unknown): boolean => {
  if (value === null || value === undefined) return true
  if (typeof value === 'number') return Number.isFinite(value)
  if (Array.isArray(value)) return value.every(isStructurallySafe)
  if (typeof value === 'object') return Object.values(value).every(isStructurallySafe)
  return ['string', 'boolean'].includes(typeof value)
}

const stable = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
  if (value && typeof value === 'object') return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => `${JSON.stringify(key)}:${stable(child)}`).join(',')}}`
  return JSON.stringify(value)
}

function validateRecord(record: EvidenceIntakeRecord): void {
  required(record.id === `${record.recordId}@${record.revision}` && record.recordId.trim(), `invalid record identity: ${record.id}`)
  required(Number.isInteger(record.revision) && record.revision > 0, `invalid record revision: ${record.id}`)
  required(record.source.sourceId.trim() && Number.isInteger(record.source.revision) && record.source.revision > 0, `invalid source revision: ${record.id}`)
  required(new URL(record.source.url).protocol === 'https:', `invalid source URL: ${record.id}`)
  required(record.source.label.trim() && !Number.isNaN(Date.parse(record.source.retrievedAt)), `invalid source metadata: ${record.id}`)
  required(/^[a-f0-9]{64}$/.test(record.source.snapshotSha256), `invalid snapshot hash: ${record.id}`)
  required(['external', 'self-observation'].includes(record.source.originKind), `invalid origin: ${record.id}`)
  required(record.claim.claimId.trim() && record.claim.entity.trim() && record.claim.property.trim() && record.claim.statement.trim(), `missing claim metadata: ${record.id}`)
  required(isStructurallySafe(record.claim.value), `invalid claim value: ${record.id}`)
  required(isKnown(record.claim.value) || record.measurement.missingReasons.length > 0, `unknown claim needs reason: ${record.id}`)
  required(Object.values(record.context.conditions).every((value) => value === null || isKnown(value)), `invalid condition: ${record.id}`)
  required(record.context.equipment.every((item) => item.id.trim() && (item.power === null || (Number.isFinite(item.power) && item.power >= 0))), `invalid equipment: ${record.id}`)
  required(record.measurement.repetitions === null || (Number.isInteger(record.measurement.repetitions) && record.measurement.repetitions > 0), `invalid repetitions: ${record.id}`)
  required(record.measurement.observations.every((row) => isKnown(row.value) && row.locator.trim()), `invalid observation: ${record.id}`)
  required(record.measurement.missingReasons.every((reason) => reason.trim()), `invalid missing reason: ${record.id}`)
  required(record.locators.length > 0 && record.locators.every((row) => row.locator.trim() && (row.url === null || new URL(row.url).protocol === 'https:')), `invalid locator: ${record.id}`)
  required(['calibration', 'holdout', 'unassigned'].includes(record.partition), `invalid partition: ${record.id}`)
  required(record.corrects === null ? record.correctionReason === null : Boolean(record.correctionReason?.trim()), `missing correction reason: ${record.id}`)
  required(!Number.isNaN(Date.parse(record.capturedAt)), `invalid capture timestamp: ${record.id}`)
}

function claimDomain(record: EvidenceIntakeRecord): string {
  return stable([record.claim.entity, record.claim.property, record.context.gameVersion, record.context.conditions])
}

function changedFields(previous: EvidenceIntakeRecord | undefined, record: EvidenceIntakeRecord): string[] {
  if (!previous) return ['initial-revision']
  const ignored = new Set(['id', 'revision', 'capturedAt', 'corrects', 'correctionReason'])
  return Object.keys(record).filter((key) => !ignored.has(key) && stable(record[key as keyof EvidenceIntakeRecord]) !== stable(previous[key as keyof EvidenceIntakeRecord])).sort()
}

function assess(entries: readonly EvidenceIntakeEntry[], record: EvidenceIntakeRecord): EvidenceIntakeAssessment {
  const reasons: string[] = []
  if (!record.source.reviewed) reasons.push('source-unreviewed')
  if (!record.source.originGroup?.trim()) reasons.push('origin-independence-unknown')
  if (!record.context.gameVersion?.trim()) reasons.push('game-version-missing')
  if (!record.context.equipment.length) reasons.push('equipment-missing')
  if (record.context.equipment.some((item) => item.power === null)) reasons.push('equipment-power-missing')
  if (!record.measurement.unit?.trim()) reasons.push('unit-missing')
  if (record.measurement.repetitions === null) reasons.push('repetition-count-missing')
  if (!record.measurement.observations.length) reasons.push('raw-observations-missing')
  reasons.push(...record.measurement.missingReasons.map((reason) => `declared-missing:${reason}`))

  const repostTarget = record.source.repostOfSourceRevisionId
  if (repostTarget) {
    const original = entries.find((entry) => `${entry.record.source.sourceId}@${entry.record.source.revision}` === repostTarget)
    reasons.push(original ? 'repost-not-independent' : 'repost-origin-unresolved')
  }

  const peers = entries.map((entry) => entry.record).filter((peer) => claimDomain(peer) === claimDomain(record) && peer.id !== record.corrects)
  if (peers.some((peer) => stable(peer.claim.value) !== stable(record.claim.value))) reasons.push('unresolved-conflict')

  if (record.partition !== 'unassigned') {
    const opposite = record.partition === 'calibration' ? 'holdout' : 'calibration'
    const overlaps = entries.some(({ record: peer }) => peer.partition === opposite && (
      peer.source.snapshotSha256 === record.source.snapshotSha256 ||
      (peer.source.originGroup !== null && peer.source.originGroup === record.source.originGroup)
    ))
    if (overlaps) reasons.push('calibration-holdout-origin-overlap')
  }
  if (record.corrects) reasons.push('correction-recorded')

  const rejected = reasons.some((reason) => ['calibration-holdout-origin-overlap', 'repost-origin-unresolved'].includes(reason))
  const quarantined = reasons.some((reason) => reason !== 'correction-recorded')
  return { outcome: rejected ? 'rejected' : quarantined ? 'quarantined' : 'accepted', reasons: [...new Set(reasons)].sort() }
}

export function appendEvidenceRecord(repository: EvidenceRepository, record: EvidenceIntakeRecord): EvidenceRepository {
  required(repository.schemaVersion === 1, 'unsupported repository schema')
  validateRecord(record)
  required(!repository.entries.some((entry) => entry.record.id === record.id), `duplicate record: ${record.id}`)
  const sameSourceRevision = repository.entries.map((entry) => entry.record.source).filter((source) => source.sourceId === record.source.sourceId && source.revision === record.source.revision)
  required(sameSourceRevision.every((source) => stable(source) === stable(record.source)), `conflicting source revision: ${record.source.sourceId}@${record.source.revision}`)
  const sourceRevisions = repository.entries.map((entry) => entry.record.source.revision).filter((_, index) => repository.entries[index]!.record.source.sourceId === record.source.sourceId)
  if (!sameSourceRevision.length && sourceRevisions.length) required(record.source.revision === Math.max(...sourceRevisions) + 1, `non-sequential source revision: ${record.source.sourceId}@${record.source.revision}`)
  const revisions = repository.entries.map((entry) => entry.record).filter((entry) => entry.recordId === record.recordId).sort((a, b) => a.revision - b.revision)
  const previous = revisions.at(-1)
  required(record.revision === (previous?.revision ?? 0) + 1, `non-sequential revision: ${record.id}`)
  if (previous) required(record.corrects === previous.id, `revision must correct previous record: ${record.id}`)
  else required(record.corrects === null, `initial revision cannot correct: ${record.id}`)
  const changed = changedFields(previous, record)
  required(changed.length > 0, `revision has no content change: ${record.id}`)
  const entry = { record, assessment: assess(repository.entries, record), changedFields: changed }
  return { ...repository, entries: [...repository.entries, entry] }
}

export function buildEvidenceRepository(records: readonly EvidenceIntakeRecord[]): EvidenceRepository {
  return records.reduce(appendEvidenceRecord, { schemaVersion: 1, entries: [] } as EvidenceRepository)
}

export function serializeEvidenceRepository(repository: EvidenceRepository): string {
  validateEvidenceRepository(repository)
  return `${JSON.stringify(repository, null, 2)}\n`
}

export function parseEvidenceRepository(serialized: string): EvidenceRepository {
  let value: unknown
  try { value = JSON.parse(serialized) } catch { throw new Error('Evidence intake: invalid repository JSON') }
  validateEvidenceRepository(value as EvidenceRepository)
  return value as EvidenceRepository
}

export function validateEvidenceRepository(repository: EvidenceRepository): void {
  required(repository && repository.schemaVersion === 1 && Array.isArray(repository.entries), 'unsupported repository schema')
  const replayed = buildEvidenceRepository(repository.entries.map((entry) => entry.record))
  required(stable(replayed) === stable(repository), 'repository assessment or revision drift')
}

import type { RawPackageSnapshot } from '../../../scripts/game-data-raw-package.ts'
import { fightersBindingsValueMappings } from './fightersBindingsValueMappings.ts'
import {
  readMeleeConfiguredValues,
  readRangedConfiguredValues,
  type MeleeConfiguredValueMappings,
  type RangedConfiguredEntry,
  type RangedConfiguredValueMappings,
} from './configuredValueReaders.ts'
import { scatterValueMappings } from './scatterValueMappings.ts'
import type { Field, RawTrace, UnavailableState } from './rawProjection.ts'
import { evidenceFingerprint, type FormalSemanticIdentity, type RawObservationEvidenceRecord } from './identityEvidence.ts'
import { fightersBindingsFormalIdentity, scatterCrossbowFormalIdentity } from './identityDefinitions.ts'
import { matchedIdentityDomainId, sameRawSource, snapshotSource } from './boundarySource.ts'
import { readScatterTarget, readScatterVelocity } from './scatterValueReaders.ts'
import type { FormalSerializedRelationArtifact } from './serializedRelation.ts'

export type ProjectionRef = string
export type NonEmptyArray<T> = [T, ...T[]]

export type SourceBackedValue<T> = {
  value: T
  projectionRef: ProjectionRef
  evidenceRefs: NonEmptyArray<string>
  relationProjectionRef?: string
}

export type ScopeValueOccurrence = {
  domainId: string
  scopeRef: string
}

export type CollectionValueOccurrence = {
  domainId: string
  collectionRef: string
  sourceIndex: number
}

export type ValueOccurrence = ScopeValueOccurrence | CollectionValueOccurrence

export type ValueProjectionRecord = {
  projectionId: ProjectionRef
  mappingId: string
  occurrence: ValueOccurrence
  evidenceRefs?: NonEmptyArray<string>
  relationProjectionRef?: string
} & (
  | { result: 'projected' }
  | { result: 'unavailable'; failureKind: 'raw'; sourceState: UnavailableState; reason: string; evidenceRefs: NonEmptyArray<string> }
  | { result: 'unavailable'; failureKind: 'dependency'; reason: string; relationProjectionRef?: string }
)

export type ValueEvidenceRecord = {
  id: string
  fingerprint: string
  kind: 'raw-value-observation'
  observation: {
    sourceState: 'known' | UnavailableState
    reason?: string
  }
  provenance: RawTrace
}

export type FormalMeleeConfiguredValues = {
  configuredAttacks?: SourceBackedValue<number[]>
  attacks?: {
    sourceIndex: number
    configuredDamage?: SourceBackedValue<number>
    configuredAnimationDurationSeconds?: SourceBackedValue<number>
  }[]
}

export type FormalRangedConfiguredValues = {
  configuredProjectileVelocityFactor?: SourceBackedValue<number>
  configuredProjectileDefinitions?: SourceBackedValue<number[]>
  projectileDefinitions?: {
    sourceIndex: number
    configuredProjectileCount?: SourceBackedValue<number>
    configuredAngleSpan?: SourceBackedValue<number>
    configuredDelaySecondsPerProjectile?: SourceBackedValue<number>
    configuredPushbackEnabled?: SourceBackedValue<boolean>
    configuredPushbackStrength?: SourceBackedValue<number>
    configuredIgnoreFriendlyFire?: SourceBackedValue<boolean>
  }[]
}

export type FormalValueAvailabilityArtifact = {
  schemaVersion: 2
  artifactKind: 'formal-domain-value-availability'
  semantic: {
    melee: Record<string, FormalMeleeConfiguredValues>
    ranged: Record<string, FormalRangedConfiguredValues>
  }
  valueProjections: ValueProjectionRecord[]
  provenance: { evidence: ValueEvidenceRecord[] }
}

export type FormalValueInputs = {
  fightersBindingsRaw: RawPackageSnapshot
  scatterCrossbowInstanceRaw: RawPackageSnapshot
  scatterCrossbowProjectileRaw?: RawPackageSnapshot
  fightersBindingsIdentity: FormalSemanticIdentity
  fightersBindingsIdentityEvidence: RawObservationEvidenceRecord[]
  scatterCrossbowIdentity: FormalSemanticIdentity
  scatterCrossbowIdentityEvidence: RawObservationEvidenceRecord[]
  relations: FormalSerializedRelationArtifact
}

type ProjectionAccumulator = {
  records: ValueProjectionRecord[]
  evidence: ValueEvidenceRecord[]
}

type EvidenceInput = {
  provenance: RawTrace
  sourceState: 'known' | UnavailableState
  reason?: string
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

export function valueScopeOccurrence(domainId: string, scopeRef: string): ScopeValueOccurrence {
  return { domainId, scopeRef }
}

export function valueCollectionOccurrence(domainId: string, collectionRef: string, sourceIndex: number): CollectionValueOccurrence {
  return { domainId, collectionRef, sourceIndex }
}

/**
 * ProjectionRef remains the v1-compatible mapping + semantic occurrence identity.
 * collectionRef is serialized in v2 for semantic location, while sourceIndex remains
 * the occurrence identity for a child mapping.
 */
function projectionOccurrenceKey(occurrence: ValueOccurrence): string {
  return 'scopeRef' in occurrence
    ? `${occurrence.domainId}:scope:${occurrence.scopeRef}`
    : `${occurrence.domainId}:source-index:${occurrence.sourceIndex}`
}

function recordOccurrenceKey(mappingId: string, occurrence: ValueOccurrence): string {
  return `${mappingId}|${canonicalJson(occurrence)}`
}

/** Stable by mapping + occurrence identity only: value/result changes do not mint a new identity. */
export function valueProjectionRef(mappingId: string, occurrence: ValueOccurrence): ProjectionRef {
  return `projection:value:${mappingId}:${projectionOccurrenceKey(occurrence)}`
}

/** Value evidence identifies a Raw source observation, independently of projection occurrence. */
export function valueEvidenceRef(provenance: RawTrace): string {
  return `evidence:value:raw:${evidenceFingerprint(provenance)}`
}

function addEvidence(accumulator: ProjectionAccumulator, input: EvidenceInput): string {
  const id = valueEvidenceRef(input.provenance)
  const content = {
    id,
    kind: 'raw-value-observation' as const,
    observation: {
      sourceState: input.sourceState,
      ...(input.reason ? { reason: input.reason } : {}),
    },
    provenance: input.provenance,
  }
  const record = { ...content, fingerprint: evidenceFingerprint(content) }
  const existing = accumulator.evidence.find((candidate) => candidate.id === id)
  if (existing && canonicalJson(existing) !== canonicalJson(record)) throw new Error(`Conflicting observations for ${id}`)
  if (!existing) accumulator.evidence.push(record)
  return id
}

function addProjection<T>(
  accumulator: ProjectionAccumulator,
  mappingId: string,
  occurrence: ValueOccurrence,
  field: Field<T>,
  evidenceInputs?: NonEmptyArray<EvidenceInput>,
  relationProjectionRef?: string,
): SourceBackedValue<T> | undefined {
  const projectionId = valueProjectionRef(mappingId, occurrence)
  const inputs = evidenceInputs ?? [{
    provenance: field.trace.raw,
    sourceState: field.state,
    ...(field.state === 'known' ? {} : { reason: field.reason }),
  }]
  const evidenceRefs = inputs.map((input) => addEvidence(accumulator, input)) as NonEmptyArray<string>
  if (field.state === 'known') {
    accumulator.records.push({ projectionId, mappingId, occurrence, result: 'projected', evidenceRefs, ...(relationProjectionRef ? { relationProjectionRef } : {}) })
    return { value: field.value, projectionRef: projectionId, evidenceRefs, ...(relationProjectionRef ? { relationProjectionRef } : {}) }
  }
  accumulator.records.push({ projectionId, mappingId, occurrence, result: 'unavailable', failureKind: 'raw', sourceState: field.state, reason: field.reason, evidenceRefs, ...(relationProjectionRef ? { relationProjectionRef } : {}) })
}

function dependencyUnavailable(
  accumulator: ProjectionAccumulator,
  mappingId: string,
  occurrence: CollectionValueOccurrence,
  reason: string,
  relationProjectionRef?: string,
): void {
  accumulator.records.push({
    projectionId: valueProjectionRef(mappingId, occurrence),
    mappingId,
    occurrence,
    result: 'unavailable',
    failureKind: 'dependency',
    reason,
    ...(relationProjectionRef ? { relationProjectionRef } : {}),
  })
}

function validSourceIndices(entries: readonly { sourceIndex: number }[]):
  | { state: 'known'; value: number[] }
  | { state: 'unavailable'; reason: string } {
  const indices = entries.map(({ sourceIndex }) => sourceIndex)
  if (indices.some((index) => !Number.isInteger(index) || index < 0)) return { state: 'unavailable', reason: 'Collection entry sourceIndex is missing or invalid' }
  if (new Set(indices).size !== indices.length) return { state: 'unavailable', reason: 'Collection entry sourceIndex is duplicate and occurrence identity is ambiguous' }
  return { state: 'known', value: indices }
}

function collectionField(field: Field<readonly { sourceIndex: number }[]>): Field<number[]> {
  if (field.state !== 'known') return field
  const indices = validSourceIndices(field.value)
  if (indices.state === 'known') return { state: 'known', value: indices.value, trace: field.trace }
  return { state: 'unknown', reason: indices.reason, trace: field.trace }
}

function projectMeleeConfiguredValues(
  accumulator: ProjectionAccumulator,
  domainId: string,
  values: ReturnType<typeof readMeleeConfiguredValues>,
  mapping: MeleeConfiguredValueMappings,
): FormalMeleeConfiguredValues {
  const semantic: FormalMeleeConfiguredValues = {}
  const parentOccurrence = valueScopeOccurrence(domainId, 'configured-attacks')
  const attacks = collectionField(values.configuredAttacks)
  const configuredAttacks = addProjection(accumulator, mapping.entries.id, parentOccurrence, attacks)
  if (configuredAttacks) semantic.configuredAttacks = configuredAttacks
  if (attacks.state !== 'known' || values.configuredAttacks.state !== 'known') return semantic

  semantic.attacks = values.configuredAttacks.value.map((entry) => {
    const occurrence = valueCollectionOccurrence(domainId, 'configured-attacks', entry.sourceIndex)
    const child: NonNullable<FormalMeleeConfiguredValues['attacks']>[number] = { sourceIndex: entry.sourceIndex }
    const damage = addProjection(accumulator, mapping.damage.id, occurrence, entry.configuredDamage)
    const duration = addProjection(accumulator, mapping.duration.id, occurrence, entry.configuredAnimationDurationSeconds)
    if (damage) child.configuredDamage = damage
    if (duration) child.configuredAnimationDurationSeconds = duration
    return child
  })
  return semantic
}

function projectRangedConfiguredValues(
  accumulator: ProjectionAccumulator,
  domainId: string,
  values: ReturnType<typeof readRangedConfiguredValues>,
  mapping: RangedConfiguredValueMappings,
): { semantic: FormalRangedConfiguredValues; entries?: RangedConfiguredEntry[] } {
  const semantic: FormalRangedConfiguredValues = {}
  const definitionsOccurrence = valueScopeOccurrence(domainId, 'projectile-definitions')
  const definitions = collectionField(values.definitions)
  const configuredDefinitions = addProjection(accumulator, mapping.definitions.id, definitionsOccurrence, definitions)
  if (configuredDefinitions) semantic.configuredProjectileDefinitions = configuredDefinitions
  if (definitions.state !== 'known' || values.definitions.state !== 'known') return { semantic }

  semantic.projectileDefinitions = values.definitions.value.map((entry) => {
    const occurrence = valueCollectionOccurrence(domainId, 'projectile-definitions', entry.sourceIndex)
    const child: NonNullable<FormalRangedConfiguredValues['projectileDefinitions']>[number] = { sourceIndex: entry.sourceIndex }
    const count = addProjection(accumulator, mapping.projectileCount.id, occurrence, entry.count)
    const angle = addProjection(accumulator, mapping.angleSpan.id, occurrence, entry.angle)
    const delay = addProjection(accumulator, mapping.delayPerProjectile.id, occurrence, entry.delay)
    if (count) child.configuredProjectileCount = count
    if (angle) child.configuredAngleSpan = angle
    if (delay) child.configuredDelaySecondsPerProjectile = delay
    return child
  })
  return { semantic, entries: values.definitions.value }
}

export function buildFormalValueAvailabilityArtifact(inputs: FormalValueInputs): FormalValueAvailabilityArtifact {
  const accumulator: ProjectionAccumulator = { records: [], evidence: [] }
  const semantic: FormalValueAvailabilityArtifact['semantic'] = { melee: {}, ranged: {} }

  const fightersDomainId = matchedIdentityDomainId(
    inputs.fightersBindingsRaw,
    fightersBindingsFormalIdentity,
    inputs.fightersBindingsIdentity,
    inputs.fightersBindingsIdentityEvidence,
  )
  if (fightersDomainId) {
    const values = readMeleeConfiguredValues(
      inputs.fightersBindingsRaw,
      fightersBindingsFormalIdentity.assertion.id,
      fightersBindingsValueMappings,
    )
    semantic.melee[fightersDomainId] = projectMeleeConfiguredValues(accumulator, fightersDomainId, values, fightersBindingsValueMappings)
  }

  const scatterDomainId = matchedIdentityDomainId(
    inputs.scatterCrossbowInstanceRaw,
    scatterCrossbowFormalIdentity,
    inputs.scatterCrossbowIdentity,
    inputs.scatterCrossbowIdentityEvidence,
  )
  if (scatterDomainId) {
    const values = readRangedConfiguredValues(
      inputs.scatterCrossbowInstanceRaw,
      scatterCrossbowFormalIdentity.assertion.id,
      scatterValueMappings,
      'AttackDefintion',
    )
    const rangedSemantic: FormalRangedConfiguredValues = {}
    const velocity = addProjection(
      accumulator,
      scatterValueMappings.velocityFactor.id,
      valueScopeOccurrence(scatterDomainId, 'weapon'),
      readScatterVelocity(inputs.scatterCrossbowInstanceRaw),
    )
    if (velocity) rangedSemantic.configuredProjectileVelocityFactor = velocity
    const projected = projectRangedConfiguredValues(accumulator, scatterDomainId, values, scatterValueMappings)
    Object.assign(rangedSemantic, projected.semantic)
    semantic.ranged[scatterDomainId] = rangedSemantic

    for (const entry of projected.entries ?? []) {
      const occurrence = valueCollectionOccurrence(scatterDomainId, 'projectile-definitions', entry.sourceIndex)
      const child = projected.semantic.projectileDefinitions?.find((candidate) => candidate.sourceIndex === entry.sourceIndex)
      if (!child) continue

      const candidates = inputs.relations.relationProjections.filter((record) =>
        record.occurrence.slice === 'scatter-crossbow'
        && 'sourceIndex' in record.occurrence
        && record.occurrence.sourceIndex === entry.sourceIndex
      )
      const relation = candidates.length === 1 ? candidates[0] : undefined
      const relationSource = relation?.evidenceRefs.every((ref) => {
        const evidence = inputs.relations.provenance.evidence.find((item) => item.id === ref)
        return evidence && sameRawSource(evidence.provenance, snapshotSource(inputs.scatterCrossbowInstanceRaw))
      })
      const semanticRelation = relation && inputs.relations.semantic.relations.filter((item) => item.projectionRef === relation.projectionRef)
      const relationReady = relation?.result === 'projected' && relationSource && semanticRelation?.length === 1
        && semanticRelation[0]?.sourceDomainId === scatterDomainId
      const targetRef = relationReady && relation.targetResolution.result === 'resolved' && 'targetEvidenceRef' in relation.targetResolution
        ? relation.targetResolution.targetEvidenceRef : undefined
      const target = targetRef ? inputs.relations.provenance.evidence.find((evidence) => evidence.id === targetRef) : undefined
      const targetReady = Boolean(
        relationReady
        && relation.targetResolution.result === 'resolved'
        && target
        && inputs.scatterCrossbowProjectileRaw
        && sameRawSource(target.provenance, snapshotSource(inputs.scatterCrossbowProjectileRaw)),
      )
      const targetFields = targetReady ? readScatterTarget(inputs.scatterCrossbowProjectileRaw!) : undefined
      const fields = [
        [scatterValueMappings.pushbackEnabled.id, 'configuredPushbackEnabled', targetFields?.pushbackEnabled],
        [scatterValueMappings.pushbackStrength.id, 'configuredPushbackStrength', targetFields?.pushbackStrength],
        [scatterValueMappings.ignoreFriendlyFire.id, 'configuredIgnoreFriendlyFire', targetFields?.ignoreFriendlyFire],
      ] as const
      for (const [mappingId, key, field] of fields) {
        if (!field) {
          dependencyUnavailable(
            accumulator,
            mappingId,
            occurrence,
            !relation ? 'relation-occurrence-missing-or-ambiguous'
              : relation.result === 'unavailable' ? 'relation-unavailable'
                : !relationReady ? 'relation-source-mismatch'
                  : relation.targetResolution.result !== 'resolved' ? relation.targetResolution.reason ?? 'target-not-resolved'
                    : !inputs.scatterCrossbowProjectileRaw ? 'target-snapshot-not-supplied' : 'target-snapshot-mismatch',
            relation?.projectionRef,
          )
          continue
        }
        const value = addProjection<number | boolean>(accumulator, mappingId, occurrence, field, undefined, relation!.projectionRef)
        if (value) Object.assign(child, { [key]: value })
      }
    }
  }

  return {
    schemaVersion: 2,
    artifactKind: 'formal-domain-value-availability',
    semantic,
    valueProjections: accumulator.records,
    provenance: { evidence: accumulator.evidence },
  }
}

type SemanticOccurrence = {
  mappingId: string
  occurrence: ValueOccurrence
  value: SourceBackedValue<unknown>
}

function meleeMappingIds(domainId: string) {
  return {
    entries: `${domainId}:configured-attacks@1`,
    damage: `${domainId}:configured-damage@1`,
    duration: `${domainId}:animation-duration@1`,
  }
}

function rangedMappingIds(domainId: string) {
  return {
    velocityFactor: `${domainId}:configured-projectile-velocity-factor@1`,
    definitions: `${domainId}:configured-projectile-definitions@1`,
    projectileCount: `${domainId}:configured-projectile-count@1`,
    angleSpan: `${domainId}:configured-angle-span@1`,
    delayPerProjectile: `${domainId}:configured-delay-per-projectile@1`,
    pushbackEnabled: `${domainId}:configured-pushback-enabled@1`,
    pushbackStrength: `${domainId}:configured-pushback-strength@1`,
    ignoreFriendlyFire: `${domainId}:configured-ignore-friendly-fire@1`,
  }
}

function collectSemanticOccurrences(semantic: FormalValueAvailabilityArtifact['semantic']): SemanticOccurrence[] {
  const values: SemanticOccurrence[] = []
  const add = (mappingId: string, occurrence: ValueOccurrence, value: SourceBackedValue<unknown> | undefined) => {
    if (value) values.push({ mappingId, occurrence, value })
  }

  for (const [domainId, domain] of Object.entries(semantic.melee)) {
    const mapping = meleeMappingIds(domainId)
    add(mapping.entries, valueScopeOccurrence(domainId, 'configured-attacks'), domain.configuredAttacks)
    for (const attack of domain.attacks ?? []) {
      const occurrence = valueCollectionOccurrence(domainId, 'configured-attacks', attack.sourceIndex)
      add(mapping.damage, occurrence, attack.configuredDamage)
      add(mapping.duration, occurrence, attack.configuredAnimationDurationSeconds)
    }
  }

  for (const [domainId, domain] of Object.entries(semantic.ranged)) {
    const mapping = rangedMappingIds(domainId)
    add(mapping.velocityFactor, valueScopeOccurrence(domainId, 'weapon'), domain.configuredProjectileVelocityFactor)
    add(mapping.definitions, valueScopeOccurrence(domainId, 'projectile-definitions'), domain.configuredProjectileDefinitions)
    for (const definition of domain.projectileDefinitions ?? []) {
      const occurrence = valueCollectionOccurrence(domainId, 'projectile-definitions', definition.sourceIndex)
      add(mapping.projectileCount, occurrence, definition.configuredProjectileCount)
      add(mapping.angleSpan, occurrence, definition.configuredAngleSpan)
      add(mapping.delayPerProjectile, occurrence, definition.configuredDelaySecondsPerProjectile)
      add(mapping.pushbackEnabled, occurrence, definition.configuredPushbackEnabled)
      add(mapping.pushbackStrength, occurrence, definition.configuredPushbackStrength)
      add(mapping.ignoreFriendlyFire, occurrence, definition.configuredIgnoreFriendlyFire)
    }
  }
  return values
}

export function collectFormalValueAvailabilityErrors(value: FormalValueAvailabilityArtifact): string[] {
  const errors: string[] = []
  const check = (condition: boolean, message: string) => { if (!condition) errors.push(message) }
  check(value.schemaVersion === 2 && value.artifactKind === 'formal-domain-value-availability', 'invalid Formal Value artifact header')

  const evidence = new Map<string, ValueEvidenceRecord>()
  for (const record of value.provenance.evidence) {
    check(!evidence.has(record.id), `duplicate EvidenceRef: ${record.id}`)
    if (!evidence.has(record.id)) evidence.set(record.id, record)
    const content: Record<string, unknown> = { ...record }
    delete content.fingerprint
    check(record.fingerprint === evidenceFingerprint(content), `evidence fingerprint mismatch: ${record.id}`)
    check(record.provenance.artifactPath.length > 0 && record.provenance.nodePointer !== undefined, `invalid evidence provenance: ${record.id}`)
  }

  const byOccurrence = new Map<string, ValueProjectionRecord>()
  const byProjectionId = new Map<string, ValueProjectionRecord>()
  for (const record of value.valueProjections) {
    const key = recordOccurrenceKey(record.mappingId, record.occurrence)
    check(!byOccurrence.has(key), `duplicate (mappingId, occurrence): ${key}`)
    if (!byOccurrence.has(key)) byOccurrence.set(key, record)
    check(!byProjectionId.has(record.projectionId), `duplicate projectionId: ${record.projectionId}`)
    if (!byProjectionId.has(record.projectionId)) byProjectionId.set(record.projectionId, record)
    check(record.occurrence.domainId.length > 0, `${record.projectionId}: empty occurrence domainId`)
    if ('scopeRef' in record.occurrence) {
      check(record.occurrence.scopeRef.length > 0, `${record.projectionId}: empty occurrence scopeRef`)
    } else {
      check(record.occurrence.collectionRef.length > 0, `${record.projectionId}: empty occurrence collectionRef`)
      check(Number.isInteger(record.occurrence.sourceIndex) && record.occurrence.sourceIndex >= 0, `${record.projectionId}: invalid occurrence sourceIndex`)
    }
    check(record.projectionId === valueProjectionRef(record.mappingId, record.occurrence), `projectionId is not stable mapping + occurrence identity: ${record.projectionId}`)
    if (record.result === 'unavailable' && record.failureKind === 'dependency') {
      check(record.evidenceRefs === undefined, `${record.projectionId}: dependency failure has fabricated Raw evidence`)
      continue
    }
    check((record.evidenceRefs?.length ?? 0) > 0, `${record.projectionId}: empty evidenceRefs`)
    for (const ref of record.evidenceRefs ?? []) {
      const found = evidence.get(ref)
      check(Boolean(found), `${record.projectionId}: dangling EvidenceRef ${ref}`)
      if (found) {
        const expectedState = record.result === 'projected' ? 'known' : record.sourceState
        check(found.observation.sourceState === expectedState, `${record.projectionId}: evidence source state contradicts projection result`)
        check(found.observation.reason === (record.result === 'unavailable' ? record.reason : undefined), `${record.projectionId}: evidence reason contradicts projection result`)
      }
    }
  }

  const semanticCounts = new Map<string, number>()
  for (const semantic of collectSemanticOccurrences(value.semantic)) {
    const key = recordOccurrenceKey(semantic.mappingId, semantic.occurrence)
    semanticCounts.set(semantic.value.projectionRef, (semanticCounts.get(semantic.value.projectionRef) ?? 0) + 1)
    const record = byProjectionId.get(semantic.value.projectionRef)
    check(Boolean(record), `${key}: missing required projection record`)
    if (!record) continue
    check(record.result === 'projected', `${key}: semantic value points to unavailable record`)
    check(record.mappingId === semantic.mappingId && canonicalJson(record.occurrence) === canonicalJson(semantic.occurrence), `${key}: semantic location differs from projection record`)
    check(canonicalJson(record.evidenceRefs) === canonicalJson(semantic.value.evidenceRefs), `${key}: semantic/projection EvidenceRef mismatch`)
    check(record.relationProjectionRef === semantic.value.relationProjectionRef, `${key}: relation projection link mismatch`)
  }

  const requireChildCoverage = (mappingIds: readonly string[], occurrence: CollectionValueOccurrence, label: string) => {
    for (const mappingId of mappingIds) {
      const key = recordOccurrenceKey(mappingId, occurrence)
      check(byOccurrence.has(key), `${label}: missing required child projection record ${key}`)
    }
  }

  for (const [domainId, domain] of Object.entries(value.semantic.melee)) {
    const mapping = meleeMappingIds(domainId)
    const indices = domain.configuredAttacks?.value
    if (indices) {
      const entryIndices = domain.attacks?.map(({ sourceIndex }) => sourceIndex)
      check(canonicalJson(entryIndices) === canonicalJson(indices), `${domainId}: child occurrence order/membership differs from projected melee collection`)
      check(indices.every((index) => Number.isInteger(index) && index >= 0) && new Set(indices).size === indices.length, `${domainId}: projected melee collection has ambiguous sourceIndex values`)
      for (const sourceIndex of indices) requireChildCoverage(
        [mapping.damage, mapping.duration],
        valueCollectionOccurrence(domainId, 'configured-attacks', sourceIndex),
        domainId,
      )
    } else {
      check(domain.attacks === undefined, `${domainId}: melee children exist without a projected parent collection`)
      check(!value.valueProjections.some(({ occurrence }) => occurrence.domainId === domainId && 'collectionRef' in occurrence && occurrence.collectionRef === 'configured-attacks'), `${domainId}: melee child records exist before parent enumeration`)
    }
  }

  for (const [domainId, domain] of Object.entries(value.semantic.ranged)) {
    const mapping = rangedMappingIds(domainId)
    const indices = domain.configuredProjectileDefinitions?.value
    if (indices) {
      const entryIndices = domain.projectileDefinitions?.map(({ sourceIndex }) => sourceIndex)
      check(canonicalJson(entryIndices) === canonicalJson(indices), `${domainId}: child occurrence order/membership differs from projected ranged collection`)
      check(indices.every((index) => Number.isInteger(index) && index >= 0) && new Set(indices).size === indices.length, `${domainId}: projected ranged collection has ambiguous sourceIndex values`)
      const requiredMappings = [
        mapping.projectileCount,
        mapping.angleSpan,
        mapping.delayPerProjectile,
        ...(domainId === scatterCrossbowFormalIdentity.assertion.domainId
          ? [mapping.pushbackEnabled, mapping.pushbackStrength, mapping.ignoreFriendlyFire]
          : []),
      ]
      for (const sourceIndex of indices) requireChildCoverage(
        requiredMappings,
        valueCollectionOccurrence(domainId, 'projectile-definitions', sourceIndex),
        domainId,
      )
    } else {
      check(domain.projectileDefinitions === undefined, `${domainId}: ranged children exist without a projected parent collection`)
      check(!value.valueProjections.some(({ occurrence }) => occurrence.domainId === domainId && 'collectionRef' in occurrence && occurrence.collectionRef === 'projectile-definitions'), `${domainId}: ranged child records exist before parent enumeration`)
    }
  }

  for (const record of value.valueProjections) {
    const count = semanticCounts.get(record.projectionId) ?? 0
    if (record.result === 'projected') check(count === 1, `${record.projectionId}: projected record must have exactly one semantic value occurrence; found ${count}`)
    else check(count === 0, `${record.projectionId}: unavailable record must not have a semantic value`)
  }
  return errors
}

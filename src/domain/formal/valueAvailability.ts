import type { RawPackageSnapshot } from '../../../scripts/game-data-raw-package.ts'
import { projectFightersBindings, fightersBindingsMappings } from '../temporary/fightersBindings.ts'
import { scatterCrossbowMappings } from '../temporary/scatterCrossbow.ts'
import type { Field, RawTrace, UnavailableState } from '../temporary/projectionPrimitives.ts'
import { evidenceFingerprint, type FormalSemanticIdentity, type RawObservationEvidenceRecord } from './identityEvidence.ts'
import { fightersBindingsFormalIdentity, scatterCrossbowFormalIdentity } from './identityDefinitions.ts'
import { matchedIdentityDomainId, sameRawSource, snapshotSource } from './boundarySource.ts'
import { readScatterSource, readScatterTarget } from './scatterValueReaders.ts'
import type { FormalSerializedRelationArtifact } from './serializedRelation.ts'

export type ProjectionRef = string
export type NonEmptyArray<T> = [T, ...T[]]

export type SourceBackedValue<T> = {
  value: T
  projectionRef: ProjectionRef
  evidenceRefs: NonEmptyArray<string>
  relationProjectionRef?: string
}

export type FighterValueOccurrence =
  | { slice: 'fighters-bindings'; scope: 'configured-attacks' }
  | { slice: 'fighters-bindings'; sourceIndex: number }

export type ScatterValueOccurrence =
  | { slice: 'scatter-crossbow'; scope: 'weapon' | 'projectile-definitions' }
  | { slice: 'scatter-crossbow'; sourceIndex: number }

export type ValueOccurrence = FighterValueOccurrence | ScatterValueOccurrence

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

export type FormalFightersBindingsValues = {
  configuredAttacks?: SourceBackedValue<number[]>
  attacks?: {
    sourceIndex: number
    configuredDamage?: SourceBackedValue<number>
    configuredAnimationDurationSeconds?: SourceBackedValue<number>
  }[]
}

export type FormalScatterCrossbowValues = {
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
  schemaVersion: 1
  artifactKind: 'formal-domain-value-availability'
  semantic: {
    fightersBindings: FormalFightersBindingsValues
    scatterCrossbow: FormalScatterCrossbowValues
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

function occurrenceKey(occurrence: ValueOccurrence): string {
  return 'scope' in occurrence
    ? `${occurrence.slice}:scope:${occurrence.scope}`
    : `${occurrence.slice}:source-index:${occurrence.sourceIndex}`
}

/** Stable by mapping + occurrence only: value/result changes do not mint a new identity. */
export function valueProjectionRef(mappingId: string, occurrence: ValueOccurrence): ProjectionRef {
  return `projection:value:${mappingId}:${occurrenceKey(occurrence)}`
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
  occurrence: ScatterValueOccurrence,
  reason: string,
  relationProjectionRef?: string,
): void {
  accumulator.records.push({ projectionId: valueProjectionRef(mappingId, occurrence), mappingId, occurrence,
    result: 'unavailable', failureKind: 'dependency', reason, ...(relationProjectionRef ? { relationProjectionRef } : {}) })
}

function validSourceIndices(entries: readonly { sourceIndex: number }[]):
  | { state: 'known'; value: number[] }
  | { state: 'unavailable'; reason: string } {
  const indices = entries.map(({ sourceIndex }) => sourceIndex)
  if (indices.some((index) => !Number.isInteger(index) || index < 0)) return { state: 'unavailable', reason: 'Collection entry sourceIndex is missing or invalid' }
  if (new Set(indices).size !== indices.length) return { state: 'unavailable', reason: 'Collection entry sourceIndex is duplicate and occurrence identity is ambiguous' }
  return { state: 'known', value: indices }
}

function collectionField(
  field: Field<readonly { sourceIndex: number }[]>,
): Field<number[]> {
  if (field.state !== 'known') return field
  const indices = validSourceIndices(field.value)
  if (indices.state === 'known') return { state: 'known', value: indices.value, trace: field.trace }
  return { state: 'unknown', reason: indices.reason, trace: field.trace }
}

export function buildFormalValueAvailabilityArtifact(inputs: FormalValueInputs): FormalValueAvailabilityArtifact {
  const accumulator: ProjectionAccumulator = { records: [], evidence: [] }
  const fightersSemantic: FormalFightersBindingsValues = {}
  if (matchedIdentityDomainId(inputs.fightersBindingsRaw, fightersBindingsFormalIdentity, inputs.fightersBindingsIdentity, inputs.fightersBindingsIdentityEvidence)) {
    const fighters = projectFightersBindings(inputs.fightersBindingsRaw)
    const fighterOccurrence: FighterValueOccurrence = { slice: 'fighters-bindings', scope: 'configured-attacks' }
    const attacks = collectionField(fighters.configuredAttacks)
    const configuredAttacks = addProjection(accumulator, fightersBindingsMappings.entries.id, fighterOccurrence, attacks)
    if (configuredAttacks) fightersSemantic.configuredAttacks = configuredAttacks
    if (attacks.state === 'known' && fighters.configuredAttacks.state === 'known') {
      fightersSemantic.attacks = fighters.configuredAttacks.value.map((entry) => {
        const occurrence: FighterValueOccurrence = { slice: 'fighters-bindings', sourceIndex: entry.sourceIndex }
        const semantic: NonNullable<FormalFightersBindingsValues['attacks']>[number] = { sourceIndex: entry.sourceIndex }
        const damage = addProjection(accumulator, fightersBindingsMappings.damage.id, occurrence, entry.configuredDamage)
        const duration = addProjection(accumulator, fightersBindingsMappings.duration.id, occurrence, entry.configuredAnimationDurationSeconds)
        if (damage) semantic.configuredDamage = damage
        if (duration) semantic.configuredAnimationDurationSeconds = duration
        return semantic
      })
    }
  }

  const scatterSemantic: FormalScatterCrossbowValues = {}
  if (matchedIdentityDomainId(inputs.scatterCrossbowInstanceRaw, scatterCrossbowFormalIdentity, inputs.scatterCrossbowIdentity, inputs.scatterCrossbowIdentityEvidence)) {
    const scatter = readScatterSource(inputs.scatterCrossbowInstanceRaw)
    const weaponOccurrence: ScatterValueOccurrence = { slice: 'scatter-crossbow', scope: 'weapon' }
    const velocity = addProjection(accumulator, scatterCrossbowMappings.velocityFactor.id, weaponOccurrence, scatter.velocity)
    if (velocity) scatterSemantic.configuredProjectileVelocityFactor = velocity
    const definitionsOccurrence: ScatterValueOccurrence = { slice: 'scatter-crossbow', scope: 'projectile-definitions' }
    const definitions = collectionField(scatter.definitions)
    const configuredDefinitions = addProjection(accumulator, scatterCrossbowMappings.definitions.id, definitionsOccurrence, definitions)
    if (configuredDefinitions) scatterSemantic.configuredProjectileDefinitions = configuredDefinitions
    if (definitions.state === 'known' && scatter.definitions.state === 'known') {
      scatterSemantic.projectileDefinitions = scatter.definitions.value.map((entry) => {
        const occurrence: ScatterValueOccurrence = { slice: 'scatter-crossbow', sourceIndex: entry.sourceIndex }
        const semantic: NonNullable<FormalScatterCrossbowValues['projectileDefinitions']>[number] = { sourceIndex: entry.sourceIndex }
        const count = addProjection(accumulator, scatterCrossbowMappings.projectileCount.id, occurrence, entry.count)
        const angle = addProjection(accumulator, scatterCrossbowMappings.angleSpan.id, occurrence, entry.angle)
        const delay = addProjection(accumulator, scatterCrossbowMappings.delayPerProjectile.id, occurrence, entry.delay)
        if (count) semantic.configuredProjectileCount = count
        if (angle) semantic.configuredAngleSpan = angle
        if (delay) semantic.configuredDelaySecondsPerProjectile = delay
        const candidates = inputs.relations.relationProjections.filter((record) => record.occurrence.slice === 'scatter-crossbow' && record.occurrence.sourceIndex === entry.sourceIndex)
        const relation = candidates.length === 1 ? candidates[0] : undefined
        const relationSource = relation?.evidenceRefs.every((ref) => {
          const evidence = inputs.relations.provenance.evidence.find((item) => item.id === ref)
          return evidence && sameRawSource(evidence.provenance, snapshotSource(inputs.scatterCrossbowInstanceRaw))
        })
        const semanticRelation = relation && inputs.relations.semantic.relations.filter((item) => item.projectionRef === relation.projectionRef)
        const relationReady = relation?.result === 'projected' && relationSource && semanticRelation?.length === 1
          && semanticRelation[0]?.sourceDomainId === scatterCrossbowFormalIdentity.assertion.domainId
        const targetRef = relationReady && relation.targetResolution.result === 'resolved' && 'targetEvidenceRef' in relation.targetResolution
          ? relation.targetResolution.targetEvidenceRef : undefined
        const target = targetRef ? inputs.relations.provenance.evidence.find((evidence) => evidence.id === targetRef) : undefined
        const targetReady = Boolean(relationReady && relation.targetResolution.result === 'resolved'
          && target && inputs.scatterCrossbowProjectileRaw && sameRawSource(target.provenance, snapshotSource(inputs.scatterCrossbowProjectileRaw)))
        const targetFields = targetReady ? readScatterTarget(inputs.scatterCrossbowProjectileRaw!) : undefined
        const fields = [
          [scatterCrossbowMappings.pushbackEnabled.id, 'configuredPushbackEnabled', targetFields?.pushbackEnabled],
          [scatterCrossbowMappings.pushbackStrength.id, 'configuredPushbackStrength', targetFields?.pushbackStrength],
          [scatterCrossbowMappings.ignoreFriendlyFire.id, 'configuredIgnoreFriendlyFire', targetFields?.ignoreFriendlyFire],
        ] as const
        for (const [mappingId, key, field] of fields) {
          if (!field) { dependencyUnavailable(accumulator, mappingId, occurrence,
            !relation ? 'relation-occurrence-missing-or-ambiguous' : relation.result === 'unavailable' ? 'relation-unavailable'
              : !relationReady ? 'relation-source-mismatch'
              : relation.targetResolution.result !== 'resolved' ? relation.targetResolution.reason ?? 'target-not-resolved'
                : !inputs.scatterCrossbowProjectileRaw ? 'target-snapshot-not-supplied' : 'target-snapshot-mismatch',
            relation?.projectionRef); continue }
          const value = addProjection<number | boolean>(accumulator, mappingId, occurrence, field, undefined, relation!.projectionRef)
          if (value) Object.assign(semantic, { [key]: value })
        }
        return semantic
      })
    }
  }
  return { schemaVersion: 1, artifactKind: 'formal-domain-value-availability',
    semantic: { fightersBindings: fightersSemantic, scatterCrossbow: scatterSemantic },
    valueProjections: accumulator.records, provenance: { evidence: accumulator.evidence } }
}

type SemanticOccurrence = {
  mappingId: string
  occurrence: ValueOccurrence
  value: SourceBackedValue<unknown>
}

function collectSemanticOccurrences(semantic: FormalValueAvailabilityArtifact['semantic']): SemanticOccurrence[] {
  const values: SemanticOccurrence[] = []
  const add = (mappingId: string, occurrence: ValueOccurrence, value: SourceBackedValue<unknown> | undefined) => {
    if (value) values.push({ mappingId, occurrence, value })
  }
  add(fightersBindingsMappings.entries.id, { slice: 'fighters-bindings', scope: 'configured-attacks' }, semantic.fightersBindings.configuredAttacks)
  for (const attack of semantic.fightersBindings.attacks ?? []) {
    const occurrence: FighterValueOccurrence = { slice: 'fighters-bindings', sourceIndex: attack.sourceIndex }
    add(fightersBindingsMappings.damage.id, occurrence, attack.configuredDamage)
    add(fightersBindingsMappings.duration.id, occurrence, attack.configuredAnimationDurationSeconds)
  }
  add(scatterCrossbowMappings.velocityFactor.id, { slice: 'scatter-crossbow', scope: 'weapon' }, semantic.scatterCrossbow.configuredProjectileVelocityFactor)
  add(scatterCrossbowMappings.definitions.id, { slice: 'scatter-crossbow', scope: 'projectile-definitions' }, semantic.scatterCrossbow.configuredProjectileDefinitions)
  for (const definition of semantic.scatterCrossbow.projectileDefinitions ?? []) {
    const occurrence: ScatterValueOccurrence = { slice: 'scatter-crossbow', sourceIndex: definition.sourceIndex }
    add(scatterCrossbowMappings.projectileCount.id, occurrence, definition.configuredProjectileCount)
    add(scatterCrossbowMappings.angleSpan.id, occurrence, definition.configuredAngleSpan)
    add(scatterCrossbowMappings.delayPerProjectile.id, occurrence, definition.configuredDelaySecondsPerProjectile)
    add(scatterCrossbowMappings.pushbackEnabled.id, occurrence, definition.configuredPushbackEnabled)
    add(scatterCrossbowMappings.pushbackStrength.id, occurrence, definition.configuredPushbackStrength)
    add(scatterCrossbowMappings.ignoreFriendlyFire.id, occurrence, definition.configuredIgnoreFriendlyFire)
  }
  return values
}

export function collectFormalValueAvailabilityErrors(value: FormalValueAvailabilityArtifact): string[] {
  const errors: string[] = []
  const check = (condition: boolean, message: string) => { if (!condition) errors.push(message) }
  check(value.schemaVersion === 1 && value.artifactKind === 'formal-domain-value-availability', 'invalid Formal Value artifact header')
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
    const key = `${record.mappingId}|${occurrenceKey(record.occurrence)}`
    check(!byOccurrence.has(key), `duplicate (mappingId, occurrence): ${key}`)
    if (!byOccurrence.has(key)) byOccurrence.set(key, record)
    check(!byProjectionId.has(record.projectionId), `duplicate projectionId: ${record.projectionId}`)
    if (!byProjectionId.has(record.projectionId)) byProjectionId.set(record.projectionId, record)
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
    const key = `${semantic.mappingId}|${occurrenceKey(semantic.occurrence)}`
    semanticCounts.set(semantic.value.projectionRef, (semanticCounts.get(semantic.value.projectionRef) ?? 0) + 1)
    const record = byProjectionId.get(semantic.value.projectionRef)
    check(Boolean(record), `${key}: missing required projection record`)
    if (!record) continue
    check(record.result === 'projected', `${key}: semantic value points to unavailable record`)
    check(record.mappingId === semantic.mappingId && canonicalJson(record.occurrence) === canonicalJson(semantic.occurrence), `${key}: semantic location differs from projection record`)
    check(canonicalJson(record.evidenceRefs) === canonicalJson(semantic.value.evidenceRefs), `${key}: semantic/projection EvidenceRef mismatch`)
    check(record.relationProjectionRef === semantic.value.relationProjectionRef, `${key}: relation projection link mismatch`)
  }
  const requireChildCoverage = (mappingIds: readonly string[], occurrence: ValueOccurrence, label: string) => {
    for (const mappingId of mappingIds) {
      const key = `${mappingId}|${occurrenceKey(occurrence)}`
      check(byOccurrence.has(key), `${label}: missing required child projection record ${key}`)
    }
  }
  const fighterIndices = value.semantic.fightersBindings.configuredAttacks?.value
  if (fighterIndices) {
    const entryIndices = value.semantic.fightersBindings.attacks?.map(({ sourceIndex }) => sourceIndex)
    check(canonicalJson(entryIndices) === canonicalJson(fighterIndices), 'fighters-bindings: child occurrence order/membership differs from projected collection')
    check(fighterIndices.every(Number.isInteger) && new Set(fighterIndices).size === fighterIndices.length, 'fighters-bindings: projected collection has ambiguous sourceIndex values')
    for (const sourceIndex of fighterIndices) requireChildCoverage(
      [fightersBindingsMappings.damage.id, fightersBindingsMappings.duration.id],
      { slice: 'fighters-bindings', sourceIndex },
      'fighters-bindings',
    )
  } else {
    check(value.semantic.fightersBindings.attacks === undefined, 'fighters-bindings: children exist without a projected parent collection')
    check(!value.valueProjections.some(({ occurrence }) => occurrence.slice === 'fighters-bindings' && 'sourceIndex' in occurrence), 'fighters-bindings: child records exist before parent enumeration')
  }
  const scatterIndices = value.semantic.scatterCrossbow.configuredProjectileDefinitions?.value
  if (scatterIndices) {
    const entryIndices = value.semantic.scatterCrossbow.projectileDefinitions?.map(({ sourceIndex }) => sourceIndex)
    check(canonicalJson(entryIndices) === canonicalJson(scatterIndices), 'scatter-crossbow: child occurrence order/membership differs from projected collection')
    check(scatterIndices.every((index) => Number.isInteger(index) && index >= 0) && new Set(scatterIndices).size === scatterIndices.length, 'scatter-crossbow: projected collection has ambiguous sourceIndex values')
    for (const sourceIndex of scatterIndices) requireChildCoverage(
      [
        scatterCrossbowMappings.projectileCount.id,
        scatterCrossbowMappings.angleSpan.id,
        scatterCrossbowMappings.delayPerProjectile.id,
        scatterCrossbowMappings.pushbackEnabled.id,
        scatterCrossbowMappings.pushbackStrength.id,
        scatterCrossbowMappings.ignoreFriendlyFire.id,
      ],
      { slice: 'scatter-crossbow', sourceIndex },
      'scatter-crossbow',
    )
  } else {
    check(value.semantic.scatterCrossbow.projectileDefinitions === undefined, 'scatter-crossbow: children exist without a projected parent collection')
    check(!value.valueProjections.some(({ occurrence }) => occurrence.slice === 'scatter-crossbow' && 'sourceIndex' in occurrence), 'scatter-crossbow: child records exist before parent enumeration')
  }
  for (const record of value.valueProjections) {
    const count = semanticCounts.get(record.projectionId) ?? 0
    if (record.result === 'projected') check(count === 1, `${record.projectionId}: projected record must have exactly one semantic value occurrence; found ${count}`)
    else check(count === 0, `${record.projectionId}: unavailable record must not have a semantic value`)
  }
  return errors
}

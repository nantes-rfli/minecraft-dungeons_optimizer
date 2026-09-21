import type { RawPackageSnapshot } from '../../../scripts/game-data-raw-package.ts'
import { projectFightersBindings, fightersBindingsMappings } from '../temporary/fightersBindings.ts'
import { projectScatterCrossbow, scatterCrossbowMappings } from '../temporary/scatterCrossbow.ts'
import type { Field, RawTrace, Trace, UnavailableState } from '../temporary/projectionPrimitives.ts'
import { evidenceFingerprint } from './identityEvidence.ts'

export type ProjectionRef = string
export type NonEmptyArray<T> = [T, ...T[]]

export type SourceBackedValue<T> = {
  value: T
  projectionRef: ProjectionRef
  evidenceRefs: NonEmptyArray<string>
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
  evidenceRefs: NonEmptyArray<string>
} & (
  | { result: 'projected' }
  | { result: 'unavailable'; sourceState: UnavailableState; reason: string }
)

export type ValueEvidenceRecord = {
  id: string
  fingerprint: string
  kind: 'raw-value-observation'
  mappingId: string
  occurrence: ValueOccurrence
  sourceState: 'known' | UnavailableState
  reason?: string
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
  scatterCrossbowProjectileRaw: RawPackageSnapshot
}

type ProjectionAccumulator = {
  records: ValueProjectionRecord[]
  evidence: ValueEvidenceRecord[]
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

function addProjection<T>(
  accumulator: ProjectionAccumulator,
  mappingId: string,
  occurrence: ValueOccurrence,
  field: Field<T>,
): SourceBackedValue<T> | undefined {
  const projectionId = valueProjectionRef(mappingId, occurrence)
  const evidenceId = `evidence:value:${projectionId}`
  const evidenceContent = {
    id: evidenceId,
    kind: 'raw-value-observation' as const,
    mappingId,
    occurrence,
    sourceState: field.state,
    ...(field.state === 'known' ? {} : { reason: field.reason }),
    provenance: field.trace.raw,
  }
  accumulator.evidence.push({ ...evidenceContent, fingerprint: evidenceFingerprint(evidenceContent) })
  const evidenceRefs: NonEmptyArray<string> = [evidenceId]
  if (field.state === 'known') {
    accumulator.records.push({ projectionId, mappingId, occurrence, result: 'projected', evidenceRefs })
    return { value: field.value, projectionRef: projectionId, evidenceRefs }
  }
  accumulator.records.push({ projectionId, mappingId, occurrence, result: 'unavailable', sourceState: field.state, reason: field.reason, evidenceRefs })
}

function dependencyUnavailable(
  accumulator: ProjectionAccumulator,
  mappingId: string,
  occurrence: ScatterValueOccurrence,
  dependency: { state: UnavailableState; reason: string; trace: Trace },
): void {
  addProjection(accumulator, mappingId, occurrence, {
    state: dependency.state,
    reason: `Dependency/reference failure: ${dependency.reason}`,
    trace: { ...dependency.trace, mappingId },
  })
}

function validSourceIndices(entries: readonly { sourceIndex: number }[]):
  | { state: 'known'; value: number[] }
  | { state: 'unavailable'; reason: string } {
  const indices = entries.map(({ sourceIndex }) => sourceIndex)
  if (indices.some((index) => !Number.isInteger(index))) return { state: 'unavailable', reason: 'Collection entry sourceIndex is missing or invalid' }
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
  const fighters = projectFightersBindings(inputs.fightersBindingsRaw)
  const scatter = projectScatterCrossbow(inputs.scatterCrossbowInstanceRaw, inputs.scatterCrossbowProjectileRaw)
  const fightersSemantic: FormalFightersBindingsValues = {}
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

  const scatterSemantic: FormalScatterCrossbowValues = {}
  const weaponOccurrence: ScatterValueOccurrence = { slice: 'scatter-crossbow', scope: 'weapon' }
  const velocity = addProjection(
    accumulator,
    scatterCrossbowMappings.velocityFactor.id,
    weaponOccurrence,
    scatter.configuredProjectileVelocityFactor,
  )
  if (velocity) scatterSemantic.configuredProjectileVelocityFactor = velocity
  const definitionsOccurrence: ScatterValueOccurrence = { slice: 'scatter-crossbow', scope: 'projectile-definitions' }
  const definitions = collectionField(scatter.configuredProjectileDefinitions)
  const configuredDefinitions = addProjection(
    accumulator,
    scatterCrossbowMappings.definitions.id,
    definitionsOccurrence,
    definitions,
  )
  if (configuredDefinitions) scatterSemantic.configuredProjectileDefinitions = configuredDefinitions
  if (definitions.state === 'known' && scatter.configuredProjectileDefinitions.state === 'known') {
    scatterSemantic.projectileDefinitions = scatter.configuredProjectileDefinitions.value.map((entry) => {
      const occurrence: ScatterValueOccurrence = { slice: 'scatter-crossbow', sourceIndex: entry.sourceIndex }
      const semantic: NonNullable<FormalScatterCrossbowValues['projectileDefinitions']>[number] = { sourceIndex: entry.sourceIndex }
      const count = addProjection(accumulator, scatterCrossbowMappings.projectileCount.id, occurrence, entry.configuredProjectileCount)
      const angle = addProjection(accumulator, scatterCrossbowMappings.angleSpan.id, occurrence, entry.configuredAngleSpan)
      const delay = addProjection(accumulator, scatterCrossbowMappings.delayPerProjectile.id, occurrence, entry.configuredDelaySecondsPerProjectile)
      if (count) semantic.configuredProjectileCount = count
      if (angle) semantic.configuredAngleSpan = angle
      if (delay) semantic.configuredDelaySecondsPerProjectile = delay
      if (entry.projectile.reference.state !== 'known') {
        for (const mappingId of [
          scatterCrossbowMappings.pushbackEnabled.id,
          scatterCrossbowMappings.pushbackStrength.id,
          scatterCrossbowMappings.ignoreFriendlyFire.id,
        ]) dependencyUnavailable(accumulator, mappingId, occurrence, entry.projectile.reference)
      } else if (entry.projectile.configuration) {
        const pushbackEnabled = addProjection(accumulator, scatterCrossbowMappings.pushbackEnabled.id, occurrence, entry.projectile.configuration.configuredPushbackEnabled)
        const pushbackStrength = addProjection(accumulator, scatterCrossbowMappings.pushbackStrength.id, occurrence, entry.projectile.configuration.configuredPushbackStrength)
        const ignoreFriendlyFire = addProjection(accumulator, scatterCrossbowMappings.ignoreFriendlyFire.id, occurrence, entry.projectile.configuration.configuredIgnoreFriendlyFire)
        if (pushbackEnabled) semantic.configuredPushbackEnabled = pushbackEnabled
        if (pushbackStrength) semantic.configuredPushbackStrength = pushbackStrength
        if (ignoreFriendlyFire) semantic.configuredIgnoreFriendlyFire = ignoreFriendlyFire
      }
      return semantic
    })
  }
  return {
    schemaVersion: 1,
    artifactKind: 'formal-domain-value-availability',
    semantic: { fightersBindings: fightersSemantic, scatterCrossbow: scatterSemantic },
    valueProjections: accumulator.records,
    provenance: { evidence: accumulator.evidence },
  }
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
    check(record.evidenceRefs.length > 0, `${record.projectionId}: empty evidenceRefs`)
    for (const ref of record.evidenceRefs) {
      const found = evidence.get(ref)
      check(Boolean(found), `${record.projectionId}: dangling EvidenceRef ${ref}`)
      if (found) {
        check(found.mappingId === record.mappingId && canonicalJson(found.occurrence) === canonicalJson(record.occurrence), `${record.projectionId}: evidence addresses another semantic location`)
        check(found.sourceState === (record.result === 'projected' ? 'known' : record.sourceState), `${record.projectionId}: evidence source state mismatch`)
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
    check(scatterIndices.every(Number.isInteger) && new Set(scatterIndices).size === scatterIndices.length, 'scatter-crossbow: projected collection has ambiguous sourceIndex values')
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

import { buildFormalSerializedRelationArtifact } from '../src/domain/formal/serializedRelation.ts'
import { fightersBindingsFormalIdentity, scatterCrossbowFormalIdentity, battleRobeFormalIdentity, deathCapMushroomFormalIdentity } from '../src/domain/formal/identityDefinitions.ts'
import { projectFormalIdentity, type RawObservationEvidenceRecord } from '../src/domain/formal/identityEvidence.ts'
import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  buildFormalValueAvailabilityArtifact,
  collectFormalValueAvailabilityErrors,
  valueProjectionRef,
  type FormalValueAvailabilityArtifact,
} from '../src/domain/formal/valueAvailability.ts'
import { fightersBindingsMappings } from '../src/domain/temporary/fightersBindings.ts'
import { fightersBindingsIdentity } from '../src/domain/temporary/fightersBindingsIdentity.ts'
import { scatterValueMappings } from '../src/domain/formal/scatterValueMappings.ts'
import { scatterCrossbowIdentity } from '../src/domain/temporary/scatterCrossbowIdentity.ts'

const read = (path: string) => fs.readFileSync(`research/raw/packages/${path}.raw.json`, 'utf8')
const fightersText = read(fightersBindingsIdentity.packagePath)
const scatterInstanceText = read(scatterCrossbowIdentity.instancePackagePath)
const scatterProjectileText = read(scatterCrossbowIdentity.projectilePackagePath)
const fixtures = () => ({
  fightersBindingsRaw: JSON.parse(fightersText),
  scatterCrossbowInstanceRaw: JSON.parse(scatterInstanceText),
  scatterCrossbowProjectileRaw: JSON.parse(scatterProjectileText),
})
const build = (input = fixtures(), mutate?: (inputs: Parameters<typeof buildFormalValueAvailabilityArtifact>[0]) => void) => {
  const identity = (raw: typeof input.fightersBindingsRaw, definition: typeof fightersBindingsFormalIdentity) => {
    const projected = projectFormalIdentity(raw, definition)
    return { source: raw, identity: projected.semantic, identityEvidence: projected.evidence.filter((record): record is RawObservationEvidenceRecord => record.kind === 'raw-observation') }
  }
  const fighters = identity(input.fightersBindingsRaw, fightersBindingsFormalIdentity)
  const scatter = identity(input.scatterCrossbowInstanceRaw, scatterCrossbowFormalIdentity)
  const readRaw = (path: string) => JSON.parse(read(path))
  const relations = buildFormalSerializedRelationArtifact({ scatter: { ...scatter, target: input.scatterCrossbowProjectileRaw },
    battleRobe: identity(readRaw(battleRobeFormalIdentity.assertion.applicationScope.packagePath), battleRobeFormalIdentity),
    deathCapMushroom: identity(readRaw(deathCapMushroomFormalIdentity.assertion.applicationScope.packagePath), deathCapMushroomFormalIdentity) })
  const valueInputs = { ...input, fightersBindingsIdentity: fighters.identity, fightersBindingsIdentityEvidence: fighters.identityEvidence,
    scatterCrossbowIdentity: scatter.identity, scatterCrossbowIdentityEvidence: scatter.identityEvidence, relations }
  mutate?.(valueInputs)
  return buildFormalValueAvailabilityArtifact(valueInputs)
}
const clone = (artifact: FormalValueAvailabilityArtifact): FormalValueAvailabilityArtifact => structuredClone(artifact)
const fighterElements = (input: ReturnType<typeof fixtures>) => input.fightersBindingsRaw.package.objects[1].properties[0].decoding.elements
const fighterDamage = (input: ReturnType<typeof fixtures>, position = 0) => fighterElements(input)[position].properties.find((node: { name: { value: string } }) => node.name.value === 'Damage')
const scatterDefinitionNode = (input: ReturnType<typeof fixtures>) => input.scatterCrossbowInstanceRaw.package.objects[1].properties[0].decoding.properties[1]
const scatterDefinitionProperties = (input: ReturnType<typeof fixtures>) => scatterDefinitionNode(input).decoding.elements[0].properties
const scatterReference = (input: ReturnType<typeof fixtures>) => scatterDefinitionProperties(input).find((node: { name: { value: string } }) => node.name.value === 'Projectile')
const dependencyRecord = (artifact: FormalValueAvailabilityArtifact) => {
  const record = artifact.valueProjections.find(({ mappingId, occurrence }) => (
    mappingId === scatterValueMappings.pushbackEnabled.id && 'sourceIndex' in occurrence && occurrence.sourceIndex === 0
  ))
  if (!record || record.result !== 'unavailable') throw new Error('missing dependency failure record')
  return record
}

describe('Formal Value / Availability v1 projection', () => {
  it('projects only the specified source-backed semantic values with resolvable evidence', () => {
    const artifact = build()
    expect(collectFormalValueAvailabilityErrors(artifact)).toEqual([])
    expect(artifact.semantic.fightersBindings.configuredAttacks?.value).toEqual([0, 1, 2, 3])
    expect(artifact.semantic.fightersBindings.attacks?.map(({ configuredDamage }) => configuredDamage?.value)).toEqual([25, 25, 25, 25])
    expect(artifact.semantic.scatterCrossbow.configuredProjectileVelocityFactor?.value).toBe(1.100000023841858)
    expect(artifact.semantic.scatterCrossbow.configuredProjectileDefinitions?.value).toEqual([0])
    expect(artifact.semantic.scatterCrossbow.projectileDefinitions?.[0]).toMatchObject({
      configuredProjectileCount: { value: 3 },
      configuredAngleSpan: { value: 20 },
      configuredDelaySecondsPerProjectile: { value: 0.029999999329447746 },
      configuredPushbackEnabled: { value: true },
      configuredPushbackStrength: { value: 0.6000000238418579 },
      configuredIgnoreFriendlyFire: { value: true },
    })
    const serialized = JSON.stringify(artifact)
    expect(serialized).not.toContain('battle-robe')
    expect(serialized).not.toContain('death-cap-mushroom')
    expect(serialized).not.toContain('effectiveUptime')
  })

  it('keeps partial child failure at its sourceIndex without compacting successful entries', () => {
    const input = fixtures()
    fighterDamage(input, 1).decoding = { state: 'parse-failed' }
    const artifact = build(input)
    expect(artifact.semantic.fightersBindings.configuredAttacks?.value).toEqual([0, 1, 2, 3])
    expect(artifact.semantic.fightersBindings.attacks?.map(({ sourceIndex }) => sourceIndex)).toEqual([0, 1, 2, 3])
    expect(artifact.semantic.fightersBindings.attacks?.[1]).not.toHaveProperty('configuredDamage')
    expect(artifact.valueProjections).toContainEqual(expect.objectContaining({
      mappingId: fightersBindingsMappings.damage.id,
      occurrence: { slice: 'fighters-bindings', sourceIndex: 1 },
      result: 'unavailable',
      sourceState: 'parse-failed',
    }))
    expect(collectFormalValueAvailabilityErrors(artifact)).toEqual([])
  })

  it('does not enumerate children when a parent collection fails', () => {
    const input = fixtures()
    input.fightersBindingsRaw.package.objects[1].properties[0].decoding = { state: 'not-extracted' }
    const artifact = build(input)
    expect(artifact.semantic.fightersBindings).toEqual({})
    expect(artifact.valueProjections.filter(({ occurrence }) => occurrence.slice === 'fighters-bindings')).toHaveLength(1)
    expect(artifact.valueProjections[0]).toMatchObject({ result: 'unavailable', sourceState: 'not-extracted' })
  })

  it('treats a decoded empty collection as a projected empty semantic value with no children', () => {
    const input = fixtures()
    input.fightersBindingsRaw.package.objects[1].properties[0].decoding.elements = []
    const artifact = build(input)
    expect(artifact.semantic.fightersBindings.configuredAttacks?.value).toEqual([])
    expect(artifact.semantic.fightersBindings.attacks).toEqual([])
    expect(artifact.valueProjections.filter(({ occurrence }) => occurrence.slice === 'fighters-bindings')).toHaveLength(1)
    expect(collectFormalValueAvailabilityErrors(artifact)).toEqual([])
  })

  it('preserves known zero and false by source state rather than truthiness', () => {
    const input = fixtures()
    fighterDamage(input).decoding.value = 0
    scatterDefinitionProperties(input).find((node: { name: { value: string } }) => node.name.value === 'NumberOfProjectiles').decoding.value = 0
    input.scatterCrossbowProjectileRaw.package.objects[2].properties[3].decoding.properties[0].decoding.value = false
    input.scatterCrossbowProjectileRaw.package.objects[2].properties[5].decoding.value = false
    const artifact = build(input)
    expect(artifact.semantic.fightersBindings.attacks?.[0]?.configuredDamage?.value).toBe(0)
    expect(artifact.semantic.scatterCrossbow.projectileDefinitions?.[0]).toMatchObject({
      configuredProjectileCount: { value: 0 },
      configuredPushbackEnabled: { value: false },
      configuredIgnoreFriendlyFire: { value: false },
    })
  })

  it.each(['missing', 'duplicate'])('makes %s sourceIndex ambiguous and never substitutes array position', (kind) => {
    const input = fixtures()
    const elements = fighterElements(input)
    if (kind === 'missing') delete elements[1].index
    else elements[1].index = elements[0].index
    const artifact = build(input)
    expect(artifact.semantic.fightersBindings).toEqual({})
    expect(artifact.valueProjections.filter(({ occurrence }) => occurrence.slice === 'fighters-bindings')).toHaveLength(1)
    expect(artifact.valueProjections[0]).toMatchObject({ result: 'unavailable', sourceState: 'unknown' })
  })

  it('uses preserved sourceIndex identity when output order changes', () => {
    const input = fixtures()
    fighterElements(input).reverse()
    const artifact = build(input)
    expect(artifact.semantic.fightersBindings.configuredAttacks?.value).toEqual([3, 2, 1, 0])
    expect(artifact.semantic.fightersBindings.attacks?.map(({ sourceIndex }) => sourceIndex)).toEqual([3, 2, 1, 0])
    expect(artifact.semantic.fightersBindings.attacks?.[0]?.configuredDamage?.projectionRef).toBe(
      valueProjectionRef(fightersBindingsMappings.damage.id, { slice: 'fighters-bindings', sourceIndex: 3 }),
    )
  })

  it('records relation dependency failure without Value Raw evidence', () => {
    const input = fixtures()
    scatterReference(input).decoding.value.kind = 'export'
    const artifact = build(input)
    const record = dependencyRecord(artifact)
    expect(record).toMatchObject({ failureKind: 'dependency', reason: 'relation-unavailable' })
    expect(record.evidenceRefs).toBeUndefined()
    expect(record.relationProjectionRef).toContain('relation:scatter-crossbow')
    expect(collectFormalValueAvailabilityErrors(artifact)).toEqual([])
  })

  it('keeps source-side values when target resolution fails', () => {
    const input = fixtures()
    input.scatterCrossbowProjectileRaw.dataset.id = 'different-dataset'
    const artifact = build(input)
    expect(artifact.semantic.scatterCrossbow.projectileDefinitions?.[0]?.configuredProjectileCount?.value).toBe(3)
    expect(dependencyRecord(artifact)).toMatchObject({ failureKind: 'dependency', reason: 'target-snapshot-mismatch' })
    expect(collectFormalValueAvailabilityErrors(artifact)).toEqual([])
  })

  it('shares Raw projectile field EvidenceRefs across distinct definition ProjectionRefs', () => {
    const input = fixtures()
    const definitions = scatterDefinitionNode(input).decoding.elements
    const second = structuredClone(definitions[0])
    definitions[0].index = 3
    second.index = 7
    definitions.push(second)
    const artifact = build(input)
    const projected = artifact.semantic.scatterCrossbow.projectileDefinitions!
    expect(projected.map(({ sourceIndex }) => sourceIndex)).toEqual([3, 7])
    for (const field of ['configuredPushbackEnabled', 'configuredPushbackStrength', 'configuredIgnoreFriendlyFire'] as const) {
      expect(projected[0]![field]!.projectionRef).not.toBe(projected[1]![field]!.projectionRef)
      expect(projected[0]![field]!.evidenceRefs).toEqual(projected[1]![field]!.evidenceRefs)
    }
    expect(collectFormalValueAvailabilityErrors(artifact)).toEqual([])
  })

  it('does not infer Scatter children when definition enumeration fails', () => {
    const input = fixtures()
    scatterDefinitionNode(input).decoding = { state: 'parse-failed' }
    const artifact = build(input)
    expect(artifact.semantic.scatterCrossbow).not.toHaveProperty('configuredProjectileDefinitions')
    expect(artifact.semantic.scatterCrossbow).not.toHaveProperty('projectileDefinitions')
    expect(artifact.valueProjections.filter(({ occurrence }) => occurrence.slice === 'scatter-crossbow' && 'sourceIndex' in occurrence)).toEqual([])
  })

  it.each(['missing', 'negative', 'duplicate'])('rejects %s Scatter sourceIndex for the whole parent', (kind) => {
    const input = fixtures()
    const elements = scatterDefinitionNode(input).decoding.elements
    const second = structuredClone(elements[0])
    elements.push(second)
    if (kind === 'missing') delete second.index
    else if (kind === 'negative') second.index = -1
    const artifact = build(input)
    expect(artifact.semantic.scatterCrossbow.configuredProjectileDefinitions).toBeUndefined()
    expect(artifact.semantic.scatterCrossbow.projectileDefinitions).toBeUndefined()
    expect(artifact.valueProjections.filter(({ occurrence }) => occurrence.slice === 'scatter-crossbow' && 'sourceIndex' in occurrence)).toEqual([])
  })

  it('keeps a decoded empty Scatter collection known with no children', () => {
    const input = fixtures()
    scatterDefinitionNode(input).decoding.elements = []
    const artifact = build(input)
    expect(artifact.semantic.scatterCrossbow.configuredProjectileDefinitions?.value).toEqual([])
    expect(artifact.semantic.scatterCrossbow.projectileDefinitions).toEqual([])
  })

  it('gates each slice on matched same-source Identity without presentation', () => {
    const noPresentation = build(fixtures(), (inputs) => { delete inputs.scatterCrossbowIdentity.presentation })
    expect(noPresentation.semantic.scatterCrossbow.configuredProjectileDefinitions?.value).toEqual([0])
    const wrongSource = build(fixtures(), (inputs) => { Object.assign(inputs.scatterCrossbowIdentityEvidence[0]!.provenance.packageHash!, { value: 'other' }) })
    expect(wrongSource.semantic.scatterCrossbow).toEqual({})
    expect(wrongSource.valueProjections.filter(({ occurrence }) => occurrence.slice === 'scatter-crossbow')).toEqual([])
    const unresolved = build(fixtures(), (inputs) => { inputs.fightersBindingsIdentity.resolution = {
      state: 'unresolved', assertionId: inputs.fightersBindingsIdentity.assertionId, evidenceRefs: inputs.fightersBindingsIdentity.resolution.evidenceRefs } })
    expect(unresolved.semantic.fightersBindings).toEqual({})
  })

  it('does not read target fields when Relation has no supplied target', () => {
    const artifact = build(fixtures(), (inputs) => { inputs.relations = buildFormalSerializedRelationArtifact({
      scatter: { source: inputs.scatterCrossbowInstanceRaw, identity: inputs.scatterCrossbowIdentity, identityEvidence: inputs.scatterCrossbowIdentityEvidence },
      battleRobe: { source: inputs.scatterCrossbowInstanceRaw, identity: inputs.scatterCrossbowIdentity, identityEvidence: inputs.scatterCrossbowIdentityEvidence },
      deathCapMushroom: { source: inputs.scatterCrossbowInstanceRaw, identity: inputs.scatterCrossbowIdentity, identityEvidence: inputs.scatterCrossbowIdentityEvidence },
    }) })
    expect(dependencyRecord(artifact)).toMatchObject({ failureKind: 'dependency', reason: 'target-snapshot-not-supplied' })
    expect(artifact.provenance.evidence.some(({ provenance }) => provenance.packagePath === scatterCrossbowIdentity.projectilePackagePath)).toBe(false)
  })

  it('keeps projection identity stable across value/result changes', () => {
    const known = build()
    const input = fixtures()
    fighterDamage(input).decoding = { state: 'parse-failed' }
    const unavailable = build(input)
    const findDamage = (artifact: FormalValueAvailabilityArtifact) => artifact.valueProjections.find(({ mappingId, occurrence }) => mappingId === fightersBindingsMappings.damage.id && 'sourceIndex' in occurrence && occurrence.sourceIndex === 0)
    expect(findDamage(known)?.result).toBe('projected')
    expect(findDamage(unavailable)?.result).toBe('unavailable')
    expect(findDamage(known)?.projectionId).toBe(findDamage(unavailable)?.projectionId)
  })
})

describe('Formal Value / Availability v1 integrity audit', () => {
  it('rejects duplicate occurrence records and the same occurrence with another projectionId', () => {
    const duplicate = clone(build())
    duplicate.valueProjections.push(structuredClone(duplicate.valueProjections[0]!))
    expect(collectFormalValueAvailabilityErrors(duplicate)).toContainEqual(expect.stringContaining('duplicate (mappingId, occurrence)'))
    const differentId = clone(build())
    const copy = structuredClone(differentId.valueProjections[0]!)
    copy.projectionId += ':other'
    differentId.valueProjections.push(copy)
    expect(collectFormalValueAvailabilityErrors(differentId)).toContainEqual(expect.stringContaining('duplicate (mappingId, occurrence)'))
  })

  it('rejects missing, wrong, unavailable, orphaned, or shared projection links', () => {
    const missing = clone(build())
    const ref = missing.semantic.fightersBindings.attacks![0]!.configuredDamage!.projectionRef
    missing.valueProjections = missing.valueProjections.filter(({ projectionId }) => projectionId !== ref)
    expect(collectFormalValueAvailabilityErrors(missing)).toContainEqual(expect.stringContaining('missing required projection record'))

    const wrong = clone(build())
    wrong.semantic.fightersBindings.attacks![0]!.configuredDamage!.projectionRef = wrong.semantic.fightersBindings.attacks![1]!.configuredDamage!.projectionRef
    expect(collectFormalValueAvailabilityErrors(wrong)).toContainEqual(expect.stringContaining('semantic location differs'))

    const unavailable = clone(build())
    const record = unavailable.valueProjections.find(({ projectionId }) => projectionId === unavailable.semantic.fightersBindings.attacks![0]!.configuredDamage!.projectionRef)!
    Object.assign(record, { result: 'unavailable', sourceState: 'unknown', reason: 'test' })
    expect(collectFormalValueAvailabilityErrors(unavailable)).toContainEqual(expect.stringContaining('semantic value points to unavailable'))

    const orphan = clone(build())
    delete orphan.semantic.fightersBindings.attacks![0]!.configuredDamage
    expect(collectFormalValueAvailabilityErrors(orphan)).toContainEqual(expect.stringContaining('projected record must have exactly one semantic value'))

    const shared = clone(build())
    shared.semantic.fightersBindings.attacks![1]!.configuredDamage = structuredClone(shared.semantic.fightersBindings.attacks![0]!.configuredDamage)
    expect(collectFormalValueAvailabilityErrors(shared)).toContainEqual(expect.stringContaining('found 2'))
  })

  it('rejects empty, dangling, and mismatched evidence references', () => {
    const empty = clone(build())
    empty.valueProjections[0]!.evidenceRefs = [] as never
    expect(collectFormalValueAvailabilityErrors(empty)).toContainEqual(expect.stringContaining('empty evidenceRefs'))

    const dangling = clone(build())
    dangling.valueProjections[0]!.evidenceRefs = ['evidence:missing']
    expect(collectFormalValueAvailabilityErrors(dangling)).toContainEqual(expect.stringContaining('dangling EvidenceRef'))

    const mismatch = clone(build())
    mismatch.semantic.fightersBindings.configuredAttacks!.evidenceRefs = [mismatch.valueProjections[1]!.evidenceRefs![0]]
    expect(collectFormalValueAvailabilityErrors(mismatch)).toContainEqual(expect.stringContaining('semantic/projection EvidenceRef mismatch'))
  })
})

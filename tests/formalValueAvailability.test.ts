import { battleRobeRelationDefinition, buildFormalSerializedRelationArtifact, deathCapMushroomRelationDefinition, scatterCrossbowRelationDefinition } from '../src/domain/formal/serializedRelation.ts'
import { fightersBindingsFormalIdentity, scatterCrossbowFormalIdentity, battleRobeFormalIdentity, deathCapMushroomFormalIdentity } from '../src/domain/formal/identityDefinitions.ts'
import { evidenceFingerprint, projectFormalIdentity, type RawObservationEvidenceRecord } from '../src/domain/formal/identityEvidence.ts'
import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  buildFormalValueAvailabilityArtifact,
  collectFormalValueAvailabilityErrors,
  valueProjectionRef,
  type FormalValueAvailabilityArtifact,
} from '../src/domain/formal/valueAvailability.ts'
import { fightersBindingsValueMappings } from '../src/domain/formal/fightersBindingsValueMappings.ts'
import { scatterValueMappings } from '../src/domain/formal/scatterValueMappings.ts'
import migrationBaseline from './fixtures/formal-value-v2-migration-baseline.json'

const read = (path: string) => fs.readFileSync(`research/raw/packages/${path}.raw.json`, 'utf8')
const fightersText = read(fightersBindingsFormalIdentity.assertion.applicationScope.packagePath)
const scatterInstanceText = read(scatterCrossbowFormalIdentity.assertion.applicationScope.packagePath)
const scatterProjectileText = read(scatterCrossbowRelationDefinition.targetRawPath)
const structuralPackagePaths = new Set([
  scatterCrossbowRelationDefinition.targetRawPath,
  battleRobeRelationDefinition.targetRawPath,
  deathCapMushroomRelationDefinition.targetRawPath,
])
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
  const relations = buildFormalSerializedRelationArtifact({ structuralPackagePaths, scatter: { ...scatter, target: input.scatterCrossbowProjectileRaw },
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

describe('Formal Value / Availability v2 projection', () => {
  it('uses the v2 category/domain semantic container and preserves migration identities', () => {
    const artifact = build()
    expect(artifact.schemaVersion).toBe(2)
    expect(Object.keys(artifact.semantic.melee)).toEqual(['fighters-bindings'])
    expect(Object.keys(artifact.semantic.ranged)).toEqual(['scatter-crossbow'])
    expect(artifact).not.toHaveProperty('semantic.fightersBindings')
    expect(artifact.valueProjections.map(({ projectionId }) => projectionId)).toEqual(expect.arrayContaining(migrationBaseline.projectionIds))
    expect([...new Set(artifact.valueProjections.map(({ mappingId }) => mappingId))]).toEqual(expect.arrayContaining(migrationBaseline.mappingIds))
    expect(artifact.provenance.evidence.map(({ id, fingerprint, provenance }) => ({ id, fingerprint, provenance })))
      .toEqual(expect.arrayContaining(migrationBaseline.evidence))
    expect(artifact.semantic.melee['fighters-bindings']!).toMatchObject(migrationBaseline.representativeSemantic.melee)
    expect(artifact.semantic.ranged['scatter-crossbow']!).toMatchObject(migrationBaseline.representativeSemantic.ranged)
  })

  it('projects only the specified source-backed semantic values with resolvable evidence', () => {
    const artifact = build()
    expect(collectFormalValueAvailabilityErrors(artifact)).toEqual([])
    expect(artifact.semantic.melee['fighters-bindings']!.configuredAttacks?.value).toEqual([0, 1, 2, 3])
    expect(artifact.semantic.melee['fighters-bindings']!.attacks?.map(({ configuredDamage }) => configuredDamage?.value)).toEqual([25, 25, 25, 25])
    expect(artifact.semantic.ranged['scatter-crossbow']!.configuredProjectileVelocityFactor?.value).toBe(1.100000023841858)
    expect(artifact.semantic.ranged['scatter-crossbow']!.configuredProjectileDefinitions?.value).toEqual([0])
    expect(artifact.semantic.ranged['scatter-crossbow']!.projectileDefinitions?.[0]).toMatchObject({
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
    expect(artifact.semantic.melee['fighters-bindings']!.configuredAttacks?.value).toEqual([0, 1, 2, 3])
    expect(artifact.semantic.melee['fighters-bindings']!.attacks?.map(({ sourceIndex }) => sourceIndex)).toEqual([0, 1, 2, 3])
    expect(artifact.semantic.melee['fighters-bindings']!.attacks?.[1]).not.toHaveProperty('configuredDamage')
    expect(artifact.valueProjections).toContainEqual(expect.objectContaining({
      mappingId: fightersBindingsValueMappings.damage.id,
      occurrence: { domainId: 'fighters-bindings', collectionRef: 'configured-attacks', sourceIndex: 1 },
      result: 'unavailable',
      sourceState: 'parse-failed',
    }))
    expect(collectFormalValueAvailabilityErrors(artifact)).toEqual([])
  })

  it('does not enumerate children when a parent collection fails', () => {
    const input = fixtures()
    input.fightersBindingsRaw.package.objects[1].properties[0].decoding = { state: 'not-extracted' }
    const artifact = build(input)
    expect(artifact.semantic.melee['fighters-bindings']!).toEqual({})
    expect(artifact.valueProjections.filter(({ occurrence }) => occurrence.domainId === 'fighters-bindings')).toHaveLength(1)
    expect(artifact.valueProjections[0]).toMatchObject({ result: 'unavailable', sourceState: 'not-extracted' })
  })

  it('treats a decoded empty collection as a projected empty semantic value with no children', () => {
    const input = fixtures()
    input.fightersBindingsRaw.package.objects[1].properties[0].decoding.elements = []
    const artifact = build(input)
    expect(artifact.semantic.melee['fighters-bindings']!.configuredAttacks?.value).toEqual([])
    expect(artifact.semantic.melee['fighters-bindings']!.attacks).toEqual([])
    expect(artifact.valueProjections.filter(({ occurrence }) => occurrence.domainId === 'fighters-bindings')).toHaveLength(1)
    expect(collectFormalValueAvailabilityErrors(artifact)).toEqual([])
  })

  it('preserves known zero and false by source state rather than truthiness', () => {
    const input = fixtures()
    fighterDamage(input).decoding.value = 0
    scatterDefinitionProperties(input).find((node: { name: { value: string } }) => node.name.value === 'NumberOfProjectiles').decoding.value = 0
    input.scatterCrossbowProjectileRaw.package.objects[2].properties[3].decoding.properties[0].decoding.value = false
    input.scatterCrossbowProjectileRaw.package.objects[2].properties[5].decoding.value = false
    const artifact = build(input)
    expect(artifact.semantic.melee['fighters-bindings']!.attacks?.[0]?.configuredDamage?.value).toBe(0)
    expect(artifact.semantic.ranged['scatter-crossbow']!.projectileDefinitions?.[0]).toMatchObject({
      configuredProjectileCount: { value: 0 },
      configuredPushbackEnabled: { value: false },
      configuredIgnoreFriendlyFire: { value: false },
    })
  })

  it.each(['missing', 'duplicate', 'type'])('keeps %s Fighter configured damage unavailable instead of substituting a value', (kind) => {
    const input = fixtures()
    const properties = fighterElements(input)[0].properties
    const index = properties.findIndex((node: { name: { value: string } }) => node.name.value === 'Damage')
    if (kind === 'missing') properties.splice(index, 1)
    if (kind === 'duplicate') properties.push(properties[index])
    if (kind === 'type') properties[index].type.value = 'IntProperty'
    const artifact = build(input)
    expect(artifact.semantic.melee['fighters-bindings']!.attacks?.[0]).not.toHaveProperty('configuredDamage')
    expect(artifact.valueProjections).toContainEqual(expect.objectContaining({
      mappingId: fightersBindingsValueMappings.damage.id,
      occurrence: { domainId: 'fighters-bindings', collectionRef: 'configured-attacks', sourceIndex: 0 },
      result: 'unavailable',
      sourceState: 'unknown',
    }))
    expect(collectFormalValueAvailabilityErrors(artifact)).toEqual([])
  })

  it.each(['missing', 'negative', 'duplicate'])('makes %s sourceIndex ambiguous and never substitutes array position', (kind) => {
    const input = fixtures()
    const elements = fighterElements(input)
    if (kind === 'missing') delete elements[1].index
    else if (kind === 'negative') elements[1].index = -1
    else elements[1].index = elements[0].index
    const artifact = build(input)
    expect(artifact.semantic.melee['fighters-bindings']!).toEqual({})
    expect(artifact.valueProjections.filter(({ occurrence }) => occurrence.domainId === 'fighters-bindings')).toHaveLength(1)
    expect(artifact.valueProjections[0]).toMatchObject({ result: 'unavailable', sourceState: 'unknown' })
  })

  it('uses preserved sourceIndex identity when output order changes', () => {
    const input = fixtures()
    fighterElements(input).reverse()
    const artifact = build(input)
    expect(artifact.semantic.melee['fighters-bindings']!.configuredAttacks?.value).toEqual([3, 2, 1, 0])
    expect(artifact.semantic.melee['fighters-bindings']!.attacks?.map(({ sourceIndex }) => sourceIndex)).toEqual([3, 2, 1, 0])
    expect(artifact.semantic.melee['fighters-bindings']!.attacks?.[0]?.configuredDamage?.projectionRef).toBe(
      valueProjectionRef(fightersBindingsValueMappings.damage.id, { domainId: 'fighters-bindings', collectionRef: 'configured-attacks', sourceIndex: 3 }),
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

  it.each(['empty-source-refs', 'duplicate-source-refs', 'missing-source-evidence', 'duplicate-source-evidence', 'missing-target-evidence', 'duplicate-target-evidence'] as const)(
    'fails closed on %s before projecting target-dependent values', (kind) => {
      const baseline = build()
      const artifact = build(fixtures(), (inputs) => {
        const relation = inputs.relations.relationProjections.find(({ occurrence }) => occurrence.domainId === 'scatter-crossbow')!
        if (relation.result !== 'projected' || relation.targetRawVerification.result !== 'resolved') throw new Error('resolved Scatter fixture missing')
        const sourceRef = relation.evidenceRefs[0]!
        const targetRef = relation.targetRawVerification.targetEvidenceRef
        if (kind === 'empty-source-refs') relation.evidenceRefs = []
        if (kind === 'duplicate-source-refs') relation.evidenceRefs.push(sourceRef)
        const ref = kind.includes('target') ? targetRef : sourceRef
        if (kind.includes('missing')) inputs.relations.provenance.evidence = inputs.relations.provenance.evidence.filter(({ id }) => id !== ref)
        if (kind.endsWith('-evidence') && kind.startsWith('duplicate')) {
          const evidence = inputs.relations.provenance.evidence.find(({ id }) => id === ref)!
          const conflict = structuredClone(evidence)
          conflict.provenance.packageHash = { ...conflict.provenance.packageHash, value: 'conflicting-snapshot' }
          inputs.relations.provenance.evidence.push(conflict)
        }
      })
      const targetMappings = [scatterValueMappings.pushbackEnabled.id, scatterValueMappings.pushbackStrength.id, scatterValueMappings.ignoreFriendlyFire.id]
      const targetRecords = artifact.valueProjections.filter(({ mappingId }) => targetMappings.includes(mappingId as typeof targetMappings[number]))
      expect(targetRecords).toHaveLength(3)
      for (const record of targetRecords) {
        expect(record).toMatchObject({ result: 'unavailable', failureKind: 'dependency', reason: kind.includes('target') ? 'target-snapshot-mismatch' : 'relation-source-mismatch' })
        expect(record.evidenceRefs).toBeUndefined()
      }
      const child = artifact.semantic.ranged['scatter-crossbow']!.projectileDefinitions![0]!
      for (const field of ['configuredPushbackEnabled', 'configuredPushbackStrength', 'configuredIgnoreFriendlyFire']) expect(child).not.toHaveProperty(field)
      expect(artifact.valueProjections.filter(({ mappingId }) => !targetMappings.includes(mappingId as typeof targetMappings[number])))
        .toEqual(baseline.valueProjections.filter(({ mappingId }) => !targetMappings.includes(mappingId as typeof targetMappings[number])))
      expect(artifact.semantic.melee).toEqual(baseline.semantic.melee)
      expect(collectFormalValueAvailabilityErrors(artifact)).toEqual([])
    },
  )

  it('keeps source-side values when target resolution fails', () => {
    const input = fixtures()
    input.scatterCrossbowProjectileRaw.dataset.id = 'different-dataset'
    const artifact = build(input)
    expect(artifact.semantic.ranged['scatter-crossbow']!.projectileDefinitions?.[0]?.configuredProjectileCount?.value).toBe(3)
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
    const projected = artifact.semantic.ranged['scatter-crossbow']!.projectileDefinitions!
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
    expect(artifact.semantic.ranged['scatter-crossbow']!).not.toHaveProperty('configuredProjectileDefinitions')
    expect(artifact.semantic.ranged['scatter-crossbow']!).not.toHaveProperty('projectileDefinitions')
    expect(artifact.valueProjections.filter(({ occurrence }) => occurrence.domainId === 'scatter-crossbow' && 'sourceIndex' in occurrence)).toEqual([])
  })

  it.each(['missing', 'negative', 'duplicate'])('rejects %s Scatter sourceIndex for the whole parent', (kind) => {
    const input = fixtures()
    const elements = scatterDefinitionNode(input).decoding.elements
    const second = structuredClone(elements[0])
    elements.push(second)
    if (kind === 'missing') delete second.index
    else if (kind === 'negative') second.index = -1
    const artifact = build(input)
    expect(artifact.semantic.ranged['scatter-crossbow']!.configuredProjectileDefinitions).toBeUndefined()
    expect(artifact.semantic.ranged['scatter-crossbow']!.projectileDefinitions).toBeUndefined()
    expect(artifact.valueProjections.filter(({ occurrence }) => occurrence.domainId === 'scatter-crossbow' && 'sourceIndex' in occurrence)).toEqual([])
  })

  it('keeps a decoded empty Scatter collection known with no children', () => {
    const input = fixtures()
    scatterDefinitionNode(input).decoding.elements = []
    const artifact = build(input)
    expect(artifact.semantic.ranged['scatter-crossbow']!.configuredProjectileDefinitions?.value).toEqual([])
    expect(artifact.semantic.ranged['scatter-crossbow']!.projectileDefinitions).toEqual([])
  })

  it('allows provisional matched identity and gates each domain on matched same-source Identity without presentation', () => {
    expect(fightersBindingsFormalIdentity.assertion.reviewState).toBe('provisional')
    expect(build().semantic.melee['fighters-bindings']!.configuredAttacks?.value).toEqual([0, 1, 2, 3])
    const noPresentation = build(fixtures(), (inputs) => { delete inputs.scatterCrossbowIdentity.presentation })
    expect(noPresentation.semantic.ranged['scatter-crossbow']!.configuredProjectileDefinitions?.value).toEqual([0])
    const wrongSource = build(fixtures(), (inputs) => { Object.assign(inputs.scatterCrossbowIdentityEvidence[0]!.provenance.packageHash!, { value: 'other' }) })
    expect(wrongSource.semantic.ranged['scatter-crossbow']!).toBeUndefined()
    expect(wrongSource.valueProjections.filter(({ occurrence }) => occurrence.domainId === 'scatter-crossbow')).toEqual([])
    const unresolved = build(fixtures(), (inputs) => { inputs.fightersBindingsIdentity.resolution = {
      state: 'unresolved', assertionId: inputs.fightersBindingsIdentity.assertionId, evidenceRefs: inputs.fightersBindingsIdentity.resolution.evidenceRefs } })
    expect(unresolved.semantic.melee['fighters-bindings']!).toBeUndefined()
  })

  it('does not read target fields when Relation has no supplied target', () => {
    const artifact = build(fixtures(), (inputs) => { inputs.relations = buildFormalSerializedRelationArtifact({
      structuralPackagePaths,
      scatter: { source: inputs.scatterCrossbowInstanceRaw, identity: inputs.scatterCrossbowIdentity, identityEvidence: inputs.scatterCrossbowIdentityEvidence },
      battleRobe: { source: inputs.scatterCrossbowInstanceRaw, identity: inputs.scatterCrossbowIdentity, identityEvidence: inputs.scatterCrossbowIdentityEvidence },
      deathCapMushroom: { source: inputs.scatterCrossbowInstanceRaw, identity: inputs.scatterCrossbowIdentity, identityEvidence: inputs.scatterCrossbowIdentityEvidence },
    }) })
    expect(dependencyRecord(artifact)).toMatchObject({ failureKind: 'dependency', reason: 'target-snapshot-not-supplied' })
    expect(artifact.provenance.evidence.some(({ provenance }) => provenance.packagePath === scatterCrossbowRelationDefinition.targetRawPath)).toBe(false)
  })

  it('keeps projection identity stable across value/result changes', () => {
    const known = build()
    const input = fixtures()
    fighterDamage(input).decoding = { state: 'parse-failed' }
    const unavailable = build(input)
    const findDamage = (artifact: FormalValueAvailabilityArtifact) => artifact.valueProjections.find(({ mappingId, occurrence }) => mappingId === fightersBindingsValueMappings.damage.id && 'sourceIndex' in occurrence && occurrence.sourceIndex === 0)
    expect(findDamage(known)?.result).toBe('projected')
    expect(findDamage(unavailable)?.result).toBe('unavailable')
    expect(findDamage(known)?.projectionId).toBe(findDamage(unavailable)?.projectionId)
  })
})

describe('Formal Value / Availability v2 integrity audit', () => {
  it('has no current Value v1 artifact dependency', () => {
    const retiredArtifact = 'value-availability-' + 'v1.json'
    const currentFiles = [
      'scripts/audit-formal-value-availability.ts',
      'scripts/audit-formal-integration.ts',
      'src/domain/formal/valueAvailability.ts',
      'src/domain/formal/integrationAudit.ts',
      'src/screens/dataBrowser/fightersBindingsBrowserModel.ts',
      'src/screens/dataBrowser/scatterCrossbowBrowserModel.ts',
      'tests/fightersBindingsDataBrowser.test.tsx',
      'tests/scatterCrossbowDataBrowser.test.tsx',
    ]
    expect(currentFiles.map((path) => fs.readFileSync(path, 'utf8')).join('\n')).not.toContain(retiredArtifact)
    expect(fs.existsSync('research/domain/formal/' + retiredArtifact)).toBe(false)
    expect(fs.existsSync('research/domain/formal/value-availability-v2.json')).toBe(true)
    expect(fs.existsSync('docs/formal-value-availability-' + 'v1.md')).toBe(false)
    expect(fs.existsSync('docs/formal-value-availability-v2.md')).toBe(true)
  })

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
    const ref = missing.semantic.melee['fighters-bindings']!.attacks![0]!.configuredDamage!.projectionRef
    missing.valueProjections = missing.valueProjections.filter(({ projectionId }) => projectionId !== ref)
    expect(collectFormalValueAvailabilityErrors(missing)).toContainEqual(expect.stringContaining('missing required projection record'))

    const wrong = clone(build())
    wrong.semantic.melee['fighters-bindings']!.attacks![0]!.configuredDamage!.projectionRef = wrong.semantic.melee['fighters-bindings']!.attacks![1]!.configuredDamage!.projectionRef
    expect(collectFormalValueAvailabilityErrors(wrong)).toContainEqual(expect.stringContaining('semantic location differs'))

    const unavailable = clone(build())
    const record = unavailable.valueProjections.find(({ projectionId }) => projectionId === unavailable.semantic.melee['fighters-bindings']!.attacks![0]!.configuredDamage!.projectionRef)!
    Object.assign(record, { result: 'unavailable', sourceState: 'unknown', reason: 'test' })
    expect(collectFormalValueAvailabilityErrors(unavailable)).toContainEqual(expect.stringContaining('semantic value points to unavailable'))

    const orphan = clone(build())
    delete orphan.semantic.melee['fighters-bindings']!.attacks![0]!.configuredDamage
    expect(collectFormalValueAvailabilityErrors(orphan)).toContainEqual(expect.stringContaining('projected record must have exactly one semantic value'))

    const shared = clone(build())
    shared.semantic.melee['fighters-bindings']!.attacks![1]!.configuredDamage = structuredClone(shared.semantic.melee['fighters-bindings']!.attacks![0]!.configuredDamage)
    expect(collectFormalValueAvailabilityErrors(shared)).toContainEqual(expect.stringContaining('found 2'))
  })

  it.each(['artifactPath', 'datasetId', 'extractionRunId', 'packagePath', 'packageHash', 'nodePointer'] as const)(
    'rejects %s provenance drift even with a recomputed content fingerprint', (field) => {
      const artifact = clone(build())
      const evidence = artifact.provenance.evidence[0]!
      if (field === 'packageHash') evidence.provenance.packageHash = { ...evidence.provenance.packageHash, value: 'changed-hash' }
      else evidence.provenance[field] += ':changed'
      const { fingerprint: _, ...content } = evidence
      void _
      evidence.fingerprint = evidenceFingerprint(content)
      expect(collectFormalValueAvailabilityErrors(artifact)).toContainEqual(expect.stringContaining('EvidenceRef does not match Raw provenance'))
    },
  )

  it('rejects empty, dangling, and mismatched evidence references', () => {
    const empty = clone(build())
    empty.valueProjections[0]!.evidenceRefs = [] as never
    expect(collectFormalValueAvailabilityErrors(empty)).toContainEqual(expect.stringContaining('empty evidenceRefs'))

    const dangling = clone(build())
    dangling.valueProjections[0]!.evidenceRefs = ['evidence:missing']
    expect(collectFormalValueAvailabilityErrors(dangling)).toContainEqual(expect.stringContaining('dangling EvidenceRef'))

    const mismatch = clone(build())
    mismatch.semantic.melee['fighters-bindings']!.configuredAttacks!.evidenceRefs = [mismatch.valueProjections[1]!.evidenceRefs![0]]
    expect(collectFormalValueAvailabilityErrors(mismatch)).toContainEqual(expect.stringContaining('semantic/projection EvidenceRef mismatch'))
  })
})

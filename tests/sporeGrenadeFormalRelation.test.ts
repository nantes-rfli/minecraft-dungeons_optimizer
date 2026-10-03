import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { readHorizontalRawFactInventory } from '../scripts/formal-value-horizontal-source.ts'
import { readHorizontalRelationWaveSources } from '../scripts/formal-relation-horizontal-wave-sources.ts'
import { resolveHorizontalSporeGrenadeRelationSource, verifySporeGrenadeTargetStructural, verifySporeGrenadeSourceStructural,
  type SporeGrenadeRelationSourceRequest } from '../scripts/formal-relation-horizontal-source.ts'
import type { HorizontalRawFactInventory, JsonRecord } from '../scripts/game-data-horizontal-fact-inventory.ts'
import { formalIdentityDefinitions, scatterCrossbowFormalIdentity, battleRobeFormalIdentity, deathCapMushroomFormalIdentity } from '../src/domain/formal/identityDefinitions.ts'
import { projectFormalIdentity, type FormalIdentityEvidenceArtifact, type RawObservationEvidenceRecord } from '../src/domain/formal/identityEvidence.ts'
import type { FormalSerializedRelationArtifact } from '../src/domain/formal/serializedRelation.ts'
import { SPORE_GRENADE_POLICY } from '../scripts/formal-relation-horizontal-source.ts'
import type { RawPackageSnapshot } from '../scripts/game-data-raw-package.ts'
import { execFileSync } from 'node:child_process'
import { buildFormalSerializedRelationArtifact, collectFormalSerializedRelationErrors } from '../src/domain/formal/serializedRelation.ts'

const root = fs.realpathSync('.')
const inventory = readHorizontalRawFactInventory(root)
const identity = JSON.parse(fs.readFileSync('research/domain/formal/identity-evidence-v1.json', 'utf8')) as FormalIdentityEvidenceArtifact
const artifact = JSON.parse(fs.readFileSync('research/domain/formal/serialized-relation-v2.json', 'utf8')) as FormalSerializedRelationArtifact
const record = (value: unknown): JsonRecord => value as JsonRecord
const array = (value: unknown): JsonRecord[] => value as JsonRecord[]

function fixture(domainId = 'blast-fungus') {
  const definition = formalIdentityDefinitions.find(({ assertion }) => assertion.domainId === domainId)!
  const packagePath = definition.assertion.applicationScope.packagePath
  const value = structuredClone(inventory) as HorizontalRawFactInventory
  const item = value.items.find((entry) => entry.category === 'artifact' && entry.catalogId === domainId)!
  const candidate = array(record(item.rawCandidate).candidates).find((entry) => entry.packagePath === packagePath)!
  const sourceRelations = array(record(value).sourceRelations)
  const reference = array(candidate.relations).find((entry) =>
    sourceRelations.some((source) => source.edgeId === entry.edgeId && source.propertyPath === 'ProjectileItemSpec.ClassesToSpawn[0]'))!
  const source = sourceRelations.find((entry) => entry.edgeId === reference.edgeId)!
  const semantic = identity.semantic.identities.find((entry) => entry.assertionId === definition.assertion.id)!
  const evidence = identity.provenance.evidence.filter((entry): entry is RawObservationEvidenceRecord =>
    entry.kind === 'raw-observation' && semantic.resolution.evidenceRefs.includes(entry.id))
  const request: SporeGrenadeRelationSourceRequest = {
    category: 'artifact', relationKind: 'spore-grenade-spawn-class', propertyPath: 'ProjectileItemSpec.ClassesToSpawn[0]',
    catalogId: domainId, candidatePackage: packagePath, edgeId: String(reference.edgeId), sourceIndex: 0,
    definition, identity: structuredClone(semantic), identityEvidence: evidence,
  }
  return { value, item, candidate, reference, source, request }
}

function targetFixture() {
  const row = { targetObject: SPORE_GRENADE_POLICY.targetObject as string, targetPackage: SPORE_GRENADE_POLICY.targetPackage as string, targetShard: 'shards/part-061.json.gz' }
  const shard = JSON.parse(gunzipSync(fs.readFileSync(
    `research/raw/game-data-raw-structural-inventory/${row.targetShard}`)).toString('utf8')) as JsonRecord
  return { row, pkg: structuredClone(array(shard.packages).find((entry) => entry.path === row.targetPackage)!),
    edges: structuredClone(array(shard.edges).filter((edge) => edge.sourcePackage === row.targetPackage)) }
}

describe('SporeGrenade Formal Relation', () => {
  it('adds exactly one configured actor, preserves 227 existing records and keeps full target Raw unsupplied', () => {
    const wave = readHorizontalRelationWaveSources({ repositoryRoot: root, identity, inventory })
    expect(wave.sporeGrenade).toHaveLength(1)
    const input = wave.sporeGrenade[0]!
    expect(input.relationRef).toBe('relation:blast-fungus:spore-grenade-spawn-class@1')
    expect(input.occurrence).toEqual({ domainId: 'blast-fungus', collectionRef: 'spore-grenade-spawn-classes', sourceIndex: 0 })
    expect(record(input.structuralEdge).id).toBe(SPORE_GRENADE_POLICY.edgeId)
    expect(input.source.packagePath).toBe(SPORE_GRENADE_POLICY.sourcePackage)
    expect(record(input.structuralEdge).targetObject).toBe(SPORE_GRENADE_POLICY.targetObject)
    const projection = artifact.relationProjections.find((item) => item.relationRef === input.relationRef)!
    expect(projection.projectionRef).toBe('projection:relation:blast-fungus:spore-grenade-spawn-class@1:0')
    expect(projection).toMatchObject({ result: 'projected', serializedTargetResolution: { state: 'resolved-local-package' },
      targetRawVerification: { input: 'not-supplied', result: 'not-resolved', reason: 'target-snapshot-not-supplied' } })
    expect(artifact.semantic.relations.filter((r) => r.relationRef.endsWith(':spore-grenade-spawn-class@1'))).toHaveLength(1)
    expect(new Set(artifact.semantic.relations.map((r) => r.relationRef.split(':').at(-1))).size).toBe(8)
    expect(artifact.semantic.relations.filter((r) => r.sourceDomainId === 'blast-fungus').map((r) => r.relationRef))
      .toEqual(['relation:blast-fungus:spore-grenade-spawn-class@1'])
    for (const file of ['research/domain/formal/identity-evidence-v1.json', 'research/domain/formal/value-availability-v2.json']) {
      // Freeze this wave's no-Value-change proof; later Value waves have their own preservation tests.
      const bytes = file.endsWith('value-availability-v2.json')
        ? execFileSync('git', ['show', `0f54edff3d0cd4d70b6c4c2e4d8383781b8c0f2c:${file}`], { maxBuffer: 32 * 1024 * 1024 })
        : fs.readFileSync(file)
      expect(bytes.equals(execFileSync('git', ['show', `597916f064c807d6a83fdf35ba17b7d486b8bbc9:${file}`], { maxBuffer: 32 * 1024 * 1024 }))).toBe(true)
    }
    expect(artifact.schemaVersion).toBe(2)
    expect(artifact.semantic.relations).toHaveLength(228)
    expect(artifact.relationProjections).toHaveLength(228)
    expect(artifact.relationCollections).toHaveLength(59)
    expect(new Set(artifact.semantic.relations.map((item) => item.sourceDomainId)).size).toBe(147)
    expect(artifact.relationCollections.filter((row) => row.domainId === 'blast-fungus')).toMatchObject([{ collectionRef: 'spore-grenade-spawn-classes', result: 'projected', sourceIndices: [0] }])
    const baseline = JSON.parse(execFileSync('git', ['show', '597916f064c807d6a83fdf35ba17b7d486b8bbc9:research/domain/formal/serialized-relation-v2.json'], { encoding: 'utf8' })) as FormalSerializedRelationArtifact
    for (const existing of baseline.semantic.relations) expect(artifact.semantic.relations.find((r) => r.projectionRef === existing.projectionRef)).toEqual(existing)
    for (const existing of baseline.relationProjections) expect(artifact.relationProjections.find((r) => r.projectionRef === existing.projectionRef)).toEqual(existing)
    for (const existing of baseline.provenance.evidence) expect(artifact.provenance.evidence.find((e) => e.id === existing.id)).toEqual(existing)
    expect(artifact.relationCollections.filter((row) => row.domainId !== 'blast-fungus')).toEqual(baseline.relationCollections)
    expect(artifact.provenance.evidence.length - baseline.provenance.evidence.length).toBe(1)
    const baseInput = (definition: typeof scatterCrossbowFormalIdentity) => {
      const source = JSON.parse(fs.readFileSync(`research/raw/packages/${definition.assertion.applicationScope.packagePath}.raw.json`, 'utf8')) as RawPackageSnapshot
      const projected = projectFormalIdentity(source, definition)
      return { source, identity: projected.semantic, identityEvidence: projected.evidence.filter((e): e is RawObservationEvidenceRecord => e.kind === 'raw-observation') }
    }
    const inputs = { scatter: baseInput(scatterCrossbowFormalIdentity),
      battleRobe: baseInput(battleRobeFormalIdentity), deathCapMushroom: baseInput(deathCapMushroomFormalIdentity),
      structuralPackagePaths: new Set<string>(), horizontalRelations: [input] }
    expect(() => buildFormalSerializedRelationArtifact({ ...inputs, horizontalRelations: [input, input] })).toThrow(/Duplicate Relation/)
    const built = buildFormalSerializedRelationArtifact(inputs)
    expect(buildFormalSerializedRelationArtifact(inputs)).toEqual(built)
    const duplicate = structuredClone(built)
    duplicate.relationCollections.push(structuredClone(duplicate.relationCollections.at(-1)!))
    expect(collectFormalSerializedRelationErrors(duplicate, inputs)).toContain('Relation collection mismatch')


  }, 180_000)

  it('fails closed on source catalog, package, root, edge and identity drift', () => {
    expect(resolveHorizontalSporeGrenadeRelationSource(root, fixture().value, fixture().request)).toBeDefined()
    const mutations: ((value: ReturnType<typeof fixture>) => void)[] = [
      (f) => { f.request.sourceIndex = 1 },
      (f) => { f.request.catalogId = 'wrong' },
      (f) => { f.request.candidatePackage = 'wrong' },
      (f) => { f.request.edgeId = 'wrong' },
      (f) => { f.candidate.packagePath = 'wrong' },
      (f) => { f.candidate.role = 'effect' },
      (f) => { f.candidate.evidence = [] },
      (f) => { record(f.item.rawCandidate).status = 'ambiguous' },
      (f) => { f.candidate.candidateMappingStatus = 'ambiguous' },
      (f) => { array(record(f.item.rawCandidate).candidates).push(structuredClone(f.candidate)) },
      (f) => { array(record(f.candidate.traversal).relationPaths).push(structuredClone(array(record(f.candidate.traversal).relationPaths).find((p) => p.id === 'rp-root')!)) },
      (f) => { record(f.candidate.traversal).rootPackage = 'wrong' },
      (f) => { f.request.propertyPath = 'FishingRodActorClass' as 'ProjectileItemSpec.ClassesToSpawn[0]' },
      (f) => { f.request.edgeId = 'a5980691c198c7fd05bd2a0c' },
      (f) => { f.request.identityEvidence = structuredClone(f.request.identityEvidence); record(f.request.identityEvidence[0]!.provenance.packageHash).value = 'wrong' },
      (f) => { f.request.definition = structuredClone(f.request.definition); f.request.definition.assertion.applicationScope.rawSchemaVersion = 99 },
      (f) => { f.source.propertyPath = 'FishingRodActorClass' },
      (f) => { f.source.arrayIndex = 1 },
      (f) => { f.reference.sourceRelationPathId = 'rp-inherited' },
      (f) => { f.reference.edgeId = 'wrong' },
      (f) => { f.source.propertyPath = 'Effect' },
      (f) => { f.source.relationKind = 'soft-object-property' },
      (f) => { f.source.sourcePackage = 'wrong' },
      (f) => { f.source.sourceOccurrenceKind = 'export-table' },
      (f) => { f.source.targetKind = 'export' },
      (f) => { f.source.targetPackage = 'wrong' },
      (f) => { f.source.targetObject = 'wrong' },
      (f) => { f.request.identity.assertionId = 'wrong' },
      (f) => { f.request.identity.resolution = { state: 'unresolved', assertionId: f.request.identity.assertionId, evidenceRefs: [] } },
      (f) => { f.request.definition = structuredClone(f.request.definition); f.request.definition.assertion.applicationScope.packagePath = 'wrong' },
      (f) => { record(f.candidate.candidatePackageProvenance).packageHash = 'wrong' },
      (f) => { record(f.candidate.candidatePackageProvenance).sourceShardUncompressedSha256 = 'wrong' },
      (f) => { array(f.candidate.relations).push(structuredClone(f.reference)) },
      (f) => { array(record(f.value).sourceRelations).push(structuredClone(f.source)) },
    ]
    for (const mutate of mutations) {
      const f = fixture()
      mutate(f)
      expect(() => resolveHorizontalSporeGrenadeRelationSource(root, f.value, f.request)).toThrow()
    }
  }, 180_000)

  it('binds the exact target class, direct super and CDO by Structural references', () => {
    const good = targetFixture()
    expect(() => verifySporeGrenadeTargetStructural(good.row.targetObject, good.pkg, good.edges)).not.toThrow()
    const mutations: ((f: ReturnType<typeof targetFixture>) => void)[] = [
      (f) => { f.row.targetObject = `${f.pkg.gamePackageName}.Other_C` },
      (f) => { array(f.pkg.exports).find((entry) => record(entry.objectName).value === 'BP_SporeGrenade_C')!.objectName = { value: 'Other_C' } },
      (f) => { f.edges.splice(f.edges.findIndex((edge) => edge.kind === 'super' && record(edge.sourceOccurrence).sourceObject === 'BP_SporeGrenade_C'), 1) },
      (f) => { f.edges.push(structuredClone(f.edges.find((edge) => edge.kind === 'super' && record(edge.sourceOccurrence).sourceObject === 'BP_SporeGrenade_C')!)) },
      (f) => { f.edges.find((edge) => edge.kind === 'super' && record(edge.sourceOccurrence).sourceObject === 'BP_SporeGrenade_C')!.targetObject = '/Script/Dungeons.Other' },
      (f) => { f.edges.find((edge) => edge.kind === 'super' && record(edge.sourceOccurrence).sourceObject === 'BP_SporeGrenade_C')!.targetKind = 'export' },
      (f) => { record(f.edges.find((edge) => edge.kind === 'super' && record(edge.sourceOccurrence).sourceObject === 'BP_SporeGrenade_C')!.sourceOccurrence).sourceObject = 'Other_C' },
      (f) => { array(f.pkg.exports).splice(array(f.pkg.exports).findIndex((entry) => entry.isClassDefaultObject === true), 1) },
      (f) => { record(record(array(f.pkg.exports).find((entry) => entry.isClassDefaultObject === true)!.references).class).rawPackageIndex = 99 },
      (f) => { f.pkg.path = 'wrong' },
      (f) => { f.edges.find((e) => e.kind === 'super' && record(e.sourceOccurrence).sourceObject === 'BP_SporeGrenade_C')!.targetRawPackageIndex = -999 },
      (f) => { array(f.pkg.exports).find((e) => e.isClassDefaultObject === true)!.rawPackageIndex = 999 },
      (f) => { f.edges.splice(f.edges.findIndex((e) => e.kind === 'class' && record(e.sourceOccurrence).sourceObject === 'Default__BP_SporeGrenade_C'), 1) },
      (f) => { f.edges.find((e) => e.kind === 'template' && record(e.sourceOccurrence).sourceObject === 'Default__BP_SporeGrenade_C')!.targetObject = '/Script/Dungeons.Default__ItemActor' },
      (f) => { record(record(array(f.pkg.exports).find((e) => e.isClassDefaultObject === true)!.references).template).rawPackageIndex = -999 },
      (f) => { f.pkg.gamePackageName = '/Game/Wrong' },
      (f) => { array(f.pkg.exports).push(structuredClone(array(f.pkg.exports).find((e) => record(e.objectName).value === 'BP_SporeGrenade_C')!)) },
      (f) => { array(f.pkg.exports).push(structuredClone(array(f.pkg.exports).find((e) => e.isClassDefaultObject === true)!)) },
      (f) => { record(array(f.pkg.exports).find((e) => e.isClassDefaultObject === true)!.objectName).value = 'Default__Wrong_C' },
      (f) => { record(record(array(f.pkg.exports).find((e) => e.isClassDefaultObject === true)!.references).class).objectName = 'Wrong_C' },
      (f) => { record(record(array(f.pkg.exports).find((e) => e.isClassDefaultObject === true)!.references).template).objectName = 'Default__ItemActor' },
      (f) => { record(record(array(f.pkg.exports).find((e) => record(e.objectName).value === 'BP_SporeGrenade_C')!.references).super).objectName = 'ItemActor' },
      (f) => { record(record(array(f.pkg.exports).find((e) => record(e.objectName).value === 'BP_SporeGrenade_C')!.references).class).objectName = 'Class' },
      (f) => { array(f.pkg.inheritanceChains).push(structuredClone(array(f.pkg.inheritanceChains).find((e) => e.sourceObject === 'BP_SporeGrenade_C')!)) },
      (f) => { f.edges.push(structuredClone(f.edges.find((e) => e.kind === 'class' && record(e.sourceOccurrence).sourceObject === 'Default__BP_SporeGrenade_C')!)) },
      (f) => { f.edges.splice(f.edges.findIndex((e) => e.kind === 'template' && record(e.sourceOccurrence).sourceObject === 'Default__BP_SporeGrenade_C'), 1) },
      (f) => { array(array(f.pkg.inheritanceChains).find((e) => e.sourceObject === 'BP_SporeGrenade_C')!.hops).push({}) },
      (f) => { array(f.pkg.inheritanceChains).find((e) => e.sourceObject === 'BP_SporeGrenade_C')!.stopReason = 'local-boundary' },
    ]
    for (const mutate of mutations) {
      const changed = targetFixture()
      mutate(changed)
      expect(() => verifySporeGrenadeTargetStructural(changed.row.targetObject, changed.pkg, changed.edges)).toThrow()
    }
  })
})

describe('SporeGrenade decoded source collection', () => {
  function sourceFixture() {
    const shard = JSON.parse(gunzipSync(fs.readFileSync('research/raw/game-data-raw-structural-inventory/shards/part-061.json.gz')).toString('utf8')) as JsonRecord
    const pkg = array(shard.packages).find((row) => row.path === SPORE_GRENADE_POLICY.sourcePackage)!
    const edge = array(shard.edges).find((row) => row.id === SPORE_GRENADE_POLICY.edgeId)!
    const container = array(array(pkg.cdoPropertyInventory)[0]!.properties)[0]!
    const property = array(record(container.decoding).properties)[0]!
    const element = array(record(property.decoding).elements)[0]!
    return { pkg, edge, container, property, element }
  }
  it('rejects wrong decoded containers, inner properties, raw indices and ranges', () => {
    const good = sourceFixture()
    expect(() => verifySporeGrenadeSourceStructural(good.pkg, good.edge)).not.toThrow()
    const mutations: ((f: ReturnType<typeof sourceFixture>) => void)[] = [
      (f) => { f.container.path = 'Other' },
      (f) => { record(f.container.type).value = 'ArrayProperty' },
      (f) => { record(f.container.decoding).state = 'unsupported' },
      (f) => { record(f.container.metadata).structType = 'Other' },
      (f) => { f.property.path = 'Other.ClassesToSpawn' },
      (f) => { record(f.property.type).value = 'ObjectProperty' },
      (f) => { record(f.property.metadata).innerType = 'ClassProperty' },
      (f) => { f.element.index = 1 },
      (f) => { record(f.element.decoding).state = 'unsupported' },
      (f) => { record(f.element.value).rawPackageIndex = -3 },
      (f) => { array(record(f.property.decoding).elements).push(structuredClone(f.element)) },
      (f) => { array(record(f.container.decoding).properties).push(structuredClone(f.property)) },
      (f) => { record(f.container.sourceRange).start = 0 },
      (f) => { record(f.container.valueRange).end = 999 },
      (f) => { record(f.property.sourceRange).start = 0 },
      (f) => { record(f.property.valueRange).end = 999 },
      (f) => { record(record(f.edge.sourceOccurrence).sourceRange).start = 0 },
      (f) => { record(f.edge.sourceOccurrence).arrayIndex = 1 },
      (f) => { f.edge.id = 'wrong' },
    ]
    for (const mutate of mutations) {
      const f = sourceFixture(); mutate(f)
      expect(() => verifySporeGrenadeSourceStructural(f.pkg, f.edge)).toThrow()
    }
  })
})

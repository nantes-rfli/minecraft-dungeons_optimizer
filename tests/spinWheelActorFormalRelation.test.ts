import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { readHorizontalRawFactInventory } from '../scripts/formal-value-horizontal-source.ts'
import { readHorizontalRelationWaveSources } from '../scripts/formal-relation-horizontal-wave-sources.ts'
import { resolveHorizontalSpinWheelActorRelationSource, verifySpinWheelActorTargetStructural,
  type SpinWheelActorRelationSourceRequest } from '../scripts/formal-relation-horizontal-source.ts'
import type { HorizontalRawFactInventory, JsonRecord } from '../scripts/game-data-horizontal-fact-inventory.ts'
import { formalIdentityDefinitions, scatterCrossbowFormalIdentity, battleRobeFormalIdentity, deathCapMushroomFormalIdentity } from '../src/domain/formal/identityDefinitions.ts'
import { projectFormalIdentity, type FormalIdentityEvidenceArtifact, type RawObservationEvidenceRecord } from '../src/domain/formal/identityEvidence.ts'
import type { FormalSerializedRelationArtifact } from '../src/domain/formal/serializedRelation.ts'
import { SPIN_WHEEL_ACTOR_POLICY } from '../scripts/formal-relation-horizontal-source.ts'
import type { RawPackageSnapshot } from '../scripts/game-data-raw-package.ts'
import { execFileSync } from 'node:child_process'
import { buildFormalSerializedRelationArtifact } from '../src/domain/formal/serializedRelation.ts'

const root = fs.realpathSync('.')
const inventory = readHorizontalRawFactInventory(root)
const identity = JSON.parse(fs.readFileSync('research/domain/formal/identity-evidence-v1.json', 'utf8')) as FormalIdentityEvidenceArtifact
const artifact = JSON.parse(fs.readFileSync('research/domain/formal/serialized-relation-v2.json', 'utf8')) as FormalSerializedRelationArtifact
const record = (value: unknown): JsonRecord => value as JsonRecord
const array = (value: unknown): JsonRecord[] => value as JsonRecord[]

function fixture(domainId = 'spinblade') {
  const definition = formalIdentityDefinitions.find(({ assertion }) => assertion.domainId === domainId)!
  const packagePath = definition.assertion.applicationScope.packagePath
  const value = structuredClone(inventory) as HorizontalRawFactInventory
  const item = value.items.find((entry) => entry.category === 'artifact' && entry.catalogId === domainId)!
  const candidate = array(record(item.rawCandidate).candidates).find((entry) => entry.packagePath === packagePath)!
  const sourceRelations = array(record(value).sourceRelations)
  const reference = array(candidate.relations).find((entry) =>
    sourceRelations.some((source) => source.edgeId === entry.edgeId && source.propertyPath === 'SpinWheelActorClass'))!
  const source = sourceRelations.find((entry) => entry.edgeId === reference.edgeId)!
  const semantic = identity.semantic.identities.find((entry) => entry.assertionId === definition.assertion.id)!
  const evidence = identity.provenance.evidence.filter((entry): entry is RawObservationEvidenceRecord =>
    entry.kind === 'raw-observation' && semantic.resolution.evidenceRefs.includes(entry.id))
  const request: SpinWheelActorRelationSourceRequest = {
    category: 'artifact', relationKind: 'spin-wheel-actor', propertyPath: 'SpinWheelActorClass',
    catalogId: domainId, candidatePackage: packagePath, edgeId: String(reference.edgeId),
    definition, identity: structuredClone(semantic), identityEvidence: evidence,
  }
  return { value, item, candidate, reference, source, request }
}

function targetFixture() {
  const row = { targetObject: SPIN_WHEEL_ACTOR_POLICY.targetObject as string, targetPackage: SPIN_WHEEL_ACTOR_POLICY.targetPackage as string, targetShard: 'shards/part-061.json.gz' }
  const shard = JSON.parse(gunzipSync(fs.readFileSync(
    `research/raw/game-data-raw-structural-inventory/${row.targetShard}`)).toString('utf8')) as JsonRecord
  return { row, pkg: structuredClone(array(shard.packages).find((entry) => entry.path === row.targetPackage)!),
    edges: structuredClone(array(shard.edges).filter((edge) => edge.sourcePackage === row.targetPackage)) }
}

describe('SpinWheelActor Formal Relation', () => {
  it('adds exactly one configured actor, preserves 225 existing records and keeps full target Raw unsupplied', () => {
    const wave = readHorizontalRelationWaveSources({ repositoryRoot: root, identity, inventory })
    expect(wave.spinWheelActor).toHaveLength(1)
    const input = wave.spinWheelActor[0]!
    expect(input.relationRef).toBe('relation:spinblade:spin-wheel-actor@1')
    expect(input.occurrence).toEqual({ domainId: 'spinblade', scopeRef: 'source' })
    expect(record(input.structuralEdge).id).toBe(SPIN_WHEEL_ACTOR_POLICY.edgeId)
    expect(input.source.packagePath).toBe(SPIN_WHEEL_ACTOR_POLICY.sourcePackage)
    expect(record(input.structuralEdge).targetObject).toBe(SPIN_WHEEL_ACTOR_POLICY.targetObject)
    const projection = artifact.relationProjections.find((item) => item.relationRef === input.relationRef)!
    expect(projection.projectionRef).toBe('projection:relation:spinblade:spin-wheel-actor@1:source')
    expect(projection).toMatchObject({ result: 'projected', serializedTargetResolution: { state: 'resolved-local-package' },
      targetRawVerification: { input: 'not-supplied', result: 'not-resolved', reason: 'target-snapshot-not-supplied' } })
    expect(artifact.schemaVersion).toBe(2)
    expect(artifact.semantic.relations).toHaveLength(226)
    expect(artifact.relationProjections).toHaveLength(226)
    expect(artifact.relationCollections).toHaveLength(58)
    expect(new Set(artifact.semantic.relations.map((item) => item.sourceDomainId)).size).toBe(146)
    const baseline = JSON.parse(execFileSync('git', ['show', '07160c289dcf987ab5bee5ae69e448d906724aef:research/domain/formal/serialized-relation-v2.json'], { encoding: 'utf8' })) as FormalSerializedRelationArtifact
    for (const existing of baseline.semantic.relations) expect(artifact.semantic.relations.find((r) => r.projectionRef === existing.projectionRef)).toEqual(existing)
    for (const existing of baseline.relationProjections) expect(artifact.relationProjections.find((r) => r.projectionRef === existing.projectionRef)).toEqual(existing)
    for (const existing of baseline.provenance.evidence) expect(artifact.provenance.evidence.find((e) => e.id === existing.id)).toEqual(existing)
    expect(artifact.relationCollections).toEqual(baseline.relationCollections)
    expect(artifact.provenance.evidence.length - baseline.provenance.evidence.length).toBe(1)
    const baseInput = (definition: typeof scatterCrossbowFormalIdentity) => {
      const source = JSON.parse(fs.readFileSync(`research/raw/packages/${definition.assertion.applicationScope.packagePath}.raw.json`, 'utf8')) as RawPackageSnapshot
      const projected = projectFormalIdentity(source, definition)
      return { source, identity: projected.semantic, identityEvidence: projected.evidence.filter((e): e is RawObservationEvidenceRecord => e.kind === 'raw-observation') }
    }
    expect(() => buildFormalSerializedRelationArtifact({ scatter: baseInput(scatterCrossbowFormalIdentity),
      battleRobe: baseInput(battleRobeFormalIdentity), deathCapMushroom: baseInput(deathCapMushroomFormalIdentity),
      structuralPackagePaths: new Set(), horizontalRelations: [input, input] })).toThrow(/Duplicate Relation/)

  }, 180_000)

  it('fails closed on source catalog, package, root, edge and identity drift', () => {
    expect(resolveHorizontalSpinWheelActorRelationSource(root, fixture().value, fixture().request)).toBeDefined()
    const mutations: ((value: ReturnType<typeof fixture>) => void)[] = [
      (f) => { f.request.catalogId = 'wrong' },
      (f) => { f.request.candidatePackage = 'wrong' },
      (f) => { f.request.edgeId = 'wrong' },
      (f) => { f.candidate.packagePath = 'wrong' },
      (f) => { f.candidate.role = 'effect' },
      (f) => { f.candidate.evidence = [] },
      (f) => { f.source.arrayIndex = 0 },
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
      expect(() => resolveHorizontalSpinWheelActorRelationSource(root, f.value, f.request)).toThrow()
    }
  }, 180_000)

  it('binds the exact target class, direct super and CDO by Structural references', () => {
    const good = targetFixture()
    expect(() => verifySpinWheelActorTargetStructural(good.row.targetObject, good.pkg, good.edges)).not.toThrow()
    const mutations: ((f: ReturnType<typeof targetFixture>) => void)[] = [
      (f) => { f.row.targetObject = `${f.pkg.gamePackageName}.Other_C` },
      (f) => { array(f.pkg.exports).find((entry) => record(entry.objectName).value === 'BP_SpinWheelActor_C')!.objectName = { value: 'Other_C' } },
      (f) => { f.edges.splice(f.edges.findIndex((edge) => edge.kind === 'super' && record(edge.sourceOccurrence).sourceObject === 'BP_SpinWheelActor_C'), 1) },
      (f) => { f.edges.push(structuredClone(f.edges.find((edge) => edge.kind === 'super' && record(edge.sourceOccurrence).sourceObject === 'BP_SpinWheelActor_C')!)) },
      (f) => { f.edges.find((edge) => edge.kind === 'super' && record(edge.sourceOccurrence).sourceObject === 'BP_SpinWheelActor_C')!.targetObject = '/Script/Dungeons.Other' },
      (f) => { f.edges.find((edge) => edge.kind === 'super' && record(edge.sourceOccurrence).sourceObject === 'BP_SpinWheelActor_C')!.targetKind = 'export' },
      (f) => { record(f.edges.find((edge) => edge.kind === 'super' && record(edge.sourceOccurrence).sourceObject === 'BP_SpinWheelActor_C')!.sourceOccurrence).sourceObject = 'Other_C' },
      (f) => { array(f.pkg.exports).splice(array(f.pkg.exports).findIndex((entry) => entry.isClassDefaultObject === true), 1) },
      (f) => { record(record(array(f.pkg.exports).find((entry) => entry.isClassDefaultObject === true)!.references).class).rawPackageIndex = 99 },
      (f) => { f.pkg.path = 'wrong' },
      (f) => { f.pkg.gamePackageName = '/Game/Wrong' },
      (f) => { array(f.pkg.exports).push(structuredClone(array(f.pkg.exports).find((e) => record(e.objectName).value === 'BP_SpinWheelActor_C')!)) },
      (f) => { array(f.pkg.exports).push(structuredClone(array(f.pkg.exports).find((e) => e.isClassDefaultObject === true)!)) },
      (f) => { record(array(f.pkg.exports).find((e) => e.isClassDefaultObject === true)!.objectName).value = 'Default__Wrong_C' },
      (f) => { record(record(array(f.pkg.exports).find((e) => e.isClassDefaultObject === true)!.references).class).objectName = 'Wrong_C' },
      (f) => { record(record(array(f.pkg.exports).find((e) => e.isClassDefaultObject === true)!.references).template).objectName = 'Default__ItemActor' },
      (f) => { record(record(array(f.pkg.exports).find((e) => record(e.objectName).value === 'BP_SpinWheelActor_C')!.references).super).objectName = 'ItemActor' },
      (f) => { array(array(f.pkg.inheritanceChains).find((e) => e.sourceObject === 'BP_SpinWheelActor_C')!.hops).push({}) },
      (f) => { array(f.pkg.inheritanceChains).find((e) => e.sourceObject === 'BP_SpinWheelActor_C')!.stopReason = 'local-boundary' },
    ]
    for (const mutate of mutations) {
      const changed = targetFixture()
      mutate(changed)
      expect(() => verifySpinWheelActorTargetStructural(changed.row.targetObject, changed.pkg, changed.edges)).toThrow()
    }
  })
})

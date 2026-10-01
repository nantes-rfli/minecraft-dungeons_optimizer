import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { readHorizontalRawFactInventory } from '../scripts/formal-value-horizontal-source.ts'
import { readHorizontalRelationWaveSources } from '../scripts/formal-relation-horizontal-wave-sources.ts'
import { resolveHorizontalArtifactItemActorRelationSource, verifyItemActorTargetStructural,
  type ArtifactItemActorRelationSourceRequest } from '../scripts/formal-relation-horizontal-source.ts'
import type { HorizontalRawFactInventory, JsonRecord } from '../scripts/game-data-horizontal-fact-inventory.ts'
import { formalIdentityDefinitions, READY_ARTIFACT_EFFECT_DOMAINS } from '../src/domain/formal/identityDefinitions.ts'
import type { FormalIdentityEvidenceArtifact, RawObservationEvidenceRecord } from '../src/domain/formal/identityEvidence.ts'
import type { FormalSerializedRelationArtifact } from '../src/domain/formal/serializedRelation.ts'
import { READY_ARTIFACT_ITEM_ACTOR_DOMAINS } from '../src/domain/formal/relationWaves.ts'

const root = fs.realpathSync('.')
const inventory = readHorizontalRawFactInventory(root)
const identity = JSON.parse(fs.readFileSync('research/domain/formal/identity-evidence-v1.json', 'utf8')) as FormalIdentityEvidenceArtifact
const artifact = JSON.parse(fs.readFileSync('research/domain/formal/serialized-relation-v2.json', 'utf8')) as FormalSerializedRelationArtifact
const census = JSON.parse(fs.readFileSync('docs/artifact_item_actor_relation_semantic_design_census.json', 'utf8')) as {
  rows: { domainId: string; edgeId: string; targetObject: string; targetPackage: string; targetShard: string }[]
}
const record = (value: unknown): JsonRecord => value as JsonRecord
const array = (value: unknown): JsonRecord[] => value as JsonRecord[]

function fixture(domainId = 'corrupted-seeds') {
  const definition = formalIdentityDefinitions.find(({ assertion }) => assertion.domainId === domainId)!
  const packagePath = definition.assertion.applicationScope.packagePath
  const value = structuredClone(inventory) as HorizontalRawFactInventory
  const item = value.items.find((entry) => entry.category === 'artifact' && entry.catalogId === domainId)!
  const candidate = array(record(item.rawCandidate).candidates).find((entry) => entry.packagePath === packagePath)!
  const sourceRelations = array(record(value).sourceRelations)
  const reference = array(candidate.relations).find((entry) =>
    sourceRelations.some((source) => source.edgeId === entry.edgeId && source.propertyPath === 'ItemActorClass'))!
  const source = sourceRelations.find((entry) => entry.edgeId === reference.edgeId)!
  const semantic = identity.semantic.identities.find((entry) => entry.assertionId === definition.assertion.id)!
  const evidence = identity.provenance.evidence.filter((entry): entry is RawObservationEvidenceRecord =>
    entry.kind === 'raw-observation' && semantic.resolution.evidenceRefs.includes(entry.id))
  const request: ArtifactItemActorRelationSourceRequest = {
    category: 'artifact', relationKind: 'item-actor', propertyPath: 'ItemActorClass',
    catalogId: domainId, candidatePackage: packagePath, edgeId: String(reference.edgeId),
    definition, identity: structuredClone(semantic), identityEvidence: evidence,
  }
  return { value, item, candidate, reference, source, request }
}

function targetFixture() {
  const row = census.rows.find((entry) => entry.domainId === 'corrupted-seeds')!
  const shard = JSON.parse(gunzipSync(fs.readFileSync(
    `research/raw/game-data-raw-structural-inventory/${row.targetShard}`)).toString('utf8')) as JsonRecord
  return { row, pkg: structuredClone(array(shard.packages).find((entry) => entry.path === row.targetPackage)!),
    edges: structuredClone(array(shard.edges).filter((edge) => edge.sourcePackage === row.targetPackage)) }
}

describe('Artifact ItemActor Formal Relation', () => {
  it('populates exactly the reviewed 11 source scope relations and preserves Effect coexistence', () => {
    const wave = readHorizontalRelationWaveSources({ repositoryRoot: root, identity, inventory })
    expect(READY_ARTIFACT_ITEM_ACTOR_DOMAINS).toHaveLength(11)
    expect(wave.artifactItemActor).toHaveLength(11)
    expect(new Set(wave.artifactItemActor.map((input) => input.sourceDomainId)))
      .toEqual(new Set(READY_ARTIFACT_ITEM_ACTOR_DOMAINS))
    for (const input of wave.artifactItemActor) {
      const row = census.rows.find((entry) => entry.domainId === input.sourceDomainId)!
      expect(input.relationRef).toBe(`relation:${input.sourceDomainId}:item-actor@1`)
      expect(input.occurrence).toEqual({ domainId: input.sourceDomainId, scopeRef: 'source' })
      expect(record(input.structuralEdge).id).toBe(row.edgeId)
      expect(input.source.packagePath).toBe(formalIdentityDefinitions.find(({ assertion }) =>
        assertion.domainId === input.sourceDomainId)!.assertion.applicationScope.packagePath)
      expect(record(input.structuralEdge).targetObject).toBe(row.targetObject)
      expect(record(input.structuralEdge).targetKind).toBe('import')
      expect(input.serializedTargetResolution.state).toBe('resolved-local-package')
      const projection = artifact.relationProjections.find((item) => item.relationRef === input.relationRef)!
      expect(projection.projectionRef).toBe(`projection:relation:${input.sourceDomainId}:item-actor@1:source`)
      expect(projection.result).toBe('projected')
      if (projection.result === 'projected') expect(projection.targetRawVerification)
        .toEqual({ input: 'not-supplied', result: 'not-resolved', reason: 'target-snapshot-not-supplied' })
    }
    expect(artifact.semantic.relations).toHaveLength(226)
    expect(artifact.relationProjections).toHaveLength(226)
    expect(artifact.relationCollections).toHaveLength(58)
    expect(new Set(artifact.semantic.relations.map((item) => item.sourceDomainId)).size).toBe(146)
    expect(artifact.relationCollections.every((item) => !READY_ARTIFACT_ITEM_ACTOR_DOMAINS.includes(
      item.domainId as typeof READY_ARTIFACT_ITEM_ACTOR_DOMAINS[number]))).toBe(true)
    expect(artifact.relationProjections.filter((item) => item.relationRef.endsWith(':effect@1'))).toHaveLength(10)
    expect(artifact.relationProjections.filter((item) => item.relationRef.endsWith(':gear-actor@1'))).toHaveLength(71)
    for (const domainId of ['death-cap-mushroom', 'iron-hide-amulet', 'powershaker', 'shadow-shifter', 'shock-powder']) {
      expect(READY_ARTIFACT_EFFECT_DOMAINS).toContain(domainId)
      expect(artifact.relationProjections.filter((item) => item.occurrence.domainId === domainId
        && (item.relationRef.endsWith(':effect@1') || item.relationRef.endsWith(':item-actor@1')))).toHaveLength(2)
    }
  }, 180_000)

  it('fails closed on source catalog, package, root, edge and identity drift', () => {
    expect(resolveHorizontalArtifactItemActorRelationSource(root, fixture().value, fixture().request)).toBeDefined()
    const mutations: ((value: ReturnType<typeof fixture>) => void)[] = [
      (f) => { f.request.catalogId = 'wrong' },
      (f) => { f.request.candidatePackage = 'wrong' },
      (f) => { f.request.edgeId = 'wrong' },
      (f) => { f.candidate.packagePath = 'wrong' },
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
      (f) => { record(f.candidate.candidatePackageProvenance).packageHash = 'wrong' },
      (f) => { record(f.candidate.candidatePackageProvenance).sourceShardUncompressedSha256 = 'wrong' },
      (f) => { array(f.candidate.relations).push(structuredClone(f.reference)) },
      (f) => { array(record(f.value).sourceRelations).push(structuredClone(f.source)) },
    ]
    for (const mutate of mutations) {
      const f = fixture()
      mutate(f)
      expect(() => resolveHorizontalArtifactItemActorRelationSource(root, f.value, f.request)).toThrow()
    }
  }, 180_000)

  it('binds the exact target class, direct super and CDO by Structural references', () => {
    const good = targetFixture()
    expect(() => verifyItemActorTargetStructural(good.row.targetObject, good.pkg, good.edges)).not.toThrow()
    const mutations: ((f: ReturnType<typeof targetFixture>) => void)[] = [
      (f) => { f.row.targetObject = `${f.pkg.gamePackageName}.Other_C` },
      (f) => { array(f.pkg.exports).find((entry) => record(entry.objectName).value === 'BP_CorruptedSeedsActor_C')!.objectName = { value: 'Other_C' } },
      (f) => { f.edges.splice(f.edges.findIndex((edge) => edge.kind === 'super' && record(edge.sourceOccurrence).sourceObject === 'BP_CorruptedSeedsActor_C'), 1) },
      (f) => { f.edges.push(structuredClone(f.edges.find((edge) => edge.kind === 'super' && record(edge.sourceOccurrence).sourceObject === 'BP_CorruptedSeedsActor_C')!)) },
      (f) => { f.edges.find((edge) => edge.kind === 'super' && record(edge.sourceOccurrence).sourceObject === 'BP_CorruptedSeedsActor_C')!.targetObject = '/Script/Dungeons.Other' },
      (f) => { f.edges.find((edge) => edge.kind === 'super' && record(edge.sourceOccurrence).sourceObject === 'BP_CorruptedSeedsActor_C')!.targetKind = 'export' },
      (f) => { record(f.edges.find((edge) => edge.kind === 'super' && record(edge.sourceOccurrence).sourceObject === 'BP_CorruptedSeedsActor_C')!.sourceOccurrence).sourceObject = 'Other_C' },
      (f) => { array(f.pkg.exports).splice(array(f.pkg.exports).findIndex((entry) => entry.isClassDefaultObject === true), 1) },
      (f) => { record(record(array(f.pkg.exports).find((entry) => entry.isClassDefaultObject === true)!.references).class).rawPackageIndex = 99 },
    ]
    for (const mutate of mutations) {
      const changed = targetFixture()
      mutate(changed)
      expect(() => verifyItemActorTargetStructural(changed.row.targetObject, changed.pkg, changed.edges)).toThrow()
    }
  })
})

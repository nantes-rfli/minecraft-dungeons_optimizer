import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import { readHorizontalRawFactInventory } from '../scripts/formal-value-horizontal-source.ts'
import { readHorizontalRelationWaveSources } from '../scripts/formal-relation-horizontal-wave-sources.ts'
import { resolveHorizontalArtifactEffectRelationSource, type ArtifactEffectRelationSourceRequest } from '../scripts/formal-relation-horizontal-source.ts'
import type { HorizontalRawFactInventory, JsonRecord } from '../scripts/game-data-horizontal-fact-inventory.ts'
import { formalIdentityDefinitions, READY_ARTIFACT_EFFECT_DOMAINS } from '../src/domain/formal/identityDefinitions.ts'
import type { FormalIdentityEvidenceArtifact, RawObservationEvidenceRecord } from '../src/domain/formal/identityEvidence.ts'
import type { FormalSerializedRelationArtifact } from '../src/domain/formal/serializedRelation.ts'

const repositoryRoot = fs.realpathSync('.')
const inventory = readHorizontalRawFactInventory(repositoryRoot)
const identity = JSON.parse(fs.readFileSync('research/domain/formal/identity-evidence-v1.json', 'utf8')) as FormalIdentityEvidenceArtifact
const wave = readHorizontalRelationWaveSources({ repositoryRoot, identity, inventory })
const artifact = JSON.parse(fs.readFileSync('research/domain/formal/serialized-relation-v2.json', 'utf8')) as FormalSerializedRelationArtifact
const newDomains = READY_ARTIFACT_EFFECT_DOMAINS.filter((domainId) => domainId !== 'death-cap-mushroom')
const record = (value: unknown): JsonRecord => value as JsonRecord
const array = (value: unknown): JsonRecord[] => value as JsonRecord[]

function fixture(): { request: ArtifactEffectRelationSourceRequest; inventory: HorizontalRawFactInventory; candidate: JsonRecord; source: JsonRecord } {
  const domainId = newDomains[0]!
  const definition = formalIdentityDefinitions.find(({ assertion }) => assertion.domainId === domainId)!
  const packagePath = definition.assertion.applicationScope.packagePath
  const item = structuredClone(inventory.items.find((entry) => entry.category === 'artifact' && entry.catalogId === domainId)!) as JsonRecord
  const candidate = array(record(item.rawCandidate).candidates).find((entry) => entry.packagePath === packagePath)!
  const sourceRelations = array(record(inventory).sourceRelations)
  const root = array(candidate.relations).find((reference) => {
    const source = sourceRelations.find((entry) => entry.edgeId === reference.edgeId)
    return reference.sourceRelationPathId === 'rp-root' && source?.propertyPath === 'Effect'
  })!
  const value = structuredClone(inventory) as HorizontalRawFactInventory
  const selectedItem = value.items.find((entry) => entry.category === 'artifact' && entry.catalogId === domainId)!
  const selectedCandidate = array(record(selectedItem.rawCandidate).candidates).find((entry) => entry.packagePath === packagePath)!
  const selectedSource = array(record(value).sourceRelations).find((entry) => entry.edgeId === root.edgeId)!
  const semantic = identity.semantic.identities.find((entry) => entry.assertionId === definition.assertion.id)!
  const evidence = identity.provenance.evidence.filter((entry): entry is RawObservationEvidenceRecord =>
    entry.kind === 'raw-observation' && semantic.resolution.evidenceRefs.includes(entry.id))
  return { request: { category: 'artifact', relationKind: 'effect', propertyPath: 'Effect', catalogId: domainId, candidatePackage: packagePath,
    edgeId: String(root.edgeId), definition, identity: structuredClone(semantic), identityEvidence: evidence },
  inventory: value, candidate: selectedCandidate, source: selectedSource }
}

const resolve = (f: ReturnType<typeof fixture>) => resolveHorizontalArtifactEffectRelationSource(repositoryRoot, f.inventory, f.request)

describe('Artifact Effect Formal Relation breadth', () => {
  it('uses the exact reviewed ready set and nine new source grounded scope inputs', () => {
    expect(READY_ARTIFACT_EFFECT_DOMAINS).toHaveLength(10)
    expect(newDomains).toHaveLength(9)
    expect(new Set(wave.artifactEffect.map((entry) => entry.sourceDomainId))).toEqual(new Set(newDomains))
    for (const input of wave.artifactEffect) {
      expect(input.relationRef).toBe(`relation:${input.sourceDomainId}:effect@1`)
      expect(input.occurrence).toEqual({ domainId: input.sourceDomainId, scopeRef: 'source' })
      expect(input.serializedTargetResolution.state).toBe('resolved-local-package')
      const edge = record(input.structuralEdge)
      expect(edge.kind).toBe('object-property')
      expect(edge.sourcePackage).toBe(input.source.packagePath)
      expect(record(edge.sourceOccurrence).propertyPath).toBe('Effect')
      expect(edge.targetKind).toBe('import')
      expect(edge.targetObject).toBe(`${input.target.gamePackagePath}.${input.target.objectName}`)
    }
    const effects = artifact.relationProjections.filter((entry) => entry.relationRef.endsWith(':effect@1'))
    expect(effects).toHaveLength(10)
    expect(new Set(effects.map((entry) => entry.occurrence.domainId))).toEqual(new Set(READY_ARTIFACT_EFFECT_DOMAINS))
    expect(artifact.relationCollections.some((entry) => READY_ARTIFACT_EFFECT_DOMAINS.includes(entry.domainId as typeof READY_ARTIFACT_EFFECT_DOMAINS[number]))).toBe(false)
    expect(artifact.semantic.relations).toHaveLength(225)
    expect(artifact.relationProjections).toHaveLength(225)
    expect(artifact.relationCollections).toHaveLength(58)
    expect(new Set(artifact.semantic.relations.map((entry) => entry.sourceDomainId)).size).toBe(145)
    expect(effects.filter((entry) => entry.occurrence.domainId !== 'death-cap-mushroom').every((entry) =>
      entry.result === 'projected' && entry.targetRawVerification.input === 'not-supplied'
      && entry.targetRawVerification.result === 'not-resolved'
      && entry.targetRawVerification.reason === 'target-snapshot-not-supplied')).toBe(true)
    expect(artifact.relationProjections.filter((entry) => entry.relationRef.endsWith(':gear-actor@1'))).toHaveLength(71)
  }, 180_000)

  it('fails closed on catalog, package, root, edge, target and identity drift', () => {
    const good = fixture()
    expect(resolve(good).serializedTargetResolution.state).toBe('resolved-local-package')
    const mutations: ((f: ReturnType<typeof fixture>) => void)[] = [
      (f) => { f.request.catalogId = 'wrong-catalog' },
      (f) => { f.request.candidatePackage = 'wrong-package' },
      (f) => { f.request.edgeId = 'wrong-edge' },
      (f) => { f.candidate.packagePath = 'wrong-package' },
      (f) => { array(f.candidate.relations).find((entry) => entry.edgeId === f.request.edgeId)!.sourceRelationPathId = 'not-root' },
      (f) => { f.source.propertyPath = 'WrongProperty' },
      (f) => { f.source.relationKind = 'soft-object-property' },
      (f) => { f.source.sourcePackage = 'wrong-source' },
      (f) => { f.source.targetObject = 'wrong-target' },
      (f) => { f.source.targetPackage = 'wrong-target-package' },
      (f) => { f.source.targetKind = 'null' },
      (f) => { f.source.targetState = 'missing-target' },
      (f) => { f.request.identity.assertionId = 'wrong-identity' },
      (f) => { f.candidate.candidatePackageProvenance = { ...record(f.candidate.candidatePackageProvenance), packageHash: 'wrong-hash' } },
      (f) => { f.candidate.candidatePackageProvenance = { ...record(f.candidate.candidatePackageProvenance), sourceShardUncompressedSha256: 'wrong-hash' } },
      (f) => { array(f.candidate.relations).splice(array(f.candidate.relations).findIndex((entry) => entry.edgeId === f.request.edgeId), 1) },
      (f) => { array(f.candidate.relations).push(structuredClone(array(f.candidate.relations).find((entry) => entry.edgeId === f.request.edgeId)!)) },
      (f) => { array(record(f.inventory).sourceRelations).push(structuredClone(f.source)) },
      (f) => { array(record(f.inventory).sourceRelations).splice(array(record(f.inventory).sourceRelations).findIndex((entry) => entry.edgeId === f.request.edgeId), 1) },
    ]
    for (const mutate of mutations) {
      const changed = fixture()
      mutate(changed)
      expect(() => resolve(changed)).toThrow()
    }
  }, 180_000)
})

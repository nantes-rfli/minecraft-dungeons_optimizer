import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  readHorizontalRawFactInventory,
} from '../scripts/formal-value-horizontal-source.ts'
import {
  resolveHorizontalRelationSource,
  type HorizontalRelationSourceRequest,
} from '../scripts/formal-relation-horizontal-source.ts'
import { hasVerifiedStructuralPackage } from '../scripts/formal-value-source-provenance.ts'
import type { HorizontalRawFactInventory, JsonRecord } from '../scripts/game-data-horizontal-fact-inventory.ts'
import { formalIdentityDefinitions } from '../src/domain/formal/identityDefinitions.ts'
import type {
  FormalIdentityDefinition,
  FormalIdentityEvidenceArtifact,
  FormalSemanticIdentity,
  RawObservationEvidenceRecord,
} from '../src/domain/formal/identityEvidence.ts'
import {
  horizontalRelationDefinition,
  serializedTargetResolutionFromStructuralEdge,
} from '../src/domain/formal/serializedRelation.ts'

const repositoryRoot = fs.realpathSync('.')
const inventory = readHorizontalRawFactInventory(repositoryRoot)
const identityArtifact = JSON.parse(
  fs.readFileSync('research/domain/formal/identity-evidence-v1.json', 'utf8'),
) as FormalIdentityEvidenceArtifact

const record = (value: unknown): JsonRecord => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('expected record')
  return value as JsonRecord
}
const array = (value: unknown): JsonRecord[] => {
  if (!Array.isArray(value)) throw new Error('expected array')
  return value.map(record)
}

type Fixture = {
  category: 'melee' | 'ranged'
  definition: FormalIdentityDefinition
  identity: FormalSemanticIdentity
  identityEvidence: RawObservationEvidenceRecord[]
  item: JsonRecord
  candidate: JsonRecord
  edgeId: string
  sourceIndex: number
}

function committedIdentity(definition: FormalIdentityDefinition) {
  const identity = identityArtifact.semantic.identities.find(({ assertionId }) => assertionId === definition.assertion.id)
  if (!identity || identity.resolution.state !== 'matched') throw new Error(`${definition.assertion.id}: matched Identity missing`)
  const evidence = identityArtifact.provenance.evidence.filter(
    (entry): entry is RawObservationEvidenceRecord =>
      entry.kind === 'raw-observation' && identity.resolution.evidenceRefs.includes(entry.id),
  )
  return { identity, evidence }
}

function fixture(category: 'melee' | 'ranged', domainId: string): Fixture {
  const definition = formalIdentityDefinitions.find(({ assertion }) => assertion.domainId === domainId)
  if (!definition) throw new Error(`${domainId}: Formal definition missing`)
  const item = inventory.items.map(record).find((entry) => entry.category === category && entry.catalogId === domainId)
  if (!item) throw new Error(`${domainId}: Horizontal item missing`)
  const rawCandidate = record(item.rawCandidate)
  const candidate = array(rawCandidate.candidates).find(
    (entry) => entry.packagePath === definition.assertion.applicationScope.packagePath,
  )
  if (!candidate) throw new Error(`${domainId}: candidate package missing`)
  const expected = horizontalRelationDefinition(domainId, category)
  const sourceRelations = array((inventory as unknown as JsonRecord).sourceRelations)
  const relationRefs = array(candidate.relations)
  const matches = relationRefs.flatMap((reference) => {
    const sourceMatches = sourceRelations.filter((source) => source.edgeId === reference.edgeId)
    if (sourceMatches.length !== 1) return []
    const source = sourceMatches[0]!
    const propertyPath = source.propertyPath
    return reference.sourcePackage === definition.assertion.applicationScope.packagePath
      && reference.sourceRelationPathId === 'rp-root'
      && source.sourcePackage === definition.assertion.applicationScope.packagePath
      && typeof source.arrayIndex === 'number'
      && typeof propertyPath === 'string'
      && propertyPath.includes(expected.parentRawField)
      && (propertyPath === expected.childRawField || propertyPath.endsWith(`.${expected.childRawField}`))
      ? [{ reference, source }]
      : []
  })
  if (matches.length === 0) throw new Error(`${domainId}: first-wave relation fixture missing`)
  const selected = matches[0]!
  const { identity, evidence } = committedIdentity(definition)
  return {
    category,
    definition,
    identity,
    identityEvidence: evidence,
    item,
    candidate,
    edgeId: String(selected.reference.edgeId),
    sourceIndex: Number(selected.source.arrayIndex),
  }
}

const melee = fixture('melee', 'anchor')
const ranged = fixture('ranged', 'bow')
const trickbow = fixture('ranged', 'trickbow')
const fighters = fixture('melee', 'fighters-bindings')

function minimalInventory(f: Fixture): HorizontalRawFactInventory {
  const sourceRelations = array((inventory as unknown as JsonRecord).sourceRelations)
  const candidateRefs = array(f.candidate.relations)
  const referencedIds = new Set(candidateRefs.map((reference) => String(reference.edgeId)))
  const clonedCandidate = structuredClone(f.candidate)
  const clonedItem = structuredClone(f.item)
  record(clonedItem.rawCandidate).candidates = [clonedCandidate]
  return {
    schemaVersion: 1,
    artifactKind: 'horizontal-raw-fact-inventory',
    inventoryIdentity: structuredClone((inventory as unknown as JsonRecord).inventoryIdentity),
    sourceRelations: sourceRelations.filter((source) => referencedIds.has(String(source.edgeId))).map((source) => structuredClone(source)),
    items: [clonedItem],
  } as unknown as HorizontalRawFactInventory
}

function request(f: Fixture, overrides: Partial<HorizontalRelationSourceRequest> = {}): HorizontalRelationSourceRequest {
  return {
    category: f.category,
    catalogId: f.definition.assertion.domainId,
    candidatePackage: f.definition.assertion.applicationScope.packagePath,
    edgeId: f.edgeId,
    sourceIndex: f.sourceIndex,
    definition: f.definition,
    identity: f.identity,
    identityEvidence: f.identityEvidence,
    ...overrides,
  }
}

function candidateFrom(value: HorizontalRawFactInventory): JsonRecord {
  const item = value.items.map(record)[0]!
  return array(record(item.rawCandidate).candidates)[0]!
}

function sourceRelation(value: HorizontalRawFactInventory, edgeId: string): JsonRecord {
  const match = array((value as unknown as JsonRecord).sourceRelations).find((entry) => entry.edgeId === edgeId)
  if (!match) throw new Error(`${edgeId}: source relation missing`)
  return match
}

describe('Structural-backed serialized target resolution', () => {
  const localTarget = 'Dungeons/Content/Test/Target'
  const structuralPackagePaths = new Set([localTarget])
  const edge = (stopReason: string, overrides: JsonRecord = {}): JsonRecord => ({
    targetPackage: localTarget,
    targetKind: 'import',
    traversal: { stopReason },
    ...overrides,
  })

  it('resolves a local target only when the verified Structural package exists', () => {
    expect(serializedTargetResolutionFromStructuralEdge(edge('followed'), structuralPackagePaths)).toEqual({
      state: 'resolved-local-package',
      structuralPackagePath: localTarget,
    })
    expect(serializedTargetResolutionFromStructuralEdge(edge('followed'), new Set())).toEqual({
      state: 'missing-target',
    })
  })

  it.each([
    ['missing-target', edge('missing-target'), 'missing-target'],
    ['native-boundary', edge('native-boundary'), 'native-boundary'],
    ['outside-game-boundary', edge('outside-game-boundary'), 'outside-game-boundary'],
    ['known-null', edge('null-reference', { targetKind: 'null' }), 'known-null'],
    ['parser-boundary', edge('parser-boundary'), 'parser-boundary'],
  ])('keeps %s ahead of a targetPackage string', (_label, structuralEdge, state) => {
    expect(serializedTargetResolutionFromStructuralEdge(structuralEdge, structuralPackagePaths)).toEqual({ state })
  })

  it('checks exact package membership through verified Structural shards', () => {
    const datasetId = String(record((inventory as unknown as JsonRecord).inventoryIdentity).datasetId)
    expect(hasVerifiedStructuralPackage(repositoryRoot, melee.definition.assertion.applicationScope.packagePath, datasetId)).toBe(true)
    expect(hasVerifiedStructuralPackage(repositoryRoot, 'Dungeons/Content/__MISSING_STRUCTURAL_PACKAGE__', datasetId)).toBe(false)
    expect(() => hasVerifiedStructuralPackage(repositoryRoot, melee.definition.assertion.applicationScope.packagePath, 'wrong-dataset'))
      .toThrow(/dataset identity mismatch/)
  })
})

describe('Horizontal Raw -> Formal Relation source adapter foundation', () => {
  it.each([
    ['Melee AttackSequence', melee, 'configured-attacks', 'attack-sequence'],
    ['Ranged Projectile', ranged, 'projectile-definitions', 'projectile'],
  ] as const)('accepts one correct %s fixture', (_label, f, collectionRef, relationKind) => {
    const resolved = resolveHorizontalRelationSource(repositoryRoot, minimalInventory(f), request(f))
    expect(resolved.sourceDomainId).toBe(f.definition.assertion.domainId)
    expect(resolved.occurrence).toEqual({
      domainId: f.definition.assertion.domainId,
      collectionRef,
      sourceIndex: f.sourceIndex,
    })
    expect(resolved.relationRef).toBe(`relation:${f.definition.assertion.domainId}:${relationKind}@1`)
    expect(resolved.serializedTargetResolution.state).toBe('resolved-local-package')
    expect(resolved.source.artifactPath).toMatch(/^research\/raw\/game-data-raw-structural-inventory\/shards\/part-\d+\.json\.gz$/)
  }, 20_000)

  it('rejects unknown or duplicate edgeId identity', () => {
    const value = minimalInventory(melee)
    expect(() => resolveHorizontalRelationSource(repositoryRoot, value, request(melee, { edgeId: 'missing-edge' })))
      .toThrow(/edgeId does not resolve exactly once/)

    const duplicate = minimalInventory(melee)
    const candidate = candidateFrom(duplicate)
    candidate.relations = [...array(candidate.relations), structuredClone(array(candidate.relations).find((entry) => entry.edgeId === melee.edgeId)!)]
    expect(() => resolveHorizontalRelationSource(repositoryRoot, duplicate, request(melee)))
      .toThrow(/edgeId does not resolve exactly once/)
  })

  it('rejects non-root and candidate/source package mismatch', () => {
    const nonRoot = minimalInventory(melee)
    const relation = array(candidateFrom(nonRoot).relations).find((entry) => entry.edgeId === melee.edgeId)!
    relation.sourceRelationPathId = 'rp-not-root'
    expect(() => resolveHorizontalRelationSource(repositoryRoot, nonRoot, request(melee))).toThrow(/rp-root/)

    const foreign = minimalInventory(melee)
    const foreignRef = array(candidateFrom(foreign).relations).find((entry) => entry.edgeId === melee.edgeId)!
    foreignRef.sourcePackage = 'Dungeons/Content/Other'
    expect(() => resolveHorizontalRelationSource(repositoryRoot, foreign, request(melee))).toThrow(/candidatePackage == sourcePackage/)
  })

  it.each([
    ['Structural edge relationKind', (source: JsonRecord) => { source.relationKind = 'tampered-kind' }],
    ['propertyPath', (source: JsonRecord) => { source.propertyPath = 'ConfiguredAttackVariants[0].WrongChild' }],
    ['target object', (source: JsonRecord) => { source.targetObject = 'WrongTarget_C' }],
    ['target package', (source: JsonRecord) => { source.targetPackage = 'Dungeons/Content/WrongTarget' }],
  ])('rejects wrong %s', (_label, mutate) => {
    const value = minimalInventory(melee)
    mutate(sourceRelation(value, melee.edgeId))
    expect(() => resolveHorizontalRelationSource(repositoryRoot, value, request(melee))).toThrow()
  })

  it('rejects wrong arrayIndex/sourceIndex and cannot borrow a sibling edge', () => {
    const wrongIndex = minimalInventory(melee)
    expect(() => resolveHorizontalRelationSource(
      repositoryRoot,
      wrongIndex,
      request(melee, { sourceIndex: melee.sourceIndex + 1000 }),
    )).toThrow(/sourceIndex/)

    const sibling = array(melee.candidate.relations).find((entry) => entry.edgeId !== melee.edgeId)
    expect(sibling).toBeTruthy()
    const siblingEdgeId = String(sibling!.edgeId)
    expect(() => resolveHorizontalRelationSource(
      repositoryRoot,
      minimalInventory(melee),
      request(melee, { edgeId: siblingEdgeId }),
    )).toThrow()
  })

  it('rejects wrong source package hash and Structural provenance drift', () => {
    const value = minimalInventory(melee)
    record(candidateFrom(value).candidatePackageProvenance).packageHash = 'wrong-package-hash'
    expect(() => resolveHorizontalRelationSource(repositoryRoot, value, request(melee))).toThrow(/package hash mismatch/)
  })

  it('rejects foreign or incorrectly bound Formal Identity evidence', () => {
    const foreignEvidence = structuredClone(melee.identityEvidence)
    record(foreignEvidence[0]!.provenance.packageHash).value = 'foreign-source'
    expect(() => resolveHorizontalRelationSource(
      repositoryRoot,
      minimalInventory(melee),
      request(melee, { identityEvidence: foreignEvidence }),
    )).toThrow(/Identity gate/)

    const wrongIdentity = structuredClone(melee.identity)
    if (wrongIdentity.resolution.state !== 'matched') throw new Error('fixture identity not matched')
    wrongIdentity.resolution.domainId = 'wrong-domain'
    expect(() => resolveHorizontalRelationSource(
      repositoryRoot,
      minimalInventory(melee),
      request(melee, { identity: wrongIdentity }),
    )).toThrow(/Identity gate/)

    expect(() => resolveHorizontalRelationSource(
      repositoryRoot,
      minimalInventory(melee),
      request(melee, { identity: ranged.identity, identityEvidence: ranged.identityEvidence }),
    )).toThrow(/Identity gate/)
  })

  it('rejects duplicate sourceIndex ownership before choosing the first match', () => {
    const value = minimalInventory(melee)
    const candidate = candidateFrom(value)
    const originalRef = array(candidate.relations).find((entry) => entry.edgeId === melee.edgeId)!
    const originalSource = sourceRelation(value, melee.edgeId)
    const fakeEdgeId = `${melee.edgeId}-duplicate-occurrence`
    candidate.relations = [...array(candidate.relations), { ...structuredClone(originalRef), edgeId: fakeEdgeId }]
    ;((value as unknown as JsonRecord).sourceRelations as JsonRecord[]).push({
      ...structuredClone(originalSource),
      edgeId: fakeEdgeId,
    })
    expect(() => resolveHorizontalRelationSource(repositoryRoot, value, request(melee)))
      .toThrow(/occurrence does not resolve exactly once/)
  })

  it('keeps ChargedProjectileDefinition separate from the primary ProjectileDefinition child', () => {
    const resolved = resolveHorizontalRelationSource(repositoryRoot, minimalInventory(trickbow), request(trickbow))
    expect(resolved.occurrence.sourceIndex).toBe(0)
    expect(resolved.target.objectName).toBe('BP_TrickBowArrow_C')
  })

  it('binds a direct full Raw Identity to identical Structural package content', () => {
    const raw = JSON.parse(fs.readFileSync(
      `research/raw/packages/${fighters.definition.assertion.applicationScope.packagePath}.raw.json`, 'utf8'))
    expect(() => resolveHorizontalRelationSource(repositoryRoot, minimalInventory(fighters), request(fighters)))
      .toThrow(/Identity gate/)
    expect(resolveHorizontalRelationSource(repositoryRoot, minimalInventory(fighters),
      request(fighters, { identitySource: raw })).sourceDomainId).toBe('fighters-bindings')
    raw.logicalPackage.contentHash.value = 'other'
    expect(() => resolveHorizontalRelationSource(repositoryRoot, minimalInventory(fighters),
      request(fighters, { identitySource: raw }))).toThrow(/Identity gate/)
  })
})

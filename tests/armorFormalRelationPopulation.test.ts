import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { RawPackageSnapshot } from '../scripts/game-data-raw-package.ts'
import type { HorizontalRawFactInventory, JsonRecord } from '../scripts/game-data-horizontal-fact-inventory.ts'
import { loadStructuralGraph } from '../scripts/game-data-horizontal-fact-inventory.ts'
import { readHorizontalRawFactInventory } from '../scripts/formal-value-horizontal-source.ts'
import { readHorizontalRelationWaveSources } from '../scripts/formal-relation-horizontal-wave-sources.ts'
import {
  resolveHorizontalArmorScopeRelationSource,
  type ArmorScopeRelationSourceRequest,
} from '../scripts/formal-relation-horizontal-source.ts'
import {
  battleRobeFormalIdentity,
  deathCapMushroomFormalIdentity,
  readyArmorFormalIdentities,
  scatterCrossbowFormalIdentity,
} from '../src/domain/formal/identityDefinitions.ts'
import {
  projectFormalIdentity,
  type FormalIdentityEvidenceArtifact,
  type FormalSemanticIdentity,
  type RawObservationEvidenceRecord,
} from '../src/domain/formal/identityEvidence.ts'
import {
  buildFormalSerializedRelationArtifact,
  deathCapMushroomRelationDefinition,
  scatterCrossbowRelationDefinition,
  type FormalRelationInputs,
} from '../src/domain/formal/serializedRelation.ts'

const repositoryRoot = fs.realpathSync('.')
const identityArtifact = JSON.parse(
  fs.readFileSync('research/domain/formal/identity-evidence-v1.json', 'utf8'),
) as FormalIdentityEvidenceArtifact
const inventory = readHorizontalRawFactInventory(repositoryRoot)
const structuralPackagePaths = new Set(loadStructuralGraph(repositoryRoot).packagesByPath.keys())
const wave = readHorizontalRelationWaveSources({ repositoryRoot, identity: identityArtifact, inventory })

const asRecord = (value: unknown): JsonRecord => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('expected record')
  return value as JsonRecord
}
const asArray = (value: unknown): JsonRecord[] => {
  if (!Array.isArray(value)) throw new Error('expected array')
  return value.map(asRecord)
}
const readRaw = (packagePath: string): RawPackageSnapshot =>
  JSON.parse(fs.readFileSync(`research/raw/packages/${packagePath}.raw.json`, 'utf8')) as RawPackageSnapshot

function source(definition: typeof scatterCrossbowFormalIdentity) {
  const raw = readRaw(definition.assertion.applicationScope.packagePath)
  const projected = projectFormalIdentity(raw, definition)
  return {
    source: raw,
    identity: projected.semantic,
    identityEvidence: projected.evidence.filter((record): record is RawObservationEvidenceRecord =>
      record.kind === 'raw-observation'),
  }
}

function relationInputs(includeArmor: boolean): FormalRelationInputs {
  return {
    structuralPackagePaths,
    scatter: {
      ...source(scatterCrossbowFormalIdentity),
      target: readRaw(scatterCrossbowRelationDefinition.targetRawPath),
    },
    battleRobe: source(battleRobeFormalIdentity),
    deathCapMushroom: {
      ...source(deathCapMushroomFormalIdentity),
      target: readRaw(deathCapMushroomRelationDefinition.targetRawPath),
    },
    horizontalRelations: [
      ...wave.melee,
      ...wave.ranged,
    ].filter(({ occurrence }) => occurrence.domainId !== 'scatter-crossbow')
      .concat(includeArmor ? wave.armor : []),
  }
}

function committedIdentity(domainId: string): {
  identity: FormalSemanticIdentity
  evidence: RawObservationEvidenceRecord[]
} {
  const definition = readyArmorFormalIdentities.find(({ assertion }) => assertion.domainId === domainId)
  if (!definition) throw new Error(`${domainId}: Armor definition missing`)
  const identity = identityArtifact.semantic.identities.find(({ assertionId }) => assertionId === definition.assertion.id)
  if (!identity || identity.resolution.state !== 'matched') throw new Error(`${domainId}: matched Identity missing`)
  const evidence = identityArtifact.provenance.evidence.filter(
    (entry): entry is RawObservationEvidenceRecord =>
      entry.kind === 'raw-observation' && identity.resolution.evidenceRefs.includes(entry.id),
  )
  return { identity, evidence }
}

function armorFixture() {
  const definition = readyArmorFormalIdentities[0]!
  const domainId = definition.assertion.domainId
  const packagePath = definition.assertion.applicationScope.packagePath
  const item = inventory.items.map(asRecord).find((entry) => entry.category === 'armor' && entry.catalogId === domainId)
  if (!item) throw new Error(`${domainId}: Horizontal item missing`)
  const candidate = asArray(asRecord(item.rawCandidate).candidates)
    .find((entry) => entry.packagePath === packagePath)
  if (!candidate) throw new Error(`${domainId}: candidate missing`)
  const sourceRelations = asArray(asRecord(inventory).sourceRelations)
  const root = asArray(candidate.relations).flatMap((reference) => {
    const matches = sourceRelations.filter((entry) => entry.edgeId === reference.edgeId)
    if (matches.length !== 1) return []
    const relation = matches[0]!
    return reference.sourcePackage === packagePath
      && reference.sourceRelationPathId === 'rp-root'
      && relation.sourcePackage === packagePath
      && relation.relationKind === 'object-property'
      && relation.propertyPath === 'GearActor'
      ? [{ reference, relation }] : []
  })
  if (root.length !== 1) throw new Error(`${domainId}: root GearActor fixture missing`)
  const { identity, evidence } = committedIdentity(domainId)
  const request: ArmorScopeRelationSourceRequest = {
    category: 'armor',
    catalogId: domainId,
    candidatePackage: packagePath,
    edgeId: String(root[0]!.reference.edgeId),
    definition,
    identity,
    identityEvidence: evidence,
  }
  return { definition, item, candidate, request }
}

function minimalArmorInventory(): {
  value: HorizontalRawFactInventory
  candidate: JsonRecord
  sourceRelation: JsonRecord
} {
  const fixture = armorFixture()
  const candidate = structuredClone(fixture.candidate)
  const item = structuredClone(fixture.item)
  asRecord(item.rawCandidate).candidates = [candidate]
  const referenceIds = new Set(asArray(candidate.relations).map((entry) => String(entry.edgeId)))
  const sourceRelations = asArray(asRecord(inventory).sourceRelations)
    .filter((entry) => referenceIds.has(String(entry.edgeId)))
    .map((entry) => structuredClone(entry))
  const value = {
    schemaVersion: 1,
    artifactKind: 'horizontal-raw-fact-inventory',
    inventoryIdentity: structuredClone(asRecord(inventory).inventoryIdentity),
    sourceRelations,
    items: [item],
  } as unknown as HorizontalRawFactInventory
  const sourceRelation = sourceRelations.find((entry) => entry.edgeId === fixture.request.edgeId)
  if (!sourceRelation) throw new Error('fixture source relation missing')
  return { value, candidate, sourceRelation }
}

describe('Armor GearActor Formal Relation breadth', () => {
  it('source-backs exactly 70 new Armor scope relations through root GearActor Structural edges', () => {
    expect(wave.armor).toHaveLength(70)
    expect(new Set(wave.armor.map(({ occurrence }) => occurrence.domainId)).size).toBe(70)
    for (const input of wave.armor) {
      expect(input.relationRef).toBe(`relation:${input.occurrence.domainId}:gear-actor@1`)
      expect(input.occurrence).toEqual({ domainId: input.sourceDomainId, scopeRef: 'source' })
      expect(input.serializedTargetResolution.state).toBe('resolved-local-package')
      const edge = asRecord(input.structuralEdge)
      const sourceOccurrence = asRecord(edge.sourceOccurrence)
      expect(edge.kind).toBe('object-property')
      expect(edge.sourcePackage).toBe(input.source.packagePath)
      expect(sourceOccurrence.propertyPath).toBe('GearActor')
      expect(edge.targetKind).toBe('import')
      expect(typeof edge.targetPackage).toBe('string')
      expect(typeof edge.targetObject).toBe('string')
      expect(input.source.nodePointer).toMatch(/^\/edges\/\d+$/)
    }
  }, 30_000)

  it('adds 70 scope relations while preserving all existing 135 Relation records and collections', () => {
    const before = buildFormalSerializedRelationArtifact(relationInputs(false))
    const after = buildFormalSerializedRelationArtifact(relationInputs(true))
    expect(before.semantic.relations).toHaveLength(135)
    expect(before.relationProjections).toHaveLength(135)
    expect(before.relationCollections).toHaveLength(58)
    expect(after.semantic.relations).toHaveLength(205)
    expect(after.relationProjections).toHaveLength(205)
    expect(after.relationCollections).toEqual(before.relationCollections)

    for (const relation of before.semantic.relations) {
      expect(after.semantic.relations.find(({ projectionRef }) => projectionRef === relation.projectionRef)).toEqual(relation)
    }
    for (const projection of before.relationProjections) {
      expect(after.relationProjections.find(({ projectionRef }) => projectionRef === projection.projectionRef)).toEqual(projection)
    }
    for (const evidence of before.provenance.evidence) {
      expect(after.provenance.evidence.find(({ id }) => id === evidence.id)).toEqual(evidence)
    }

    const armor = after.relationProjections.filter(({ relationRef }) => relationRef.endsWith(':gear-actor@1'))
    expect(armor).toHaveLength(71)
    expect(new Set(armor.map(({ occurrence }) => occurrence.domainId)).size).toBe(71)
    expect(after.relationCollections.some(({ domainId }) =>
      armor.some(({ occurrence }) => occurrence.domainId === domainId))).toBe(false)
    expect(armor.filter(({ occurrence }) => occurrence.domainId !== 'battle-robe').every((record) =>
      record.result === 'projected'
      && record.serializedTargetResolution.state === 'resolved-local-package'
      && record.targetRawVerification.input === 'not-supplied'
      && record.targetRawVerification.result === 'not-resolved'
      && record.targetRawVerification.reason === 'target-snapshot-not-supplied')).toBe(true)

    const battleRef = 'projection:relation:battle-robe:gear-actor@1:source'
    expect(after.relationProjections.find(({ projectionRef }) => projectionRef === battleRef))
      .toEqual(before.relationProjections.find(({ projectionRef }) => projectionRef === battleRef))
    expect(after.semantic.relations.find(({ projectionRef }) => projectionRef === battleRef))
      .toEqual(before.semantic.relations.find(({ projectionRef }) => projectionRef === battleRef))
  }, 30_000)

  it('fails closed on Armor root GearActor source drift', () => {
    const fixture = armorFixture()

    const wrongCatalog = minimalArmorInventory()
    asRecord(wrongCatalog.value.items[0]).catalogId = 'wrong-domain'
    expect(() => resolveHorizontalArmorScopeRelationSource(repositoryRoot, wrongCatalog.value, fixture.request))
      .toThrow(/catalog item does not resolve exactly once/)

    const duplicate = minimalArmorInventory()
    const rootRef = asArray(duplicate.candidate.relations).find((entry) => entry.edgeId === fixture.request.edgeId)!
    duplicate.candidate.relations = [...asArray(duplicate.candidate.relations), structuredClone(rootRef)]
    expect(() => resolveHorizontalArmorScopeRelationSource(repositoryRoot, duplicate.value, fixture.request))
      .toThrow(/root occurrence does not resolve exactly once|edgeId does not resolve exactly once/)

    const nonRoot = minimalArmorInventory()
    asArray(nonRoot.candidate.relations).find((entry) => entry.edgeId === fixture.request.edgeId)!.sourceRelationPathId = 'rp-not-root'
    expect(() => resolveHorizontalArmorScopeRelationSource(repositoryRoot, nonRoot.value, fixture.request))
      .toThrow(/root occurrence does not resolve exactly once|rp-root/)

    const wrongPackage = minimalArmorInventory()
    asArray(wrongPackage.candidate.relations).find((entry) => entry.edgeId === fixture.request.edgeId)!.sourcePackage =
      'Dungeons/Content/Other'
    expect(() => resolveHorizontalArmorScopeRelationSource(repositoryRoot, wrongPackage.value, fixture.request))
      .toThrow(/root occurrence does not resolve exactly once|candidatePackage == sourcePackage/)

    const wrongProperty = minimalArmorInventory()
    wrongProperty.sourceRelation.propertyPath = 'WrongProperty'
    expect(() => resolveHorizontalArmorScopeRelationSource(repositoryRoot, wrongProperty.value, fixture.request))
      .toThrow(/root occurrence does not resolve exactly once|occurrence binding mismatch/)

    const wrongTarget = minimalArmorInventory()
    wrongTarget.sourceRelation.targetObject = 'WrongTarget_C'
    expect(() => resolveHorizontalArmorScopeRelationSource(repositoryRoot, wrongTarget.value, fixture.request))
      .toThrow(/does not match its exact Structural edge/)

    expect(() => resolveHorizontalArmorScopeRelationSource(repositoryRoot, minimalArmorInventory().value, {
      ...fixture.request,
      edgeId: 'missing-edge',
    })).toThrow()
  }, 30_000)
})

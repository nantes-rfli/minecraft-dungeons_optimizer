import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  horizontalCollectionFieldFromResolved,
  horizontalScalarFieldFromResolved,
  readHorizontalCollectionField,
  readHorizontalRawFactInventory,
  readHorizontalScalarField,
  resolveDirectHorizontalSourceFact,
  type ResolvedHorizontalSourceFact,
} from '../scripts/formal-value-horizontal-source.ts'
import { verifyValueRawTraceProvenance } from '../scripts/formal-value-source-provenance.ts'
import { matchedIdentityDomainIdFromSource } from '../src/domain/formal/boundarySource.ts'
import { formalIdentityDefinitions } from '../src/domain/formal/identityDefinitions.ts'
import type {
  FormalIdentityEvidenceArtifact,
  FormalSemanticIdentity,
  RawObservationEvidenceRecord,
} from '../src/domain/formal/identityEvidence.ts'
import type { FormalValueAvailabilityArtifact } from '../src/domain/formal/valueAvailability.ts'
import { horizontalMeleeValueMappings } from '../src/domain/formal/horizontalValueMappings.ts'

type JsonRecord = Record<string, unknown>

const repositoryRoot = fs.realpathSync('.')
const inventory = readHorizontalRawFactInventory(repositoryRoot)
const anchorDefinition = formalIdentityDefinitions.find(({ assertion }) => assertion.domainId === 'anchor')!
const anchorPackage = anchorDefinition.assertion.applicationScope.packagePath
const mapping = horizontalMeleeValueMappings('anchor')
const identityArtifact = JSON.parse(
  fs.readFileSync('research/domain/formal/identity-evidence-v1.json', 'utf8'),
) as FormalIdentityEvidenceArtifact
const anchorIdentity = identityArtifact.semantic.identities.find(({ assertionId }) => assertionId === anchorDefinition.assertion.id)!
const anchorIdentityEvidence = identityArtifact.provenance.evidence.filter(
  (record): record is RawObservationEvidenceRecord =>
    record.kind === 'raw-observation' && anchorIdentity.resolution.evidenceRefs.includes(record.id),
)

const record = (value: unknown): JsonRecord => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('expected record')
  return value as JsonRecord
}

function anchorCandidate(value = inventory): JsonRecord {
  const item = value.items.map(record).find((entry) => entry.category === 'melee' && entry.catalogId === 'anchor')
  if (!item) throw new Error('anchor item missing')
  const rawCandidate = record(item.rawCandidate)
  const candidates = (rawCandidate.candidates as unknown[]).map(record)
  const candidate = candidates.find((entry) => entry.packagePath === anchorPackage)
  if (!candidate) throw new Error('anchor candidate missing')
  return candidate
}

function sourceFacts(value = inventory): JsonRecord[] {
  return ((value as unknown as JsonRecord).sourceFacts as unknown[]).map(record)
}

function directFactRefs(value = inventory): JsonRecord[] {
  return (anchorCandidate(value).facts as unknown[]).map(record).filter((ref) => {
    const source = record(ref.source)
    return source.candidatePackage === anchorPackage && source.sourcePackage === anchorPackage && source.relationPathId === 'rp-root'
  })
}

function sourceFactById(value: typeof inventory, sourceFactId: string): JsonRecord {
  const found = sourceFacts(value).find((fact) => fact.factId === sourceFactId)
  if (!found) throw new Error(`source fact missing: ${sourceFactId}`)
  return found
}

function directFact(
  predicate: (fact: JsonRecord) => boolean,
  value = inventory,
): { ref: JsonRecord; fact: JsonRecord; sourceFactId: string } {
  for (const ref of directFactRefs(value)) {
    const sourceFactId = String(ref.sourceFactId)
    const fact = sourceFactById(value, sourceFactId)
    if (predicate(fact)) return { ref, fact, sourceFactId }
  }
  throw new Error('matching direct fact missing')
}

function attackSources(value = inventory) {
  const parent = directFact((fact) =>
    fact.propertyName === 'ConfiguredAttackVariants' && fact.factKind === 'property-occurrence', value)
  const elements = directFactRefs(value).flatMap((ref) => {
    const sourceFactId = String(ref.sourceFactId)
    const fact = sourceFactById(value, sourceFactId)
    return fact.propertyName === 'ConfiguredAttackVariants' && fact.factKind === 'array-element-occurrence'
      ? [{ ref, fact, sourceFactId }]
      : []
  })
  return { parent, elements }
}

function resolve(sourceFactId: string, value = inventory): ResolvedHorizontalSourceFact {
  return resolveDirectHorizontalSourceFact(repositoryRoot, value, {
    category: 'melee',
    catalogId: 'anchor',
    candidatePackage: anchorPackage,
    sourceFactId,
  })
}

describe('Horizontal Raw -> Formal Value source adapter foundation', () => {
  it('resolves one sourceFact to the exact committed Structural Inventory occurrence', () => {
    const damage = directFact((fact) => fact.propertyName === 'Damage' && fact.availabilityState === 'known')
    const resolved = resolve(damage.sourceFactId)
    expect(resolved.propertyName).toBe('Damage')
    expect(resolved.availabilityState).toBe('known')
    expect(resolved.raw.packagePath).toBe(anchorPackage)
    expect(resolved.raw.artifactPath).toMatch(/^research\/raw\/game-data-raw-structural-inventory\/shards\/part-\d+\.json\.gz$/)
    expect(verifyValueRawTraceProvenance(repositoryRoot, resolved.raw).sourceKind).toBe('structural-inventory-shard')
  })

  it('rejects missing or duplicate sourceFact identity', () => {
    expect(() => resolve('sf-does-not-exist')).toThrow(/sourceFactId does not resolve exactly once/)

    const damage = directFact((fact) => fact.propertyName === 'Damage' && fact.availabilityState === 'known')
    const duplicate = structuredClone(inventory)
    const facts = (duplicate as unknown as JsonRecord).sourceFacts as unknown[]
    facts.push(structuredClone(sourceFactById(duplicate, damage.sourceFactId)))
    expect(() => resolve(damage.sourceFactId, duplicate)).toThrow(/sourceFactId does not resolve exactly once/)
  })

  it.each([
    ['dataset', (value: typeof inventory, sourceFactId: string) => {
      record(sourceFactById(value, sourceFactId).source).datasetId = 'different-dataset'
    }, /dataset identity mismatch/],
    ['shard hash', (value: typeof inventory, sourceFactId: string) => {
      record(sourceFactById(value, sourceFactId).source).sourceShardUncompressedSha256 = 'different-shard'
    }, /shard uncompressed hash mismatch/],
    ['package hash', (value: typeof inventory, sourceFactId: string) => {
      record(sourceFactById(value, sourceFactId).source).sourcePackageHash = 'different-package'
    }, /source package hash mismatch/],
  ])('rejects %s provenance mismatch', (_label, mutate, expected) => {
    const damage = directFact((fact) => fact.propertyName === 'Damage' && fact.availabilityState === 'known')
    const changed = structuredClone(inventory)
    mutate(changed, damage.sourceFactId)
    expect(() => resolve(damage.sourceFactId, changed)).toThrow(expected)
  })

  it('rejects non-root direct-wave facts and candidate/source package mismatch', () => {
    const damage = directFact((fact) => fact.propertyName === 'Damage' && fact.availabilityState === 'known')

    const traversed = structuredClone(inventory)
    const traversedRef = directFactRefs(traversed).find((ref) => ref.sourceFactId === damage.sourceFactId)!
    record(traversedRef.source).relationPathId = 'rp-not-root'
    expect(() => resolve(damage.sourceFactId, traversed)).toThrow(/relationPathId=rp-root/)

    const mismatched = structuredClone(inventory)
    const mismatchRef = directFactRefs(mismatched).find((ref) => ref.sourceFactId === damage.sourceFactId)!
    record(mismatchRef.source).sourcePackage = 'Dungeons/Content/Other'
    expect(() => resolve(damage.sourceFactId, mismatched)).toThrow(/candidatePackage == sourcePackage/)
  })

  it('preserves collection sourceIndex from recorded elementIndex and child ownership', () => {
    const attacks = attackSources()
    const field = readHorizontalCollectionField(repositoryRoot, inventory, {
      category: 'melee',
      catalogId: 'anchor',
      candidatePackage: anchorPackage,
      parentSourceFactId: attacks.parent.sourceFactId,
      elementSourceFactIds: attacks.elements.map(({ sourceFactId }) => sourceFactId),
      mappingId: mapping.entries.id,
      identityAssertionId: anchorDefinition.assertion.id,
      expectedPropertyName: mapping.entries.rawField,
    })
    expect(field.state).toBe('known')
    if (field.state !== 'known') return
    const expected = attacks.elements
      .map(({ fact }) => Number(record(fact.occurrence).elementIndex))
      .sort((left, right) => left - right)
    expect([...field.value].sort((left, right) => left - right)).toEqual(expected)

    const first = attacks.elements[0]!
    const parentPointer = String(record(first.fact.source).propertyPointer)
    const damage = directFact((fact) =>
      fact.propertyName === 'Damage'
      && String(record(fact.source).propertyPointer).startsWith(`${parentPointer}/properties/`))
    const child = readHorizontalScalarField<number>(repositoryRoot, inventory, {
      category: 'melee',
      catalogId: 'anchor',
      candidatePackage: anchorPackage,
      sourceFactId: damage.sourceFactId,
      sourceIndexFactId: first.sourceFactId,
      mappingId: mapping.damage.id,
      identityAssertionId: anchorDefinition.assertion.id,
      expectedPropertyName: mapping.damage.rawField,
      expectedPropertyType: 'FloatProperty',
      valueType: 'number',
    })
    expect(child.field.state).toBe('known')
    expect(child.sourceIndex).toBe(record(first.fact.occurrence).elementIndex)
  })

  it('keeps invalid or duplicate sourceIndex unavailable and preserves decoded empty arrays', () => {
    const attacks = attackSources()
    const parent = resolve(attacks.parent.sourceFactId)
    const elements = attacks.elements.map(({ sourceFactId }) => resolve(sourceFactId))
    expect(elements.length).toBeGreaterThan(0)

    const invalid = structuredClone(elements)
    invalid[0]!.sourceIndex = -1
    expect(horizontalCollectionFieldFromResolved(
      parent, invalid, mapping.entries.id, anchorDefinition.assertion.id, mapping.entries.rawField,
    )).toMatchObject({ state: 'unknown', reason: expect.stringContaining('sourceIndex') })

    const duplicateParent = structuredClone(parent)
    const duplicateParentRecord = record(duplicateParent.node)
    const duplicateDecoding = record(duplicateParentRecord.decoding)
    const duplicateRawElements = [...(duplicateDecoding.elements as unknown[])]
    duplicateRawElements.push(structuredClone(duplicateRawElements[0]))
    duplicateParentRecord.decoding = { ...duplicateDecoding, elements: duplicateRawElements }
    const duplicate = structuredClone(elements)
    const second = structuredClone(duplicate[0]!)
    second.propertyPointer = `${parent.propertyPointer}/decoding/elements/1`
    second.raw.nodePointer = second.raw.nodePointer.replace(/\/decoding\/elements\/0$/, '/decoding/elements/1')
    duplicate.push(second)
    expect(horizontalCollectionFieldFromResolved(
      duplicateParent, duplicate, mapping.entries.id, anchorDefinition.assertion.id, mapping.entries.rawField,
    )).toMatchObject({ state: 'unknown', reason: expect.stringContaining('duplicate') })

    const emptyParent = structuredClone(parent)
    emptyParent.node = {
      ...record(emptyParent.node),
      decoding: { state: 'decoded', elements: [] },
    }
    expect(horizontalCollectionFieldFromResolved(
      emptyParent, [], mapping.entries.id, anchorDefinition.assertion.id, mapping.entries.rawField,
    )).toMatchObject({ state: 'known', value: [] })
  })

  it('preserves known zero and false without truthiness fallback', () => {
    const damage = directFact((fact) => fact.propertyName === 'Damage' && fact.availabilityState === 'known')
    const base = resolve(damage.sourceFactId)

    const zero = structuredClone(base)
    zero.sourceFact = { ...zero.sourceFact, decodedValue: 0 }
    expect(horizontalScalarFieldFromResolved<number>(
      zero, mapping.damage.id, anchorDefinition.assertion.id, 'Damage', 'FloatProperty', 'number',
    )).toMatchObject({ state: 'known', value: 0 })

    const disabled = structuredClone(base)
    disabled.propertyName = 'SyntheticFlag'
    disabled.propertyType = 'BoolProperty'
    disabled.sourceFact = { ...disabled.sourceFact, decodedValue: false }
    expect(horizontalScalarFieldFromResolved<boolean>(
      disabled, 'anchor:synthetic-flag@1', anchorDefinition.assertion.id, 'SyntheticFlag', 'BoolProperty', 'boolean',
    )).toMatchObject({ state: 'known', value: false })
  })

  it('applies the matched same-source Formal Identity gate to Structural provenance', () => {
    const attacks = attackSources()
    const source = resolve(attacks.parent.sourceFactId).raw
    expect(matchedIdentityDomainIdFromSource(
      source, anchorDefinition, anchorIdentity, anchorIdentityEvidence,
    )).toBe('anchor')

    const wrongSource = structuredClone(source)
    wrongSource.packageHash.value = 'different-source'
    expect(matchedIdentityDomainIdFromSource(
      wrongSource, anchorDefinition, anchorIdentity, anchorIdentityEvidence,
    )).toBeUndefined()

    const unresolved = structuredClone(anchorIdentity) as FormalSemanticIdentity
    unresolved.resolution = {
      state: 'unresolved',
      assertionId: anchorDefinition.assertion.id,
      evidenceRefs: [...anchorIdentity.resolution.evidenceRefs],
    }
    expect(matchedIdentityDomainIdFromSource(
      source, anchorDefinition, unresolved, anchorIdentityEvidence,
    )).toBeUndefined()
  })

  it('verifies both existing full Raw snapshot and Structural shard Value provenance', () => {
    const valueArtifact = JSON.parse(
      fs.readFileSync('research/domain/formal/value-availability-v2.json', 'utf8'),
    ) as FormalValueAvailabilityArtifact
    const fullRaw = valueArtifact.provenance.evidence[0]!.provenance
    expect(verifyValueRawTraceProvenance(repositoryRoot, fullRaw).sourceKind).toBe('full-raw-snapshot')

    const attacks = attackSources()
    const structural = resolve(attacks.parent.sourceFactId).raw
    expect(verifyValueRawTraceProvenance(repositoryRoot, structural).sourceKind).toBe('structural-inventory-shard')

    const wrongDataset = structuredClone(structural)
    wrongDataset.datasetId = 'different-dataset'
    expect(() => verifyValueRawTraceProvenance(repositoryRoot, wrongDataset)).toThrow(/dataset identity mismatch/)

    const wrongNode = structuredClone(structural)
    wrongNode.nodePointer = '/packages/999/not-there'
    expect(() => verifyValueRawTraceProvenance(repositoryRoot, wrongNode)).toThrow(/package/)
  })
})

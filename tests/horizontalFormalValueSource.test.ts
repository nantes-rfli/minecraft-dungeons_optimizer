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
import { readMeleeConfiguredValues } from '../src/domain/formal/configuredValueReaders.ts'
import {
  battleRobeFormalIdentity,
  deathCapMushroomFormalIdentity,
  fightersBindingsFormalIdentity,
  formalIdentityDefinitions,
  scatterCrossbowFormalIdentity,
} from '../src/domain/formal/identityDefinitions.ts'
import {
  projectFormalIdentity,
  type FormalIdentityEvidenceArtifact,
  type FormalSemanticIdentity,
  type RawObservationEvidenceRecord,
} from '../src/domain/formal/identityEvidence.ts'
import {
  buildFormalValueAvailabilityArtifact,
  collectFormalValueAvailabilityErrors,
  type FormalHorizontalConfiguredValueSource,
  type FormalValueAvailabilityArtifact,
} from '../src/domain/formal/valueAvailability.ts'
import { horizontalMeleeValueMappings } from '../src/domain/formal/horizontalValueMappings.ts'
import { battleRobeRelationDefinition, buildFormalSerializedRelationArtifact, deathCapMushroomRelationDefinition, scatterCrossbowRelationDefinition } from '../src/domain/formal/serializedRelation.ts'

type JsonRecord = Record<string, unknown>

const repositoryRoot = fs.realpathSync('.')
const inventory = readHorizontalRawFactInventory(repositoryRoot)
const structuralPackagePaths = new Set([
  scatterCrossbowRelationDefinition.targetRawPath,
  battleRobeRelationDefinition.targetRawPath,
  deathCapMushroomRelationDefinition.targetRawPath,
])
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

function withClonedSourceFact(sourceFactId: string): typeof inventory {
  const facts = sourceFacts()
  const index = facts.findIndex((fact) => fact.factId === sourceFactId)
  if (index < 0) throw new Error(`source fact missing: ${sourceFactId}`)
  const fact = { ...facts[index]!, source: { ...record(facts[index]!.source) } }
  const changed = { ...inventory, sourceFacts: [...facts] } as unknown as typeof inventory & { sourceFacts: JsonRecord[] }
  changed.sourceFacts[index] = fact
  return changed
}

function withChangedCandidateReference(sourceFactId: string, mutate: (source: JsonRecord) => void): typeof inventory {
  const items = ((inventory as unknown as JsonRecord).items as unknown[]).map(record)
  const itemIndex = items.findIndex((item) => item.category === 'melee' && item.catalogId === 'anchor')
  const item = items[itemIndex]!
  const rawCandidate = record(item.rawCandidate)
  const candidates = (rawCandidate.candidates as unknown[]).map(record)
  const candidateIndex = candidates.findIndex((candidate) => candidate.packagePath === anchorPackage)
  const candidate = candidates[candidateIndex]!
  const facts = (candidate.facts as unknown[]).map(record)
  const factIndex = facts.findIndex((fact) => fact.sourceFactId === sourceFactId)
  if (factIndex < 0) throw new Error(`candidate source fact missing: ${sourceFactId}`)
  const ref = facts[factIndex]!
  facts[factIndex] = { ...ref, source: { ...record(ref.source) } }
  mutate(record(record(facts[factIndex]!).source))
  candidates[candidateIndex] = { ...candidate, facts }
  items[itemIndex] = { ...item, rawCandidate: { ...rawCandidate, candidates } }
  return { ...inventory, items } as unknown as typeof inventory
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

function readRaw(packagePath: string) {
  return JSON.parse(fs.readFileSync(`research/raw/packages/${packagePath}.raw.json`, 'utf8'))
}

function currentValueInputs() {
  const source = (definition: typeof fightersBindingsFormalIdentity) => {
    const raw = readRaw(definition.assertion.applicationScope.packagePath)
    const projected = projectFormalIdentity(raw, definition)
    return {
      source: raw,
      identity: projected.semantic,
      identityEvidence: projected.evidence.filter(
        (evidence): evidence is RawObservationEvidenceRecord => evidence.kind === 'raw-observation',
      ),
    }
  }
  const fighters = source(fightersBindingsFormalIdentity)
  const scatter = source(scatterCrossbowFormalIdentity)
  const projectile = readRaw(scatterCrossbowRelationDefinition.targetRawPath)
  return {
    fightersBindingsRaw: fighters.source,
    scatterCrossbowInstanceRaw: scatter.source,
    scatterCrossbowProjectileRaw: projectile,
    fightersBindingsIdentity: fighters.identity,
    fightersBindingsIdentityEvidence: fighters.identityEvidence,
    scatterCrossbowIdentity: scatter.identity,
    scatterCrossbowIdentityEvidence: scatter.identityEvidence,
    relations: buildFormalSerializedRelationArtifact({
      structuralPackagePaths,
      scatter: { ...scatter, target: projectile },
      battleRobe: source(battleRobeFormalIdentity),
      deathCapMushroom: source(deathCapMushroomFormalIdentity),
    }),
  }
}

function horizontalMeleeSource(): Extract<FormalHorizontalConfiguredValueSource, { category: 'melee' }> {
  const attacks = attackSources()
  const parent = readHorizontalCollectionField(repositoryRoot, inventory, {
    category: 'melee',
    catalogId: 'anchor',
    candidatePackage: anchorPackage,
    parentSourceFactId: attacks.parent.sourceFactId,
    elementSourceFactIds: attacks.elements.map(({ sourceFactId }) => sourceFactId),
    mappingId: mapping.entries.id,
    identityAssertionId: anchorDefinition.assertion.id,
    expectedPropertyName: mapping.entries.rawField,
  })
  if (parent.state !== 'known') throw new Error('anchor configured attacks unavailable in test fixture')

  const entries = attacks.elements.map(({ fact, sourceFactId }) => {
    const elementPointer = String(record(fact.source).propertyPointer)
    const sourceIndex = Number(record(fact.occurrence).elementIndex)
    const child = <T extends number | string>(
      propertyName: string,
      mappingId: string,
      expectedPropertyType = 'FloatProperty',
      valueType: 'number' | 'string' = 'number',
    ) => {
      const childFact = directFact((candidate) =>
        candidate.propertyName === propertyName
        && candidate.propertyPath === `${String(fact.propertyPath)}.${propertyName}`
        && String(record(candidate.source).propertyPointer).startsWith(`${elementPointer}/properties/`))
      const result = readHorizontalScalarField<T>(repositoryRoot, inventory, {
        category: 'melee',
        catalogId: 'anchor',
        candidatePackage: anchorPackage,
        sourceFactId: childFact.sourceFactId,
        sourceIndexFactId: sourceFactId,
        mappingId,
        identityAssertionId: anchorDefinition.assertion.id,
        expectedPropertyName: propertyName,
        expectedPropertyType,
        valueType,
      })
      if (result.sourceIndex !== sourceIndex) throw new Error('horizontal child sourceIndex fixture mismatch')
      return result.field
    }
    return {
      sourceIndex,
      configuredDamage: child<number>(mapping.damage.rawField, mapping.damage.id),
      configuredAnimationDurationSeconds: child<number>(mapping.duration.rawField, mapping.duration.id),
      configuredAttackRange: child<number>(mapping.attackRange.rawField, mapping.attackRange.id),
      configuredConeAngleDegrees: child<number>(mapping.coneAngle.rawField, mapping.coneAngle.id),
      configuredConeOffsetUnits: child<number>(mapping.coneOffset.rawField, mapping.coneOffset.id),
      configuredDamageSplashMultiplier: child<number>(mapping.splashMultiplier.rawField, mapping.splashMultiplier.id),
      configuredDamageDelaySeconds: child<number>(mapping.damageDelay.rawField, mapping.damageDelay.id),
      configuredAttackVariantType: child<string>(mapping.variantType.rawField, mapping.variantType.id, 'EnumProperty', 'string'),
      configuredVariantLoopAmount: child<number>(mapping.variantLoopAmount.rawField, mapping.variantLoopAmount.id, 'IntProperty'),
    }
  })

  return {
    category: 'melee',
    sourceProvenance: parent.trace.raw,
    definition: anchorDefinition,
    identity: anchorIdentity,
    identityEvidence: anchorIdentityEvidence,
    mapping,
    values: {
      configuredAttacks: {
        state: 'known',
        value: entries,
        trace: parent.trace,
      },
    },
  }
}

function buildWithHorizontal(source: FormalHorizontalConfiguredValueSource) {
  return buildFormalValueAvailabilityArtifact({
    ...currentValueInputs(),
    horizontalConfiguredSources: [source],
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
    const duplicate = {
      ...inventory,
      sourceFacts: [...sourceFacts(), structuredClone(sourceFactById(inventory, damage.sourceFactId))],
    } as unknown as typeof inventory
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
    const changed = withClonedSourceFact(damage.sourceFactId)
    mutate(changed, damage.sourceFactId)
    expect(() => resolve(damage.sourceFactId, changed)).toThrow(expected)
  })

  it('rejects non-root direct-wave facts and candidate/source package mismatch', () => {
    const damage = directFact((fact) => fact.propertyName === 'Damage' && fact.availabilityState === 'known')

    const traversedChanged = withChangedCandidateReference(damage.sourceFactId, source => { source.relationPathId = 'rp-not-root' })
    expect(() => resolve(damage.sourceFactId, traversedChanged)).toThrow(/relationPathId=rp-root/)

    const mismatched = withChangedCandidateReference(damage.sourceFactId, source => { source.sourcePackage = 'Dungeons/Content/Other' })
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
    Object.assign(wrongSource.packageHash, { value: 'different-source' })
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

  it('rejects cross-source Value injection before projecting the matched domain', () => {
    const source = horizontalMeleeSource()
    source.values = readMeleeConfiguredValues(
      readRaw(fightersBindingsFormalIdentity.assertion.applicationScope.packagePath),
      anchorDefinition.assertion.id,
      mapping,
    )
    expect(() => buildWithHorizontal(source)).toThrow(/sourceProvenance does not match parent collection source/)
  })

  it('rejects child Value fields whose Raw source differs from the parent collection', () => {
    const source = horizontalMeleeSource()
    if (source.values.configuredAttacks.state !== 'known') throw new Error('anchor configured attacks unavailable in test fixture')
    source.values.configuredAttacks.value[0]!.configuredDamage.trace.raw.packagePath = 'Dungeons/Content/Other'
    expect(() => buildWithHorizontal(source)).toThrow(/Horizontal Value source mismatch: configuredDamage/)
  })

  it('rejects a Horizontal field with the wrong identityAssertionId', () => {
    const source = horizontalMeleeSource()
    if (source.values.configuredAttacks.state !== 'known') throw new Error('anchor configured attacks unavailable in test fixture')
    source.values.configuredAttacks.value[0]!.configuredDamage.trace.identityAssertionId = 'identity:wrong'
    expect(() => buildWithHorizontal(source)).toThrow(/identityAssertionId mismatch: configuredDamage/)
  })

  it('rejects a Horizontal field with the wrong mappingId', () => {
    const source = horizontalMeleeSource()
    if (source.values.configuredAttacks.state !== 'known') throw new Error('anchor configured attacks unavailable in test fixture')
    source.values.configuredAttacks.value[0]!.configuredDamage.trace.mappingId = mapping.duration.id
    expect(() => buildWithHorizontal(source)).toThrow(/mappingId mismatch: configuredDamage/)
  })

  it('accepts a correctly bound Horizontal source without changing committed population', () => {
    const source = horizontalMeleeSource()
    const artifact = buildWithHorizontal(source)
    expect(artifact.semantic.melee.anchor?.configuredAttacks?.value).toEqual(
      source.values.configuredAttacks.state === 'known'
        ? source.values.configuredAttacks.value.map(({ sourceIndex }) => sourceIndex)
        : undefined,
    )
    expect(collectFormalValueAvailabilityErrors(artifact)).toEqual([])
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

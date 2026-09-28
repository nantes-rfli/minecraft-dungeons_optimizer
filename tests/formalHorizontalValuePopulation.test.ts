import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { RawPackageSnapshot } from '../scripts/game-data-raw-package.ts'
import { readHorizontalConfiguredValueSources } from '../scripts/formal-value-horizontal-wave-sources.ts'
import { collectFormalIntegrationErrors } from '../src/domain/formal/integrationAudit.ts'
import {
  fightersBindingsFormalIdentity,
  scatterCrossbowFormalIdentity,
  readyMeleeFormalIdentities,
  readyRangedFormalIdentities,
  reviewedBridgeMeleeFormalIdentities,
  reviewedBridgeRangedFormalIdentities,
  reviewedTypedRelationMeleeFormalIdentities,
  reviewedTypedRelationFormalIdentities,
} from '../src/domain/formal/identityDefinitions.ts'
import type { FormalIdentityEvidenceArtifact, FormalSemanticIdentity, RawObservationEvidenceRecord } from '../src/domain/formal/identityEvidence.ts'
import { collectFormalValueAvailabilityErrors, buildFormalValueAvailabilityArtifact, type FormalValueAvailabilityArtifact, type FormalValueInputs } from '../src/domain/formal/valueAvailability.ts'
import { scatterCrossbowRelationDefinition, type FormalSerializedRelationArtifact } from '../src/domain/formal/serializedRelation.ts'

const read = <T>(path: string): T => JSON.parse(fs.readFileSync(path, 'utf8')) as T
const identity = read<FormalIdentityEvidenceArtifact>('research/domain/formal/identity-evidence-v1.json')
const relations = read<FormalSerializedRelationArtifact>('research/domain/formal/serialized-relation-v2.json')
const valueArtifact = read<FormalValueAvailabilityArtifact>('research/domain/formal/value-availability-v2.json')
const readRaw = (packagePath: string): RawPackageSnapshot => read(`research/raw/packages/${packagePath}.raw.json`)

function committedIdentity(definition: typeof fightersBindingsFormalIdentity): {
  identity: FormalSemanticIdentity
  evidence: RawObservationEvidenceRecord[]
} {
  const semantic = identity.semantic.identities.find(({ assertionId }) => assertionId === definition.assertion.id)
  if (!semantic) throw new Error(`Missing committed Identity ${definition.assertion.id}`)
  return {
    identity: semantic,
    evidence: identity.provenance.evidence.filter((record): record is RawObservationEvidenceRecord =>
      record.kind === 'raw-observation' && semantic.resolution.evidenceRefs.includes(record.id)),
  }
}

const fightersIdentity = committedIdentity(fightersBindingsFormalIdentity)
const scatterIdentity = committedIdentity(scatterCrossbowFormalIdentity)
const reviewedTypedRelationCatchupMeleeFormalIdentities = [
  ...reviewedTypedRelationMeleeFormalIdentities,
  ...reviewedTypedRelationFormalIdentities.filter(({ assertion }) =>
    assertion.domainId === 'chill-gale-knife' || assertion.domainId === 'resolute-tempest-knife'),
]
const reviewedTypedRelationCatchupRangedFormalIdentities = reviewedTypedRelationFormalIdentities.filter(({ assertion }) =>
  assertion.domainId === 'bonebow' || assertion.domainId === 'twin-bow'
  || assertion.domainId === 'burst-gale-bow' || assertion.domainId === 'echo-of-the-valley')
const valueIdentityDefinitions = [
  fightersBindingsFormalIdentity,
  scatterCrossbowFormalIdentity,
  ...readyMeleeFormalIdentities,
  ...readyRangedFormalIdentities,
  ...reviewedBridgeMeleeFormalIdentities,
  ...reviewedBridgeRangedFormalIdentities,
  ...reviewedTypedRelationCatchupMeleeFormalIdentities,
  ...reviewedTypedRelationCatchupRangedFormalIdentities,
]
const horizontal = readHorizontalConfiguredValueSources({
  repositoryRoot: fs.realpathSync('.'),
  identity,
  definitions: valueIdentityDefinitions,
  excludedDomainIds: new Set([fightersBindingsFormalIdentity.assertion.domainId, scatterCrossbowFormalIdentity.assertion.domainId]),
})
const baseInputs: FormalValueInputs = {
  fightersBindingsRaw: readRaw(fightersBindingsFormalIdentity.assertion.applicationScope.packagePath),
  scatterCrossbowInstanceRaw: readRaw(scatterCrossbowFormalIdentity.assertion.applicationScope.packagePath),
  scatterCrossbowProjectileRaw: readRaw(scatterCrossbowRelationDefinition.targetRawPath),
  fightersBindingsIdentity: fightersIdentity.identity,
  fightersBindingsIdentityEvidence: fightersIdentity.evidence,
  scatterCrossbowIdentity: scatterIdentity.identity,
  scatterCrossbowIdentityEvidence: scatterIdentity.evidence,
  relations,
  horizontalConfiguredSources: horizontal,
}

describe('Formal Horizontal Value reviewed breadth population', () => {
  it('populates the exact matched Melee and Ranged identity sets', () => {
    expect(Object.keys(valueArtifact.semantic.melee)).toHaveLength(31)
    expect(Object.keys(valueArtifact.semantic.ranged)).toHaveLength(27)
    expect(Object.keys(valueArtifact.semantic.melee).sort()).toEqual(horizontal.filter(({ category }) => category === 'melee')
      .map(({ definition }) => definition.assertion.domainId).concat(fightersBindingsFormalIdentity.assertion.domainId).sort())
    expect(Object.keys(valueArtifact.semantic.ranged).sort()).toEqual(horizontal.filter(({ category }) => category === 'ranged')
      .map(({ definition }) => definition.assertion.domainId).concat(scatterCrossbowFormalIdentity.assertion.domainId).sort())
    expect(valueArtifact.semantic.melee).not.toHaveProperty('battle-robe')
    expect(valueArtifact.semantic.melee).not.toHaveProperty('death-cap-mushroom')
    expect(valueArtifact.semantic.ranged).not.toHaveProperty('battle-robe')
    expect(valueArtifact.semantic.ranged).not.toHaveProperty('death-cap-mushroom')
    for (const { assertion } of reviewedTypedRelationCatchupMeleeFormalIdentities) {
      expect(valueArtifact.semantic.melee).toHaveProperty(assertion.domainId)
    }
    for (const { assertion } of reviewedTypedRelationCatchupRangedFormalIdentities) {
      expect(valueArtifact.semantic.ranged).toHaveProperty(assertion.domainId)
    }
  })

  it('keeps every reviewed breadth configured fact known at its recorded Raw elementIndex', () => {
    expect(collectFormalValueAvailabilityErrors(valueArtifact)).toEqual([])
    for (const [domainId, domain] of Object.entries(valueArtifact.semantic.melee)) {
      const indices = domain.configuredAttacks!.value
      expect(domain.attacks?.map(({ sourceIndex }) => sourceIndex)).toEqual(indices)
      for (const attack of domain.attacks ?? []) {
        expect(attack).toHaveProperty('configuredDamage.value')
        expect(attack).toHaveProperty('configuredAnimationDurationSeconds.value')
        expect(attack).toHaveProperty('configuredAttackRange.value')
        expect(attack).toHaveProperty('configuredConeAngleDegrees.value')
        expect(attack).toHaveProperty('configuredConeOffsetUnits.value')
        expect(attack).toHaveProperty('configuredDamageSplashMultiplier.value')
        expect(attack).toHaveProperty('configuredDamageDelaySeconds.value')
        expect(attack).toHaveProperty('configuredAttackVariantType.value')
        expect(attack).toHaveProperty('configuredVariantLoopAmount.value')
      }
      expect(domainId.length).toBeGreaterThan(0)
    }
    for (const [domainId, domain] of Object.entries(valueArtifact.semantic.ranged)) {
      const indices = domain.configuredProjectileDefinitions!.value
      expect(domain.projectileDefinitions?.map(({ sourceIndex }) => sourceIndex)).toEqual(indices)
      for (const definition of domain.projectileDefinitions ?? []) {
        expect(definition).toHaveProperty('configuredProjectileCount.value')
        expect(definition).toHaveProperty('configuredDelaySeconds.value')
        expect(definition).toHaveProperty('configuredDelaySecondsPerProjectile.value')
        expect(definition).toHaveProperty('configuredAngleSpan.value')
      }
      expect(domainId.length).toBeGreaterThan(0)
    }
  })

  it('preserves all original representative projection and evidence records', () => {
    const baseline = read<{
      valueProjections: typeof valueArtifact.valueProjections
      evidence: typeof valueArtifact.provenance.evidence
    }>('tests/fixtures/formal-value-v2-horizontal-wave-baseline.json')
    for (const projection of baseline.valueProjections) {
      expect(valueArtifact.valueProjections.find(({ projectionId }) => projectionId === projection.projectionId)).toEqual(projection)
    }
    for (const evidence of baseline.evidence) {
      expect(valueArtifact.provenance.evidence.find(({ id }) => id === evidence.id)).toEqual(evidence)
    }
  })

  it('uses same-source Structural shard evidence for the 56 horizontally populated domains', () => {
    const identityByDomain = new Map<string, RawObservationEvidenceRecord['provenance']>()
    for (const semantic of identity.semantic.identities) {
      if (semantic.resolution.state !== 'matched') continue
      const evidence = identity.provenance.evidence.filter((record): record is RawObservationEvidenceRecord =>
        record.kind === 'raw-observation' && semantic.resolution.evidenceRefs.includes(record.id))
      if (evidence.length === 2) identityByDomain.set(semantic.resolution.domainId, evidence[0]!.provenance)
    }
    const domains = [...Object.keys(valueArtifact.semantic.melee), ...Object.keys(valueArtifact.semantic.ranged)]
      .filter((domainId) => domainId !== 'fighters-bindings' && domainId !== 'scatter-crossbow')
    expect(domains).toHaveLength(56)
    for (const domainId of domains) {
      const identitySource = identityByDomain.get(domainId)
      expect(identitySource?.artifactPath).toContain('game-data-raw-structural-inventory/shards/')
      const records = valueArtifact.valueProjections.filter(({ occurrence }) => occurrence.domainId === domainId)
      expect(records.length).toBeGreaterThan(0)
      for (const record of records) for (const ref of record.evidenceRefs ?? []) {
        const source = valueArtifact.provenance.evidence.find(({ id }) => id === ref)?.provenance
        expect(source?.artifactPath).toContain('game-data-raw-structural-inventory/shards/')
        expect(source?.artifactPath).toBe(identitySource?.artifactPath)
        expect(source?.packagePath).toBe(identitySource?.packagePath)
        expect(source?.packageHash).toEqual(identitySource?.packageHash)
        expect(source?.datasetId).toBe(identitySource?.datasetId)
        expect(source?.extractionRunId).toBe(identitySource?.extractionRunId)
      }
    }
    expect(collectFormalIntegrationErrors(identity, valueArtifact, relations)).toEqual([])
  })

  it('rejects wrong source, Identity assertion, and mapping bindings', () => {
    const wrongMapping = structuredClone(baseInputs)
    const melee = wrongMapping.horizontalConfiguredSources!.find(({ category }) => category === 'melee')!
    if (melee.category !== 'melee') throw new Error('Expected Melee source fixture')
    melee.values.configuredAttacks.trace.mappingId = 'wrong:mapping@1'
    expect(() => buildFormalValueAvailabilityArtifact(wrongMapping)).toThrow(/mappingId mismatch/)

    const wrongAssertion = structuredClone(baseInputs)
    const assertionSource = wrongAssertion.horizontalConfiguredSources!.find(({ category }) => category === 'melee')!
    if (assertionSource.category !== 'melee') throw new Error('Expected Melee source fixture')
    assertionSource.values.configuredAttacks.trace.identityAssertionId = 'identity:wrong@1'
    expect(() => buildFormalValueAvailabilityArtifact(wrongAssertion)).toThrow(/identityAssertionId mismatch/)

    const wrongSource = structuredClone(baseInputs)
    const source = wrongSource.horizontalConfiguredSources!.find(({ category }) => category === 'melee')!
    if (source.category !== 'melee' || source.values.configuredAttacks.state !== 'known') throw new Error('Expected known Melee source fixture')
    source.values.configuredAttacks.value[0]!.configuredDamage.trace.raw.packageHash = {
      ...source.values.configuredAttacks.value[0]!.configuredDamage.trace.raw.packageHash,
      value: 'wrong-source-hash',
    }
    expect(() => buildFormalValueAvailabilityArtifact(wrongSource)).toThrow(/Horizontal Value source mismatch/)
  })

  it('keeps duplicate recorded sourceIndex unavailable without renumbering entries', () => {
    const changed = structuredClone(baseInputs)
    const source = changed.horizontalConfiguredSources!.find((candidate) => candidate.category === 'melee'
      && candidate.values.configuredAttacks.state === 'known' && candidate.values.configuredAttacks.value.length > 1)
    if (!source || source.category !== 'melee' || source.values.configuredAttacks.state !== 'known') {
      throw new Error('Expected a Horizontal Melee collection with multiple recorded entries')
    }
    source.values.configuredAttacks.value[1]!.sourceIndex = source.values.configuredAttacks.value[0]!.sourceIndex
    const artifact = buildFormalValueAvailabilityArtifact(changed)
    const domainId = source.definition.assertion.domainId
    expect(artifact.semantic.melee[domainId]).toEqual({})
    expect(artifact.valueProjections.find(({ mappingId, occurrence }) => mappingId === source.mapping.entries.id
      && occurrence.domainId === domainId)).toMatchObject({ result: 'unavailable', sourceState: 'unknown' })
    expect(artifact.valueProjections.some(({ occurrence }) => occurrence.domainId === domainId && 'sourceIndex' in occurrence)).toBe(false)
  })

  it('preserves a missing child occurrence as unavailable without borrowing a sibling', () => {
    const changed = structuredClone(baseInputs)
    const source = changed.horizontalConfiguredSources!.find(({ category }) => category === 'melee')!
    if (source.category !== 'melee' || source.values.configuredAttacks.state !== 'known') throw new Error('Expected known Melee source fixture')
    const first = source.values.configuredAttacks.value[0]!
    first.configuredDamage = {
      state: 'unknown', reason: 'Required exact source property occurrence is missing or ambiguous',
      trace: first.configuredDamage.trace,
    }
    const artifact = buildFormalValueAvailabilityArtifact(changed)
    const domainId = source.definition.assertion.domainId
    const record = artifact.valueProjections.find(({ mappingId, occurrence }) => mappingId === source.mapping.damage.id
      && occurrence.domainId === domainId && 'sourceIndex' in occurrence && occurrence.sourceIndex === first.sourceIndex)
    expect(record).toMatchObject({ result: 'unavailable', failureKind: 'raw', sourceState: 'unknown' })
    expect(artifact.semantic.melee[domainId]?.attacks?.[0]).not.toHaveProperty('configuredDamage')
    expect(collectFormalValueAvailabilityErrors(artifact)).toEqual([])
  })
})

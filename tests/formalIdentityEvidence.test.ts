import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  applicationIdentity,
  collectFormalIdentityEvidenceErrors,
  projectFormalIdentity,
  type FormalIdentityEvidenceArtifact,
} from '../src/domain/formal/identityEvidence.ts'
import {
  fightersBindingsFormalIdentity,
  formalIdentityDefinitions,
} from '../src/domain/formal/identityDefinitions.ts'
import type { RawPackageSnapshot } from '../scripts/game-data-raw-package.ts'

const rawText = fs.readFileSync(`research/raw/packages/${fightersBindingsFormalIdentity.assertion.applicationScope.packagePath}.raw.json`, 'utf8')
const fixture = () => JSON.parse(rawText) as RawPackageSnapshot
const artifactFixture = () => JSON.parse(fs.readFileSync('research/domain/formal/identity-evidence-v1.json', 'utf8')) as FormalIdentityEvidenceArtifact
const project = (raw: RawPackageSnapshot) => projectFormalIdentity(raw, fightersBindingsFormalIdentity)
const cdo = (raw: RawPackageSnapshot) => raw.package.objects.find((object) => object.isClassDefaultObject)!
const property = (raw: RawPackageSnapshot, name: string) => cdo(raw).properties!.find((node) => node.name.value === name)!

describe('Formal Identity / Evidence v1', () => {
  it('commits all four slice results with review and resolution represented separately', () => {
    const artifact = artifactFixture()
    expect(collectFormalIdentityEvidenceErrors(artifact)).toEqual([])
    expect(artifact.identityAssertions.map(({ domainId, reviewState, confidence }) => ({ domainId, reviewState, confidence }))).toEqual([
      { domainId: 'fighters-bindings', reviewState: 'provisional', confidence: undefined },
      { domainId: 'scatter-crossbow', reviewState: 'accepted', confidence: 'high' },
      { domainId: 'battle-robe', reviewState: 'provisional', confidence: undefined },
      { domainId: 'death-cap-mushroom', reviewState: 'accepted', confidence: 'high' },
    ])
    expect(artifact.semantic.identities.map(({ resolution }) => resolution.state)).toEqual(['matched', 'matched', 'matched', 'matched'])
    expect(artifact.semantic.identities.map(({ resolution }) => resolution.state === 'matched' && resolution.domainId)).toEqual(formalIdentityDefinitions.map(({ assertion }) => assertion.domainId))
    expect(new Set(artifact.provenance.evidence.flatMap((record) => record.kind === 'reviewed' ? [record.role] : []))).toEqual(new Set(['support', 'limitation', 'conflict']))
  })

  it('matches only supported schema, expected package, one CDO, exact fields, types, and values', () => {
    const result = project(fixture())
    expect(result.semantic.resolution).toEqual({
      state: 'matched',
      assertionId: fightersBindingsFormalIdentity.assertion.id,
      domainId: fightersBindingsFormalIdentity.assertion.domainId,
      evidenceRefs: [
        `evidence:raw:${fightersBindingsFormalIdentity.assertion.id}:ItemIdName`,
        `evidence:raw:${fightersBindingsFormalIdentity.assertion.id}:ItemId.SerializedId`,
      ],
    })
    expect(result.semantic.rawEvidence).toMatchObject({
      itemIdName: { state: 'known', value: 'Gauntlets_Unique3' },
      serializedId: { state: 'known', value: 'Gauntlets_Unique3' },
    })
    expect(applicationIdentity(result.semantic)).toEqual({ state: 'matched', domainId: 'fighters-bindings', displayName: "Fighter's Bindings" })
  })

  it.each([
    ['wrong package', (raw: RawPackageSnapshot) => { (raw.logicalPackage as { path: string }).path = 'Dungeons/Content/Other' }],
    ['unsupported schema', (raw: RawPackageSnapshot) => { (raw as unknown as { schemaVersion: number }).schemaVersion = 3 }],
    ['missing CDO', (raw: RawPackageSnapshot) => { for (const object of raw.package.objects) (object as { isClassDefaultObject: boolean }).isClassDefaultObject = false }],
    ['ambiguous CDO', (raw: RawPackageSnapshot) => { (raw.package.objects[0] as { isClassDefaultObject: boolean }).isClassDefaultObject = true }],
  ])('keeps %s unresolved and compresses identity observations to unavailable', (_label, mutate) => {
    const raw = fixture()
    mutate(raw)
    const result = project(raw).semantic
    expect(result.resolution.state).toBe('unresolved')
    expect(result.resolution).not.toHaveProperty('domainId')
    expect(result.rawEvidence.itemIdName.state).toBe('unavailable')
    expect(result.rawEvidence.serializedId.state).toBe('unavailable')
    expect(result).not.toHaveProperty('presentation')
    expect(applicationIdentity(result)).toEqual({ state: 'unresolved' })
  })

  it('uses unavailable for a missing field and traces the real containing collection', () => {
    const raw = fixture()
    const properties = cdo(raw).properties as unknown as Array<{ name: { value: string } }>
    properties.splice(properties.findIndex((node) => node.name.value === 'ItemIdName'), 1)
    const result = project(raw)
    expect(result.semantic.rawEvidence.itemIdName).toMatchObject({ state: 'unavailable' })
    expect(result.semantic.resolution.state).toBe('unresolved')
    const evidence = result.evidence.find((record) => record.id === result.semantic.rawEvidence.itemIdName.evidenceRef)
    expect(evidence).toMatchObject({ kind: 'raw-observation', unavailableReason: 'missing-or-ambiguous-field', provenance: { nodePointer: expect.stringMatching(/\/properties$/) } })
  })

  it('uses unavailable for a wrong type while retaining the existing node provenance', () => {
    const raw = fixture()
    ;(property(raw, 'ItemIdName').type as { value: string }).value = 'IntProperty'
    const result = project(raw)
    expect(result.semantic.rawEvidence.itemIdName.state).toBe('unavailable')
    expect(result.semantic.resolution.state).toBe('unresolved')
    const evidence = result.evidence.find((record) => record.id === result.semantic.rawEvidence.itemIdName.evidenceRef)
    expect(evidence).toMatchObject({ kind: 'raw-observation', unavailableReason: 'wrong-type', provenance: { nodePointer: expect.stringMatching(/\/properties\/\d+$/) } })
  })

  it('keeps decoded Other known but unresolved, including one-match/one-conflict', () => {
    const raw = fixture()
    ;(property(raw, 'ItemIdName').decoding as { state: 'decoded'; value: string }).value = 'Other'
    const result = project(raw).semantic
    expect(result.rawEvidence.itemIdName).toMatchObject({ state: 'known', value: 'Other' })
    expect(result.rawEvidence.serializedId).toMatchObject({ state: 'known', value: fightersBindingsFormalIdentity.assertion.rawIdentity })
    expect(result.resolution.state).toBe('unresolved')
    expect(result.resolution).not.toHaveProperty('domainId')
  })

  it('separates assertion evidence from Raw resolution evidence and makes every ref local', () => {
    const artifact = artifactFixture()
    const records = new Map(artifact.provenance.evidence.map((record) => [record.id, record]))
    for (const assertion of artifact.identityAssertions) {
      expect(assertion.evidenceRefs.every((ref) => records.get(ref)?.kind === 'reviewed')).toBe(true)
      const semantic = artifact.semantic.identities.find((entry) => entry.assertionId === assertion.id)!
      expect(semantic.resolution.evidenceRefs.every((ref) => records.get(ref)?.kind === 'raw-observation')).toBe(true)
      expect(semantic.resolution.evidenceRefs.some((ref) => assertion.evidenceRefs.includes(ref))).toBe(false)
      expect(new Set(semantic.resolution.evidenceRefs)).toEqual(new Set(Object.values(semantic.rawEvidence).map(({ evidenceRef }) => evidenceRef)))
    }
  })

  it('rejects dangling refs, duplicate IDs, and silent evidence replacement', () => {
    const dangling = artifactFixture()
    dangling.identityAssertions[0]!.evidenceRefs.push('evidence:missing')
    expect(collectFormalIdentityEvidenceErrors(dangling).some((error) => error.includes('dangling'))).toBe(true)

    const duplicate = artifactFixture()
    duplicate.provenance.evidence.push(structuredClone(duplicate.provenance.evidence[0]!))
    expect(collectFormalIdentityEvidenceErrors(duplicate).some((error) => error.includes('duplicate evidence ID'))).toBe(true)

    const replaced = artifactFixture()
    const reviewed = replaced.provenance.evidence.find((record) => record.kind === 'reviewed')!
    if (reviewed.kind !== 'reviewed') throw new Error('missing reviewed evidence')
    reviewed.detail = 'silently replaced meaning'
    expect(collectFormalIdentityEvidenceErrors(replaced).some((error) => error.includes('content replaced without fingerprint update'))).toBe(true)
  })

  it('rejects a materialized matched domainId that differs from its assertion', () => {
    const artifact = artifactFixture()
    const resolution = artifact.semantic.identities[0]!.resolution
    if (resolution.state !== 'matched') throw new Error('expected matched fixture')
    resolution.domainId = 'some-independent-input'
    expect(collectFormalIdentityEvidenceErrors(artifact).some((error) => error.includes('matched domainId differs from assertion'))).toBe(true)
  })
})

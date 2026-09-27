import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  applicationIdentity,
  collectFormalIdentityEvidenceErrors,
  evidenceFingerprint,
  projectFormalIdentity,
  projectFormalIdentityObservation,
  type FormalIdentityEvidenceArtifact,
} from '../src/domain/formal/identityEvidence.ts'
import {
  corruptedSeedsFormalIdentity,
  fightersBindingsFormalIdentity,
  formalIdentityDefinitions,
  readyArtifactFormalIdentities,
  readyArmorFormalIdentities,
  readyMeleeFormalIdentities,
  readyRangedFormalIdentities,
  reviewedBridgeMeleeFormalIdentities,
  reviewedBridgeRangedFormalIdentities,
  reviewedBridgeArtifactFormalIdentities,
  reviewedBridgeArtifactFormalIdentityInputs,
  reviewedTypedRelationMeleeFormalIdentities,
  reviewedTypedRelationMeleeFormalIdentityInputs,
} from '../src/domain/formal/identityDefinitions.ts'
import type { RawPackageSnapshot } from '../scripts/game-data-raw-package.ts'
import { readFormalIdentityInventoryInputs } from '../scripts/formal-identity-inventory-source.ts'

const rawText = fs.readFileSync(`research/raw/packages/${fightersBindingsFormalIdentity.assertion.applicationScope.packagePath}.raw.json`, 'utf8')
const fixture = () => JSON.parse(rawText) as RawPackageSnapshot
const artifactFixture = () => JSON.parse(fs.readFileSync('research/domain/formal/identity-evidence-v1.json', 'utf8')) as FormalIdentityEvidenceArtifact
const armorInventoryInputs = readFormalIdentityInventoryInputs(process.cwd(), readyArmorFormalIdentities)
const reviewedArtifactInventoryInputs = readFormalIdentityInventoryInputs(process.cwd(), reviewedBridgeArtifactFormalIdentities)
const corruptedSeedsInventoryInputs = readFormalIdentityInventoryInputs(process.cwd(), [corruptedSeedsFormalIdentity])
const typedRelationMeleeInventoryInputs = readFormalIdentityInventoryInputs(process.cwd(), reviewedTypedRelationMeleeFormalIdentities)
const project = (raw: RawPackageSnapshot) => projectFormalIdentity(raw, fightersBindingsFormalIdentity)
const cdo = (raw: RawPackageSnapshot) => raw.package.objects.find((object) => object.isClassDefaultObject)!
const property = (raw: RawPackageSnapshot, name: string) => cdo(raw).properties!.find((node) => node.name.value === name)!

describe('Formal Identity / Evidence v1', () => {
  it('preserves the original 144 identities and appends the two source-backed Sawblade identities', () => {
    const artifact = artifactFixture()
    expect(collectFormalIdentityEvidenceErrors(artifact)).toEqual([])
    expect(artifact.identityAssertions.slice(0, 4).map(({ domainId, reviewState, confidence }) => ({ domainId, reviewState, confidence }))).toEqual([
      { domainId: 'fighters-bindings', reviewState: 'provisional', confidence: undefined },
      { domainId: 'scatter-crossbow', reviewState: 'accepted', confidence: 'high' },
      { domainId: 'battle-robe', reviewState: 'provisional', confidence: undefined },
      { domainId: 'death-cap-mushroom', reviewState: 'accepted', confidence: 'high' },
    ])
    expect(artifact.identityAssertions).toHaveLength(146)
    expect(artifact.semantic.identities.map(({ resolution }) => resolution.state)).toEqual(Array(146).fill('matched'))
    expect(artifact.semantic.identities.map(({ resolution }) => resolution.state === 'matched' && resolution.domainId)).toEqual(formalIdentityDefinitions.map(({ assertion }) => assertion.domainId))
    expect(artifact.identityAssertions.slice(4, 52).map(({ domainId, reviewState, confidence }) => ({ domainId, reviewState, confidence }))).toEqual(
      [...readyMeleeFormalIdentities, ...readyRangedFormalIdentities, ...reviewedBridgeMeleeFormalIdentities, ...reviewedBridgeRangedFormalIdentities].map(({ assertion }) => ({ domainId: assertion.domainId, reviewState: 'accepted', confidence: 'high' })),
    )
    expect(artifact.identityAssertions.slice(52, 58).map(({ domainId, reviewState, confidence }) => ({ domainId, reviewState, confidence }))).toEqual(
      readyArtifactFormalIdentities.map(({ assertion }) => ({ domainId: assertion.domainId, reviewState: 'accepted', confidence: 'high' })),
    )
    expect(artifact.identityAssertions.slice(58, 128).map(({ domainId, reviewState, confidence }) => ({ domainId, reviewState, confidence }))).toEqual(
      readyArmorFormalIdentities.map(({ assertion }) => ({ domainId: assertion.domainId, reviewState: 'accepted', confidence: 'high' })),
    )
    expect(artifact.identityAssertions.slice(128, 143).map(({ domainId, reviewState, confidence }) => ({ domainId, reviewState, confidence }))).toEqual(
      reviewedBridgeArtifactFormalIdentities.map(({ assertion }) => ({ domainId: assertion.domainId, reviewState: 'accepted', confidence: 'high' })),
    )
    expect(artifact.identityAssertions[143]).toMatchObject({ id: 'identity:corrupted-seeds@1', domainId: 'corrupted-seeds', rawIdentity: 'CorruptedSeeds', reviewState: 'accepted', confidence: 'high' })
    expect(artifact.semantic.identities[143]?.resolution).toMatchObject({ state: 'matched', domainId: 'corrupted-seeds' })
    expect(artifact.identityAssertions.slice(144).map(({ domainId, rawIdentity }) => ({ domainId, rawIdentity }))).toEqual([
      { domainId: 'broken-sawblade', rawIdentity: 'Chainsword' },
      { domainId: 'mechanized-sawblade', rawIdentity: 'Chainsword_Unique1' },
    ])
    expect(artifact.semantic.identities.slice(144).map(({ resolution }) => resolution.state === 'matched' ? resolution.domainId : 'unresolved')).toEqual([
      'broken-sawblade',
      'mechanized-sawblade',
    ])
    expect(reviewedTypedRelationMeleeFormalIdentityInputs.map(({ domainId, rawIdentity }) => ({ domainId, rawIdentity }))).toEqual([
      { domainId: 'broken-sawblade', rawIdentity: 'Chainsword' },
      { domainId: 'mechanized-sawblade', rawIdentity: 'Chainsword_Unique1' },
    ])
    expect(reviewedBridgeArtifactFormalIdentityInputs.map(({ domainId }) => domainId)).toEqual([
      'blast-fungus', 'corrupted-pumpkin', 'enchanted-grass', 'eye-of-the-guardian', 'harpoon-quiver', 'powershaker',
      'satchel-of-elements', 'scatter-mines', 'shadow-shifter', 'spinblade', 'totem-of-casting', 'vexing-chant',
      'buzzy-nest', 'satchel-of-elixirs', 'satchel-of-snacks',
    ])
    expect(new Set(artifact.provenance.evidence.flatMap((record) => record.kind === 'reviewed' ? [record.role] : []))).toEqual(new Set(['support', 'limitation', 'conflict']))
  })

  it('grounds the two Sawblade identities in exact Structural packages and serialized fields', () => {
    expect(typedRelationMeleeInventoryInputs).toHaveLength(2)
    for (const input of typedRelationMeleeInventoryInputs) {
      const { definition, observation } = input
      if (!observation) throw new Error('expected Sawblade Structural observation')
      expect(observation).toMatchObject({
        rawSchemaVersion: 2,
        packagePath: definition.assertion.applicationScope.packagePath,
        itemIdName: { observation: { state: 'known', value: definition.assertion.rawIdentity } },
        serializedId: { observation: { state: 'known', value: definition.assertion.rawIdentity } },
      })
      expect(projectFormalIdentityObservation(observation, definition).semantic.resolution).toMatchObject({
        state: 'matched',
        domainId: definition.assertion.domainId,
      })
    }
  })

  it('grounds all six ready-direct Artifacts in the exact structural package and both serialized identity fields', () => {
    const inputs = readFormalIdentityInventoryInputs(process.cwd(), readyArtifactFormalIdentities)
    expect(inputs).toHaveLength(6)
    for (const input of inputs) {
      if (!('observation' in input) || !input.observation) {
        throw new Error('expected inventory observation input')
      }
      const { definition, observation } = input
      expect(observation.packagePath).toBe(definition.assertion.applicationScope.packagePath)
      expect(observation.itemIdName).toMatchObject({ observation: { state: 'known', value: definition.assertion.rawIdentity }, provenance: { packagePath: definition.assertion.applicationScope.packagePath } })
      expect(observation.serializedId).toMatchObject({ observation: { state: 'known', value: definition.assertion.rawIdentity }, provenance: { packagePath: definition.assertion.applicationScope.packagePath } })
    }
  })

  it('grounds all 70 Armor identities in their exact Structural candidate and armor-audit levelId', () => {
    expect(armorInventoryInputs).toHaveLength(70)
    for (const input of armorInventoryInputs) {
      if (!('observation' in input) || !input.observation) {
        throw new Error('expected Armor inventory observation input')
      }
      const { definition, observation } = input
      const expected = definition.assertion.rawIdentity
      const packagePath = definition.assertion.applicationScope.packagePath
      expect(observation.rawSchemaVersion).toBe(2)
      expect(observation.packagePath).toBe(packagePath)
      expect(observation.itemIdName).toMatchObject({ observation: { state: 'known', value: expected }, provenance: { packagePath } })
      expect(observation.serializedId).toMatchObject({ observation: { state: 'known', value: expected }, provenance: { packagePath } })
      expect(observation.itemIdName.provenance.artifactPath).toMatch(/^research\/raw\/game-data-raw-structural-inventory\/shards\/part-\d{3}\.json\.gz$/)
      expect(observation.serializedId.provenance.artifactPath).toBe(observation.itemIdName.provenance.artifactPath)
      expect(projectFormalIdentityObservation(observation, definition).semantic.resolution).toMatchObject({ state: 'matched', domainId: definition.assertion.domainId })
    }
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


  it('reads ready Melee identity observations from hashed Raw Structural Inventory shards with node provenance', () => {
    const definition = readyMeleeFormalIdentities.find(({ assertion }) => assertion.domainId === 'anchor')!
    const input = readFormalIdentityInventoryInputs(process.cwd(), [definition])[0]!
    if (!('observation' in input) || !input.observation) throw new Error('expected inventory observation input')
    const projected = projectFormalIdentityObservation(input.observation, definition)
    expect(projected.semantic.resolution).toMatchObject({ state: 'matched', domainId: 'anchor' })
    expect(projected.semantic.rawEvidence.itemIdName).toMatchObject({ state: 'known', value: 'Anchor' })
    expect(projected.semantic.rawEvidence.serializedId).toMatchObject({ state: 'known', value: 'Anchor' })
    const rawEvidence = projected.evidence.filter((record) => record.kind === 'raw-observation')
    expect(rawEvidence).toHaveLength(2)
    for (const record of rawEvidence) {
      if (record.kind !== 'raw-observation') continue
      expect(record.provenance.artifactPath).toMatch(/^research\/raw\/game-data-raw-structural-inventory\/shards\/part-\d{3}\.json\.gz$/)
      expect(record.provenance.datasetId).toBeTruthy()
      expect(record.provenance.extractionRunId).toBeTruthy()
      expect(record.provenance.packagePath).toBe(definition.assertion.applicationScope.packagePath)
      expect(record.provenance.packageHash).toMatchObject({ algorithm: 'sha256-path-content-v1', value: expect.any(String) })
      expect(record.provenance.nodePointer).toMatch(/^\/packages\/\d+\/cdoPropertyInventory\/\d+\/properties\//)
    }
  })

  it('reads ready Ranged identity observations from hashed Raw Structural Inventory shards with exact scoped provenance', () => {
    const definition = readyRangedFormalIdentities.find(({ assertion }) => assertion.domainId === 'bow')!
    const input = readFormalIdentityInventoryInputs(process.cwd(), [definition])[0]!
    if (!('observation' in input) || !input.observation) throw new Error('expected inventory observation input')
    const projected = projectFormalIdentityObservation(input.observation, definition)
    expect(projected.semantic.resolution).toMatchObject({ state: 'matched', domainId: 'bow' })
    expect(projected.semantic.rawEvidence.itemIdName).toMatchObject({ state: 'known', value: 'Bow' })
    expect(projected.semantic.rawEvidence.serializedId).toMatchObject({ state: 'known', value: 'Bow' })
    const rawEvidence = projected.evidence.filter((record) => record.kind === 'raw-observation')
    expect(rawEvidence).toHaveLength(2)
    for (const record of rawEvidence) {
      if (record.kind !== 'raw-observation') continue
      expect(record.provenance.artifactPath).toMatch(/^research\/raw\/game-data-raw-structural-inventory\/shards\/part-\d{3}\.json\.gz$/)
      expect(record.provenance.packagePath).toBe(definition.assertion.applicationScope.packagePath)
      expect(record.provenance.nodePointer).toMatch(/^\/packages\/\d+\/cdoPropertyInventory\/\d+\/properties\//)
    }
  })

  it('reads the 3 reviewed bridge observations from the Structural Inventory with exact identity/package gates', () => {
    const definitions = [...reviewedBridgeMeleeFormalIdentities, ...reviewedBridgeRangedFormalIdentities]
    expect(definitions.map(({ assertion }) => ({ domainId: assertion.domainId, rawIdentity: assertion.rawIdentity, packagePath: assertion.applicationScope.packagePath }))).toEqual([
      { domainId: 'bonehead-hammer', rawIdentity: 'SkeletonHammer', packagePath: 'Dungeons/Content/Actors/Equipment/MeleeWeapons/SkeletonHammer/BP_SkeletonHammerInstance' },
      { domainId: 'sinister-sword', rawIdentity: 'Sword_Spooky1', packagePath: 'Dungeons/Content/Content_DLC3/Actors/Equipment/MeleeWeapons/Sword_Spooky1/BP_Sword_Spooky1Instance' },
      { domainId: 'shrieking-crossbow', rawIdentity: 'BatCrossbow', packagePath: 'Dungeons/Content/Actors/Equipment/RangedWeapons/BatCrossbow/BP_BatCrossbowInstance' },
    ])
    for (const definition of definitions) {
      const input = readFormalIdentityInventoryInputs(process.cwd(), [definition])[0]!
      if (!('observation' in input) || !input.observation) throw new Error('expected reviewed bridge inventory observation input')
      const projected = projectFormalIdentityObservation(input.observation, definition)
      expect(projected.semantic.resolution).toMatchObject({ state: 'matched', domainId: definition.assertion.domainId })
      expect(projected.semantic.rawEvidence.itemIdName).toMatchObject({ state: 'known', value: definition.assertion.rawIdentity })
      expect(projected.semantic.rawEvidence.serializedId).toMatchObject({ state: 'known', value: definition.assertion.rawIdentity })
      for (const record of projected.evidence.filter((entry) => entry.kind === 'raw-observation')) {
        if (record.kind !== 'raw-observation') continue
        expect(record.provenance.packagePath).toBe(definition.assertion.applicationScope.packagePath)
        expect(record.provenance.artifactPath).toMatch(/^research\/raw\/game-data-raw-structural-inventory\/shards\/part-\d{3}\.json\.gz$/)
      }
    }
  })

  it('grounds all 15 reviewed Artifact bridges in their exact Structural packages and both serialized identity fields', () => {
    expect(reviewedArtifactInventoryInputs).toHaveLength(15)
    for (const input of reviewedArtifactInventoryInputs) {
      if (!('observation' in input) || !input.observation) throw new Error('expected reviewed Artifact inventory observation input')
      const { definition, observation } = input
      const expected = definition.assertion.rawIdentity
      const packagePath = definition.assertion.applicationScope.packagePath
      expect(observation.rawSchemaVersion).toBe(2)
      expect(observation.packagePath).toBe(packagePath)
      expect(observation.itemIdName).toMatchObject({ observation: { state: 'known', value: expected }, provenance: { packagePath } })
      expect(observation.serializedId).toMatchObject({ observation: { state: 'known', value: expected }, provenance: { packagePath } })
      expect(observation.itemIdName.provenance.artifactPath).toMatch(/^research\/raw\/game-data-raw-structural-inventory\/shards\/part-\d{3}\.json\.gz$/)
      expect(observation.serializedId.provenance.artifactPath).toBe(observation.itemIdName.provenance.artifactPath)
      expect(projectFormalIdentityObservation(observation, definition).semantic.resolution).toMatchObject({ state: 'matched', domainId: definition.assertion.domainId })
    }
    expect(artifactFixture().identityAssertions.slice(128, 143).map(({ domainId }) => domainId)).toEqual(reviewedBridgeArtifactFormalIdentityInputs.map(({ domainId }) => domainId))
  })

  it('grounds Corrupted Seeds in its exact Raw Structural identity and independent Artifact audit record', () => {
    expect(corruptedSeedsInventoryInputs).toHaveLength(1)
    const input = corruptedSeedsInventoryInputs[0]!
    if (!('observation' in input) || !input.observation) throw new Error('expected Corrupted Seeds Structural observation')
    const packagePath = 'Dungeons/Content/Actors/Items/CorruptedSeeds/BP_CorruptedSeedsInstance'
    expect(input.observation.rawSchemaVersion).toBe(2)
    expect(input.observation.packagePath).toBe(packagePath)
    expect(input.observation.itemIdName).toMatchObject({ observation: { state: 'known', value: 'CorruptedSeeds' }, provenance: { packagePath } })
    expect(input.observation.serializedId).toMatchObject({ observation: { state: 'known', value: 'CorruptedSeeds' }, provenance: { packagePath } })
    expect(corruptedSeedsFormalIdentity.assertion.evidenceRefs).toEqual([
      'evidence:reviewed:corrupted-seeds:accepted-alias',
      'evidence:reviewed:corrupted-seeds:independent-source-id',
    ])
    expect(corruptedSeedsFormalIdentity.reviewedEvidence).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'evidence:reviewed:corrupted-seeds:independent-source-id', source: { artifactPath: 'research/artifact-audit.json', locator: 'populationDifferences[id=corrupted-seeds].internalGameIds' } }),
      expect.objectContaining({ id: 'evidence:reviewed:corrupted-seeds:accepted-alias', source: { artifactPath: 'research/domain/game-data-entity-aliases.json', locator: 'aliases[id=artifact:CorruptedSeeds]' } }),
    ]))
  })

  it.each([
    ['Melee', () => readyMeleeFormalIdentities.find(({ assertion }) => assertion.domainId === 'anchor')!],
    ['Ranged', () => readyRangedFormalIdentities.find(({ assertion }) => assertion.domainId === 'bow')!],
    ['Armor', () => readyArmorFormalIdentities.find(({ assertion }) => assertion.domainId === 'archer-s-armor')!],
    ['Reviewed Melee bridge', () => reviewedBridgeMeleeFormalIdentities.find(({ assertion }) => assertion.domainId === 'bonehead-hammer')!],
    ['Reviewed Ranged bridge', () => reviewedBridgeRangedFormalIdentities.find(({ assertion }) => assertion.domainId === 'shrieking-crossbow')!],
    ['Reviewed Artifact bridge', () => reviewedBridgeArtifactFormalIdentities.find(({ assertion }) => assertion.domainId === 'blast-fungus')!],
  ])('does not match a %s inventory observation when package or either Raw identity value drifts', (_category, selectDefinition) => {
    const definition = selectDefinition()
    const input = readFormalIdentityInventoryInputs(process.cwd(), [definition])[0]!
    if (!('observation' in input) || !input.observation) throw new Error('expected inventory observation input')

    const wrongPackage = structuredClone(input.observation)
    wrongPackage.packagePath = 'Dungeons/Content/Other'
    expect(projectFormalIdentityObservation(wrongPackage, definition).semantic.resolution.state).toBe('unresolved')

    const wrongProvenancePackage = structuredClone(input.observation)
    wrongProvenancePackage.itemIdName.provenance.packagePath = 'Dungeons/Content/Other'
    expect(projectFormalIdentityObservation(wrongProvenancePackage, definition).semantic.resolution.state).toBe('unresolved')

    const wrongItemIdName = structuredClone(input.observation)
    wrongItemIdName.itemIdName.observation = { state: 'known', value: 'Other' }
    expect(projectFormalIdentityObservation(wrongItemIdName, definition).semantic.resolution.state).toBe('unresolved')

    const wrongSerializedId = structuredClone(input.observation)
    wrongSerializedId.serializedId.observation = { state: 'known', value: 'Other' }
    expect(projectFormalIdentityObservation(wrongSerializedId, definition).semantic.resolution.state).toBe('unresolved')
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

  it('rejects Raw observation provenance from a package outside the assertion scope', () => {
    const artifact = artifactFixture()
    const assertion = artifact.identityAssertions.find(({ domainId }) => domainId === 'anchor')!
    const semantic = artifact.semantic.identities.find(({ assertionId }) => assertionId === assertion.id)!
    const record = artifact.provenance.evidence.find(({ id }) => id === semantic.rawEvidence.itemIdName.evidenceRef)!
    if (record.kind !== 'raw-observation') throw new Error('expected Raw observation evidence')
    record.provenance.packagePath = 'Dungeons/Content/Other'
    const { fingerprint: _fingerprint, ...content } = record
    void _fingerprint
    record.fingerprint = evidenceFingerprint(content)
    expect(collectFormalIdentityEvidenceErrors(artifact)).toContain(`${assertion.id}: raw observation provenance packagePath differs from assertion scope`)
  })

  it('rejects a materialized matched domainId that differs from its assertion', () => {
    const artifact = artifactFixture()
    const resolution = artifact.semantic.identities[0]!.resolution
    if (resolution.state !== 'matched') throw new Error('expected matched fixture')
    resolution.domainId = 'some-independent-input'
    expect(collectFormalIdentityEvidenceErrors(artifact).some((error) => error.includes('matched domainId differs from assertion'))).toBe(true)
  })
})

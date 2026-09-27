import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import {
  buildFormalIdentityEvidenceArtifact,
  collectFormalIdentityEvidenceErrors,
  type EvidenceRecord,
} from '../src/domain/formal/identityEvidence.ts'
import {
  battleRobeFormalIdentity,
  corruptedSeedsFormalIdentity,
  deathCapMushroomFormalIdentity,
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
  scatterCrossbowFormalIdentity,
} from '../src/domain/formal/identityDefinitions.ts'
import type { RawPackageSnapshot } from './game-data-raw-package.ts'
import { collectFormalReviewedSourceGroundingErrors, readFormalReviewedSources } from './formal-identity-source-grounding.ts'
import { readFormalIdentityInventoryInputs } from './formal-identity-inventory-source.ts'

const root = new URL('..', import.meta.url)
const repositoryRoot = fs.realpathSync(root)
const readRaw = (packagePath: string) => JSON.parse(fs.readFileSync(new URL(`research/raw/packages/${packagePath}.raw.json`, root), 'utf8')) as RawPackageSnapshot
const representativeDefinitions = [
  fightersBindingsFormalIdentity,
  scatterCrossbowFormalIdentity,
  battleRobeFormalIdentity,
  deathCapMushroomFormalIdentity,
] as const
const representativeInputs = representativeDefinitions.map((definition) => ({
  definition,
  raw: readRaw(definition.assertion.applicationScope.packagePath),
}))
const inventoryDefinitions = [...readyMeleeFormalIdentities, ...readyRangedFormalIdentities, ...reviewedBridgeMeleeFormalIdentities, ...reviewedBridgeRangedFormalIdentities, ...readyArtifactFormalIdentities, ...readyArmorFormalIdentities, ...reviewedBridgeArtifactFormalIdentities, corruptedSeedsFormalIdentity, ...reviewedTypedRelationMeleeFormalIdentities]
const inventoryInputs = readFormalIdentityInventoryInputs(repositoryRoot, inventoryDefinitions)
const artifact = buildFormalIdentityEvidenceArtifact([...representativeInputs, ...inventoryInputs])

assert.deepEqual(collectFormalIdentityEvidenceErrors(artifact), [])
assert.equal(artifact.identityAssertions.length, 146)
assert.equal(artifact.semantic.identities.filter(({ resolution }) => resolution.state === 'matched').length, 146)
assert.equal(new Set(artifact.identityAssertions.map(({ id }) => id)).size, 146, 'duplicate Formal Identity assertion')
assert.equal(new Set(artifact.identityAssertions.map(({ domainId }) => domainId)).size, 146, 'duplicate Formal Identity domain')
const matchedMelee = artifact.semantic.identities.filter(({ resolution }) =>
  resolution.state === 'matched'
  && (resolution.domainId === 'fighters-bindings' || readyMeleeFormalIdentities.some(({ assertion }) => assertion.domainId === resolution.domainId) || reviewedBridgeMeleeFormalIdentities.some(({ assertion }) => assertion.domainId === resolution.domainId) || reviewedTypedRelationMeleeFormalIdentities.some(({ assertion }) => assertion.domainId === resolution.domainId)))
assert.equal(matchedMelee.length, 29)
const matchedRanged = artifact.semantic.identities.filter(({ resolution }) =>
  resolution.state === 'matched'
  && (resolution.domainId === 'scatter-crossbow' || readyRangedFormalIdentities.some(({ assertion }) => assertion.domainId === resolution.domainId) || reviewedBridgeRangedFormalIdentities.some(({ assertion }) => assertion.domainId === resolution.domainId)))
assert.equal(matchedRanged.length, 23)
assert.equal(artifact.semantic.identities.filter(({ resolution }) => resolution.state === 'matched' && resolution.domainId === 'battle-robe').length, 1)
assert.deepEqual(artifact.semantic.identities.slice(0, 4).map(({ assertionId, resolution }) => ({
  assertionId,
  reviewState: formalIdentityDefinitions.find((definition) => definition.assertion.id === assertionId)?.assertion.reviewState,
  confidence: formalIdentityDefinitions.find((definition) => definition.assertion.id === assertionId)?.assertion.confidence,
  resolution: resolution.state,
  domainId: resolution.state === 'matched' ? resolution.domainId : undefined,
})), [
  { assertionId: 'identity:fighters-bindings@1', reviewState: 'provisional', confidence: undefined, resolution: 'matched', domainId: 'fighters-bindings' },
  { assertionId: 'identity:scatter-crossbow@1', reviewState: 'accepted', confidence: 'high', resolution: 'matched', domainId: 'scatter-crossbow' },
  { assertionId: 'identity:battle-robe@1', reviewState: 'provisional', confidence: undefined, resolution: 'matched', domainId: 'battle-robe' },
  { assertionId: 'identity:death-cap-mushroom@1', reviewState: 'accepted', confidence: 'high', resolution: 'matched', domainId: 'death-cap-mushroom' },
])
assert.deepEqual(
  artifact.semantic.identities.slice(4).map(({ resolution }) => resolution.state === 'matched' ? resolution.domainId : 'unresolved'),
  inventoryDefinitions.map(({ assertion }) => assertion.domainId),
)

const artifactDomainIds = readyArtifactFormalIdentities.map(({ assertion }) => assertion.domainId)
const reviewedArtifactDomainIds = reviewedBridgeArtifactFormalIdentities.map(({ assertion }) => assertion.domainId)
assert.deepEqual(reviewedArtifactDomainIds, [
  'blast-fungus', 'corrupted-pumpkin', 'enchanted-grass', 'eye-of-the-guardian', 'harpoon-quiver', 'powershaker',
  'satchel-of-elements', 'scatter-mines', 'shadow-shifter', 'spinblade', 'totem-of-casting', 'vexing-chant',
  'buzzy-nest', 'satchel-of-elixirs', 'satchel-of-snacks',
])
assert.equal(reviewedArtifactDomainIds.length, 15, 'new reviewed Artifact identity population drift')
assert.deepEqual(reviewedBridgeArtifactFormalIdentityInputs.map(({ domainId }) => domainId), reviewedArtifactDomainIds)
assert.deepEqual(artifact.identityAssertions.slice(52, 58).map(({ domainId }) => domainId), artifactDomainIds)
assert.deepEqual(artifact.semantic.identities.slice(52, 58).map(({ resolution }) => resolution.state === 'matched' ? resolution.domainId : 'unresolved'), artifactDomainIds)
assert.equal(artifact.semantic.identities.filter(({ resolution }) => resolution.state === 'matched' && (resolution.domainId === 'death-cap-mushroom' || artifactDomainIds.includes(resolution.domainId))).length, 7)
const armorDomainIds = readyArmorFormalIdentities.map(({ assertion }) => assertion.domainId)
assert.deepEqual(artifact.identityAssertions.slice(58, 128).map(({ domainId }) => domainId), armorDomainIds)
assert.deepEqual(artifact.semantic.identities.slice(58, 128).map(({ resolution }) => resolution.state === 'matched' ? resolution.domainId : 'unresolved'), armorDomainIds)
assert.equal(artifact.semantic.identities.filter(({ resolution }) => resolution.state === 'matched' && (resolution.domainId === 'battle-robe' || armorDomainIds.includes(resolution.domainId))).length, 71)
assert.deepEqual(artifact.identityAssertions.slice(128, 143).map(({ domainId }) => domainId), reviewedArtifactDomainIds)
assert.deepEqual(artifact.semantic.identities.slice(128, 143).map(({ resolution }) => resolution.state === 'matched' ? resolution.domainId : 'unresolved'), reviewedArtifactDomainIds)
assert.equal(artifact.semantic.identities.filter(({ resolution }) => resolution.state === 'matched' && (resolution.domainId === 'death-cap-mushroom' || resolution.domainId === corruptedSeedsFormalIdentity.assertion.domainId || artifactDomainIds.includes(resolution.domainId) || reviewedArtifactDomainIds.includes(resolution.domainId))).length, 23)
assert.deepEqual(artifact.identityAssertions[143], {
  id: 'identity:corrupted-seeds@1',
  rawIdentity: 'CorruptedSeeds',
  domainId: 'corrupted-seeds',
  reviewState: 'accepted',
  confidence: 'high',
  applicationScope: {
    rawSchemaVersion: 2,
    packagePath: 'Dungeons/Content/Actors/Items/CorruptedSeeds/BP_CorruptedSeedsInstance',
    requireUnambiguousCdo: true,
    identityFields: { itemIdName: 'ItemIdName', serializedId: 'ItemId.SerializedId' },
  },
  evidenceRefs: ['evidence:reviewed:corrupted-seeds:accepted-alias', 'evidence:reviewed:corrupted-seeds:independent-source-id'],
})
assert.equal(artifact.semantic.identities[143]?.resolution.state, 'matched')
assert.equal(artifact.semantic.identities[143]?.resolution.state === 'matched' ? artifact.semantic.identities[143]?.resolution.domainId : undefined, 'corrupted-seeds')
assert.deepEqual(artifact.identityAssertions.slice(144).map(({ domainId, rawIdentity }) => ({ domainId, rawIdentity })), [
  { domainId: 'broken-sawblade', rawIdentity: 'Chainsword' },
  { domainId: 'mechanized-sawblade', rawIdentity: 'Chainsword_Unique1' },
])
assert.deepEqual(reviewedTypedRelationMeleeFormalIdentityInputs.map(({ domainId, rawIdentity }) => ({ domainId, rawIdentity })), [
  { domainId: 'broken-sawblade', rawIdentity: 'Chainsword' },
  { domainId: 'mechanized-sawblade', rawIdentity: 'Chainsword_Unique1' },
])

for (const definition of readyArtifactFormalIdentities) {
  const input = inventoryInputs.find(({ definition: candidate }) => candidate.assertion.id === definition.assertion.id)
  assert.ok(input && 'observation' in input && input.observation, `${definition.assertion.domainId}: exact Structural package observation missing`)
  const observation = input.observation
  const expected = definition.assertion.rawIdentity
  const packagePath = definition.assertion.applicationScope.packagePath
  assert.equal(observation.packagePath, packagePath, `${definition.assertion.domainId}: exact package binding drift`)
  assert.equal(observation.itemIdName.observation.state, 'known', `${definition.assertion.domainId}: ItemIdName unavailable in ${packagePath}`)
  assert.equal(observation.itemIdName.observation.state === 'known' ? observation.itemIdName.observation.value : undefined, expected, `${definition.assertion.domainId}: ItemIdName expected ${expected} in ${packagePath}`)
  assert.equal(observation.itemIdName.provenance.packagePath, packagePath, `${definition.assertion.domainId}: ItemIdName package provenance drift`)
  assert.equal(observation.serializedId.observation.state, 'known', `${definition.assertion.domainId}: SerializedId unavailable in ${packagePath}`)
  assert.equal(observation.serializedId.observation.state === 'known' ? observation.serializedId.observation.value : undefined, expected, `${definition.assertion.domainId}: SerializedId expected ${expected} in ${packagePath}`)
  assert.equal(observation.serializedId.provenance.packagePath, packagePath, `${definition.assertion.domainId}: SerializedId package provenance drift`)
}

for (const definition of readyArmorFormalIdentities) {
  const input = inventoryInputs.find(({ definition: candidate }) => candidate.assertion.id === definition.assertion.id)
  assert.ok(input && 'observation' in input && input.observation, `${definition.assertion.domainId}: exact Structural Armor observation missing`)
  const observation = input.observation
  const expected = definition.assertion.rawIdentity
  const packagePath = definition.assertion.applicationScope.packagePath
  assert.equal(observation.packagePath, packagePath, `${definition.assertion.domainId}: exact Armor package binding drift`)
  assert.deepEqual(observation.itemIdName.observation, { state: 'known', value: expected }, `${definition.assertion.domainId}: ItemIdName must equal armor-audit levelId`)
  assert.equal(observation.itemIdName.provenance.packagePath, packagePath, `${definition.assertion.domainId}: ItemIdName package provenance drift`)
  assert.deepEqual(observation.serializedId.observation, { state: 'known', value: expected }, `${definition.assertion.domainId}: SerializedId must equal armor-audit levelId`)
  assert.equal(observation.serializedId.provenance.packagePath, packagePath, `${definition.assertion.domainId}: SerializedId package provenance drift`)
}

for (const definition of reviewedBridgeArtifactFormalIdentities) {
  const input = inventoryInputs.find(({ definition: candidate }) => candidate.assertion.id === definition.assertion.id)
  assert.ok(input && 'observation' in input && input.observation, `${definition.assertion.domainId}: exact reviewed Artifact Structural observation missing`)
  const observation = input.observation
  const expected = definition.assertion.rawIdentity
  const packagePath = definition.assertion.applicationScope.packagePath
  assert.equal(observation.packagePath, packagePath, `${definition.assertion.domainId}: reviewed Artifact package binding drift`)
  assert.deepEqual(observation.itemIdName.observation, { state: 'known', value: expected }, `${definition.assertion.domainId}: ItemIdName differs from its reviewed bridge`)
  assert.equal(observation.itemIdName.provenance.packagePath, packagePath, `${definition.assertion.domainId}: ItemIdName package provenance drift`)
  assert.deepEqual(observation.serializedId.observation, { state: 'known', value: expected }, `${definition.assertion.domainId}: SerializedId differs from its reviewed bridge`)
  assert.equal(observation.serializedId.provenance.packagePath, packagePath, `${definition.assertion.domainId}: SerializedId package provenance drift`)
}

const legacyAssertionIds = new Set(artifact.identityAssertions.slice(0, 52).map(({ id }) => id))
const legacyAssertions = artifact.identityAssertions.filter(({ id }) => legacyAssertionIds.has(id))
const legacySemantics = artifact.semantic.identities.filter(({ assertionId }) => legacyAssertionIds.has(assertionId))
const legacyEvidenceRefs = new Set(legacyAssertions.flatMap(({ evidenceRefs }) => evidenceRefs))
for (const identity of legacySemantics) {
  legacyEvidenceRefs.add(identity.rawEvidence.itemIdName.evidenceRef)
  legacyEvidenceRefs.add(identity.rawEvidence.serializedId.evidenceRef)
  identity.resolution.evidenceRefs.forEach((reference) => legacyEvidenceRefs.add(reference))
}
const legacyEvidence = artifact.provenance.evidence.filter(({ id }) => legacyEvidenceRefs.has(id))
const legacyCompatibility = { identityAssertions: legacyAssertions, semanticIdentities: legacySemantics, provenanceEvidence: legacyEvidence }
assert.equal(
  crypto.createHash('sha256').update(JSON.stringify(legacyCompatibility)).digest('hex'),
  'ba9ecba3c5d14ad64823550d71b91453cd7919de6974ad22e14a39dc42d97b59',
  'Existing 52 Formal Identity assertions, semantic identities, or provenance changed',
)

const phaseAAssertions = artifact.identityAssertions.slice(0, 58)
const phaseAAssertionIds = new Set(phaseAAssertions.map(({ id }) => id))
const phaseASemantics = artifact.semantic.identities.filter(({ assertionId }) => phaseAAssertionIds.has(assertionId))
const phaseAEvidenceRefs = new Set(phaseAAssertions.flatMap(({ evidenceRefs }) => evidenceRefs))
for (const identity of phaseASemantics) {
  phaseAEvidenceRefs.add(identity.rawEvidence.itemIdName.evidenceRef)
  phaseAEvidenceRefs.add(identity.rawEvidence.serializedId.evidenceRef)
  identity.resolution.evidenceRefs.forEach((reference) => phaseAEvidenceRefs.add(reference))
}
const phaseAEvidence = artifact.provenance.evidence.filter(({ id }) => phaseAEvidenceRefs.has(id))
assert.equal(
  crypto.createHash('sha256').update(JSON.stringify({ identityAssertions: phaseAAssertions, semanticIdentities: phaseASemantics, provenanceEvidence: phaseAEvidence })).digest('hex'),
  '39d3d140e55d2596ab24226ec3fbb1e37dbaa4445aa5d0adbc991c24bd0ffa6b',
  'Original 52 identities, Phase A six Artifacts, or Battle Robe identity/evidence/provenance changed',
)

const existing128Assertions = artifact.identityAssertions.slice(0, 128)
const existing128AssertionIds = new Set(existing128Assertions.map(({ id }) => id))
const existing128Semantics = artifact.semantic.identities.filter(({ assertionId }) => existing128AssertionIds.has(assertionId))
const existing128EvidenceRefs = new Set(existing128Assertions.flatMap(({ evidenceRefs }) => evidenceRefs))
for (const identity of existing128Semantics) {
  existing128EvidenceRefs.add(identity.rawEvidence.itemIdName.evidenceRef)
  existing128EvidenceRefs.add(identity.rawEvidence.serializedId.evidenceRef)
  identity.resolution.evidenceRefs.forEach((reference) => existing128EvidenceRefs.add(reference))
}
const existing128Evidence = artifact.provenance.evidence.filter(({ id }) => existing128EvidenceRefs.has(id))
assert.equal(
  crypto.createHash('sha256').update(JSON.stringify({ identityAssertions: existing128Assertions, semanticIdentities: existing128Semantics, provenanceEvidence: existing128Evidence })).digest('hex'),
  '3fe9b419f761db57e847814cf26a2f188fa4ea0a9cd2ca32c2ddf67386aad6fb',
  'Existing 128 Formal Identity assertions, semantic identities, or evidence/provenance changed',
)

const existing140Assertions = artifact.identityAssertions.slice(0, 140)
const existing140AssertionIds = new Set(existing140Assertions.map(({ id }) => id))
const existing140Semantics = artifact.semantic.identities.filter(({ assertionId }) => existing140AssertionIds.has(assertionId))
const existing140EvidenceRefs = new Set(existing140Assertions.flatMap(({ evidenceRefs }) => evidenceRefs))
for (const identity of existing140Semantics) {
  existing140EvidenceRefs.add(identity.rawEvidence.itemIdName.evidenceRef)
  existing140EvidenceRefs.add(identity.rawEvidence.serializedId.evidenceRef)
  identity.resolution.evidenceRefs.forEach((reference) => existing140EvidenceRefs.add(reference))
}
const existing140Evidence = artifact.provenance.evidence.filter(({ id }) => existing140EvidenceRefs.has(id))
assert.equal(
  crypto.createHash('sha256').update(JSON.stringify({ identityAssertions: existing140Assertions, semanticIdentities: existing140Semantics, provenanceEvidence: existing140Evidence })).digest('hex'),
  'b27f40a83a85a55d3e47ee6d9634f9b4b1c6faac30e4f19b9191efd9622e50d9',
  'Existing 140 Formal Identity assertions, semantic identities, or evidence/provenance changed',
)

const existing143Assertions = artifact.identityAssertions.slice(0, 143)
const existing143AssertionIds = new Set(existing143Assertions.map(({ id }) => id))
const existing143Semantics = artifact.semantic.identities.filter(({ assertionId }) => existing143AssertionIds.has(assertionId))
const existing143EvidenceRefs = new Set(existing143Assertions.flatMap(({ evidenceRefs }) => evidenceRefs))
for (const identity of existing143Semantics) {
  existing143EvidenceRefs.add(identity.rawEvidence.itemIdName.evidenceRef)
  existing143EvidenceRefs.add(identity.rawEvidence.serializedId.evidenceRef)
  identity.resolution.evidenceRefs.forEach((reference) => existing143EvidenceRefs.add(reference))
}
const existing143Evidence = artifact.provenance.evidence.filter(({ id }) => existing143EvidenceRefs.has(id))
assert.equal(
  crypto.createHash('sha256').update(JSON.stringify({ identityAssertions: existing143Assertions, semanticIdentities: existing143Semantics, provenanceEvidence: existing143Evidence })).digest('hex'),
  'bc187fb27f22d0ecc18f357cdacdccd3c0d7cfcc2d6a895e1d68405ae9784893',
  'Existing 143 Formal Identity assertions, semantic identities, or evidence/provenance changed',
)

const existing144Assertions = artifact.identityAssertions.slice(0, 144)
const existing144AssertionIds = new Set(existing144Assertions.map(({ id }) => id))
const existing144Semantics = artifact.semantic.identities.filter(({ assertionId }) => existing144AssertionIds.has(assertionId))
const existing144EvidenceRefs = new Set(existing144Assertions.flatMap(({ evidenceRefs }) => evidenceRefs))
for (const identity of existing144Semantics) {
  existing144EvidenceRefs.add(identity.rawEvidence.itemIdName.evidenceRef)
  existing144EvidenceRefs.add(identity.rawEvidence.serializedId.evidenceRef)
  identity.resolution.evidenceRefs.forEach((reference) => existing144EvidenceRefs.add(reference))
}
const existing144Evidence = artifact.provenance.evidence.filter(({ id }) => existing144EvidenceRefs.has(id))
assert.equal(
  crypto.createHash('sha256').update(JSON.stringify({ identityAssertions: existing144Assertions, semanticIdentities: existing144Semantics, provenanceEvidence: existing144Evidence })).digest('hex'),
  '4fb4d23a94744dc9623659ef4929bd43573898355f70ebc45e6be0546f05e847',
  'Existing 144 Formal Identity assertions, semantic identities, or evidence/provenance changed',
)

const roles = new Set(artifact.provenance.evidence.flatMap((record: EvidenceRecord) => record.kind === 'reviewed' ? [record.role] : []))
assert.deepEqual([...roles].sort(), ['conflict', 'limitation', 'support'])
for (const record of artifact.provenance.evidence) {
  if (record.kind === 'reviewed') assert.ok(fs.existsSync(new URL(record.source.artifactPath, root)), `${record.id}: source artifact missing`)
}
assert.deepEqual(collectFormalReviewedSourceGroundingErrors(readFormalReviewedSources(repositoryRoot)), [])
const unsupportedArmorPromotions = readyArmorFormalIdentities.filter((definition) =>
  definition.reviewedEvidence.some((record) => record.source.artifactPath !== 'research/armor-audit.json')).length
assert.equal(unsupportedArmorPromotions, 0, 'Armor identity promotion must use the armor-audit bridge, not aliases')

const target = new URL('research/domain/formal/identity-evidence-v1.json', root)
const serialized = `${JSON.stringify(artifact, null, 2)}\n`
if (process.argv.includes('--write')) {
  fs.mkdirSync(new URL('.', target), { recursive: true })
  fs.writeFileSync(target, serialized)
}
assert.equal(fs.readFileSync(target, 'utf8'), serialized, 'Formal Identity/Evidence artifact drift; run generate:formal-identity-evidence')
console.log('Formal Identity/Evidence v1 audit passed: 146 matched identities (29 Melee, 23 Ranged, 71 Armor, 23 Artifact); 2 reviewed typed-relation Melee bridges are source-grounded without generic sound-cue inference; duplicate assertions/domains 0; unsupported promotions 0; the existing 144 identities remain unchanged.')

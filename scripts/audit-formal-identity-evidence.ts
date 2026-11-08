import { fixedComboLocalizationBridges, verifyFixedObservedComboSources } from './fixed-observed-melee-combo-source.ts'
import { fixedRapidFireBridges, verifyFixedRapidFireSources } from './fixed-rapid-fire-source.ts'
import { fixedPowerBowBridges, FIXED_POWER_BOW_ALIAS_BASIS, verifyFixedPowerBowSources } from './fixed-power-bow-source.ts'
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
  reviewedTypedRelationFormalIdentities,
  reviewedTypedRelationFormalIdentityInputs,
  reviewedLocalizationMeleeFormalIdentities,
  builtinProcLocalizationFormalIdentities,
  fixedComboLocalizationFormalIdentities,
  fixedPowerBowLocalizationFormalIdentities,
  radianceComboLocalizationFormalIdentities,
  fixedRapidFireLocalizationFormalIdentities,
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
const inventoryDefinitions = [...readyMeleeFormalIdentities, ...readyRangedFormalIdentities, ...reviewedBridgeMeleeFormalIdentities, ...reviewedBridgeRangedFormalIdentities, ...readyArtifactFormalIdentities, ...readyArmorFormalIdentities, ...reviewedBridgeArtifactFormalIdentities, corruptedSeedsFormalIdentity, ...reviewedTypedRelationMeleeFormalIdentities, ...reviewedTypedRelationFormalIdentities, ...reviewedLocalizationMeleeFormalIdentities, ...builtinProcLocalizationFormalIdentities, ...fixedComboLocalizationFormalIdentities, ...fixedPowerBowLocalizationFormalIdentities, ...radianceComboLocalizationFormalIdentities, ...fixedRapidFireLocalizationFormalIdentities]
verifyFixedObservedComboSources(repositoryRoot)
verifyFixedPowerBowSources(repositoryRoot)
verifyFixedRapidFireSources(repositoryRoot)
const aliases = JSON.parse(fs.readFileSync(new URL('research/domain/game-data-entity-aliases.json', root), 'utf8')).aliases
for (const row of [...fixedPowerBowBridges, ...fixedRapidFireBridges]) {
  const matches = aliases.filter((entry: { id: string }) => entry.id === `ranged-weapon:${row.rawIdentity}`)
  assert.equal(matches.length, 1)
  const alias = matches[0]
  assert.equal(alias.rawIdentity, row.rawIdentity)
  assert.equal(alias.canonicalEntity, `ranged-weapon:${row.id}`)
  assert.equal(alias.status, 'accepted')
  assert.equal(alias.confidence, 'high')
  assert.equal(alias.basis, FIXED_POWER_BOW_ALIAS_BASIS)
  assert.deepEqual(alias.assetPaths, [row.packagePath])
}
const inventoryInputs = readFormalIdentityInventoryInputs(repositoryRoot, inventoryDefinitions)
const artifact = buildFormalIdentityEvidenceArtifact([...representativeInputs, ...inventoryInputs])

assert.deepEqual(collectFormalIdentityEvidenceErrors(artifact), [])
assert.equal(artifact.identityAssertions.length, 165)
assert.equal(artifact.semantic.identities.filter(({ resolution }) => resolution.state === 'matched').length, 165)
assert.equal(new Set(artifact.identityAssertions.map(({ id }) => id )).size, 165, 'duplicate Formal Identity assertion')
assert.equal(new Set(artifact.identityAssertions.map(({ domainId }) => domainId )).size, 165, 'duplicate Formal Identity domain')
const matchedMelee = artifact.semantic.identities.filter(({ resolution }) =>
  resolution.state === 'matched'
  && (resolution.domainId === 'fighters-bindings' || radianceComboLocalizationFormalIdentities.some(({ assertion }) => assertion.domainId === resolution.domainId) || fixedComboLocalizationFormalIdentities.some(({ assertion }) => assertion.domainId === resolution.domainId) || builtinProcLocalizationFormalIdentities.some(({ assertion }) => assertion.domainId === resolution.domainId) || reviewedLocalizationMeleeFormalIdentities.some(({ assertion }) => assertion.domainId === resolution.domainId) || readyMeleeFormalIdentities.some(({ assertion }) => assertion.domainId === resolution.domainId) || reviewedBridgeMeleeFormalIdentities.some(({ assertion }) => assertion.domainId === resolution.domainId) || reviewedTypedRelationMeleeFormalIdentities.some(({ assertion }) => assertion.domainId === resolution.domainId) || reviewedTypedRelationFormalIdentityInputs.some((input) => input.category === 'melee' && input.domainId === resolution.domainId)))
assert.equal(matchedMelee.length, 40)
const matchedRanged = artifact.semantic.identities.filter(({ resolution }) =>
  resolution.state === 'matched'
  && (resolution.domainId === 'scatter-crossbow' || fixedRapidFireLocalizationFormalIdentities.some(({ assertion }) => assertion.domainId === resolution.domainId) || fixedPowerBowLocalizationFormalIdentities.some(({ assertion }) => assertion.domainId === resolution.domainId) || readyRangedFormalIdentities.some(({ assertion }) => assertion.domainId === resolution.domainId) || reviewedBridgeRangedFormalIdentities.some(({ assertion }) => assertion.domainId === resolution.domainId) || reviewedTypedRelationFormalIdentityInputs.some((input) => input.category === 'ranged' && input.domainId === resolution.domainId)))
assert.equal(matchedRanged.length, 31)
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
const typedRelationMeleeDomainIds = reviewedTypedRelationMeleeFormalIdentities.map(({ assertion }) => assertion.domainId)
assert.deepEqual(typedRelationMeleeDomainIds, ['broken-sawblade', 'mechanized-sawblade'])
assert.deepEqual(reviewedTypedRelationMeleeFormalIdentityInputs.map(({ domainId }) => domainId), typedRelationMeleeDomainIds)
assert.deepEqual(artifact.identityAssertions.slice(144, 146).map(({ domainId }) => domainId), typedRelationMeleeDomainIds)
assert.deepEqual(artifact.semantic.identities.slice(144, 146).map(({ resolution }) => resolution.state === 'matched' ? resolution.domainId : 'unresolved'), typedRelationMeleeDomainIds)
const reviewedTypedRelationDomainIds = reviewedTypedRelationFormalIdentities.map(({ assertion }) => assertion.domainId)
assert.deepEqual(reviewedTypedRelationDomainIds, ['chill-gale-knife', 'resolute-tempest-knife', 'bonebow', 'twin-bow', 'burst-gale-bow', 'echo-of-the-valley'])
assert.deepEqual(reviewedTypedRelationFormalIdentityInputs.map(({ domainId }) => domainId), reviewedTypedRelationDomainIds)
assert.deepEqual(artifact.identityAssertions.slice(146, 152).map(({ domainId, rawIdentity, reviewState, confidence }) => ({ domainId, rawIdentity, reviewState, confidence })), [
  { domainId: 'chill-gale-knife', rawIdentity: 'TempestKnife_Unique2', reviewState: 'accepted', confidence: 'high' },
  { domainId: 'resolute-tempest-knife', rawIdentity: 'TempestKnife_Unique1', reviewState: 'accepted', confidence: 'high' },
  { domainId: 'bonebow', rawIdentity: 'Bow_Unique1', reviewState: 'accepted', confidence: 'high' },
  { domainId: 'twin-bow', rawIdentity: 'Bow_Unique2', reviewState: 'accepted', confidence: 'high' },
  { domainId: 'burst-gale-bow', rawIdentity: 'WindBow_Unique2', reviewState: 'accepted', confidence: 'high' },
  { domainId: 'echo-of-the-valley', rawIdentity: 'WindBow_Unique1', reviewState: 'accepted', confidence: 'high' },
])
assert.deepEqual(artifact.semantic.identities.slice(146, 152).map(({ resolution }) => resolution.state === 'matched' ? resolution.domainId : 'unresolved'), reviewedTypedRelationDomainIds)

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

const existing152Assertions = artifact.identityAssertions.slice(0, 152)
const existing152Ids = new Set(existing152Assertions.map(({ id }) => id))
const existing152Semantics = artifact.semantic.identities.filter(({ assertionId }) => existing152Ids.has(assertionId))
const existing152Refs = new Set(existing152Assertions.flatMap(({ evidenceRefs }) => evidenceRefs))
for (const identity of existing152Semantics) {
  existing152Refs.add(identity.rawEvidence.itemIdName.evidenceRef)
  existing152Refs.add(identity.rawEvidence.serializedId.evidenceRef)
  identity.resolution.evidenceRefs.forEach((ref) => existing152Refs.add(ref))
}
const existing152Evidence = artifact.provenance.evidence.filter(({ id }) => existing152Refs.has(id))
assert.equal(crypto.createHash('sha256').update(JSON.stringify({ identityAssertions: existing152Assertions, semanticIdentities: existing152Semantics, provenanceEvidence: existing152Evidence })).digest('hex'), '2a30406b656967c0877b12fcda208e16e0b8114b7a74c32772c3bc9f918fe686', 'Existing 152 identity/evidence records changed')
assert.deepEqual(artifact.identityAssertions.slice(152, 153).map(({ domainId, rawIdentity }) => ({ domainId, rawIdentity })), [{ domainId: 'great-hammer', rawIdentity: 'Hammer' }])

const existing153Assertions = artifact.identityAssertions.slice(0, 153)
const existing153Ids = new Set(existing153Assertions.map(({ id }) => id))
const existing153Semantics = artifact.semantic.identities.filter(({ assertionId }) => existing153Ids.has(assertionId))
// The prior main contains 642 complete evidence records, including presentation records.
const existing153Evidence = artifact.provenance.evidence.slice(0, 642)
assert.equal(artifact.provenance.evidence.length, 702, 'Only the reviewed consumer identities may append evidence')
assert.equal(crypto.createHash('sha256').update(JSON.stringify({ identityAssertions: existing153Assertions, semanticIdentities: existing153Semantics, provenanceEvidence: existing153Evidence })).digest('hex'), '4b5df9e33e1f6bee2c85f2e583bd4e1be09ff8d52ddb3609379f390d51d65685', 'Existing 153 identity/evidence records changed')
assert.deepEqual(artifact.identityAssertions.slice(153, 155).map(({ domainId, rawIdentity }) => ({ domainId, rawIdentity })), [{ domainId: 'whirlwind', rawIdentity: 'DoubleAxe_Unique1' }, { domainId: 'stormlander', rawIdentity: 'Hammer_Unique1' }])

assert.deepEqual(artifact.identityAssertions.slice(155, 160).map(({ domainId, rawIdentity }) => ({ domainId, rawIdentity })),
  fixedComboLocalizationBridges.filter(({ domainId }) => domainId !== 'suns-grace').map(({ domainId, rawIdentity }) => ({ domainId, rawIdentity })))

const existing155 = {
  identityAssertions: artifact.identityAssertions.slice(0, 155),
  semanticIdentities: artifact.semantic.identities.slice(0, 155),
  provenanceEvidence: artifact.provenance.evidence.slice(0, 652),
}
assert.equal(crypto.createHash('sha256').update(JSON.stringify(existing155)).digest('hex'),
  '2eb00d4084f88778c78cc0331754404633e6782090dd4fc5d1c803ea02983359', 'PR #231 Identity and provenance must be preserved')

const existing159 = {
  identityAssertions: artifact.identityAssertions.slice(0, 159),
  semanticIdentities: artifact.semantic.identities.slice(0, 159),
  provenanceEvidence: artifact.provenance.evidence.slice(0, 672),
}
assert.equal(crypto.createHash('sha256').update(JSON.stringify(existing159)).digest('hex'),
  '5dfd79e35f69e1d3049afdd12d395fc096e35d5bbb63c761a8ca6d7513e7adc0', 'PR #232 Identity and provenance must be preserved')

const existing160 = {
  identityAssertions: artifact.identityAssertions.slice(0, 160),
  semanticIdentities: artifact.semantic.identities.slice(0, 160),
  provenanceEvidence: artifact.provenance.evidence.slice(0, 677),
}
assert.equal(crypto.createHash('sha256').update(JSON.stringify(existing160)).digest('hex'),
  'cb581be653fafabeb4757b5a079a19b861fc4617dd0132c232f3d0c7f339ef0a', 'PR #233 Identity and provenance must be preserved')
assert.deepEqual(artifact.identityAssertions.slice(160, 162).map(({ domainId, rawIdentity }) => [domainId, rawIdentity]),
  fixedPowerBowBridges.map(({ id, rawIdentity }) => [id, rawIdentity]))

const existing162 = {
  identityAssertions: artifact.identityAssertions.slice(0, 162),
  semanticIdentities: artifact.semantic.identities.slice(0, 162),
  provenanceEvidence: artifact.provenance.evidence.slice(0, 687),
}
assert.equal(crypto.createHash('sha256').update(JSON.stringify(existing162)).digest('hex'),
  '50335a817752d872bebf90dcb3a32166e03ee65dbe5076a8887e4b2b217c231a', 'PR #234 Identity and provenance must be preserved')
assert.deepEqual(artifact.identityAssertions.slice(162, 163).map(({ domainId, rawIdentity }) => [domainId, rawIdentity]), [['suns-grace', 'Mace_Unique1']])

const existing163 = {
  identityAssertions: artifact.identityAssertions.slice(0, 163),
  semanticIdentities: artifact.semantic.identities.slice(0, 163),
  provenanceEvidence: artifact.provenance.evidence.slice(0, 692),
}
assert.equal(crypto.createHash('sha256').update(JSON.stringify(existing163)).digest('hex'),
  'e6132cb9d7882c047a892bc04c181c49f76abda8078ae839ef60b9787c02a06d', 'PR #235 Identity and provenance must be preserved')
assert.deepEqual(artifact.identityAssertions.slice(163).map(({ domainId, rawIdentity }) => [domainId, rawIdentity]),
  fixedRapidFireBridges.map(({ domainId, rawIdentity }) => [domainId, rawIdentity]))

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
console.log('Formal Identity/Evidence v1 audit passed: 165 matched identities (40 Melee, 31 Ranged, 71 Armor, 23 Artifact); 6 new reviewed typed-relation bridges plus 2 existing Sawblade bridges match exact Structural observations; duplicate assertions/domains 0; unsupported promotions 0; existing 153 identity prefix remains guarded; twelve finite consumer localization identities appended.')

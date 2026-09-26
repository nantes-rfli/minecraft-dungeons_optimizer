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
  deathCapMushroomFormalIdentity,
  fightersBindingsFormalIdentity,
  formalIdentityDefinitions,
  readyArtifactFormalIdentities,
  readyArmorFormalIdentities,
  readyMeleeFormalIdentities,
  readyRangedFormalIdentities,
  reviewedBridgeMeleeFormalIdentities,
  reviewedBridgeRangedFormalIdentities,
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
const inventoryDefinitions = [...readyMeleeFormalIdentities, ...readyRangedFormalIdentities, ...reviewedBridgeMeleeFormalIdentities, ...reviewedBridgeRangedFormalIdentities, ...readyArtifactFormalIdentities, ...readyArmorFormalIdentities]
const inventoryInputs = readFormalIdentityInventoryInputs(repositoryRoot, inventoryDefinitions)
const artifact = buildFormalIdentityEvidenceArtifact([...representativeInputs, ...inventoryInputs])

assert.deepEqual(collectFormalIdentityEvidenceErrors(artifact), [])
assert.equal(artifact.identityAssertions.length, 128)
assert.equal(artifact.semantic.identities.filter(({ resolution }) => resolution.state === 'matched').length, 128)
assert.equal(new Set(artifact.identityAssertions.map(({ id }) => id)).size, 128, 'duplicate Formal Identity assertion')
assert.equal(new Set(artifact.identityAssertions.map(({ domainId }) => domainId)).size, 128, 'duplicate Formal Identity domain')
const matchedMelee = artifact.semantic.identities.filter(({ resolution }) =>
  resolution.state === 'matched'
  && (resolution.domainId === 'fighters-bindings' || readyMeleeFormalIdentities.some(({ assertion }) => assertion.domainId === resolution.domainId) || reviewedBridgeMeleeFormalIdentities.some(({ assertion }) => assertion.domainId === resolution.domainId)))
assert.equal(matchedMelee.length, 27)
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
assert.deepEqual(artifact.identityAssertions.slice(52, 58).map(({ domainId }) => domainId), artifactDomainIds)
assert.deepEqual(artifact.semantic.identities.slice(52, 58).map(({ resolution }) => resolution.state === 'matched' ? resolution.domainId : 'unresolved'), artifactDomainIds)
assert.equal(artifact.semantic.identities.filter(({ resolution }) => resolution.state === 'matched' && (resolution.domainId === 'death-cap-mushroom' || artifactDomainIds.includes(resolution.domainId))).length, 7)
const armorDomainIds = readyArmorFormalIdentities.map(({ assertion }) => assertion.domainId)
assert.deepEqual(artifact.identityAssertions.slice(58).map(({ domainId }) => domainId), armorDomainIds)
assert.deepEqual(artifact.semantic.identities.slice(58).map(({ resolution }) => resolution.state === 'matched' ? resolution.domainId : 'unresolved'), armorDomainIds)
assert.equal(artifact.semantic.identities.filter(({ resolution }) => resolution.state === 'matched' && (resolution.domainId === 'battle-robe' || armorDomainIds.includes(resolution.domainId))).length, 71)

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
console.log('Formal Identity/Evidence v1 audit passed: 128 matched identities (27 Melee, 23 Ranged, 71 Armor, 7 Artifact); 70/70 Armor bridges and Structural observations match; duplicate assertions/domains 0; unsupported promotions 0; the original 52, Phase A six Artifacts, and Battle Robe remain unchanged.')

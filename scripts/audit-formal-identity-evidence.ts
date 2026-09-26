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
const inventoryDefinitions = [...readyMeleeFormalIdentities, ...readyRangedFormalIdentities, ...reviewedBridgeMeleeFormalIdentities, ...reviewedBridgeRangedFormalIdentities, ...readyArtifactFormalIdentities]
const inventoryInputs = readFormalIdentityInventoryInputs(repositoryRoot, inventoryDefinitions)
const artifact = buildFormalIdentityEvidenceArtifact([...representativeInputs, ...inventoryInputs])

assert.deepEqual(collectFormalIdentityEvidenceErrors(artifact), [])
assert.equal(artifact.identityAssertions.length, 58)
assert.equal(artifact.semantic.identities.filter(({ resolution }) => resolution.state === 'matched').length, 58)
assert.equal(new Set(artifact.identityAssertions.map(({ id }) => id)).size, 58, 'duplicate Formal Identity assertion')
assert.equal(new Set(artifact.identityAssertions.map(({ domainId }) => domainId)).size, 58, 'duplicate Formal Identity domain')
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
assert.deepEqual(artifact.identityAssertions.slice(52).map(({ domainId }) => domainId), artifactDomainIds)
assert.deepEqual(artifact.semantic.identities.slice(52).map(({ resolution }) => resolution.state === 'matched' ? resolution.domainId : 'unresolved'), artifactDomainIds)
assert.equal(artifact.semantic.identities.filter(({ resolution }) => resolution.state === 'matched' && (resolution.domainId === 'death-cap-mushroom' || artifactDomainIds.includes(resolution.domainId))).length, 7)

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

const roles = new Set(artifact.provenance.evidence.flatMap((record: EvidenceRecord) => record.kind === 'reviewed' ? [record.role] : []))
assert.deepEqual([...roles].sort(), ['conflict', 'limitation', 'support'])
for (const record of artifact.provenance.evidence) {
  if (record.kind === 'reviewed') assert.ok(fs.existsSync(new URL(record.source.artifactPath, root)), `${record.id}: source artifact missing`)
}
assert.deepEqual(collectFormalReviewedSourceGroundingErrors(readFormalReviewedSources(repositoryRoot)), [])

const target = new URL('research/domain/formal/identity-evidence-v1.json', root)
const serialized = `${JSON.stringify(artifact, null, 2)}\n`
if (process.argv.includes('--write')) {
  fs.mkdirSync(new URL('.', target), { recursive: true })
  fs.writeFileSync(target, serialized)
}
assert.equal(fs.readFileSync(target, 'utf8'), serialized, 'Formal Identity/Evidence artifact drift; run generate:formal-identity-evidence')
console.log('Formal Identity/Evidence v1 audit passed: 58 matched identities (27 Melee, 23 Ranged, 1 Armor, 7 Artifact), including the 6 ready-direct Artifact identities; the original 52 identities, reviewed-source grounding, inventory-backed breadth provenance, and EvidenceRef integrity are preserved.')

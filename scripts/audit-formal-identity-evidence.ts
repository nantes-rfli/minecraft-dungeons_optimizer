import assert from 'node:assert/strict'
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
const inventoryDefinitions = [...readyMeleeFormalIdentities, ...readyRangedFormalIdentities, ...reviewedBridgeMeleeFormalIdentities, ...reviewedBridgeRangedFormalIdentities]
const inventoryInputs = readFormalIdentityInventoryInputs(repositoryRoot, inventoryDefinitions)
const artifact = buildFormalIdentityEvidenceArtifact([...representativeInputs, ...inventoryInputs])

assert.deepEqual(collectFormalIdentityEvidenceErrors(artifact), [])
assert.equal(artifact.identityAssertions.length, 52)
assert.equal(artifact.semantic.identities.filter(({ resolution }) => resolution.state === 'matched').length, 52)
const matchedMelee = artifact.semantic.identities.filter(({ resolution }) =>
  resolution.state === 'matched'
  && (resolution.domainId === 'fighters-bindings' || readyMeleeFormalIdentities.some(({ assertion }) => assertion.domainId === resolution.domainId) || reviewedBridgeMeleeFormalIdentities.some(({ assertion }) => assertion.domainId === resolution.domainId)))
assert.equal(matchedMelee.length, 27)
const matchedRanged = artifact.semantic.identities.filter(({ resolution }) =>
  resolution.state === 'matched'
  && (resolution.domainId === 'scatter-crossbow' || readyRangedFormalIdentities.some(({ assertion }) => assertion.domainId === resolution.domainId) || reviewedBridgeRangedFormalIdentities.some(({ assertion }) => assertion.domainId === resolution.domainId)))
assert.equal(matchedRanged.length, 23)
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
console.log('Formal Identity/Evidence v1 audit passed: 52 matched identities including 27 Melee and 23 Ranged, with 3 documented reviewed bridges, reviewed-source grounding, inventory-backed breadth provenance, and EvidenceRef integrity.')

import assert from 'node:assert/strict'
import fs from 'node:fs'
import { projectDeathCapMushroom, deathCapMushroomMappings } from '../src/domain/temporary/deathCapMushroom.ts'
import { deathCapMushroomIdentity } from '../src/domain/temporary/deathCapMushroomIdentity.ts'
import type { RawPackageSnapshot } from './game-data-raw-package.ts'

const root = new URL('..', import.meta.url)
const readRaw = (packagePath: string) => JSON.parse(fs.readFileSync(new URL(`research/raw/packages/${packagePath}.raw.json`, root), 'utf8')) as RawPackageSnapshot
const instanceRaw = readRaw(deathCapMushroomIdentity.instancePackagePath)
const effectRaw = readRaw(deathCapMushroomIdentity.effectPackagePath)
const projection = projectDeathCapMushroom(instanceRaw, effectRaw)
assert.equal(projection.identity.status, 'accepted')
assert.equal(projection.identity.domainId, deathCapMushroomIdentity.domainId)
assert.equal(projection.effectReference.state, 'known')
if (projection.effectReference.state === 'known') {
  assert.deepEqual(projection.effectReference.value, {
    rawPackageIndex: -3,
    objectName: deathCapMushroomIdentity.effectObjectName,
    className: deathCapMushroomIdentity.effectClassName,
    targetRawPackagePath: deathCapMushroomIdentity.effectPackagePath,
  })
  assert.equal(projection.effectReference.trace.targetRawSnapshot.datasetId, instanceRaw.dataset.id)
  assert.deepEqual(projection.effectReference.trace.targetRawSnapshot.sourceFingerprint, instanceRaw.dataset.sourceFingerprint)
}
assert.deepEqual(projection.unresolved, ['gameplay-effect-semantics'])

const aliases = JSON.parse(fs.readFileSync(new URL(deathCapMushroomIdentity.evidence.path, root), 'utf8')) as { aliases: { id: string; status: string; confidence: string; canonicalEntity?: string }[] }
const alias = aliases.aliases.find((entry) => entry.id === 'artifact:DeathCapMushroom')
assert.deepEqual(alias && { status: alias.status, confidence: alias.confidence, canonicalEntity: alias.canonicalEntity }, {
  status: deathCapMushroomIdentity.evidence.expectedStatus,
  confidence: deathCapMushroomIdentity.evidence.expectedConfidence,
  canonicalEntity: deathCapMushroomIdentity.evidence.expectedCanonicalEntity,
}, 'Accepted identity evidence changed; review the temporary assertion')

const result = { schemaVersion: 1, scope: 'temporary-domain-only', identityAssertion: deathCapMushroomIdentity, mappings: deathCapMushroomMappings, projection }
const target = new URL('research/domain/temporary/death-cap-mushroom.json', root)
const serialized = JSON.stringify(result, null, 2) + '\n'
if (process.argv.includes('--write')) { fs.mkdirSync(new URL('.', target), { recursive: true }); fs.writeFileSync(target, serialized) }
assert.equal(fs.readFileSync(target, 'utf8'), serialized, 'Temporary Domain drift; run generate:death-cap-mushroom-domain')
console.log('Death Cap Mushroom temporary Domain audit passed: accepted identity, explicit Effect cross-package trace, target snapshot provenance, and unresolved gameplay semantics.')

import assert from 'node:assert/strict'
import fs from 'node:fs'
import { projectScatterCrossbow, scatterCrossbowMappings } from '../src/domain/temporary/scatterCrossbow.ts'
import { scatterCrossbowIdentity } from '../src/domain/temporary/scatterCrossbowIdentity.ts'
import type { RawPackageSnapshot } from './game-data-raw-package.ts'

const root = new URL('..', import.meta.url)
const readRaw = (packagePath: string) => JSON.parse(fs.readFileSync(new URL(`research/raw/packages/${packagePath}.raw.json`, root), 'utf8')) as RawPackageSnapshot
const instanceRaw = readRaw(scatterCrossbowIdentity.instancePackagePath)
const projectileRaw = readRaw(scatterCrossbowIdentity.projectilePackagePath)
const projection = projectScatterCrossbow(instanceRaw, projectileRaw)
assert.equal(projection.identity.status, 'accepted')
assert.equal(projection.identity.domainId, scatterCrossbowIdentity.domainId)
assert.equal(projection.configuredProjectileDefinitions.state, 'known')
assert.equal(projection.configuredProjectileVelocityFactor.state, 'known')
if (projection.configuredProjectileDefinitions.state === 'known') {
  assert.equal(projection.configuredProjectileDefinitions.value.length, 1)
  const entry = projection.configuredProjectileDefinitions.value[0]!
  assert.equal(entry.projectile.reference.state, 'known')
  assert.ok(entry.projectile.configuration)
}
const aliases = JSON.parse(fs.readFileSync(new URL(scatterCrossbowIdentity.evidence.path, root), 'utf8')) as { aliases: { id: string; status: string; confidence: string; canonicalEntity?: string }[] }
const alias = aliases.aliases.find((entry) => entry.id === 'ranged-weapon:ScatterCrossbow')
assert.deepEqual(alias && { status: alias.status, confidence: alias.confidence, canonicalEntity: alias.canonicalEntity }, {
  status: scatterCrossbowIdentity.evidence.expectedStatus,
  confidence: scatterCrossbowIdentity.evidence.expectedConfidence,
  canonicalEntity: scatterCrossbowIdentity.evidence.expectedCanonicalEntity,
}, 'Accepted identity evidence changed; review the temporary assertion')
const result = { schemaVersion: 1, scope: 'temporary-domain-only', identityAssertion: scatterCrossbowIdentity, mappings: scatterCrossbowMappings, projection }
const target = new URL('research/domain/temporary/scatter-crossbow.json', root)
const serialized = JSON.stringify(result, null, 2) + '\n'
if (process.argv.includes('--write')) { fs.mkdirSync(new URL('.', target), { recursive: true }); fs.writeFileSync(target, serialized) }
assert.equal(fs.readFileSync(target, 'utf8'), serialized, 'Temporary Domain drift; run generate:scatter-crossbow-domain')
console.log('Scatter Crossbow temporary Domain audit passed: accepted identity, ordered configured projectile definitions, explicit cross-package trace, and no runtime promotion.')

import assert from 'node:assert/strict'
import fs from 'node:fs'
import { projectBattleRobe, battleRobeMappings } from '../src/domain/temporary/battleRobe.ts'
import { battleRobeIdentity } from '../src/domain/temporary/battleRobeIdentity.ts'
import type { RawPackageSnapshot } from './game-data-raw-package.ts'

const root = new URL('..', import.meta.url)
const source = `research/raw/packages/${battleRobeIdentity.packagePath}.raw.json`
const raw = JSON.parse(fs.readFileSync(new URL(source, root), 'utf8')) as RawPackageSnapshot
const projection = projectBattleRobe(raw)
assert.equal(projection.identity.status, 'provisional')
assert.equal(projection.identity.domainId, battleRobeIdentity.domainId)
assert.equal(projection.gearActorReference.state, 'known')
if (projection.gearActorReference.state === 'known') {
  assert.deepEqual(projection.gearActorReference.value, {
    rawPackageIndex: -2,
    objectName: battleRobeIdentity.gearActorObjectName,
    className: battleRobeIdentity.gearActorClassName,
    gamePackagePath: battleRobeIdentity.gearActorGamePackagePath,
  })
}
assert.deepEqual(projection.unresolved, ['armor-property-ownership'])
for (const evidence of battleRobeIdentity.evidence) assert.ok(fs.existsSync(new URL(evidence.path, root)))
const result = { schemaVersion: 1, scope: 'temporary-domain-only', identityAssertion: battleRobeIdentity, mappings: battleRobeMappings, projection }
const target = new URL('research/domain/temporary/battle-robe.json', root)
const serialized = JSON.stringify(result, null, 2) + '\n'
if (process.argv.includes('--write')) { fs.mkdirSync(new URL('.', target), { recursive: true }); fs.writeFileSync(target, serialized) }
assert.equal(fs.readFileSync(target, 'utf8'), serialized, 'Temporary Domain drift; run generate:battle-robe-domain')
console.log('Battle Robe temporary Domain audit passed: provisional identity, explicit GearActor import trace, unresolved Armor Property ownership; no runtime promotion.')

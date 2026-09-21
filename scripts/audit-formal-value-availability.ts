import assert from 'node:assert/strict'
import fs from 'node:fs'
import {
  buildFormalValueAvailabilityArtifact,
  collectFormalValueAvailabilityErrors,
} from '../src/domain/formal/valueAvailability.ts'
import { scatterCrossbowIdentity } from '../src/domain/temporary/scatterCrossbowIdentity.ts'
import type { RawPackageSnapshot } from './game-data-raw-package.ts'
import { buildFormalSerializedRelationArtifact } from '../src/domain/formal/serializedRelation.ts'
import { fightersBindingsFormalIdentity, scatterCrossbowFormalIdentity, battleRobeFormalIdentity, deathCapMushroomFormalIdentity } from '../src/domain/formal/identityDefinitions.ts'
import { projectFormalIdentity, type RawObservationEvidenceRecord } from '../src/domain/formal/identityEvidence.ts'

const root = new URL('..', import.meta.url)
const readRaw = (packagePath: string) => JSON.parse(
  fs.readFileSync(new URL(`research/raw/packages/${packagePath}.raw.json`, root), 'utf8'),
) as RawPackageSnapshot

const source = (definition: typeof fightersBindingsFormalIdentity) => {
  const raw = readRaw(definition.assertion.applicationScope.packagePath)
  const projected = projectFormalIdentity(raw, definition)
  return { source: raw, identity: projected.semantic, identityEvidence: projected.evidence.filter((record): record is RawObservationEvidenceRecord => record.kind === 'raw-observation') }
}
const fighters = source(fightersBindingsFormalIdentity)
const scatter = source(scatterCrossbowFormalIdentity)
const projectile = readRaw(scatterCrossbowIdentity.projectilePackagePath)
const relations = buildFormalSerializedRelationArtifact({ scatter: { ...scatter, target: projectile },
  battleRobe: source(battleRobeFormalIdentity), deathCapMushroom: source(deathCapMushroomFormalIdentity) })
const artifact = buildFormalValueAvailabilityArtifact({ fightersBindingsRaw: fighters.source,
  scatterCrossbowInstanceRaw: scatter.source, scatterCrossbowProjectileRaw: projectile,
  fightersBindingsIdentity: fighters.identity, fightersBindingsIdentityEvidence: fighters.identityEvidence,
  scatterCrossbowIdentity: scatter.identity, scatterCrossbowIdentityEvidence: scatter.identityEvidence, relations })

assert.deepEqual(collectFormalValueAvailabilityErrors(artifact), [])
assert.deepEqual(artifact.semantic.fightersBindings.configuredAttacks?.value, [0, 1, 2, 3])
assert.equal(artifact.semantic.fightersBindings.attacks?.length, 4)
assert.deepEqual(artifact.semantic.scatterCrossbow.configuredProjectileDefinitions?.value, [0])
assert.equal(artifact.semantic.scatterCrossbow.projectileDefinitions?.length, 1)
for (const { id, provenance } of artifact.provenance.evidence) {
  const source = new URL(provenance.artifactPath, root)
  assert.ok(fs.existsSync(source), `${id}: provenance artifact does not exist`)
  const raw = JSON.parse(fs.readFileSync(source, 'utf8')) as RawPackageSnapshot
  assert.equal(raw.dataset.id, provenance.datasetId, `${id}: provenance dataset differs from committed Raw artifact`)
  assert.equal(raw.extraction.runId, provenance.extractionRunId, `${id}: provenance extraction differs from committed Raw artifact`)
  assert.deepEqual(raw.logicalPackage.contentHash, provenance.packageHash, `${id}: provenance hash differs from committed Raw artifact`)
  const node = provenance.nodePointer.split('/').slice(1).reduce<unknown>((value, key) => (value as Record<string, unknown>)?.[key], raw)
  assert.notEqual(node, undefined, `${id}: provenance nodePointer does not resolve in committed Raw artifact`)
}

const target = new URL('research/domain/formal/value-availability-v1.json', root)
const serialized = `${JSON.stringify(artifact, null, 2)}\n`
if (process.argv.includes('--write')) {
  fs.mkdirSync(new URL('.', target), { recursive: true })
  fs.writeFileSync(target, serialized)
}
assert.equal(fs.readFileSync(target, 'utf8'), serialized, 'Formal Value/Availability artifact drift; run generate:formal-value-availability')
console.log('Formal Value/Availability v1 audit passed: known-only semantics, occurrence coverage, availability records, and EvidenceRef integrity.')

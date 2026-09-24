import assert from 'node:assert/strict'
import fs from 'node:fs'
import {
  buildFormalValueAvailabilityArtifact,
  collectFormalValueAvailabilityErrors,
} from '../src/domain/formal/valueAvailability.ts'
import type { RawPackageSnapshot } from './game-data-raw-package.ts'
import { buildFormalSerializedRelationArtifact, scatterCrossbowRelationDefinition } from '../src/domain/formal/serializedRelation.ts'
import { fightersBindingsFormalIdentity, scatterCrossbowFormalIdentity, battleRobeFormalIdentity, deathCapMushroomFormalIdentity } from '../src/domain/formal/identityDefinitions.ts'
import { projectFormalIdentity, type RawObservationEvidenceRecord } from '../src/domain/formal/identityEvidence.ts'
import { verifyValueRawTraceProvenance } from './formal-value-source-provenance.ts'

const root = new URL('..', import.meta.url)
const repositoryRoot = fs.realpathSync(root)
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
const projectile = readRaw(scatterCrossbowRelationDefinition.targetRawPath)
const relations = buildFormalSerializedRelationArtifact({ scatter: { ...scatter, target: projectile },
  battleRobe: source(battleRobeFormalIdentity), deathCapMushroom: source(deathCapMushroomFormalIdentity) })
const artifact = buildFormalValueAvailabilityArtifact({ fightersBindingsRaw: fighters.source,
  scatterCrossbowInstanceRaw: scatter.source, scatterCrossbowProjectileRaw: projectile,
  fightersBindingsIdentity: fighters.identity, fightersBindingsIdentityEvidence: fighters.identityEvidence,
  scatterCrossbowIdentity: scatter.identity, scatterCrossbowIdentityEvidence: scatter.identityEvidence, relations })

assert.deepEqual(collectFormalValueAvailabilityErrors(artifact), [])
assert.equal(artifact.schemaVersion, 2)
assert.deepEqual(artifact.semantic.melee[fightersBindingsFormalIdentity.assertion.domainId]?.configuredAttacks?.value, [0, 1, 2, 3])
assert.equal(artifact.semantic.melee[fightersBindingsFormalIdentity.assertion.domainId]?.attacks?.length, 4)
assert.deepEqual(artifact.semantic.ranged[scatterCrossbowFormalIdentity.assertion.domainId]?.configuredProjectileDefinitions?.value, [0])
assert.equal(artifact.semantic.ranged[scatterCrossbowFormalIdentity.assertion.domainId]?.projectileDefinitions?.length, 1)
for (const { id, provenance } of artifact.provenance.evidence) {
  assert.doesNotThrow(
    () => verifyValueRawTraceProvenance(repositoryRoot, provenance),
    `${id}: Value provenance does not verify against its committed Raw source`,
  )
}

const target = new URL('research/domain/formal/value-availability-v2.json', root)
const serialized = `${JSON.stringify(artifact, null, 2)}\n`
if (process.argv.includes('--write')) {
  fs.mkdirSync(new URL('.', target), { recursive: true })
  fs.writeFileSync(target, serialized)
}
assert.equal(fs.readFileSync(target, 'utf8'), serialized, 'Formal Value/Availability artifact drift; run generate:formal-value-availability')
console.log('Formal Value/Availability v2 audit passed: known-only semantics, occurrence coverage, availability records, and EvidenceRef integrity.')

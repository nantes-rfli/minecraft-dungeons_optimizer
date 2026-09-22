import assert from 'node:assert/strict'
import fs from 'node:fs'
import { buildFormalSerializedRelationArtifact, collectFormalSerializedRelationErrors, deathCapMushroomRelationDefinition, scatterCrossbowRelationDefinition, type FormalRelationInputs } from '../src/domain/formal/serializedRelation.ts'
import { battleRobeFormalIdentity, deathCapMushroomFormalIdentity, scatterCrossbowFormalIdentity } from '../src/domain/formal/identityDefinitions.ts'
import { projectFormalIdentity, type RawObservationEvidenceRecord } from '../src/domain/formal/identityEvidence.ts'
import type { RawPackageSnapshot } from './game-data-raw-package.ts'

const root = new URL('..', import.meta.url)
const readRaw = (packagePath: string) => JSON.parse(fs.readFileSync(new URL(`research/raw/packages/${packagePath}.raw.json`, root), 'utf8')) as RawPackageSnapshot
const source = (definition: typeof scatterCrossbowFormalIdentity) => {
  const raw = readRaw(definition.assertion.applicationScope.packagePath)
  const projected = projectFormalIdentity(raw, definition)
  return { source: raw, identity: projected.semantic, identityEvidence: projected.evidence.filter((record): record is RawObservationEvidenceRecord => record.kind === 'raw-observation') }
}
const inputs: FormalRelationInputs = {
  scatter: { ...source(scatterCrossbowFormalIdentity), target: readRaw(scatterCrossbowRelationDefinition.targetRawPath) },
  battleRobe: source(battleRobeFormalIdentity),
  deathCapMushroom: { ...source(deathCapMushroomFormalIdentity), target: readRaw(deathCapMushroomRelationDefinition.targetRawPath) },
}
const artifact = buildFormalSerializedRelationArtifact(inputs)
assert.deepEqual(collectFormalSerializedRelationErrors(artifact, inputs), [])
assert.deepEqual(artifact.relationProjections.map((record) => [record.occurrence.slice, record.result, record.result === 'projected' && record.targetResolution.result]), [
  ['scatter-crossbow', 'projected', 'resolved'],
  ['battle-robe', 'projected', 'not-resolved'],
  ['death-cap-mushroom', 'projected', 'resolved'],
])
for (const evidence of artifact.provenance.evidence) {
  const raw = JSON.parse(fs.readFileSync(new URL(evidence.provenance.artifactPath, root), 'utf8')) as RawPackageSnapshot
  assert.equal(raw.dataset.id, evidence.provenance.datasetId)
  assert.equal(raw.extraction.runId, evidence.provenance.extractionRunId)
  assert.deepEqual(raw.logicalPackage.contentHash, evidence.provenance.packageHash)
  const observed = evidence.provenance.nodePointer === undefined
    ? { schemaVersion: raw.schemaVersion, dataset: raw.dataset, logicalPackage: raw.logicalPackage }
    : evidence.provenance.nodePointer.split('/').slice(1).reduce<unknown>((value, key) => (value as Record<string, unknown> | undefined)?.[key], raw)
  assert.notEqual(observed, undefined, `${evidence.id}: fabricated node pointer`)
  assert.deepEqual(evidence.observed, observed, `${evidence.id}: Raw observation drift`)
}
const target = new URL('research/domain/formal/serialized-relation-v1.json', root)
const serialized = `${JSON.stringify(artifact, null, 2)}\n`
if (process.argv.includes('--write')) fs.writeFileSync(target, serialized)
assert.equal(fs.readFileSync(target, 'utf8'), serialized, 'Formal Serialized Relation artifact drift; run generate:formal-serialized-relation')
console.log('Formal Serialized Relation v1 audit passed.')

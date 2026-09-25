import assert from 'node:assert/strict'
import fs from 'node:fs'
import {
  buildFormalSerializedRelationArtifact,
  collectFormalSerializedRelationErrors,
  deathCapMushroomRelationDefinition,
  scatterCrossbowRelationDefinition,
  type FormalRelationInputs,
  type FormalSerializedRelationArtifact,
} from '../src/domain/formal/serializedRelation.ts'
import {
  battleRobeFormalIdentity,
  deathCapMushroomFormalIdentity,
  scatterCrossbowFormalIdentity,
} from '../src/domain/formal/identityDefinitions.ts'
import { projectFormalIdentity, type RawObservationEvidenceRecord } from '../src/domain/formal/identityEvidence.ts'
import type { RawPackageSnapshot } from './game-data-raw-package.ts'

const root = new URL('..', import.meta.url)
const read = <T>(relativePath: string): T => JSON.parse(fs.readFileSync(new URL(relativePath, root), 'utf8')) as T
const readRaw = (packagePath: string) => read<RawPackageSnapshot>(`research/raw/packages/${packagePath}.raw.json`)
const source = (definition: typeof scatterCrossbowFormalIdentity) => {
  const raw = readRaw(definition.assertion.applicationScope.packagePath)
  const projected = projectFormalIdentity(raw, definition)
  return {
    source: raw,
    identity: projected.semantic,
    identityEvidence: projected.evidence.filter((record): record is RawObservationEvidenceRecord => record.kind === 'raw-observation'),
  }
}
const inputs: FormalRelationInputs = {
  scatter: { ...source(scatterCrossbowFormalIdentity), target: readRaw(scatterCrossbowRelationDefinition.targetRawPath) },
  battleRobe: source(battleRobeFormalIdentity),
  deathCapMushroom: {
    ...source(deathCapMushroomFormalIdentity),
    target: readRaw(deathCapMushroomRelationDefinition.targetRawPath),
  },
}
const artifact = buildFormalSerializedRelationArtifact(inputs)
assert.deepEqual(collectFormalSerializedRelationErrors(artifact, inputs), [])
assert.equal(artifact.schemaVersion, 2)
assert.equal(artifact.semantic.relations.length, 3)
assert.equal(artifact.relationProjections.length, 3)
assert.deepEqual(
  artifact.relationProjections.map((record) => [
    record.occurrence.domainId,
    record.result,
    record.result === 'projected' && record.targetRawVerification.result,
  ]),
  [
    ['scatter-crossbow', 'projected', 'resolved'],
    ['battle-robe', 'projected', 'not-resolved'],
    ['death-cap-mushroom', 'projected', 'resolved'],
  ],
)

for (const evidence of artifact.provenance.evidence) {
  const raw = read<RawPackageSnapshot>(evidence.provenance.artifactPath)
  assert.equal(raw.dataset.id, evidence.provenance.datasetId)
  assert.equal(raw.extraction.runId, evidence.provenance.extractionRunId)
  assert.deepEqual(raw.logicalPackage.contentHash, evidence.provenance.packageHash)
  const observed = evidence.provenance.nodePointer === undefined
    ? { schemaVersion: raw.schemaVersion, dataset: raw.dataset, logicalPackage: raw.logicalPackage }
    : evidence.provenance.nodePointer.split('/').slice(1)
      .reduce<unknown>((value, key) => (value as Record<string, unknown> | undefined)?.[key], raw)
  assert.notEqual(observed, undefined, `${evidence.id}: fabricated node pointer`)
  assert.deepEqual(evidence.observed, observed, `${evidence.id}: Raw observation drift`)
}

const baseline = read<{
  stableRelations: {
    relationRef: string
    projectionRef: string
    occurrence: unknown
    evidenceRefs: string[]
    target: unknown
    sourceDomainId: string
    targetRawVerification: unknown
  }[]
}>('tests/fixtures/formal-relation-v1-stable-baseline.json')
const stableRelations = artifact.semantic.relations.map((relation) => {
  const projection = artifact.relationProjections.find((record) => record.projectionRef === relation.projectionRef)
  assert.ok(projection && projection.result === 'projected', `${relation.projectionRef}: projected Relation missing`)
  return {
    relationRef: relation.relationRef,
    projectionRef: relation.projectionRef,
    occurrence: relation.occurrence,
    evidenceRefs: relation.evidenceRefs,
    target: relation.target,
    sourceDomainId: relation.sourceDomainId,
    targetRawVerification: projection.targetRawVerification,
  }
})
assert.deepEqual(stableRelations, baseline.stableRelations, 'Relation v1 stable identity changed during v2 migration')

const value = read<{
  valueProjections: { relationProjectionRef?: string }[]
}>('research/domain/formal/value-availability-v2.json')
const relationProjectionRefs = new Set(artifact.relationProjections.map(({ projectionRef }) => projectionRef))
for (const record of value.valueProjections.filter(({ relationProjectionRef }) => relationProjectionRef)) {
  assert.equal(
    artifact.relationProjections.filter(({ projectionRef }) => projectionRef === record.relationProjectionRef).length,
    1,
    `Scatter Value relationProjectionRef must resolve exactly once: ${record.relationProjectionRef}`,
  )
  assert.ok(relationProjectionRefs.has(record.relationProjectionRef!), 'Value references an unknown Relation projection')
}

const target = new URL('research/domain/formal/serialized-relation-v2.json', root)
const serialized = `${JSON.stringify(artifact, null, 2)}\n`
if (process.argv.includes('--write')) fs.writeFileSync(target, serialized)
assert.equal(
  fs.readFileSync(target, 'utf8'),
  serialized,
  'Formal Serialized Relation v2 artifact drift; run generate:formal-serialized-relation',
)
console.log('Formal Serialized Relation v2 audit passed.')

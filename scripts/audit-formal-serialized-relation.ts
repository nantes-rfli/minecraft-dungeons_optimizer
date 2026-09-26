import assert from 'node:assert/strict'
import fs from 'node:fs'
import {
  buildFormalSerializedRelationArtifact,
  collectFormalSerializedRelationErrors,
  deathCapMushroomRelationDefinition,
  scatterCrossbowRelationDefinition,
  type FormalRelationInputs,
} from '../src/domain/formal/serializedRelation.ts'
import {
  battleRobeFormalIdentity,
  deathCapMushroomFormalIdentity,
  scatterCrossbowFormalIdentity,
} from '../src/domain/formal/identityDefinitions.ts'
import { projectFormalIdentity, type RawObservationEvidenceRecord } from '../src/domain/formal/identityEvidence.ts'
import type { RawPackageSnapshot } from './game-data-raw-package.ts'
import { loadStructuralGraph } from './game-data-horizontal-fact-inventory.ts'
import { readHorizontalRelationWaveSources } from './formal-relation-horizontal-wave-sources.ts'
import { readVerifiedStructuralShard, resolveJsonPointer } from './formal-value-source-provenance.ts'
import type { FormalIdentityEvidenceArtifact } from '../src/domain/formal/identityEvidence.ts'

const root = new URL('..', import.meta.url)
const repositoryRoot = fs.realpathSync(root)
const structuralPackagePaths = new Set(loadStructuralGraph(repositoryRoot).packagesByPath.keys())
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
const identity = read<FormalIdentityEvidenceArtifact>('research/domain/formal/identity-evidence-v1.json')
const wave = readHorizontalRelationWaveSources({ repositoryRoot, identity })
assert.equal(new Set(wave.melee.map(({ occurrence }) => occurrence.domainId)).size, 27)
assert.equal(wave.melee.length, 96)
assert.equal(new Set(wave.ranged.map(({ occurrence }) => occurrence.domainId)).size, 23)
assert.equal(wave.ranged.length, 23)
const firstWave = [...wave.melee, ...wave.ranged]
assert.equal(firstWave.length, 119)
assert.ok(firstWave.every(({ serializedTargetResolution }) => serializedTargetResolution.state === 'resolved-local-package'))
const inputs: FormalRelationInputs = {
  structuralPackagePaths,
  scatter: { ...source(scatterCrossbowFormalIdentity), target: readRaw(scatterCrossbowRelationDefinition.targetRawPath) },
  battleRobe: source(battleRobeFormalIdentity),
  deathCapMushroom: {
    ...source(deathCapMushroomFormalIdentity),
    target: readRaw(deathCapMushroomRelationDefinition.targetRawPath),
  },
  horizontalRelations: firstWave.filter(({ occurrence }) => occurrence.domainId !== 'scatter-crossbow'),
}
const artifact = buildFormalSerializedRelationArtifact(inputs)
assert.deepEqual(collectFormalSerializedRelationErrors(artifact, inputs), [])
assert.equal(artifact.schemaVersion, 2)
assert.equal(artifact.semantic.relations.length, 121)
assert.equal(artifact.relationProjections.length, 121)
assert.equal(artifact.relationCollections.length, 50)
assert.deepEqual(
  artifact.relationProjections.slice(0, 3).map((record) => [
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
const scatterSource = wave.ranged.find(({ occurrence }) => occurrence.domainId === 'scatter-crossbow')!
const scatterRelation = artifact.semantic.relations.find(({ relationRef }) => relationRef === scatterSource.relationRef)!
const scatterProjection = artifact.relationProjections.find(({ projectionRef }) => projectionRef === scatterRelation.projectionRef)!
assert.deepEqual(scatterRelation.occurrence, scatterSource.occurrence)
assert.deepEqual(scatterRelation.target, scatterSource.target)
assert.deepEqual(scatterProjection.result === 'projected' && scatterProjection.serializedTargetResolution,
  scatterSource.serializedTargetResolution)
const horizontal = artifact.relationProjections.filter(({ occurrence }) =>
  'sourceIndex' in occurrence && ['configured-attacks', 'projectile-definitions'].includes(occurrence.collectionRef))
assert.equal(horizontal.length, 119)
assert.ok(horizontal.every((record) => record.result === 'projected'
  && record.serializedTargetResolution.state === 'resolved-local-package'))
assert.ok(horizontal.filter(({ occurrence }) => occurrence.domainId !== 'scatter-crossbow').every((record) =>
  record.result === 'projected' && record.targetRawVerification.input === 'not-supplied'
  && record.targetRawVerification.result === 'not-resolved'
  && record.targetRawVerification.reason === 'target-snapshot-not-supplied'))
assert.equal(new Set(artifact.relationProjections.map(({ projectionRef }) => projectionRef)).size, 121)
assert.equal(new Set(artifact.semantic.relations.map(({ relationRef, occurrence }) =>
  `${relationRef}\0${JSON.stringify(occurrence)}`)).size, 121)

for (const evidence of artifact.provenance.evidence) {
  if (evidence.provenance.artifactPath.endsWith('.json.gz')) {
    const { shard } = readVerifiedStructuralShard(repositoryRoot, evidence.provenance.artifactPath,
      evidence.provenance.datasetId)
    const observed = resolveJsonPointer(shard, evidence.provenance.nodePointer!)
    assert.notEqual(observed, undefined, `${evidence.id}: Structural edge pointer missing`)
    assert.deepEqual(evidence.observed, observed, `${evidence.id}: Structural edge drift`)
    continue
  }
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
const stableRefs = new Set(baseline.stableRelations.map(({ relationRef }) => relationRef))
const stableRelations = artifact.semantic.relations.filter(({ relationRef }) => stableRefs.has(relationRef)).map((relation) => {
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

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
import { evidenceFingerprint, projectFormalIdentity, type RawObservationEvidenceRecord } from '../src/domain/formal/identityEvidence.ts'
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
assert.equal(new Set(wave.melee.map(({ occurrence }) => occurrence.domainId)).size, 31)
assert.equal(wave.melee.length, 106)
assert.equal(new Set(wave.ranged.map(({ occurrence }) => occurrence.domainId)).size, 27)
assert.equal(wave.ranged.length, 27)
assert.equal(new Set(wave.armor.map(({ occurrence }) => occurrence.domainId)).size, 70)
assert.equal(wave.armor.length, 70)
assert.ok(wave.armor.every(({ relationRef, occurrence, serializedTargetResolution }) =>
  relationRef.endsWith(':gear-actor@1')
  && !('sourceIndex' in occurrence)
  && occurrence.scopeRef === 'source'
  && serializedTargetResolution.state === 'resolved-local-package'))
const collectionWave = [...wave.melee, ...wave.ranged]
assert.equal(collectionWave.length, 133)
assert.ok(collectionWave.every(({ serializedTargetResolution }) => serializedTargetResolution.state === 'resolved-local-package'))
const catchupDomainIds = new Set([
  'broken-sawblade',
  'mechanized-sawblade',
  'chill-gale-knife',
  'resolute-tempest-knife',
  'bonebow',
  'twin-bow',
  'burst-gale-bow',
  'echo-of-the-valley',
])
assert.equal(wave.melee.filter(({ occurrence }) => catchupDomainIds.has(occurrence.domainId)).length, 10)
assert.equal(wave.ranged.filter(({ occurrence }) => catchupDomainIds.has(occurrence.domainId)).length, 4)
assert.equal(collectionWave.filter(({ occurrence }) => catchupDomainIds.has(occurrence.domainId)).length, 14)
const inputs: FormalRelationInputs = {
  structuralPackagePaths,
  scatter: { ...source(scatterCrossbowFormalIdentity), target: readRaw(scatterCrossbowRelationDefinition.targetRawPath) },
  battleRobe: source(battleRobeFormalIdentity),
  deathCapMushroom: {
    ...source(deathCapMushroomFormalIdentity),
    target: readRaw(deathCapMushroomRelationDefinition.targetRawPath),
  },
  horizontalRelations: [
    ...collectionWave.filter(({ occurrence }) => occurrence.domainId !== 'scatter-crossbow'),
    ...wave.armor,
  ],
}
const preArmorInputs: FormalRelationInputs = {
  ...inputs,
  horizontalRelations: collectionWave.filter(({ occurrence }) => occurrence.domainId !== 'scatter-crossbow'),
}
const preArmorArtifact = buildFormalSerializedRelationArtifact(preArmorInputs)
assert.equal(preArmorArtifact.semantic.relations.length, 135)
assert.equal(preArmorArtifact.relationProjections.length, 135)
assert.equal(preArmorArtifact.relationCollections.length, 58)
assert.equal(new Set(preArmorArtifact.semantic.relations.map(({ sourceDomainId }) => sourceDomainId)).size, 60)

const artifact = buildFormalSerializedRelationArtifact(inputs)
assert.deepEqual(collectFormalSerializedRelationErrors(artifact, inputs), [])
assert.equal(artifact.schemaVersion, 2)
assert.equal(artifact.semantic.relations.length, 205)
assert.equal(artifact.relationProjections.length, 205)
assert.equal(artifact.relationCollections.length, 58)
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
assert.equal(horizontal.length, 133)
assert.ok(horizontal.every((record) => record.result === 'projected'
  && record.serializedTargetResolution.state === 'resolved-local-package'))
assert.ok(horizontal.filter(({ occurrence }) => occurrence.domainId !== 'scatter-crossbow').every((record) =>
  record.result === 'projected' && record.targetRawVerification.input === 'not-supplied'
  && record.targetRawVerification.result === 'not-resolved'
  && record.targetRawVerification.reason === 'target-snapshot-not-supplied'))
assert.equal(new Set(artifact.relationProjections.map(({ projectionRef }) => projectionRef)).size, 205)
assert.equal(new Set(artifact.semantic.relations.map(({ relationRef, occurrence }) =>
  `${relationRef}\0${JSON.stringify(occurrence)}`)).size, 205)
assert.equal(new Set(artifact.semantic.relations.map(({ sourceDomainId }) => sourceDomainId)).size, 130)

const preArmorProjectionRefs = new Set(preArmorArtifact.relationProjections.map(({ projectionRef }) => projectionRef))
assert.equal(artifact.relationProjections.filter(({ projectionRef }) => !preArmorProjectionRefs.has(projectionRef)).length, 70)
for (const relation of preArmorArtifact.semantic.relations) {
  assert.deepEqual(
    artifact.semantic.relations.find(({ projectionRef }) => projectionRef === relation.projectionRef),
    relation,
    `${relation.projectionRef}: existing semantic Relation changed during Armor breadth`,
  )
}
for (const projection of preArmorArtifact.relationProjections) {
  assert.deepEqual(
    artifact.relationProjections.find(({ projectionRef }) => projectionRef === projection.projectionRef),
    projection,
    `${projection.projectionRef}: existing Relation projection changed during Armor breadth`,
  )
}
assert.deepEqual(artifact.relationCollections, preArmorArtifact.relationCollections,
  'Existing Relation collections changed during Armor breadth')
for (const evidenceRecord of preArmorArtifact.provenance.evidence) {
  assert.deepEqual(
    artifact.provenance.evidence.find(({ id }) => id === evidenceRecord.id),
    evidenceRecord,
    `${evidenceRecord.id}: existing Relation evidence changed during Armor breadth`,
  )
}

const armorGearActor = artifact.relationProjections.filter(({ relationRef }) => relationRef.endsWith(':gear-actor@1'))
assert.equal(armorGearActor.length, 71)
assert.equal(new Set(armorGearActor.map(({ occurrence }) => occurrence.domainId)).size, 71)
assert.ok(armorGearActor.every(({ occurrence }) => !('sourceIndex' in occurrence) && occurrence.scopeRef === 'source'))
assert.ok(armorGearActor.every((record) => record.result === 'projected'
  && record.serializedTargetResolution.state === 'resolved-local-package'))
const newArmorDomainIds = new Set(wave.armor.map(({ occurrence }) => occurrence.domainId))
const newArmorGearActor = armorGearActor.filter(({ occurrence }) => newArmorDomainIds.has(occurrence.domainId))
assert.equal(newArmorGearActor.length, 70)
assert.ok(newArmorGearActor.every((record) => record.result === 'projected'
  && record.targetRawVerification.input === 'not-supplied'
  && record.targetRawVerification.result === 'not-resolved'
  && record.targetRawVerification.reason === 'target-snapshot-not-supplied'))
assert.equal(artifact.relationCollections.filter(({ domainId }) =>
  domainId === 'battle-robe' || newArmorDomainIds.has(domainId)).length, 0)

const committedBaselineProjectionRefs = new Set(artifact.relationProjections
  .filter(({ occurrence }) => !newArmorDomainIds.has(occurrence.domainId))
  .map(({ projectionRef }) => projectionRef))
const committedBaselineEvidenceRefs = new Set<string>()
for (const relation of artifact.semantic.relations.filter(({ projectionRef }) => committedBaselineProjectionRefs.has(projectionRef))) {
  for (const evidenceRef of relation.evidenceRefs) committedBaselineEvidenceRefs.add(evidenceRef)
}
for (const projection of artifact.relationProjections.filter(({ projectionRef }) => committedBaselineProjectionRefs.has(projectionRef))) {
  for (const evidenceRef of projection.evidenceRefs) committedBaselineEvidenceRefs.add(evidenceRef)
  if (projection.result === 'projected' && 'targetEvidenceRef' in projection.targetRawVerification) {
    committedBaselineEvidenceRefs.add(projection.targetRawVerification.targetEvidenceRef)
  }
}
for (const collection of artifact.relationCollections) committedBaselineEvidenceRefs.add(collection.evidenceRef)
const committedBaselineView = {
  schemaVersion: artifact.schemaVersion,
  artifactKind: artifact.artifactKind,
  semantic: {
    relations: artifact.semantic.relations.filter(({ projectionRef }) => committedBaselineProjectionRefs.has(projectionRef)),
  },
  relationCollections: artifact.relationCollections,
  relationProjections: artifact.relationProjections.filter(({ projectionRef }) => committedBaselineProjectionRefs.has(projectionRef)),
  provenance: {
    evidence: artifact.provenance.evidence.filter(({ id }) => committedBaselineEvidenceRefs.has(id)),
  },
}
assert.equal(committedBaselineView.semantic.relations.length, 135)
assert.equal(committedBaselineView.relationProjections.length, 135)
assert.equal(committedBaselineView.relationCollections.length, 58)
assert.equal(committedBaselineView.provenance.evidence.length, 144)
assert.equal(JSON.stringify(committedBaselineView).length, 397339,
  'Existing committed Relation baseline serialized length changed')
assert.equal(evidenceFingerprint(committedBaselineView), 'fnv1a32:a6bf6a42',
  'Existing committed 135 Relation records/evidence changed from baseline main 03bf6a5939a4fef1204ef1529c6e1156169eac6e')

const battleProjectionRef = 'projection:relation:battle-robe:gear-actor@1:source'
const preBattleProjection = preArmorArtifact.relationProjections.find(({ projectionRef }) => projectionRef === battleProjectionRef)
const battleProjection = artifact.relationProjections.find(({ projectionRef }) => projectionRef === battleProjectionRef)
assert.deepEqual(battleProjection, preBattleProjection, 'Battle Robe projection changed during Armor breadth')
const preBattleSemantic = preArmorArtifact.semantic.relations.find(({ projectionRef }) => projectionRef === battleProjectionRef)
const battleSemantic = artifact.semantic.relations.find(({ projectionRef }) => projectionRef === battleProjectionRef)
assert.deepEqual(battleSemantic, preBattleSemantic, 'Battle Robe semantic Relation changed during Armor breadth')
for (const evidenceRef of battleSemantic?.evidenceRefs ?? []) {
  assert.deepEqual(
    artifact.provenance.evidence.find(({ id }) => id === evidenceRef),
    preArmorArtifact.provenance.evidence.find(({ id }) => id === evidenceRef),
    `${evidenceRef}: Battle Robe evidence changed during Armor breadth`,
  )
}

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

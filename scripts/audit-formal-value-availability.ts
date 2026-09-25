import assert from 'node:assert/strict'
import fs from 'node:fs'
import {
  buildFormalValueAvailabilityArtifact,
  collectFormalValueAvailabilityErrors,
  type FormalValueAvailabilityArtifact,
  type ValueProjectionRecord,
} from '../src/domain/formal/valueAvailability.ts'
import type { RawPackageSnapshot } from './game-data-raw-package.ts'
import {
  formalIdentityDefinitions,
  fightersBindingsFormalIdentity,
  scatterCrossbowFormalIdentity,
  readyMeleeFormalIdentities,
  readyRangedFormalIdentities,
  reviewedBridgeMeleeFormalIdentities,
  reviewedBridgeRangedFormalIdentities,
} from '../src/domain/formal/identityDefinitions.ts'
import {
  type FormalIdentityDefinition,
  type FormalIdentityEvidenceArtifact,
  type FormalSemanticIdentity,
  type RawObservationEvidenceRecord,
} from '../src/domain/formal/identityEvidence.ts'
import { horizontalMeleeValueMappings, horizontalRangedValueMappings } from '../src/domain/formal/horizontalValueMappings.ts'
import { readHorizontalConfiguredValueSources } from './formal-value-horizontal-wave-sources.ts'
import { scatterCrossbowRelationDefinition, type FormalSerializedRelationArtifact } from '../src/domain/formal/serializedRelation.ts'
import { verifyValueRawTraceProvenance } from './formal-value-source-provenance.ts'

const root = new URL('..', import.meta.url)
const repositoryRoot = fs.realpathSync(root)
const read = <T>(relativePath: string): T => JSON.parse(fs.readFileSync(new URL(relativePath, root), 'utf8')) as T
const readRaw = (packagePath: string) => read<RawPackageSnapshot>(`research/raw/packages/${packagePath}.raw.json`)
const identity = read<FormalIdentityEvidenceArtifact>('research/domain/formal/identity-evidence-v1.json')
const relation = read<FormalSerializedRelationArtifact>('research/domain/formal/serialized-relation-v1.json')
const fightersRaw = readRaw(fightersBindingsFormalIdentity.assertion.applicationScope.packagePath)
const scatterRaw = readRaw(scatterCrossbowFormalIdentity.assertion.applicationScope.packagePath)
const scatterProjectileRaw = readRaw(scatterCrossbowRelationDefinition.targetRawPath)

function committedIdentity(definition: FormalIdentityDefinition): {
  identity: FormalSemanticIdentity
  evidence: RawObservationEvidenceRecord[]
} {
  const matches = identity.semantic.identities.filter(({ assertionId }) => assertionId === definition.assertion.id)
  assert.equal(matches.length, 1, `${definition.assertion.id}: expected one committed Identity record`)
  const semantic = matches[0]!
  assert.equal(semantic.resolution.state, 'matched', `${definition.assertion.id}: committed identity is not matched`)
  const records = identity.provenance.evidence.filter((record): record is RawObservationEvidenceRecord =>
    record.kind === 'raw-observation' && semantic.resolution.evidenceRefs.includes(record.id))
  return { identity: semantic, evidence: records }
}

const fightersIdentity = committedIdentity(fightersBindingsFormalIdentity)
const scatterIdentity = committedIdentity(scatterCrossbowFormalIdentity)
const horizontal = readHorizontalConfiguredValueSources({
  repositoryRoot,
  identity,
  definitions: formalIdentityDefinitions,
  excludedDomainIds: new Set([fightersBindingsFormalIdentity.assertion.domainId, scatterCrossbowFormalIdentity.assertion.domainId]),
})
const artifact = buildFormalValueAvailabilityArtifact({
  fightersBindingsRaw: fightersRaw,
  scatterCrossbowInstanceRaw: scatterRaw,
  scatterCrossbowProjectileRaw: scatterProjectileRaw,
  fightersBindingsIdentity: fightersIdentity.identity,
  fightersBindingsIdentityEvidence: fightersIdentity.evidence,
  scatterCrossbowIdentity: scatterIdentity.identity,
  scatterCrossbowIdentityEvidence: scatterIdentity.evidence,
  relations: relation,
  horizontalConfiguredSources: horizontal,
})

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

const meleeDefinitions = [fightersBindingsFormalIdentity, ...readyMeleeFormalIdentities, ...reviewedBridgeMeleeFormalIdentities]
const rangedDefinitions = [scatterCrossbowFormalIdentity, ...readyRangedFormalIdentities, ...reviewedBridgeRangedFormalIdentities]
const matchedMelee = new Set(identity.semantic.identities.filter((semantic) =>
  semantic.resolution.state === 'matched' && meleeDefinitions.some(({ assertion }) => assertion.id === semantic.assertionId))
  .map((semantic) => semantic.resolution.state === 'matched' ? semantic.resolution.domainId : ''))
const matchedRanged = new Set(identity.semantic.identities.filter((semantic) =>
  semantic.resolution.state === 'matched' && rangedDefinitions.some(({ assertion }) => assertion.id === semantic.assertionId))
  .map((semantic) => semantic.resolution.state === 'matched' ? semantic.resolution.domainId : ''))
const valueMelee = new Set(Object.keys(artifact.semantic.melee))
const valueRanged = new Set(Object.keys(artifact.semantic.ranged))
assert.equal(matchedMelee.size, 27)
assert.equal(matchedRanged.size, 23)
assert.deepEqual([...valueMelee].sort(), [...matchedMelee].sort())
assert.deepEqual([...valueRanged].sort(), [...matchedRanged].sort())
assert.equal(valueMelee.size + valueRanged.size, 50)
assert.equal(artifact.semantic.melee['battle-robe'], undefined)
assert.equal(artifact.semantic.melee['death-cap-mushroom'], undefined)
assert.equal(artifact.semantic.ranged['battle-robe'], undefined)
assert.equal(artifact.semantic.ranged['death-cap-mushroom'], undefined)

function requireProjected(record: ValueProjectionRecord | undefined, label: string): void {
  assert.ok(record, `${label}: first-wave projection is missing`)
  assert.equal(record.result, 'projected', `${label}: unexpected unavailable first-wave projection: ${record.result === 'unavailable' ? record.reason : ''}`)
}

function requireDomainFields(category: 'melee' | 'ranged', domainId: string, indices: number[]): void {
  const mappings = category === 'melee' ? horizontalMeleeValueMappings(domainId) : horizontalRangedValueMappings(domainId)
  const parentMappingId = category === 'melee' ? mappings.entries.id : mappings.definitions.id
  const parentOccurrence = category === 'melee'
    ? { domainId, scopeRef: 'configured-attacks' }
    : { domainId, scopeRef: 'projectile-definitions' }
  requireProjected(artifact.valueProjections.find((record) => record.mappingId === parentMappingId
    && JSON.stringify(record.occurrence) === JSON.stringify(parentOccurrence)), `${domainId}:collection`)
  const childMappingIds = category === 'melee'
    ? [mappings.damage.id, mappings.duration.id, mappings.attackRange.id, mappings.coneAngle.id, mappings.coneOffset.id,
      mappings.splashMultiplier.id, mappings.damageDelay.id, mappings.variantType.id, mappings.variantLoopAmount.id]
    : [mappings.projectileCount.id, mappings.delaySeconds.id, mappings.delayPerProjectile.id, mappings.angleSpan.id]
  for (const sourceIndex of indices) for (const mappingId of childMappingIds) {
    requireProjected(artifact.valueProjections.find((record) => record.mappingId === mappingId
      && record.occurrence.domainId === domainId && 'sourceIndex' in record.occurrence && record.occurrence.sourceIndex === sourceIndex),
    `${domainId}:${sourceIndex}:${mappingId}`)
  }
}

for (const [domainId, domain] of Object.entries(artifact.semantic.melee)) {
  assert.ok(domain.configuredAttacks, `${domainId}: configured attack collection is missing`)
  const indices = domain.configuredAttacks!.value
  assert.deepEqual(domain.attacks?.map(({ sourceIndex }) => sourceIndex), indices, `${domainId}: Melee sourceIndex set/order mismatch`)
  assert.equal(new Set(indices).size, indices.length, `${domainId}: duplicate Melee sourceIndex`)
  requireDomainFields('melee', domainId, indices)
}
for (const [domainId, domain] of Object.entries(artifact.semantic.ranged)) {
  assert.ok(domain.configuredProjectileDefinitions, `${domainId}: configured projectile collection is missing`)
  const indices = domain.configuredProjectileDefinitions!.value
  assert.deepEqual(domain.projectileDefinitions?.map(({ sourceIndex }) => sourceIndex), indices, `${domainId}: Ranged sourceIndex set/order mismatch`)
  assert.equal(new Set(indices).size, indices.length, `${domainId}: duplicate Ranged sourceIndex`)
  requireDomainFields('ranged', domainId, indices)
}

const preservedBaseline = read<{
  valueProjections: ValueProjectionRecord[]
  evidence: FormalValueAvailabilityArtifact['provenance']['evidence']
}>('tests/fixtures/formal-value-v2-horizontal-wave-baseline.json')
const stableJson = (value: unknown) => JSON.stringify(value)
for (const record of preservedBaseline.valueProjections) {
  const current = artifact.valueProjections.find(({ projectionId }) => projectionId === record.projectionId)
  assert.equal(stableJson(current), stableJson(record), `${record.projectionId}: existing Value projection record changed`)
}
for (const record of preservedBaseline.evidence) {
  const current = artifact.provenance.evidence.find(({ id }) => id === record.id)
  assert.equal(stableJson(current), stableJson(record), `${record.id}: existing Value evidence record changed`)
}

assert.deepEqual(artifact.semantic.melee['fighters-bindings']?.attacks?.map(({ configuredDamage }) => configuredDamage?.value), [25, 25, 25, 25])
assert.equal(artifact.semantic.ranged['scatter-crossbow']?.configuredProjectileVelocityFactor?.value, 1.100000023841858)
const scatterDefinition = artifact.semantic.ranged['scatter-crossbow']?.projectileDefinitions?.[0]
assert.deepEqual([
  scatterDefinition?.configuredProjectileCount?.value,
  scatterDefinition?.configuredAngleSpan?.value,
  scatterDefinition?.configuredDelaySecondsPerProjectile?.value,
  scatterDefinition?.configuredDelaySeconds?.value,
], [3, 20, 0.029999999329447746, 0])
assert.deepEqual([
  scatterDefinition?.configuredPushbackEnabled?.value,
  scatterDefinition?.configuredPushbackStrength?.value,
  scatterDefinition?.configuredIgnoreFriendlyFire?.value,
], [true, 0.6000000238418579, true])
assert.ok(scatterDefinition?.configuredPushbackEnabled?.relationProjectionRef)
assert.equal(scatterDefinition?.configuredPushbackEnabled?.relationProjectionRef, scatterDefinition?.configuredPushbackStrength?.relationProjectionRef)
assert.equal(scatterDefinition?.configuredPushbackEnabled?.relationProjectionRef, scatterDefinition?.configuredIgnoreFriendlyFire?.relationProjectionRef)

const rawUnavailable = artifact.valueProjections.filter((record) => record.result === 'unavailable' && record.failureKind === 'raw')
assert.deepEqual(rawUnavailable.map(({ projectionId, reason }) => ({ projectionId, reason })), [], 'Unexpected unavailable first-wave Raw facts')
assert.equal(artifact.valueProjections.filter((record) => record.result === 'unavailable' && record.failureKind === 'dependency').length, 0,
  'Current matched Melee/Ranged first-wave set unexpectedly contains dependency-unavailable projections')

const target = new URL('research/domain/formal/value-availability-v2.json', root)
const serialized = `${JSON.stringify(artifact, null, 2)}\n`
if (process.argv.includes('--write')) {
  fs.mkdirSync(new URL('.', target), { recursive: true })
  fs.writeFileSync(target, serialized)
}
assert.equal(fs.readFileSync(target, 'utf8'), serialized, 'Formal Value/Availability artifact drift; run generate:formal-value-availability')
console.log('Formal Value/Availability v2 audit passed: 27 Melee + 23 Ranged matched domains, complete first-wave projections, preserved baseline records, and verified source provenance.')

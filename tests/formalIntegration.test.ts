import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { RawPackageSnapshot } from '../scripts/game-data-raw-package.ts'
import { collectFormalIntegrationErrors } from '../src/domain/formal/integrationAudit.ts'
import { buildFormalIdentityEvidenceArtifact, projectFormalIdentity, type FormalIdentityEvidenceArtifact, type RawObservationEvidenceRecord } from '../src/domain/formal/identityEvidence.ts'
import { fightersBindingsFormalIdentity, scatterCrossbowFormalIdentity, battleRobeFormalIdentity, deathCapMushroomFormalIdentity } from '../src/domain/formal/identityDefinitions.ts'
import { battleRobeRelationDefinition, buildFormalSerializedRelationArtifact, deathCapMushroomRelationDefinition, scatterCrossbowRelationDefinition, type FormalSerializedRelationArtifact } from '../src/domain/formal/serializedRelation.ts'
import { buildFormalValueAvailabilityArtifact, type FormalValueAvailabilityArtifact } from '../src/domain/formal/valueAvailability.ts'

const definitions = [fightersBindingsFormalIdentity, scatterCrossbowFormalIdentity, battleRobeFormalIdentity, deathCapMushroomFormalIdentity]
const structuralPackagePaths = new Set([
  scatterCrossbowRelationDefinition.targetRawPath,
  battleRobeRelationDefinition.targetRawPath,
  deathCapMushroomRelationDefinition.targetRawPath,
])
const read = (path: string): RawPackageSnapshot => JSON.parse(fs.readFileSync(`research/raw/packages/${path}.raw.json`, 'utf8')) as RawPackageSnapshot
const source = (raw: RawPackageSnapshot, definition: typeof fightersBindingsFormalIdentity) => {
  const projected = projectFormalIdentity(raw, definition)
  return { source: raw, identity: projected.semantic,
    identityEvidence: projected.evidence.filter((record): record is RawObservationEvidenceRecord => record.kind === 'raw-observation') }
}
function artifacts() {
  const raws = definitions.map((definition) => read(definition.assertion.applicationScope.packagePath))
  const [fighters, scatter, battle, mushroom] = definitions.map((definition, index) => source(raws[index]!, definition))
  const projectile = read(scatterCrossbowRelationDefinition.targetRawPath)
  const identity = buildFormalIdentityEvidenceArtifact(definitions.map((definition, index) => ({ raw: raws[index]!, definition })))
  const relation = buildFormalSerializedRelationArtifact({ structuralPackagePaths, scatter: { ...scatter!, target: projectile }, battleRobe: battle!, deathCapMushroom: mushroom! })
  const value = buildFormalValueAvailabilityArtifact({ fightersBindingsRaw: fighters!.source, scatterCrossbowInstanceRaw: scatter!.source,
    scatterCrossbowProjectileRaw: projectile, fightersBindingsIdentity: fighters!.identity,
    fightersBindingsIdentityEvidence: fighters!.identityEvidence, scatterCrossbowIdentity: scatter!.identity,
    scatterCrossbowIdentityEvidence: scatter!.identityEvidence, relations: relation })
  return { identity, value, relation, raws, projectile }
}

describe('Formal Value v2 integration', () => {
  it('accepts all 58 connected current Melee/Ranged domains', () => {
    const identity = JSON.parse(fs.readFileSync('research/domain/formal/identity-evidence-v1.json', 'utf8')) as FormalIdentityEvidenceArtifact
    const value = JSON.parse(fs.readFileSync('research/domain/formal/value-availability-v2.json', 'utf8')) as FormalValueAvailabilityArtifact
    const relation = JSON.parse(fs.readFileSync('research/domain/formal/serialized-relation-v2.json', 'utf8')) as FormalSerializedRelationArtifact
    expect(Object.keys(value.semantic.melee)).toHaveLength(31)
    expect(Object.keys(value.semantic.ranged)).toHaveLength(27)
    const melee = relation.relationProjections.filter((item) => item.relationRef.endsWith(':attack-sequence@1'))
    const ranged = relation.relationProjections.filter((item) => item.relationRef.endsWith(':projectile@1'))
    expect(new Set(melee.map((item) => item.occurrence.domainId)).size).toBe(31)
    expect(melee).toHaveLength(106)
    expect(new Set(ranged.map((item) => item.occurrence.domainId)).size).toBe(27)
    expect(ranged).toHaveLength(27)
    expect(relation.relationCollections).toHaveLength(58)
    expect(relation.semantic.relations).toHaveLength(135)
    expect(relation.relationProjections).toHaveLength(135)
    expect(new Set(relation.relationProjections.map((item) => item.projectionRef)).size).toBe(135)
    expect(new Set(relation.semantic.relations.map((item) => `${item.relationRef}:${JSON.stringify(item.occurrence)}`)).size).toBe(135)
    expect(relation.relationProjections.slice(3).every((item) => item.result === 'projected'
      && item.serializedTargetResolution.state === 'resolved-local-package'
      && item.targetRawVerification.input === 'not-supplied'
      && item.targetRawVerification.reason === 'target-snapshot-not-supplied')).toBe(true)
    for (const record of value.valueProjections.filter((item) => item.relationProjectionRef)) {
      expect(relation.relationProjections.filter((item) => item.projectionRef === record.relationProjectionRef)).toHaveLength(1)
    }
    expect(collectFormalIntegrationErrors(identity, value, relation)).toEqual([])
  })
  it('rejects one normally generated artifact from another Raw snapshot', () => {
    const original = artifacts()
    const changed = structuredClone(original.raws[1]!)
    Object.assign(changed.logicalPackage.contentHash, { value: 'different-snapshot' })
    const changedIdentity = source(changed, scatterCrossbowFormalIdentity)
    const value = buildFormalValueAvailabilityArtifact({ fightersBindingsRaw: original.raws[0]!, scatterCrossbowInstanceRaw: changed,
      scatterCrossbowProjectileRaw: original.projectile, fightersBindingsIdentity: source(original.raws[0]!, fightersBindingsFormalIdentity).identity,
      fightersBindingsIdentityEvidence: source(original.raws[0]!, fightersBindingsFormalIdentity).identityEvidence,
      scatterCrossbowIdentity: changedIdentity.identity, scatterCrossbowIdentityEvidence: changedIdentity.identityEvidence, relations: original.relation })
    expect(collectFormalIntegrationErrors(original.identity, value, original.relation)).toContainEqual(expect.stringContaining('Value/Identity source mismatch'))
  })
  it('rejects a Value artifact supplied with another target snapshot', () => {
    const original = artifacts()
    const changedTarget = structuredClone(original.projectile)
    Object.assign(changedTarget.logicalPackage.contentHash, { value: 'different-target-snapshot' })
    const fighters = source(original.raws[0]!, fightersBindingsFormalIdentity)
    const scatter = source(original.raws[1]!, scatterCrossbowFormalIdentity)
    const value = buildFormalValueAvailabilityArtifact({ fightersBindingsRaw: fighters.source, scatterCrossbowInstanceRaw: scatter.source,
      scatterCrossbowProjectileRaw: changedTarget, fightersBindingsIdentity: fighters.identity,
      fightersBindingsIdentityEvidence: fighters.identityEvidence, scatterCrossbowIdentity: scatter.identity,
      scatterCrossbowIdentityEvidence: scatter.identityEvidence, relations: original.relation })
    expect(collectFormalIntegrationErrors(original.identity, value, original.relation)).toContainEqual(expect.stringContaining('resolved Relation dependency failure mismatch'))
  })
  it('rejects a wrong relation link and parent occurrence drift', () => {
    const original = artifacts()
    const value = structuredClone(original.value)
    const target = value.valueProjections.find((record) => record.relationProjectionRef)
    target!.relationProjectionRef = 'projection:wrong'
    expect(collectFormalIntegrationErrors(original.identity, value, original.relation)).toContainEqual(expect.stringContaining('relationProjectionRef mismatch'))
    const relation = structuredClone(original.relation)
    const scatterCollection = relation.relationCollections.find((item) =>
      item.domainId === 'scatter-crossbow' && item.collectionRef === 'projectile-definitions')
    if (!scatterCollection || scatterCollection.result !== 'projected') throw new Error('Scatter relation collection missing')
    scatterCollection.sourceIndices = [9]
    expect(collectFormalIntegrationErrors(original.identity, original.value, relation)).toContainEqual(expect.stringContaining('sourceIndex mismatch'))
  })
  it('rejects horizontal Relation collection drift outside Scatter', () => {
    const identity = JSON.parse(fs.readFileSync('research/domain/formal/identity-evidence-v1.json', 'utf8')) as FormalIdentityEvidenceArtifact
    const value = JSON.parse(fs.readFileSync('research/domain/formal/value-availability-v2.json', 'utf8')) as FormalValueAvailabilityArtifact
    const relation = JSON.parse(fs.readFileSync('research/domain/formal/serialized-relation-v2.json', 'utf8')) as FormalSerializedRelationArtifact
    const anchor = relation.relationCollections.find((item) => item.domainId === 'anchor')
    if (!anchor || anchor.result !== 'projected') throw new Error('Anchor Relation collection missing')
    anchor.sourceIndices = [9]
    expect(collectFormalIntegrationErrors(identity, value, relation)).toContainEqual(expect.stringContaining('anchor: Relation/Value sourceIndex mismatch'))
  })
})

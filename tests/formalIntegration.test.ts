import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { RawPackageSnapshot } from '../scripts/game-data-raw-package.ts'
import { collectFormalIntegrationErrors } from '../src/domain/formal/integrationAudit.ts'
import { buildFormalIdentityEvidenceArtifact, projectFormalIdentity, type RawObservationEvidenceRecord } from '../src/domain/formal/identityEvidence.ts'
import { fightersBindingsFormalIdentity, scatterCrossbowFormalIdentity, battleRobeFormalIdentity, deathCapMushroomFormalIdentity } from '../src/domain/formal/identityDefinitions.ts'
import { buildFormalSerializedRelationArtifact } from '../src/domain/formal/serializedRelation.ts'
import { buildFormalValueAvailabilityArtifact } from '../src/domain/formal/valueAvailability.ts'
import { scatterCrossbowIdentity } from '../src/domain/temporary/scatterCrossbowIdentity.ts'

const definitions = [fightersBindingsFormalIdentity, scatterCrossbowFormalIdentity, battleRobeFormalIdentity, deathCapMushroomFormalIdentity]
const read = (path: string): RawPackageSnapshot => JSON.parse(fs.readFileSync(`research/raw/packages/${path}.raw.json`, 'utf8')) as RawPackageSnapshot
const source = (raw: RawPackageSnapshot, definition: typeof fightersBindingsFormalIdentity) => {
  const projected = projectFormalIdentity(raw, definition)
  return { source: raw, identity: projected.semantic,
    identityEvidence: projected.evidence.filter((record): record is RawObservationEvidenceRecord => record.kind === 'raw-observation') }
}
function artifacts() {
  const raws = definitions.map((definition) => read(definition.assertion.applicationScope.packagePath))
  const [fighters, scatter, battle, mushroom] = definitions.map((definition, index) => source(raws[index]!, definition))
  const projectile = read(scatterCrossbowIdentity.projectilePackagePath)
  const identity = buildFormalIdentityEvidenceArtifact(definitions.map((definition, index) => ({ raw: raws[index]!, definition })))
  const relation = buildFormalSerializedRelationArtifact({ scatter: { ...scatter!, target: projectile }, battleRobe: battle!, deathCapMushroom: mushroom! })
  const value = buildFormalValueAvailabilityArtifact({ fightersBindingsRaw: fighters!.source, scatterCrossbowInstanceRaw: scatter!.source,
    scatterCrossbowProjectileRaw: projectile, fightersBindingsIdentity: fighters!.identity,
    fightersBindingsIdentityEvidence: fighters!.identityEvidence, scatterCrossbowIdentity: scatter!.identity,
    scatterCrossbowIdentityEvidence: scatter!.identityEvidence, relations: relation })
  return { identity, value, relation, raws, projectile }
}

describe('Formal v1 integration', () => {
  it('accepts connected current outcomes', () => {
    const { identity, value, relation } = artifacts()
    expect(collectFormalIntegrationErrors(identity, value, relation)).toEqual([])
  })
  it('rejects one normally generated artifact from another Raw snapshot', () => {
    const original = artifacts()
    const changed = structuredClone(original.raws[1]!)
    changed.logicalPackage.contentHash.value = 'different-snapshot'
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
    changedTarget.logicalPackage.contentHash.value = 'different-target-snapshot'
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
    relation.scatterParent!.sourceIndices = [9]
    expect(collectFormalIntegrationErrors(original.identity, original.value, relation)).toContainEqual(expect.stringContaining('sourceIndex mismatch'))
  })
})

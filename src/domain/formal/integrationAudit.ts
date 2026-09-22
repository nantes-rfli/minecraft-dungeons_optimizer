import type { FormalIdentityEvidenceArtifact, RawObservationEvidenceRecord } from './identityEvidence.ts'
import type { FormalValueAvailabilityArtifact } from './valueAvailability.ts'
import type { FormalSerializedRelationArtifact } from './serializedRelation.ts'
import { fightersBindingsFormalIdentity, scatterCrossbowFormalIdentity, battleRobeFormalIdentity, deathCapMushroomFormalIdentity } from './identityDefinitions.ts'
import { sameRawSource } from './boundarySource.ts'
import { scatterValueMappings } from './scatterValueMappings.ts'

export function collectFormalIntegrationErrors(identity: FormalIdentityEvidenceArtifact,
  value: FormalValueAvailabilityArtifact, relation: FormalSerializedRelationArtifact): string[] {
  const errors: string[] = []
  const check = (condition: boolean, message: string) => { if (!condition) errors.push(message) }
  const definitions = [fightersBindingsFormalIdentity, scatterCrossbowFormalIdentity, battleRobeFormalIdentity, deathCapMushroomFormalIdentity]
  const rawIdentity = identity.provenance.evidence.filter((item): item is RawObservationEvidenceRecord => item.kind === 'raw-observation')
  const sources = new Map<string, RawObservationEvidenceRecord['provenance']>()
  for (const definition of definitions) {
    const semantic = identity.semantic.identities.find((entry) => entry.assertionId === definition.assertion.id)
    const refs = semantic?.resolution.evidenceRefs ?? []
    const records = refs.map((ref) => rawIdentity.find((entry) => entry.id === ref))
    const assertion = identity.identityAssertions.find((item) => item.id === definition.assertion.id)
    if (assertion?.rawIdentity === definition.assertion.rawIdentity && assertion.domainId === definition.assertion.domainId
      && semantic?.resolution.state === 'matched' && semantic.resolution.domainId === assertion.domainId
      && records.length === 2 && records.every(Boolean)
      && records.every((record) => record?.observation.state === 'known' && record.observation.value === assertion.rawIdentity)
      && sameRawSource(records[0]!.provenance, records[1]!.provenance)) sources.set(definition.assertion.domainId, records[0]!.provenance)
  }
  for (const record of value.valueProjections) {
    const source = sources.get(record.occurrence.slice === 'fighters-bindings' ? 'fighters-bindings' : 'scatter-crossbow')
    check(Boolean(source), `${record.projectionId}: missing matched Identity`)
    const targetSide = record.occurrence.slice === 'scatter-crossbow' && [scatterValueMappings.pushbackEnabled.id,
      scatterValueMappings.pushbackStrength.id, scatterValueMappings.ignoreFriendlyFire.id].includes(record.mappingId as typeof scatterValueMappings.pushbackEnabled.id)
    if (!targetSide) check(record.relationProjectionRef === undefined, `${record.projectionId}: source-side Value has Relation dependency`)
    if (record.result === 'unavailable' && record.failureKind === 'dependency') continue
    for (const ref of record.evidenceRefs ?? []) {
      const evidence = value.provenance.evidence.find((item) => item.id === ref)
      if (!targetSide) check(Boolean(evidence && source && sameRawSource(evidence.provenance, source)), `${record.projectionId}: Value/Identity source mismatch`)
    }
  }
  for (const projected of relation.relationProjections) {
    const domainId = projected.occurrence.slice
    const source = sources.get(domainId)
    const semantic = relation.semantic.relations.find((item) => item.projectionRef === projected.projectionRef)
    if (semantic) check(semantic.sourceDomainId === domainId, `${projected.projectionRef}: relation domain mismatch`)
    check(Boolean(source), `${projected.projectionRef}: missing matched Identity`)
    for (const ref of projected.evidenceRefs) {
      const evidence = relation.provenance.evidence.find((item) => item.id === ref)
      check(Boolean(evidence && source && sameRawSource(evidence.provenance, source)), `${projected.projectionRef}: Relation/Identity source mismatch`)
    }
  }
  const parent = value.valueProjections.find((item) => item.mappingId === scatterValueMappings.definitions.id)
  const indices = value.semantic.scatterCrossbow.configuredProjectileDefinitions?.value
  check((parent?.result === 'projected') === (relation.scatterParent?.result === 'projected'), 'Scatter parent state mismatch')
  if (parent?.result === 'projected') check(JSON.stringify(indices) === JSON.stringify(relation.scatterParent?.sourceIndices), 'Scatter sourceIndex mismatch')
  const targetMappings = [scatterValueMappings.pushbackEnabled.id, scatterValueMappings.pushbackStrength.id, scatterValueMappings.ignoreFriendlyFire.id]
  for (const index of indices ?? []) {
    const matches = relation.relationProjections.filter((item) => item.occurrence.slice === 'scatter-crossbow' && item.occurrence.sourceIndex === index)
    check(matches.length === 1, `Scatter ${index}: Relation occurrence must be exactly one`)
    const dependency = matches[0]
    for (const mappingId of targetMappings) {
      const record = value.valueProjections.find((item) => item.mappingId === mappingId && 'sourceIndex' in item.occurrence && item.occurrence.sourceIndex === index)
      check(Boolean(record), `Scatter ${index}: target Value record missing`)
      if (!record) continue
      check(record.relationProjectionRef === dependency?.projectionRef, `${record.projectionId}: relationProjectionRef mismatch`)
      const resolved = dependency?.result === 'projected' && dependency.targetResolution.result === 'resolved'
      if (!resolved) {
        check(record.result === 'unavailable' && record.failureKind === 'dependency' && record.evidenceRefs === undefined,
          `${record.projectionId}: unresolved Relation must produce dependency failure without Raw evidence`)
        if (record.result === 'unavailable' && record.failureKind === 'dependency') {
          const expectedReason = dependency?.result === 'unavailable' ? 'relation-unavailable'
            : dependency?.result === 'projected' ? dependency.targetResolution.reason ?? 'target-not-resolved' : undefined
          check(record.reason === expectedReason, `${record.projectionId}: Relation dependency reason mismatch`)
        }
      } else if (record.result === 'unavailable' && record.failureKind === 'dependency') {
        check(record.reason === 'target-snapshot-not-supplied', `${record.projectionId}: resolved Relation dependency failure mismatch`)
      } else {
        const targetRef = 'targetEvidenceRef' in dependency.targetResolution ? dependency.targetResolution.targetEvidenceRef : undefined
        const target = targetRef ? relation.provenance.evidence.find((item) => item.id === targetRef) : undefined
        for (const ref of record.evidenceRefs ?? []) {
          const evidence = value.provenance.evidence.find((item) => item.id === ref)
          check(Boolean(target && evidence && sameRawSource(evidence.provenance, target.provenance)), `${record.projectionId}: resolved target snapshot mismatch`)
        }
      }
    }
  }
  return errors
}

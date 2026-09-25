import type { FormalIdentityEvidenceArtifact, RawObservationEvidenceRecord } from './identityEvidence.ts'
import type { FormalValueAvailabilityArtifact } from './valueAvailability.ts'
import type { FormalSerializedRelationArtifact } from './serializedRelation.ts'
import {
  formalIdentityDefinitions,
  fightersBindingsFormalIdentity,
  scatterCrossbowFormalIdentity,
  readyMeleeFormalIdentities,
  readyRangedFormalIdentities,
  reviewedBridgeMeleeFormalIdentities,
  reviewedBridgeRangedFormalIdentities,
} from './identityDefinitions.ts'
import { sameRawSource } from './boundarySource.ts'
import { horizontalMeleeValueMappings, horizontalRangedValueMappings } from './horizontalValueMappings.ts'
import { scatterValueMappings } from './scatterValueMappings.ts'

function canonicalSet(values: ReadonlySet<string>): string {
  return JSON.stringify([...values].sort())
}

export function collectFormalIntegrationErrors(identity: FormalIdentityEvidenceArtifact,
  value: FormalValueAvailabilityArtifact, relation: FormalSerializedRelationArtifact): string[] {
  const errors: string[] = []
  const check = (condition: boolean, message: string) => { if (!condition) errors.push(message) }
  const meleeDefinitions = [fightersBindingsFormalIdentity, ...readyMeleeFormalIdentities, ...reviewedBridgeMeleeFormalIdentities]
  const rangedDefinitions = [scatterCrossbowFormalIdentity, ...readyRangedFormalIdentities, ...reviewedBridgeRangedFormalIdentities]
  const definitions = formalIdentityDefinitions
  const categoryByAssertionId = new Map([
    ...meleeDefinitions.map(({ assertion }) => [assertion.id, 'melee' as const] as const),
    ...rangedDefinitions.map(({ assertion }) => [assertion.id, 'ranged' as const] as const),
  ])
  const rawIdentity = identity.provenance.evidence.filter((item): item is RawObservationEvidenceRecord => item.kind === 'raw-observation')
  const sources = new Map<string, RawObservationEvidenceRecord['provenance']>()
  const categoriesByDomain = new Map<string, 'melee' | 'ranged'>()
  for (const definition of definitions) {
    const semantic = identity.semantic.identities.find((entry) => entry.assertionId === definition.assertion.id)
    const refs = semantic?.resolution.evidenceRefs ?? []
    const records = refs.map((ref) => rawIdentity.find((entry) => entry.id === ref))
    const assertions = identity.identityAssertions.filter((item) => item.id === definition.assertion.id)
    const assertion = assertions[0]
    const itemIdRecords = rawIdentity.filter((record) => record.id === semantic?.rawEvidence.itemIdName.evidenceRef && record.field === 'ItemIdName')
    const serializedIdRecords = rawIdentity.filter((record) => record.id === semantic?.rawEvidence.serializedId.evidenceRef && record.field === 'ItemId.SerializedId')
    const itemId = itemIdRecords[0]
    const serializedId = serializedIdRecords[0]
    if (assertions.length === 1 && assertion?.rawIdentity === definition.assertion.rawIdentity
      && assertion.domainId === definition.assertion.domainId
      && assertion.applicationScope.packagePath === definition.assertion.applicationScope.packagePath
      && semantic?.assertionId === definition.assertion.id && semantic.resolution.state === 'matched'
      && semantic.resolution.assertionId === definition.assertion.id && semantic.resolution.domainId === assertion.domainId
      && semantic.rawEvidence.itemIdName.state === 'known' && semantic.rawEvidence.itemIdName.value === assertion.rawIdentity
      && semantic.rawEvidence.serializedId.state === 'known' && semantic.rawEvidence.serializedId.value === assertion.rawIdentity
      && refs.length === 2 && new Set(refs).size === 2 && records.length === 2 && records.every(Boolean)
      && itemIdRecords.length === 1 && serializedIdRecords.length === 1
      && refs.includes(itemId!.id) && refs.includes(serializedId!.id)
      && itemId!.observation.state === 'known' && itemId!.observation.value === assertion.rawIdentity
      && serializedId!.observation.state === 'known' && serializedId!.observation.value === assertion.rawIdentity
      && itemId!.provenance.packagePath === assertion.applicationScope.packagePath
      && sameRawSource(itemId!.provenance, serializedId!.provenance)) {
      sources.set(definition.assertion.domainId, itemId!.provenance)
      const category = categoryByAssertionId.get(definition.assertion.id)
      if (category) categoriesByDomain.set(definition.assertion.domainId, category)
    }
  }
  const matchedMelee = new Set([...categoriesByDomain].filter(([, category]) => category === 'melee').map(([domainId]) => domainId))
  const matchedRanged = new Set([...categoriesByDomain].filter(([, category]) => category === 'ranged').map(([domainId]) => domainId))
  const valueMelee = new Set(Object.keys(value.semantic.melee))
  const valueRanged = new Set(Object.keys(value.semantic.ranged))
  check(matchedMelee.size === 27, `Formal Identity Melee matched count differs from expected: ${matchedMelee.size}`)
  check(matchedRanged.size === 23, `Formal Identity Ranged matched count differs from expected: ${matchedRanged.size}`)
  check(canonicalSet(matchedMelee) === canonicalSet(valueMelee), 'Formal Value Melee domains differ from matched Identity')
  check(canonicalSet(matchedRanged) === canonicalSet(valueRanged), 'Formal Value Ranged domains differ from matched Identity')
  check(!valueMelee.has('battle-robe') && !valueMelee.has('death-cap-mushroom')
    && !valueRanged.has('battle-robe') && !valueRanged.has('death-cap-mushroom'), 'Armor or Artifact entered the Melee/Ranged Value wave')

  const validMappingIds = new Map<string, Set<string>>()
  for (const domainId of valueMelee) validMappingIds.set(domainId, new Set(Object.values(horizontalMeleeValueMappings(domainId)).map(({ id }) => id)))
  for (const domainId of valueRanged) validMappingIds.set(domainId, new Set(Object.values(horizontalRangedValueMappings(domainId)).map(({ id }) => id)))
  const scatterMappings = validMappingIds.get(scatterCrossbowFormalIdentity.assertion.domainId)
  if (scatterMappings) for (const mapping of Object.values(scatterValueMappings)) scatterMappings.add(mapping.id)
  for (const record of value.valueProjections) {
    const domainId = record.occurrence.domainId
    const source = sources.get(domainId)
    const category = categoriesByDomain.get(domainId)
    const mappingIds = validMappingIds.get(domainId)
    check(Boolean(source), `${record.projectionId}: missing matched Identity`)
    const categoryMatches = category === 'melee' ? valueMelee.has(domainId) : category === 'ranged' && valueRanged.has(domainId)
    check(Boolean(categoryMatches), `${record.projectionId}: Value category does not match authoritative Formal Identity category`)
    check(Boolean(mappingIds?.has(record.mappingId)), `${record.projectionId}: mapping is not bound to its matched domain/configured semantic`)
    const targetSide = record.occurrence.domainId === scatterCrossbowFormalIdentity.assertion.domainId && [scatterValueMappings.pushbackEnabled.id,
      scatterValueMappings.pushbackStrength.id, scatterValueMappings.ignoreFriendlyFire.id].includes(record.mappingId as typeof scatterValueMappings.pushbackEnabled.id)
    if (!targetSide) check(record.relationProjectionRef === undefined, `${record.projectionId}: source-side Value has Relation dependency`)
    if (record.result === 'unavailable' && record.failureKind === 'dependency') continue
    for (const ref of record.evidenceRefs ?? []) {
      const evidence = value.provenance.evidence.find((item) => item.id === ref)
      if (!targetSide) check(Boolean(evidence && source && sameRawSource(evidence.provenance, source)), `${record.projectionId}: Value/Identity source mismatch`)
    }
  }
  for (const projected of relation.relationProjections) {
    const domainId = projected.occurrence.domainId
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
  const indices = value.semantic.ranged[scatterCrossbowFormalIdentity.assertion.domainId]?.configuredProjectileDefinitions?.value
  const scatterCollection = relation.relationCollections.find((item) =>
    item.domainId === scatterCrossbowFormalIdentity.assertion.domainId && item.collectionRef === 'projectile-definitions')
  check((parent?.result === 'projected') === (scatterCollection?.result === 'projected'), 'Scatter parent state mismatch')
  if (parent?.result === 'projected' && scatterCollection?.result === 'projected') {
    check(JSON.stringify(indices) === JSON.stringify(scatterCollection.sourceIndices), 'Scatter sourceIndex mismatch')
  }
  const targetMappings = [scatterValueMappings.pushbackEnabled.id, scatterValueMappings.pushbackStrength.id, scatterValueMappings.ignoreFriendlyFire.id]
  for (const index of indices ?? []) {
    const matches = relation.relationProjections.filter((item) =>
      item.occurrence.domainId === 'scatter-crossbow'
      && 'sourceIndex' in item.occurrence
      && item.occurrence.collectionRef === 'projectile-definitions'
      && item.occurrence.sourceIndex === index)
    check(matches.length === 1, `Scatter ${index}: Relation occurrence must be exactly one`)
    const dependency = matches[0]
    for (const mappingId of targetMappings) {
      const record = value.valueProjections.find((item) => item.mappingId === mappingId && 'sourceIndex' in item.occurrence && item.occurrence.sourceIndex === index)
      check(Boolean(record), `Scatter ${index}: target Value record missing`)
      if (!record) continue
      check(record.relationProjectionRef === dependency?.projectionRef, `${record.projectionId}: relationProjectionRef mismatch`)
      const resolved = dependency?.result === 'projected' && dependency.targetRawVerification.result === 'resolved'
      if (!resolved) {
        check(record.result === 'unavailable' && record.failureKind === 'dependency' && record.evidenceRefs === undefined,
          `${record.projectionId}: unresolved Relation must produce dependency failure without Raw evidence`)
        if (record.result === 'unavailable' && record.failureKind === 'dependency') {
          const expectedReason = dependency?.result === 'unavailable' ? 'relation-unavailable'
            : dependency?.result === 'projected' ? dependency.targetRawVerification.reason ?? 'target-not-resolved' : undefined
          check(record.reason === expectedReason, `${record.projectionId}: Relation dependency reason mismatch`)
        }
      } else if (record.result === 'unavailable' && record.failureKind === 'dependency') {
        check(record.reason === 'target-snapshot-not-supplied', `${record.projectionId}: resolved Relation dependency failure mismatch`)
      } else {
        const targetRef = 'targetEvidenceRef' in dependency.targetRawVerification ? dependency.targetRawVerification.targetEvidenceRef : undefined
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

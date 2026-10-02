import { artifactValueMappings } from './artifactValueMappings.ts'
import type { FormalIdentityEvidenceArtifact, RawObservationEvidenceRecord } from './identityEvidence.ts'
import type { FormalValueAvailabilityArtifact } from './valueAvailability.ts'
import type { FormalSerializedRelationArtifact } from './serializedRelation.ts'
import { READY_ARTIFACT_ITEM_ACTOR_DOMAINS } from './relationWaves.ts'
import {
  formalIdentityDefinitions,
  fightersBindingsFormalIdentity,
  scatterCrossbowFormalIdentity,
  readyMeleeFormalIdentities,
  readyRangedFormalIdentities,
  reviewedBridgeMeleeFormalIdentities,
  reviewedBridgeRangedFormalIdentities,
  reviewedTypedRelationMeleeFormalIdentities,
  reviewedTypedRelationFormalIdentities,
  battleRobeFormalIdentity,
  READY_ARTIFACT_EFFECT_DOMAINS,
  readyArmorFormalIdentities,
} from './identityDefinitions.ts'
import { sameLogicalRawPackage, sameRawSource } from './boundarySource.ts'
import { horizontalMeleeValueMappings, horizontalRangedValueMappings } from './horizontalValueMappings.ts'
import { scatterValueMappings } from './scatterValueMappings.ts'

function canonicalSet(values: ReadonlySet<string>): string {
  return JSON.stringify([...values].sort())
}

export function collectFormalIntegrationErrors(identity: FormalIdentityEvidenceArtifact,
  value: FormalValueAvailabilityArtifact, relation: FormalSerializedRelationArtifact): string[] {
  const errors: string[] = []
  const check = (condition: boolean, message: string) => { if (!condition) errors.push(message) }
  const reviewedTypedRelationCatchupMeleeFormalIdentities = [
    ...reviewedTypedRelationMeleeFormalIdentities,
    ...reviewedTypedRelationFormalIdentities.filter(({ assertion }) =>
      assertion.domainId === 'chill-gale-knife' || assertion.domainId === 'resolute-tempest-knife'),
  ]
  const reviewedTypedRelationCatchupRangedFormalIdentities = reviewedTypedRelationFormalIdentities.filter(({ assertion }) =>
    assertion.domainId === 'bonebow' || assertion.domainId === 'twin-bow'
    || assertion.domainId === 'burst-gale-bow' || assertion.domainId === 'echo-of-the-valley')
  const meleeDefinitions = [
    fightersBindingsFormalIdentity,
    ...readyMeleeFormalIdentities,
    ...reviewedBridgeMeleeFormalIdentities,
    ...reviewedTypedRelationCatchupMeleeFormalIdentities,
  ]
  const rangedDefinitions = [
    scatterCrossbowFormalIdentity,
    ...readyRangedFormalIdentities,
    ...reviewedBridgeRangedFormalIdentities,
    ...reviewedTypedRelationCatchupRangedFormalIdentities,
  ]
  const armorDefinitions = [battleRobeFormalIdentity, ...readyArmorFormalIdentities]
  const armorDomainIds = new Set(armorDefinitions.map(({ assertion }) => assertion.domainId))
  const definitions = formalIdentityDefinitions
  const categoryByAssertionId = new Map<string, 'melee' | 'ranged' | 'artifact'>([
    ...definitions.filter(({ assertion }) => artifactValueMappings.some(({ domainId }) => domainId === assertion.domainId)).map(({ assertion }) => [assertion.id, 'artifact' as const] as const),
    ...meleeDefinitions.map(({ assertion }) => [assertion.id, 'melee' as const] as const),
    ...rangedDefinitions.map(({ assertion }) => [assertion.id, 'ranged' as const] as const),
  ])
  const rawIdentity = identity.provenance.evidence.filter((item): item is RawObservationEvidenceRecord => item.kind === 'raw-observation')
  const sources = new Map<string, RawObservationEvidenceRecord['provenance']>()
  const categoriesByDomain = new Map<string, 'melee' | 'ranged' | 'artifact'>()
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
  check(matchedMelee.size === 31, `Formal Identity Melee matched count differs from expected: ${matchedMelee.size}`)
  check(matchedRanged.size === 27, `Formal Identity Ranged matched count differs from expected: ${matchedRanged.size}`)
  const matchedArmor = new Set(armorDefinitions.filter(({ assertion }) => sources.has(assertion.domainId))
    .map(({ assertion }) => assertion.domainId))
  check(matchedArmor.size === 71, `Formal Identity Armor matched count differs from expected: ${matchedArmor.size}`)
  check(canonicalSet(matchedMelee) === canonicalSet(valueMelee), 'Formal Value Melee domains differ from matched Identity')
  check(canonicalSet(matchedRanged) === canonicalSet(valueRanged), 'Formal Value Ranged domains differ from matched Identity')
  check(!valueMelee.has('battle-robe') && !valueMelee.has('death-cap-mushroom')
    && !valueRanged.has('battle-robe') && !valueRanged.has('death-cap-mushroom')
    && [...armorDomainIds].every((domainId) => !valueMelee.has(domainId) && !valueRanged.has(domainId)),
  'Armor or Artifact entered the Melee/Ranged Value wave')

  const valueArtifact = new Set(Object.keys(value.semantic.artifact))
  check(canonicalSet(valueArtifact) === canonicalSet(new Set(artifactValueMappings.map(({ domainId }) => domainId))), 'Artifact Value domains differ from reviewed narrow set')
  for (const mapping of artifactValueMappings) {
    const records = value.valueProjections.filter(({ occurrence }) => occurrence.domainId === mapping.domainId)
    check(records.length === 1 && records[0]?.mappingId === mapping.id && 'scopeRef' in records[0].occurrence && records[0].occurrence.scopeRef === 'source', `${mapping.domainId}: Artifact Value must have one exact source occurrence`)
  }
  const validMappingIds = new Map<string, Set<string>>()
  for (const domainId of valueMelee) validMappingIds.set(domainId, new Set(Object.values(horizontalMeleeValueMappings(domainId)).map(({ id }) => id)))
  for (const domainId of valueRanged) validMappingIds.set(domainId, new Set(Object.values(horizontalRangedValueMappings(domainId)).map(({ id }) => id)))
  for (const mapping of artifactValueMappings) validMappingIds.set(mapping.domainId, new Set([mapping.id]))
  const scatterMappings = validMappingIds.get(scatterCrossbowFormalIdentity.assertion.domainId)
  if (scatterMappings) for (const mapping of Object.values(scatterValueMappings)) scatterMappings.add(mapping.id)
  for (const record of value.valueProjections) {
    const domainId = record.occurrence.domainId
    const source = sources.get(domainId)
    const category = categoriesByDomain.get(domainId)
    const mappingIds = validMappingIds.get(domainId)
    check(Boolean(source), `${record.projectionId}: missing matched Identity`)
    const categoryMatches = category === 'melee' ? valueMelee.has(domainId) : category === 'ranged' ? valueRanged.has(domainId) : category === 'artifact' && valueArtifact.has(domainId)
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
      check(Boolean(evidence && source && (sameRawSource(evidence.provenance, source)
        || (evidence.provenance.artifactPath.startsWith('research/raw/game-data-raw-structural-inventory/shards/')
          && source.artifactPath.startsWith('research/raw/packages/')
          && sameLogicalRawPackage(evidence.provenance, source)))), `${projected.projectionRef}: Relation/Identity source mismatch`)
    }
  }
  const armorGearActor = relation.relationProjections.filter((item) => item.relationRef.endsWith(':gear-actor@1'))
  const armorGearActorDomains = new Set(armorGearActor.map((item) => item.occurrence.domainId))
  check(armorGearActor.length === 71, `Armor GearActor relation count differs from expected: ${armorGearActor.length}`)
  check(canonicalSet(armorGearActorDomains) === canonicalSet(armorDomainIds), 'Armor GearActor domains differ from matched Armor Identity')
  for (const domainId of armorDomainIds) {
    const matches = armorGearActor.filter((item) => item.occurrence.domainId === domainId)
    check(matches.length === 1, `${domainId}: Armor GearActor relation must resolve exactly once`)
    const record = matches[0]
    if (!record) continue
    check(!('sourceIndex' in record.occurrence) && record.occurrence.scopeRef === 'source',
      `${domainId}: Armor GearActor occurrence must be source scope`)
    check(record.result === 'projected', `${domainId}: Armor GearActor relation is not projected`)
    if (record.result === 'projected') {
      check(record.serializedTargetResolution.state === 'resolved-local-package',
        `${domainId}: Armor GearActor target is not resolved-local-package`)
      if (domainId !== 'battle-robe') {
        check(record.targetRawVerification.input === 'not-supplied'
          && record.targetRawVerification.result === 'not-resolved'
          && record.targetRawVerification.reason === 'target-snapshot-not-supplied',
        `${domainId}: Armor GearActor target Raw verification boundary changed`)
      }
    }
  }
  check(relation.relationCollections.every((item) => !armorDomainIds.has(item.domainId)),
    'Armor scope relation entered relationCollections')
  const artifactEffects = relation.relationProjections.filter((item) => item.relationRef.endsWith(':effect@1'))
  check(artifactEffects.length === 10, `Artifact Effect count differs from expected: ${artifactEffects.length}`)
  check(canonicalSet(new Set(artifactEffects.map((item) => item.occurrence.domainId)))
    === canonicalSet(new Set(READY_ARTIFACT_EFFECT_DOMAINS)), 'Artifact Effect domains differ from reviewed ready set')
  for (const domainId of READY_ARTIFACT_EFFECT_DOMAINS) {
    const matches = artifactEffects.filter((item) => item.occurrence.domainId === domainId)
    check(matches.length === 1, `${domainId}: Artifact Effect projection must resolve exactly once`)
    const record = matches[0]
    if (!record) continue
    check(!('sourceIndex' in record.occurrence) && record.occurrence.scopeRef === 'source',
      `${domainId}: Artifact Effect occurrence must be source scope`)
    check(record.result === 'projected', `${domainId}: Artifact Effect is not projected`)
    if (record.result === 'projected') {
      check(record.serializedTargetResolution.state === 'resolved-local-package',
        `${domainId}: Artifact Effect target is not resolved-local-package`)
      if (domainId !== 'death-cap-mushroom') {
        check(record.targetRawVerification.input === 'not-supplied'
          && record.targetRawVerification.result === 'not-resolved'
          && record.targetRawVerification.reason === 'target-snapshot-not-supplied',
          `${domainId}: Artifact Effect target Raw verification boundary changed`)
      }
    }
  }
  check(relation.relationCollections.every((item) => !READY_ARTIFACT_EFFECT_DOMAINS.includes(item.domainId as typeof READY_ARTIFACT_EFFECT_DOMAINS[number])),
    'Artifact Effect scope relation entered relationCollections')
  const itemActors = relation.relationProjections.filter((item) => item.relationRef.endsWith(':item-actor@1'))
  check(itemActors.length === 11, `Artifact ItemActor count differs from expected: ${itemActors.length}`)
  check(canonicalSet(new Set(itemActors.map((item) => item.occurrence.domainId)))
    === canonicalSet(new Set(READY_ARTIFACT_ITEM_ACTOR_DOMAINS)), 'Artifact ItemActor domains differ from reviewed set')
  for (const domainId of READY_ARTIFACT_ITEM_ACTOR_DOMAINS) {
    const matches = itemActors.filter((item) => item.occurrence.domainId === domainId)
    const record = matches[0]
    check(matches.length === 1, `${domainId}: Artifact ItemActor projection must resolve exactly once`)
    if (!record) continue
    check(record.projectionRef === `projection:relation:${domainId}:item-actor@1:source`,
      `${domainId}: Artifact ItemActor projectionRef mismatch`)
    check(!('sourceIndex' in record.occurrence) && record.occurrence.scopeRef === 'source',
      `${domainId}: Artifact ItemActor occurrence must be source scope`)
    check(record.result === 'projected', `${domainId}: Artifact ItemActor is not projected`)
    if (record.result === 'projected') {
      check(record.serializedTargetResolution.state === 'resolved-local-package',
        `${domainId}: Artifact ItemActor target is not resolved-local-package`)
      check(record.targetRawVerification.input === 'not-supplied'
        && record.targetRawVerification.result === 'not-resolved'
        && record.targetRawVerification.reason === 'target-snapshot-not-supplied',
      `${domainId}: Artifact ItemActor target Raw verification boundary changed`)
    }
  }
  check(relation.relationCollections.every((item) => !READY_ARTIFACT_ITEM_ACTOR_DOMAINS.includes(item.domainId as typeof READY_ARTIFACT_ITEM_ACTOR_DOMAINS[number])),
    'Artifact ItemActor scope relation entered relationCollections')
  const spinWheels = relation.relationProjections.filter((item) => item.relationRef.endsWith(':spin-wheel-actor@1'))
  check(spinWheels.length === 1, 'SpinWheelActor projection must resolve exactly once')
  const spinWheel = spinWheels[0]
  if (spinWheel) {
    check(spinWheel.relationRef === 'relation:spinblade:spin-wheel-actor@1'
      && spinWheel.projectionRef === 'projection:relation:spinblade:spin-wheel-actor@1:source', 'SpinWheelActor refs mismatch')
    check(spinWheel.occurrence.domainId === 'spinblade' && !('sourceIndex' in spinWheel.occurrence)
      && spinWheel.occurrence.scopeRef === 'source', 'SpinWheelActor occurrence mismatch')
    check(spinWheel.result === 'projected', 'SpinWheelActor must be projected')
    if (spinWheel.result === 'projected') {
      const spinRelation = relation.semantic.relations.filter((item) => item.projectionRef === spinWheel.projectionRef)
      check(spinRelation.length === 1 && spinRelation[0]?.target.objectName === 'BP_SpinWheelActor_C'
        && spinRelation[0]?.target.gamePackagePath === '/Game/Content_DLC4/Actors/Items/SpinWheel/BP_SpinWheelActor', 'SpinWheelActor target mismatch')
      check(spinWheel.serializedTargetResolution.state === 'resolved-local-package', 'SpinWheelActor Structural target unresolved')
      check(spinWheel.targetRawVerification.input === 'not-supplied'
        && spinWheel.targetRawVerification.result === 'not-resolved'
        && spinWheel.targetRawVerification.reason === 'target-snapshot-not-supplied', 'SpinWheelActor full Raw boundary changed')
    }
  }
  check(relation.relationCollections.every((item) => item.domainId !== 'spinblade'), 'SpinWheelActor entered collections')
  const fishHooks = relation.relationProjections.filter((item) => item.relationRef.endsWith(':fish-hook@1'))
  check(fishHooks.length === 1, 'FishHook projection must resolve exactly once')
  const fishHook = fishHooks[0]
  if (fishHook) {
    check(fishHook.relationRef === 'relation:fishing-rod:fish-hook@1'
      && fishHook.projectionRef === 'projection:relation:fishing-rod:fish-hook@1:source', 'FishHook refs mismatch')
    check(fishHook.occurrence.domainId === 'fishing-rod' && !('sourceIndex' in fishHook.occurrence)
      && fishHook.occurrence.scopeRef === 'source', 'FishHook occurrence mismatch')
    check(fishHook.result === 'projected', 'FishHook must be projected')
    if (fishHook.result === 'projected') {
      const hookRelation = relation.semantic.relations.filter((item) => item.projectionRef === fishHook.projectionRef)
      check(hookRelation.length === 1 && hookRelation[0]?.target.objectName === 'BP_FishHookItem_C'
        && hookRelation[0]?.target.gamePackagePath === '/Game/Actors/Items/FishingRod/BP_FishHookItem', 'FishHook target mismatch')
      check(fishHook.serializedTargetResolution.state === 'resolved-local-package', 'FishHook Structural target unresolved')
      check(fishHook.targetRawVerification.input === 'not-supplied'
        && fishHook.targetRawVerification.result === 'not-resolved'
        && fishHook.targetRawVerification.reason === 'target-snapshot-not-supplied', 'FishHook full Raw boundary changed')
    }
  }
  check(relation.relationCollections.every((item) => item.domainId !== 'fishing-rod'), 'FishHook entered collections')
  const spores = relation.relationProjections.filter((row) => row.relationRef.endsWith(':spore-grenade-spawn-class@1'))
  check(spores.length === 1, 'SporeGrenade exact population mismatch')
  check(spores[0]?.relationRef === 'relation:blast-fungus:spore-grenade-spawn-class@1'
    && JSON.stringify(spores[0].occurrence) === JSON.stringify({ domainId: 'blast-fungus', collectionRef: 'spore-grenade-spawn-classes', sourceIndex: 0 }), 'SporeGrenade indexed occurrence mismatch')
  const sporeCollections = relation.relationCollections.filter((row) => row.domainId === 'blast-fungus')
  check(sporeCollections.length === 1 && sporeCollections[0]?.collectionRef === 'spore-grenade-spawn-classes'
    && sporeCollections[0].result === 'projected' && JSON.stringify(sporeCollections[0].sourceIndices) === '[0]', 'SporeGrenade collection mismatch')
  check(relation.semantic.relations.length === 228,
    `Formal Relation semantic count differs from expected: ${relation.semantic.relations.length}`)
  check(relation.relationProjections.length === 228,
    `Formal Relation projection count differs from expected: ${relation.relationProjections.length}`)
  check(relation.relationCollections.length === 59,
    `Formal Relation collection count differs from expected: ${relation.relationCollections.length}`)
  check(new Set(relation.semantic.relations.map((item) => item.sourceDomainId)).size === 147,
    'Formal Relation unique source domain count differs from expected')

  for (const [category, domains, collectionRef] of [
    ['melee', valueMelee, 'configured-attacks'],
    ['ranged', valueRanged, 'projectile-definitions'],
  ] as const) {
    for (const domainId of domains) {
      const indices = category === 'melee' ? value.semantic.melee[domainId]?.configuredAttacks?.value
        : value.semantic.ranged[domainId]?.configuredProjectileDefinitions?.value
      const collections = relation.relationCollections.filter((item) =>
        item.domainId === domainId && item.collectionRef === collectionRef)
      check(collections.length === 1, `${domainId}: Relation collection must resolve exactly once`)
      const collection = collections[0]
      check(collection?.result === 'projected', `${domainId}: Relation collection is not projected`)
      if (collection?.result !== 'projected') continue
      check(JSON.stringify(collection.sourceIndices) === JSON.stringify(indices), `${domainId}: Relation/Value sourceIndex mismatch`)
      const projections = relation.relationProjections.filter((item) =>
        item.occurrence.domainId === domainId && 'sourceIndex' in item.occurrence
        && item.occurrence.collectionRef === collectionRef)
      check(projections.length === collection.sourceIndices.length, `${domainId}: Relation occurrence count mismatch`)
      for (const index of collection.sourceIndices) {
        check(projections.filter((item) => 'sourceIndex' in item.occurrence && item.occurrence.sourceIndex === index).length === 1,
          `${domainId}:${index}: Relation occurrence must resolve exactly once`)
      }
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
            : dependency?.result === 'projected'
              ? ('reason' in dependency.targetRawVerification ? dependency.targetRawVerification.reason : 'target-not-resolved')
              : undefined
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

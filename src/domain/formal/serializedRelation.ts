import type { RawPackageSnapshot } from '../../../scripts/game-data-raw-package.ts'
import { locateRawNode, nestedRawNode, rawCdoCandidates, topLevelRawNode, type Located } from './rawProjection.ts'
import { battleRobeFormalIdentity, deathCapMushroomFormalIdentity, scatterCrossbowFormalIdentity } from './identityDefinitions.ts'
import { evidenceFingerprint, type FormalSemanticIdentity, type RawObservationEvidenceRecord } from './identityEvidence.ts'
import { matchedIdentityDomainId } from './boundarySource.ts'
import type { RawTrace } from './rawProjection.ts'

export type RelationKind = 'attack-sequence' | 'projectile' | 'gear-actor' | 'effect' | 'item-actor'
export type RelationRef = `relation:${string}:${RelationKind}@1`
export type RelationProjectionRef = string
export type RelationEvidenceRef = string

export type ScopeRelationOccurrence = {
  domainId: string
  scopeRef: string
}

export type CollectionRelationOccurrence = {
  domainId: string
  collectionRef: string
  sourceIndex: number
}

export type RelationOccurrence = ScopeRelationOccurrence | CollectionRelationOccurrence
export type SerializedTarget = { objectName: string; gamePackagePath: string }
export type SerializedTargetResolution =
  | { state: 'resolved-local-package'; structuralPackagePath: string }
  | { state: 'known-null' | 'native-boundary' | 'outside-game-boundary' | 'missing-target' | 'parser-boundary' }
export type TargetRawVerification =
  | { input: 'not-supplied'; result: 'not-resolved'; reason: 'target-snapshot-not-supplied' }
  | { input: 'supplied'; result: 'resolved'; targetEvidenceRef: RelationEvidenceRef }
  | { input: 'supplied'; result: 'not-resolved'; reason: 'target-snapshot-mismatch'; targetEvidenceRef: RelationEvidenceRef }

export type SemanticRelation = {
  projectionRef: RelationProjectionRef
  relationRef: RelationRef
  occurrence: RelationOccurrence
  sourceDomainId: string
  target: SerializedTarget
  evidenceRefs: RelationEvidenceRef[]
}

export type RelationProjectionRecord = {
  projectionRef: RelationProjectionRef
  relationRef: RelationRef
  occurrence: RelationOccurrence
  evidenceRefs: RelationEvidenceRef[]
} & (
  | {
      result: 'projected'
      serializedTargetResolution: SerializedTargetResolution
      targetRawVerification: TargetRawVerification
    }
  | { result: 'unavailable'; reason: string; failureStage: 'object-property' | 'class-import' | 'outer-package' }
)

export type RelationCollectionRecord = {
  domainId: string
  collectionRef: string
  evidenceRef: RelationEvidenceRef
} & (
  | { result: 'projected'; sourceIndices: number[] }
  | { result: 'unavailable'; reason: string }
)

export type RelationEvidenceRecord = {
  id: RelationEvidenceRef
  kind: 'raw-relation-observation'
  fingerprint: string
  provenance: {
    artifactPath: string
    datasetId: string
    extractionRunId: string
    packagePath: string
    packageHash: RawPackageSnapshot['logicalPackage']['contentHash']
    nodePointer?: string
  }
  observed: unknown
}

export type FormalSerializedRelationArtifact = {
  schemaVersion: 2
  artifactKind: 'formal-domain-serialized-relation'
  semantic: { relations: SemanticRelation[] }
  relationCollections: RelationCollectionRecord[]
  relationProjections: RelationProjectionRecord[]
  provenance: { evidence: RelationEvidenceRecord[] }
}

export type RelationSliceInput = {
  source: RawPackageSnapshot
  identity: FormalSemanticIdentity
  identityEvidence: RawObservationEvidenceRecord[]
  target?: RawPackageSnapshot
}
export type FormalRelationInputs = {
  scatter: RelationSliceInput
  battleRobe: RelationSliceInput
  deathCapMushroom: RelationSliceInput
  structuralPackagePaths: ReadonlySet<string>
  horizontalRelations?: readonly HorizontalRelationInput[]
}

export type HorizontalRelationInput = {
  sourceDomainId: string
  relationRef: RelationRef
  occurrence: RelationOccurrence
  source: RawTrace
  target: SerializedTarget
  serializedTargetResolution: SerializedTargetResolution
  structuralEdge: unknown
}

export function relationRefForDomain(domainId: string, kind: RelationKind): RelationRef {
  if (!domainId) throw new Error('Relation domainId is required')
  return `relation:${domainId}:${kind}@1` as RelationRef
}

export type HorizontalRelationDefinition = {
  relationRef: RelationRef
  relationKind: 'attack-sequence' | 'projectile'
  collectionRef: 'configured-attacks' | 'projectile-definitions'
  parentRawField: 'ConfiguredAttackVariants' | 'ProjectileDefinition'
  childRawField: 'AttackSequence' | 'Projectile'
}

export function horizontalRelationDefinition(domainId: string, category: 'melee' | 'ranged'): HorizontalRelationDefinition {
  return category === 'melee'
    ? {
        relationRef: relationRefForDomain(domainId, 'attack-sequence'),
        relationKind: 'attack-sequence',
        collectionRef: 'configured-attacks',
        parentRawField: 'ConfiguredAttackVariants',
        childRawField: 'AttackSequence',
      }
    : {
        relationRef: relationRefForDomain(domainId, 'projectile'),
        relationKind: 'projectile',
        collectionRef: 'projectile-definitions',
        parentRawField: 'ProjectileDefinition',
        childRawField: 'Projectile',
      }
}

export const scatterCrossbowRelationDefinition = {
  key: 'scatter',
  relationRef: relationRefForDomain('scatter-crossbow', 'projectile'),
  collectionRef: 'projectile-definitions',
  field: 'Projectile',
  identity: scatterCrossbowFormalIdentity,
  targetGamePath: '/Game/Actors/Equipment/RangedWeapons/ScatterCrossbow/BP_ScatterCrossBow_Arrow',
  targetRawPath: 'Dungeons/Content/Actors/Equipment/RangedWeapons/ScatterCrossbow/BP_ScatterCrossBow_Arrow',
} as const
export const battleRobeRelationDefinition = {
  key: 'battleRobe',
  relationRef: relationRefForDomain('battle-robe', 'gear-actor'),
  scopeRef: 'source',
  field: 'GearActor',
  identity: battleRobeFormalIdentity,
  targetGamePath: '/Game/Actors/Equipment/Armor/BattleRobe/BP_BattleRobe',
  targetRawPath: 'Dungeons/Content/Actors/Equipment/Armor/BattleRobe/BP_BattleRobe',
} as const
export const deathCapMushroomRelationDefinition = {
  key: 'deathCapMushroom',
  relationRef: relationRefForDomain('death-cap-mushroom', 'effect'),
  scopeRef: 'source',
  field: 'Effect',
  identity: deathCapMushroomFormalIdentity,
  targetGamePath: '/Game/Actors/Items/DeathCapMushroom/BP_DeathCapMushroomGameplayEffect',
  targetRawPath: 'Dungeons/Content/Actors/Items/DeathCapMushroom/BP_DeathCapMushroomGameplayEffect',
} as const

const definitions = [scatterCrossbowRelationDefinition, battleRobeRelationDefinition, deathCapMushroomRelationDefinition] as const
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
const at = (root: unknown, pointer: string) => pointer.split('/').slice(1).reduce<unknown>((value, key) => (value as Record<string, unknown> | undefined)?.[key], root)
const pathFor = (raw: RawPackageSnapshot) => `research/raw/packages/${raw.logicalPackage.path}.raw.json`
const provenance = (raw: RawPackageSnapshot, pointer?: string) => ({
  artifactPath: pathFor(raw),
  datasetId: raw.dataset.id,
  extractionRunId: raw.extraction.runId,
  packagePath: raw.logicalPackage.path,
  packageHash: raw.logicalPackage.contentHash,
  ...(pointer === undefined ? {} : { nodePointer: pointer }),
})

export function relationProjectionRef(relationRef: RelationRef, occurrence: RelationOccurrence): RelationProjectionRef {
  return `projection:${relationRef}:${'sourceIndex' in occurrence ? occurrence.sourceIndex : 'source'}`
}

function validRawName(value: unknown): boolean {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const name = value as Record<string, unknown>
  return Number.isInteger(name.nameIndex) && (name.nameIndex as number) >= 0
    && Number.isInteger(name.number) && (name.number as number) >= 0
    && typeof name.value === 'string' && name.value.length > 0
}

function structuralPackagePathForGamePackage(gamePackagePath: string): string | undefined {
  return gamePackagePath.startsWith('/Game/')
    ? `Dungeons/Content/${gamePackagePath.slice('/Game/'.length)}`
    : undefined
}

export function serializedTargetResolutionFromStructuralEdge(
  edge: {
    targetPackage?: unknown
    targetKind?: unknown
    traversal?: unknown
  },
  structuralPackagePaths: ReadonlySet<string>,
): SerializedTargetResolution {
  const traversal = typeof edge.traversal === 'object' && edge.traversal !== null && !Array.isArray(edge.traversal)
    ? edge.traversal as Record<string, unknown>
    : {}
  const stopReason = traversal.stopReason

  if (stopReason === 'null-reference' || edge.targetKind === 'null') return { state: 'known-null' }
  if (stopReason === 'native-boundary') return { state: 'native-boundary' }
  if (stopReason === 'outside-game-boundary') return { state: 'outside-game-boundary' }
  if (stopReason === 'missing-target') return { state: 'missing-target' }
  if (stopReason === 'parser-boundary'
    || stopReason === 'unresolved-package-index'
    || stopReason === 'invalid-package-index') {
    return { state: 'parser-boundary' }
  }
  if (stopReason !== 'followed'
    && stopReason !== 'already-visited'
    && stopReason !== 'package-local-reference') {
    throw new Error(`Unsupported Structural traversal stopReason for serialized target resolution: ${String(stopReason)}`)
  }

  const targetPackage = typeof edge.targetPackage === 'string' && edge.targetPackage.length > 0
    ? edge.targetPackage
    : undefined
  return targetPackage && structuralPackagePaths.has(targetPackage)
    ? { state: 'resolved-local-package', structuralPackagePath: targetPackage }
    : { state: 'missing-target' }
}

function serializedTargetResolutionFor(
  target: SerializedTarget,
  structuralPackagePaths: ReadonlySet<string>,
): SerializedTargetResolution {
  const structuralPackagePath = structuralPackagePathForGamePackage(target.gamePackagePath)
  return structuralPackagePath && structuralPackagePaths.has(structuralPackagePath)
    ? { state: 'resolved-local-package', structuralPackagePath }
    : { state: 'missing-target' }
}

export function buildFormalSerializedRelationArtifact(inputs: FormalRelationInputs): FormalSerializedRelationArtifact {
  const relations: SemanticRelation[] = []
  const records: RelationProjectionRecord[] = []
  const relationCollections: RelationCollectionRecord[] = []
  const evidence = new Map<string, RelationEvidenceRecord>()
  const observe = (raw: RawPackageSnapshot, pointer?: string): string => {
    const p = provenance(raw, pointer)
    const id = `evidence:relation:${evidenceFingerprint(p)}`
    const base = {
      id,
      kind: 'raw-relation-observation' as const,
      provenance: p,
      observed: pointer === undefined
        ? { schemaVersion: raw.schemaVersion, dataset: raw.dataset, logicalPackage: raw.logicalPackage }
        : at(raw, pointer),
    }
    evidence.set(id, { ...base, fingerprint: evidenceFingerprint(base) })
    return id
  }
  const observeHorizontal = (input: HorizontalRelationInput): string => {
    const p = input.source
    const id = `evidence:relation:${evidenceFingerprint(p)}`
    const base = {
      id,
      kind: 'raw-relation-observation' as const,
      provenance: p,
      observed: input.structuralEdge,
    }
    evidence.set(id, { ...base, fingerprint: evidenceFingerprint(base) })
    return id
  }

  for (const definition of definitions) {
    const input = inputs[definition.key]
    const raw = input.source
    const sourceDomainId = matchedIdentityDomainId(raw, definition.identity, input.identity, input.identityEvidence)
    if (!sourceDomainId) continue
    const cdo = rawCdoCandidates(raw)
    const selected = cdo.length === 1 ? cdo[0] : undefined
    let occurrences: { occurrence: RelationOccurrence; located: Located }[]

    if (definition.key === 'scatter') {
      const parent = nestedRawNode(topLevelRawNode(selected, 'AttackDefintion'), 'ProjectileDefinition')
      const elements = parent.node?.type.value === 'ArrayProperty' && parent.node.decoding.state === 'decoded'
        ? parent.node.decoding.elements : undefined
      const evidenceRef = observe(raw, parent.pointer)
      if (!elements || !elements.every((element) => Number.isInteger(element.index) && element.index >= 0)
        || new Set(elements.map((element) => element.index)).size !== elements.length) {
        relationCollections.push({
          domainId: sourceDomainId,
          collectionRef: definition.collectionRef,
          result: 'unavailable',
          evidenceRef,
          reason: 'missing-or-ambiguous-projectile-definition-collection',
        })
        continue
      }
      relationCollections.push({
        domainId: sourceDomainId,
        collectionRef: definition.collectionRef,
        result: 'projected',
        evidenceRef,
        sourceIndices: elements.map((element) => element.index),
      })
      occurrences = elements.map((element, position) => ({
        occurrence: {
          domainId: sourceDomainId,
          collectionRef: definition.collectionRef,
          sourceIndex: element.index,
        },
        located: element.decoding.state === 'decoded'
          ? locateRawNode(element.properties, `${parent.pointer}/decoding/elements/${position}/properties`, 'Projectile')
          : { pointer: `${parent.pointer}/decoding/elements/${position}`, unavailable: element.decoding.state },
      }))
    } else {
      occurrences = [{
        occurrence: { domainId: sourceDomainId, scopeRef: definition.scopeRef },
        located: topLevelRawNode(selected, definition.field),
      }]
    }

    for (const { occurrence, located } of occurrences) {
      const projectionRef = relationProjectionRef(definition.relationRef, occurrence)
      const refs = [observe(raw, located.pointer)]
      const unavailable = (reason: string, failureStage: 'object-property' | 'class-import' | 'outer-package') =>
        records.push({
          projectionRef,
          relationRef: definition.relationRef,
          occurrence,
          evidenceRefs: [...new Set(refs)],
          result: 'unavailable',
          reason,
          failureStage,
        })
      const node = located.node
      const value = node?.decoding.state === 'decoded' ? node.decoding.value : undefined
      if (!node || node.type.value !== 'ObjectProperty' || !value || typeof value !== 'object' || Array.isArray(value)) {
        unavailable('missing-or-invalid-object-property', 'object-property')
        continue
      }
      const ref = value as Record<string, unknown>
      if (ref.kind !== 'import' || !Number.isInteger(ref.rawPackageIndex) || (ref.rawPackageIndex as number) >= 0
        || !Number.isInteger(ref.index) || (ref.index as number) < 0
        || typeof ref.objectName !== 'string' || typeof ref.className !== 'string') {
        unavailable('invalid-import-reference', 'object-property')
        continue
      }
      const classes = raw.package.imports.map((entry, index) => ({ entry, index }))
        .filter(({ entry }) => entry.rawPackageIndex === ref.rawPackageIndex && entry.index === ref.index)
      if (classes.length !== 1) {
        refs.push(observe(raw, '/package/imports'))
        unavailable('missing-or-ambiguous-class-import', 'class-import')
        continue
      }
      const cls = classes[0]!
      refs.push(observe(raw, `/package/imports/${cls.index}`))
      if (cls.entry.rawPackageIndex !== -(cls.index + 1) || cls.entry.rawPackageIndex !== ref.rawPackageIndex
        || cls.entry.index !== ref.index || !validRawName(cls.entry.classPackage) || !validRawName(cls.entry.className)
        || !validRawName(cls.entry.objectName) || cls.entry.objectName.value !== ref.objectName
        || cls.entry.className.value !== ref.className || cls.entry.outerReference.rawPackageIndex !== cls.entry.outerIndex) {
        unavailable('class-import-inconsistent', 'class-import')
        continue
      }
      const outers = raw.package.imports.map((entry, index) => ({ entry, index }))
        .filter(({ entry }) => entry.rawPackageIndex === cls.entry.outerIndex)
      if (outers.length !== 1) {
        refs.push(observe(raw, '/package/imports'))
        unavailable('missing-or-ambiguous-outer-package', 'outer-package')
        continue
      }
      const outer = outers[0]!
      refs.push(observe(raw, `/package/imports/${outer.index}`))
      if (cls.entry.outerReference.kind !== 'import' || cls.entry.outerReference.index !== outer.entry.index
        || cls.entry.outerReference.objectName !== outer.entry.objectName.value
        || cls.entry.outerReference.className !== outer.entry.className.value
        || outer.entry.rawPackageIndex !== -(outer.index + 1) || outer.entry.index !== outer.index
        || !validRawName(outer.entry.classPackage) || !validRawName(outer.entry.className)
        || !validRawName(outer.entry.objectName) || outer.entry.className.value !== 'Package'
        || outer.entry.outerIndex !== 0 || outer.entry.outerReference.kind !== 'null'
        || outer.entry.outerReference.rawPackageIndex !== 0 || !outer.entry.objectName.value.startsWith('/Game/')) {
        unavailable('outer-package-inconsistent', 'outer-package')
        continue
      }

      const target = { objectName: ref.objectName, gamePackagePath: outer.entry.objectName.value }
      let targetRawVerification: TargetRawVerification
      if (!input.target) {
        targetRawVerification = { input: 'not-supplied', result: 'not-resolved', reason: 'target-snapshot-not-supplied' }
      } else {
        const targetEvidenceRef = observe(input.target)
        const targetRaw = input.target
        const matched = targetRaw.schemaVersion === 2
          && target.gamePackagePath === definition.targetGamePath
          && targetRaw.logicalPackage.path === definition.targetRawPath
          && targetRaw.dataset.id === raw.dataset.id
          && targetRaw.dataset.sourceFingerprint.algorithm === raw.dataset.sourceFingerprint.algorithm
          && targetRaw.dataset.sourceFingerprint.value === raw.dataset.sourceFingerprint.value
        targetRawVerification = matched
          ? { input: 'supplied', targetEvidenceRef, result: 'resolved' }
          : { input: 'supplied', targetEvidenceRef, result: 'not-resolved', reason: 'target-snapshot-mismatch' }
      }
      relations.push({
        projectionRef,
        relationRef: definition.relationRef,
        occurrence,
        sourceDomainId,
        target,
        evidenceRefs: refs,
      })
      records.push({
        projectionRef,
        relationRef: definition.relationRef,
        occurrence,
        evidenceRefs: refs,
        result: 'projected',
        serializedTargetResolution: serializedTargetResolutionFor(target, inputs.structuralPackagePaths),
        targetRawVerification,
      })
    }
  }

  const horizontalCollections = new Map<string, { domainId: string; collectionRef: string; evidenceRef: string; sourceIndices: number[] }>()
  for (const input of inputs.horizontalRelations ?? []) {
    const { occurrence } = input
    if (input.sourceDomainId !== occurrence.domainId) {
      throw new Error(`Invalid horizontal Relation occurrence: ${input.relationRef}`)
    }
    if ('sourceIndex' in occurrence) {
      if (!Number.isInteger(occurrence.sourceIndex) || occurrence.sourceIndex < 0) {
        throw new Error(`Invalid horizontal Relation occurrence: ${input.relationRef}`)
      }
    } else if (occurrence.scopeRef !== 'source') {
      throw new Error(`Invalid horizontal scope Relation occurrence: ${input.relationRef}`)
    }
    const projectionRef = relationProjectionRef(input.relationRef, occurrence)
    if (records.some((record) => record.projectionRef === projectionRef)) {
      throw new Error(`Duplicate Relation projectionRef: ${projectionRef}`)
    }
    const evidenceRef = observeHorizontal(input)
    const evidenceRefs = [evidenceRef]
    relations.push({ projectionRef, relationRef: input.relationRef, occurrence, sourceDomainId: input.sourceDomainId,
      target: input.target, evidenceRefs })
    records.push({ projectionRef, relationRef: input.relationRef, occurrence, evidenceRefs, result: 'projected',
      serializedTargetResolution: input.serializedTargetResolution,
      targetRawVerification: { input: 'not-supplied', result: 'not-resolved', reason: 'target-snapshot-not-supplied' } })
    if ('sourceIndex' in occurrence) {
      const key = `${occurrence.domainId}\0${occurrence.collectionRef}`
      const collection = horizontalCollections.get(key)
      if (collection) collection.sourceIndices.push(occurrence.sourceIndex)
      else horizontalCollections.set(key, { domainId: occurrence.domainId, collectionRef: occurrence.collectionRef,
        evidenceRef, sourceIndices: [occurrence.sourceIndex] })
    }
  }
  relationCollections.push(...[...horizontalCollections.values()].map((collection) => ({ ...collection, result: 'projected' as const })))

  return {
    schemaVersion: 2,
    artifactKind: 'formal-domain-serialized-relation',
    semantic: { relations },
    relationCollections,
    relationProjections: records,
    provenance: { evidence: [...evidence.values()] },
  }
}

export function collectFormalSerializedRelationErrors(
  artifact: FormalSerializedRelationArtifact,
  inputs: FormalRelationInputs,
): string[] {
  const errors: string[] = []
  const expected = buildFormalSerializedRelationArtifact(inputs)
  if (artifact.schemaVersion !== 2 || artifact.artifactKind !== expected.artifactKind) errors.push('invalid artifact header')
  const required = expected.relationProjections.map((record) => record.projectionRef).sort()
  const actual = artifact.relationProjections.map((record) => record.projectionRef).sort()
  if (!same(required, actual)) errors.push('required relation occurrence coverage mismatch')
  if (!same(artifact.relationCollections, expected.relationCollections)) errors.push('Relation collection mismatch')
  if (new Set(actual).size !== actual.length) errors.push('duplicate occurrence')
  const occurrenceKeys = artifact.semantic.relations.map((relation) =>
    `${relation.relationRef}\0${JSON.stringify(relation.occurrence)}`)
  if (new Set(occurrenceKeys).size !== occurrenceKeys.length) errors.push('duplicate RelationRef + occurrence')

  const evidence = new Map<string, RelationEvidenceRecord>()
  for (const record of artifact.provenance.evidence) {
    if (evidence.has(record.id)) errors.push(`duplicate EvidenceRef ${record.id}`)
    evidence.set(record.id, record)
    const { fingerprint, ...base } = record
    if (fingerprint !== evidenceFingerprint(base)) errors.push(`fingerprint mismatch ${record.id}`)
    if (!same(record, expected.provenance.evidence.find((item) => item.id === record.id))) {
      errors.push(`Raw evidence mismatch ${record.id}`)
    }
  }

  for (const collection of artifact.relationCollections) {
    if (!evidence.has(collection.evidenceRef)) errors.push(`dangling collection EvidenceRef ${collection.domainId}:${collection.collectionRef}`)
    if (collection.result === 'projected'
      && (collection.sourceIndices.some((index) => !Number.isInteger(index) || index < 0)
        || new Set(collection.sourceIndices).size !== collection.sourceIndices.length)) {
      errors.push(`invalid relation collection sourceIndex ${collection.domainId}:${collection.collectionRef}`)
    }
  }

  for (const record of artifact.relationProjections) {
    if (!record.evidenceRefs.length || record.evidenceRefs.some((ref) => !evidence.has(ref))) {
      errors.push(`dangling EvidenceRef ${record.projectionRef}`)
    }
    const semanticMatches = artifact.semantic.relations.filter((relation) => relation.projectionRef === record.projectionRef)
    if (semanticMatches.length !== (record.result === 'projected' ? 1 : 0)) {
      errors.push(`semantic relation count mismatch ${record.projectionRef}`)
    }
    if (semanticMatches[0]?.sourceDomainId !== semanticMatches[0]?.occurrence.domainId) {
      errors.push(`sourceDomainId mismatch ${record.projectionRef}`)
    }
    if (record.result === 'projected') {
      const serializedResolution = (record as { serializedTargetResolution?: unknown }).serializedTargetResolution
      if (!serializedResolution || typeof serializedResolution !== 'object' || Array.isArray(serializedResolution)) {
        errors.push(`invalid serialized target resolution ${record.projectionRef}`)
      } else {
        const resolution = serializedResolution as SerializedTargetResolution
        if (resolution.state === 'resolved-local-package' && !resolution.structuralPackagePath) {
          errors.push(`invalid serialized target resolution ${record.projectionRef}`)
        }
      }
      const rawVerification = (record as { targetRawVerification?: unknown }).targetRawVerification
      if (!rawVerification || typeof rawVerification !== 'object' || Array.isArray(rawVerification)) {
        errors.push(`invalid target Raw verification ${record.projectionRef}`)
      } else {
        const verification = rawVerification as TargetRawVerification
        if ('targetEvidenceRef' in verification && !evidence.has(verification.targetEvidenceRef)) {
          errors.push(`dangling target EvidenceRef ${record.projectionRef}`)
        }
      }
    }
    if (!same(record, expected.relationProjections.find((item) => item.projectionRef === record.projectionRef))) {
      errors.push(`relation projection mismatch ${record.projectionRef}`)
    }
  }

  if (!same(artifact.semantic.relations, expected.semantic.relations)) errors.push('semantic relation mismatch')
  if (!same(artifact.provenance.evidence, expected.provenance.evidence)) errors.push('relation evidence mismatch')
  return errors
}

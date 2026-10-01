import fs from 'node:fs'
import path from 'node:path'
import { type HorizontalRawFactInventory, type JsonRecord } from './game-data-horizontal-fact-inventory.ts'
import { hasVerifiedStructuralPackage, readVerifiedStructuralShard, RAW_STRUCTURAL_INVENTORY_DIRECTORY } from './formal-value-source-provenance.ts'
import { matchedIdentityDomainId, matchedIdentityDomainIdFromSource, sameLogicalRawPackage, snapshotSource } from '../src/domain/formal/boundarySource.ts'
import { formalIdentityDefinitions } from '../src/domain/formal/identityDefinitions.ts'
import type { RawPackageSnapshot } from './game-data-raw-package.ts'
import type { FormalIdentityDefinition, FormalSemanticIdentity, RawObservationEvidenceRecord } from '../src/domain/formal/identityEvidence.ts'
import type { RawTrace } from '../src/domain/formal/rawProjection.ts'
import {
  horizontalRelationDefinition,
  relationRefForDomain,
  serializedTargetResolutionFromStructuralEdge,
  type CollectionRelationOccurrence,
  type ScopeRelationOccurrence,
  type RelationRef,
  type SerializedTarget,
  type SerializedTargetResolution,
} from '../src/domain/formal/serializedRelation.ts'

type HorizontalRelationReference = {
  edgeId: string
  sourcePackage: string
  sourceRelationPathId: string
}

type HorizontalRelationSource = {
  edgeId: string
  relationKind: string
  sourcePackage: string
  sourceObject: string | null
  propertyPath: string | null
  arrayIndex: number | null
  sourceOccurrenceKind: string
  sourceRange: unknown
  targetObject: string | null
  targetPackageName: string | null
  targetPackage: string | null
  targetRawPackageIndex: number
  targetKind: string
  traversalStopReason: string
  targetState: string
}

type HorizontalCandidate = JsonRecord & {
  packagePath: string
  candidatePackageProvenance: {
    sourceShardPath: string
    sourceShardUncompressedSha256: string
    packageHash: string
  }
  relations: HorizontalRelationReference[]
}

type HorizontalItem = JsonRecord & {
  category: string
  catalogId: string
  rawCandidate: { candidates: HorizontalCandidate[] }
}

type InventoryView = Omit<HorizontalRawFactInventory, 'items'> & {
  inventoryIdentity: { datasetId: string }
  sourceRelations: HorizontalRelationSource[]
  items: HorizontalItem[]
}

export type HorizontalRelationSourceRequest = {
  category: 'melee' | 'ranged'
  catalogId: string
  candidatePackage: string
  edgeId: string
  sourceIndex: number
  definition: FormalIdentityDefinition
  identity: FormalSemanticIdentity
  identityEvidence: RawObservationEvidenceRecord[]
  identitySource?: RawPackageSnapshot
}

export type ResolvedHorizontalRelationSource = {
  sourceDomainId: string
  relationRef: RelationRef
  occurrence: CollectionRelationOccurrence
  edgeId: string
  source: RawTrace
  target: SerializedTarget
  serializedTargetResolution: SerializedTargetResolution
  structuralEdge: JsonRecord
}

type ScopeRelationPolicy =
  | { category: 'armor'; relationKind: 'gear-actor'; propertyPath: 'GearActor' }
  | { category: 'artifact'; relationKind: 'effect'; propertyPath: 'Effect' }
  | { category: 'artifact'; relationKind: 'item-actor'; propertyPath: 'ItemActorClass' }
  | { category: 'artifact'; relationKind: 'spin-wheel-actor'; propertyPath: 'SpinWheelActorClass' }
  | { category: 'artifact'; relationKind: 'fish-hook'; propertyPath: 'FishingHookActorClass' }

export type ScopeRelationSourceRequest = ScopeRelationPolicy & {
  catalogId: string
  candidatePackage: string
  edgeId: string
  definition: FormalIdentityDefinition
  identity: FormalSemanticIdentity
  identityEvidence: RawObservationEvidenceRecord[]
  identitySource?: RawPackageSnapshot
}

export type ArmorScopeRelationSourceRequest = ScopeRelationSourceRequest & { relationKind: 'gear-actor' }
export type ArtifactEffectRelationSourceRequest = ScopeRelationSourceRequest & { relationKind: 'effect' }
export type ArtifactItemActorRelationSourceRequest = ScopeRelationSourceRequest & { relationKind: 'item-actor' }
export type FishHookRelationSourceRequest = ScopeRelationSourceRequest & { relationKind: 'fish-hook' }
export type SpinWheelActorRelationSourceRequest = ScopeRelationSourceRequest & { relationKind: 'spin-wheel-actor' }

export type ResolvedScopeRelationSource = {
  sourceDomainId: string
  relationRef: RelationRef
  occurrence: ScopeRelationOccurrence
  edgeId: string
  source: RawTrace
  target: SerializedTarget
  serializedTargetResolution: SerializedTargetResolution
  structuralEdge: JsonRecord
}

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const requiredString = (value: unknown, label: string): string => {
  if (typeof value !== 'string' || value.length === 0) throw new Error(`${label} is missing`)
  return value
}

const canonicalJson = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (isRecord(value)) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`
  }
  return JSON.stringify(value) ?? 'undefined'
}

function exactItem(inventory: InventoryView, request: { category: string; catalogId: string }): HorizontalItem {
  const matches = inventory.items.filter((item) => item.category === request.category && item.catalogId === request.catalogId)
  if (matches.length !== 1) {
    throw new Error(`Horizontal relation catalog item does not resolve exactly once: ${request.category}:${request.catalogId}`)
  }
  return matches[0]!
}

function exactCandidate(item: HorizontalItem, request: { candidatePackage: string }): HorizontalCandidate {
  const matches = item.rawCandidate.candidates.filter((candidate) => candidate.packagePath === request.candidatePackage)
  if (matches.length !== 1) {
    throw new Error(`Horizontal relation candidate package does not resolve exactly once: ${request.candidatePackage}`)
  }
  return matches[0]!
}

function exactCandidateReference(candidate: HorizontalCandidate, edgeId: string): HorizontalRelationReference {
  const matches = candidate.relations.filter((relation) => relation.edgeId === edgeId)
  if (matches.length !== 1) {
    throw new Error(`Horizontal candidate relation edgeId does not resolve exactly once: ${edgeId}`)
  }
  return matches[0]!
}

function exactSourceRelation(inventory: InventoryView, edgeId: string): HorizontalRelationSource {
  const matches = inventory.sourceRelations.filter((relation) => relation.edgeId === edgeId)
  if (matches.length !== 1) {
    throw new Error(`Horizontal source relation edgeId does not resolve exactly once: ${edgeId}`)
  }
  return matches[0]!
}

function serializedTargetResolution(
  repositoryRoot: string,
  edge: JsonRecord,
  expectedDatasetId: string,
): SerializedTargetResolution {
  const targetPackage = typeof edge.targetPackage === 'string' && edge.targetPackage.length > 0
    ? edge.targetPackage
    : undefined
  const verifiedTargetPaths = new Set<string>()
  if (targetPackage && hasVerifiedStructuralPackage(repositoryRoot, targetPackage, expectedDatasetId)) {
    verifiedTargetPaths.add(targetPackage)
  }
  return serializedTargetResolutionFromStructuralEdge(edge, verifiedTargetPaths)
}

export function ownsHorizontalRelationCollectionChild(
  relation: { propertyPath: string | null; arrayIndex: number | null },
  parentRawField: string,
  childRawField: string,
  sourceIndex: number,
): boolean {
  const propertyPath = relation.propertyPath
  const exactPath = `${parentRawField}[${sourceIndex}].${childRawField}`
  return relation.arrayIndex === sourceIndex
    && typeof propertyPath === 'string'
    && (propertyPath === exactPath || propertyPath.endsWith(`.${exactPath}`))
}

function structuralRelationSummary(
  edge: JsonRecord,
  repositoryRoot: string,
  expectedDatasetId: string,
): HorizontalRelationSource {
  const sourceOccurrence = isRecord(edge.sourceOccurrence) ? edge.sourceOccurrence : {}
  const traversal = isRecord(edge.traversal) ? edge.traversal : {}
  return {
    edgeId: requiredString(edge.id, 'Structural edge id'),
    relationKind: requiredString(edge.kind, 'Structural edge kind'),
    sourcePackage: requiredString(edge.sourcePackage, 'Structural edge sourcePackage'),
    sourceObject: typeof sourceOccurrence.sourceObject === 'string' ? sourceOccurrence.sourceObject : null,
    propertyPath: typeof sourceOccurrence.propertyPath === 'string' ? sourceOccurrence.propertyPath
      : typeof sourceOccurrence.serializedField === 'string' ? sourceOccurrence.serializedField : null,
    arrayIndex: typeof sourceOccurrence.arrayIndex === 'number' ? sourceOccurrence.arrayIndex : null,
    sourceOccurrenceKind: requiredString(sourceOccurrence.kind, 'Structural source occurrence kind'),
    sourceRange: sourceOccurrence.sourceRange ?? null,
    targetObject: typeof edge.targetObject === 'string' ? edge.targetObject : null,
    targetPackageName: typeof edge.targetPackageName === 'string' ? edge.targetPackageName : null,
    targetPackage: typeof edge.targetPackage === 'string' ? edge.targetPackage : null,
    targetRawPackageIndex: Number(edge.targetRawPackageIndex),
    targetKind: requiredString(edge.targetKind, 'Structural target kind'),
    traversalStopReason: requiredString(traversal.stopReason, 'Structural traversal stop reason'),
    targetState: serializedTargetResolution(repositoryRoot, edge, expectedDatasetId).state,
  }
}

function requireFirstWaveTarget(
  sourceRelation: HorizontalRelationSource,
  serializedTargetResolution: SerializedTargetResolution,
): {
  target: SerializedTarget
  serializedTargetResolution: SerializedTargetResolution
} {
  if (sourceRelation.targetKind !== 'import'
    || serializedTargetResolution.state !== 'resolved-local-package'
    || !sourceRelation.targetObject
    || !sourceRelation.targetPackageName
    || !sourceRelation.targetPackage) {
    throw new Error(`Horizontal first-wave relation target is not a resolved local import: ${sourceRelation.edgeId}`)
  }
  const objectPrefix = `${sourceRelation.targetPackageName}.`
  if (!sourceRelation.targetObject.startsWith(objectPrefix)
    || sourceRelation.targetObject.length === objectPrefix.length) {
    throw new Error(`Horizontal first-wave target object is not owned by its package: ${sourceRelation.edgeId}`)
  }
  return {
    target: {
      objectName: sourceRelation.targetObject.slice(objectPrefix.length),
      gamePackagePath: sourceRelation.targetPackageName,
    },
    serializedTargetResolution,
  }
}

/** Resolve the exact committed target package without inferring it from a domain or class name. */
function targetStructuralPackage(repositoryRoot: string, targetPath: string, datasetId: string): {
  pkg: JsonRecord
  edges: JsonRecord[]
} {
  const manifest = JSON.parse(fs.readFileSync(path.join(repositoryRoot,
    RAW_STRUCTURAL_INVENTORY_DIRECTORY, 'manifest.json'), 'utf8')) as { shards: { path: string }[] }
  // Package paths are sorted across shards. Every visited shard is hash verified.
  let low = 0
  let high = manifest.shards.length - 1
  while (low <= high) {
    const middle = Math.floor((low + high) / 2)
    const meta = manifest.shards[middle]!
    const { shard } = readVerifiedStructuralShard(repositoryRoot,
      `${RAW_STRUCTURAL_INVENTORY_DIRECTORY}/${meta.path}`, datasetId)
    const first = shard.packages[0]?.path
    const last = shard.packages[shard.packages.length - 1]?.path
    if (!first || !last) throw new Error('ItemActor target Structural shard is empty')
    if (targetPath.localeCompare(first) < 0) { high = middle - 1; continue }
    if (targetPath.localeCompare(last) > 0) { low = middle + 1; continue }
    const matches = shard.packages.filter((pkg) => pkg.path === targetPath)
    if (matches.length > 1) throw new Error(`ItemActor target package duplicated: ${targetPath}`)
    if (matches.length === 1) return { pkg: matches[0] as unknown as JsonRecord,
      edges: shard.edges.filter((edge) => edge.sourcePackage === targetPath) as unknown as JsonRecord[] }
    break
  }
  throw new Error(`ItemActor target package missing: ${targetPath}`)
}

export const FISH_HOOK_POLICY = {
  domainId: 'fishing-rod',
  sourcePackage: 'Dungeons/Content/Actors/Items/FishingRod/BP_FishingRodInstance',
  edgeId: '61c85456ce1c89009060695d',
  targetPackage: 'Dungeons/Content/Actors/Items/FishingRod/BP_FishHookItem',
  targetObject: '/Game/Actors/Items/FishingRod/BP_FishHookItem.BP_FishHookItem_C',
} as const

/** Bind the serialized target object to its class export, direct super edge and class-owned CDO. */
export function verifyFishHookTargetStructural(
  targetObject: string, targetPackage: JsonRecord, targetEdges: readonly JsonRecord[],
): void {
  const nativeClass = 'FishHookItem'
  const className = 'BP_FishHookItem_C'
  const exactPackage = FISH_HOOK_POLICY.targetPackage
  const exactGamePackage = `/Game/Actors/Items/FishingRod/${className.slice(0, -2)}`
  if (targetPackage.path !== exactPackage || targetPackage.gamePackageName !== exactGamePackage
    || targetObject !== `${exactGamePackage}.${className}`) throw new Error('FishHook exact class/package mismatch')
  const packagePath = requiredString(targetPackage.path, 'FishHook target package path')
  const gamePackageName = requiredString(targetPackage.gamePackageName, 'FishHook target game package')
  if (!targetObject.startsWith(`${gamePackageName}.`)) throw new Error('FishHook target object/package mismatch')
  const exports = targetPackage.exports as JsonRecord[] | undefined
  const chains = targetPackage.inheritanceChains as JsonRecord[] | undefined
  if (!Array.isArray(exports) || !Array.isArray(chains)) throw new Error('FishHook target package has no Structural class data')
  const classes = exports.filter((entry) => isRecord(entry.objectName)
    && entry.objectName.value === className && entry.isClassDefaultObject === false)
  if (classes.length !== 1) throw new Error('FishHook exact target class missing or duplicated')
  const cls = classes[0]!
  const refs = cls.references as JsonRecord | undefined
  if (!isRecord(refs?.class) || refs.class.kind !== 'import'
    || refs.class.objectName !== 'BlueprintGeneratedClass' || refs.class.className !== 'Class'
    || !Number.isInteger(cls.rawPackageIndex) || Number(cls.rawPackageIndex) <= 0
    || cls.rawPackageIndex !== Number(cls.exportIndex) + 1) throw new Error('FishHook generated class kind/index mismatch')
  const superRef = refs?.super as JsonRecord | undefined
  if (superRef?.kind !== 'import' || superRef.className !== 'Class' || superRef.objectName !== nativeClass
    || !Number.isInteger(superRef.rawPackageIndex) || Number(superRef.rawPackageIndex) >= 0
    || superRef.index !== -Number(superRef.rawPackageIndex) - 1) {
    throw new Error('FishHook target class direct superclass mismatch')
  }
  const directSupers = targetEdges.filter((edge) => edge.kind === 'super'
    && edge.sourcePackage === packagePath && isRecord(edge.sourceOccurrence)
    && edge.sourceOccurrence.sourceObject === className
    && edge.sourceOccurrence.serializedField === 'superIndex')
  if (directSupers.length !== 1) throw new Error('FishHook target class super edge missing or duplicated')
  const directSuper = directSupers[0]!
  if (directSuper.targetObject !== `/Script/Dungeons.${nativeClass}`
    || directSuper.targetKind !== 'import' || directSuper.targetPackageName !== '/Script/Dungeons'
    || directSuper.targetRawPackageIndex !== superRef.rawPackageIndex
    || !isRecord(directSuper.traversal) || directSuper.traversal.stopReason !== 'native-boundary'
    || !isRecord(directSuper.sourceOccurrence)
    || directSuper.sourceOccurrence.rawPackageIndex !== superRef.rawPackageIndex) {
    throw new Error('FishHook target class super edge semantic mismatch')
  }
  const matchingChains = chains.filter((chain) => chain.sourceObject === className)
  const chain = matchingChains[0]
  if (matchingChains.length !== 1 || !chain || !Array.isArray(chain.hops)
    || chain.hops.length !== 1 || !isRecord(chain.hops[0])
    || chain.hops[0].edgeId !== directSuper.id
    || chain.hops[0].targetObject !== `/Script/Dungeons.${nativeClass}`
    || chain.hops[0].rawPackageIndex !== superRef.rawPackageIndex
    || chain.hops[0].targetPackageName !== '/Script/Dungeons'
    || chain.stopReason !== 'native-boundary') {
    throw new Error('FishHook target class inheritance chain mismatch')
  }
  const cdos = exports.filter((entry) => entry.isClassDefaultObject === true
    && isRecord(entry.references) && isRecord(entry.references.class)
    && entry.references.class.kind === 'export'
    && entry.references.class.rawPackageIndex === cls.rawPackageIndex)
  const namedCdos = exports.filter((entry) => isRecord(entry.objectName) && entry.objectName.value === `Default__${className}`)
  if (namedCdos.length !== 1 || namedCdos[0] !== cdos[0]
    || !isRecord(cdos[0]?.references) || !isRecord(cdos[0].references.class)
    || cdos[0].references.class.objectName !== className
    || cdos[0].references.class.className !== 'BlueprintGeneratedClass'
    || cdos[0].references.class.index !== cls.exportIndex
    || cdos.length !== 1 || !isRecord(cdos[0]!.references)
    || !isRecord(cdos[0]!.references.template)
    || cdos[0]!.references.template.className !== nativeClass
    || cdos[0]!.references.template.kind !== 'import'
    || cdos[0]!.references.template.objectName !== `Default__${nativeClass}`
    || !Number.isInteger(cdos[0]!.rawPackageIndex)
    || cdos[0]!.rawPackageIndex !== Number(cdos[0]!.exportIndex) + 1
    || Number(cdos[0]!.rawPackageIndex) <= 0
    || !Number.isInteger(cdos[0]!.references.template.rawPackageIndex)
    || Number(cdos[0]!.references.template.rawPackageIndex) >= 0
    || cdos[0]!.references.template.index !== -Number(cdos[0]!.references.template.rawPackageIndex) - 1) {
    throw new Error('FishHook target class CDO missing or mismatched')
  }
  const cdoRefs = cdos[0]!.references as JsonRecord
  for (const [kind, field, reference, expectedObject, expectedKind] of [
    ['class', 'classIndex', cdoRefs.class, targetObject, 'export'],
    ['template', 'templateIndex', cdoRefs.template, `/Script/Dungeons.Default__${nativeClass}`, 'import'],
  ] as const) {
    const ref = reference as JsonRecord
    const edges = targetEdges.filter((edge) => edge.kind === kind && edge.sourcePackage === packagePath
      && isRecord(edge.sourceOccurrence) && edge.sourceOccurrence.sourceObject === `Default__${className}`
      && edge.sourceOccurrence.serializedField === field)
    if (edges.length !== 1 || edges[0]!.targetObject !== expectedObject || edges[0]!.targetKind !== expectedKind
      || edges[0]!.targetRawPackageIndex !== ref.rawPackageIndex
      || (edges[0]!.sourceOccurrence as JsonRecord).rawPackageIndex !== ref.rawPackageIndex) {
      throw new Error(`FishHook CDO ${kind} edge binding mismatch`)
    }
  }
}

/** Bind the serialized target object to its class export, direct super edge and class-owned CDO. */
export function verifyItemActorTargetStructural(
  targetObject: string, targetPackage: JsonRecord, targetEdges: readonly JsonRecord[],
): void {
  const packagePath = requiredString(targetPackage.path, 'ItemActor target package path')
  const gamePackageName = requiredString(targetPackage.gamePackageName, 'ItemActor target game package')
  if (!targetObject.startsWith(`${gamePackageName}.`)) throw new Error('ItemActor target object/package mismatch')
  const className = targetObject.slice(gamePackageName.length + 1)
  const exports = targetPackage.exports as JsonRecord[] | undefined
  const chains = targetPackage.inheritanceChains as JsonRecord[] | undefined
  if (!Array.isArray(exports) || !Array.isArray(chains)) throw new Error('ItemActor target package has no Structural class data')
  const classes = exports.filter((entry) => isRecord(entry.objectName)
    && entry.objectName.value === className && entry.isClassDefaultObject === false)
  if (classes.length !== 1) throw new Error('ItemActor exact target class missing or duplicated')
  const cls = classes[0]!
  const refs = cls.references as JsonRecord | undefined
  const superRef = refs?.super as JsonRecord | undefined
  if (superRef?.kind !== 'import' || superRef.objectName !== 'ItemActor') {
    throw new Error('ItemActor target class direct superclass mismatch')
  }
  const directSupers = targetEdges.filter((edge) => edge.kind === 'super'
    && edge.sourcePackage === packagePath && isRecord(edge.sourceOccurrence)
    && edge.sourceOccurrence.sourceObject === className
    && edge.sourceOccurrence.serializedField === 'superIndex')
  if (directSupers.length !== 1) throw new Error('ItemActor target class super edge missing or duplicated')
  const directSuper = directSupers[0]!
  if (directSuper.targetObject !== '/Script/Dungeons.ItemActor'
    || directSuper.targetKind !== 'import'
    || !isRecord(directSuper.traversal) || directSuper.traversal.stopReason !== 'native-boundary'
    || !isRecord(directSuper.sourceOccurrence)
    || directSuper.sourceOccurrence.rawPackageIndex !== superRef.rawPackageIndex) {
    throw new Error('ItemActor target class super edge semantic mismatch')
  }
  const matchingChains = chains.filter((chain) => chain.sourceObject === className)
  const chain = matchingChains[0]
  if (matchingChains.length !== 1 || !chain || !Array.isArray(chain.hops)
    || chain.hops.length !== 1 || !isRecord(chain.hops[0])
    || chain.hops[0].edgeId !== directSuper.id
    || chain.hops[0].targetObject !== '/Script/Dungeons.ItemActor'
    || chain.stopReason !== 'native-boundary') {
    throw new Error('ItemActor target class inheritance chain mismatch')
  }
  const cdos = exports.filter((entry) => entry.isClassDefaultObject === true
    && isRecord(entry.references) && isRecord(entry.references.class)
    && entry.references.class.kind === 'export'
    && entry.references.class.rawPackageIndex === cls.rawPackageIndex)
  if (cdos.length !== 1 || !isRecord(cdos[0]!.references)
    || !isRecord(cdos[0]!.references.template)
    || cdos[0]!.references.template.kind !== 'import'
    || cdos[0]!.references.template.objectName !== 'Default__ItemActor') {
    throw new Error('ItemActor target class CDO missing or mismatched')
  }
}

export const SPIN_WHEEL_ACTOR_POLICY = {
  domainId: 'spinblade',
  sourcePackage: 'Dungeons/Content/Content_DLC4/Actors/Items/SpinWheel/BP_SpinWheelInstance',
  edgeId: '2cd31aaf1c49b33bd4dca244',
  targetPackage: 'Dungeons/Content/Content_DLC4/Actors/Items/SpinWheel/BP_SpinWheelActor',
  targetObject: '/Game/Content_DLC4/Actors/Items/SpinWheel/BP_SpinWheelActor.BP_SpinWheelActor_C',
} as const

/** Bind the serialized target object to its class export, direct super edge and class-owned CDO. */
function verifySpinWheelClassStructural(
  targetObject: string, targetPackage: JsonRecord, targetEdges: readonly JsonRecord[], role: 'actor' | 'instance',
): void {
  const nativeClass = role === 'actor' ? 'SpinWheelActor' : 'SpinWheelInstance'
  const className = role === 'actor' ? 'BP_SpinWheelActor_C' : 'BP_SpinWheelInstance_C'
  const exactPackage = role === 'actor' ? SPIN_WHEEL_ACTOR_POLICY.targetPackage : SPIN_WHEEL_ACTOR_POLICY.sourcePackage
  const exactGamePackage = `/Game/Content_DLC4/Actors/Items/SpinWheel/${className.slice(0, -2)}`
  if (targetPackage.path !== exactPackage || targetPackage.gamePackageName !== exactGamePackage
    || targetObject !== `${exactGamePackage}.${className}`) throw new Error('SpinWheel exact class/package mismatch')
  const packagePath = requiredString(targetPackage.path, 'SpinWheel target package path')
  const gamePackageName = requiredString(targetPackage.gamePackageName, 'SpinWheel target game package')
  if (!targetObject.startsWith(`${gamePackageName}.`)) throw new Error('SpinWheel target object/package mismatch')
  const exports = targetPackage.exports as JsonRecord[] | undefined
  const chains = targetPackage.inheritanceChains as JsonRecord[] | undefined
  if (!Array.isArray(exports) || !Array.isArray(chains)) throw new Error('SpinWheel target package has no Structural class data')
  const classes = exports.filter((entry) => isRecord(entry.objectName)
    && entry.objectName.value === className && entry.isClassDefaultObject === false)
  if (classes.length !== 1) throw new Error('SpinWheel exact target class missing or duplicated')
  const cls = classes[0]!
  const refs = cls.references as JsonRecord | undefined
  if (!isRecord(refs?.class) || refs.class.kind !== 'import'
    || refs.class.objectName !== 'BlueprintGeneratedClass' || refs.class.className !== 'Class'
    || !Number.isInteger(cls.rawPackageIndex) || Number(cls.rawPackageIndex) <= 0
    || cls.rawPackageIndex !== Number(cls.exportIndex) + 1) throw new Error('SpinWheel generated class kind/index mismatch')
  const superRef = refs?.super as JsonRecord | undefined
  if (superRef?.kind !== 'import' || superRef.className !== 'Class' || superRef.objectName !== nativeClass) {
    throw new Error('SpinWheel target class direct superclass mismatch')
  }
  const directSupers = targetEdges.filter((edge) => edge.kind === 'super'
    && edge.sourcePackage === packagePath && isRecord(edge.sourceOccurrence)
    && edge.sourceOccurrence.sourceObject === className
    && edge.sourceOccurrence.serializedField === 'superIndex')
  if (directSupers.length !== 1) throw new Error('SpinWheel target class super edge missing or duplicated')
  const directSuper = directSupers[0]!
  if (directSuper.targetObject !== `/Script/Dungeons.${nativeClass}`
    || directSuper.targetKind !== 'import'
    || !isRecord(directSuper.traversal) || directSuper.traversal.stopReason !== 'native-boundary'
    || !isRecord(directSuper.sourceOccurrence)
    || directSuper.sourceOccurrence.rawPackageIndex !== superRef.rawPackageIndex) {
    throw new Error('SpinWheel target class super edge semantic mismatch')
  }
  const matchingChains = chains.filter((chain) => chain.sourceObject === className)
  const chain = matchingChains[0]
  if (matchingChains.length !== 1 || !chain || !Array.isArray(chain.hops)
    || chain.hops.length !== 1 || !isRecord(chain.hops[0])
    || chain.hops[0].edgeId !== directSuper.id
    || chain.hops[0].targetObject !== `/Script/Dungeons.${nativeClass}`
    || chain.hops[0].rawPackageIndex !== superRef.rawPackageIndex
    || chain.hops[0].targetPackageName !== '/Script/Dungeons'
    || chain.stopReason !== 'native-boundary') {
    throw new Error('SpinWheel target class inheritance chain mismatch')
  }
  const cdos = exports.filter((entry) => entry.isClassDefaultObject === true
    && isRecord(entry.references) && isRecord(entry.references.class)
    && entry.references.class.kind === 'export'
    && entry.references.class.rawPackageIndex === cls.rawPackageIndex)
  const namedCdos = exports.filter((entry) => isRecord(entry.objectName) && entry.objectName.value === `Default__${className}`)
  if (namedCdos.length !== 1 || namedCdos[0] !== cdos[0]
    || !isRecord(cdos[0]?.references) || !isRecord(cdos[0].references.class)
    || cdos[0].references.class.objectName !== className
    || cdos[0].references.class.className !== 'BlueprintGeneratedClass'
    || cdos[0].references.class.index !== cls.exportIndex
    || cdos.length !== 1 || !isRecord(cdos[0]!.references)
    || !isRecord(cdos[0]!.references.template)
    || cdos[0]!.references.template.className !== nativeClass
    || cdos[0]!.references.template.kind !== 'import'
    || cdos[0]!.references.template.objectName !== `Default__${nativeClass}`) {
    throw new Error('SpinWheel target class CDO missing or mismatched')
  }
  const cdoRefs = cdos[0]!.references as JsonRecord
  for (const [kind, field, reference, expectedObject, expectedKind] of [
    ['class', 'classIndex', cdoRefs.class, targetObject, 'export'],
    ['template', 'templateIndex', cdoRefs.template, `/Script/Dungeons.Default__${nativeClass}`, 'import'],
  ] as const) {
    const ref = reference as JsonRecord
    const edges = targetEdges.filter((edge) => edge.kind === kind && edge.sourcePackage === packagePath
      && isRecord(edge.sourceOccurrence) && edge.sourceOccurrence.sourceObject === `Default__${className}`
      && edge.sourceOccurrence.serializedField === field)
    if (edges.length !== 1 || edges[0]!.targetObject !== expectedObject || edges[0]!.targetKind !== expectedKind
      || edges[0]!.targetRawPackageIndex !== ref.rawPackageIndex
      || (edges[0]!.sourceOccurrence as JsonRecord).rawPackageIndex !== ref.rawPackageIndex) {
      throw new Error(`SpinWheel CDO ${kind} edge binding mismatch`)
    }
  }
}

/** SpinWheel's configured actor role; independent of the ItemActor verifier. */
export function verifySpinWheelActorTargetStructural(
  targetObject: string, targetPackage: JsonRecord, targetEdges: readonly JsonRecord[],
): void {
  verifySpinWheelClassStructural(targetObject, targetPackage, targetEdges, 'actor')
}

/**
 * Resolves one first-wave Melee/Ranged relation from the Horizontal inventory back to its
 * exact committed Structural edge. Every join is exact and fail-closed; neither target
 * similarity nor array position may substitute for edgeId + sourceIndex ownership.
 */
export function resolveHorizontalRelationSource(
  repositoryRoot: string,
  inventoryInput: HorizontalRawFactInventory,
  request: HorizontalRelationSourceRequest,
): ResolvedHorizontalRelationSource {
  if (!Number.isInteger(request.sourceIndex) || request.sourceIndex < 0) {
    throw new Error('Horizontal relation sourceIndex is missing or invalid')
  }
  const inventory = inventoryInput as unknown as InventoryView
  const item = exactItem(inventory, request)
  const candidate = exactCandidate(item, request)
  const reference = exactCandidateReference(candidate, request.edgeId)
  const sourceRelation = exactSourceRelation(inventory, request.edgeId)
  const expected = horizontalRelationDefinition(request.definition.assertion.domainId, request.category)

  if (request.catalogId !== request.definition.assertion.domainId) {
    throw new Error('Horizontal relation catalog/domain binding mismatch')
  }
  if (request.candidatePackage !== request.definition.assertion.applicationScope.packagePath) {
    throw new Error('Horizontal relation candidate/Identity package binding mismatch')
  }
  if (reference.sourceRelationPathId !== 'rp-root') {
    throw new Error('Horizontal Relation first-wave source requires sourceRelationPathId=rp-root')
  }
  if (reference.sourcePackage !== request.candidatePackage
    || sourceRelation.sourcePackage !== request.candidatePackage
    || reference.sourcePackage !== sourceRelation.sourcePackage) {
    throw new Error('Horizontal Relation first-wave source requires candidatePackage == sourcePackage')
  }

  const childMatches = candidate.relations.map((candidateRelation) => {
    const matches = inventory.sourceRelations.filter((source) => source.edgeId === candidateRelation.edgeId)
    if (matches.length !== 1) return undefined
    return {
      reference: candidateRelation,
      source: matches[0]!,
    }
  }).filter((entry): entry is { reference: HorizontalRelationReference; source: HorizontalRelationSource } =>
    Boolean(entry
      && entry.reference.sourcePackage === request.candidatePackage
      && entry.reference.sourceRelationPathId === 'rp-root'
      && entry.source.sourcePackage === request.candidatePackage
      && ownsHorizontalRelationCollectionChild(entry.source, expected.parentRawField, expected.childRawField, request.sourceIndex)))

  if (childMatches.length !== 1) {
    throw new Error(`Horizontal relation occurrence does not resolve exactly once for sourceIndex ${request.sourceIndex}`)
  }
  if (childMatches[0]!.reference.edgeId !== request.edgeId) {
    throw new Error('Horizontal relation edgeId does not own the requested collection child')
  }
  if (!ownsHorizontalRelationCollectionChild(sourceRelation, expected.parentRawField, expected.childRawField, request.sourceIndex)) {
    throw new Error('Horizontal relation source occurrence binding mismatch')
  }

  const provenance = candidate.candidatePackageProvenance
  const datasetId = requiredString(inventory.inventoryIdentity?.datasetId, 'Horizontal relation datasetId')
  const sourceShardPath = requiredString(provenance?.sourceShardPath, 'Horizontal relation source shard path')
  const sourceShardUncompressedSha256 = requiredString(
    provenance?.sourceShardUncompressedSha256,
    'Horizontal relation source shard uncompressed hash',
  )
  const sourcePackageHash = requiredString(provenance?.packageHash, 'Horizontal relation source package hash')
  const { shard } = readVerifiedStructuralShard(
    repositoryRoot,
    sourceShardPath,
    datasetId,
    sourceShardUncompressedSha256,
  )

  const packageMatches = shard.packages.map((pkg, index) => ({ pkg, index }))
    .filter(({ pkg }) => pkg.path === request.candidatePackage)
  if (packageMatches.length !== 1) {
    throw new Error(`Structural relation source package does not resolve exactly once: ${request.candidatePackage}`)
  }
  const packageMatch = packageMatches[0]!
  if (!packageMatch.pkg.packageHash || packageMatch.pkg.packageHash.value !== sourcePackageHash) {
    throw new Error(`Structural relation source package hash mismatch: ${request.candidatePackage}`)
  }
  if (!packageMatch.pkg.parse.runId) {
    throw new Error(`Structural relation source package parse runId is missing: ${request.candidatePackage}`)
  }

  const edgeMatches = shard.edges.map((edge, index) => ({ edge: edge as unknown as JsonRecord, index }))
    .filter(({ edge }) => edge.id === request.edgeId)
  if (edgeMatches.length !== 1) {
    throw new Error(`Structural relation edgeId does not resolve exactly once: ${request.edgeId}`)
  }
  const edgeMatch = edgeMatches[0]!
  const structuralSummary = structuralRelationSummary(edgeMatch.edge, repositoryRoot, datasetId)
  if (canonicalJson(structuralSummary) !== canonicalJson(sourceRelation)) {
    throw new Error(`Horizontal source relation does not match its exact Structural edge: ${request.edgeId}`)
  }

  const source: RawTrace = {
    artifactPath: sourceShardPath,
    datasetId,
    extractionRunId: packageMatch.pkg.parse.runId,
    packagePath: request.candidatePackage,
    packageHash: packageMatch.pkg.packageHash,
    nodePointer: `/edges/${edgeMatch.index}`,
  }
  const matchedStructuralIdentity = matchedIdentityDomainIdFromSource(
    source,
    request.definition,
    request.identity,
    request.identityEvidence,
  )
  const direct = request.identitySource
  const sourceDomainId = matchedStructuralIdentity ?? (direct
    && matchedIdentityDomainId(direct, request.definition, request.identity, request.identityEvidence)
    && sameLogicalRawPackage(snapshotSource(direct), source)
    ? request.definition.assertion.domainId : undefined)
  if (sourceDomainId !== request.definition.assertion.domainId) {
    throw new Error(`${request.definition.assertion.id}: Horizontal Relation source failed the same-source Identity gate`)
  }

  const targetResolution = serializedTargetResolution(repositoryRoot, edgeMatch.edge, datasetId)
  const target = requireFirstWaveTarget(sourceRelation, targetResolution)
  return {
    sourceDomainId,
    relationRef: expected.relationRef,
    occurrence: {
      domainId: sourceDomainId,
      collectionRef: expected.collectionRef,
      sourceIndex: request.sourceIndex,
    },
    edgeId: request.edgeId,
    source,
    target: target.target,
    serializedTargetResolution: target.serializedTargetResolution,
    structuralEdge: edgeMatch.edge,
  }
}


/**
 * Resolves one policy-selected root scope relation from the Horizontal inventory back to its
 * exact committed Structural edge. The shared lane is deliberately scope-based: it never
 * synthesizes collection/sourceIndex semantics and it fails closed on duplicate or drifted roots.
 */
export function resolveHorizontalScopeRelationSource(
  repositoryRoot: string,
  inventoryInput: HorizontalRawFactInventory,
  request: ScopeRelationSourceRequest,
): ResolvedScopeRelationSource {
  const policy = request.category === 'armor' && request.relationKind === 'gear-actor' && request.propertyPath === 'GearActor'
    ? request : request.category === 'artifact' && request.relationKind === 'effect' && request.propertyPath === 'Effect'
      ? request : request.category === 'artifact' && request.relationKind === 'item-actor' && request.propertyPath === 'ItemActorClass'
        ? request : request.category === 'artifact' && request.relationKind === 'spin-wheel-actor' && request.propertyPath === 'SpinWheelActorClass'
          ? request : request.category === 'artifact' && request.relationKind === 'fish-hook' && request.propertyPath === 'FishingHookActorClass'
            ? request : undefined
  if (!policy) throw new Error('Unsupported Horizontal scope Relation policy')
  if (policy.relationKind === 'spin-wheel-actor' && (request.catalogId !== SPIN_WHEEL_ACTOR_POLICY.domainId
    || request.candidatePackage !== SPIN_WHEEL_ACTOR_POLICY.sourcePackage || request.edgeId !== SPIN_WHEEL_ACTOR_POLICY.edgeId)) {
    throw new Error('SpinWheel exact source policy mismatch')
  }
  if (policy.relationKind === 'fish-hook' && (request.catalogId !== FISH_HOOK_POLICY.domainId
    || request.candidatePackage !== FISH_HOOK_POLICY.sourcePackage || request.edgeId !== FISH_HOOK_POLICY.edgeId
    || canonicalJson(request.definition.assertion) !== canonicalJson(formalIdentityDefinitions.find(
      ({ assertion }) => assertion.domainId === FISH_HOOK_POLICY.domainId)?.assertion))) {
    throw new Error('FishHook exact source/applicationScope policy mismatch')
  }
  const inventory = inventoryInput as unknown as InventoryView
  const item = exactItem(inventory, request)
  const candidate = exactCandidate(item, request)
  if (policy.relationKind === 'spin-wheel-actor' && (candidate.role !== 'instance'
    || candidate.objectName !== 'BP_SpinWheelInstance_C' || !Array.isArray(candidate.evidence)
    || !candidate.evidence.includes('serialized-identifier:ItemIdName=SpinWheel')
    || !candidate.evidence.includes('serialized-identifier:ItemId.SerializedId=SpinWheel'))) {
    throw new Error('SpinWheel selected candidate identity/role mismatch')
  }

  if (policy.relationKind === 'fish-hook') {
    const rawCandidate = item.rawCandidate as JsonRecord
    const traversal = candidate.traversal as JsonRecord | undefined
    const paths = traversal?.relationPaths as JsonRecord[] | undefined
    const roots = Array.isArray(paths) ? paths.filter((entry) => entry.id === 'rp-root') : []
    if (rawCandidate.status !== 'exact' || candidate.candidateMappingStatus !== 'exact'
      || candidate.role !== 'instance' || candidate.objectName !== 'BP_FishingRodInstance_C'
      || !Array.isArray(candidate.evidence)
      || !candidate.evidence.includes('serialized-identifier:ItemIdName=FishingRod')
      || !candidate.evidence.includes('serialized-identifier:ItemId.SerializedId=FishingRod')
      || traversal?.rootPackage !== FISH_HOOK_POLICY.sourcePackage || roots.length !== 1
      || roots[0]!.sourcePackage !== FISH_HOOK_POLICY.sourcePackage
      || !Array.isArray(roots[0]!.edgeIds) || roots[0]!.edgeIds.length !== 0
      || !Array.isArray(roots[0]!.edgeSequence) || roots[0]!.edgeSequence.length !== 0) {
      throw new Error('FishHook exact selected candidate/rp-root mismatch')
    }
  }

  if (policy.relationKind === 'item-actor' || policy.relationKind === 'spin-wheel-actor' || policy.relationKind === 'fish-hook') {
    const fieldReferences = candidate.relations.filter((reference) =>
      inventory.sourceRelations.some((source) => source.edgeId === reference.edgeId
        && source.propertyPath === policy.propertyPath))
    if (fieldReferences.length !== 1 || fieldReferences[0]!.edgeId !== request.edgeId) {
      throw new Error('ItemActor candidate property occurrence missing or duplicated')
    }
  }

  if (request.catalogId !== request.definition.assertion.domainId) {
    throw new Error('Horizontal scope relation catalog/domain binding mismatch')
  }
  if (request.candidatePackage !== request.definition.assertion.applicationScope.packagePath) {
    throw new Error('Horizontal scope relation candidate/Identity package binding mismatch')
  }

  const rootMatches = candidate.relations.flatMap((candidateRelation) => {
    const sourceMatches = inventory.sourceRelations.filter((source) => source.edgeId === candidateRelation.edgeId)
    if (sourceMatches.length !== 1) return []
    const source = sourceMatches[0]!
    return candidateRelation.sourcePackage === request.candidatePackage
      && candidateRelation.sourceRelationPathId === 'rp-root'
      && source.sourcePackage === request.candidatePackage
      && source.propertyPath === policy.propertyPath
      ? [{ reference: candidateRelation, source }]
      : []
  })
  if (rootMatches.length !== 1) {
    throw new Error(`Horizontal scope relation root occurrence does not resolve exactly once: ${request.catalogId}`)
  }
  if (rootMatches[0]!.reference.edgeId !== request.edgeId) {
    throw new Error('Horizontal scope relation edgeId does not own the unique root occurrence')
  }

  const reference = exactCandidateReference(candidate, request.edgeId)
  const sourceRelation = exactSourceRelation(inventory, request.edgeId)
  if (reference.sourceRelationPathId !== 'rp-root') {
    throw new Error('Horizontal scope relation source requires sourceRelationPathId=rp-root')
  }
  if (reference.sourcePackage !== request.candidatePackage
    || sourceRelation.sourcePackage !== request.candidatePackage
    || reference.sourcePackage !== sourceRelation.sourcePackage) {
    throw new Error('Horizontal scope relation source requires candidatePackage == sourcePackage')
  }
  if (sourceRelation.relationKind !== 'object-property' || sourceRelation.propertyPath !== policy.propertyPath) {
    throw new Error('Horizontal scope relation source occurrence binding mismatch')
  }
  if ((policy.relationKind === 'item-actor' || policy.relationKind === 'spin-wheel-actor' || policy.relationKind === 'fish-hook')
    && (sourceRelation.sourceOccurrenceKind !== 'cdo-property' || sourceRelation.arrayIndex !== null)) {
    throw new Error('ItemActor source must be an exact root CDO property')
  }

  const provenance = candidate.candidatePackageProvenance
  const datasetId = requiredString(inventory.inventoryIdentity?.datasetId, 'Horizontal scope relation datasetId')
  const sourceShardPath = requiredString(provenance?.sourceShardPath, 'Horizontal scope relation source shard path')
  const sourceShardUncompressedSha256 = requiredString(
    provenance?.sourceShardUncompressedSha256,
    'Horizontal scope relation source shard uncompressed hash',
  )
  const sourcePackageHash = requiredString(provenance?.packageHash, 'Horizontal scope relation source package hash')
  const { shard } = readVerifiedStructuralShard(
    repositoryRoot,
    sourceShardPath,
    datasetId,
    sourceShardUncompressedSha256,
  )

  const packageMatches = shard.packages.map((pkg, index) => ({ pkg, index }))
    .filter(({ pkg }) => pkg.path === request.candidatePackage)
  if (packageMatches.length !== 1) {
    throw new Error(`Structural scope relation source package does not resolve exactly once: ${request.candidatePackage}`)
  }
  const packageMatch = packageMatches[0]!
  if (!packageMatch.pkg.packageHash || packageMatch.pkg.packageHash.value !== sourcePackageHash) {
    throw new Error(`Structural scope relation source package hash mismatch: ${request.candidatePackage}`)
  }
  if (!packageMatch.pkg.parse.runId) {
    throw new Error(`Structural scope relation source package parse runId is missing: ${request.candidatePackage}`)
  }

  const edgeMatches = shard.edges.map((edge, index) => ({ edge: edge as unknown as JsonRecord, index }))
    .filter(({ edge }) => edge.id === request.edgeId)
  if (edgeMatches.length !== 1) {
    throw new Error(`Structural scope relation edgeId does not resolve exactly once: ${request.edgeId}`)
  }
  const edgeMatch = edgeMatches[0]!
  const structuralSummary = structuralRelationSummary(edgeMatch.edge, repositoryRoot, datasetId)
  if (canonicalJson(structuralSummary) !== canonicalJson(sourceRelation)) {
    throw new Error(`Horizontal scope source relation does not match its exact Structural edge: ${request.edgeId}`)
  }
  if (structuralSummary.relationKind !== 'object-property' || structuralSummary.propertyPath !== policy.propertyPath) {
    throw new Error(`Structural scope root edge policy mismatch: ${request.edgeId}`)
  }
  if (policy.relationKind === 'item-actor' || policy.relationKind === 'spin-wheel-actor' || policy.relationKind === 'fish-hook') {
    const structuralRoots = shard.edges.filter((edge) => edge.sourcePackage === request.candidatePackage
      && edge.kind === 'object-property' && edge.sourceOccurrence.kind === 'cdo-property'
      && edge.sourceOccurrence.propertyPath === policy.propertyPath)
    if (structuralRoots.length !== 1 || structuralRoots[0]!.id !== request.edgeId) {
      throw new Error('ItemActor exact Structural root occurrence missing or duplicated')
    }
  }

  const source: RawTrace = {
    artifactPath: sourceShardPath,
    datasetId,
    extractionRunId: packageMatch.pkg.parse.runId,
    packagePath: request.candidatePackage,
    packageHash: packageMatch.pkg.packageHash,
    nodePointer: `/edges/${edgeMatch.index}`,
  }
  const matchedStructuralIdentity = matchedIdentityDomainIdFromSource(
    source,
    request.definition,
    request.identity,
    request.identityEvidence,
  )
  const direct = request.identitySource
  const sourceDomainId = matchedStructuralIdentity ?? (direct
    && matchedIdentityDomainId(direct, request.definition, request.identity, request.identityEvidence)
    && sameLogicalRawPackage(snapshotSource(direct), source)
    ? request.definition.assertion.domainId : undefined)
  if (sourceDomainId !== request.definition.assertion.domainId) {
    throw new Error(`${request.definition.assertion.id}: Horizontal scope Relation source failed the same-source Identity gate`)
  }

  const targetResolution = serializedTargetResolution(repositoryRoot, edgeMatch.edge, datasetId)
  const target = requireFirstWaveTarget(sourceRelation, targetResolution)
  if (policy.relationKind === 'item-actor') {
    const targetPath = requiredString(edgeMatch.edge.targetPackage, 'ItemActor target package')
    const structuralTarget = targetStructuralPackage(repositoryRoot, targetPath, datasetId)
    verifyItemActorTargetStructural(requiredString(edgeMatch.edge.targetObject, 'ItemActor target object'),
      structuralTarget.pkg, structuralTarget.edges)
  }
  if (policy.relationKind === 'spin-wheel-actor') {
    verifySpinWheelClassStructural(
      '/Game/Content_DLC4/Actors/Items/SpinWheel/BP_SpinWheelInstance.BP_SpinWheelInstance_C',
      packageMatch.pkg as unknown as JsonRecord,
      shard.edges.filter((edge) => edge.sourcePackage === request.candidatePackage) as unknown as JsonRecord[], 'instance')
    if (edgeMatch.edge.targetPackage !== SPIN_WHEEL_ACTOR_POLICY.targetPackage
      || edgeMatch.edge.targetObject !== SPIN_WHEEL_ACTOR_POLICY.targetObject) {
      throw new Error('SpinWheel exact root/target policy mismatch')
    }
    const sourcePackage = packageMatch.pkg as unknown as JsonRecord
    const inventories = sourcePackage.cdoPropertyInventory as JsonRecord[]
    if (!Array.isArray(inventories)) throw new Error('SpinWheel source CDO inventory missing')
    const sourceCdo = (sourcePackage.exports as JsonRecord[]).find((entry) => entry.isClassDefaultObject === true
      && isRecord(entry.objectName) && entry.objectName.value === 'Default__BP_SpinWheelInstance_C')!
    const roots = inventories.filter((entry) => entry.objectName === 'Default__BP_SpinWheelInstance_C')
    const properties = roots.length === 1 && Array.isArray(roots[0]!.properties)
      ? (roots[0]!.properties as JsonRecord[]).filter((entry) => entry.path === 'SpinWheelActorClass') : []
    const property = properties[0]
    const occurrence = edgeMatch.edge.sourceOccurrence as JsonRecord
    const decoding = property?.decoding as JsonRecord | undefined
    const value = decoding?.value as JsonRecord | undefined
    if (roots.length !== 1 || roots[0]!.exportIndex !== sourceCdo.exportIndex
      || properties.length !== 1 || !property || !isRecord(property.type) || property.type.value !== 'ObjectProperty'
      || property.arrayIndex !== 0 || decoding?.state !== 'decoded'
      || value?.kind !== 'import' || value.objectName !== 'BP_SpinWheelActor_C'
      || value.className !== 'BlueprintGeneratedClass' || value.rawPackageIndex !== occurrence.rawPackageIndex
      || canonicalJson(property.sourceRange) !== canonicalJson(occurrence.sourceRange)
      || canonicalJson(property.valueRange) !== canonicalJson(occurrence.valueRange)) {
      throw new Error('SpinWheel decoded scalar CDO property/edge mismatch')
    }
    const structuralTarget = targetStructuralPackage(repositoryRoot, SPIN_WHEEL_ACTOR_POLICY.targetPackage, datasetId)
    verifySpinWheelActorTargetStructural(SPIN_WHEEL_ACTOR_POLICY.targetObject, structuralTarget.pkg, structuralTarget.edges)
  }
  if (policy.relationKind === 'fish-hook') {
    if (edgeMatch.edge.targetPackage !== FISH_HOOK_POLICY.targetPackage
      || edgeMatch.edge.targetObject !== FISH_HOOK_POLICY.targetObject) {
      throw new Error('FishHook exact root/target policy mismatch')
    }
    const sourcePackage = packageMatch.pkg as unknown as JsonRecord
    const exports = sourcePackage.exports as JsonRecord[]
    const inventories = sourcePackage.cdoPropertyInventory as JsonRecord[]
    const cdos = exports.filter((entry) => entry.isClassDefaultObject === true
      && isRecord(entry.objectName) && entry.objectName.value === 'Default__BP_FishingRodInstance_C')
    const roots = Array.isArray(inventories)
      ? inventories.filter((entry) => entry.objectName === 'Default__BP_FishingRodInstance_C') : []
    const properties = roots.length === 1 && Array.isArray(roots[0]!.properties)
      ? (roots[0]!.properties as JsonRecord[]).filter((entry) => entry.path === 'FishingHookActorClass') : []
    const property = properties[0]
    const occurrence = edgeMatch.edge.sourceOccurrence as JsonRecord
    const decoding = property?.decoding as JsonRecord | undefined
    const value = decoding?.value as JsonRecord | undefined
    if (cdos.length !== 1 || roots.length !== 1 || roots[0]!.exportIndex !== cdos[0]!.exportIndex
      || properties.length !== 1 || !property || !isRecord(property.type) || property.type.value !== 'ObjectProperty'
      || property.arrayIndex !== 0 || decoding?.state !== 'decoded'
      || value?.kind !== 'import' || value.objectName !== 'BP_FishHookItem_C'
      || value.className !== 'BlueprintGeneratedClass' || value.rawPackageIndex !== occurrence.rawPackageIndex
      || canonicalJson(property.sourceRange) !== canonicalJson(occurrence.sourceRange)
      || canonicalJson(property.valueRange) !== canonicalJson(occurrence.valueRange)) {
      throw new Error('FishHook decoded scalar CDO property/edge mismatch')
    }
    const structuralTarget = targetStructuralPackage(repositoryRoot, FISH_HOOK_POLICY.targetPackage, datasetId)
    verifyFishHookTargetStructural(FISH_HOOK_POLICY.targetObject, structuralTarget.pkg, structuralTarget.edges)
  }
  return {
    sourceDomainId,
    relationRef: relationRefForDomain(sourceDomainId, policy.relationKind),
    occurrence: { domainId: sourceDomainId, scopeRef: 'source' },
    edgeId: request.edgeId,
    source,
    target: target.target,
    serializedTargetResolution: target.serializedTargetResolution,
    structuralEdge: edgeMatch.edge,
  }
}

export function resolveHorizontalArmorScopeRelationSource(
  repositoryRoot: string, inventory: HorizontalRawFactInventory, request: ArmorScopeRelationSourceRequest,
): ResolvedScopeRelationSource {
  return resolveHorizontalScopeRelationSource(repositoryRoot, inventory, request)
}

export function resolveHorizontalArtifactEffectRelationSource(
  repositoryRoot: string, inventory: HorizontalRawFactInventory, request: ArtifactEffectRelationSourceRequest,
): ResolvedScopeRelationSource {
  return resolveHorizontalScopeRelationSource(repositoryRoot, inventory, request)
}

export function resolveHorizontalArtifactItemActorRelationSource(
  repositoryRoot: string, inventory: HorizontalRawFactInventory, request: ArtifactItemActorRelationSourceRequest,
): ResolvedScopeRelationSource {
  return resolveHorizontalScopeRelationSource(repositoryRoot, inventory, request)
}

export function resolveHorizontalSpinWheelActorRelationSource(
  repositoryRoot: string, inventory: HorizontalRawFactInventory, request: SpinWheelActorRelationSourceRequest,
): ResolvedScopeRelationSource {
  return resolveHorizontalScopeRelationSource(repositoryRoot, inventory, request)
}

export function resolveHorizontalFishHookRelationSource(
  repositoryRoot: string, inventory: HorizontalRawFactInventory, request: FishHookRelationSourceRequest,
): ResolvedScopeRelationSource {
  return resolveHorizontalScopeRelationSource(repositoryRoot, inventory, request)
}

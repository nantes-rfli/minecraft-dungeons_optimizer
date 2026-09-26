import { loadStructuralGraph, type HorizontalRawFactInventory, type JsonRecord } from './game-data-horizontal-fact-inventory.ts'
import { readVerifiedStructuralShard } from './formal-value-source-provenance.ts'
import { matchedIdentityDomainId, matchedIdentityDomainIdFromSource, sameLogicalRawPackage, snapshotSource } from '../src/domain/formal/boundarySource.ts'
import type { RawPackageSnapshot } from './game-data-raw-package.ts'
import type { FormalIdentityDefinition, FormalSemanticIdentity, RawObservationEvidenceRecord } from '../src/domain/formal/identityEvidence.ts'
import type { RawTrace } from '../src/domain/formal/rawProjection.ts'
import {
  horizontalRelationDefinition,
  serializedTargetResolutionFromStructuralEdge,
  type CollectionRelationOccurrence,
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

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const verifiedStructuralPackagePathsByRepository = new Map<string, ReadonlySet<string>>()

function verifiedStructuralPackagePaths(repositoryRoot: string): ReadonlySet<string> {
  const cached = verifiedStructuralPackagePathsByRepository.get(repositoryRoot)
  if (cached) return cached
  const packagePaths = new Set(loadStructuralGraph(repositoryRoot).packagesByPath.keys())
  verifiedStructuralPackagePathsByRepository.set(repositoryRoot, packagePaths)
  return packagePaths
}

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

function exactItem(inventory: InventoryView, request: HorizontalRelationSourceRequest): HorizontalItem {
  const matches = inventory.items.filter((item) => item.category === request.category && item.catalogId === request.catalogId)
  if (matches.length !== 1) {
    throw new Error(`Horizontal relation catalog item does not resolve exactly once: ${request.category}:${request.catalogId}`)
  }
  return matches[0]!
}

function exactCandidate(item: HorizontalItem, request: HorizontalRelationSourceRequest): HorizontalCandidate {
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
  structuralPackagePaths: ReadonlySet<string>,
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
    targetState: serializedTargetResolutionFromStructuralEdge(edge, structuralPackagePaths).state,
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
  const structuralPackagePaths = verifiedStructuralPackagePaths(repositoryRoot)
  const structuralSummary = structuralRelationSummary(edgeMatch.edge, structuralPackagePaths)
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

  const serializedTargetResolution = serializedTargetResolutionFromStructuralEdge(edgeMatch.edge, structuralPackagePaths)
  const target = requireFirstWaveTarget(sourceRelation, serializedTargetResolution)
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

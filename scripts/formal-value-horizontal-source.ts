import fs from 'node:fs'
import path from 'node:path'
import { gunzipSync } from 'node:zlib'
import {
  HORIZONTAL_FACT_INVENTORY_PATH,
  type HorizontalRawFactInventory,
} from './game-data-horizontal-fact-inventory.ts'
import {
  readVerifiedStructuralShard,
  resolveJsonPointer,
  verifyStructuralValueParser,
} from './formal-value-source-provenance.ts'
import type { Field, RawTrace, Trace, UnavailableState } from '../src/domain/formal/rawProjection.ts'

type JsonRecord = Record<string, unknown>
type ScalarValue = string | number | boolean

const isRecord = (value: unknown): value is JsonRecord => typeof value === 'object' && value !== null && !Array.isArray(value)
const asRecord = (value: unknown, label: string): JsonRecord => {
  if (!isRecord(value)) throw new Error(`${label} is not an object`)
  return value
}
const asArray = (value: unknown, label: string): unknown[] => {
  if (!Array.isArray(value)) throw new Error(`${label} is not an array`)
  return value
}
const requiredString = (value: unknown, label: string): string => {
  if (typeof value !== 'string' || value.length === 0) throw new Error(`${label} is missing`)
  return value
}
const canonicalJson = (value: unknown): string => JSON.stringify(value) ?? 'undefined'

export type DirectHorizontalSourceRequest = {
  category: 'melee' | 'ranged' | 'artifact'
  catalogId: string
  candidatePackage: string
  sourceFactId: string
}

export type ResolvedHorizontalSourceFact = {
  sourceFactId: string
  factKind: string
  propertyName: string
  propertyType: string
  propertyPath: string
  availabilityState: string
  decodingState: string
  propertyPointer: string
  node: unknown
  sourceIndex?: number
  raw: RawTrace
  sourceFact: JsonRecord
}

export function readHorizontalRawFactInventory(repositoryRoot: string): HorizontalRawFactInventory {
  const compressed = fs.readFileSync(path.join(repositoryRoot, HORIZONTAL_FACT_INVENTORY_PATH))
  const inventory = JSON.parse(gunzipSync(compressed).toString('utf8')) as HorizontalRawFactInventory
  if (inventory.schemaVersion !== 1 || inventory.artifactKind !== 'horizontal-raw-fact-inventory') {
    throw new Error('Unsupported Horizontal Raw Fact Inventory')
  }
  return inventory
}

function exactItem(inventory: HorizontalRawFactInventory, request: DirectHorizontalSourceRequest): JsonRecord {
  const matches = inventory.items.map((item) => asRecord(item, 'Horizontal item'))
    .filter((item) => item.category === request.category && item.catalogId === request.catalogId)
  if (matches.length !== 1) throw new Error(`Horizontal catalog item does not resolve exactly once: ${request.category}:${request.catalogId}`)
  return matches[0]!
}

function exactCandidate(item: JsonRecord, request: DirectHorizontalSourceRequest): JsonRecord {
  const rawCandidate = asRecord(item.rawCandidate, 'Horizontal rawCandidate')
  const matches = asArray(rawCandidate.candidates, 'Horizontal candidate list')
    .map((candidate) => asRecord(candidate, 'Horizontal candidate'))
    .filter((candidate) => candidate.packagePath === request.candidatePackage)
  if (matches.length !== 1) throw new Error(`Horizontal candidate package does not resolve exactly once: ${request.candidatePackage}`)
  return matches[0]!
}

function exactCandidateFactReference(candidate: JsonRecord, request: DirectHorizontalSourceRequest): JsonRecord {
  const matches = asArray(candidate.facts, 'Horizontal candidate facts')
    .map((fact) => asRecord(fact, 'Horizontal candidate fact'))
    .filter((fact) => fact.sourceFactId === request.sourceFactId)
  if (matches.length !== 1) throw new Error(`Horizontal candidate sourceFactId does not resolve exactly once: ${request.sourceFactId}`)
  return matches[0]!
}

function exactSourceFact(inventory: HorizontalRawFactInventory, sourceFactId: string): JsonRecord {
  const inventoryRecord = inventory as unknown as JsonRecord
  const matches = asArray(inventoryRecord.sourceFacts, 'Horizontal sourceFacts')
    .map((fact) => asRecord(fact, 'Horizontal source fact'))
    .filter((fact) => fact.factId === sourceFactId)
  if (matches.length !== 1) throw new Error(`Horizontal sourceFactId does not resolve exactly once: ${sourceFactId}`)
  return matches[0]!
}

function sourceIndexFromFact(sourceFact: JsonRecord): number | undefined {
  const occurrence = asRecord(sourceFact.occurrence, 'Horizontal source fact occurrence')
  return typeof occurrence.elementIndex === 'number' ? occurrence.elementIndex : undefined
}

function nodeDecodingState(node: unknown): string | undefined {
  if (!isRecord(node)) return undefined
  const decoding = isRecord(node.decoding) ? node.decoding : undefined
  return typeof decoding?.state === 'string' ? decoding.state : undefined
}

function decodedNodeValue(node: unknown): unknown {
  if (!isRecord(node) || !isRecord(node.decoding)) return undefined
  return Object.prototype.hasOwnProperty.call(node.decoding, 'value') ? node.decoding.value : undefined
}

function validateResolvedOccurrence(
  pkg: JsonRecord,
  sourceFact: JsonRecord,
  propertyPointer: string,
  node: unknown,
): void {
  const factKind = requiredString(sourceFact.factKind, 'Horizontal source fact kind')
  const propertyName = requiredString(sourceFact.propertyName, 'Horizontal source fact propertyName')
  const propertyPath = requiredString(sourceFact.propertyPath, 'Horizontal source fact propertyPath')
  const occurrence = asRecord(sourceFact.occurrence, 'Horizontal source fact occurrence')

  if (factKind === 'array-element-occurrence') {
    const match = propertyPointer.match(/^(.*)\/decoding\/elements\/(\d+)$/)
    if (!match) throw new Error(`Array-element source pointer is malformed: ${propertyPointer}`)
    const parent = asRecord(resolveJsonPointer(pkg, match[1]!), 'Structural array parent')
    const parentName = asRecord(parent.name, 'Structural array property name')
    if (parentName.value !== propertyName || parent.path !== propertyPath.replace(/\[[^\]]+\]$/, '')) {
      throw new Error(`Horizontal source occurrence property identity mismatch: ${propertyPointer}`)
    }
    const element = asRecord(node, 'Structural array element')
    if (element.index !== occurrence.elementIndex) {
      throw new Error(`Horizontal source occurrence elementIndex mismatch: ${propertyPointer}`)
    }
  } else {
    const property = asRecord(node, 'Structural property occurrence')
    const name = asRecord(property.name, 'Structural property name')
    const type = asRecord(property.type, 'Structural property type')
    if (name.value !== propertyName || type.value !== sourceFact.propertyType || property.path !== propertyPath
      || property.order !== occurrence.sourceOrder || property.arrayIndex !== occurrence.arrayIndex) {
      throw new Error(`Horizontal source occurrence property identity mismatch: ${propertyPointer}`)
    }
  }

  const availabilityState = requiredString(sourceFact.availabilityState, 'Horizontal source fact availabilityState')
  const decodingState = requiredString(sourceFact.decodingState, 'Horizontal source fact decodingState')
  if (nodeDecodingState(node) !== decodingState) {
    throw new Error(`Horizontal source occurrence decoding state mismatch: ${propertyPointer}`)
  }
  if (availabilityState === 'known' && decodingState !== 'decoded') {
    throw new Error(`Known Horizontal source occurrence is not decoded: ${propertyPointer}`)
  }
  if (availabilityState === 'parser-boundary' && decodingState === 'decoded') {
    throw new Error(`Parser-boundary Horizontal source occurrence unexpectedly decoded: ${propertyPointer}`)
  }
  if (Object.prototype.hasOwnProperty.call(sourceFact, 'decodedValue')
    && canonicalJson(sourceFact.decodedValue) !== canonicalJson(decodedNodeValue(node))) {
    throw new Error(`Horizontal source occurrence decoded value mismatch: ${propertyPointer}`)
  }
}

export function resolveDirectHorizontalSourceFact(
  repositoryRoot: string,
  inventory: HorizontalRawFactInventory,
  request: DirectHorizontalSourceRequest,
): ResolvedHorizontalSourceFact {
  const item = exactItem(inventory, request)
  const candidate = exactCandidate(item, request)
  const reference = exactCandidateFactReference(candidate, request)
  const sourceFact = exactSourceFact(inventory, request.sourceFactId)
  const referenceSource = asRecord(reference.source, 'Horizontal candidate fact source')
  const source = asRecord(sourceFact.source, 'Horizontal source fact provenance')
  const inventoryIdentity = asRecord((inventory as unknown as JsonRecord).inventoryIdentity, 'Horizontal inventory identity')

  if (referenceSource.candidatePackage !== request.candidatePackage) throw new Error('Horizontal source candidate package mismatch')
  if (referenceSource.relationPathId !== 'rp-root') throw new Error('Horizontal Value direct source requires relationPathId=rp-root')
  if (referenceSource.sourcePackage !== request.candidatePackage) throw new Error('Horizontal Value direct source requires candidatePackage == sourcePackage')

  const datasetId = requiredString(source.datasetId, 'Horizontal source datasetId')
  if (datasetId !== inventoryIdentity.datasetId) throw new Error('Horizontal source dataset identity mismatch')
  const sourcePackage = requiredString(source.sourcePackage, 'Horizontal source package')
  if (sourcePackage !== request.candidatePackage || referenceSource.sourcePackage !== sourcePackage) {
    throw new Error('Horizontal source package mismatch')
  }
  const sourceShardPath = requiredString(source.sourceShardPath, 'Horizontal source shard path')
  const sourceShardUncompressedSha256 = requiredString(source.sourceShardUncompressedSha256, 'Horizontal source shard hash')
  const sourcePackageHash = requiredString(source.sourcePackageHash, 'Horizontal source package hash')
  const propertyPointer = requiredString(source.propertyPointer, 'Horizontal source property pointer')

  const { manifest, shard } = readVerifiedStructuralShard(
    repositoryRoot,
    sourceShardPath,
    datasetId,
    sourceShardUncompressedSha256,
  )
  const packageMatches = shard.packages.map((pkg, index) => ({ pkg, index }))
    .filter(({ pkg }) => pkg.path === sourcePackage)
  if (packageMatches.length !== 1) throw new Error(`Horizontal source package does not resolve exactly once in its shard: ${sourcePackage}`)
  const match = packageMatches[0]!
  verifyStructuralValueParser(manifest, match.pkg)
  if (!match.pkg.packageHash || match.pkg.packageHash.value !== sourcePackageHash) {
    throw new Error(`Horizontal source package hash mismatch: ${sourcePackage}`)
  }
  if (!match.pkg.parse.runId) throw new Error(`Horizontal source package parse runId is missing: ${sourcePackage}`)

  const pkg = match.pkg as unknown as JsonRecord
  const node = resolveJsonPointer(pkg, propertyPointer)
  if (node === undefined) throw new Error(`Horizontal source property pointer does not resolve: ${propertyPointer}`)
  validateResolvedOccurrence(pkg, sourceFact, propertyPointer, node)

  return {
    sourceFactId: request.sourceFactId,
    factKind: requiredString(sourceFact.factKind, 'Horizontal source fact kind'),
    propertyName: requiredString(sourceFact.propertyName, 'Horizontal source fact propertyName'),
    propertyType: requiredString(sourceFact.propertyType, 'Horizontal source fact propertyType'),
    propertyPath: requiredString(sourceFact.propertyPath, 'Horizontal source fact propertyPath'),
    availabilityState: requiredString(sourceFact.availabilityState, 'Horizontal source fact availabilityState'),
    decodingState: requiredString(sourceFact.decodingState, 'Horizontal source fact decodingState'),
    propertyPointer,
    node,
    ...(sourceIndexFromFact(sourceFact) === undefined ? {} : { sourceIndex: sourceIndexFromFact(sourceFact) }),
    raw: {
      artifactPath: sourceShardPath,
      datasetId,
      extractionRunId: match.pkg.parse.runId,
      packagePath: sourcePackage,
      packageHash: match.pkg.packageHash,
      nodePointer: `/packages/${match.index}${propertyPointer}`,
    },
    sourceFact,
  }
}

function traceFor(resolved: ResolvedHorizontalSourceFact, mappingId: string, identityAssertionId: string): Trace {
  return { mappingId, identityAssertionId, raw: resolved.raw }
}

function unavailableState(decodingState: string): UnavailableState {
  if (decodingState === 'unsupported' || decodingState === 'parse-failed' || decodingState === 'not-extracted') return decodingState
  return 'unknown'
}

export function horizontalScalarFieldFromResolved<T extends ScalarValue>(
  resolved: ResolvedHorizontalSourceFact,
  mappingId: string,
  identityAssertionId: string,
  expectedPropertyName: string,
  expectedPropertyType: string,
  valueType: 'string' | 'number' | 'boolean',
): Field<T> {
  const trace = traceFor(resolved, mappingId, identityAssertionId)
  if (resolved.propertyName !== expectedPropertyName || resolved.propertyType !== expectedPropertyType) {
    return { state: 'unknown', reason: 'Horizontal source fact does not match the requested property semantic', trace }
  }
  if (resolved.availabilityState !== 'known') {
    return { state: unavailableState(resolved.decodingState), reason: 'Horizontal source occurrence is unavailable', trace }
  }
  if (!Object.prototype.hasOwnProperty.call(resolved.sourceFact, 'decodedValue')) {
    return { state: 'unknown', reason: 'Horizontal source fact has no decoded scalar value', trace }
  }
  const value = resolved.sourceFact.decodedValue
  if (typeof value !== valueType || (typeof value === 'number' && !Number.isFinite(value))) {
    return { state: 'unknown', reason: 'Horizontal source fact has an unexpected decoded scalar type', trace }
  }
  return { state: 'known', value: value as T, trace }
}

function elementOffset(pointer: string): number | undefined {
  const match = pointer.match(/\/decoding\/elements\/(\d+)$/)
  return match ? Number(match[1]) : undefined
}

export function horizontalCollectionFieldFromResolved(
  parent: ResolvedHorizontalSourceFact,
  elements: readonly ResolvedHorizontalSourceFact[],
  mappingId: string,
  identityAssertionId: string,
  expectedPropertyName: string,
): Field<number[]> {
  const trace = traceFor(parent, mappingId, identityAssertionId)
  if (parent.propertyName !== expectedPropertyName || parent.propertyType !== 'ArrayProperty') {
    return { state: 'unknown', reason: 'Horizontal collection source does not match the requested property semantic', trace }
  }
  if (parent.availabilityState !== 'known') {
    return { state: unavailableState(parent.decodingState), reason: 'Horizontal collection source is unavailable', trace }
  }
  const parentNode = isRecord(parent.node) ? parent.node : undefined
  const decoding = parentNode && isRecord(parentNode.decoding) ? parentNode.decoding : undefined
  const rawElements = decoding && Array.isArray(decoding.elements) ? decoding.elements : undefined
  if (!rawElements) return { state: 'unknown', reason: 'Horizontal collection source is not a decoded ordered array', trace }
  if (elements.length !== rawElements.length) {
    return { state: 'unknown', reason: 'Horizontal collection element source coverage is incomplete or duplicated', trace }
  }

  const ordered = [...elements].sort((left, right) => (elementOffset(left.propertyPointer) ?? -1) - (elementOffset(right.propertyPointer) ?? -1))
  const indices: number[] = []
  for (let position = 0; position < ordered.length; position += 1) {
    const element = ordered[position]!
    const expectedPointer = `${parent.propertyPointer}/decoding/elements/${position}`
    const sourceIndex = element.sourceIndex
    if (element.factKind !== 'array-element-occurrence'
      || element.propertyName !== parent.propertyName
      || element.propertyPointer !== expectedPointer
      || !Number.isInteger(sourceIndex) || (sourceIndex ?? -1) < 0) {
      return { state: 'unknown', reason: 'Horizontal collection entry sourceIndex is missing or invalid', trace }
    }
    indices.push(sourceIndex!)
  }
  if (new Set(indices).size !== indices.length) {
    return { state: 'unknown', reason: 'Horizontal collection entry sourceIndex is duplicate and occurrence identity is ambiguous', trace }
  }
  return { state: 'known', value: indices, trace }
}

export type HorizontalScalarFieldRequest = DirectHorizontalSourceRequest & {
  mappingId: string
  identityAssertionId: string
  expectedPropertyName: string
  expectedPropertyType: string
  valueType: 'string' | 'number' | 'boolean'
  sourceIndexFactId?: string
}

export function readHorizontalScalarField<T extends ScalarValue>(
  repositoryRoot: string,
  inventory: HorizontalRawFactInventory,
  request: HorizontalScalarFieldRequest,
): { field: Field<T>; sourceIndex?: number } {
  const resolved = resolveDirectHorizontalSourceFact(repositoryRoot, inventory, request)
  const field = horizontalScalarFieldFromResolved<T>(
    resolved,
    request.mappingId,
    request.identityAssertionId,
    request.expectedPropertyName,
    request.expectedPropertyType,
    request.valueType,
  )
  if (!request.sourceIndexFactId) return { field }

  const sourceIndexFact = resolveDirectHorizontalSourceFact(repositoryRoot, inventory, {
    category: request.category,
    catalogId: request.catalogId,
    candidatePackage: request.candidatePackage,
    sourceFactId: request.sourceIndexFactId,
  })
  const sourceIndex = sourceIndexFact.sourceIndex
  if (sourceIndexFact.factKind !== 'array-element-occurrence'
    || !Number.isInteger(sourceIndex) || (sourceIndex ?? -1) < 0
    || !resolved.propertyPointer.startsWith(`${sourceIndexFact.propertyPointer}/properties/`)) {
    return {
      field: { state: 'unknown', reason: 'Horizontal child sourceIndex is missing, invalid, or does not own the child property', trace: field.trace },
    }
  }
  return { field, sourceIndex }
}

export type HorizontalCollectionFieldRequest = Omit<DirectHorizontalSourceRequest, 'sourceFactId'> & {
  parentSourceFactId: string
  elementSourceFactIds: readonly string[]
  mappingId: string
  identityAssertionId: string
  expectedPropertyName: string
}

export function readHorizontalCollectionField(
  repositoryRoot: string,
  inventory: HorizontalRawFactInventory,
  request: HorizontalCollectionFieldRequest,
): Field<number[]> {
  const parent = resolveDirectHorizontalSourceFact(repositoryRoot, inventory, {
    category: request.category,
    catalogId: request.catalogId,
    candidatePackage: request.candidatePackage,
    sourceFactId: request.parentSourceFactId,
  })
  const elements = request.elementSourceFactIds.map((sourceFactId) => resolveDirectHorizontalSourceFact(repositoryRoot, inventory, {
    category: request.category,
    catalogId: request.catalogId,
    candidatePackage: request.candidatePackage,
    sourceFactId,
  }))
  return horizontalCollectionFieldFromResolved(parent, elements, request.mappingId, request.identityAssertionId, request.expectedPropertyName)
}

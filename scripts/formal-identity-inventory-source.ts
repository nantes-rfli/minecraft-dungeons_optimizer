import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { gunzipSync } from 'node:zlib'
import type {
  FormalIdentityDefinition,
  FormalIdentityObservationFieldInput,
  FormalIdentityObservationInput,
  FormalIdentityProjectionInput,
  RawObservationEvidenceRecord,
} from '../src/domain/formal/identityEvidence.ts'
import type {
  RawStructuralInventoryManifest,
  RawStructuralInventoryShard,
} from './game-data-raw-structural-inventory.ts'

type StructuralPackage = RawStructuralInventoryShard['packages'][number]
type StructuralEdge = RawStructuralInventoryShard['edges'][number]
type StructuralProperty = StructuralPackage['cdoPropertyInventory'][number]['properties'][number]
type UnavailableReason = RawObservationEvidenceRecord['unavailableReason']

export type FormalIdentityInventoryBindingInput = {
  definition: FormalIdentityDefinition
  observation: FormalIdentityObservationInput
  structuralPackage: StructuralPackage
  structuralEdges: readonly StructuralEdge[]
  shardPath: string
  packageIndex: number
}

const inventoryDirectory = 'research/raw/game-data-raw-structural-inventory'
const manifestRelativePath = `${inventoryDirectory}/manifest.json`

const sha256 = (bytes: Buffer) => crypto.createHash('sha256').update(bytes).digest('hex')
const compare = (a: string, b: string) => a.localeCompare(b)

type LoadedShard = {
  firstPath: string
  lastPath: string
}

type LocatedProperty = {
  property?: StructuralProperty
  nodePointer: string
  unavailableReason?: UnavailableReason
}

function exactProperty(
  properties: readonly StructuralProperty[] | undefined,
  parentPointer: string,
  name: string,
): LocatedProperty {
  const matches = properties?.map((property, index) => ({
    property,
    nodePointer: `${parentPointer}/${index}`,
  })).filter(({ property }) => property.name.value === name && property.arrayIndex === 0) ?? []
  return matches.length === 1
    ? matches[0]!
    : { nodePointer: parentPointer, unavailableReason: 'missing-or-ambiguous-field' }
}

function observeNameProperty(
  property: LocatedProperty,
  provenance: Omit<FormalIdentityObservationFieldInput['provenance'], 'nodePointer'>,
): FormalIdentityObservationFieldInput {
  if (!property.property || property.unavailableReason) return {
    observation: { state: 'unavailable' },
    unavailableReason: property.unavailableReason ?? 'missing-or-ambiguous-field',
    provenance: { ...provenance, nodePointer: property.nodePointer },
  }
  if (property.property.decoding.state !== 'decoded') return {
    observation: { state: 'unavailable' },
    unavailableReason: 'parent-unavailable',
    provenance: { ...provenance, nodePointer: property.nodePointer },
  }
  if (property.property.type.value !== 'NameProperty' || typeof property.property.decoding.value !== 'string') return {
    observation: { state: 'unavailable' },
    unavailableReason: 'wrong-type',
    provenance: { ...provenance, nodePointer: property.nodePointer },
  }
  return {
    observation: { state: 'known', value: property.property.decoding.value },
    provenance: { ...provenance, nodePointer: property.nodePointer },
  }
}

function inventoryObservation(
  manifest: RawStructuralInventoryManifest,
  shardPath: string,
  packageIndex: number,
  pkg: StructuralPackage,
  definition: FormalIdentityDefinition,
): FormalIdentityObservationInput {
  const cdoExports = pkg.exports.filter((entry) => entry.isClassDefaultObject)
  const baseProvenance = {
    artifactPath: `${inventoryDirectory}/${shardPath}`,
    datasetId: manifest.scope.dataset.id,
    extractionRunId: pkg.parse.runId,
    packagePath: pkg.path,
    ...(pkg.packageHash ? { packageHash: pkg.packageHash } : {}),
  }
  if (cdoExports.length !== 1) {
    const unavailableReason: UnavailableReason = cdoExports.length === 0 ? 'missing-cdo' : 'ambiguous-cdo'
    const field = (suffix: string): FormalIdentityObservationFieldInput => ({
      observation: { state: 'unavailable' },
      unavailableReason,
      provenance: { ...baseProvenance, nodePointer: `/packages/${packageIndex}/exports${suffix}` },
    })
    return {
      rawSchemaVersion: definition.assertion.applicationScope.rawSchemaVersion,
      packagePath: pkg.path,
      itemIdName: field(''),
      serializedId: field(''),
    }
  }

  const cdo = cdoExports[0]!
  const inventories = pkg.cdoPropertyInventory.map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => entry.exportIndex === cdo.exportIndex)
  if (inventories.length !== 1) {
    const unavailableReason: UnavailableReason = inventories.length === 0 ? 'missing-cdo' : 'ambiguous-cdo'
    const pointer = `/packages/${packageIndex}/cdoPropertyInventory`
    const field: FormalIdentityObservationFieldInput = {
      observation: { state: 'unavailable' },
      unavailableReason,
      provenance: { ...baseProvenance, nodePointer: pointer },
    }
    return {
      rawSchemaVersion: definition.assertion.applicationScope.rawSchemaVersion,
      packagePath: pkg.path,
      itemIdName: field,
      serializedId: { ...field, provenance: { ...field.provenance } },
    }
  }

  const inventory = inventories[0]!
  const root = `/packages/${packageIndex}/cdoPropertyInventory/${inventory.index}/properties`
  const itemIdName = exactProperty(inventory.entry.properties, root, definition.assertion.applicationScope.identityFields.itemIdName)
  const itemId = exactProperty(inventory.entry.properties, root, 'ItemId')

  let serializedId: LocatedProperty
  if (!itemId.property || itemId.unavailableReason) {
    serializedId = { nodePointer: itemId.nodePointer, unavailableReason: itemId.unavailableReason }
  } else if (itemId.property.decoding.state !== 'decoded') {
    serializedId = { nodePointer: itemId.nodePointer, unavailableReason: 'parent-unavailable' }
  } else if (itemId.property.type.value !== 'StructProperty') {
    serializedId = { nodePointer: itemId.nodePointer, unavailableReason: 'wrong-type' }
  } else {
    serializedId = exactProperty(
      itemId.property.decoding.properties,
      `${itemId.nodePointer}/decoding/properties`,
      'SerializedId',
    )
  }

  return {
    rawSchemaVersion: definition.assertion.applicationScope.rawSchemaVersion,
    packagePath: pkg.path,
    itemIdName: observeNameProperty(itemIdName, baseProvenance),
    serializedId: observeNameProperty(serializedId, baseProvenance),
  }
}

export function readFormalIdentityInventoryBindings(
  repositoryRoot: string,
  definitions: readonly FormalIdentityDefinition[],
): FormalIdentityInventoryBindingInput[] {
  const manifestPath = path.join(repositoryRoot, manifestRelativePath)
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as RawStructuralInventoryManifest
  if (manifest.schemaVersion !== 1 || manifest.artifactKind !== 'raw-structural-inventory-with-dependency-graph') {
    throw new Error('Unsupported Raw Structural Inventory manifest')
  }
  if (manifest.representation !== 'canonical-json-in-deterministic-gzip-shards') {
    throw new Error('Unsupported Raw Structural Inventory representation')
  }

  const definitionByPackage = new Map(definitions.map((definition) => [
    definition.assertion.applicationScope.packagePath,
    definition,
  ]))
  if (definitionByPackage.size !== definitions.length) throw new Error('Formal Identity package scopes must be unique')

  const targets = new Set(definitionByPackage.keys())
  const found = new Map<string, { pkg: StructuralPackage; edges: readonly StructuralEdge[]; shardPath: string; packageIndex: number }>()
  const shardCache = new Map<number, LoadedShard>()

  const loadShard = (index: number): LoadedShard => {
    const cached = shardCache.get(index)
    if (cached) return cached
    const meta = manifest.shards[index]
    if (!meta) throw new Error(`Raw Structural Inventory shard index out of range: ${index}`)
    const shardFile = path.join(repositoryRoot, inventoryDirectory, meta.path)
    const compressed = fs.readFileSync(shardFile)
    if (sha256(compressed) !== meta.compressedSha256) throw new Error(`Raw Structural Inventory compressed hash mismatch: ${meta.path}`)
    const uncompressed = gunzipSync(compressed)
    if (sha256(uncompressed) !== meta.uncompressedSha256) throw new Error(`Raw Structural Inventory uncompressed hash mismatch: ${meta.path}`)
    const shard = JSON.parse(uncompressed.toString('utf8')) as RawStructuralInventoryShard
    if (shard.schemaVersion !== 1 || shard.packages.length !== meta.packageCount) throw new Error(`Raw Structural Inventory shard metadata mismatch: ${meta.path}`)
    if (shard.packages.length === 0) throw new Error(`Raw Structural Inventory shard is empty: ${meta.path}`)
    for (const [packageIndex, pkg] of shard.packages.entries()) {
      if (targets.has(pkg.path)) found.set(pkg.path, {
        pkg,
        edges: shard.edges.filter((edge) => edge.sourcePackage === pkg.path),
        shardPath: meta.path,
        packageIndex,
      })
    }
    const loaded = {
      firstPath: shard.packages[0]!.path,
      lastPath: shard.packages[shard.packages.length - 1]!.path,
    }
    shardCache.set(index, loaded)
    return loaded
  }

  for (const packagePath of [...targets].sort(compare)) {
    let low = 0
    let high = manifest.shards.length - 1
    while (low <= high && !found.has(packagePath)) {
      const middle = Math.floor((low + high) / 2)
      const shard = loadShard(middle)
      if (compare(packagePath, shard.firstPath) < 0) high = middle - 1
      else if (compare(packagePath, shard.lastPath) > 0) low = middle + 1
      else break
    }
    if (!found.has(packagePath)) throw new Error(`Formal Identity package missing from Raw Structural Inventory: ${packagePath}`)
  }

  return definitions.map((definition) => {
    const packagePath = definition.assertion.applicationScope.packagePath
    const source = found.get(packagePath)
    if (!source) throw new Error(`Formal Identity inventory source was not resolved: ${packagePath}`)
    return {
      definition,
      observation: inventoryObservation(manifest, source.shardPath, source.packageIndex, source.pkg, definition),
      structuralPackage: source.pkg,
      structuralEdges: source.edges,
      shardPath: source.shardPath,
      packageIndex: source.packageIndex,
    }
  })
}

export function readFormalIdentityInventoryInputs(
  repositoryRoot: string,
  definitions: readonly FormalIdentityDefinition[],
): FormalIdentityProjectionInput[] {
  return readFormalIdentityInventoryBindings(repositoryRoot, definitions).map(({ definition, observation }) => ({ definition, observation }))
}

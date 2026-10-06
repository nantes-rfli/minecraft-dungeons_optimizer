import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { gunzipSync } from 'node:zlib'
import { RAW_PACKAGE_SNAPSHOT_SCHEMA_VERSION, type RawPackageSnapshot } from './game-data-raw-package.ts'
import { PARSER_ID, PARSER_SCHEMA_VERSION } from './game-data-package-source.ts'
import type {
  RawStructuralInventoryManifest,
  RawStructuralInventoryShard,
} from './game-data-raw-structural-inventory.ts'
import type { RawTrace } from '../src/domain/formal/rawProjection.ts'

export const RAW_STRUCTURAL_INVENTORY_DIRECTORY = 'research/raw/game-data-raw-structural-inventory' as const
export const RAW_STRUCTURAL_INVENTORY_MANIFEST = `${RAW_STRUCTURAL_INVENTORY_DIRECTORY}/manifest.json` as const

type JsonRecord = Record<string, unknown>

const sha256 = (bytes: Buffer) => crypto.createHash('sha256').update(bytes).digest('hex')
const isRecord = (value: unknown): value is JsonRecord => typeof value === 'object' && value !== null && !Array.isArray(value)
const verifiedShardCache = new Map<string, RawStructuralInventoryShard>()
const verifiedPackageExistenceCache = new Map<string, {
  manifestSha256: string
  shardPaths: readonly string[]
  exists: boolean
}>()
const comparePackagePath = (left: string, right: string): number => left.localeCompare(right)

function deepFreeze<T>(value: T): T {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) return value
  for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child)
  return Object.freeze(value)
}

function sameHash(
  left: { algorithm: string; value: string } | undefined,
  right: { algorithm: string; value: string } | undefined,
): boolean {
  return Boolean(left && right && left.algorithm === right.algorithm && left.value === right.value)
}

export function resolveJsonPointer(value: unknown, pointer: string): unknown {
  if (pointer === '') return value
  if (!pointer.startsWith('/')) return undefined
  let current: unknown = value
  for (const rawKey of pointer.slice(1).split('/')) {
    if (/~(?:[^01]|$)/.test(rawKey)) return undefined
    const key = rawKey.replace(/~1/g, '/').replace(/~0/g, '~')
    if (Array.isArray(current)) {
      if (!/^(0|[1-9]\d*)$/.test(key) || !Object.hasOwn(current, key)) return undefined
      current = current[Number(key)]
    } else if (isRecord(current) && Object.hasOwn(current, key)) current = current[key]
    else return undefined
  }
  return current
}

export type VerifiedStructuralShard = {
  manifest: RawStructuralInventoryManifest
  meta: RawStructuralInventoryManifest['shards'][number]
  shard: RawStructuralInventoryShard
}

export function readVerifiedStructuralShard(
  repositoryRoot: string,
  artifactPath: string,
  expectedDatasetId?: string,
  expectedUncompressedSha256?: string,
): VerifiedStructuralShard {
  const prefix = `${RAW_STRUCTURAL_INVENTORY_DIRECTORY}/`
  if (!artifactPath.startsWith(prefix) || artifactPath.includes('..')) {
    throw new Error(`Structural Inventory provenance path is outside the committed inventory: ${artifactPath}`)
  }
  const relativeShardPath = artifactPath.slice(prefix.length)
  const manifestPath = path.join(repositoryRoot, RAW_STRUCTURAL_INVENTORY_MANIFEST)
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as RawStructuralInventoryManifest
  if (manifest.schemaVersion !== 1
    || manifest.artifactKind !== 'raw-structural-inventory-with-dependency-graph'
    || manifest.representation !== 'canonical-json-in-deterministic-gzip-shards') {
    throw new Error('Unsupported Raw Structural Inventory manifest')
  }
  if (expectedDatasetId && manifest.scope.dataset.id !== expectedDatasetId) {
    throw new Error('Structural Inventory dataset identity mismatch')
  }

  const matches = manifest.shards.filter((candidate) => candidate.path === relativeShardPath)
  if (matches.length !== 1) throw new Error(`Structural Inventory shard identity does not resolve exactly once: ${artifactPath}`)
  const meta = matches[0]!
  if (expectedUncompressedSha256 && meta.uncompressedSha256 !== expectedUncompressedSha256) {
    throw new Error(`Structural Inventory shard uncompressed hash mismatch: ${artifactPath}`)
  }

  const compressed = fs.readFileSync(path.join(repositoryRoot, artifactPath))
  if (compressed.byteLength !== meta.compressedBytes || sha256(compressed) !== meta.compressedSha256) {
    throw new Error(`Structural Inventory shard compressed hash mismatch: ${artifactPath}`)
  }
  const cacheKey = [path.resolve(repositoryRoot), artifactPath, manifest.scope.dataset.id, meta.compressedSha256,
    meta.uncompressedSha256, meta.uncompressedBytes, meta.packageCount, meta.edgeCount].join('\0')
  const cached = verifiedShardCache.get(cacheKey)
  if (cached) return { manifest, meta, shard: cached }

  const uncompressed = gunzipSync(compressed)
  if (uncompressed.byteLength !== meta.uncompressedBytes || sha256(uncompressed) !== meta.uncompressedSha256) {
    throw new Error(`Structural Inventory shard content hash mismatch: ${artifactPath}`)
  }
  const shard = deepFreeze(JSON.parse(uncompressed.toString('utf8')) as RawStructuralInventoryShard)
  if (shard.schemaVersion !== 1 || shard.packages.length !== meta.packageCount || shard.edges.length !== meta.edgeCount) {
    throw new Error(`Structural Inventory shard metadata mismatch: ${artifactPath}`)
  }
  verifiedShardCache.set(cacheKey, shard)
  return { manifest, meta, shard }
}

/**
 * Checks exact package membership without materializing the Structural dependency graph.
 * Shards contain consecutive sorted package ranges, so a binary search reads only a
 * logarithmic number of verified shards before checking the exact package path.
 */
export function hasVerifiedStructuralPackage(
  repositoryRoot: string,
  packagePath: string,
  expectedDatasetId: string,
): boolean {
  const cacheKey = `${path.resolve(repositoryRoot)}\0${expectedDatasetId}\0${packagePath}`
  const manifestPath = path.join(repositoryRoot, RAW_STRUCTURAL_INVENTORY_MANIFEST)
  const manifestBytes = fs.readFileSync(manifestPath)
  const manifest = JSON.parse(manifestBytes.toString('utf8')) as RawStructuralInventoryManifest
  if (manifest.schemaVersion !== 1
    || manifest.artifactKind !== 'raw-structural-inventory-with-dependency-graph'
    || manifest.representation !== 'canonical-json-in-deterministic-gzip-shards') {
    throw new Error('Unsupported Raw Structural Inventory manifest')
  }
  if (manifest.scope.dataset.id !== expectedDatasetId) {
    throw new Error('Structural Inventory dataset identity mismatch')
  }

  const manifestSha256 = sha256(manifestBytes)
  const cached = verifiedPackageExistenceCache.get(cacheKey)
  if (cached?.manifestSha256 === manifestSha256) {
    // The manifest revision binds the search ranges; verify every shard that
    // established membership or absence before reusing that result.
    for (const artifactPath of cached.shardPaths) {
      readVerifiedStructuralShard(repositoryRoot, artifactPath, expectedDatasetId)
    }
    return cached.exists
  }
  const shardPaths: string[] = []
  const remember = (exists: boolean): boolean => {
    verifiedPackageExistenceCache.set(cacheKey, { manifestSha256, shardPaths, exists })
    return exists
  }

  let low = 0
  let high = manifest.shards.length - 1
  while (low <= high) {
    const middle = Math.floor((low + high) / 2)
    const meta = manifest.shards[middle]
    if (!meta) throw new Error(`Structural Inventory shard index out of range: ${middle}`)
    const artifactPath = `${RAW_STRUCTURAL_INVENTORY_DIRECTORY}/${meta.path}`
    const { shard } = readVerifiedStructuralShard(repositoryRoot, artifactPath, expectedDatasetId)
    shardPaths.push(artifactPath)
    if (shard.packages.length === 0) throw new Error(`Structural Inventory shard is empty: ${artifactPath}`)

    const packagePaths = shard.packages.map((pkg) => pkg.path)
    for (let index = 1; index < packagePaths.length; index += 1) {
      if (comparePackagePath(packagePaths[index - 1]!, packagePaths[index]!) >= 0) {
        throw new Error(`Structural Inventory shard package paths are not strictly sorted: ${artifactPath}`)
      }
    }

    const firstPath = packagePaths[0]!
    const lastPath = packagePaths[packagePaths.length - 1]!
    if (comparePackagePath(packagePath, firstPath) < 0) {
      high = middle - 1
    } else if (comparePackagePath(packagePath, lastPath) > 0) {
      low = middle + 1
    } else {
      const matches = shard.packages.filter((pkg) => pkg.path === packagePath)
      if (matches.length > 1) throw new Error(`Structural Inventory package does not resolve exactly once: ${packagePath}`)
      const exists = matches.length === 1
      return remember(exists)
    }
  }

  return remember(false)
}

export function verifyValueRawTraceProvenance(
  repositoryRoot: string,
  trace: RawTrace,
): { sourceKind: 'full-raw-snapshot' | 'structural-inventory-shard'; node: unknown } {
  if (trace.artifactPath.startsWith(`${RAW_STRUCTURAL_INVENTORY_DIRECTORY}/shards/`)) {
    const { manifest, shard } = readVerifiedStructuralShard(repositoryRoot, trace.artifactPath, trace.datasetId)
    const matches = shard.packages.map((pkg, index) => ({ pkg, index }))
      .filter(({ pkg }) => pkg.path === trace.packagePath)
    if (matches.length !== 1) throw new Error(`Structural Inventory package does not resolve exactly once: ${trace.packagePath}`)
    const match = matches[0]!
    verifyStructuralValueParser(manifest, match.pkg)
    if (match.pkg.parse.runId !== trace.extractionRunId) {
      throw new Error(`Structural Inventory package parse run mismatch: ${trace.packagePath}`)
    }
    if (!sameHash(match.pkg.packageHash, trace.packageHash)) {
      throw new Error(`Structural Inventory package hash mismatch: ${trace.packagePath}`)
    }
    if (!trace.nodePointer.startsWith(`/packages/${match.index}/`)) {
      throw new Error(`Structural Inventory nodePointer does not belong to its package: ${trace.nodePointer}`)
    }
    const node = resolveJsonPointer(shard, trace.nodePointer)
    if (node === undefined) throw new Error(`Structural Inventory nodePointer does not resolve: ${trace.nodePointer}`)
    return { sourceKind: 'structural-inventory-shard', node }
  }

  if (!trace.artifactPath.startsWith('research/raw/packages/') || !trace.artifactPath.endsWith('.raw.json')) {
    throw new Error(`Unsupported Value Raw provenance source: ${trace.artifactPath}`)
  }
  const raw = JSON.parse(fs.readFileSync(path.join(repositoryRoot, trace.artifactPath), 'utf8')) as RawPackageSnapshot
  if (raw.schemaVersion !== RAW_PACKAGE_SNAPSHOT_SCHEMA_VERSION || raw.snapshotKind !== 'generated-raw-package') {
    throw new Error(`Unsupported Raw snapshot header: ${trace.artifactPath}`)
  }
  if (raw.extraction?.parser?.id !== PARSER_ID || raw.extraction?.parser?.schemaVersion !== PARSER_SCHEMA_VERSION) {
    throw new Error(`Unsupported Raw snapshot parser: ${trace.artifactPath}`)
  }
  if (raw.dataset.id !== trace.datasetId) throw new Error(`Raw snapshot dataset mismatch: ${trace.artifactPath}`)
  if (raw.extraction.runId !== trace.extractionRunId) throw new Error(`Raw snapshot extraction run mismatch: ${trace.artifactPath}`)
  if (raw.logicalPackage.path !== trace.packagePath) throw new Error(`Raw snapshot package path mismatch: ${trace.artifactPath}`)
  if (!sameHash(raw.logicalPackage.contentHash, trace.packageHash)) throw new Error(`Raw snapshot package hash mismatch: ${trace.artifactPath}`)
  const node = resolveJsonPointer(raw, trace.nodePointer)
  if (node === undefined) throw new Error(`Raw snapshot nodePointer does not resolve: ${trace.nodePointer}`)
  return { sourceKind: 'full-raw-snapshot', node }
}

/** Hash/run identity alone does not establish a compatible decoded Value format. */
export function verifyStructuralValueParser(
  manifest: RawStructuralInventoryManifest,
  pkg: RawStructuralInventoryShard['packages'][number],
): void {
  if (manifest.scope.parser?.id !== PARSER_ID || manifest.scope.parser?.schemaVersion !== PARSER_SCHEMA_VERSION) {
    throw new Error('Unsupported Structural Value manifest parser')
  }
  if (pkg.parse?.parser?.id !== PARSER_ID || pkg.parse?.parser?.schemaVersion !== PARSER_SCHEMA_VERSION) {
    throw new Error(`Unsupported Structural Value package parser: ${pkg.path}`)
  }
}

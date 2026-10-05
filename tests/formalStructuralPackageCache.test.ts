import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { gzipSync } from 'node:zlib'
import { afterEach, describe, expect, it } from 'vitest'
import {
  hasVerifiedStructuralPackage,
  RAW_STRUCTURAL_INVENTORY_DIRECTORY,
  RAW_STRUCTURAL_INVENTORY_MANIFEST,
} from '../scripts/formal-value-source-provenance.ts'

const roots: string[] = []
const datasetId = 'cache-regression-dataset'
const packagePath = 'Dungeons/Content/B'
const shardPath = `${RAW_STRUCTURAL_INVENTORY_DIRECTORY}/shards/test.json.gz`
const hash = (bytes: Buffer) => crypto.createHash('sha256').update(bytes).digest('hex')

// Membership verification consumes only package paths and shard metadata.
function writeInventory(root: string, packages: string[], additionalShards: string[][] = []) {
  fs.mkdirSync(path.join(root, RAW_STRUCTURAL_INVENTORY_DIRECTORY, 'shards'), { recursive: true })
  const shards = [packages, ...additionalShards].map((paths, index) => {
    const bytes = Buffer.from(JSON.stringify({ schemaVersion: 1, packages: paths.map((path) => ({ path })), edges: [] }))
    const compressed = gzipSync(bytes)
    const relativePath = `shards/test${index || ''}.json.gz`
    fs.writeFileSync(path.join(root, RAW_STRUCTURAL_INVENTORY_DIRECTORY, relativePath), compressed)
    return { path: relativePath, compressedBytes: compressed.length, compressedSha256: hash(compressed),
      uncompressedBytes: bytes.length, uncompressedSha256: hash(bytes), packageCount: paths.length, edgeCount: 0 }
  })
  const manifest = {
    schemaVersion: 1,
    artifactKind: 'raw-structural-inventory-with-dependency-graph',
    representation: 'canonical-json-in-deterministic-gzip-shards',
    scope: { dataset: { id: datasetId } },
    shards,
  }
  fs.writeFileSync(path.join(root, RAW_STRUCTURAL_INVENTORY_MANIFEST), JSON.stringify(manifest))
  return manifest
}

function fixture(packages = [packagePath]) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'formal-package-cache-'))
  roots.push(root)
  const manifest = writeInventory(root, packages)
  return { root, manifest }
}

afterEach(() => { for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true }) })

describe('Structural package membership cache provenance', () => {
  it.each([true, false])('rechecks the manifest dataset after a cached %s result', (exists) => {
    const { root, manifest } = fixture(exists ? [packagePath] : ['Dungeons/Content/A'])
    expect(hasVerifiedStructuralPackage(root, packagePath, datasetId)).toBe(exists)
    manifest.scope.dataset.id = 'changed-dataset'
    fs.writeFileSync(path.join(root, RAW_STRUCTURAL_INVENTORY_MANIFEST), JSON.stringify(manifest))
    expect(() => hasVerifiedStructuralPackage(root, packagePath, datasetId)).toThrow(/dataset identity mismatch/)
  })

  it('rechecks manifest schema after a cached result', () => {
    const { root, manifest } = fixture()
    expect(hasVerifiedStructuralPackage(root, packagePath, datasetId)).toBe(true)
    manifest.schemaVersion = 99
    fs.writeFileSync(path.join(root, RAW_STRUCTURAL_INVENTORY_MANIFEST), JSON.stringify(manifest))
    expect(() => hasVerifiedStructuralPackage(root, packagePath, datasetId)).toThrow(/Unsupported/)
  })

  it.each([true, false])('rechecks shard bytes after a cached %s result', (exists) => {
    const { root } = fixture(exists ? [packagePath] : ['Dungeons/Content/A'])
    expect(hasVerifiedStructuralPackage(root, packagePath, datasetId)).toBe(exists)
    const bytes = fs.readFileSync(path.join(root, shardPath))
    bytes[0] = bytes[0]! ^ 1
    fs.writeFileSync(path.join(root, shardPath), bytes)
    expect(() => hasVerifiedStructuralPackage(root, packagePath, datasetId)).toThrow(/compressed hash mismatch/)
  })

  it.each([true, false])('recomputes a cached %s result when the verified inventory changes', (exists) => {
    const { root } = fixture(exists ? [packagePath] : ['Dungeons/Content/A'])
    expect(hasVerifiedStructuralPackage(root, packagePath, datasetId)).toBe(exists)
    writeInventory(root, exists ? ['Dungeons/Content/A'] : [packagePath])
    expect(hasVerifiedStructuralPackage(root, packagePath, datasetId)).toBe(!exists)
    expect(hasVerifiedStructuralPackage(root, packagePath, datasetId)).toBe(!exists)
  })

  it.each([true, false])('rechecks intermediate search shards for a cached %s result', (exists) => {
    const { root } = fixture()
    writeInventory(root, [packagePath], [['Dungeons/Content/D'], ['Dungeons/Content/F']])
    const query = exists ? packagePath : 'Dungeons/Content/A'
    expect(hasVerifiedStructuralPackage(root, query, datasetId)).toBe(exists)
    const intermediatePath = path.join(root, RAW_STRUCTURAL_INVENTORY_DIRECTORY, 'shards/test1.json.gz')
    const bytes = fs.readFileSync(intermediatePath)
    bytes[0] = bytes[0]! ^ 1
    fs.writeFileSync(intermediatePath, bytes)
    expect(() => hasVerifiedStructuralPackage(root, query, datasetId)).toThrow(/compressed hash mismatch/)
  })

  it('does not hide a removed manifest or shard after a cached result', () => {
    const { root, manifest } = fixture()
    expect(hasVerifiedStructuralPackage(root, packagePath, datasetId)).toBe(true)
    fs.unlinkSync(path.join(root, RAW_STRUCTURAL_INVENTORY_MANIFEST))
    expect(() => hasVerifiedStructuralPackage(root, packagePath, datasetId)).toThrow(/ENOENT/)
    fs.writeFileSync(path.join(root, RAW_STRUCTURAL_INVENTORY_MANIFEST), JSON.stringify(manifest))
    fs.unlinkSync(path.join(root, shardPath))
    expect(() => hasVerifiedStructuralPackage(root, packagePath, datasetId)).toThrow(/ENOENT/)
  })

  it('preserves repeated known membership and absence', () => {
    const { root } = fixture()
    for (let i = 0; i < 2; i += 1) {
      expect(hasVerifiedStructuralPackage(root, packagePath, datasetId)).toBe(true)
      expect(hasVerifiedStructuralPackage(root, 'Dungeons/Content/Missing', datasetId)).toBe(false)
    }
  })
})

import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { gzipSync } from 'node:zlib'
import { afterEach, describe, expect, it } from 'vitest'
import type { RawTrace } from '../src/domain/formal/rawProjection.ts'
import type { HorizontalRawFactInventory } from '../scripts/game-data-horizontal-fact-inventory.ts'
import { readHorizontalRawFactInventory, resolveDirectHorizontalSourceFact } from '../scripts/formal-value-horizontal-source.ts'
import { readVerifiedStructuralShard, verifyValueRawTraceProvenance, RAW_STRUCTURAL_INVENTORY_MANIFEST } from '../scripts/formal-value-source-provenance.ts'

const repositoryRoot = fs.realpathSync('.')
const artifact = JSON.parse(fs.readFileSync('research/domain/formal/value-availability-v2.json', 'utf8')) as {
  provenance: { evidence: { provenance: RawTrace }[] }
}
const traces = artifact.provenance.evidence.map(({ provenance }) => provenance)
  .filter(({ artifactPath }) => artifactPath.includes('/shards/'))
const sources = [...new Map(traces.map((trace) => [trace.packagePath, trace])).values()]
type Fact = { factId: string; source: { sourcePackage: string; propertyPointer: string; sourceShardUncompressedSha256: string } }
type Reference = { sourceFactId: string }
const inventory = readHorizontalRawFactInventory(repositoryRoot) as unknown as {
  items: { category: string; catalogId: string; rawCandidate: { candidates: { packagePath: string; facts: Reference[] }[] } }[]
  sourceFacts: Fact[]
}
const selected = (['melee', 'ranged', 'artifact'] as const).map((category) => {
  for (const item of inventory.items.filter((item) => item.category === category)) {
    for (const candidate of item.rawCandidate.candidates) {
      const trace = sources.find((trace) => trace.packagePath === candidate.packagePath)
      if (!trace) continue
      const fact = inventory.sourceFacts.find((fact) => fact.source.sourcePackage === candidate.packagePath
        && `/packages/${trace.nodePointer.split('/')[2]}${fact.source.propertyPointer}` === trace.nodePointer)
      const reference = candidate.facts.find((reference) => reference.sourceFactId === fact?.factId)
      if (!fact || !reference) continue
      return { category, trace, fact, reference, request: {
        category, catalogId: item.catalogId, candidatePackage: candidate.packagePath, sourceFactId: fact.factId,
      } }
    }
  }
  throw new Error(`No committed Structural Value occurrence for ${category}`)
})
const roots: string[] = []
const hash = (bytes: Buffer) => crypto.createHash('sha256').update(bytes).digest('hex')
afterEach(() => { for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true }) })

function fixture(source: typeof selected[number]) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'formal-value-structural-parser-'))
  roots.push(root)
  const verified = readVerifiedStructuralShard(repositoryRoot, source.trace.artifactPath, source.trace.datasetId)
  // Keep the real package and occurrence; rebind only its shard index and byte hashes.
  const pkg = structuredClone(verified.shard.packages[Number(source.trace.nodePointer.split('/')[2])]!)
  const manifest = structuredClone(verified.manifest)
  const meta = structuredClone(verified.meta)
  Object.assign(manifest, { shards: [meta] })
  const fact = structuredClone(source.fact)
  const minimalInventory = {
    inventoryIdentity: { datasetId: source.trace.datasetId },
    items: [{ category: source.category, catalogId: source.request.catalogId, rawCandidate: {
      candidates: [{ packagePath: pkg.path, facts: [source.reference] }],
    } }],
    sourceFacts: [fact],
  } as unknown as HorizontalRawFactInventory
  const trace = { ...source.trace, nodePointer: source.trace.nodePointer.replace(/^\/packages\/\d+\//, '/packages/0/') }
  const write = () => {
    const bytes = Buffer.from(JSON.stringify({ schemaVersion: 1, packages: [pkg], edges: [] }))
    const compressed = gzipSync(bytes)
    Object.assign(meta, { compressedBytes: compressed.length, compressedSha256: hash(compressed),
      uncompressedBytes: bytes.length, uncompressedSha256: hash(bytes), packageCount: 1, edgeCount: 0 })
    Object.assign(fact.source, { sourceShardUncompressedSha256: meta.uncompressedSha256 })
    const file = path.join(root, trace.artifactPath)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, compressed)
    fs.writeFileSync(path.join(root, RAW_STRUCTURAL_INVENTORY_MANIFEST), JSON.stringify(manifest))
  }
  write()
  return { root, pkg, manifest, trace, minimalInventory, write }
}

describe('Structural Value parser provenance', () => {
  it('resolves a committed occurrence from every eligible Structural Value package', () => {
    expect(traces).toHaveLength(1083)
    expect(sources).toHaveLength(60)
    for (const trace of sources) expect(verifyValueRawTraceProvenance(repositoryRoot, trace).sourceKind).toBe('structural-inventory-shard')
  })

  describe.each(selected)('$category', (source) => {
    it('preserves both Value readers with compatible provenance', () => {
      const f = fixture(source)
      expect(verifyValueRawTraceProvenance(f.root, f.trace).sourceKind).toBe('structural-inventory-shard')
      expect(resolveDirectHorizontalSourceFact(f.root, f.minimalInventory, source.request).raw).toEqual(f.trace)
    })

    describe.each(['manifest', 'package'] as const)('%s parser', (level) => {
      it.each([
        ['wrong ID', { id: 'other-parser', schemaVersion: 1 }],
        ['missing ID', { schemaVersion: 1 }],
        ['old schema', { id: 'ue4-package-property-parser', schemaVersion: 0 }],
        ['future schema', { id: 'ue4-package-property-parser', schemaVersion: 99 }],
        ['missing schema', { id: 'ue4-package-property-parser' }],
        ['missing parser', undefined],
        ['null parser', null],
      ])('rejects %s in both readers after warming the shard cache', (_label, parser) => {
        const f = fixture(source)
        verifyValueRawTraceProvenance(f.root, f.trace)
        resolveDirectHorizontalSourceFact(f.root, f.minimalInventory, source.request)
        const container = level === 'manifest' ? f.manifest.scope : f.pkg.parse
        Object.assign(container, { parser })
        f.write()
        expect(() => verifyValueRawTraceProvenance(f.root, f.trace)).toThrow(/Unsupported Structural Value .* parser/)
        expect(() => resolveDirectHorizontalSourceFact(f.root, f.minimalInventory, source.request)).toThrow(/Unsupported Structural Value .* parser/)
      })
    })
  })
})

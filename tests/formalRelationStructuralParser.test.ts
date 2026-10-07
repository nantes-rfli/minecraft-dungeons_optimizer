import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { gzipSync, gunzipSync } from 'node:zlib'
import { afterEach, describe, expect, it } from 'vitest'
import { formalIdentityDefinitions } from '../src/domain/formal/identityDefinitions.ts'
import type { FormalIdentityEvidenceArtifact, RawObservationEvidenceRecord } from '../src/domain/formal/identityEvidence.ts'
import type { FormalSerializedRelationArtifact } from '../src/domain/formal/serializedRelation.ts'
import { readHorizontalRawFactInventory } from '../scripts/formal-value-horizontal-source.ts'
import { readVerifiedStructuralShard, RAW_STRUCTURAL_INVENTORY_DIRECTORY, RAW_STRUCTURAL_INVENTORY_MANIFEST } from '../scripts/formal-value-source-provenance.ts'
import { resolveHorizontalRelationSource, resolveHorizontalScopeRelationSource, resolveHorizontalSporeGrenadeRelationSource,
  type HorizontalRelationSourceRequest, type ScopeRelationSourceRequest } from '../scripts/formal-relation-horizontal-source.ts'
import type { JsonRecord } from '../scripts/game-data-horizontal-fact-inventory.ts'

const repositoryRoot = fs.realpathSync('.')
const inventory = readHorizontalRawFactInventory(repositoryRoot)
const identity = JSON.parse(fs.readFileSync('research/domain/formal/identity-evidence-v1.json', 'utf8')) as FormalIdentityEvidenceArtifact
const artifact = JSON.parse(fs.readFileSync('research/domain/formal/serialized-relation-v2.json', 'utf8')) as FormalSerializedRelationArtifact
const record = (v: unknown) => v as JsonRecord
const rows = (v: unknown) => v as JsonRecord[]
const properties = { 'gear-actor': 'GearActor', effect: 'Effect', 'item-actor': 'ItemActorClass',
  'spin-wheel-actor': 'SpinWheelActorClass', 'fish-hook': 'FishingHookActorClass',
  'spore-grenade-spawn-class': 'ProjectileItemSpec.ClassesToSpawn[0]' }
const typedTargetFamilies = ['item-actor', 'spin-wheel-actor', 'fish-hook', 'spore-grenade-spawn-class']
const families = ['attack-sequence', 'projectile', ...Object.keys(properties)]
const samples = families.map((family) => {
  const relation = artifact.semantic.relations.find((r) => r.relationRef.endsWith(`:${family}@1`)
    && !['fighters-bindings', 'scatter-crossbow', 'battle-robe', 'death-cap-mushroom'].includes(r.sourceDomainId))!
  const evidence = artifact.provenance.evidence.find((e) => relation.evidenceRefs.includes(e.id))!
  const definition = formalIdentityDefinitions.find((d) => d.assertion.domainId === relation.sourceDomainId)!
  const semantic = identity.semantic.identities.find((i) => i.assertionId === definition.assertion.id)!
  const identityEvidence = identity.provenance.evidence.filter((e): e is RawObservationEvidenceRecord =>
    e.kind === 'raw-observation' && semantic.resolution.evidenceRefs.includes(e.id))
  const item = inventory.items.find((i) => i.catalogId === relation.sourceDomainId)!
  const candidate = rows(record(item.rawCandidate).candidates).find((c) => c.packagePath === evidence.provenance.packagePath)!
  const edgeId = record(evidence.observed).id as string
  return { family, relation, evidence, item, candidate, request: {
    category: item.category, catalogId: item.catalogId, candidatePackage: evidence.provenance.packagePath,
    edgeId, definition, identity: semantic, identityEvidence,
    sourceIndex: 'sourceIndex' in relation.occurrence ? relation.occurrence.sourceIndex : undefined,
    relationKind: family, propertyPath: properties[family as keyof typeof properties],
  } }
})
const packageShards = new Map<string, string>()
const roots: string[] = []
const hash = (b: Buffer) => crypto.createHash('sha256').update(b).digest('hex')
afterEach(() => { for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true }) })

function fixture(sample: typeof samples[number]) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'relation-parser-'))
  roots.push(root)
  const verified = readVerifiedStructuralShard(repositoryRoot, sample.evidence.provenance.artifactPath, sample.evidence.provenance.datasetId)
  const manifest = structuredClone(verified.manifest)
  const dir = path.join(root, RAW_STRUCTURAL_INVENTORY_DIRECTORY)
  fs.mkdirSync(path.join(dir, 'shards'), { recursive: true })
  for (const meta of manifest.shards) fs.symlinkSync(path.join(repositoryRoot, RAW_STRUCTURAL_INVENTORY_DIRECTORY, meta.path), path.join(dir, meta.path))
  const item = structuredClone(sample.item)
  const candidate = rows(record(item.rawCandidate).candidates).find((c) => c.packagePath === sample.request.candidatePackage)!
  const value = { ...inventory, items: [item] }
  const writeManifest = () => fs.writeFileSync(path.join(root, RAW_STRUCTURAL_INVENTORY_MANIFEST), JSON.stringify(manifest))
  const targetPath = record(sample.evidence.observed).targetPackage as string
  const selectedPaths = [sample.request.candidatePackage, targetPath]
  const selectedShards = new Set([verified.meta.path])
  packageShards.set(sample.request.candidatePackage, verified.meta.path)
  if (!packageShards.has(targetPath)) {
    let low = 0
    let high = manifest.shards.length - 1
    while (low <= high) {
      const middle = Math.floor((low + high) / 2)
      const meta = manifest.shards[middle]!
      const { shard } = readVerifiedStructuralShard(repositoryRoot, `${RAW_STRUCTURAL_INVENTORY_DIRECTORY}/${meta.path}`)
      if (targetPath.localeCompare(shard.packages[0]!.path) < 0) high = middle - 1
      else if (targetPath.localeCompare(shard.packages.at(-1)!.path) > 0) low = middle + 1
      else { packageShards.set(targetPath, meta.path); break }
    }
  }
  selectedShards.add(packageShards.get(targetPath)!)
  const writeShard = (relativePath: string, shard: JsonRecord) => {
    const meta = manifest.shards.find((m) => m.path === relativePath)!
    const bytes = Buffer.from(JSON.stringify(shard))
    const compressed = gzipSync(bytes)
    const file = path.join(dir, relativePath)
    fs.unlinkSync(file)
    fs.writeFileSync(file, compressed)
    Object.assign(meta, { compressedBytes: compressed.length, compressedSha256: hash(compressed),
      uncompressedBytes: bytes.length, uncompressedSha256: hash(bytes),
      packageCount: rows(shard.packages).length, edgeCount: rows(shard.edges).length })
    if (relativePath === verified.meta.path) record(candidate.candidatePackageProvenance).sourceShardUncompressedSha256 = meta.uncompressedSha256
    writeManifest()
  }
  // Retain the real edge and consumed package fields; typed readers keep full
  // class/CDO data. Membership-only targets need no unrelated decoded payload.
  for (const relativePath of selectedShards) {
    const { shard } = readVerifiedStructuralShard(repositoryRoot, `${RAW_STRUCTURAL_INVENTORY_DIRECTORY}/${relativePath}`)
    writeShard(relativePath, { schemaVersion: 1,
      packages: structuredClone(shard.packages.filter((p) => selectedPaths.includes(p.path)).map((p) =>
        typedTargetFamilies.includes(sample.family) ? p : { path: p.path, packageHash: p.packageHash, parse: p.parse })),
      edges: structuredClone(shard.edges.filter((e) => e.sourcePackage === sample.request.candidatePackage
        || typedTargetFamilies.includes(sample.family) && e.sourcePackage === targetPath)) })
  }
  Object.assign(manifest, { shards: manifest.shards.filter((meta) => selectedShards.has(meta.path)) })
  const mutatePackage = (packagePath: string, parser: unknown) => {
    const relativePath = packageShards.get(packagePath)!
    const shard = JSON.parse(gunzipSync(fs.readFileSync(path.join(dir, relativePath))).toString())
    shard.packages.find((p: { path: string }) => p.path === packagePath).parse.parser = parser
    writeShard(relativePath, shard)
  }
  writeManifest()
  const resolve = () => sample.family === 'attack-sequence' || sample.family === 'projectile'
    ? resolveHorizontalRelationSource(root, value, sample.request as HorizontalRelationSourceRequest)
    : sample.family === 'spore-grenade-spawn-class'
      ? resolveHorizontalSporeGrenadeRelationSource(root, value, sample.request as Parameters<typeof resolveHorizontalSporeGrenadeRelationSource>[2])
      : resolveHorizontalScopeRelationSource(root, value, sample.request as ScopeRelationSourceRequest)
  return { resolve, manifest, writeManifest, mutatePackage }
}

const badParsers = [
  ['wrong ID', { id: 'other-parser', schemaVersion: 1 }],
  ['old schema', { id: 'ue4-package-property-parser', schemaVersion: 0 }],
  ['future schema', { id: 'ue4-package-property-parser', schemaVersion: 99 }],
  ['missing ID', { schemaVersion: 1 }],
  ['missing schema', { id: 'ue4-package-property-parser' }],
  ['missing parser', undefined], ['null parser', null],
] as const

describe.each(samples)('Structural Relation parser: $family', (sample) => {
  it('preserves the exact committed edge and relation identity', () => {
    const f = fixture(sample)
    const result = f.resolve()
    expect(result.relationRef).toBe(sample.relation.relationRef)
    expect(result.occurrence).toEqual(sample.relation.occurrence)
    expect(result.structuralEdge).toEqual(sample.evidence.observed)
  })
  describe.each(['manifest', 'source'] as const)('%s', (level) => {
    it.each(badParsers)('rejects %s after warming the caches', (_label, parser) => {
      const f = fixture(sample)
      f.resolve()
      if (level === 'manifest') { Object.assign(f.manifest.scope, { parser }); f.writeManifest() }
      else f.mutatePackage(sample.request.candidatePackage, parser)
      expect(f.resolve).toThrow(/Unsupported Structural Relation .* parser/)
    })
  })
  if (typedTargetFamilies.includes(sample.family)) {
    it.each(badParsers)('rejects typed target %s after warming the caches', (_label, parser) => {
      const f = fixture(sample)
      f.resolve()
      f.mutatePackage(record(sample.evidence.observed).targetPackage as string, parser)
      expect(f.resolve).toThrow(/Unsupported Structural Relation .* parser/)
    })
  }
})

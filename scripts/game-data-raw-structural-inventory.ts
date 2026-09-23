import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { gzipSync } from 'node:zlib'
import type { GameDataSourceProvenance, JsonValue } from '../src/research/gameDataProvenance.ts'
import { PackageObjectResolver } from '../src/research/ue4/objectResolver.ts'
import { parseUePackage } from '../src/research/ue4/packageReader.ts'
import type {
  BinaryByteRange, ParsedProperty, ParsedUePackage, ResolvedPackageIndex, UeDiagnostic,
  UeExportEntry, UeFName, UeImportEntry,
} from '../src/research/ue4/packageTypes.ts'
import { assertSafeAssetPath, hashLogicalAsset, localDatasetRoot } from './game-data-package-source.ts'

export const RAW_STRUCTURAL_INVENTORY_SCHEMA_VERSION = 1 as const
export const RAW_STRUCTURAL_INVENTORY_PATH = 'research/raw/game-data-raw-structural-inventory/manifest.json' as const
export const RAW_STRUCTURAL_REPORT_PATH = 'docs/game-data-raw-structural-inventory.md' as const
export const RAW_STRUCTURAL_SHARD_PACKAGE_LIMIT = 64 as const

const CODE_PATHS = [
  'scripts/game-data-raw-structural-inventory.ts',
  'scripts/game-data-package-source.ts',
  'src/research/ue4/binaryReader.ts',
  'src/research/ue4/objectResolver.ts',
  'src/research/ue4/packageReader.ts',
  'src/research/ue4/packageTypes.ts',
  'src/research/ue4/propertyReader.ts',
  'generated/equipment-icons/manifest.json',
] as const

type SeedStatus = 'exact' | 'provisional' | 'ambiguous' | 'not-found'
type DecodeState = 'decoded' | 'unsupported' | 'parse-failed'
type PackageParseState = 'parsed' | 'parse-failed'
type EdgeKind = 'import' | 'class' | 'super' | 'template' | 'outer' | 'object-property' | 'soft-object-property'
type StopReason = 'followed' | 'already-visited' | 'package-local-reference' | 'null-reference' | 'unresolved-package-index' | 'invalid-package-index' | 'native-boundary' | 'outside-game-boundary' | 'missing-target' | 'parser-boundary'

interface IconEntry {
  readonly category: string
  readonly catalogId: string
  readonly sourceAsset?: string
  readonly sourcePackage?: string
  readonly status: string
  readonly matchMethod?: string
  readonly candidates?: readonly string[]
  readonly notes?: string
}

interface IconManifest {
  readonly schemaVersion: number
  readonly gameVersion: string
  readonly entries: readonly IconEntry[]
}

interface SourceFileIdentity {
  readonly path: string
  readonly size: number
  readonly sha256: string
}

interface CodeIdentity {
  readonly algorithm: 'sha256-path-content-v1'
  readonly value: string
  readonly files: readonly { readonly path: typeof CODE_PATHS[number]; readonly sha256: string }[]
}

interface SeedCandidate {
  readonly packagePath: string
  readonly objectName: string
  readonly role: 'instance' | 'storable' | 'actor' | 'other-blueprint'
  readonly evidence: readonly string[]
}

interface CatalogSeed {
  readonly catalogId: string
  readonly category: string
  readonly status: SeedStatus
  readonly matchBasis: readonly string[]
  readonly sourceAsset?: string
  readonly sourcePackage?: string
  readonly candidates: readonly SeedCandidate[]
  readonly notes?: string
}

interface SourceOccurrence {
  readonly kind: 'import-table' | 'export-table' | 'cdo-property'
  readonly sourceObject?: string
  readonly propertyPath?: string
  readonly arrayIndex?: number
  readonly serializedField?: string
  readonly rawPackageIndex: number
  readonly sourceRange?: { readonly file: string; readonly start: number; readonly end: number }
  readonly valueRange?: { readonly file: string; readonly start: number; readonly end: number }
}

interface StructuralEdge {
  readonly id: string
  readonly kind: EdgeKind
  readonly sourcePackage: string
  readonly sourceOccurrence: SourceOccurrence
  readonly targetObject?: string
  readonly targetPackageName?: string
  readonly targetPackage?: string
  readonly targetRawPackageIndex: number
  readonly targetKind: ResolvedPackageIndex['kind'] | 'soft-object'
  readonly traversal: {
    readonly stopReason: StopReason
    readonly targetDepth?: number
  }
}

interface StructuralProperty {
  readonly order: number
  readonly name: UeFName
  readonly type: UeFName
  readonly arrayIndex: number
  readonly path: string
  readonly serializedSize: number
  readonly sourceRange: { readonly file: string; readonly start: number; readonly end: number }
  readonly valueRange: { readonly file: string; readonly start: number; readonly end: number }
  readonly metadata?: ParsedProperty['metadata']
  readonly decoding: {
    readonly state: DecodeState
    readonly value?: JsonValue
    readonly properties?: readonly StructuralProperty[]
    readonly elements?: readonly {
      readonly index: number
      readonly decoding: { readonly state: DecodeState }
      readonly value?: JsonValue
      readonly properties?: readonly StructuralProperty[]
    }[]
  }
}

interface StructuralObject {
  readonly exportIndex: number
  readonly rawPackageIndex: number
  readonly objectName: UeFName
  readonly objectFlags: number
  readonly isClassDefaultObject: boolean
  readonly serialized: { readonly serialOffset: number; readonly serialSize: number; readonly sourceRange: { readonly file: string; readonly start: number; readonly end: number } }
  readonly references: {
    readonly class: ResolvedPackageIndex
    readonly super: ResolvedPackageIndex
    readonly template: ResolvedPackageIndex
    readonly outer: ResolvedPackageIndex
  }
}

interface StructuralInheritanceChain {
  readonly sourceObject: string
  readonly hops: readonly {
    readonly edgeId: string
    readonly targetObject?: string
    readonly targetPackageName?: string
    readonly targetPackage?: string
    readonly rawPackageIndex: number
  }[]
  readonly stopReason: 'no-super-reference' | 'native-boundary' | 'outside-game-boundary' | 'missing-target' | 'parser-boundary' | 'target-export-unavailable' | 'cycle-detected'
}

interface StructuralPackage {
  readonly path: string
  readonly gamePackageName: string
  readonly packageHash?: { readonly algorithm: 'sha256-path-content-v1'; readonly value: string }
  readonly sourceFiles: readonly SourceFileIdentity[]
  readonly parse: {
    readonly state: PackageParseState
    readonly parser: { readonly id: 'ue4-package-property-parser'; readonly schemaVersion: 1 }
    readonly codeIdentity: CodeIdentity
    readonly runId: string
    readonly summary?: ParsedUePackage['summary']
    readonly failure?: { readonly code?: string; readonly message: string }
  }
  readonly imports: readonly {
    readonly index: number
    readonly rawPackageIndex: number
    readonly classPackage: UeFName
    readonly className: UeFName
    readonly outerIndex: number
    readonly objectName: UeFName
    readonly sourceRange?: { readonly file: string; readonly start: number; readonly end: number }
  }[]
  readonly exports: readonly StructuralObject[]
  readonly inheritanceChains: readonly StructuralInheritanceChain[]
  readonly cdoPropertyInventory: readonly { readonly exportIndex: number; readonly objectName: string; readonly properties: readonly StructuralProperty[] }[]
  readonly diagnostics: readonly UeDiagnostic[]
  readonly unavailableRanges: readonly {
    readonly file: string
    readonly start?: number
    readonly end?: number
    readonly state: 'unsupported' | 'parse-failed' | 'not-extracted'
    readonly reason: string
  }[]
  readonly payloadCoverage: {
    readonly classDefaultObjectsDecoded: number
    readonly nonCdoExportsNotDecoded: number
    readonly tableLikePackage: boolean
    readonly tableRows: 'not-decoded-by-current-parser' | 'not-applicable'
  }
  readonly traversal: { readonly depth: number; readonly stopReason: 'references-followed' | 'no-followable-references' | 'parser-boundary' }
}

export interface RawStructuralInventory {
  readonly schemaVersion: 1
  readonly artifactKind: 'raw-structural-inventory-with-dependency-graph'
  readonly scope: {
    readonly game: 'Minecraft Dungeons'
    readonly claimedGameVersion: string
    readonly claimedGameVersionStatus: string
    readonly dataset: { readonly id: string; readonly sourceFingerprint: GameDataSourceProvenance['dataset']['sourceFingerprint'] }
    readonly parser: { readonly id: 'ue4-package-property-parser'; readonly schemaVersion: 1 }
    readonly codeIdentity: CodeIdentity
    readonly traversalPolicy: 'breadth-first-over-serialized-reference-edges-to-locally-present-Game-packages; no-fixed-depth-limit'
    readonly semanticInterpretation: 'not-applied'
    readonly rawBinaryBytes: 'not-committed'
    readonly generatedFrom: readonly string[]
  }
  readonly catalogSeeds: readonly CatalogSeed[]
  readonly packages: readonly StructuralPackage[]
  readonly edges: readonly StructuralEdge[]
  readonly boundaries: {
    readonly native: readonly { readonly packageName: string; readonly referenceCount: number }[]
    readonly parser: readonly { readonly packagePath: string; readonly reason: string }[]
    readonly missingTargets: readonly { readonly packageName: string; readonly sourceEdgeIds: readonly string[] }[]
    readonly outsideGameScope: readonly { readonly packageName: string; readonly referenceCount: number }[]
  }
  readonly summary: {
    readonly seedCount: number
    readonly candidateSeedCount: number
    readonly visitedPackageCount: number
    readonly parsedPackageCount: number
    readonly edgeCount: number
    readonly resolvedTargetCount: number
    readonly unresolvedTargetCount: number
    readonly nativeBoundaryCount: number
    readonly parserBoundaryCount: number
    readonly missingTargetCount: number
    readonly dataTableOrCurveReachedCount: number
    readonly seedStatusCounts: Readonly<Record<SeedStatus, number>>
    readonly cycleOrReuseEdgeCount: number
    readonly inheritanceChainCount: number
    readonly inheritanceCycleCount: number
  }
}

export interface RawStructuralInventoryShard {
  readonly schemaVersion: 1
  readonly packages: readonly StructuralPackage[]
  readonly edges: readonly StructuralEdge[]
}

export interface RawStructuralInventoryManifest {
  readonly schemaVersion: 1
  readonly artifactKind: 'raw-structural-inventory-with-dependency-graph'
  readonly representation: 'canonical-json-in-deterministic-gzip-shards'
  readonly scope: RawStructuralInventory['scope']
  readonly catalogSeeds: RawStructuralInventory['catalogSeeds']
  readonly boundaries: RawStructuralInventory['boundaries']
  readonly summary: RawStructuralInventory['summary']
  readonly shards: readonly {
    readonly path: string
    readonly packageCount: number
    readonly edgeCount: number
    readonly uncompressedBytes: number
    readonly uncompressedSha256: string
    readonly compressedBytes: number
    readonly compressedSha256: string
  }[]
}

interface ParsedNode {
  readonly path: string
  readonly depth: number
  readonly package: StructuralPackage
  readonly edges: StructuralEdge[]
}

export interface BreadthFirstReference {
  readonly id: string
  readonly targetPath?: string
}

export interface BreadthFirstWalkResult {
  readonly visitedPaths: readonly string[]
  readonly depths: Readonly<Record<string, number>>
  readonly discoveryEdgeIds: ReadonlySet<string>
}

interface TargetDescriptor {
  readonly objectPath?: string
  readonly packageName?: string
  readonly packagePath?: string
  readonly kind: ResolvedPackageIndex['kind'] | 'soft-object'
  readonly rawPackageIndex: number
}

const rawJson = (file: string) => JSON.parse(fs.readFileSync(file, 'utf8')) as unknown
const sha256 = (bytes: Uint8Array) => crypto.createHash('sha256').update(bytes).digest('hex')
const compare = (left: string, right: string) => left.localeCompare(right)

export function buildRawStructuralInventory(repositoryRoot: string, provenance: GameDataSourceProvenance): RawStructuralInventory {
  const datasetRoot = localDatasetRoot(repositoryRoot)
  const manifest = rawJson(path.join(repositoryRoot, 'generated/equipment-icons/manifest.json')) as IconManifest
  const codeIdentity = makeCodeIdentity(repositoryRoot)
  const seeds = discoverCatalogSeeds(datasetRoot, manifest)
  const seedPaths = [...new Set(seeds.flatMap((seed) => seed.candidates.map((candidate) => candidate.packagePath)))].sort(compare)
  const discovered = new Map<string, ParsedNode>()
  const traversal = breadthFirstPackageWalk(seedPaths, (packagePath, depth) => {
    const node = readStructuralPackage(repositoryRoot, provenance, codeIdentity, packagePath, depth)
    discovered.set(packagePath, node)
    return node.edges.map((edge) => ({ id: edge.id, targetPath: edge.targetPackage }))
  }, (targetPath) => isPackageAvailable(datasetRoot, targetPath))
  const discoveryEdges = traversal.discoveryEdgeIds

  const edges = [...discovered.values()].flatMap((node) => node.edges.map((edge) => {
    let stopReason: StopReason = 'followed'
    if (edge.targetKind === 'null') stopReason = 'null-reference'
    else if (edge.targetKind === 'invalid') stopReason = 'invalid-package-index'
    else if (edge.targetPackage === edge.sourcePackage) stopReason = 'package-local-reference'
    else if (edge.targetPackageName?.startsWith('/Script/')) stopReason = 'native-boundary'
    else if (!edge.targetPackageName) stopReason = 'unresolved-package-index'
    else if (!edge.targetPackageName.startsWith('/Game/')) stopReason = 'outside-game-boundary'
    else if (!edge.targetPackage || !isPackageAvailable(datasetRoot, edge.targetPackage)) stopReason = 'missing-target'
    else if (discovered.get(edge.targetPackage ?? '')?.package.parse.state === 'parse-failed') stopReason = 'parser-boundary'
    else if (!discoveryEdges.has(edge.id)) stopReason = 'already-visited'
    return { ...edge, traversal: { stopReason, ...(discovered.get(edge.targetPackage ?? '') ? { targetDepth: discovered.get(edge.targetPackage!)!.depth } : {}) } }
  })).sort((a, b) => compare(a.sourcePackage, b.sourcePackage) || compare(a.id, b.id))
  const inheritanceByPackage = buildInheritanceChains(edges, discovered)
  const packages = [...discovered.values()].map((node) => ({
    ...node.package,
    inheritanceChains: inheritanceByPackage.get(node.path) ?? [],
  })).sort((a, b) => compare(a.path, b.path))
  const nativeCounts = countBy(edges.filter((edge) => edge.traversal.stopReason === 'native-boundary'), (edge) => edge.targetPackageName!)
  const missingByPackage = new Map<string, string[]>()
  for (const edge of edges.filter((item) => item.traversal.stopReason === 'missing-target')) {
    const target = edge.targetPackageName ?? '[unresolved-package]'
    const values = missingByPackage.get(target) ?? []
    values.push(edge.id)
    missingByPackage.set(target, values)
  }
  const parserBoundaries = packages.flatMap((pkg) => {
    const reasons = rawStructuralParserBoundaryReasons(pkg)
    return reasons.length ? [{ packagePath: pkg.path, reason: reasons.join(',') }] : []
  })
  const statuses = { exact: 0, provisional: 0, ambiguous: 0, 'not-found': 0 } satisfies Record<SeedStatus, number>
  for (const seed of seeds) statuses[seed.status] += 1
  const resolvedTargetCount = edges.filter((edge) => edge.targetKind !== 'null' && edge.targetKind !== 'invalid' && Boolean(edge.targetPackageName || edge.targetPackage)).length
  const unresolvedTargetCount = edges.filter((edge) => ['missing-target', 'unresolved-package-index', 'invalid-package-index'].includes(edge.traversal.stopReason)).length
  const dataTableOrCurveReachedCount = packages.filter((pkg) => pkg.payloadCoverage.tableLikePackage).length
  const summary = {
    seedCount: seeds.length,
    candidateSeedCount: seeds.reduce((count, seed) => count + seed.candidates.length, 0),
    visitedPackageCount: packages.length,
    parsedPackageCount: packages.filter((pkg) => pkg.parse.state === 'parsed').length,
    edgeCount: edges.length,
    resolvedTargetCount,
    unresolvedTargetCount,
    nativeBoundaryCount: Object.keys(nativeCounts).length,
    parserBoundaryCount: parserBoundaries.length,
    missingTargetCount: missingByPackage.size,
    dataTableOrCurveReachedCount,
    seedStatusCounts: statuses,
    cycleOrReuseEdgeCount: edges.filter((edge) => edge.traversal.stopReason === 'already-visited').length,
    inheritanceChainCount: packages.reduce((count, pkg) => count + pkg.inheritanceChains.length, 0),
    inheritanceCycleCount: packages.reduce((count, pkg) => count + pkg.inheritanceChains.filter((chain) => chain.stopReason === 'cycle-detected').length, 0),
  }

  return {
    schemaVersion: 1,
    artifactKind: 'raw-structural-inventory-with-dependency-graph',
    scope: {
      game: 'Minecraft Dungeons', claimedGameVersion: provenance.dataset.claimedVersion,
      claimedGameVersionStatus: provenance.verification.claimedVersion.status,
      dataset: { id: provenance.dataset.id, sourceFingerprint: provenance.dataset.sourceFingerprint },
      parser: { id: 'ue4-package-property-parser', schemaVersion: 1 }, codeIdentity,
      traversalPolicy: 'breadth-first-over-serialized-reference-edges-to-locally-present-Game-packages; no-fixed-depth-limit',
      semanticInterpretation: 'not-applied', rawBinaryBytes: 'not-committed',
      generatedFrom: ['generated/equipment-icons/manifest.json', 'research/sources/game-data-source-provenance.json', ...CODE_PATHS],
    },
    catalogSeeds: seeds,
    packages,
    edges,
    boundaries: {
      native: Object.entries(nativeCounts).sort(([a], [b]) => compare(a, b)).map(([packageName, referenceCount]) => ({ packageName, referenceCount })),
      parser: parserBoundaries,
      missingTargets: [...missingByPackage].sort(([a], [b]) => compare(a, b)).map(([packageName, sourceEdgeIds]) => ({ packageName, sourceEdgeIds: sourceEdgeIds.sort(compare) })),
      outsideGameScope: Object.entries(countBy(edges.filter((edge) => edge.traversal.stopReason === 'outside-game-boundary' && edge.targetPackageName), (edge) => edge.targetPackageName!))
        .sort(([a], [b]) => compare(a, b)).map(([packageName, referenceCount]) => ({ packageName, referenceCount })),
    },
    summary,
  }
}

function discoverCatalogSeeds(datasetRoot: string, manifest: IconManifest): CatalogSeed[] {
  return manifest.entries.map((entry) => {
    const candidates: SeedCandidate[] = []
    const matchBasis = [`icon-manifest:${entry.status}`, ...(entry.matchMethod ? [`icon-match-method:${entry.matchMethod}`] : [])]
    if (entry.sourceAsset) matchBasis.push(`source-asset:${entry.sourceAsset}`)
    if (entry.sourcePackage) {
      const packageFolder = safeDatasetPath(entry.sourcePackage)
      if (packageFolder && fs.existsSync(path.join(datasetRoot, packageFolder)) && fs.statSync(path.join(datasetRoot, packageFolder)).isDirectory()) {
        for (const fileName of fs.readdirSync(path.join(datasetRoot, packageFolder)).sort(compare)) {
          if (!fileName.startsWith('BP_') || !fileName.endsWith('.uasset')) continue
          const base = fileName.slice(0, -'.uasset'.length)
          const role = seedRole(base)
          if (!role) continue
          candidates.push({ packagePath: `${entry.sourcePackage}/${base}`, objectName: `${base}_C`, role, evidence: [`sibling-of-source-package:${entry.sourcePackage}`, `local-file:${packageFolder}/${fileName}`] })
        }
      }
    }
    const instances = candidates.filter((candidate) => candidate.role === 'instance')
    const storables = candidates.filter((candidate) => candidate.role === 'storable')
    const selected = instances.length ? instances : storables.length ? storables : candidates.filter((candidate) => candidate.role === 'actor')
    const status = classifySeedCandidateStatus(selected, entry.matchMethod)
    if (selected.length && selected[0]?.role !== 'instance') matchBasis.push(`seed-class-fallback:${selected[0]?.role}`)
    if (selected.length > 1) matchBasis.push('multiple-equally-ranked-raw-candidates-retained')
    if (!entry.sourcePackage) matchBasis.push('catalog-entry-has-no-local-source-package')
    else if (!selected.length) matchBasis.push('no-eligible-local-blueprint-seed-in-source-package')
    return {
      catalogId: entry.catalogId, category: entry.category, status,
      matchBasis: matchBasis.sort(compare),
      ...(entry.sourceAsset ? { sourceAsset: entry.sourceAsset } : {}),
      ...(entry.sourcePackage ? { sourcePackage: entry.sourcePackage } : {}),
      candidates: selected.sort((a, b) => compare(a.packagePath, b.packagePath)),
      ...(entry.notes ? { notes: entry.notes } : {}),
    }
  }).sort((a, b) => compare(a.category, b.category) || compare(a.catalogId, b.catalogId))
}

export function classifySeedCandidateStatus(
  candidates: readonly Pick<SeedCandidate, 'role'>[],
  matchMethod: string | undefined,
): SeedStatus {
  if (candidates.length === 0) return 'not-found'
  if (candidates.length > 1) return 'ambiguous'
  const uniqueDirectMatch = candidates[0]?.role === 'instance'
    && ['asset-semantic-name', 'catalog-internal-id'].includes(matchMethod ?? '')
  return uniqueDirectMatch ? 'exact' : 'provisional'
}

export function breadthFirstPackageWalk<T extends BreadthFirstReference>(
  seedPaths: readonly string[],
  referencesFrom: (packagePath: string, depth: number) => readonly T[],
  canVisit: (targetPath: string) => boolean = () => true,
): BreadthFirstWalkResult {
  const queue = [...new Set(seedPaths)].sort(compare).map((packagePath) => ({ packagePath, depth: 0 }))
  const enqueued = new Set(queue.map((item) => item.packagePath))
  const visited = new Set<string>()
  const depths: Record<string, number> = {}
  const discoveryEdgeIds = new Set<string>()
  const visitedPaths: string[] = []
  while (queue.length > 0) {
    const current = queue.shift()!
    if (visited.has(current.packagePath)) continue
    visited.add(current.packagePath)
    depths[current.packagePath] = current.depth
    visitedPaths.push(current.packagePath)
    const references = [...referencesFrom(current.packagePath, current.depth)]
      .filter((reference) => reference.targetPath && canVisit(reference.targetPath))
      .sort((a, b) => compare(a.targetPath!, b.targetPath!) || compare(a.id, b.id))
    const firstByTarget = new Map<string, T>()
    for (const reference of references) if (!firstByTarget.has(reference.targetPath!)) firstByTarget.set(reference.targetPath!, reference)
    for (const [targetPath, reference] of firstByTarget) {
      if (visited.has(targetPath) || enqueued.has(targetPath)) continue
      enqueued.add(targetPath)
      discoveryEdgeIds.add(reference.id)
      queue.push({ packagePath: targetPath, depth: current.depth + 1 })
    }
  }
  return { visitedPaths, depths, discoveryEdgeIds }
}

function seedRole(base: string): SeedCandidate['role'] | undefined {
  if (/Instance$/i.test(base)) return 'instance'
  if (/Storable$/i.test(base)) return 'storable'
  if (/Actor$/i.test(base)) return 'actor'
  if (/^BP_/.test(base)) return 'other-blueprint'
  return undefined
}

function readStructuralPackage(
  repositoryRoot: string,
  provenance: GameDataSourceProvenance,
  codeIdentity: CodeIdentity,
  packagePath: string,
  depth: number,
): ParsedNode {
  const datasetRoot = localDatasetRoot(repositoryRoot)
  const gamePackageName = toGamePackageName(packagePath)
  const packageFiles = sourceFilesForPackage(datasetRoot, packagePath)
  const uassetPath = packageFiles.includes(`${packagePath}.uasset`) ? `${packagePath}.uasset` : `${packagePath}.umap`
  const uexpPath = `${packagePath}.uexp`
  const sourceFileIdentities = packageFiles.map((file) => ({ path: file, size: fs.statSync(path.join(datasetRoot, file)).size, sha256: sha256(fs.readFileSync(path.join(datasetRoot, file))) }))
  const packageHash = sourceFileIdentities.some((file) => file.path === uassetPath)
    ? { algorithm: 'sha256-path-content-v1' as const, value: hashLogicalAsset(datasetRoot, packageFiles) }
    : undefined
  const tableLikePackage = /(?:^|\/)(?:DataTables?|Curves?)(?:\/|$)/i.test(packagePath)
    || /(?:CurveTable|DataTable)/i.test(path.posix.basename(packagePath))

  const base = {
    path: packagePath, gamePackageName, ...(packageHash ? { packageHash } : {}), sourceFiles: sourceFileIdentities,
  }
  const fail = (error: unknown): ParsedNode => {
    const message = error instanceof Error ? error.message : String(error)
    const diagnostic = (error as { diagnostic?: UeDiagnostic }).diagnostic
    const runId = contentAddress({ datasetId: provenance.dataset.id, packagePath, sourceFiles: sourceFileIdentities, parser: 'ue4-package-property-parser@1', codeIdentity, failure: message })
    const pkg: StructuralPackage = {
      ...base,
      parse: { state: 'parse-failed', parser: { id: 'ue4-package-property-parser', schemaVersion: 1 }, codeIdentity, runId, failure: { ...(diagnostic?.code ? { code: diagnostic.code } : {}), message } },
      imports: [], exports: [], cdoPropertyInventory: [], diagnostics: diagnostic ? [diagnostic] : [],
      unavailableRanges: sourceFileIdentities.filter((source) => source.path === uassetPath || source.path === uexpPath).map((source) => ({ file: source.path, start: 0, end: source.size, state: 'parse-failed' as const, reason: message })),
      payloadCoverage: { classDefaultObjectsDecoded: 0, nonCdoExportsNotDecoded: 0, tableLikePackage, tableRows: tableLikePackage ? 'not-decoded-by-current-parser' : 'not-applicable' },
      traversal: { depth, stopReason: 'parser-boundary' },
    }
    return { path: packagePath, depth, package: pkg, edges: [] }
  }

  if (!sourceFileIdentities.some((source) => source.path === uassetPath)) return fail(new Error('missing-uasset-target'))
  try {
    const uasset = fs.readFileSync(path.join(datasetRoot, uassetPath))
    const uexp = sourceFileIdentities.some((source) => source.path === uexpPath) ? fs.readFileSync(path.join(datasetRoot, uexpPath)) : Buffer.alloc(0)
    const parsed = parseUePackage(uasset, uexp, { assetPath: packagePath })
    const resolver = new PackageObjectResolver(parsed.imports, parsed.exports)
    const imports = parsed.imports.map((entry) => ({
        index: entry.index, rawPackageIndex: -(entry.index + 1), classPackage: entry.classPackage, className: entry.className,
        outerIndex: entry.outerIndex, objectName: entry.objectName,
        ...(entry.byteRange ? { sourceRange: { file: uassetPath, start: entry.byteRange.start, end: entry.byteRange.end } } : {}),
    }))
    const parsedObjects = new Map(parsed.objects.map((object) => [object.exportIndex, object]))
    const exports = parsed.exports.map((entry) => exportObject(entry, parsed, resolver, uexpPath))
    const edges: StructuralEdge[] = []
    imports.forEach((entry, index) => {
      const target = describeImportTarget(parsed.imports, index)
      edges.push(makeEdge(packagePath, 'import', {
        kind: 'import-table', rawPackageIndex: entry.rawPackageIndex,
        sourceRange: entry.sourceRange ? { file: entry.sourceRange.file, start: entry.sourceRange.start, end: entry.sourceRange.end } : undefined,
      }, target))
    })
    parsed.exports.forEach((entry) => {
      const refs: readonly [EdgeKind, string, number][] = [
        ['class', 'classIndex', entry.classIndex], ['super', 'superIndex', entry.superIndex],
        ['template', 'templateIndex', entry.templateIndex], ['outer', 'outerIndex', entry.outerIndex],
      ]
      for (const [kind, field, rawPackageIndex] of refs) {
        const target = describePackageIndex(rawPackageIndex, parsed.imports, parsed.exports, packagePath)
        edges.push(makeEdge(packagePath, kind, {
          kind: 'export-table', sourceObject: entry.objectName.value, serializedField: field, rawPackageIndex,
          ...(entry.byteRange ? { sourceRange: { file: uassetPath, start: entry.byteRange.start, end: entry.byteRange.end } } : {}),
        }, target))
      }
    })
    parsed.objects.forEach((object) => collectPropertyEdges(object.properties, packagePath, uexpPath, parsed.imports, parsed.exports, edges))
    const cdoPropertyInventory = parsed.objects.map((object) => ({
      exportIndex: object.exportIndex, objectName: object.objectName,
      properties: object.properties.map((property, index) => structuralProperty(property, index, object.diagnostics, uexpPath)),
    }))
    const unavailableRanges = collectUnavailableRanges(parsed, parsedObjects, packageFiles, packagePath, uassetPath, uexpPath, datasetRoot)
    const nonCdoCount = parsed.exports.filter((entry) => !parsedObjects.has(entry.index)).length
    const runId = contentAddress({ datasetId: provenance.dataset.id, packagePath, sourceFiles: sourceFileIdentities, parser: { id: 'ue4-package-property-parser', schemaVersion: 1 }, codeIdentity, propertyScope: 'all-class-default-objects-only' })
    const pkg: StructuralPackage = {
      ...base,
      parse: { state: 'parsed', parser: { id: 'ue4-package-property-parser', schemaVersion: 1 }, codeIdentity, runId, summary: parsed.summary },
      imports, exports, cdoPropertyInventory,
      diagnostics: parsed.diagnostics,
      unavailableRanges,
      payloadCoverage: {
        classDefaultObjectsDecoded: parsed.objects.length,
        nonCdoExportsNotDecoded: nonCdoCount,
        tableLikePackage,
        tableRows: tableLikePackage ? 'not-decoded-by-current-parser' : 'not-applicable',
      },
      traversal: { depth, stopReason: edges.some((edge) => Boolean(edge.targetPackage)) ? 'references-followed' : 'no-followable-references' },
    }
    return { path: packagePath, depth, package: pkg, edges }
  } catch (error) {
    return fail(error)
  }
}

function exportObject(entry: UeExportEntry, parsed: ParsedUePackage, resolver: PackageObjectResolver, uexpPath: string): StructuralObject {
  const start = entry.serialOffset - parsed.summary.totalHeaderSize
  return {
    exportIndex: entry.index, rawPackageIndex: entry.index + 1, objectName: entry.objectName, objectFlags: entry.objectFlags,
    isClassDefaultObject: entry.objectName.value.startsWith('Default__'),
    serialized: { serialOffset: entry.serialOffset, serialSize: entry.serialSize, sourceRange: { file: uexpPath, start, end: start + entry.serialSize } },
    references: {
      class: resolver.resolve(entry.classIndex), super: resolver.resolve(entry.superIndex),
      template: resolver.resolve(entry.templateIndex), outer: resolver.resolve(entry.outerIndex),
    },
  }
}

function structuralProperty(property: ParsedProperty, order: number, diagnostics: readonly UeDiagnostic[], sourceFile: string): StructuralProperty {
  const sourceRange = { file: sourceFile, start: property.byteRange.start, end: property.byteRange.end }
  const valueRange = { file: sourceFile, start: (property.valueByteRange ?? property.byteRange).start, end: (property.valueByteRange ?? property.byteRange).end }
  const state = propertyDecodeState(property, diagnostics)
  const base = {
    order,
    name: property.nameReference ?? { nameIndex: -1, number: 0, value: property.name },
    type: property.typeReference ?? { nameIndex: -1, number: 0, value: property.type },
    arrayIndex: property.arrayIndex, path: property.path, serializedSize: property.serializedSize,
    sourceRange, valueRange, ...(property.metadata ? { metadata: property.metadata } : {}),
  }
  if (state !== 'decoded') return { ...base, decoding: { state } }
  if (property.type === 'StructProperty' && isPropertyList(property.value)) {
    return { ...base, decoding: { state, properties: property.value.map((child, index) => structuralProperty(child, index, diagnostics, sourceFile)) } }
  }
  if (property.type === 'ArrayProperty' && Array.isArray(property.value)) {
    return { ...base, decoding: { state, elements: property.value.map((element, index) => {
      if (isPropertyList(element)) return { index, decoding: { state: 'decoded' as const }, properties: element.map((child, childIndex) => structuralProperty(child, childIndex, diagnostics, sourceFile)) }
      if (isUnavailable(element)) return { index, decoding: { state: 'unsupported' as const } }
      return { index, decoding: { state: 'decoded' as const }, value: element as JsonValue }
    }) } }
  }
  return { ...base, decoding: { state, value: property.value } }
}

function collectPropertyEdges(
  properties: readonly ParsedProperty[], packagePath: string, uexpPath: string,
  imports: readonly UeImportEntry[], exports: readonly UeExportEntry[], edges: StructuralEdge[],
): void {
  const walk = (property: ParsedProperty, occurrencePath = property.path, arrayIndex?: number) => {
    const valueRange = property.valueByteRange ?? property.byteRange
    const occurrence: SourceOccurrence = {
      kind: 'cdo-property', propertyPath: occurrencePath, ...(arrayIndex !== undefined ? { arrayIndex } : {}),
      rawPackageIndex: 0, sourceRange: { file: uexpPath, start: property.byteRange.start, end: property.byteRange.end },
      valueRange: { file: uexpPath, start: valueRange.start, end: valueRange.end },
    }
    if (property.type === 'ObjectProperty' && isResolvedIndex(property.value)) {
      const target = describePackageIndex(property.value.rawPackageIndex, imports, exports, packagePath)
      edges.push(makeEdge(packagePath, 'object-property', { ...occurrence, rawPackageIndex: property.value.rawPackageIndex }, target))
    } else if (property.type === 'SoftObjectProperty' && isSoftObject(property.value)) {
      const target = describeSoftObject(property.value.assetPathName, property.value.subPathString)
      edges.push(makeEdge(packagePath, 'soft-object-property', occurrence, target))
    } else if (property.type === 'StructProperty' && isPropertyList(property.value)) {
      property.value.forEach((child) => walk(child))
    } else if (property.type === 'ArrayProperty' && Array.isArray(property.value)) {
      property.value.forEach((element, index) => {
        const childPath = `${property.path}[${index}]`
        if (isResolvedIndex(element)) {
          const target = describePackageIndex(element.rawPackageIndex, imports, exports, packagePath)
          edges.push(makeEdge(packagePath, 'object-property', { ...occurrence, propertyPath: childPath, arrayIndex: index, rawPackageIndex: element.rawPackageIndex }, target))
        } else if (isSoftObject(element)) {
          edges.push(makeEdge(packagePath, 'soft-object-property', { ...occurrence, propertyPath: childPath, arrayIndex: index }, describeSoftObject(element.assetPathName, element.subPathString)))
        } else if (isPropertyList(element)) element.forEach((child) => walk(child, child.path, index))
      })
    }
  }
  properties.forEach((property) => walk(property))
}

function describeImportTarget(imports: readonly UeImportEntry[], index: number): TargetDescriptor {
  const entry = imports[index]
  if (!entry) return { kind: 'invalid', rawPackageIndex: -(index + 1) }
  const visited = new Set<number>()
  const chain: UeImportEntry[] = []
  let current: UeImportEntry | undefined = entry
  let rootPackageName: string | undefined
  while (current && !visited.has(current.index)) {
    visited.add(current.index)
    if (current.className.value === 'Package' && current.objectName.value.startsWith('/')) {
      rootPackageName = current.objectName.value
      break
    }
    chain.push(current)
    current = current.outerIndex < 0 ? imports[-current.outerIndex - 1] : undefined
  }
  const packageName = rootPackageName ?? packageNameFromPathLike(entry.objectName.value)
  const objectParts = chain.reverse().map((part) => part.objectName.value)
  const objectPath = packageName ? `${packageName}${objectParts.length ? `.${objectParts.join('.')}` : ''}` : undefined
  return {
    kind: 'import', rawPackageIndex: -(index + 1), objectPath,
    ...(packageName ? { packageName } : {}),
    ...(packageName ? { packagePath: datasetPackagePath(packageName) } : {}),
  }
}

function describePackageIndex(rawPackageIndex: number, imports: readonly UeImportEntry[], exports: readonly UeExportEntry[], sourcePackage: string): TargetDescriptor {
  if (rawPackageIndex < 0) return describeImportTarget(imports, -rawPackageIndex - 1)
  if (rawPackageIndex > 0) {
    const entry = exports[rawPackageIndex - 1]
    return { kind: entry ? 'export' : 'invalid', rawPackageIndex, ...(entry ? { objectPath: `${toGamePackageName(sourcePackage)}.${entry.objectName.value}`, packageName: toGamePackageName(sourcePackage), packagePath: sourcePackage } : {}) }
  }
  return { kind: 'null', rawPackageIndex: 0 }
}

function buildInheritanceChains(edges: readonly StructuralEdge[], packages: ReadonlyMap<string, ParsedNode>): Map<string, StructuralInheritanceChain[]> {
  const superEdges = new Map<string, StructuralEdge>()
  for (const edge of edges) {
    const sourceObject = edge.sourceOccurrence.sourceObject
    if (edge.kind === 'super' && sourceObject?.endsWith('_C') && !sourceObject.startsWith('Default__')) superEdges.set(`${edge.sourcePackage}\0${sourceObject}`, edge)
  }
  const byPackage = new Map<string, StructuralInheritanceChain[]>()
  for (const [sourceKey, firstEdge] of [...superEdges].sort(([a], [b]) => compare(a, b))) {
    const sourceObject = firstEdge.sourceOccurrence.sourceObject!
    const hops: StructuralInheritanceChain['hops'][number][] = []
    const visited = new Set([sourceKey])
    let edge = firstEdge
    let stopReason: StructuralInheritanceChain['stopReason']
    while (true) {
      hops.push({
        edgeId: edge.id,
        ...(edge.targetObject ? { targetObject: edge.targetObject } : {}),
        ...(edge.targetPackageName ? { targetPackageName: edge.targetPackageName } : {}),
        ...(edge.targetPackage ? { targetPackage: edge.targetPackage } : {}),
        rawPackageIndex: edge.sourceOccurrence.rawPackageIndex,
      })
      if (edge.traversal.stopReason === 'null-reference') { stopReason = 'no-super-reference'; break }
      if (edge.traversal.stopReason === 'native-boundary') { stopReason = 'native-boundary'; break }
      if (edge.traversal.stopReason === 'outside-game-boundary') { stopReason = 'outside-game-boundary'; break }
      if (edge.traversal.stopReason === 'missing-target') { stopReason = 'missing-target'; break }
      if (edge.traversal.stopReason === 'parser-boundary') { stopReason = 'parser-boundary'; break }
      if (edge.traversal.stopReason === 'invalid-package-index' || edge.traversal.stopReason === 'unresolved-package-index') { stopReason = 'target-export-unavailable'; break }
      const targetPackage = edge.targetPackage
      const targetObject = edge.targetObject?.split('.').at(-1)
      if (!targetPackage || !targetObject) { stopReason = 'target-export-unavailable'; break }
      const targetKey = `${targetPackage}\0${targetObject}`
      if (visited.has(targetKey)) { stopReason = 'cycle-detected'; break }
      const targetNode = packages.get(targetPackage)
      if (!targetNode) { stopReason = 'missing-target'; break }
      if (targetNode.package.parse.state === 'parse-failed') { stopReason = 'parser-boundary'; break }
      const next = superEdges.get(targetKey)
      if (!next) { stopReason = 'target-export-unavailable'; break }
      visited.add(targetKey)
      edge = next
    }
    const list = byPackage.get(firstEdge.sourcePackage) ?? []
    list.push({ sourceObject, hops, stopReason })
    byPackage.set(firstEdge.sourcePackage, list)
  }
  for (const chains of byPackage.values()) chains.sort((a, b) => compare(a.sourceObject, b.sourceObject))
  return byPackage
}

function describeSoftObject(assetPathName: string, subPathString: string): TargetDescriptor {
  const packageName = packageNameFromPathLike(assetPathName)
  return {
    kind: 'soft-object', rawPackageIndex: 0,
    objectPath: `${assetPathName}${subPathString ? `:${subPathString}` : ''}`,
    ...(packageName ? { packageName, packagePath: datasetPackagePath(packageName) } : {}),
  }
}

function makeEdge(packagePath: string, kind: EdgeKind, occurrence: SourceOccurrence, target: TargetDescriptor): StructuralEdge {
  const id = contentAddress({ sourcePackage: packagePath, kind, occurrence, target }).slice('sha256:'.length, 'sha256:'.length + 24)
  return {
    id, kind, sourcePackage: packagePath, sourceOccurrence: occurrence,
    ...(target.objectPath ? { targetObject: target.objectPath } : {}),
    ...(target.packageName ? { targetPackageName: target.packageName } : {}),
    ...(target.packagePath ? { targetPackage: target.packagePath } : {}),
    targetRawPackageIndex: target.rawPackageIndex, targetKind: target.kind,
    traversal: { stopReason: 'followed' },
  }
}

function collectUnavailableRanges(
  parsed: ParsedUePackage,
  parsedObjects: ReadonlyMap<number, ParsedUePackage['objects'][number]>,
  sourceFiles: readonly string[],
  packagePath: string,
  uassetPath: string,
  uexpPath: string,
  datasetRoot: string,
): StructuralPackage['unavailableRanges'] {
  const unavailable: StructuralPackage['unavailableRanges'][number][] = []
  const uassetSize = fileSize(sourceFiles, uassetPath, datasetRoot)
  unavailable.push(...uncoveredRanges(uassetSize, [
    { start: 0, end: parsed.summary.nameOffset },
    ...parsed.names.flatMap((entry) => entry.byteRange ? [entry.byteRange] : []),
    ...parsed.imports.flatMap((entry) => entry.byteRange ? [entry.byteRange] : []),
    ...parsed.exports.flatMap((entry) => entry.byteRange ? [entry.byteRange] : []),
  ]).map((range) => ({ file: uassetPath, ...range, state: 'not-extracted' as const, reason: 'unparsed-uasset-region' })))
  for (const entry of parsed.exports) {
    const start = entry.serialOffset - parsed.summary.totalHeaderSize
    const end = start + entry.serialSize
    if (!parsedObjects.has(entry.index) && end > start && sourceFiles.includes(uexpPath)) unavailable.push({ file: uexpPath, start, end, state: 'not-extracted', reason: 'non-cdo-export-payload-not-decoded' })
  }
  const coveredExportRanges = parsed.exports.map((entry) => ({ start: entry.serialOffset - parsed.summary.totalHeaderSize, end: entry.serialOffset - parsed.summary.totalHeaderSize + entry.serialSize }))
  for (const range of uncoveredRanges(fileSize(sourceFiles, uexpPath, datasetRoot), coveredExportRanges)) unavailable.push({ file: uexpPath, ...range, state: 'not-extracted', reason: 'unassigned-uexp-region' })
  if (!sourceFiles.includes(uexpPath) && parsed.exports.some((entry) => entry.serialSize > 0)) unavailable.push({ file: uexpPath, state: 'not-extracted', reason: 'uexp-source-file-absent' })
  for (const object of parsed.objects) {
    for (const range of object.propertyStream?.unparsedByteRanges ?? []) unavailable.push({ file: uexpPath, ...range, state: 'parse-failed', reason: 'property-stream-unparsed-range' })
    for (const property of flattenProperties(object.properties)) {
      if (!isUnavailable(property.value)) continue
      const range = property.valueByteRange ?? property.byteRange
      const failed = object.diagnostics.some((diagnostic) => diagnostic.propertyName === property.name && ['struct-parse-failed', 'array-parse-failed', 'malformed-property-tag'].includes(diagnostic.code))
      unavailable.push({ file: uexpPath, ...range, state: failed ? 'parse-failed' : 'unsupported', reason: `${property.type}-value-unavailable` })
    }
  }
  if (/DataTables?|Curves?/i.test(packagePath)) {
    const tables = parsed.exports.filter((entry) => /DataTable|CurveTable/i.test(entry.objectName.value))
    if (tables.length) for (const entry of tables) {
      const start = entry.serialOffset - parsed.summary.totalHeaderSize
      if (entry.serialSize) unavailable.push({ file: uexpPath, start, end: start + entry.serialSize, state: 'not-extracted', reason: 'table-row-property-reference-decoder-not-implemented' })
    }
  }
  return unavailable.sort((a, b) => compare(a.file, b.file) || a.start - b.start || a.end - b.end || compare(a.reason, b.reason))
}

function makeCodeIdentity(repositoryRoot: string): CodeIdentity {
  const aggregate = crypto.createHash('sha256')
  const files = [...CODE_PATHS].sort().map((relativePath) => {
    const bytes = fs.readFileSync(path.join(repositoryRoot, relativePath))
    aggregate.update(relativePath, 'utf8')
    aggregate.update(Uint8Array.of(0))
    aggregate.update(bytes)
    return { path: relativePath, sha256: sha256(bytes) }
  })
  return { algorithm: 'sha256-path-content-v1', value: aggregate.digest('hex'), files }
}

function sourceFilesForPackage(datasetRoot: string, packagePath: string): string[] {
  const safe = safeDatasetPath(packagePath)
  if (!safe) return []
  const absoluteBase = path.join(datasetRoot, safe)
  const directory = path.dirname(absoluteBase)
  if (!fs.existsSync(directory)) return []
  const basename = path.basename(absoluteBase)
  return fs.readdirSync(directory).filter((name) => name.startsWith(`${basename}.`) && /\.(?:uasset|umap|uexp)$/i.test(name)).map((name) => `${safe.slice(0, safe.lastIndexOf('/') + 1)}${name}`).sort(compare)
}

function safeDatasetPath(packagePath: string): string | undefined {
  try {
    assertSafeAssetPath(packagePath)
    return packagePath
  } catch { return undefined }
}

function isPackageAvailable(datasetRoot: string, packagePath: string): boolean {
  const safe = safeDatasetPath(packagePath)
  return Boolean(safe && (fs.existsSync(path.join(datasetRoot, `${safe}.uasset`)) || fs.existsSync(path.join(datasetRoot, `${safe}.umap`))))
}

function datasetPackagePath(packageName: string): string | undefined {
  if (!packageName.startsWith('/Game/')) return undefined
  const relativePath = `Dungeons/Content/${packageName.slice('/Game/'.length)}`
  return safeDatasetPath(relativePath)
}

function packageNameFromPathLike(value: string): string | undefined {
  const match = value.match(/^(\/Game\/[^.:]+|\/Script\/[^.:]+|\/Engine\/[^.:]+)/)
  return match?.[1]
}

function toGamePackageName(packagePath: string): string {
  const marker = 'Dungeons/Content/'
  return packagePath.startsWith(marker) ? `/Game/${packagePath.slice(marker.length)}` : packagePath
}

function propertyDecodeState(property: ParsedProperty, diagnostics: readonly UeDiagnostic[]): DecodeState {
  if (!isUnavailable(property.value)) return 'decoded'
  return diagnostics.some((item) => item.propertyName === property.name && ['struct-parse-failed', 'array-parse-failed', 'malformed-property-tag'].includes(item.code)) ? 'parse-failed' : 'unsupported'
}

function isUnavailable(value: unknown): value is { readonly unsupported: true } {
  return value !== null && typeof value === 'object' && 'unsupported' in value && value.unsupported === true
}

function isResolvedIndex(value: unknown): value is ResolvedPackageIndex {
  return value !== null && typeof value === 'object' && 'rawPackageIndex' in value && typeof value.rawPackageIndex === 'number' && 'kind' in value
}

function isSoftObject(value: unknown): value is { readonly assetPathName: string; readonly subPathString: string } {
  return value !== null && typeof value === 'object' && 'assetPathName' in value && typeof value.assetPathName === 'string' && 'subPathString' in value && typeof value.subPathString === 'string'
}

function isPropertyList(value: unknown): value is readonly ParsedProperty[] {
  return Array.isArray(value) && value.every((item) => item !== null && typeof item === 'object' && 'path' in item && 'serializedSize' in item)
}

function flattenProperties(properties: readonly ParsedProperty[]): ParsedProperty[] {
  const output: ParsedProperty[] = []
  const visit = (property: ParsedProperty) => {
    output.push(property)
    if (property.type === 'StructProperty' && isPropertyList(property.value)) property.value.forEach(visit)
    if (property.type === 'ArrayProperty' && Array.isArray(property.value)) property.value.forEach((element) => { if (isPropertyList(element)) element.forEach(visit) })
  }
  properties.forEach(visit)
  return output
}

export function rawStructuralParserBoundaryReasons(
  pkg: Pick<RawStructuralInventory['packages'][number], 'parse' | 'payloadCoverage' | 'diagnostics' | 'cdoPropertyInventory'>,
): string[] {
  const reasons = new Set<string>()
  if (pkg.parse.state === 'parse-failed') reasons.add('package-parse-failed')
  if (pkg.payloadCoverage.tableLikePackage) reasons.add('table-row-decoder-unsupported')
  const states = pkg.cdoPropertyInventory.flatMap((cdo) => flattenStructuralPropertyInventory(cdo.properties).map((property) => property.decoding.state))
  if (states.includes('unsupported') || pkg.diagnostics.some((diagnostic) => diagnostic.code === 'unsupported-property-type' || diagnostic.code === 'struct-size-mismatch')) reasons.add('property-payload-unsupported')
  if (states.includes('parse-failed') || pkg.diagnostics.some((diagnostic) => ['malformed-property-tag', 'struct-parse-failed', 'array-parse-failed', 'trailing-bytes'].includes(diagnostic.code))) reasons.add('property-stream-partial')
  return [...reasons].sort(compare)
}

function flattenStructuralPropertyInventory(properties: readonly StructuralProperty[]): StructuralProperty[] {
  const result: StructuralProperty[] = []
  const visit = (property: StructuralProperty) => {
    result.push(property)
    property.decoding.properties?.forEach(visit)
    property.decoding.elements?.forEach((element) => element.properties?.forEach(visit))
  }
  properties.forEach(visit)
  return result
}

function fileSize(sourceFiles: readonly string[], file: string, datasetRoot: string): number {
  const match = sourceFiles.find((source) => path.posix.normalize(source) === path.posix.normalize(file))
  return match ? fs.statSync(path.join(datasetRoot, match)).size : 0
}

function uncoveredRanges(size: number, ranges: readonly BinaryByteRange[]): BinaryByteRange[] {
  if (!size) return []
  const ordered = ranges.filter((range) => range.end > range.start).map((range) => ({ start: Math.max(0, range.start), end: Math.min(size, range.end) })).sort((a, b) => a.start - b.start || a.end - b.end)
  const output: BinaryByteRange[] = []
  let cursor = 0
  for (const range of ordered) {
    if (range.start > cursor) output.push({ start: cursor, end: range.start })
    cursor = Math.max(cursor, range.end)
  }
  if (cursor < size) output.push({ start: cursor, end: size })
  return output
}

function countBy<T>(items: readonly T[], keyOf: (item: T) => string): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const item of items) counts[keyOf(item)] = (counts[keyOf(item)] ?? 0) + 1
  return counts
}

function contentAddress(value: unknown): string {
  return `sha256:${sha256(Buffer.from(JSON.stringify(value), 'utf8'))}`
}

export function buildRawStructuralInventoryShards(value: RawStructuralInventory): {
  readonly manifest: RawStructuralInventoryManifest
  readonly files: readonly { readonly path: string; readonly bytes: Buffer }[]
} {
  const edgeGroups = new Map<string, StructuralEdge[]>()
  for (const edge of value.edges) {
    const group = edgeGroups.get(edge.sourcePackage) ?? []
    group.push(edge)
    edgeGroups.set(edge.sourcePackage, group)
  }
  const files: { path: string; bytes: Buffer }[] = []
  const shardMetas: RawStructuralInventoryManifest['shards'][number][] = []
  for (let offset = 0, shardIndex = 0; offset < value.packages.length; offset += RAW_STRUCTURAL_SHARD_PACKAGE_LIMIT, shardIndex += 1) {
    const packages = value.packages.slice(offset, offset + RAW_STRUCTURAL_SHARD_PACKAGE_LIMIT)
    const edges = packages.flatMap((pkg) => edgeGroups.get(pkg.path) ?? [])
    const text = `${JSON.stringify({ schemaVersion: 1, packages, edges } satisfies RawStructuralInventoryShard, null, 2)}\n`
    const uncompressed = Buffer.from(text, 'utf8')
    const bytes = gzipSync(uncompressed, { level: 9, mtime: 0 })
    bytes[9] = 255
    const shardPath = `shards/part-${String(shardIndex).padStart(3, '0')}.json.gz`
    files.push({ path: shardPath, bytes })
    shardMetas.push({
      path: shardPath, packageCount: packages.length, edgeCount: edges.length,
      uncompressedBytes: uncompressed.byteLength, uncompressedSha256: sha256(uncompressed),
      compressedBytes: bytes.byteLength, compressedSha256: sha256(bytes),
    })
  }
  const manifestBase = {
    schemaVersion: value.schemaVersion,
    artifactKind: value.artifactKind,
    scope: value.scope,
    catalogSeeds: value.catalogSeeds,
    boundaries: value.boundaries,
    summary: value.summary,
  }
  return {
    manifest: { ...manifestBase, representation: 'canonical-json-in-deterministic-gzip-shards', shards: shardMetas },
    files,
  }
}

export function serializeRawStructuralInventoryManifest(value: RawStructuralInventoryManifest): string {
  return `${JSON.stringify(value, null, 2)}\n`
}

export function renderRawStructuralInventoryReport(value: RawStructuralInventory): string {
  const summary = value.summary
  const statuses = Object.entries(summary.seedStatusCounts).map(([status, count]) => `- ${status}: ${count}`).join('\n')
  return `# Raw Structural Inventory + Dependency Graph\n\n` +
    `Minecraft Dungeons ${value.scope.claimedGameVersion} の271 catalog entriesをRaw candidate seedとして分離し、実際のserialized referenceから \`/Game\` packageをBFSで展開した生成artifactです。ゲーム効果の解釈、Formal identity判定、runtime接続は行いません。\n\n` +
    `## Coverage\n\n` +
    `- Catalog seed rows: ${summary.seedCount}; candidate package seeds: ${summary.candidateSeedCount}\n` +
    `- Visited packages: ${summary.visitedPackageCount}; parsed: ${summary.parsedPackageCount}\n` +
    `- Serialized reference edges: ${summary.edgeCount}; resolved targets: ${summary.resolvedTargetCount}; unresolved targets: ${summary.unresolvedTargetCount}\n` +
    `- Native package boundaries: ${summary.nativeBoundaryCount}; outside-game target packages: ${value.boundaries.outsideGameScope.length}; parser boundaries: ${summary.parserBoundaryCount}; missing target packages: ${summary.missingTargetCount}\n` +
    `- Reached DataTable / Curve-like packages: ${summary.dataTableOrCurveReachedCount}; cycle/reuse edges: ${summary.cycleOrReuseEdgeCount}\n\n` +
    `- Structural inheritance chains: ${summary.inheritanceChainCount}; detected cycles: ${summary.inheritanceCycleCount}\n\n` +
    `## Catalog seed mapping\n\n${statuses}\n\n` +
    `Seed status describes the catalog-to-Raw package-candidate association only: exact means one local Instance candidate selected by asset-semantic-name or catalog-internal-id mapping; provisional means a family heuristic, documented alias, or class fallback supplied the candidate; ambiguous preserves every equally ranked candidate; not-found has none. This axis is separate from Formal Identity. Rows retain all equally ranked candidates; \`not-found\` rows remain without package seeds.\n\n` +
    `## Representation and boundaries\n\n` +
    `Each package retains dataset-relative path, package-file and logical-package hashes, parser and code provenance, import/export relation tables, export class/super/template/outer references, traversed inheritance chains, CDO property paths/types/decode states/values/children, source byte ranges, diagnostics, and unavailable ranges. Edges preserve the serialized occurrence and the target object/package. Imports under \`/Script\` are native boundaries. Missing local \`/Game\` targets, parser failures, and out-of-scope targets have separate stop reasons. BFS is cycle-safe and has no fixed-depth cutoff.\n\n` +
    `DataTable/Curve packages are retained as graph nodes. The current parser does not decode their row payloads; those ranges remain explicit as unavailable instead of being inferred. Unsupported and partial CDO property streams count as parser boundaries and retain their diagnostics, states, paths, and byte ranges. Non-CDO export payloads are marked \`not-extracted\`. The artifact stores no game binaries, semantic effects, damage/Power scaling, cadence, stacking, proc, or native-behavior conclusions.\n\n` +
    `## Artifact files\n\n` +
    `The machine-readable artifact uses \`research/raw/game-data-raw-structural-inventory/manifest.json\` plus ${Math.ceil(summary.visitedPackageCount / RAW_STRUCTURAL_SHARD_PACKAGE_LIMIT)} deterministic gzip JSON shards. Each shard holds at most ${RAW_STRUCTURAL_SHARD_PACKAGE_LIMIT} packages and their source-owned edges; the manifest records each shard's compressed and uncompressed SHA-256.\n\n` +
    `## Reproduction\n\nRun \`npm run generate:game-data-raw-structural-inventory\` with the local 1.17.0.0 dataset, then \`npm run audit:game-data-raw-structural-inventory\`. Generation is deterministic from the catalog manifest, local package bytes, provenance record, parser, and generator code identity.\n`
}

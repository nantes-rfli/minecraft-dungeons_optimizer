import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { gunzipSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'
import type { GameDataSourceProvenance } from '../src/research/gameDataProvenance.ts'
import type { RawPackageSnapshot } from './game-data-raw-package.ts'
import {
  RAW_STRUCTURAL_INVENTORY_PATH, RAW_STRUCTURAL_REPORT_PATH, buildRawStructuralInventory,
  buildRawStructuralInventoryShards, renderRawStructuralInventoryReport,
  loadRawCatalog,
  makeRawStructuralCodeIdentity, makeRawStructuralInputIdentity,
  serializeRawStructuralInventoryManifest,
  rawStructuralParserBoundaryReasons,
  type RawStructuralInventory, type RawStructuralInventoryManifest, type RawStructuralInventoryShard,
} from './game-data-raw-structural-inventory.ts'
import { RAW_PACKAGE_SPECS } from './game-data-raw-package.ts'
import { localDatasetRoot } from './game-data-package-source.ts'

const repositoryRoot = fileURLToPath(new URL('..', import.meta.url))
const manifestPath = path.join(repositoryRoot, RAW_STRUCTURAL_INVENTORY_PATH)
const reportPath = path.join(repositoryRoot, RAW_STRUCTURAL_REPORT_PATH)
const artifactDirectory = path.dirname(manifestPath)
const provenance = JSON.parse(fs.readFileSync(path.join(repositoryRoot, 'research/sources/game-data-source-provenance.json'), 'utf8')) as GameDataSourceProvenance
const manifestText = fs.readFileSync(manifestPath, 'utf8')
const manifest = JSON.parse(manifestText) as RawStructuralInventoryManifest
const errors = validateStructuralInventoryManifest(manifest, artifactDirectory, repositoryRoot, provenance)
if (serializeRawStructuralInventoryManifest(manifest) !== manifestText) errors.push(`${RAW_STRUCTURAL_INVENTORY_PATH} is not canonical JSON`)

const expectedReport = renderRawStructuralInventoryReport({ ...manifest, packages: [], edges: [] } as RawStructuralInventory)
if (expectedReport !== fs.readFileSync(reportPath, 'utf8')) errors.push(`${RAW_STRUCTURAL_REPORT_PATH} is stale`)

if (fs.existsSync(localDatasetRoot(repositoryRoot))) {
  const generated = buildRawStructuralInventory(repositoryRoot, provenance)
  const regenerated = buildRawStructuralInventoryShards(generated)
  if (serializeRawStructuralInventoryManifest(regenerated.manifest) !== manifestText) errors.push('Local source regeneration differs from the structural inventory manifest')
  const committedShards = new Map(manifest.shards.map((shard) => [shard.path, shard.compressedSha256]))
  for (const generatedShard of regenerated.files) {
    if (hash(generatedShard.bytes) !== committedShards.get(generatedShard.path)) errors.push(`Local source regeneration differs from ${generatedShard.path}`)
  }
} else {
  console.log('Local dataset absent; committed manifest and compressed shards were checked without reparse.')
}

if (errors.length) throw new Error([...new Set(errors)].sort().join('\n'))
console.log(`Raw structural inventory audit passed: ${manifest.summary.seedCount} seeds; ${manifest.summary.visitedPackageCount} packages; ${manifest.summary.edgeCount} edges.`)
console.log(`Coverage: resolved ${manifest.summary.resolvedTargetCount}; unresolved ${manifest.summary.unresolvedTargetCount}; native ${manifest.summary.nativeBoundaryCount}; parser ${manifest.summary.parserBoundaryCount}; DataTable/Curve ${manifest.summary.dataTableOrCurveReachedCount}.`)

export function validateStructuralInventoryManifest(
  manifest: RawStructuralInventoryManifest,
  artifactRoot: string,
  repositoryRoot: string,
  sourceProvenance: GameDataSourceProvenance,
): string[] {
  const errors: string[] = []
  if (manifest.schemaVersion !== 1 || manifest.artifactKind !== 'raw-structural-inventory-with-dependency-graph') errors.push('Unsupported structural inventory artifact identity')
  if (manifest.representation !== 'canonical-json-in-deterministic-gzip-shards') errors.push('Unsupported structural inventory representation')
  if (manifest.scope.dataset.id !== sourceProvenance.dataset.id) errors.push('Dataset provenance ID drift')
  if (manifest.scope.claimedGameVersion !== sourceProvenance.dataset.claimedVersion) errors.push('Dataset game version drift')
  if (manifest.scope.parser.id !== 'ue4-package-property-parser' || manifest.scope.parser.schemaVersion !== 1) errors.push('Parser provenance drift')
  const expectedCodeIdentity = makeRawStructuralCodeIdentity(repositoryRoot)
  const expectedInputIdentity = makeRawStructuralInputIdentity(repositoryRoot)
  if (JSON.stringify(manifest.scope.codeIdentity) !== JSON.stringify(expectedCodeIdentity)) errors.push('Parser/generator code identity drift')
  if (JSON.stringify(manifest.scope.inputIdentity) !== JSON.stringify(expectedInputIdentity)) errors.push('Repository generation input identity drift')
  if (manifest.scope.semanticInterpretation !== 'not-applied' || manifest.scope.rawBinaryBytes !== 'not-committed') errors.push('Raw semantic or binary boundary drift')
  if (manifest.scope.traversalPolicy !== 'breadth-first-over-serialized-reference-edges-to-locally-present-Game-packages; no-fixed-depth-limit') errors.push('Traversal policy drift')
  if (manifest.scope.seedResolutionPolicy !== 'repository-catalog-to-local-blueprint-candidates;-serialized-identity-required-for-exact; icon-manifest-is-search-hint-only') errors.push('Catalog-to-Raw seed authority drift')
  if (manifest.catalogSeeds.length !== 271 || manifest.summary.seedCount !== 271) errors.push(`Expected 271 catalog seed rows; received ${manifest.catalogSeeds.length}`)
  const seedIds = manifest.catalogSeeds.map((seed) => `${seed.category}:${seed.catalogId}`)
  if (new Set(seedIds).size !== seedIds.length) errors.push('Catalog seed item is duplicated')
  const sourceCatalog = loadRawCatalog(repositoryRoot)
  const sourceCatalogById = new Map(sourceCatalog.map((item) => [`${item.category}:${item.catalogId}`, item]))
  if (sourceCatalog.length !== manifest.catalogSeeds.length) errors.push('Raw seed row count does not match the repository equipment catalogs')
  const computedSeedStatusCounts = { exact: 0, provisional: 0, ambiguous: 0, 'not-found': 0 }
  let computedCandidateSeedCount = 0
  for (const seed of manifest.catalogSeeds) {
    const sourceItem = sourceCatalogById.get(`${seed.category}:${seed.catalogId}`)
    if (!sourceItem) errors.push(`${seed.catalogId}: seed row is absent from the repository equipment catalogs`)
    else if (sourceItem.displayName !== seed.catalogName || sourceItem.internalId !== seed.catalogInternalId) errors.push(`${seed.catalogId}: catalog metadata differs from its repository equipment catalog entry`)
    computedSeedStatusCounts[seed.status] += 1
    computedCandidateSeedCount += seed.candidates.length
    const derivedStatus = seed.candidates.length === 0 ? 'not-found'
      : seed.candidates.length > 1 ? 'ambiguous'
        : seed.candidates[0]!.evidence.some((evidence) => evidence.startsWith('serialized-identity-match:')) ? 'exact' : 'provisional'
    if (seed.status !== derivedStatus) errors.push(`${seed.catalogId}: seed status cannot be reproduced from its candidate evidence`)
    if (!seed.catalogName) errors.push(`${seed.catalogId}: catalog display name is missing from the seed row`)
    if (!['exact', 'provisional', 'ambiguous', 'not-found'].includes(seed.status)) errors.push(`${seed.catalogId}: invalid seed mapping status`)
    if (seed.status === 'ambiguous' && seed.candidates.length < 2) errors.push(`${seed.catalogId}: ambiguous candidates were collapsed`)
    if (seed.status === 'not-found' && seed.candidates.length > 0) errors.push(`${seed.catalogId}: not-found row unexpectedly has candidates`)
    if (seed.status === 'exact' && seed.candidates.length !== 1) errors.push(`${seed.catalogId}: exact seed must have one Raw package candidate`)
    if (seed.status === 'exact' && !seed.candidates[0]?.evidence.some((evidence) => evidence.startsWith('serialized-identity-match:'))) errors.push(`${seed.catalogId}: exact seed has no serialized catalog-identity evidence`)
    if (seed.status === 'provisional' && seed.candidates.length !== 1) errors.push(`${seed.catalogId}: provisional seed must have exactly one candidate`)
    if (seed.status === 'provisional' && seed.candidates[0]?.evidence.some((evidence) => evidence.startsWith('serialized-identity-match:'))) errors.push(`${seed.catalogId}: serialized identity evidence was downgraded to provisional`)
    if (seed.presentationHint && !seed.matchBasis.includes('icon-manifest-recorded-as-presentation-search-hint-only')) errors.push(`${seed.catalogId}: presentation hint is not marked as search-only evidence`)
    if (seed.matchBasis.some((basis) => basis.startsWith('icon-match-method:'))) errors.push(`${seed.catalogId}: icon match method leaked into Raw identity authority`)
    for (const candidate of seed.candidates) {
      const readStates = candidate.evidence.filter((evidence) => evidence.startsWith('serialized-identity-read-state:'))
      if (readStates.length !== 1) errors.push(`${seed.catalogId}:${candidate.packagePath}: serialized identity availability state is missing or duplicated`)
      if (seed.status === 'exact' && readStates[0] !== 'serialized-identity-read-state:decoded') errors.push(`${seed.catalogId}:${candidate.packagePath}: exact mapping has no decoded serialized identity state`)
      if (!candidate.evidence.includes(`local-uasset:${candidate.packagePath}.uasset`)) errors.push(`${seed.catalogId}:${candidate.packagePath}: candidate lacks local dataset package evidence`)
    }
  }
  for (const catalogId of sourceCatalogById.keys()) if (!seedIds.includes(catalogId)) errors.push(`${catalogId}: repository catalog entry has no Raw seed row`)
  for (const status of ['exact', 'provisional', 'ambiguous', 'not-found'] as const) {
    if (computedSeedStatusCounts[status] !== manifest.summary.seedStatusCounts[status]) errors.push(`Seed status count drift for ${status}`)
  }
  if (computedCandidateSeedCount !== manifest.summary.candidateSeedCount) errors.push('Candidate seed count does not match the catalog mapping rows')

  const packagePaths = new Set<string>()
  const edgeIds = new Set<string>()
  const representativePackages = new Map<string, RawStructuralInventory['packages'][number]>()
  const representativeEdges = new Map<string, RawStructuralInventory['edges']>()
  const representatives = new Set([
    'Dungeons/Content/Actors/Equipment/MeleeWeapons/Gauntlets_Unique3/BP_Gauntlets_Unique3Instance',
    'Dungeons/Content/Actors/Equipment/RangedWeapons/ScatterCrossbow/BP_ScatterCrossbowInstance',
    'Dungeons/Content/Actors/Equipment/Armor/BattleRobe/BP_BattleRobeInstance',
    'Dungeons/Content/Actors/Items/DeathCapMushroom/BP_DeathCapMushroomInstance',
  ])
  let packageCount = 0
  let parsedCount = 0
  let edgeCount = 0
  let nativeReferenceCount = 0
  let resolvedTargetCount = 0
  let unresolvedTargetCount = 0
  let reuseCount = 0
  let dataTableOrCurveCount = 0
  let inheritanceChainCount = 0
  let inheritanceCycleCount = 0
  const superEdges = new Map<string, { readonly sourcePackage: string; readonly sourceObject?: string; readonly rawPackageIndex: number }>()
  const inheritanceRecords: { readonly packagePath: string; readonly chain: RawStructuralInventory['packages'][number]['inheritanceChains'][number] }[] = []
  const parserBoundaries: { packagePath: string; reason: string }[] = []
  const nativeCounts = new Map<string, number>()
  const missingCounts = new Map<string, string[]>()
  for (const shardMeta of manifest.shards) {
    const compressedPath = path.join(artifactRoot, shardMeta.path)
    if (!fs.existsSync(compressedPath)) { errors.push(`Missing structural shard: ${shardMeta.path}`); continue }
    const compressed = fs.readFileSync(compressedPath)
    if (compressed.byteLength !== shardMeta.compressedBytes || hash(compressed) !== shardMeta.compressedSha256) {
      errors.push(`Compressed shard hash/size mismatch: ${shardMeta.path}`)
      continue
    }
    let plain: Buffer
    try { plain = gunzipSync(compressed) } catch { errors.push(`Invalid gzip shard: ${shardMeta.path}`); continue }
    if (plain.byteLength !== shardMeta.uncompressedBytes || hash(plain) !== shardMeta.uncompressedSha256) errors.push(`Uncompressed shard hash/size mismatch: ${shardMeta.path}`)
    const text = plain.toString('utf8')
    let shard: RawStructuralInventoryShard
    try {
      shard = JSON.parse(text) as RawStructuralInventoryShard
    } catch { errors.push(`Invalid shard JSON: ${shardMeta.path}`); continue }
    if (`${JSON.stringify(shard, null, 2)}\n` !== text) errors.push(`Shard is not canonical JSON: ${shardMeta.path}`)
    if (shard.schemaVersion !== 1) errors.push(`Unsupported shard schema: ${shardMeta.path}`)
    if (shard.packages.length !== shardMeta.packageCount || shard.edges.length !== shardMeta.edgeCount) errors.push(`Shard count mismatch: ${shardMeta.path}`)
    packageCount += shard.packages.length
    edgeCount += shard.edges.length
    const localPackages = new Map(shard.packages.map((pkg) => [pkg.path, pkg]))
    for (const pkg of shard.packages) {
      if (packagePaths.has(pkg.path)) errors.push(`Package path is duplicated: ${pkg.path}`)
      packagePaths.add(pkg.path)
      if (JSON.stringify(pkg.parse.codeIdentity) !== JSON.stringify(manifest.scope.codeIdentity)) errors.push(`Parser code identity drift for ${pkg.path}`)
      if (pkg.parse.state === 'parsed') parsedCount += 1
      if (pkg.payloadCoverage.tableLikePackage) dataTableOrCurveCount += 1
      inheritanceChainCount += pkg.inheritanceChains.length
      inheritanceCycleCount += pkg.inheritanceChains.filter((chain) => chain.stopReason === 'cycle-detected').length
      pkg.inheritanceChains.forEach((chain) => inheritanceRecords.push({ packagePath: pkg.path, chain }))
      const boundaryReasons = rawStructuralParserBoundaryReasons(pkg)
      if (boundaryReasons.length) parserBoundaries.push({ packagePath: pkg.path, reason: boundaryReasons.join(',') })
      if (pkg.parse.state === 'parsed' && !pkg.packageHash) errors.push(`Parsed package has no content hash: ${pkg.path}`)
      for (const cdo of pkg.cdoPropertyInventory) for (const property of flattenStructuralProperties(cdo.properties)) {
        if (property.sourceRange.file !== `${pkg.path}.uexp`) errors.push(`Property source file mismatch: ${pkg.path}:${property.path}`)
        if (!pkg.sourceFiles.some((file) => file.path === property.sourceRange.file)) errors.push(`Property range is not backed by package input: ${pkg.path}:${property.path}`)
        if (!['decoded', 'unsupported', 'parse-failed'].includes(property.decoding.state)) errors.push(`Invalid decode state: ${pkg.path}:${property.path}`)
        if (property.decoding.state !== 'decoded' && property.decoding.value !== undefined) errors.push(`Unavailable property has a decoded value: ${pkg.path}:${property.path}`)
      }
      if (representatives.has(pkg.path)) representativePackages.set(pkg.path, pkg)
    }
    for (const edge of shard.edges) {
      edgeCount += 0
      if (!localPackages.has(edge.sourcePackage)) errors.push(`Edge source is outside owning shard: ${edge.id}`)
      if (edgeIds.has(edge.id)) errors.push(`Duplicate edge ID: ${edge.id}`)
      edgeIds.add(edge.id)
      if (edge.targetPackage && !edge.targetPackageName?.startsWith('/Game/')) errors.push(`Dataset target lacks a /Game package name: ${edge.id}`)
      if (edge.targetPackage && edge.targetPackageName !== `/Game/${edge.targetPackage.replace(/^Dungeons\/Content\//, '')}`) errors.push(`Package path does not match target package name: ${edge.id}`)
      const source = localPackages.get(edge.sourcePackage)
      for (const range of [edge.sourceOccurrence.sourceRange, edge.sourceOccurrence.valueRange]) {
        if (range && !source?.sourceFiles.some((file) => file.path === range.file)) errors.push(`Source occurrence file has no package hash: ${edge.id}`)
        if (range && range.start > range.end) errors.push(`Source occurrence byte range is reversed: ${edge.id}`)
      }
      if (edge.traversal.stopReason === 'native-boundary') {
        if (!edge.targetPackageName?.startsWith('/Script/')) errors.push(`Native boundary misclassified: ${edge.id}`)
        else { nativeCounts.set(edge.targetPackageName, (nativeCounts.get(edge.targetPackageName) ?? 0) + 1); nativeReferenceCount += 1 }
      }
      if (edge.traversal.stopReason === 'missing-target') {
        if (!edge.targetPackageName?.startsWith('/Game/') || edge.targetPackage) errors.push(`Missing target misclassified: ${edge.id}`)
        const list = missingCounts.get(edge.targetPackageName!) ?? []
        list.push(edge.id)
        missingCounts.set(edge.targetPackageName!, list)
      }
      if (edge.targetKind !== 'null' && edge.targetKind !== 'invalid' && Boolean(edge.targetPackageName || edge.targetPackage)) resolvedTargetCount += 1
      if (['missing-target', 'unresolved-package-index', 'invalid-package-index'].includes(edge.traversal.stopReason)) unresolvedTargetCount += 1
      if (edge.traversal.stopReason === 'already-visited') reuseCount += 1
      if (edge.kind === 'super') superEdges.set(edge.id, {
        sourcePackage: edge.sourcePackage, sourceObject: edge.sourceOccurrence.sourceObject,
        rawPackageIndex: edge.sourceOccurrence.rawPackageIndex,
      })
      if (representatives.has(edge.sourcePackage)) {
        const existing = representativeEdges.get(edge.sourcePackage) ?? []
        representativeEdges.set(edge.sourcePackage, [...existing, edge])
      }
    }
  }
  if (packageCount !== manifest.summary.visitedPackageCount || packageCount !== packagePaths.size) errors.push('Visited package count does not match the package shards')
  if (parsedCount !== manifest.summary.parsedPackageCount) errors.push('Parsed package count does not match the package shards')
  if (edgeCount !== manifest.summary.edgeCount) errors.push('Edge count does not match the edge shards')
  if (nativeCounts.size !== manifest.summary.nativeBoundaryCount || nativeReferenceCount < manifest.summary.nativeBoundaryCount) errors.push('Native boundary count drift')
  if (parserBoundaries.length !== manifest.summary.parserBoundaryCount) errors.push('Parser boundary count drift')
  if (dataTableOrCurveCount !== manifest.summary.dataTableOrCurveReachedCount) errors.push('DataTable/Curve count drift')
  if (unresolvedTargetCount !== manifest.summary.unresolvedTargetCount) errors.push('Unresolved target count drift')
  if (resolvedTargetCount !== manifest.summary.resolvedTargetCount) errors.push('Resolved target count drift')
  if (reuseCount !== manifest.summary.cycleOrReuseEdgeCount) errors.push('Cycle/reuse edge count drift')
  if (inheritanceChainCount !== manifest.summary.inheritanceChainCount) errors.push('Inheritance chain count drift')
  if (inheritanceCycleCount !== manifest.summary.inheritanceCycleCount) errors.push('Inheritance cycle count drift')
  for (const { packagePath, chain } of inheritanceRecords) {
    for (let index = 0; index < chain.hops.length; index += 1) {
      const hop = chain.hops[index]!
      const superEdge = superEdges.get(hop.edgeId)
      if (!superEdge) { errors.push(`Inheritance chain references unknown super edge: ${hop.edgeId}`); continue }
      if (index === 0 && (superEdge.sourcePackage !== packagePath || superEdge.sourceObject !== chain.sourceObject)) errors.push(`Inheritance chain starts on the wrong class: ${packagePath}:${chain.sourceObject}`)
      if (index > 0) {
        const previous = chain.hops[index - 1]!
        const expectedObject = previous.targetObject?.split('.').at(-1)
        if (superEdge.sourcePackage !== previous.targetPackage || superEdge.sourceObject !== expectedObject) errors.push(`Inheritance hop does not follow its parent class: ${packagePath}:${chain.sourceObject}`)
      }
    }
    if (chain.stopReason === 'no-super-reference' && chain.hops.at(-1)?.rawPackageIndex !== 0) errors.push(`Inheritance chain stop does not retain the null super reference: ${packagePath}:${chain.sourceObject}`)
  }
  const expectedParserBoundaries = new Map(manifest.boundaries.parser.map((entry) => [entry.packagePath, entry.reason]))
  for (const boundary of parserBoundaries) if (expectedParserBoundaries.get(boundary.packagePath) !== boundary.reason) errors.push(`Parser boundary missing/mismatched: ${boundary.packagePath}`)
  if (expectedParserBoundaries.size !== parserBoundaries.length) errors.push('Parser boundary inventory count drift')
  const expectedNativeBoundaries = new Map(manifest.boundaries.native.map((entry) => [entry.packageName, entry.referenceCount]))
  for (const [packageName, count] of nativeCounts) if (expectedNativeBoundaries.get(packageName) !== count) errors.push(`Native boundary count mismatch: ${packageName}`)
  if (expectedNativeBoundaries.size !== nativeCounts.size) errors.push('Native boundary package inventory count drift')
  const expectedMissing = new Map(manifest.boundaries.missingTargets.map((entry) => [entry.packageName, entry.sourceEdgeIds.join('\0')]))
  for (const [packageName, ids] of missingCounts) if (expectedMissing.get(packageName) !== [...ids].sort().join('\0')) errors.push(`Missing target evidence mismatch: ${packageName}`)
  if (expectedMissing.size !== missingCounts.size) errors.push('Missing target package inventory count drift')
  for (const seed of manifest.catalogSeeds) for (const candidate of seed.candidates) if (!packagePaths.has(candidate.packagePath)) errors.push(`Candidate seed package was not visited: ${seed.catalogId}:${candidate.packagePath}`)
  for (const shard of manifest.shards) {
    const shardPath = path.join(artifactRoot, shard.path)
    if (!fs.existsSync(shardPath)) continue
    const parsedShard = JSON.parse(gunzipSync(fs.readFileSync(shardPath)).toString('utf8')) as RawStructuralInventoryShard
    for (const edge of parsedShard.edges) {
      if (edge.traversal.stopReason === 'followed' || edge.traversal.stopReason === 'already-visited') {
        if (!edge.targetPackage || !packagePaths.has(edge.targetPackage)) errors.push(`Traversed target has no package node: ${edge.id}`)
      }
      if (edge.traversal.stopReason === 'package-local-reference' && edge.targetPackage !== edge.sourcePackage) errors.push(`Package-local reference has a different target: ${edge.id}`)
      if (edge.traversal.stopReason === 'null-reference' && edge.targetKind !== 'null') errors.push(`Null boundary misclassified: ${edge.id}`)
    }
  }
  errors.push(...validateFourReferenceSlices(representativePackages, representativeEdges, repositoryRoot))
  errors.push(...validateKnownCatalogSeedMappings(manifest.catalogSeeds))
  if (/"(?:normalizedProperty|normalizedValue|interpretation|manualAnnotation|damageScaling|effectiveCadence|stackingSemantics)"/.test(JSON.stringify(manifest))) errors.push('Semantic interpretation leaked into the Raw structural manifest')
  if (/\/Users\/|\\Users\\|file:\/\/|~\/Downloads|\/home\/|\/root\//.test(JSON.stringify(manifest))) errors.push('Manifest contains an absolute local path')
  return errors
}

function validateKnownCatalogSeedMappings(seeds: RawStructuralInventory['catalogSeeds']): string[] {
  const errors: string[] = []
  const expectedGauntletCandidates = [
    'Dungeons/Content/Actors/Equipment/MeleeWeapons/Gauntlets_Unique1/BP_Gauntlets_Unique1Instance',
    'Dungeons/Content/Actors/Equipment/MeleeWeapons/Gauntlets_Unique2/BP_Gauntlets_Unique2Instance',
    'Dungeons/Content/Actors/Equipment/MeleeWeapons/Gauntlets_Unique3/BP_Gauntlets_Unique3Instance',
  ].sort()
  const expectedMappings: readonly { readonly catalogId: string; readonly status: 'provisional' | 'ambiguous'; readonly candidatePaths: readonly string[] }[] = [
    { catalogId: 'fighters-bindings', status: 'ambiguous', candidatePaths: expectedGauntletCandidates },
    { catalogId: 'maulers', status: 'ambiguous', candidatePaths: expectedGauntletCandidates },
    { catalogId: 'soul-fists', status: 'ambiguous', candidatePaths: expectedGauntletCandidates },
    { catalogId: 'satchel-of-elements', status: 'provisional', candidatePaths: ['Dungeons/Content/Content_DLC3/Actors/Items/SatchelOfTheElements/BP_SatchelOfTheElementsInstance'] },
    { catalogId: 'scatter-mines', status: 'provisional', candidatePaths: ['Dungeons/Content/Content_DLC3/Actors/Items/ChargedRedstoneMines/BP_ChargedRedstoneMinesInstance'] },
    { catalogId: 'fireworks-arrow', status: 'ambiguous', candidatePaths: [
      'Dungeons/Content/Actors/Items/FireworksArrow/BP_FireworksArrowInstance',
      'Dungeons/Content/Actors/Items/FireworksArrowItem/BP_FireworksArrowInstance',
      'Dungeons/Content/Actors/Items/FireworksArrowItem/BP_FireworksArrowItemInstance',
    ] },
  ]
  for (const expected of expectedMappings) {
    const seed = seeds.find((entry) => entry.catalogId === expected.catalogId)
    if (!seed) { errors.push(`Known catalog-to-Raw seed mapping is missing: ${expected.catalogId}`); continue }
    if (seed.status !== expected.status) errors.push(`${expected.catalogId}: expected Raw candidate status ${expected.status}; received ${seed.status}`)
    const actualPaths = seed.candidates.map((candidate) => candidate.packagePath).sort()
    if (JSON.stringify(actualPaths) !== JSON.stringify([...expected.candidatePaths].sort())) errors.push(`${expected.catalogId}: catalog entry maps to unexpected Raw candidate set (${actualPaths.join(', ')})`)
  }
  return errors
}

function validateFourReferenceSlices(
  packages: ReadonlyMap<string, RawStructuralInventory['packages'][number]>,
  edgesByPackage: ReadonlyMap<string, RawStructuralInventory['edges']>,
  root: string,
): string[] {
  const errors: string[] = []
  const representatives = [
    'Dungeons/Content/Actors/Equipment/MeleeWeapons/Gauntlets_Unique3/BP_Gauntlets_Unique3Instance',
    'Dungeons/Content/Actors/Equipment/RangedWeapons/ScatterCrossbow/BP_ScatterCrossbowInstance',
    'Dungeons/Content/Actors/Equipment/Armor/BattleRobe/BP_BattleRobeInstance',
    'Dungeons/Content/Actors/Items/DeathCapMushroom/BP_DeathCapMushroomInstance',
  ]
  for (const packagePath of representatives) {
    const spec = RAW_PACKAGE_SPECS.find((candidate) => candidate.packagePath === packagePath)
    if (!spec) { errors.push(`Missing reference-slice snapshot spec: ${packagePath}`); continue }
    const snapshot = JSON.parse(fs.readFileSync(path.join(root, spec.artifactPath), 'utf8')) as RawPackageSnapshot
    const packageNode = packages.get(packagePath)
    const edges = edgesByPackage.get(packagePath) ?? []
    if (!packageNode) { errors.push(`Representative seed package was not visited: ${packagePath}`); continue }
    const snapshotGamePackages = new Set(snapshot.package.imports.flatMap((entry) => {
      const rootName = entry.outerReference.objectName
      return rootName?.startsWith('/Game/') ? [rootName] : []
    }))
    for (const packageName of snapshotGamePackages) {
      if (!edges.some((edge) => edge.kind === 'import' && edge.targetPackageName === packageName)) errors.push(`${packagePath}: Raw snapshot Game import missing from structural edges: ${packageName}`)
    }
    for (const entry of snapshot.package.exports) for (const field of ['classReference', 'superReference', 'templateReference', 'outerReference'] as const) {
      const reference = entry[field]
      if (!reference.rawPackageIndex) continue
      const kind = field.replace('Reference', '') as 'class' | 'super' | 'template' | 'outer'
      if (!edges.some((edge) => edge.kind === kind && edge.sourceOccurrence.sourceObject === entry.objectName.value && edge.sourceOccurrence.rawPackageIndex === reference.rawPackageIndex)) {
        errors.push(`${packagePath}: export ${field} relation differs for ${entry.objectName.value}`)
      }
    }
    const rawReferences = flattenRawProperties(snapshot.package.objects.flatMap((object) => object.properties ?? []))
      .filter((property) => property.type.value === 'ObjectProperty' && property.decoding.state === 'decoded')
    for (const property of rawReferences) {
      const target = property.decoding.value as { rawPackageIndex?: number } | undefined
      if (!target?.rawPackageIndex) continue
      if (!edges.some((edge) => edge.kind === 'object-property' && edge.sourceOccurrence.propertyPath === property.path && edge.sourceOccurrence.rawPackageIndex === target.rawPackageIndex)) {
        errors.push(`${packagePath}: CDO property reference differs for ${property.path}`)
      }
    }
    const decodedSnapshotProperties = snapshot.package.objects.find((object) => object.isClassDefaultObject)?.properties?.length ?? 0
    const decodedGraphProperties = packageNode.cdoPropertyInventory.reduce((sum, cdo) => sum + cdo.properties.length, 0)
    if (decodedSnapshotProperties !== decodedGraphProperties) errors.push(`${packagePath}: CDO property inventory top-level count differs from Raw snapshot`)
    const classExport = snapshot.package.exports.find((entry) => entry.objectName.value.endsWith('_C') && !entry.objectName.value.startsWith('Default__'))
    const graphChain = packageNode.inheritanceChains.find((chain) => chain.sourceObject === classExport?.objectName.value)
    if (classExport?.superReference.rawPackageIndex && (!graphChain || graphChain.hops[0]?.rawPackageIndex !== classExport.superReference.rawPackageIndex)) {
      errors.push(`${packagePath}: inheritance chain start differs from Raw export super reference`)
    }
  }
  return errors
}

function flattenStructuralProperties(properties: RawStructuralInventory['packages'][number]['cdoPropertyInventory'][number]['properties']): RawStructuralInventory['packages'][number]['cdoPropertyInventory'][number]['properties'][number][] {
  const result: RawStructuralInventory['packages'][number]['cdoPropertyInventory'][number]['properties'][number][] = []
  const visit = (property: RawStructuralInventory['packages'][number]['cdoPropertyInventory'][number]['properties'][number]) => {
    result.push(property)
    property.decoding.properties?.forEach(visit)
    property.decoding.elements?.forEach((element) => element.properties?.forEach(visit))
  }
  properties.forEach(visit)
  return result
}

function flattenRawProperties(properties: NonNullable<RawPackageSnapshot['package']['objects'][number]['properties']>): NonNullable<RawPackageSnapshot['package']['objects'][number]['properties']>[number][] {
  const result: NonNullable<RawPackageSnapshot['package']['objects'][number]['properties']>[number][] = []
  const visit = (property: NonNullable<RawPackageSnapshot['package']['objects'][number]['properties']>[number]) => {
    result.push(property)
    property.decoding.properties?.forEach(visit)
    property.decoding.elements?.forEach((element) => element.properties?.forEach(visit))
  }
  properties.forEach(visit)
  return result
}

function hash(bytes: Uint8Array): string {
  return crypto.createHash('sha256').update(bytes).digest('hex')
}

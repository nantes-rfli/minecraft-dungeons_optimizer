import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { createPhase65CExtractionRecord, isCanonicalGameDataPath, validateGameDataProvenanceRecord, type GameDataProvenanceRecord } from '../src/research/gameDataProvenance.ts'
import type { SemanticMappingCategory } from '../src/research/gameDataSemanticMapping.ts'
import { matchingSemanticRule } from '../src/research/gameDataSemanticRules.ts'
import { parseUePackage } from '../src/research/ue4/packageReader.ts'
import type { UeDiagnostic } from '../src/research/ue4/packageTypes.ts'
import { PARSER_ID, PARSER_SCHEMA_VERSION, assertSafeAssetPath, flattenProperties, hashLogicalAsset, localDatasetRoot } from './game-data-extractor.ts'

export const BULK_HARVEST_SCHEMA_VERSION = 1 as const
export const BULK_MAXIMUM_REFERENCE_DEPTH = 3 as const

export interface AssetIndexEntry {
  readonly path: string
  readonly entity?: string
  readonly serializedItemId?: string
  readonly files: readonly string[]
  readonly assetKind: string
  readonly researchRelevance: string
}

export interface GameDataAssetIndex {
  readonly schemaVersion: number
  readonly sourceFingerprint: { readonly algorithm: string; readonly value: string }
  readonly assets: readonly AssetIndexEntry[]
}

export interface BulkCandidate {
  readonly path: string
  readonly entity?: string
  readonly files: readonly [string, string]
  readonly category: SemanticMappingCategory
}

export interface BulkAssetSummary {
  readonly path: string
  readonly category: SemanticMappingCategory
  readonly entity?: string
  readonly serializedItemId?: string
  readonly status: 'parsed' | 'skipped' | 'failed'
  readonly contentHash?: { readonly algorithm: 'sha256'; readonly value: string }
  readonly cdoName?: string
  readonly parsedPropertyCount: number
  readonly selectedRecordCount: number
  readonly diagnosticCount: number
  readonly failureReason?: string
}

export interface GameDataBulkHarvestArtifact {
  readonly schemaVersion: 1
  readonly datasetId: string
  readonly sourceFingerprint: { readonly algorithm: string; readonly value: string }
  readonly parser: { readonly id: typeof PARSER_ID; readonly schemaVersion: typeof PARSER_SCHEMA_VERSION }
  readonly selection: {
    readonly candidateCount: number
    readonly parsedCount: number
    readonly skippedCount: number
    readonly failedCount: number
    readonly maximumReferenceDepth: 3
    readonly cycleDetectionKey: 'datasetId + logical asset path'
    readonly candidatePolicy: string
  }
  readonly summary: {
    readonly extractedFactCount: number
    readonly diagnosticCount: number
    readonly fatalParseRate: number
    readonly byGameplayRoot: Readonly<Record<string, { readonly candidates: number; readonly parsed: number; readonly failed: number; readonly records: number }>>
  }
  readonly assets: readonly BulkAssetSummary[]
  readonly records: readonly GameDataProvenanceRecord[]
  readonly diagnosticsSummary: readonly { readonly code: string; readonly propertyType?: string; readonly count: number; readonly fatal: boolean }[]
  readonly runtimePromotion: 'not-performed'
}

const ROOTS: readonly { marker: string; category: SemanticMappingCategory; label: string }[] = [
  { marker: '/Actors/Equipment/Armor/', category: 'armor-property', label: 'Armor' },
  { marker: '/Actors/Equipment/MeleeWeapons/', category: 'melee-weapon', label: 'MeleeWeapons' },
  { marker: '/Actors/Equipment/RangedWeapons/', category: 'ranged-weapon', label: 'RangedWeapons' },
  { marker: '/Actors/Items/', category: 'artifact', label: 'Items' },
  { marker: '/Components/Enchantments/', category: 'enchantment', label: 'Enchantments' },
  { marker: '/Components/ArmorProperties/', category: 'armor-property', label: 'ArmorProperties' },
] as const

export function discoverBulkCandidates(index: GameDataAssetIndex): BulkCandidate[] {
  return index.assets.flatMap((asset): BulkCandidate[] => {
    const root = ROOTS.find((candidate) => asset.path.includes(candidate.marker))
    if (!root) return []
    const assetName = basename(asset.path)
    if (!assetName.startsWith('BP_')) return []
    const mechanicsClass = /(?:Instance|GameplayEffect|Storable|Actor|ACtor|Weapon|Armor|Enchantment)$/.test(assetName)
      || (root.category === 'ranged-weapon' && /(?:Arrow|Projectile)/i.test(assetName))
      || root.category === 'enchantment' || root.label === 'ArmorProperties'
    if (!mechanicsClass) return []
    const expected = [`${asset.path}.uasset`, `${asset.path}.uexp`] as const
    if (!expected.every((file) => asset.files.includes(file))) return []
    return [{ path: asset.path, ...(asset.entity ? { entity: asset.entity } : {}), files: expected, category: root.category }]
  }).sort((left, right) => left.path.localeCompare(right.path))
}

export function walkBoundedReferences(
  datasetId: string,
  startPaths: readonly string[],
  referencesOf: (path: string) => readonly string[],
  maximumDepth = BULK_MAXIMUM_REFERENCE_DEPTH,
): { readonly visited: readonly string[]; readonly cycleCount: number; readonly depthLimitCount: number } {
  const visited = new Set<string>()
  const active = new Set<string>()
  let cycleCount = 0
  let depthLimitCount = 0
  const visit = (assetPath: string, depth: number): void => {
    const key = `${datasetId}\0${assetPath}`
    if (active.has(key)) { cycleCount += 1; return }
    if (visited.has(key)) return
    visited.add(key)
    if (depth >= maximumDepth) {
      if (referencesOf(assetPath).length > 0) depthLimitCount += 1
      return
    }
    active.add(key)
    referencesOf(assetPath).slice().sort((left, right) => left.localeCompare(right)).forEach((reference) => visit(reference, depth + 1))
    active.delete(key)
  }
  startPaths.slice().sort((left, right) => left.localeCompare(right)).forEach((assetPath) => visit(assetPath, 0))
  return { visited: [...visited].map((key) => key.slice(key.indexOf('\0') + 1)).sort((left, right) => left.localeCompare(right)), cycleCount, depthLimitCount }
}

export function buildGameDataBulkHarvestArtifact(repositoryRoot: string, datasetId: string, index: GameDataAssetIndex): GameDataBulkHarvestArtifact {
  const datasetRoot = localDatasetRoot(repositoryRoot)
  const candidates = discoverBulkCandidates(index)
  const assets: BulkAssetSummary[] = []
  const records: GameDataProvenanceRecord[] = []
  const diagnostics: UeDiagnostic[] = []
  for (const candidate of candidates) {
    assertSafeAssetPath(candidate.path)
    try {
      const parsed = parseUePackage(
        fs.readFileSync(path.join(datasetRoot, candidate.files[0])),
        fs.readFileSync(path.join(datasetRoot, candidate.files[1])),
        { assetPath: candidate.path },
      )
      diagnostics.push(...parsed.diagnostics)
      const fatalDiagnostics = parsed.diagnostics.filter((diagnostic) => !diagnostic.skipped && diagnostic.code === 'malformed-property-tag')
      if (fatalDiagnostics.length > 0) {
        assets.push({
          path: candidate.path, category: candidate.category, ...(candidate.entity ? { entity: candidate.entity } : {}),
          status: 'failed', parsedPropertyCount: 0, selectedRecordCount: 0,
          diagnosticCount: parsed.diagnostics.length, failureReason: 'incomplete-cdo-property-stream',
        })
        continue
      }
      const cdo = parsed.objects[0]
      if (!cdo) {
        assets.push({ path: candidate.path, category: candidate.category, ...(candidate.entity ? { entity: candidate.entity } : {}), status: 'skipped', parsedPropertyCount: 0, selectedRecordCount: 0, diagnosticCount: parsed.diagnostics.length, failureReason: 'no-class-default-object' })
        continue
      }
      const properties = flattenProperties(cdo.properties)
      const itemId = properties.find((property) => property.path === 'ItemIdName')?.value
      const facts = properties.filter((property) => matchingSemanticRule(candidate.category, basename(candidate.path), property.path))
      if (candidate.category === 'enchantment' && properties.length === 0) {
        facts.push({ name: '$cdo.declaredPropertyCount', type: 'StructuralObservation', arrayIndex: 0, serializedSize: 0, value: 0, path: '$cdo.declaredPropertyCount', byteRange: { start: 0, end: 0 } })
      }
      const contentHash = { algorithm: 'sha256' as const, value: hashLogicalAsset(datasetRoot, candidate.files) }
      const selected = facts.map((property) => createPhase65CExtractionRecord({
        id: recordId(candidate.path, property.path), datasetId, assetPath: candidate.path,
        sourceFiles: candidate.files, contentHash,
        extraction: {
          parserId: PARSER_ID, parserSchemaVersion: PARSER_SCHEMA_VERSION, objectName: cdo.objectName,
          ...(cdo.className ? { className: cdo.className } : {}), propertyName: property.name,
          propertyPath: property.path, propertyType: property.type,
        },
        rawObservation: { value: property.value },
        confidence: { source: 'medium', extraction: 'high', semantics: 'unknown', version: 'low' },
        crossCheckStatus: 'not-compared', status: 'extracted',
      }))
      records.push(...selected)
      assets.push({
        path: candidate.path, category: candidate.category, ...(candidate.entity ? { entity: candidate.entity } : {}),
        status: 'parsed', contentHash, cdoName: cdo.objectName, parsedPropertyCount: properties.length,
        selectedRecordCount: selected.length, diagnosticCount: parsed.diagnostics.length,
        ...(typeof itemId === 'string' ? { serializedItemId: itemId } : {}),
      } as BulkAssetSummary)
    } catch (error) {
      assets.push({ path: candidate.path, category: candidate.category, ...(candidate.entity ? { entity: candidate.entity } : {}), status: 'failed', parsedPropertyCount: 0, selectedRecordCount: 0, diagnosticCount: 1, failureReason: safeFailureReason(error) })
    }
  }
  const parsedCount = assets.filter((asset) => asset.status === 'parsed').length
  const skippedCount = assets.filter((asset) => asset.status === 'skipped').length
  const failedCount = assets.filter((asset) => asset.status === 'failed').length
  const exceptionFailureCount = assets.filter((asset) => asset.status === 'failed' && asset.failureReason !== 'incomplete-cdo-property-stream').length
  const byGameplayRoot = Object.fromEntries(ROOTS.map((root) => {
    const selected = assets.filter((asset) => asset.path.includes(root.marker))
    return [root.label, { candidates: selected.length, parsed: selected.filter((asset) => asset.status === 'parsed').length, failed: selected.filter((asset) => asset.status === 'failed').length, records: selected.reduce((sum, asset) => sum + asset.selectedRecordCount, 0) }]
  }))
  return {
    schemaVersion: BULK_HARVEST_SCHEMA_VERSION, datasetId, sourceFingerprint: index.sourceFingerprint,
    parser: { id: PARSER_ID, schemaVersion: PARSER_SCHEMA_VERSION },
    selection: {
      candidateCount: candidates.length, parsedCount, skippedCount, failedCount,
      maximumReferenceDepth: BULK_MAXIMUM_REFERENCE_DEPTH, cycleDetectionKey: 'datasetId + logical asset path',
      candidatePolicy: 'paired BP mechanics classes under gameplay roots, including DLC/Patch branches',
    },
    summary: {
      extractedFactCount: records.length, diagnosticCount: diagnostics.length + exceptionFailureCount,
      fatalParseRate: candidates.length === 0 ? 0 : failedCount / candidates.length,
      byGameplayRoot,
    },
    assets, records: records.sort((left, right) => left.id.localeCompare(right.id)),
    diagnosticsSummary: summarizeDiagnostics(diagnostics, exceptionFailureCount), runtimePromotion: 'not-performed',
  }
}

export function collectBulkHarvestErrors(artifact: GameDataBulkHarvestArtifact, datasetId: string, index: GameDataAssetIndex): string[] {
  const errors: string[] = []
  const serialized = JSON.stringify(artifact)
  const expected = discoverBulkCandidates(index)
  if (artifact.schemaVersion !== BULK_HARVEST_SCHEMA_VERSION) errors.push('Unsupported bulk harvest schema version')
  if (artifact.datasetId !== datasetId) errors.push('Bulk harvest datasetId does not match provenance')
  if (artifact.sourceFingerprint.value !== index.sourceFingerprint.value) errors.push('Bulk harvest source fingerprint does not match Asset Index')
  if (artifact.parser.id !== PARSER_ID || artifact.parser.schemaVersion !== PARSER_SCHEMA_VERSION) errors.push('Bulk parser identity is invalid')
  if (artifact.selection.candidateCount !== expected.length) errors.push('Bulk candidate count differs from deterministic Asset Index selection')
  if (artifact.selection.maximumReferenceDepth !== 3 || artifact.selection.cycleDetectionKey !== 'datasetId + logical asset path') errors.push('Reference graph safety boundary is invalid')
  if (artifact.assets.length !== expected.length || JSON.stringify(artifact.assets.map((asset) => asset.path)) !== JSON.stringify(expected.map((asset) => asset.path))) errors.push('Bulk asset summaries differ from deterministic candidates')
  if (artifact.selection.parsedCount + artifact.selection.skippedCount + artifact.selection.failedCount !== artifact.selection.candidateCount) errors.push('Bulk candidate status partition is inconsistent')
  if (artifact.summary.extractedFactCount !== artifact.records.length) errors.push('Bulk extracted fact count is inconsistent')
  if (artifact.records.length !== artifact.assets.reduce((sum, asset) => sum + asset.selectedRecordCount, 0)) errors.push('Bulk asset selected-record counts are inconsistent')
  if (artifact.summary.diagnosticCount !== artifact.diagnosticsSummary.reduce((sum, diagnostic) => sum + diagnostic.count, 0)) errors.push('Bulk diagnostics summary is inconsistent')
  if (artifact.runtimePromotion !== 'not-performed') errors.push('Bulk harvest must not perform runtime promotion')
  if (/\/Users\/|\\Users\\|file:\/\/|~\/Downloads|\/home\/|\/root\//.test(serialized)) errors.push('Bulk artifact contains an absolute or private path')
  if (/\.(?:uasset|uexp|umap|ubulk)"\s*:\s*"[A-Za-z0-9+/]{100}/.test(serialized)) errors.push('Bulk artifact appears to contain raw binary')
  const recordIds = artifact.records.map((record) => record.id)
  if (new Set(recordIds).size !== recordIds.length) errors.push('Bulk artifact contains duplicate record IDs')
  if (JSON.stringify(recordIds) !== JSON.stringify([...recordIds].sort())) errors.push('Bulk records are not deterministically ordered')
  for (const record of artifact.records) {
    errors.push(...validateGameDataProvenanceRecord(record).map((error) => `${record.id}: ${error}`))
    if (record.status !== 'extracted' || record.promotionStatus !== 'research-only' || record.interpretation || record.confidence.semantics !== 'unknown') errors.push(`${record.id}: structural evidence boundary changed`)
    if (!isCanonicalGameDataPath(record.asset.path)) errors.push(`${record.id}: asset path is not canonical`)
    const asset = artifact.assets.find((candidate) => candidate.path === record.asset.path)
    if (!asset || asset.contentHash?.value !== record.asset.contentHash?.value) errors.push(`${record.id}: content hash is not linked to its asset summary`)
  }
  if (artifact.selection.failedCount / Math.max(1, artifact.selection.candidateCount) > 0.05) errors.push('Fatal parse rate exceeds the 5% completion gate')
  return [...new Set(errors)].sort()
}

export function renderBulkHarvestReport(artifact: GameDataBulkHarvestArtifact): string {
  const roots = Object.entries(artifact.summary.byGameplayRoot).map(([root, value]) => `| ${root} | ${value.candidates} | ${value.parsed} | ${value.failed} | ${value.records} |`).join('\n')
  const diagnostics = artifact.diagnosticsSummary.map((entry) => `| ${entry.code} | ${entry.propertyType ?? '—'} | ${entry.count} | ${entry.fatal ? 'yes' : 'no'} |`).join('\n') || '| — | — | 0 | no |'
  return `# Game Data Bulk Harvest — Phase 6.5E

## Candidate selection

The Asset Index deterministically selects paired \`.uasset + .uexp\` Blueprint mechanics classes under the six gameplay roots, including DLC and Patch branches. Visual-only classes are excluded. Each logical asset is parsed and discarded before the next asset; full parse trees remain local-only.

## Parser coverage

- Candidate logical assets: ${artifact.selection.candidateCount}
- Parsed: ${artifact.selection.parsedCount}
- Skipped: ${artifact.selection.skippedCount}
- Fatal failures: ${artifact.selection.failedCount}
- Fatal parse rate: ${(artifact.summary.fatalParseRate * 100).toFixed(2)}%
- Maximum reference depth: ${artifact.selection.maximumReferenceDepth}; cycle key: \`${artifact.selection.cycleDetectionKey}\`

| Gameplay root | Candidates | Parsed | Failed | Selected facts |
| --- | ---: | ---: | ---: | ---: |
${roots}

## Extracted Gap-relevant facts

${artifact.records.length} compact structural facts were retained. Every record is \`extracted\`, has semantic confidence \`unknown\`, remains \`research-only\`, and links to a logical-asset SHA-256 content hash and dataset provenance. Full property trees and raw binaries are not committed.

## Semantic boundary

Only property paths recognized by the explicit Phase 6.5E rule registry are retained. Raw Damage scalars and presentation priority/color metadata are negative controls and are not promoted to gameplay magnitudes. Semantic mappings live in a separate artifact.

## Diagnostics

| Code | Property type | Count | Fatal |
| --- | --- | ---: | --- |
${diagnostics}

Diagnostic volume alone is not a failure. Fatal package failures are separately gated at 5%; safe unsupported payloads remain explicit.

## Known limitations

- Effective inheritance and native executable behavior are not evaluated.
- GameplayEffect internals are retained only where an explicit rule establishes meaning.
- Static asset timing does not replace empirical cadence, stacking, ownership, distribution, or Power-curve protocols by default.
- Runtime catalogs, support manifests, Optimizer values, score models, and objective weights are unchanged.
`
}

export function serializeBulkArtifact(value: unknown): string { return `${JSON.stringify(value, null, 2)}\n` }

function summarizeDiagnostics(diagnostics: readonly UeDiagnostic[], failedCount: number): GameDataBulkHarvestArtifact['diagnosticsSummary'] {
  const counts = new Map<string, { code: string; propertyType?: string; count: number; fatal: boolean }>()
  for (const diagnostic of diagnostics) {
    const key = `${diagnostic.code}\0${diagnostic.propertyType ?? ''}`
    const current = counts.get(key) ?? { code: diagnostic.code, ...(diagnostic.propertyType ? { propertyType: diagnostic.propertyType } : {}), count: 0, fatal: !diagnostic.skipped && diagnostic.code !== 'trailing-bytes' }
    current.count += 1
    counts.set(key, current)
  }
  if (failedCount) counts.set('fatal-package\0', { code: 'fatal-package', count: failedCount, fatal: true })
  return [...counts.values()].sort((left, right) => right.count - left.count || left.code.localeCompare(right.code))
}

function recordId(assetPath: string, propertyPath: string): string {
  const key = crypto.createHash('sha256').update(`${assetPath}\0${propertyPath}`).digest('hex').slice(0, 16)
  return `bulk-${slug(basename(assetPath))}-${key}`
}

function safeFailureReason(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error)
  return text.replaceAll(/\/Users\/[^/]+/g, '<user>').slice(0, 240)
}

function basename(value: string): string { return value.slice(value.lastIndexOf('/') + 1) }
function slug(value: string): string { return value.replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() }

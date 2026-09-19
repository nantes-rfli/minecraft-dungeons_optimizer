import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import type { GameDataSourceProvenance, JsonValue } from '../src/research/gameDataProvenance.ts'
import { PackageObjectResolver } from '../src/research/ue4/objectResolver.ts'
import { parseUePackage } from '../src/research/ue4/packageReader.ts'
import type {
  BinaryByteRange, ParsedProperty, ParsedUePackage, ResolvedPackageIndex,
  UeDiagnostic, UeExportEntry, UeFName, UeImportEntry, UeNameEntry,
} from '../src/research/ue4/packageTypes.ts'
import {
  PARSER_ID, PARSER_SCHEMA_VERSION, assertSafeAssetPath, hashLogicalAsset, localDatasetRoot,
} from './game-data-extractor.ts'

export const RAW_PACKAGE_SNAPSHOT_SCHEMA_VERSION = 1 as const
export const RAW_PACKAGE_PATH = 'Dungeons/Content/Actors/Equipment/MeleeWeapons/Gauntlets_Unique3/BP_Gauntlets_Unique3Instance' as const
export const RAW_PACKAGE_ARTIFACT_PATH = 'research/raw/packages/Dungeons/Content/Actors/Equipment/MeleeWeapons/Gauntlets_Unique3/BP_Gauntlets_Unique3Instance.raw.json' as const
export const RAW_PACKAGE_REPORT_PATH = 'docs/game-data-raw-package-snapshot.md' as const

export const EXPECTED_RAW_PACKAGE_FILES = [
  {
    path: `${RAW_PACKAGE_PATH}.uasset`, size: 5607,
    sha256: '5d69dd6957b23704f35c5b5fca315c7b6bf53b9f8994445acf2547bd5065226c',
  },
  {
    path: `${RAW_PACKAGE_PATH}.uexp`, size: 5558,
    sha256: 'a4793e11abfa8e5ecea3fab7f86f46cc9aa8a91486c6f6b5d78f85016952e86c',
  },
] as const

const EXTRACTION_CONFIGURATION = {
  logicalPackageUnit: 'one-logical-package-one-extraction-result' as const,
  packageExtensions: ['.uasset', '.uexp'] as const,
  strictPropertyTermination: false,
  propertySelection: 'none' as const,
  crossPackageReferenceResolution: 'not-performed' as const,
  nonCdoExportDecoding: 'not-extracted' as const,
}

interface RawFileRange extends BinaryByteRange {
  readonly sourceFile: string
}

interface RawUnavailableRange extends RawFileRange {
  readonly state: 'unsupported' | 'parse-failed' | 'not-extracted'
  readonly reason: string
}

interface RawPropertyNode {
  readonly order: number
  readonly name: UeFName
  readonly type: UeFName
  readonly arrayIndex: number
  readonly path: string
  readonly serializedSize: number
  readonly byteRanges: { readonly tag: RawFileRange; readonly value: RawFileRange }
  readonly propertyGuid?: string
  readonly metadata?: ParsedProperty['metadata']
  readonly decoding: {
    readonly state: 'decoded' | 'unsupported' | 'parse-failed'
    readonly value?: JsonValue
    readonly properties?: readonly RawPropertyNode[]
    readonly elements?: readonly RawArrayElement[]
  }
}

interface RawArrayElement {
  readonly index: number
  readonly value?: JsonValue
  readonly properties?: readonly RawPropertyNode[]
  readonly decoding: { readonly state: 'decoded' | 'unsupported' | 'parse-failed' }
}

interface RawObjectSnapshot {
  readonly exportIndex: number
  readonly rawPackageIndex: number
  readonly objectName: UeFName
  readonly objectFlags: number
  readonly references: {
    readonly class: ResolvedPackageIndex
    readonly super: ResolvedPackageIndex
    readonly template: ResolvedPackageIndex
    readonly outer: ResolvedPackageIndex
  }
  readonly isClassDefaultObject: boolean
  readonly serialization: {
    readonly serialOffset: number
    readonly serialSize: number
    readonly combinedPackageByteRange: BinaryByteRange
    readonly sourceByteRange: RawFileRange
  }
  readonly extraction: {
    readonly state: 'decoded' | 'not-extracted' | 'parse-failed'
    readonly reason?: string
  }
  readonly propertyStream?: {
    readonly termination: 'terminated' | 'not-terminated'
    readonly byteRange: RawFileRange
    readonly terminatorByteRange?: RawFileRange
  }
  readonly properties?: readonly RawPropertyNode[]
  readonly diagnostics: readonly UeDiagnostic[]
  readonly unavailableRanges: readonly RawUnavailableRange[]
}

export interface RawPackageSnapshot {
  readonly schemaVersion: 1
  readonly snapshotKind: 'generated-raw-package'
  readonly dataset: {
    readonly id: string
    readonly claimedGameVersion: string
    readonly claimedGameVersionStatus: string
    readonly sourceFingerprint: { readonly algorithm: string; readonly value: string }
  }
  readonly logicalPackage: {
    readonly path: typeof RAW_PACKAGE_PATH
    readonly sourceFiles: readonly {
      readonly path: string
      readonly size: number
      readonly sha256: string
    }[]
    readonly contentHash: { readonly algorithm: 'sha256-path-content-v1'; readonly value: string }
  }
  readonly extraction: {
    readonly runId: string
    readonly parser: { readonly id: typeof PARSER_ID; readonly schemaVersion: typeof PARSER_SCHEMA_VERSION }
    readonly configuration: typeof EXTRACTION_CONFIGURATION
  }
  readonly boundaries: {
    readonly semanticFiltering: 'not-applied'
    readonly domainIdentityMapping: 'not-applied'
    readonly manualAnnotations: 'separate-not-included'
    readonly rawBinaryBytes: 'not-committed'
  }
  readonly package: {
    readonly summary: ParsedUePackage['summary']
    readonly nameMap: readonly UeNameEntry[]
    readonly imports: readonly (UeImportEntry & { readonly rawPackageIndex: number; readonly outerReference: ResolvedPackageIndex })[]
    readonly exports: readonly (UeExportEntry & {
      readonly rawPackageIndex: number
      readonly classReference: ResolvedPackageIndex
      readonly superReference: ResolvedPackageIndex
      readonly templateReference: ResolvedPackageIndex
      readonly outerReference: ResolvedPackageIndex
    })[]
    readonly objects: readonly RawObjectSnapshot[]
    readonly diagnostics: readonly UeDiagnostic[]
    readonly unavailableRanges: readonly RawUnavailableRange[]
  }
}

export function hasRawPackageSource(repositoryRoot: string): boolean {
  const root = localDatasetRoot(repositoryRoot)
  return EXPECTED_RAW_PACKAGE_FILES.every((source) => fs.existsSync(path.join(root, source.path)))
}

export function buildRawPackageSnapshot(repositoryRoot: string, provenance: GameDataSourceProvenance): RawPackageSnapshot {
  assertSafeAssetPath(RAW_PACKAGE_PATH)
  const datasetRoot = localDatasetRoot(repositoryRoot)
  const sourceFiles = EXPECTED_RAW_PACKAGE_FILES.map((expected) => {
    const filePath = path.join(datasetRoot, expected.path)
    const bytes = fs.readFileSync(filePath)
    return { path: expected.path, size: bytes.byteLength, sha256: crypto.createHash('sha256').update(bytes).digest('hex') }
  })
  const uasset = fs.readFileSync(path.join(datasetRoot, EXPECTED_RAW_PACKAGE_FILES[0].path))
  const uexp = fs.readFileSync(path.join(datasetRoot, EXPECTED_RAW_PACKAGE_FILES[1].path))
  const parsed = parseUePackage(uasset, uexp, { assetPath: RAW_PACKAGE_PATH })
  const resolver = new PackageObjectResolver(parsed.imports, parsed.exports)
  const uassetPath = EXPECTED_RAW_PACKAGE_FILES[0].path
  const uexpPath = EXPECTED_RAW_PACKAGE_FILES[1].path
  const imports = parsed.imports.map((entry) => ({ ...entry, rawPackageIndex: -(entry.index + 1), outerReference: resolver.resolve(entry.outerIndex) }))
  const exports = parsed.exports.map((entry) => ({
    ...entry,
    rawPackageIndex: entry.index + 1,
    classReference: resolver.resolve(entry.classIndex),
    superReference: resolver.resolve(entry.superIndex),
    templateReference: resolver.resolve(entry.templateIndex),
    outerReference: resolver.resolve(entry.outerIndex),
  }))
  const objects = parsed.exports.map((entry) => buildRawObject(entry, parsed, resolver, uexpPath))
  const packageUnavailableRanges = uncoveredRanges(
    uasset.byteLength,
    [
      { start: 0, end: parsed.summary.nameOffset },
      ...parsed.names.flatMap((entry) => entry.byteRange ? [entry.byteRange] : []),
      ...parsed.imports.flatMap((entry) => entry.byteRange ? [entry.byteRange] : []),
      ...parsed.exports.flatMap((entry) => entry.byteRange ? [entry.byteRange] : []),
    ],
  ).map((range) => ({ ...range, sourceFile: uassetPath, state: 'not-extracted' as const, reason: 'unparsed-uasset-region' }))
  const unassignedUexpRanges = uncoveredRanges(
    uexp.byteLength,
    parsed.exports.map((entry) => ({ start: entry.serialOffset - parsed.summary.totalHeaderSize, end: entry.serialOffset - parsed.summary.totalHeaderSize + entry.serialSize })),
  ).map((range) => ({ ...range, sourceFile: uexpPath, state: 'not-extracted' as const, reason: 'unassigned-uexp-region' }))
  const runDescriptor = {
    schemaVersion: RAW_PACKAGE_SNAPSHOT_SCHEMA_VERSION,
    datasetId: provenance.dataset.id,
    logicalPackagePath: RAW_PACKAGE_PATH,
    sourceFiles,
    parser: { id: PARSER_ID, schemaVersion: PARSER_SCHEMA_VERSION },
    configuration: EXTRACTION_CONFIGURATION,
  }
  return {
    schemaVersion: RAW_PACKAGE_SNAPSHOT_SCHEMA_VERSION,
    snapshotKind: 'generated-raw-package',
    dataset: {
      id: provenance.dataset.id,
      claimedGameVersion: provenance.dataset.claimedVersion,
      claimedGameVersionStatus: provenance.verification.claimedVersion.status,
      sourceFingerprint: provenance.dataset.sourceFingerprint,
    },
    logicalPackage: {
      path: RAW_PACKAGE_PATH,
      sourceFiles,
      contentHash: { algorithm: 'sha256-path-content-v1', value: hashLogicalAsset(datasetRoot, sourceFiles.map((source) => source.path)) },
    },
    extraction: {
      runId: contentAddress(runDescriptor),
      parser: { id: PARSER_ID, schemaVersion: PARSER_SCHEMA_VERSION },
      configuration: EXTRACTION_CONFIGURATION,
    },
    boundaries: {
      semanticFiltering: 'not-applied',
      domainIdentityMapping: 'not-applied',
      manualAnnotations: 'separate-not-included',
      rawBinaryBytes: 'not-committed',
    },
    package: {
      summary: parsed.summary,
      nameMap: parsed.names,
      imports,
      exports,
      objects,
      diagnostics: parsed.diagnostics,
      unavailableRanges: [...packageUnavailableRanges, ...unassignedUexpRanges],
    },
  }
}

function buildRawObject(
  entry: UeExportEntry,
  parsed: ParsedUePackage,
  resolver: PackageObjectResolver,
  uexpPath: string,
): RawObjectSnapshot {
  const start = entry.serialOffset - parsed.summary.totalHeaderSize
  const end = start + entry.serialSize
  const sourceByteRange = { sourceFile: uexpPath, start, end }
  const decoded = parsed.objects.find((object) => object.exportIndex === entry.index)
  const common = {
    exportIndex: entry.index,
    rawPackageIndex: entry.index + 1,
    objectName: entry.objectName,
    objectFlags: entry.objectFlags,
    references: {
      class: resolver.resolve(entry.classIndex), super: resolver.resolve(entry.superIndex),
      template: resolver.resolve(entry.templateIndex), outer: resolver.resolve(entry.outerIndex),
    },
    isClassDefaultObject: entry.objectName.value.startsWith('Default__'),
    serialization: {
      serialOffset: entry.serialOffset, serialSize: entry.serialSize,
      combinedPackageByteRange: { start: entry.serialOffset, end: entry.serialOffset + entry.serialSize },
      sourceByteRange,
    },
  }
  if (!decoded) {
    return {
      ...common,
      extraction: { state: 'not-extracted', reason: 'parser-scope-non-cdo-export' },
      diagnostics: [],
      unavailableRanges: [{ ...sourceByteRange, state: 'not-extracted', reason: 'non-cdo-export-payload-not-decoded' }],
    }
  }
  const stream = decoded.propertyStream
  const streamRange = stream?.byteRange ?? { start, end }
  return {
    ...common,
    extraction: { state: stream?.termination === 'not-terminated' ? 'parse-failed' : 'decoded' },
    ...(stream ? {
      propertyStream: {
        termination: stream.termination,
        byteRange: withSource(uexpPath, stream.byteRange),
        ...(stream.terminatorByteRange ? { terminatorByteRange: withSource(uexpPath, stream.terminatorByteRange) } : {}),
      },
    } : {}),
    properties: decoded.properties.map((property, index) => rawProperty(property, index, uexpPath, decoded.diagnostics)),
    diagnostics: decoded.diagnostics,
    unavailableRanges: [
      ...(stream?.unparsedByteRanges ?? []).map((range): RawUnavailableRange => ({
        ...withSource(uexpPath, range),
        state: 'parse-failed',
        reason: 'property-stream-not-decoded',
      })),
      ...(streamRange.end < end ? [{ sourceFile: uexpPath, start: streamRange.end, end, state: 'not-extracted' as const, reason: 'bytes-after-property-stream' }] : []),
    ],
  }
}

function rawProperty(property: ParsedProperty, order: number, sourceFile: string, diagnostics: readonly UeDiagnostic[]): RawPropertyNode {
  const state = unavailableState(property, diagnostics)
  const base = {
    order,
    name: property.nameReference ?? { nameIndex: -1, number: 0, value: property.name },
    type: property.typeReference ?? { nameIndex: -1, number: 0, value: property.type },
    arrayIndex: property.arrayIndex,
    path: property.path,
    serializedSize: property.serializedSize,
    byteRanges: {
      tag: withSource(sourceFile, property.byteRange),
      value: withSource(sourceFile, property.valueByteRange ?? property.byteRange),
    },
    ...(property.propertyGuid ? { propertyGuid: property.propertyGuid } : {}),
    ...(property.metadata ? { metadata: property.metadata } : {}),
  }
  if (state !== 'decoded') return { ...base, decoding: { state } }
  if (property.type === 'StructProperty' && isPropertyList(property.value)) {
    return { ...base, decoding: { state, properties: property.value.map((child, index) => rawProperty(child, index, sourceFile, diagnostics)) } }
  }
  if (property.type === 'ArrayProperty' && Array.isArray(property.value)) {
    return {
      ...base,
      decoding: {
        state,
        elements: property.value.map((element, index): RawArrayElement => {
          if (isPropertyList(element)) {
            return { index, decoding: { state: 'decoded' }, properties: element.map((child, childIndex) => rawProperty(child, childIndex, sourceFile, diagnostics)) }
          }
          if (isUnavailableMarker(element)) return { index, decoding: { state: markerState() } }
          return { index, decoding: { state: 'decoded' }, value: element as JsonValue }
        }),
      },
    }
  }
  return { ...base, decoding: { state, value: property.value } }
}

function unavailableState(property: ParsedProperty, diagnostics: readonly UeDiagnostic[]): 'decoded' | 'unsupported' | 'parse-failed' {
  if (!isUnavailableMarker(property.value)) return 'decoded'
  const related = diagnostics.find((diagnostic) => diagnostic.propertyName === property.name && diagnostic.propertyType === property.type)
  return related?.code === 'struct-parse-failed' || related?.code === 'array-parse-failed' || related?.code === 'malformed-property-tag'
    ? 'parse-failed'
    : 'unsupported'
}

function markerState(): 'unsupported' | 'parse-failed' {
  return 'unsupported'
}

function isUnavailableMarker(value: unknown): value is { unsupported: true } {
  return value !== null && typeof value === 'object' && 'unsupported' in value && value.unsupported === true
}

function isPropertyList(value: unknown): value is readonly ParsedProperty[] {
  return Array.isArray(value) && value.every((item) => item !== null && typeof item === 'object' && 'path' in item && 'serializedSize' in item)
}

function withSource(sourceFile: string, range: BinaryByteRange): RawFileRange {
  return { sourceFile, start: range.start, end: range.end }
}

function uncoveredRanges(size: number, ranges: readonly BinaryByteRange[]): BinaryByteRange[] {
  const covered = ranges
    .filter((range) => range.end > range.start)
    .map((range) => ({ start: Math.max(0, range.start), end: Math.min(size, range.end) }))
    .sort((left, right) => left.start - right.start || left.end - right.end)
  const uncovered: BinaryByteRange[] = []
  let cursor = 0
  for (const range of covered) {
    if (range.start > cursor) uncovered.push({ start: cursor, end: range.start })
    cursor = Math.max(cursor, range.end)
  }
  if (cursor < size) uncovered.push({ start: cursor, end: size })
  return uncovered
}

function contentAddress(value: unknown): string {
  return `sha256:${crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')}`
}

export function serializeRawPackageSnapshot(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`
}

export function collectRawPackageSnapshotErrors(snapshot: RawPackageSnapshot, provenance: GameDataSourceProvenance): string[] {
  const errors: string[] = []
  const serialized = serializeRawPackageSnapshot(snapshot)
  if (snapshot.schemaVersion !== RAW_PACKAGE_SNAPSHOT_SCHEMA_VERSION) errors.push('Unsupported Raw package snapshot schema version')
  if (snapshot.snapshotKind !== 'generated-raw-package') errors.push('Snapshot is not identified as generated Raw data')
  if (snapshot.dataset.id !== provenance.dataset.id) errors.push('Dataset ID does not match source provenance')
  if (snapshot.dataset.claimedGameVersion !== provenance.dataset.claimedVersion) errors.push('Claimed game version does not match source provenance')
  if (snapshot.dataset.claimedGameVersionStatus !== provenance.verification.claimedVersion.status) errors.push('Claimed game version status does not match source provenance')
  if (snapshot.logicalPackage.path !== RAW_PACKAGE_PATH) errors.push('Logical package path is not the Step 3A target')
  if (JSON.stringify(snapshot.logicalPackage.sourceFiles) !== JSON.stringify(EXPECTED_RAW_PACKAGE_FILES)) errors.push('Source file size or SHA-256 does not match the expected input')
  if (snapshot.extraction.parser.id !== PARSER_ID || snapshot.extraction.parser.schemaVersion !== PARSER_SCHEMA_VERSION) errors.push('Parser identity is invalid')
  if (snapshot.extraction.configuration.propertySelection !== 'none') errors.push('A property selection was applied before Raw persistence')
  if (snapshot.boundaries.semanticFiltering !== 'not-applied') errors.push('Semantic filtering boundary is invalid')
  if (snapshot.boundaries.domainIdentityMapping !== 'not-applied') errors.push('Domain identity mapping boundary is invalid')
  if (snapshot.boundaries.manualAnnotations !== 'separate-not-included') errors.push('Manual annotations are mixed into the generated snapshot')
  if (snapshot.package.nameMap.length !== snapshot.package.summary.nameCount) errors.push('Name Map count mismatch')
  if (snapshot.package.imports.length !== snapshot.package.summary.importCount) errors.push('Import Table count mismatch')
  if (snapshot.package.exports.length !== snapshot.package.summary.exportCount) errors.push('Export Table count mismatch')
  if (snapshot.package.objects.length !== snapshot.package.exports.length) errors.push('Every export must have an object extraction state')
  const decoded = snapshot.package.objects.filter((object) => object.extraction.state === 'decoded')
  if (decoded.length !== 1 || decoded[0]?.objectName.value !== 'Default__BP_Gauntlets_Unique3Instance_C') errors.push('Expected exactly one decoded class default object')
  if (snapshot.package.objects.filter((object) => object.extraction.state === 'not-extracted').length !== 4) errors.push('Every non-CDO export must remain explicitly not-extracted')
  const cdo = decoded[0]
  if (cdo?.propertyStream?.termination !== 'terminated') errors.push('Decoded CDO property stream is not terminated')
  if (cdo?.unavailableRanges.length !== 0) errors.push('Decoded CDO unexpectedly contains unavailable byte ranges')
  if (JSON.stringify(cdo?.properties?.map((property) => property.order)) !== JSON.stringify([0, 1, 2, 3, 4, 5])) errors.push('Top-level property order was not retained')
  if (cdo?.properties?.[0]?.name.value !== 'ConfiguredAttackVariants' || cdo.properties[0].decoding.elements?.length !== 4) errors.push('ConfiguredAttackVariants tree was not retained in full')
  const itemIdName = cdo?.properties?.find((property) => property.name.value === 'ItemIdName')
  if (itemIdName?.decoding.value !== 'Gauntlets_Unique3') errors.push('Raw internal ItemIdName was not retained')
  if (serialized.includes('fighters-bindings')) errors.push('Raw Internal ID was converted to a Domain ID')
  if (/"(?:normalizedProperty|normalizedValue|interpretation|manualAnnotation)"/.test(serialized)) errors.push('Semantic or manual annotation fields are present in Raw')
  if (/\/Users\/|\\Users\\|file:\/\/|~\/Downloads|\/home\/|\/root\//.test(serialized)) errors.push('Snapshot contains a local absolute or private path')
  if (serialized.includes('NaN') || serialized.includes('Infinity')) errors.push('Snapshot contains a non-finite number')
  walkUnavailable(snapshot, errors)
  validateRanges(snapshot, errors)
  const descriptor = {
    schemaVersion: snapshot.schemaVersion,
    datasetId: snapshot.dataset.id,
    logicalPackagePath: snapshot.logicalPackage.path,
    sourceFiles: snapshot.logicalPackage.sourceFiles,
    parser: snapshot.extraction.parser,
    configuration: snapshot.extraction.configuration,
  }
  if (snapshot.extraction.runId !== contentAddress(descriptor)) errors.push('Extraction run ID is not the deterministic content address')
  return [...new Set(errors)].sort()
}

function walkUnavailable(value: unknown, errors: string[]): void {
  if (value === null || typeof value !== 'object') return
  if ('state' in value && ['unsupported', 'parse-failed', 'not-extracted'].includes(String(value.state)) && 'value' in value) {
    errors.push('Unavailable state must not be represented by a placeholder value')
  }
  for (const nested of Object.values(value)) walkUnavailable(nested, errors)
}

function validateRanges(snapshot: RawPackageSnapshot, errors: string[]): void {
  const sizes = new Map(snapshot.logicalPackage.sourceFiles.map((source) => [source.path, source.size]))
  const check = (range: RawFileRange, label: string): void => {
    const size = sizes.get(range.sourceFile)
    if (size === undefined || !Number.isInteger(range.start) || !Number.isInteger(range.end) || range.start < 0 || range.end < range.start || range.end > size) {
      errors.push(`${label} has an invalid source byte range`)
    }
  }
  for (const object of snapshot.package.objects) {
    check(object.serialization.sourceByteRange, `export ${object.exportIndex}`)
    object.unavailableRanges.forEach((range) => check(range, `export ${object.exportIndex} unavailable range`))
    object.properties?.forEach((property) => walkPropertyRanges(property, check))
  }
  snapshot.package.unavailableRanges.forEach((range) => check(range, 'package unavailable range'))
}

function walkPropertyRanges(property: RawPropertyNode, check: (range: RawFileRange, label: string) => void): void {
  check(property.byteRanges.tag, property.path)
  check(property.byteRanges.value, `${property.path} value`)
  property.decoding.properties?.forEach((child) => walkPropertyRanges(child, check))
  property.decoding.elements?.forEach((element) => element.properties?.forEach((child) => walkPropertyRanges(child, check)))
}

export function renderRawPackageSnapshotReport(snapshot: RawPackageSnapshot): string {
  const decoded = snapshot.package.objects.filter((object) => object.extraction.state === 'decoded').length
  const notExtracted = snapshot.package.objects.filter((object) => object.extraction.state === 'not-extracted').length
  const cdo = snapshot.package.objects.find((object) => object.extraction.state === 'decoded')
  const propertyCount = countProperties(cdo?.properties ?? [])
  const sourceRows = snapshot.logicalPackage.sourceFiles.map((source) => `| \`${source.path}\` | ${source.size} | \`${source.sha256}\` |`).join('\n')
  return `# Raw Game Source package snapshot — Step 3A

This generated artifact proves the first one-package Raw flow:

\`Game files → extraction → Raw package snapshot\`

The only logical package in scope is \`${snapshot.logicalPackage.path}\`. The snapshot is generated before semantic property selection. It does not create a Domain identity, feed Data Browser or Optimizer, resolve cross-package references, or include manual annotations.

## Reproducibility identity

- Dataset: \`${snapshot.dataset.id}\`
- Claimed game version: \`${snapshot.dataset.claimedGameVersion}\` (status: \`${snapshot.dataset.claimedGameVersionStatus}\`)
- Parser: \`${snapshot.extraction.parser.id}\` schema ${snapshot.extraction.parser.schemaVersion}
- Extraction run: \`${snapshot.extraction.runId}\`
- Logical package hash: \`${snapshot.logicalPackage.contentHash.algorithm}:${snapshot.logicalPackage.contentHash.value}\`

The run ID is a deterministic SHA-256 content address of the snapshot schema, dataset ID, logical package path, individual input file size/hash metadata, parser identity, and extraction configuration. No clock time or machine-specific absolute path participates.

## Input files

| Dataset-relative path | Bytes | SHA-256 |
|---|---:|---|
${sourceRows}

The source binaries remain local and are not committed.

## Retained Raw structure

- ${snapshot.package.nameMap.length} Name Map entries, ${snapshot.package.imports.length} imports, and ${snapshot.package.exports.length} exports in serialized order
- ${snapshot.package.objects.length} export objects with raw package indexes, class/super/template/outer references, object flags, and source byte ranges
- ${decoded} decoded CDO property stream containing ${propertyCount} property nodes; property names/types retain FName indexes and numbers, tag order, array indexes, serialized sizes, metadata, values or explicit unavailable state, and byte ranges
- ${notExtracted} non-CDO export payloads explicitly marked \`not-extracted\` with their complete unavailable ranges
- ${snapshot.package.diagnostics.length} package diagnostics and ${snapshot.package.unavailableRanges.length} package-level unparsed/unassigned ranges

Decoded zero and false values are retained only with \`state: decoded\`; unavailable states omit \`value\`. Raw object/package indexes are not rewritten as application identities.

## Boundaries

- Semantic filtering: \`${snapshot.boundaries.semanticFiltering}\`
- Domain identity mapping: \`${snapshot.boundaries.domainIdentityMapping}\`
- Manual annotations: \`${snapshot.boundaries.manualAnnotations}\`
- Raw binary bytes: \`${snapshot.boundaries.rawBinaryBytes}\`

The canonical generated snapshot is \`${RAW_PACKAGE_ARTIFACT_PATH}\`. Full-game expansion, non-CDO decoding, cross-package reference completion, Domain Model, Data Browser, and Optimizer integration remain outside Step 3A.
`
}

function countProperties(properties: readonly RawPropertyNode[]): number {
  return properties.reduce((total, property) => total + 1
    + countProperties(property.decoding.properties ?? [])
    + (property.decoding.elements ?? []).reduce((sum, element) => sum + countProperties(element.properties ?? []), 0), 0)
}

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { createPhase65CExtractionRecord, isCanonicalGameDataPath, validateGameDataProvenanceRecord, type GameDataProvenanceRecord, type JsonValue } from '../src/research/gameDataProvenance.ts'
import { PackageObjectResolver } from '../src/research/ue4/objectResolver.ts'
import { parseUePackage } from '../src/research/ue4/packageReader.ts'
import { SUPPORTED_LEGACY_FILE_VERSION, UE_PACKAGE_MAGIC, type ParsedProperty, type ParsedUePackage, type UeDiagnostic } from '../src/research/ue4/packageTypes.ts'

export const EXTRACTOR_SCHEMA_VERSION = 1 as const
export const PARSER_ID = 'ue4-package-property-parser' as const
export const PARSER_SCHEMA_VERSION = 1 as const
export const LOCAL_DATASET_RELATIVE_ROOT = 'local-game-data/QuickBMS 1.17.0.0'

export const SELECTED_ASSET_PATHS = [
  'Dungeons/Content/Actors/Equipment/RangedWeapons/BP_ArrowBaseRangedWeapon',
  'Dungeons/Content/Actors/Equipment/RangedWeapons/ScatterCrossbow/BP_ScatterCrossBow_Arrow',
  'Dungeons/Content/Actors/Equipment/RangedWeapons/ScatterCrossbow/BP_ScatterCrossbow',
  'Dungeons/Content/Actors/Equipment/RangedWeapons/ScatterCrossbow/BP_ScatterCrossbowInstance',
  'Dungeons/Content/Actors/Equipment/RangedWeapons/ScatterCrossbow/BP_ScatterCrossbowStorable',
] as const

export const SUPPORTED_PROPERTY_TYPES = [
  'ArrayProperty', 'BoolProperty', 'ByteProperty', 'EnumProperty', 'FloatProperty',
  'Int64Property', 'IntProperty', 'NameProperty', 'ObjectProperty', 'SoftObjectProperty',
  'StrProperty', 'StructProperty', 'UInt32Property',
] as const

interface AssetSelection {
  readonly propertyPath: string
  readonly rawValue?: (property: ParsedProperty) => JsonValue
}

const SELECTED_PROPERTIES: Readonly<Record<string, readonly AssetSelection[]>> = {
  BP_ArrowBaseRangedWeapon: [
    { propertyPath: 'ProjectileOverrides', rawValue: (property) => ({ count: Array.isArray(property.value) ? property.value.length : -1 }) },
    { propertyPath: 'AnimNotifyStateData', rawValue: (property) => ({ count: Array.isArray(property.value) ? property.value.length : -1 }) },
  ],
  BP_ScatterCrossBow_Arrow: [
    { propertyPath: 'pushback.enablePushback' },
    { propertyPath: 'pushback.pushbackStrength' },
    { propertyPath: 'IgnoreFriendlyFire' },
    { propertyPath: 'HomingThreshold' },
    { propertyPath: 'damage' },
  ],
  BP_ScatterCrossbow: [{ propertyPath: 'SlotType' }],
  BP_ScatterCrossbowInstance: [
    { propertyPath: 'AttackDefintion.ProjectileDefinition[0].Projectile' },
    { propertyPath: 'AttackDefintion.ProjectileDefinition[0].NumberOfProjectiles' },
    { propertyPath: 'AttackDefintion.ProjectileDefinition[0].DelaySeconds' },
    { propertyPath: 'AttackDefintion.ProjectileDefinition[0].DelaySecondsPerProjectile' },
    { propertyPath: 'AttackDefintion.ProjectileDefinition[0].AngleSpan' },
    { propertyPath: 'AttackDefintion.ProjectileDefinition[0].AngleOffset' },
    { propertyPath: 'AttackDefintion.ProjectileDefinition[0].MaxRandomizedAngleFactor' },
    { propertyPath: 'AttackDefintion.ProjectileDefinition[0].NonRandomFirstArrow' },
    { propertyPath: 'AttackDefintion.ProjectileDefinition[0].ProjectileOffset' },
    { propertyPath: 'AttackDefintion.AttackRateSeconds' },
    { propertyPath: 'AttackDefintion.ActiveCancelPorintFactor' },
    { propertyPath: 'AttackDefintion.ProjectileVelocityFactor' },
    { propertyPath: 'ProjectileStackCount' },
    { propertyPath: 'AnimNotifyStateData', rawValue: (property) => ({ count: Array.isArray(property.value) ? property.value.length : -1 }) },
    { propertyPath: 'GearActor' },
    { propertyPath: 'ItemIdName' },
  ],
  BP_ScatterCrossbowStorable: [],
}

export interface ExtractedAssetSummary {
  readonly path: string
  readonly files: readonly string[]
  readonly contentHash: { readonly algorithm: 'sha256'; readonly value: string }
  readonly package: {
    readonly magic: string
    readonly legacyFileVersion: number
    readonly nameCount: number
    readonly importCount: number
    readonly exportCount: number
  }
  readonly objectCount: number
  readonly cdoNames: readonly string[]
  readonly supportedPropertyCount: number
  readonly unsupportedPropertyCount: number
  readonly parseErrorCount: number
  readonly selectedRecordCount: number
  readonly superclass?: { readonly rawPackageIndex: number; readonly resolvedObjectName?: string }
}

export interface GameDataExtractorArtifact {
  readonly schemaVersion: 1
  readonly datasetId: string
  readonly parser: { readonly id: typeof PARSER_ID; readonly schemaVersion: typeof PARSER_SCHEMA_VERSION }
  readonly support: {
    readonly description: string
    readonly magic: string
    readonly legacyFileVersion: typeof SUPPORTED_LEGACY_FILE_VERSION
    readonly packageExtensions: readonly ['.uasset', '.uexp']
    readonly propertyTypes: readonly string[]
  }
  readonly assets: readonly ExtractedAssetSummary[]
  readonly records: readonly GameDataProvenanceRecord[]
  readonly diagnostics: readonly UeDiagnostic[]
}

export function localDatasetRoot(repositoryRoot: string): string {
  return path.join(repositoryRoot, LOCAL_DATASET_RELATIVE_ROOT)
}

export function hasSelectedLocalSource(repositoryRoot: string): boolean {
  const root = localDatasetRoot(repositoryRoot)
  return SELECTED_ASSET_PATHS.every((assetPath) => ['.uasset', '.uexp'].every((extension) => fs.existsSync(path.join(root, `${assetPath}${extension}`))))
}

export function buildGameDataExtractorArtifact(repositoryRoot: string, datasetId: string): GameDataExtractorArtifact {
  const datasetRoot = localDatasetRoot(repositoryRoot)
  const rootRealPath = fs.realpathSync(datasetRoot)
  const records: GameDataProvenanceRecord[] = []
  const diagnostics: UeDiagnostic[] = []
  const assets = SELECTED_ASSET_PATHS.map((assetPath) => {
    assertSafeAssetPath(assetPath)
    const sourceFiles = ['.uasset', '.uexp'].map((extension) => `${assetPath}${extension}`).sort()
    const filePaths = sourceFiles.map((sourceFile) => resolveWithinRoot(rootRealPath, sourceFile))
    const packageData = parseUePackage(fs.readFileSync(filePaths[0]!), fs.readFileSync(filePaths[1]!), { assetPath })
    diagnostics.push(...packageData.diagnostics)
    const contentHash = { algorithm: 'sha256' as const, value: hashLogicalAsset(rootRealPath, sourceFiles) }
    const assetRecords = selectRecords(datasetId, assetPath, sourceFiles, contentHash, packageData)
    records.push(...assetRecords)
    const properties = packageData.objects.flatMap((object) => flattenProperties(object.properties))
    const classExport = findClassExport(packageData)
    const superclass = classExport ? new PackageObjectResolver(packageData.imports, packageData.exports).resolve(classExport.superIndex) : undefined
    return {
      path: assetPath, files: sourceFiles, contentHash,
      package: {
        magic: `0x${packageData.summary.magic.toString(16).toUpperCase()}`,
        legacyFileVersion: packageData.summary.legacyFileVersion,
        nameCount: packageData.names.length, importCount: packageData.imports.length, exportCount: packageData.exports.length,
      },
      objectCount: packageData.exports.length,
      cdoNames: packageData.objects.map((object) => object.objectName).sort(),
      supportedPropertyCount: properties.length,
      unsupportedPropertyCount: packageData.diagnostics.filter((diagnostic) => diagnostic.code === 'unsupported-property-type').length,
      parseErrorCount: packageData.diagnostics.filter((diagnostic) => !diagnostic.skipped).length,
      selectedRecordCount: assetRecords.length,
      ...(superclass ? { superclass: { rawPackageIndex: superclass.rawPackageIndex, ...(superclass.objectName ? { resolvedObjectName: superclass.objectName } : {}) } } : {}),
    }
  })
  return {
    schemaVersion: EXTRACTOR_SCHEMA_VERSION,
    datasetId,
    parser: { id: PARSER_ID, schemaVersion: PARSER_SCHEMA_VERSION },
    support: {
      description: 'Minecraft Dungeons targeted UE4 legacy package version -7 subset',
      magic: `0x${UE_PACKAGE_MAGIC.toString(16).toUpperCase()}`,
      legacyFileVersion: SUPPORTED_LEGACY_FILE_VERSION,
      packageExtensions: ['.uasset', '.uexp'],
      propertyTypes: [...SUPPORTED_PROPERTY_TYPES],
    },
    assets,
    records: records.sort((left, right) => left.id.localeCompare(right.id)),
    diagnostics: diagnostics.sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right))),
  }
}

function selectRecords(
  datasetId: string,
  assetPath: string,
  sourceFiles: readonly string[],
  contentHash: { readonly algorithm: 'sha256'; readonly value: string },
  packageData: ParsedUePackage,
): GameDataProvenanceRecord[] {
  const assetName = assetPath.slice(assetPath.lastIndexOf('/') + 1)
  const selected = SELECTED_PROPERTIES[assetName]
  if (!selected) throw new Error(`No formal selection configured for ${assetName}`)
  const cdo = packageData.objects[0]
  if (!cdo) throw new Error(`No class default object found for ${assetPath}`)
  const properties = flattenProperties(cdo.properties)
  return selected.map((selection) => {
    const property = properties.find((candidate) => candidate.path === selection.propertyPath)
    if (!property) throw new Error(`Selected property ${selection.propertyPath} was not found in ${assetPath}`)
    return createPhase65CExtractionRecord({
      id: `${slug(assetName)}--${slug(selection.propertyPath)}`,
      datasetId, assetPath, sourceFiles, contentHash,
      extraction: {
        parserId: PARSER_ID, parserSchemaVersion: PARSER_SCHEMA_VERSION,
        objectName: cdo.objectName, ...(cdo.className ? { className: cdo.className } : {}),
        propertyName: property.name, propertyPath: property.path, propertyType: property.type,
      },
      rawObservation: { value: selection.rawValue ? selection.rawValue(property) : property.value },
      confidence: { source: 'medium', extraction: 'high', semantics: 'unknown', version: 'low' },
      crossCheckStatus: 'not-compared', status: 'extracted',
    })
  })
}

export function flattenProperties(properties: readonly ParsedProperty[]): ParsedProperty[] {
  const flattened: ParsedProperty[] = []
  const visit = (value: unknown): void => {
    if (isParsedProperty(value)) {
      flattened.push(value)
      visit(value.value)
    } else if (Array.isArray(value)) {
      value.forEach(visit)
    }
  }
  properties.forEach(visit)
  return flattened
}

function isParsedProperty(value: unknown): value is ParsedProperty {
  return value !== null && typeof value === 'object' && 'name' in value && 'type' in value && 'path' in value && 'serializedSize' in value
}

function findClassExport(packageData: ParsedUePackage) {
  const classNames = new Set(packageData.objects.map((object) => object.className).filter(Boolean))
  return packageData.exports.find((entry) => classNames.has(entry.objectName.value))
}

export function hashLogicalAsset(datasetRoot: string, sourceFiles: readonly string[]): string {
  const hash = crypto.createHash('sha256')
  for (const sourceFile of [...sourceFiles].sort()) {
    assertSafeAssetPath(sourceFile)
    hash.update(sourceFile, 'utf8')
    hash.update(Uint8Array.of(0))
    hash.update(fs.readFileSync(resolveWithinRoot(datasetRoot, sourceFile)))
  }
  return hash.digest('hex')
}

export function assertSafeAssetPath(assetPath: string): void {
  if (!isCanonicalGameDataPath(assetPath) || path.isAbsolute(assetPath)) throw new Error(`Unsafe dataset-relative asset path: ${assetPath}`)
}

function resolveWithinRoot(rootRealPath: string, relativePath: string): string {
  assertSafeAssetPath(relativePath)
  const candidate = path.join(rootRealPath, relativePath)
  const candidateRealPath = fs.realpathSync(candidate)
  if (candidateRealPath !== rootRealPath && !candidateRealPath.startsWith(`${rootRealPath}${path.sep}`)) throw new Error(`Asset path escapes the dataset root: ${relativePath}`)
  return candidateRealPath
}

function slug(value: string): string {
  return value.replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase()
}

export function serializeExtractorArtifact(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`
}

export function collectExtractorArtifactErrors(artifact: GameDataExtractorArtifact, expectedDatasetId: string): string[] {
  const errors: string[] = []
  const serialized = serializeExtractorArtifact(artifact)
  if (artifact.schemaVersion !== EXTRACTOR_SCHEMA_VERSION) errors.push('Unsupported extractor artifact schema version')
  if (artifact.datasetId !== expectedDatasetId) errors.push('Extractor datasetId does not match source provenance')
  if (artifact.parser.id !== PARSER_ID || artifact.parser.schemaVersion !== PARSER_SCHEMA_VERSION) errors.push('Parser identity does not match the Phase 6.5C contract')
  if (artifact.support.legacyFileVersion !== SUPPORTED_LEGACY_FILE_VERSION) errors.push('Supported package version is inconsistent')
  if (JSON.stringify(artifact.support.packageExtensions) !== JSON.stringify(['.uasset', '.uexp'])) errors.push('Package companion extensions are inconsistent')
  if (artifact.assets.length !== SELECTED_ASSET_PATHS.length) errors.push('Selected asset count is inconsistent')
  if (JSON.stringify(artifact.assets.map((asset) => asset.path)) !== JSON.stringify(SELECTED_ASSET_PATHS)) errors.push('Selected assets are missing or out of order')
  if (serialized.match(/\/Users\/|\\Users\\|file:\/\/|~\/Downloads|\/home\/|\/root\//)) errors.push('Extractor artifact contains a local absolute or private path')
  if (serialized.match(/"(?:normalizedProperty|normalizedValue|interpretation)"/)) errors.push('Extractor artifact contains semantic or normalized fields')
  if (serialized.includes('NaN') || serialized.includes('Infinity')) errors.push('Extractor artifact contains a non-finite number')
  const recordIds = artifact.records.map((record) => record.id)
  if (new Set(recordIds).size !== recordIds.length) errors.push('Extractor artifact contains duplicate record IDs')
  if (JSON.stringify(recordIds) !== JSON.stringify([...recordIds].sort())) errors.push('Extractor records are not deterministically ordered')
  for (const asset of artifact.assets) {
    if (!isCanonicalGameDataPath(asset.path)) errors.push(`Non-canonical asset path: ${asset.path}`)
    if (asset.files.length !== 2 || !asset.files.includes(`${asset.path}.uasset`) || !asset.files.includes(`${asset.path}.uexp`)) errors.push(`Invalid companion files: ${asset.path}`)
    if (!/^[a-f0-9]{64}$/.test(asset.contentHash.value)) errors.push(`Invalid content hash: ${asset.path}`)
    if (asset.package.magic !== `0x${UE_PACKAGE_MAGIC.toString(16).toUpperCase()}`) errors.push(`Invalid package magic: ${asset.path}`)
    if (asset.package.legacyFileVersion !== SUPPORTED_LEGACY_FILE_VERSION) errors.push(`Invalid package version: ${asset.path}`)
  }
  for (const record of artifact.records) {
    errors.push(...validateGameDataProvenanceRecord(record).map((error) => `${record.id}: ${error}`))
    if (record.status !== 'extracted') errors.push(`${record.id}: status must be extracted`)
    if (record.interpretation) errors.push(`${record.id}: interpretation must be absent`)
    if (record.promotionStatus !== 'research-only') errors.push(`${record.id}: promotion must remain research-only`)
    if (record.crossCheckStatus !== 'not-compared') errors.push(`${record.id}: cross-check status must be not-compared`)
    if (record.confidence.semantics !== 'unknown') errors.push(`${record.id}: semantic confidence must be unknown`)
    if (record.datasetId !== expectedDatasetId) errors.push(`${record.id}: datasetId does not match source provenance`)
    const asset = artifact.assets.find((candidate) => candidate.path === record.asset.path)
    if (!asset) errors.push(`${record.id}: asset summary is missing`)
    else {
      if (JSON.stringify(record.asset.files) !== JSON.stringify(asset.files)) errors.push(`${record.id}: source files do not match asset summary`)
      if (record.asset.contentHash?.value !== asset.contentHash.value) errors.push(`${record.id}: content hash does not match asset summary`)
    }
  }
  if (artifact.records.length !== artifact.assets.reduce((count, asset) => count + asset.selectedRecordCount, 0)) errors.push('Selected record counts do not match formal records')
  return [...new Set(errors)].sort()
}

export function renderGameDataExtractorReport(artifact: GameDataExtractorArtifact): string {
  const record = (path: string) => artifact.records.find((candidate) => candidate.extraction?.propertyPath === path)?.rawObservation?.value
  const assetRows = artifact.assets.map((asset) => `| \`${asset.path}\` | ${asset.objectCount} | ${asset.cdoNames.map((name) => `\`${name}\``).join(', ')} | ${asset.supportedPropertyCount} | ${asset.unsupportedPropertyCount} | ${asset.parseErrorCount} | ${asset.selectedRecordCount} | \`${asset.contentHash.value}\` |`).join('\n')
  const projectile = record('AttackDefintion.ProjectileDefinition[0].Projectile') as { objectName?: string } | undefined
  const gearActor = record('GearActor') as { objectName?: string } | undefined
  const superclass = artifact.assets.find((asset) => asset.path.endsWith('/BP_ScatterCrossbowInstance'))?.superclass?.resolvedObjectName
  return `# Game Data Extractor — Phase 6.5C

## Supported package scope

This foundation supports the Minecraft Dungeons targeted UE4 legacy package subset with magic \`${artifact.support.magic}\`, legacy file version \`${artifact.support.legacyFileVersion}\`, and paired \`.uasset + .uexp\` files. It does not claim support for every UE4 package version.

## Parser architecture

\`Package Header → Name Map → Import/Export Tables → FPackageIndex → Export CDO → Property Tags → provenance record\`

The reader parses the package summary in serialization order, checks every binary range, converts an export's combined-package \`SerialOffset\` to \`.uexp\` offset by subtracting \`TotalHeaderSize\`, and rejects ranges outside the companion file.

## Supported property types

${artifact.support.propertyTypes.map((type) => `- \`${type}\``).join('\n')}

Generic tagged structs, nested structs, \`Vector\`, and arrays including \`Array<Struct>\` are supported. Boolean values are read from tag metadata when their payload size is zero. Object references retain the raw \`FPackageIndex\` and structural resolution.

## Unsupported and tolerant behavior

An unknown property type is skipped only when its declared payload boundary is safe; a structured diagnostic is retained. If metadata does not establish a safe continuation point, parsing stops for that object. Invalid magic, versions, name indexes, table ranges, and export serial ranges are explicit parse errors rather than silent truncation. Strict mode can require the CDO property terminator; the sample extraction uses tolerant diagnostics.

## Provenance and semantic boundary

Every selected formal fact is created through \`createPhase65CExtractionRecord()\` with parser ID \`${artifact.parser.id}\`, parser schema ${artifact.parser.schemaVersion}, all four confidence axes, \`status: extracted\`, \`promotionStatus: research-only\`, \`crossCheckStatus: not-compared\`, and semantic confidence \`unknown\`. Extracted records cannot contain interpretation or normalized fields.

These records establish only that a serialized property/value exists at an asset/object/property path. They do not establish gameplay meaning. In particular, raw \`damage = 50\` does **not** establish weapon damage, displayed damage, or normalized projectile damage.

## Selected asset validation

| Logical asset | Exports | CDO | Parsed properties | Unsupported | Parse errors | Formal records | Logical SHA-256 |
|---|---:|---|---:|---:|---:|---:|---|
${assetRows}

The logical SHA-256 algorithm processes each companion in sorted relative-path order as \`relative UTF-8 path + NUL + raw file bytes\`. Absolute paths are neither hash input nor formal output.

### Scatter Crossbow structural observations

| Observation | Raw value |
|---|---|
| \`AttackDefintion.ProjectileDefinition[0].NumberOfProjectiles\` | \`${JSON.stringify(record('AttackDefintion.ProjectileDefinition[0].NumberOfProjectiles'))}\` |
| \`AttackDefintion.AttackRateSeconds\` | \`${JSON.stringify(record('AttackDefintion.AttackRateSeconds'))}\` |
| \`AttackDefintion.ProjectileDefinition[0].DelaySecondsPerProjectile\` | \`${JSON.stringify(record('AttackDefintion.ProjectileDefinition[0].DelaySecondsPerProjectile'))}\` |
| \`AttackDefintion.ProjectileDefinition[0].ProjectileOffset\` | \`${JSON.stringify(record('AttackDefintion.ProjectileDefinition[0].ProjectileOffset'))}\` |
| \`damage\` | \`${JSON.stringify(record('damage'))}\` |
| \`Projectile\` reference | \`${projectile?.objectName ?? 'unresolved'}\` |
| \`GearActor\` reference | \`${gearActor?.objectName ?? 'unresolved'}\` |
| generated-class superclass | \`${superclass ?? 'unresolved'}\` |

Raw property spelling, including \`AttackDefintion\` and \`ActiveCancelPorintFactor\`, is preserved exactly.

## CI behavior

\`npm run audit:game-data-extractor\` always validates the committed sample, deterministic report, provenance rules, ordering, hashes, paths, and acceptance values. When the ignored local dataset is present, it also reparses the five logical assets (ten files), recomputes their hashes, and requires byte-derived output to match the committed artifact. CI succeeds without the raw dataset.

## Known limitations

- No bulk harvest or all-entity scan.
- No semantic mapping or runtime catalog promotion.
- No effective inherited gameplay-value resolution.
- No executable or native-code parsing.
- The dataset version remains claimed, not independently verified.
- Only the targeted legacy version -7 package subset is supported.
`
}

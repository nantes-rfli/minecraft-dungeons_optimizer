import { BinaryReader } from './binaryReader.ts'
import { PackageObjectResolver } from './objectResolver.ts'
import { UePropertyReader } from './propertyReader.ts'
import {
  SUPPORTED_LEGACY_FILE_VERSION, TARGET_EXPORT_ENTRY_SIZE, TARGET_IMPORT_ENTRY_SIZE,
  UE_PACKAGE_MAGIC, type ParsedUePackage, type UeDiagnostic, type UeExportEntry,
  type UeFName, type UeImportEntry, type UeNameEntry, type UePackageSummary,
} from './packageTypes.ts'

export class UePackageParseError extends Error {
  readonly diagnostic: UeDiagnostic

  constructor(diagnostic: UeDiagnostic) {
    super(diagnostic.message)
    this.name = 'UePackageParseError'
    this.diagnostic = diagnostic
  }
}

export interface PackageReaderOptions {
  readonly strict?: boolean
  readonly assetPath?: string
}

const hex = (bytes: Uint8Array): string => [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')

export function parseUePackage(uasset: Uint8Array, uexp: Uint8Array, options: PackageReaderOptions = {}): ParsedUePackage {
  const diagnostics: UeDiagnostic[] = []
  const summary = readPackageSummary(uasset, options.assetPath)
  const names = readNameMap(uasset, summary, options.assetPath)
  const readFName = (reader: BinaryReader): UeFName => {
    const nameIndex = reader.readInt32LE()
    const number = reader.readInt32LE()
    const entry = names[nameIndex]
    if (!entry) throwParse('name-index-out-of-range', `Name index ${nameIndex} is out of range`, options.assetPath)
    return { nameIndex, number, value: number === 0 ? entry.value : `${entry.value}_${number - 1}` }
  }
  const imports = readImportTable(uasset, summary, readFName, options.assetPath)
  const exports = readExportTable(uasset, summary, readFName, options.assetPath)
  const resolver = new PackageObjectResolver(imports, exports)
  const objects = exports.filter((entry) => entry.objectName.value.startsWith('Default__')).map((entry) => {
    const uexpOffset = entry.serialOffset - summary.totalHeaderSize
    if (uexpOffset < 0 || uexpOffset + entry.serialSize > uexp.byteLength) {
      throwParse('serial-range-out-of-range', `Export ${entry.objectName.value} has invalid .uexp range ${uexpOffset}..${uexpOffset + entry.serialSize}`, options.assetPath)
    }
    const objectBytes = uexp.subarray(uexpOffset, uexpOffset + entry.serialSize)
    const propertyReader = new UePropertyReader(names, resolver, entry.objectName.value)
    const result = propertyReader.readProperties(new BinaryReader(objectBytes, 0, entry.objectName.value))
    diagnostics.push(...result.diagnostics.map((diagnostic) => ({ ...diagnostic, assetPath: options.assetPath })))
    if (options.strict && !result.terminated) {
      throwParse('malformed-property-tag', `CDO ${entry.objectName.value} did not reach a property terminator`, options.assetPath)
    }
    const classResolution = resolver.resolve(entry.classIndex)
    return {
      objectName: entry.objectName.value,
      ...(classResolution.objectName ? { className: classResolution.objectName } : {}),
      exportIndex: entry.index, serialOffset: entry.serialOffset, serialSize: entry.serialSize,
      isClassDefaultObject: true, properties: result.properties, diagnostics: result.diagnostics,
    }
  })
  return { summary, names, imports, exports, objects, diagnostics }
}

export function readPackageSummary(uasset: Uint8Array, assetPath?: string): UePackageSummary {
  try {
    const reader = new BinaryReader(uasset, 0, assetPath ?? '.uasset')
    const magic = reader.readUInt32LE()
    if (magic !== UE_PACKAGE_MAGIC) throwParse('invalid-magic', `Invalid UE package magic 0x${magic.toString(16)}`, assetPath)
    const legacyFileVersion = reader.readInt32LE()
    if (legacyFileVersion !== SUPPORTED_LEGACY_FILE_VERSION) {
      throwParse('unsupported-package-version', `Unsupported UE legacy file version ${legacyFileVersion}; expected ${SUPPORTED_LEGACY_FILE_VERSION}`, assetPath)
    }
    reader.readInt32LE() // Legacy UE3 version.
    const fileVersionUE4 = reader.readInt32LE()
    const fileVersionLicenseeUE4 = reader.readInt32LE()
    const customVersionCount = reader.readInt32LE()
    if (customVersionCount < 0 || customVersionCount > 100_000) throw new Error(`Invalid custom version count ${customVersionCount}`)
    for (let index = 0; index < customVersionCount; index += 1) {
      reader.skip(16)
      reader.readInt32LE()
    }
    const totalHeaderSize = reader.readInt32LE()
    reader.readFString() // Folder name.
    reader.readUInt32LE() // Package flags.
    const nameCount = reader.readInt32LE()
    const nameOffset = reader.readInt32LE()
    reader.readInt32LE(); reader.readInt32LE() // Gatherable text count/offset.
    const exportCount = reader.readInt32LE()
    const exportOffset = reader.readInt32LE()
    const importCount = reader.readInt32LE()
    const importOffset = reader.readInt32LE()
    reader.readInt32LE() // Depends offset.
    reader.readInt32LE(); reader.readInt32LE() // Soft package references count/offset.
    reader.readInt32LE() // Searchable names offset.
    reader.readInt32LE() // Thumbnail table offset.
    reader.skip(16) // Package GUID.
    const generationCount = reader.readInt32LE()
    if (generationCount < 0 || generationCount > 100_000) throw new Error(`Invalid generation count ${generationCount}`)
    reader.skip(generationCount * 8)
    skipEngineVersion(reader)
    skipEngineVersion(reader)
    reader.readUInt32LE() // Compression flags.
    const compressedChunkCount = reader.readInt32LE()
    if (compressedChunkCount < 0 || compressedChunkCount > 100_000) throw new Error(`Invalid compressed chunk count ${compressedChunkCount}`)
    reader.skip(compressedChunkCount * 16)
    reader.readUInt32LE() // Package source.
    const additionalPackageCount = reader.readInt32LE()
    if (additionalPackageCount < 0 || additionalPackageCount > 100_000) throw new Error(`Invalid additional package count ${additionalPackageCount}`)
    for (let index = 0; index < additionalPackageCount; index += 1) reader.readFString()
    reader.readInt32LE() // Asset registry data offset.
    reader.readInt64LE() // Bulk data start offset.
    reader.readInt32LE() // World tile info offset.
    const chunkIdCount = reader.readInt32LE()
    if (chunkIdCount < 0 || chunkIdCount > 100_000) throw new Error(`Invalid chunk ID count ${chunkIdCount}`)
    reader.skip(chunkIdCount * 4)
    reader.readInt32LE(); reader.readInt32LE() // Preload dependency count/offset.
    const summary = { magic, legacyFileVersion, fileVersionUE4, fileVersionLicenseeUE4, totalHeaderSize, nameCount, nameOffset, exportCount, exportOffset, importCount, importOffset }
    validateTableRange(nameOffset, nameCount, 8, uasset.byteLength, 'Name Map', assetPath)
    validateTableRange(importOffset, importCount, TARGET_IMPORT_ENTRY_SIZE, uasset.byteLength, 'Import Table', assetPath)
    validateTableRange(exportOffset, exportCount, TARGET_EXPORT_ENTRY_SIZE, uasset.byteLength, 'Export Table', assetPath)
    if (totalHeaderSize !== uasset.byteLength) throwParse('header-out-of-range', `TotalHeaderSize ${totalHeaderSize} does not match .uasset size ${uasset.byteLength}`, assetPath)
    return summary
  } catch (error) {
    if (error instanceof UePackageParseError) throw error
    throwParse('header-out-of-range', error instanceof Error ? error.message : String(error), assetPath)
  }
}

function readNameMap(uasset: Uint8Array, summary: UePackageSummary, assetPath?: string): UeNameEntry[] {
  const reader = new BinaryReader(uasset, summary.nameOffset, assetPath ?? 'Name Map')
  const entries: UeNameEntry[] = []
  try {
    for (let index = 0; index < summary.nameCount; index += 1) {
      entries.push({ index, value: reader.readFString(), hashBytes: hex(reader.readBytes(4)) })
    }
  } catch (error) {
    throwParse('header-out-of-range', `Failed to read Name Map: ${error instanceof Error ? error.message : String(error)}`, assetPath)
  }
  return entries
}

function readImportTable(
  uasset: Uint8Array,
  summary: UePackageSummary,
  readFName: (reader: BinaryReader) => UeFName,
  assetPath?: string,
): UeImportEntry[] {
  const reader = new BinaryReader(uasset, summary.importOffset, assetPath ?? 'Import Table')
  const entries: UeImportEntry[] = []
  for (let index = 0; index < summary.importCount; index += 1) {
    const start = reader.tell()
    entries.push({ index, classPackage: readFName(reader), className: readFName(reader), outerIndex: reader.readInt32LE(), objectName: readFName(reader) })
    if (reader.tell() - start !== TARGET_IMPORT_ENTRY_SIZE) throwParse('header-out-of-range', 'Target Import Table entry is not 28 bytes', assetPath)
  }
  return entries
}

function readExportTable(
  uasset: Uint8Array,
  summary: UePackageSummary,
  readFName: (reader: BinaryReader) => UeFName,
  assetPath?: string,
): UeExportEntry[] {
  const reader = new BinaryReader(uasset, summary.exportOffset, assetPath ?? 'Export Table')
  const entries: UeExportEntry[] = []
  for (let index = 0; index < summary.exportCount; index += 1) {
    const start = reader.tell()
    const classIndex = reader.readInt32LE()
    const superIndex = reader.readInt32LE()
    const templateIndex = reader.readInt32LE()
    const outerIndex = reader.readInt32LE()
    const objectName = readFName(reader)
    const objectFlags = reader.readUInt32LE()
    const serialSize = reader.readInt64LE()
    const serialOffset = reader.readInt64LE()
    reader.seek(start + TARGET_EXPORT_ENTRY_SIZE)
    entries.push({ index, classIndex, superIndex, templateIndex, outerIndex, objectName, objectFlags, serialSize, serialOffset })
  }
  return entries
}

function skipEngineVersion(reader: BinaryReader): void {
  reader.readUInt16LE(); reader.readUInt16LE(); reader.readUInt16LE(); reader.readUInt32LE(); reader.readFString()
}

function validateTableRange(offset: number, count: number, minimumEntrySize: number, totalSize: number, label: string, assetPath?: string): void {
  if (!Number.isInteger(offset) || !Number.isInteger(count) || offset < 0 || count < 0 || offset + count * minimumEntrySize > totalSize) {
    throwParse('header-out-of-range', `${label} range is outside the .uasset`, assetPath)
  }
}

function throwParse(code: UeDiagnostic['code'], message: string, assetPath?: string): never {
  throw new UePackageParseError({ code, message, ...(assetPath ? { assetPath } : {}) })
}

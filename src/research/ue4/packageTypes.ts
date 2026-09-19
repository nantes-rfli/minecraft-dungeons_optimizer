import type { JsonValue } from '../gameDataProvenance.ts'

export const UE_PACKAGE_MAGIC = 0x9e2a83c1
export const SUPPORTED_LEGACY_FILE_VERSION = -7
export const TARGET_IMPORT_ENTRY_SIZE = 28
export const TARGET_EXPORT_ENTRY_SIZE = 104

export type UeDiagnosticCode =
  | 'unsupported-package-version' | 'invalid-magic' | 'header-out-of-range'
  | 'name-index-out-of-range' | 'import-index-out-of-range' | 'export-index-out-of-range'
  | 'serial-range-out-of-range' | 'unsupported-property-type' | 'malformed-property-tag'
  | 'struct-parse-failed' | 'struct-size-mismatch' | 'array-parse-failed' | 'trailing-bytes'

export interface UeDiagnostic {
  readonly code: UeDiagnosticCode
  readonly message: string
  readonly assetPath?: string
  readonly objectName?: string
  readonly propertyName?: string
  readonly propertyType?: string
  readonly rawSize?: number
  readonly skipped?: boolean
  readonly byteRange?: BinaryByteRange
}

export interface BinaryByteRange {
  readonly start: number
  readonly end: number
}

export interface UePackageSummary {
  readonly magic: number
  readonly legacyFileVersion: number
  readonly fileVersionUE4: number
  readonly fileVersionLicenseeUE4: number
  readonly totalHeaderSize: number
  readonly nameCount: number
  readonly nameOffset: number
  readonly exportCount: number
  readonly exportOffset: number
  readonly importCount: number
  readonly importOffset: number
}

export interface UeNameEntry {
  readonly index: number
  readonly value: string
  readonly hashBytes: string
  readonly byteRange?: BinaryByteRange
}

export interface UeFName {
  readonly nameIndex: number
  readonly number: number
  readonly value: string
}

export interface UeImportEntry {
  readonly index: number
  readonly classPackage: UeFName
  readonly className: UeFName
  readonly outerIndex: number
  readonly objectName: UeFName
  readonly byteRange?: BinaryByteRange
}

export interface UeExportEntry {
  readonly index: number
  readonly classIndex: number
  readonly superIndex: number
  readonly templateIndex: number
  readonly outerIndex: number
  readonly objectName: UeFName
  readonly objectFlags: number
  readonly serialSize: number
  readonly serialOffset: number
  readonly byteRange?: BinaryByteRange
}

export interface ResolvedPackageIndex {
  readonly rawPackageIndex: number
  readonly kind: 'null' | 'import' | 'export' | 'invalid'
  readonly index?: number
  readonly objectName?: string
  readonly className?: string
}

export interface ParsedProperty {
  readonly name: string
  readonly type: string
  readonly arrayIndex: number
  readonly order?: number
  readonly serializedSize: number
  readonly value: JsonValue
  readonly path: string
  readonly byteRange: { readonly start: number; readonly end: number }
  readonly valueByteRange?: BinaryByteRange
  readonly nameReference?: UeFName
  readonly typeReference?: UeFName
  readonly propertyGuid?: string
  readonly metadata?: {
    readonly structType?: string
    readonly structTypeReference?: UeFName
    readonly structGuid?: string
    readonly innerType?: string
    readonly innerTypeReference?: UeFName
    readonly enumType?: string
    readonly enumTypeReference?: UeFName
    readonly boolValue?: boolean
    readonly mapKeyTypeReference?: UeFName
    readonly mapValueTypeReference?: UeFName
    readonly arrayStruct?: {
      readonly wrapperName: UeFName
      readonly wrapperType: UeFName
      readonly wrapperSerializedSize: number
      readonly wrapperArrayIndex: number
      readonly structType: UeFName
      readonly structGuid: string
      readonly propertyGuid?: string
    }
  }
}

export interface ParsedExportObject {
  readonly objectName: string
  readonly className?: string
  readonly exportIndex: number
  readonly serialOffset: number
  readonly serialSize: number
  readonly isClassDefaultObject: boolean
  readonly properties: readonly ParsedProperty[]
  readonly diagnostics: readonly UeDiagnostic[]
  readonly propertyStream?: {
    readonly byteRange: BinaryByteRange
    readonly termination: 'terminated' | 'not-terminated'
    readonly terminatorByteRange?: BinaryByteRange
    readonly unparsedByteRanges: readonly BinaryByteRange[]
  }
}

export interface ParsedUePackage {
  readonly summary: UePackageSummary
  readonly names: readonly UeNameEntry[]
  readonly imports: readonly UeImportEntry[]
  readonly exports: readonly UeExportEntry[]
  readonly objects: readonly ParsedExportObject[]
  readonly diagnostics: readonly UeDiagnostic[]
}

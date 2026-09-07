import { BinaryReadError, BinaryReader } from './binaryReader.ts'
import { PackageObjectResolver } from './objectResolver.ts'
import type { JsonValue } from '../gameDataProvenance.ts'
import type { ParsedProperty, UeDiagnostic, UeFName, UeNameEntry } from './packageTypes.ts'

interface PropertyMetadata {
  structType?: string
  innerType?: string
  enumType?: string
}

class UnsupportedPropertyMetadataError extends Error {
  readonly propertyType: string

  constructor(propertyType: string) {
    super(`Cannot safely locate the payload for unsupported property type ${propertyType}`)
    this.propertyType = propertyType
  }
}

const METADATA_FREE_PROPERTY_TYPES = new Set([
  'FloatProperty', 'IntProperty', 'Int64Property', 'UInt32Property', 'NameProperty',
  'ObjectProperty', 'SoftObjectProperty', 'StrProperty',
  // Known UE4 tags whose payload can be skipped after the common property-GUID field.
  'TextProperty', 'DelegateProperty', 'MulticastDelegateProperty', 'InterfaceProperty',
  'WeakObjectProperty', 'LazyObjectProperty',
])

export interface PropertyReadResult {
  readonly properties: readonly ParsedProperty[]
  readonly diagnostics: readonly UeDiagnostic[]
  readonly terminated: boolean
}

const bytesToGuid = (bytes: Uint8Array): string => [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')

export class UePropertyReader {
  private readonly diagnostics: UeDiagnostic[] = []
  private readonly names: readonly UeNameEntry[]
  private readonly resolver: PackageObjectResolver
  private readonly objectName: string | undefined

  constructor(
    names: readonly UeNameEntry[],
    resolver: PackageObjectResolver,
    objectName?: string,
  ) {
    this.names = names
    this.resolver = resolver
    this.objectName = objectName
  }

  readProperties(reader: BinaryReader, parentPath = ''): PropertyReadResult {
    const properties: ParsedProperty[] = []
    let terminated = false
    while (reader.remaining() >= 8) {
      const tagStart = reader.tell()
      let propertyName: UeFName
      try {
        propertyName = this.readFName(reader)
      } catch (error) {
        this.pushMalformed(error, undefined)
        break
      }
      if (propertyName.value === 'None') {
        terminated = true
        break
      }

      try {
        const property = this.readProperty(reader, propertyName.value, parentPath, tagStart)
        properties.push(property)
      } catch (error) {
        if (error instanceof UnsupportedPropertyMetadataError) {
          this.diagnostics.push({
            code: 'unsupported-property-type', objectName: this.objectName,
            propertyName: propertyName.value, propertyType: error.propertyType, skipped: false,
            message: error.message,
          })
          break
        }
        this.pushMalformed(error, propertyName.value)
        break
      }
    }
    if (!terminated && reader.remaining() > 0) {
      this.diagnostics.push({
        code: 'trailing-bytes', objectName: this.objectName,
        message: `${reader.remaining()} trailing byte(s) remain after property parsing stopped`,
      })
    }
    return { properties, diagnostics: [...this.diagnostics], terminated }
  }

  private readProperty(reader: BinaryReader, name: string, parentPath: string, tagStart: number, pathOverride?: string): ParsedProperty {
    const propertyType = this.readFName(reader).value
    const size = reader.readInt32LE()
    const arrayIndex = reader.readInt32LE()
    if (size < 0) throw new Error(`Negative serialized size ${size} for ${name}`)
    const metadata = this.readMetadata(reader, propertyType)
    const hasPropertyGuid = reader.readUInt8()
    if (hasPropertyGuid > 1) throw new Error(`Invalid property GUID flag ${hasPropertyGuid} for ${name}`)
    if (hasPropertyGuid === 1) bytesToGuid(reader.readBytes(16))

    const valueStart = reader.tell()
    if (size > reader.remaining()) throw new BinaryReadError(`Property payload exceeds containing object for ${name}`, valueStart, size, reader.remaining())
    const valueReader = reader.subReader(size, `${this.objectName ?? 'object'}.${name}`)
    const path = pathOverride ?? (parentPath ? `${parentPath}.${name}` : name)
    const value = this.readValue(valueReader, propertyType, metadata, path, name, size)
    if (valueReader.remaining() > 0 && !this.isIntentionallySkipped(propertyType)) {
      this.diagnostics.push({
        code: 'trailing-bytes', objectName: this.objectName, propertyName: name, propertyType,
        message: `${valueReader.remaining()} trailing byte(s) in ${path}`, rawSize: size,
      })
    }
    return {
      name, type: propertyType, arrayIndex, serializedSize: size, value, path,
      byteRange: { start: tagStart, end: reader.tell() },
      ...(Object.keys(metadata).length ? { metadata } : {}),
    }
  }

  private readMetadata(reader: BinaryReader, propertyType: string): PropertyMetadata {
    if (propertyType === 'StructProperty') {
      const structType = this.readFName(reader).value
      bytesToGuid(reader.readBytes(16))
      return { structType }
    }
    if (propertyType === 'BoolProperty') {
      return { enumType: reader.readUInt8() === 0 ? 'false' : 'true' }
    }
    if (propertyType === 'ByteProperty' || propertyType === 'EnumProperty') {
      return { enumType: this.readFName(reader).value }
    }
    if (propertyType === 'ArrayProperty') {
      const innerType = this.readFName(reader).value
      return { innerType }
    }
    if (propertyType === 'SetProperty') return { innerType: this.readFName(reader).value }
    if (propertyType === 'MapProperty') {
      const keyType = this.readFName(reader).value
      const valueType = this.readFName(reader).value
      return { innerType: `${keyType}:${valueType}` }
    }
    if (METADATA_FREE_PROPERTY_TYPES.has(propertyType)) return {}
    throw new UnsupportedPropertyMetadataError(propertyType)
  }

  private readValue(
    reader: BinaryReader,
    propertyType: string,
    metadata: PropertyMetadata,
    path: string,
    propertyName: string,
    rawSize: number,
  ): JsonValue {
    switch (propertyType) {
      case 'FloatProperty': return reader.readFloat32LE()
      case 'IntProperty': return reader.readInt32LE()
      case 'Int64Property': return reader.readInt64LE()
      case 'UInt32Property': return reader.readUInt32LE()
      case 'BoolProperty': return metadata.enumType === 'true'
      case 'NameProperty': return this.readFName(reader).value
      case 'ObjectProperty': return this.resolver.resolve(reader.readInt32LE()) as unknown as JsonValue
      case 'SoftObjectProperty': return this.readSoftObject(reader, propertyName, rawSize)
      case 'StrProperty': return reader.readFString()
      case 'ByteProperty': return rawSize === 1 ? reader.readUInt8() : this.readFName(reader).value
      case 'EnumProperty': return this.readFName(reader).value
      case 'StructProperty': return this.readStruct(reader, metadata.structType, path, propertyName)
      case 'ArrayProperty': return this.readArray(reader, metadata, path, propertyName)
      default:
        reader.skip(reader.remaining())
        this.diagnostics.push({
          code: 'unsupported-property-type', objectName: this.objectName,
          propertyName, propertyType, rawSize, skipped: true,
          message: `Safely skipped unsupported ${propertyType} payload`,
        })
        return { unsupported: true, rawSize }
    }
  }

  private readSoftObject(reader: BinaryReader, propertyName: string, rawSize: number): JsonValue {
    try {
      const assetPathName = this.readFName(reader).value
      const subPathString = reader.readFString()
      return { assetPathName, subPathString }
    } catch {
      reader.seek(reader.bytes.byteLength)
      this.diagnostics.push({
        code: 'unsupported-property-type', objectName: this.objectName,
        propertyName, propertyType: 'SoftObjectProperty', rawSize, skipped: true,
        message: 'Safely skipped an unsupported SoftObjectProperty payload variant',
      })
      return { unsupported: true, rawSize }
    }
  }

  private readStruct(reader: BinaryReader, structType: string | undefined, path: string, propertyName: string): JsonValue {
    if (structType === 'Vector' && reader.remaining() === 12) {
      return { X: reader.readFloat32LE(), Y: reader.readFloat32LE(), Z: reader.readFloat32LE() }
    }
    if (structType === 'LinearColor') {
      if (reader.remaining() === 16) {
        return {
          R: reader.readFloat32LE(), G: reader.readFloat32LE(),
          B: reader.readFloat32LE(), A: reader.readFloat32LE(),
        }
      }
      const rawSize = reader.remaining()
      reader.seek(reader.bytes.byteLength)
      this.diagnostics.push({
        code: 'struct-size-mismatch', objectName: this.objectName, propertyName,
        propertyType: 'StructProperty', rawSize, skipped: true,
        message: `LinearColor requires exactly 16 serialized bytes; received ${rawSize}`,
      })
      return { unsupported: true, structType, rawSize }
    }
    try {
      const nested = new UePropertyReader(this.names, this.resolver, this.objectName)
      const result = nested.readProperties(reader, path)
      this.diagnostics.push(...result.diagnostics)
      if (!result.terminated) throw new Error(`Tagged struct ${structType ?? '<unknown>'} has no None terminator`)
      return result.properties as unknown as JsonValue
    } catch (error) {
      reader.seek(reader.bytes.byteLength)
      this.diagnostics.push({
        code: 'struct-parse-failed', objectName: this.objectName, propertyName,
        propertyType: 'StructProperty', skipped: true,
        message: error instanceof Error ? error.message : String(error),
      })
      return { unsupported: true, structType: structType ?? null }
    }
  }

  private readArray(reader: BinaryReader, metadata: PropertyMetadata, path: string, propertyName: string): JsonValue {
    try {
      const count = reader.readInt32LE()
      if (count < 0 || count > 1_000_000) throw new Error(`Invalid array count ${count}`)
      const values: JsonValue[] = []
      for (let index = 0; index < count; index += 1) {
        switch (metadata.innerType) {
          case 'StructProperty': {
            if (index !== 0) break
            const wrapperName = this.readFName(reader).value
            const wrapperType = this.readFName(reader).value
            const wrapperSize = reader.readInt32LE()
            reader.readInt32LE() // Array index.
            if (wrapperType !== 'StructProperty') throw new Error(`Array struct wrapper ${wrapperName} is tagged as ${wrapperType}`)
            const structType = this.readFName(reader).value
            bytesToGuid(reader.readBytes(16))
            const hasGuid = reader.readUInt8()
            if (hasGuid > 1) throw new Error(`Invalid array struct GUID flag ${hasGuid}`)
            if (hasGuid === 1) reader.skip(16)
            const elementsReader = reader.subReader(wrapperSize, `${this.objectName ?? 'object'}.${propertyName} elements`)
            for (let structIndex = 0; structIndex < count; structIndex += 1) {
              if (structType === 'Vector') {
                values.push({ X: elementsReader.readFloat32LE(), Y: elementsReader.readFloat32LE(), Z: elementsReader.readFloat32LE() })
                continue
              }
              const nested = new UePropertyReader(this.names, this.resolver, this.objectName)
              const result = nested.readProperties(elementsReader, `${path}[${structIndex}]`)
              this.diagnostics.push(...result.diagnostics)
              if (!result.terminated) throw new Error(`Array struct element ${structIndex} has no None terminator`)
              values.push(result.properties as unknown as JsonValue)
            }
            if (elementsReader.remaining() !== 0) throw new Error(`Array struct wrapper has ${elementsReader.remaining()} trailing byte(s)`)
            break
          }
          case 'ObjectProperty': values.push(this.resolver.resolve(reader.readInt32LE()) as unknown as JsonValue); break
          case 'FloatProperty': values.push(reader.readFloat32LE()); break
          case 'IntProperty': values.push(reader.readInt32LE()); break
          case 'NameProperty': values.push(this.readFName(reader).value); break
          default: throw new Error(`Unsupported array inner type ${metadata.innerType ?? '<missing>'}`)
        }
      }
      return values
    } catch (error) {
      reader.seek(reader.bytes.byteLength)
      this.diagnostics.push({
        code: 'array-parse-failed', objectName: this.objectName, propertyName,
        propertyType: 'ArrayProperty', skipped: true,
        message: error instanceof Error ? error.message : String(error),
      })
      return { unsupported: true, innerType: metadata.innerType ?? null }
    }
  }

  private readFName(reader: BinaryReader): UeFName {
    const nameIndex = reader.readInt32LE()
    const number = reader.readInt32LE()
    const entry = this.names[nameIndex]
    if (!entry) throw new Error(`Name index ${nameIndex} is out of range`)
    return { nameIndex, number, value: number === 0 ? entry.value : `${entry.value}_${number - 1}` }
  }

  private isIntentionallySkipped(propertyType: string): boolean {
    return ![
      'FloatProperty', 'IntProperty', 'Int64Property', 'UInt32Property', 'BoolProperty',
      'NameProperty', 'ObjectProperty', 'SoftObjectProperty', 'StrProperty', 'ByteProperty',
      'EnumProperty', 'StructProperty', 'ArrayProperty',
    ].includes(propertyType)
  }

  private pushMalformed(error: unknown, propertyName: string | undefined): void {
    this.diagnostics.push({
      code: 'malformed-property-tag', objectName: this.objectName,
      ...(propertyName ? { propertyName } : {}),
      message: error instanceof Error ? error.message : String(error),
    })
  }
}

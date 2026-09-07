import { describe, expect, it } from 'vitest'
import { BinaryReadError, BinaryReader } from '../src/research/ue4/binaryReader'
import { PackageObjectResolver } from '../src/research/ue4/objectResolver'
import { parseUePackage, UePackageParseError } from '../src/research/ue4/packageReader'
import { UePropertyReader } from '../src/research/ue4/propertyReader'
import type { ParsedProperty, UeExportEntry, UeImportEntry, UeNameEntry } from '../src/research/ue4/packageTypes'
import { assertSafeAssetPath, flattenProperties } from '../scripts/game-data-extractor'

class FixtureWriter {
  readonly bytes: number[] = []

  int8(value: number): this { this.bytes.push(value & 0xff); return this }
  int16(value: number): this { this.bytes.push(value & 0xff, (value >>> 8) & 0xff); return this }
  int32(value: number): this {
    const unsigned = value >>> 0
    this.bytes.push(unsigned & 0xff, (unsigned >>> 8) & 0xff, (unsigned >>> 16) & 0xff, (unsigned >>> 24) & 0xff)
    return this
  }
  int64(value: number): this { this.int32(value); this.int32(0); return this }
  float32(value: number): this {
    const bytes = new Uint8Array(4)
    new DataView(bytes.buffer).setFloat32(0, value, true)
    this.raw(bytes)
    return this
  }
  raw(values: ArrayLike<number>): this { this.bytes.push(...Array.from(values)); return this }
  zeros(count: number): this { this.bytes.push(...Array<number>(count).fill(0)); return this }
  fstring(value: string): this {
    const encoded = new TextEncoder().encode(value)
    this.int32(encoded.length + 1).raw(encoded).int8(0)
    return this
  }
  fname(index: number, number = 0): this { return this.int32(index).int32(number) }
  patchInt32(offset: number, value: number): void {
    const unsigned = value >>> 0
    this.bytes.splice(offset, 4, unsigned & 0xff, (unsigned >>> 8) & 0xff, (unsigned >>> 16) & 0xff, (unsigned >>> 24) & 0xff)
  }
  uint8Array(): Uint8Array { return Uint8Array.from(this.bytes) }
}

const fixtureNames = [
  'None', 'Test_C', 'Default__Test_C', '/Script/CoreUObject', 'Class', 'ImportedProjectile_C',
  'FloatValue', 'FloatProperty', 'IntValue', 'IntProperty', 'Enabled', 'BoolProperty',
  'Point', 'StructProperty', 'Vector', 'Items', 'ArrayProperty', 'Element', 'ElementStruct',
  'Number', 'ObjectRef', 'ObjectProperty', 'Unknown', 'TextProperty',
  'Tint', 'LinearColor', 'BadTint',
]

const nameIndex = (value: string): number => {
  const index = fixtureNames.indexOf(value)
  if (index < 0) throw new Error(`Fixture name is missing: ${value}`)
  return index
}

function propertyTag(name: string, type: string, payload: FixtureWriter, metadata?: (writer: FixtureWriter) => void): FixtureWriter {
  const writer = new FixtureWriter()
  writer.fname(nameIndex(name)).fname(nameIndex(type)).int32(payload.bytes.length).int32(0)
  metadata?.(writer)
  writer.int8(0).raw(payload.bytes)
  return writer
}

function buildSyntheticPackage(): { uasset: Uint8Array; uexp: Uint8Array } {
  const nested = new FixtureWriter()
  nested.raw(propertyTag('Number', 'IntProperty', new FixtureWriter().int32(3)).bytes)
  nested.raw(propertyTag('ObjectRef', 'ObjectProperty', new FixtureWriter().int32(-1)).bytes)
  nested.fname(nameIndex('None'))
  const arrayPayload = new FixtureWriter().int32(1)
  arrayPayload.fname(nameIndex('Element')).fname(nameIndex('StructProperty')).int32(nested.bytes.length).int32(0)
    .fname(nameIndex('ElementStruct')).zeros(16).int8(0).raw(nested.bytes)

  const cdo = new FixtureWriter()
  cdo.raw(propertyTag('FloatValue', 'FloatProperty', new FixtureWriter().float32(0.6000000238418579)).bytes)
  cdo.raw(propertyTag('IntValue', 'IntProperty', new FixtureWriter().int32(40)).bytes)
  cdo.raw(propertyTag('Enabled', 'BoolProperty', new FixtureWriter(), (writer) => writer.int8(1)).bytes)
  cdo.raw(propertyTag('Point', 'StructProperty', new FixtureWriter().float32(45).float32(0).float32(25), (writer) => writer.fname(nameIndex('Vector')).zeros(16)).bytes)
  cdo.raw(propertyTag('Tint', 'StructProperty', new FixtureWriter().float32(0.25).float32(0.5).float32(0.75).float32(1), (writer) => writer.fname(nameIndex('LinearColor')).zeros(16)).bytes)
  cdo.raw(propertyTag('Items', 'ArrayProperty', arrayPayload, (writer) => writer.fname(nameIndex('StructProperty'))).bytes)
  cdo.raw(propertyTag('Unknown', 'TextProperty', new FixtureWriter().raw([1, 2, 3])).bytes)
  cdo.fname(nameIndex('None'))

  const header = new FixtureWriter()
  header.int32(0x9e2a83c1).int32(-7).int32(0).int32(0).int32(0).int32(0)
  const totalHeaderOffset = header.bytes.length; header.int32(0)
  header.fstring('None').int32(0x80000000)
  header.int32(fixtureNames.length)
  const nameOffsetField = header.bytes.length; header.int32(0)
  header.int32(0).int32(0)
  header.int32(2)
  const exportOffsetField = header.bytes.length; header.int32(0)
  header.int32(1)
  const importOffsetField = header.bytes.length; header.int32(0)
  header.int32(0).int32(0).int32(0).int32(0).int32(0).zeros(16)
  header.int32(1).int32(2).int32(fixtureNames.length)
  header.int16(0).int16(0).int16(0).int32(0).int32(0)
  header.int16(0).int16(0).int16(0).int32(0).int32(0)
  header.int32(0).int32(0).int32(0).int32(0).int32(0).int64(0).int32(0).int32(0).int32(0).int32(0)
  expect(header.bytes).toHaveLength(193)

  const nameOffset = header.bytes.length
  fixtureNames.forEach((name) => header.fstring(name).zeros(4))
  const importOffset = header.bytes.length
  header.fname(nameIndex('/Script/CoreUObject')).fname(nameIndex('Class')).int32(0).fname(nameIndex('ImportedProjectile_C'))
  const exportOffset = header.bytes.length
  writeExport(header, -1, 0, 'Test_C', 0, 0)
  const cdoOffsetField = header.bytes.length + 36
  writeExport(header, 1, 0, 'Default__Test_C', cdo.bytes.length, 0)
  const totalHeaderSize = header.bytes.length
  header.patchInt32(totalHeaderOffset, totalHeaderSize)
  header.patchInt32(nameOffsetField, nameOffset)
  header.patchInt32(importOffsetField, importOffset)
  header.patchInt32(exportOffsetField, exportOffset)
  header.patchInt32(cdoOffsetField, totalHeaderSize)
  return { uasset: header.uint8Array(), uexp: cdo.uint8Array() }
}

function writeExport(writer: FixtureWriter, classIndex: number, superIndex: number, objectName: string, serialSize: number, serialOffset: number): void {
  const start = writer.bytes.length
  writer.int32(classIndex).int32(superIndex).int32(0).int32(0).fname(nameIndex(objectName)).int32(0)
    .int64(serialSize).int64(serialOffset).int32(0).int32(0).int32(0).zeros(16).int32(0).int32(0).int32(0)
    .int32(0).int32(0).int32(0).int32(0).int32(0)
  expect(writer.bytes.length - start).toBe(104)
}

describe('bounds-safe UE4 binary reader', () => {
  it('reads narrow and UTF-16 FString values and rejects missing bytes', () => {
    const writer = new FixtureWriter().fstring('None').int32(-3).raw([0x41, 0, 0x42, 0, 0, 0])
    const reader = new BinaryReader(writer.uint8Array())
    expect(reader.readFString()).toBe('None')
    expect(reader.readFString()).toBe('AB')
    expect(() => reader.readUInt8()).toThrow(BinaryReadError)
  })
})

describe('Minecraft Dungeons targeted UE4 package subset', () => {
  it('parses header tables, CDO scalar values, nested struct arrays, references, and safe skips', () => {
    const fixture = buildSyntheticPackage()
    const parsed = parseUePackage(fixture.uasset, fixture.uexp, { strict: true, assetPath: 'Dungeons/Content/Test' })
    const properties = flattenProperties(parsed.objects[0]!.properties)
    const value = (path: string) => properties.find((property) => property.path === path)?.value

    expect(parsed.summary).toMatchObject({ magic: 0x9e2a83c1, legacyFileVersion: -7, nameCount: fixtureNames.length, importCount: 1, exportCount: 2 })
    expect(parsed.names.map((entry) => entry.value)).toEqual(fixtureNames)
    expect(parsed.imports[0]?.objectName.value).toBe('ImportedProjectile_C')
    expect(parsed.exports.map((entry) => entry.objectName.value)).toEqual(['Test_C', 'Default__Test_C'])
    expect(parsed.objects[0]).toMatchObject({ objectName: 'Default__Test_C', className: 'Test_C', isClassDefaultObject: true })
    expect(value('FloatValue')).toBe(0.6000000238418579)
    expect(value('IntValue')).toBe(40)
    expect(value('Enabled')).toBe(true)
    expect(value('Point')).toEqual({ X: 45, Y: 0, Z: 25 })
    expect(value('Tint')).toEqual({ R: 0.25, G: 0.5, B: 0.75, A: 1 })
    expect(value('Items[0].Number')).toBe(3)
    expect(value('Items[0].ObjectRef')).toMatchObject({ rawPackageIndex: -1, kind: 'import', objectName: 'ImportedProjectile_C' })
    expect(value('Unknown')).toEqual({ unsupported: true, rawSize: 3 })
    expect(parsed.diagnostics).toContainEqual(expect.objectContaining({ code: 'unsupported-property-type', propertyName: 'Unknown', skipped: true }))
  })

  it('rejects a LinearColor payload whose fixed serialized size is not 16 bytes', () => {
    const fixture = buildSyntheticPackage()
    const parsed = parseUePackage(fixture.uasset, fixture.uexp, { assetPath: 'Dungeons/Content/Test' })
    expect(parsed.diagnostics.some((diagnostic) => diagnostic.code === 'struct-size-mismatch')).toBe(false)

    const names: UeNameEntry[] = fixtureNames.map((value, index) => ({ index, value, hashBytes: '00000000' }))
    const resolver = new PackageObjectResolver([], [])
    const malformed = propertyTag('BadTint', 'StructProperty', new FixtureWriter().float32(1).float32(1).float32(1), (writer) => writer.fname(nameIndex('LinearColor')).zeros(16))
    malformed.fname(nameIndex('None'))
    const reader = new UePropertyReader(names, resolver, 'Default__Test_C')
    const result = reader.readProperties(new BinaryReader(malformed.uint8Array()))

    expect(result.properties[0]?.value).toEqual({ unsupported: true, structType: 'LinearColor', rawSize: 12 })
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ code: 'struct-size-mismatch', rawSize: 12 }))
  })

  it('resolves null, import, export, and invalid FPackageIndex values', () => {
    const names: UeNameEntry[] = [{ index: 0, value: 'Object', hashBytes: '00000000' }]
    const fname = { nameIndex: 0, number: 0, value: names[0]!.value }
    const imports: UeImportEntry[] = [{ index: 0, classPackage: fname, className: fname, outerIndex: 0, objectName: fname }]
    const exports: UeExportEntry[] = [{ index: 0, classIndex: -1, superIndex: 0, templateIndex: 0, outerIndex: 0, objectName: fname, objectFlags: 0, serialSize: 0, serialOffset: 0 }]
    const resolver = new PackageObjectResolver(imports, exports)

    expect(resolver.resolve(0).kind).toBe('null')
    expect(resolver.resolve(-1).kind).toBe('import')
    expect(resolver.resolve(1).kind).toBe('export')
    expect(resolver.resolve(-2).kind).toBe('invalid')
    expect(resolver.resolve(2).kind).toBe('invalid')
  })

  it('rejects invalid magic and out-of-range export serial data', () => {
    const invalidMagic = buildSyntheticPackage()
    invalidMagic.uasset[0] = 0
    expect(() => parseUePackage(invalidMagic.uasset, invalidMagic.uexp)).toThrow(UePackageParseError)

    const invalidSerial = buildSyntheticPackage()
    expect(() => parseUePackage(invalidSerial.uasset, new Uint8Array())).toThrow(/invalid \.uexp range/)
  })

  it('rejects absolute paths and traversal before local reads', () => {
    expect(() => assertSafeAssetPath('/Users/example/asset')).toThrow(/Unsafe/)
    expect(() => assertSafeAssetPath('../asset')).toThrow(/Unsafe/)
    expect(() => assertSafeAssetPath('Dungeons/Content/asset')).not.toThrow()
  })
})

// Compile-time guard that keeps the synthetic test centered on public property output.
const parsedPropertyShape: Pick<ParsedProperty, 'name' | 'type' | 'path'> | undefined = undefined
void parsedPropertyShape

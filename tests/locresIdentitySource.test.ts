import { describe, expect, it } from 'vitest'
import { parseLocresV2, verifyGreatHammerLocalizationSource, collectGreatHammerLocalizationSourceErrors, GREAT_HAMMER_LOCALIZATION_SOURCE } from '../scripts/locres-identity-source'

// Entirely synthetic protocol fixture. No private localization bytes or
// translation corpus are copied into this test or any committed artifact.
function fixture(options: { duplicateKey?: boolean; badIndex?: boolean; badReferences?: boolean; unicode?: boolean } = {}) {
  const int = (value: number) => { const result = Buffer.alloc(4); result.writeInt32LE(value); return result }
  const uint = (value: number) => { const result = Buffer.alloc(4); result.writeUInt32LE(value); return result }
  const string = (value: string, unicode = false) => Buffer.concat([int(unicode ? -value.length - 1 : Buffer.byteLength(value) + 1), Buffer.from(`${value}\0`, unicode ? 'utf16le' : 'utf8')])
  const key = (name: string, index: number) => Buffer.concat([uint(0), string(name), uint(42), int(index)])
  const metadata = Buffer.concat([
    uint(2), uint(1), uint(0), string('SyntheticNamespace'), uint(2),
    key('SyntheticKey', options.badIndex ? 5 : 0), key(options.duplicateKey ? 'SyntheticKey' : 'SecondKey', 0),
  ])
  const header = Buffer.alloc(25)
  // Public format identifier; the following records are invented software data.
  ;[1970541582, 4228074087, 2643465546, 461322179].forEach((word, index) => header.writeUInt32LE(word, index * 4))
  header[16] = 2
  header.writeBigInt64LE(BigInt(header.length + metadata.length), 17)
  return Buffer.concat([header, metadata, int(1), string(options.unicode ? '仮の表示名' : 'Synthetic display', options.unicode), int(options.badReferences ? 1 : 2)])
}

describe('strict localization identity source', () => {
  it('decodes exact namespace/key/index joins only after complete structure/reference validation', () => {
    const parsed = parseLocresV2(fixture())
    expect(parsed).toMatchObject({ formatVersion: 2, namespaceCount: 1, entryCount: 2, localizedStringCount: 1 })
    expect(parsed.entries.map(({ namespace, key, value, localizedStringIndex }) => ({ namespace, key, value, localizedStringIndex }))).toEqual([
      { namespace: 'SyntheticNamespace', key: 'SyntheticKey', value: 'Synthetic display', localizedStringIndex: 0 },
      { namespace: 'SyntheticNamespace', key: 'SecondKey', value: 'Synthetic display', localizedStringIndex: 0 },
    ])
    expect(parseLocresV2(fixture({ unicode: true })).entries[0]?.value).toBe('仮の表示名')
  })

  it('rejects format, bounds, duplicate keys, indexes, refcounts and trailing/truncated data', () => {
    const base = fixture()
    expect(() => parseLocresV2(base.subarray(0, -1))).toThrow('truncated')
    expect(() => parseLocresV2(Buffer.concat([base, Buffer.alloc(1)]))).toThrow('trailing')
    expect(() => parseLocresV2(fixture({ duplicateKey: true }))).toThrow('duplicate namespace/key')
    expect(() => parseLocresV2(fixture({ badIndex: true }))).toThrow('index out of bounds')
    expect(() => parseLocresV2(fixture({ badReferences: true }))).toThrow('reference census')
    const signature = Buffer.from(base); signature[0] = 0
    expect(() => parseLocresV2(signature)).toThrow('signature')
    const version = Buffer.from(base); version[16] = 3
    expect(() => parseLocresV2(version)).toThrow('format version')
    const offset = Buffer.from(base); offset.writeBigInt64LE(BigInt(base.length + 1), 17)
    expect(() => parseLocresV2(offset)).toThrow('table offset')
    const census = Buffer.from(base); census.writeUInt32LE(200001, 25)
    expect(() => parseLocresV2(census)).toThrow('census out of bounds')
    const length = Buffer.from(base); length.writeInt32LE(1_000_001, 37)
    expect(() => parseLocresV2(length)).toThrow('FString length')
  })

  it('pins the single reviewed resource and identity-only fact without accepting a synthetic resource as Evidence', () => {
    const source = GREAT_HAMMER_LOCALIZATION_SOURCE
    expect(collectGreatHammerLocalizationSourceErrors(source)).toEqual([])
    expect(collectGreatHammerLocalizationSourceErrors(undefined)).not.toEqual([])
    expect(() => verifyGreatHammerLocalizationSource(fixture())).toThrow('hash/size')
    for (const patch of [{ rawIdentity: 'Hammer_Unique1' }, { domainId: 'stormlander' }, { namespace: '' }, { key: 'Great Hammer' }, { displayName: 'Hammer' }, { localizedStringIndex: 0 }, { entryRange: [125961, 125985] }, { localizedStringRecordRange: [0, 1] }, { category: 'ranged-weapon' }]) {
      expect(collectGreatHammerLocalizationSourceErrors({ ...source, bridge: { ...source.bridge, ...patch } })).toContain('Great Hammer exact localization key/fact/range drift')
    }
    expect(collectGreatHammerLocalizationSourceErrors({ ...source, source: { ...source.source, sha256: '0'.repeat(64) } })).toContain('Great Hammer localization resource provenance drift')
    expect(collectGreatHammerLocalizationSourceErrors({ ...source, privatePayloadCommitted: true })).not.toEqual([])
    expect(collectGreatHammerLocalizationSourceErrors({ ...source, payload: 'unreviewed' })).not.toEqual([])
    expect(collectGreatHammerLocalizationSourceErrors({ ...source, scope: 'grants effective gameplay' })).not.toEqual([])
    expect(collectGreatHammerLocalizationSourceErrors({ ...source, gameVersion: 'other' })).not.toEqual([])
  })

})

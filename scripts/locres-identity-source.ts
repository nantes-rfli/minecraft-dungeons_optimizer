import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import source from '../research/sources/great-hammer-localization-identity.json' with { type: 'json' }

export const LOCALIZATION_IDENTITY_ALIAS_BASIS = 'serialized-item-id + reviewed-exact-localization-key + catalog-category-evidence'
export const GREAT_HAMMER_LOCALIZATION_SOURCE = source
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
const ensure = (valid: boolean, message: string): void => { if (!valid) throw new Error(`Locres identity: ${message}`) }

export interface LocresIdentityEntry {
  namespace: string
  key: string
  sourceStringHash: number
  localizedStringIndex: number
  entryRange: [number, number]
  localizedStringRecordRange: [number, number]
  value: string
}

/** Strict optimized Locres v2 reader. It reads data, never executes it. The
 * bounds, exact table offset/EOF, unique keys, indexes and reference counts are
 * checked across the complete resource before a selected fact is returned.
 * No private payload or full translation table is written by the CLI.
 */
export function parseLocresV2(bytes: Buffer) {
  ensure(bytes.length >= 33 && bytes.length <= 32 * 1024 * 1024, 'resource size out of bounds')
  // Public UE Localization Resource format GUID, not game-specific payload.
  const magic = [1970541582, 4228074087, 2643465546, 461322179]
  ensure(magic.every((word, index) => bytes.readUInt32LE(index * 4) === word), 'unsupported resource signature')
  ensure(bytes[16] === 2, 'only optimized format version 2 is reviewed')
  const tableOffset = Number(bytes.readBigInt64LE(17))
  ensure(Number.isSafeInteger(tableOffset) && tableOffset >= 33 && tableOffset <= bytes.length - 4, 'invalid string table offset')
  let at = 25
  const take = (size: number) => {
    ensure(Number.isSafeInteger(size) && size >= 0 && size <= bytes.length - at, 'truncated field')
    const start = at
    at += size
    return bytes.subarray(start, at)
  }
  const uint = () => take(4).readUInt32LE()
  const int = () => take(4).readInt32LE()
  const string = () => {
    const count = int()
    ensure(count !== 0 && Math.abs(count) <= 1_000_000, 'invalid FString length')
    const raw = take(Math.abs(count) * (count < 0 ? 2 : 1))
    const value = new TextDecoder(count < 0 ? 'utf-16le' : 'utf-8', { fatal: true }).decode(raw)
    ensure(value.endsWith('\0') && !value.slice(0, -1).includes('\0'), 'invalid FString termination')
    return value.slice(0, -1)
  }
  const entryCount = uint(), namespaceCount = uint()
  ensure(entryCount <= 200_000 && namespaceCount <= 10_000, 'resource census out of bounds')
  const entries: Omit<LocresIdentityEntry, 'value' | 'localizedStringRecordRange'>[] = []
  const namespaces = new Set<string>(), keys = new Set<string>()
  for (let n = 0; n < namespaceCount; n++) {
    uint() // FTextKey hash; this is an index hint, not identity evidence.
    const namespace = string()
    ensure(!namespaces.has(namespace), 'duplicate namespace')
    namespaces.add(namespace)
    const count = uint()
    ensure(count <= entryCount - entries.length, 'namespace key count exceeds declared entries')
    for (let k = 0; k < count; k++) {
      const start = at
      uint() // Exact key text, not its hash, is used for the join.
      const key = string(), sourceStringHash = uint(), localizedStringIndex = int()
      const tuple = JSON.stringify([namespace, key])
      ensure(!keys.has(tuple), 'duplicate namespace/key tuple')
      keys.add(tuple)
      entries.push({ namespace, key, sourceStringHash, localizedStringIndex, entryRange: [start, at] })
    }
  }
  ensure(entries.length === entryCount && at === tableOffset, 'entry census or string table offset mismatch')
  const localizedStringCount = int()
  ensure(localizedStringCount >= 0 && localizedStringCount <= 200_000, 'invalid localized string count')
  const strings: { value: string; range: [number, number]; references: number }[] = []
  for (let index = 0; index < localizedStringCount; index++) {
    const start = at, value = string(), references = int()
    ensure(references >= 0 && references <= entryCount, 'invalid string reference count')
    strings.push({ value, range: [start, at], references })
  }
  ensure(at === bytes.length, 'trailing bytes after reviewed resource')
  const references = new Map<number, number>()
  for (const entry of entries) {
    ensure(entry.localizedStringIndex >= 0 && entry.localizedStringIndex < strings.length, 'localized string index out of bounds')
    references.set(entry.localizedStringIndex, (references.get(entry.localizedStringIndex) ?? 0) + 1)
  }
  ensure(strings.every((value, index) => value.references === (references.get(index) ?? 0)), 'localized string reference census mismatch')
  return { formatVersion: 2, namespaceCount, entryCount, localizedStringCount, localizedStringArrayOffset: tableOffset,
    entries: entries.map((entry): LocresIdentityEntry => ({ ...entry, value: strings[entry.localizedStringIndex]!.value, localizedStringRecordRange: strings[entry.localizedStringIndex]!.range })) }
}

/** The one admitted localization bridge is deliberately finite. A new name,
 * language, source revision or resource layout requires separate review. */
export function collectGreatHammerLocalizationSourceErrors(value: unknown): string[] {
  if (!value || typeof value !== 'object') return ['Great Hammer localization source must be an object']
  const row = value as typeof source
  const errors: string[] = []
  if (!same(Object.keys(row).sort(), ['schemaVersion', 'kind', 'gameVersion', 'versionBasis', 'source', 'bridge', 'scope', 'privatePayloadCommitted'].sort())) errors.push('Great Hammer localization source contains unreviewed fields')
  if (row.schemaVersion !== 1 || row.kind !== 'reviewed-exact-localization-identity-bridge'
    || row.gameVersion !== '1.17.0.0' || row.versionBasis !== 'Existing local QuickBMS 1.17.0.0 input claim; official authenticity is not independently verified.' || row.privatePayloadCommitted !== false
    || row.scope !== 'Identity only. Exact ItemType key joins both Raw serialized identity fields to the independent canonical display name; no slug, icon, sound-name or family inference. No gameplay value, timing, effect, or Runtime Promotion is granted.') errors.push('Great Hammer localization identity/version/scope drift')
  if (!same(row.source, { relativePath: 'Dungeons/Content/Localization/Game/en/Game.locres', sha256: 'ad2c5866665bc87a6267b234a9cc5c373c5f4376f230abfe3638826134d7b5f6', size: 391734, formatVersion: 2, namespaceCount: 185, entryCount: 5151, localizedStringCount: 4521, localizedStringArrayOffset: 191902 })) errors.push('Great Hammer localization resource provenance drift')
  if (!same(row.bridge, { category: 'melee-weapon', domainId: 'great-hammer', rawIdentity: 'Hammer', packagePath: 'Dungeons/Content/Actors/Equipment/MeleeWeapons/Hammer/BP_HammerInstance', namespace: 'ItemType', key: 'Hammer', displayName: 'Great Hammer', localizedStringIndex: 2991, sourceStringHash: 2567795218, entryRange: [125961, 125984], localizedStringRecordRange: [318993, 319014], canonicalSource: 'research/source-harvest.json#/records[category=melee-weapon,id=great-hammer]/known[property=identity]' })) errors.push('Great Hammer exact localization key/fact/range drift')
  return errors
}

export function verifyGreatHammerLocalizationSource(bytes: Buffer, declaration: unknown = source): void {
  ensure(collectGreatHammerLocalizationSourceErrors(declaration).length === 0, 'reviewed declaration drift')
  ensure(bytes.length === source.source.size && crypto.createHash('sha256').update(bytes).digest('hex') === source.source.sha256, 'private input hash/size mismatch')
  const parsed = parseLocresV2(bytes)
  const selected = parsed.entries.filter((entry) => entry.namespace === source.bridge.namespace && entry.key === source.bridge.key)
  ensure(selected.length === 1, 'exact localization key missing or duplicated')
  const expected = source.bridge, entry = selected[0]!
  ensure(parsed.namespaceCount === source.source.namespaceCount && parsed.entryCount === source.source.entryCount
    && parsed.localizedStringCount === source.source.localizedStringCount && parsed.localizedStringArrayOffset === source.source.localizedStringArrayOffset
    && entry.value === expected.displayName && entry.sourceStringHash === expected.sourceStringHash && entry.localizedStringIndex === expected.localizedStringIndex
    && same(entry.entryRange, expected.entryRange) && same(entry.localizedStringRecordRange, expected.localizedStringRecordRange), 'exact localization source fact drift')
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const input = process.argv.indexOf('--local-file')
  if (input < 0 || !process.argv[input + 1]) throw new Error('Required: --local-file <existing Game/en/Game.locres>; the private input is read only')
  verifyGreatHammerLocalizationSource(fs.readFileSync(process.argv[input + 1]!))
  console.log('Great Hammer localization identity PASS: exact hash, complete format/census, ItemType/Hammer mapping and ranges; no private payload emitted')
}

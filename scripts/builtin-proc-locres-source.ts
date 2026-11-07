import crypto from 'node:crypto'
import source from '../research/sources/builtin-proc-melee-localization-identity.json' with { type: 'json' }
import { GREAT_HAMMER_LOCALIZATION_SOURCE, parseLocresV2 } from './locres-identity-source.ts'
export const BUILTIN_PROC_LOCALIZATION_SOURCE = source
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
const facts = [
  ['whirlwind', 'DoubleAxe_Unique1', 'Whirlwind', 1265, 2073059334, [144772, 144806], [245437, 245455]],
  ['stormlander', 'Hammer_Unique1', 'Stormlander', 3259, 3032583664, [135523, 135554], [330132, 330152]],
] as const
export function collectBuiltinProcLocalizationSourceErrors(value: unknown): string[] {
  if (!value || typeof value !== 'object') return ['Fixed built-in localization source must be an object']
  const row = value as typeof source
  const expected = { ...GREAT_HAMMER_LOCALIZATION_SOURCE, bridge: undefined,
    bridges: facts.map(([id, raw, name, index, hash, entry, record]) => ({ category: 'melee-weapon', domainId: id, rawIdentity: raw, packagePath: `Dungeons/Content/Actors/Equipment/MeleeWeapons/${raw}/BP_${raw}Instance`, namespace: 'ItemType', key: raw, displayName: name, localizedStringIndex: index, sourceStringHash: hash, entryRange: entry, localizedStringRecordRange: record, canonicalSource: `research/source-harvest.json#/records[category=melee-weapon,id=${id}]/known[property=identity]` })) }
  const keys = Object.keys(row).sort(), expectedKeys = Object.keys(expected).filter((k) => k !== 'bridge').sort()
  return same(keys, expectedKeys) && same({ ...row, bridges: undefined }, { ...expected, bridge: undefined, bridges: undefined }) && same(row.bridges, expected.bridges) ? [] : ['Fixed built-in exact localization fact/provenance drift']
}
export function verifyBuiltinProcLocalizationSource(bytes: Buffer, declaration: unknown = source): void {
  const errors = collectBuiltinProcLocalizationSourceErrors(declaration)
  if (errors.length) throw new Error(errors.join('\n'))
  if (crypto.createHash('sha256').update(bytes).digest('hex') !== source.source.sha256 || bytes.length !== source.source.size) throw new Error('Fixed built-in localization source hash/size drift')
  const parsed = parseLocresV2(bytes)
  for (const expected of source.bridges) {
    const rows = parsed.entries.filter((r) => r.namespace === expected.namespace && r.key === expected.key)
    if (rows.length !== 1 || !same(rows[0], { namespace: expected.namespace, key: expected.key, sourceStringHash: expected.sourceStringHash, localizedStringIndex: expected.localizedStringIndex, entryRange: expected.entryRange, value: expected.displayName, localizedStringRecordRange: expected.localizedStringRecordRange })) throw new Error('Fixed built-in exact localization replay drift')
  }
}

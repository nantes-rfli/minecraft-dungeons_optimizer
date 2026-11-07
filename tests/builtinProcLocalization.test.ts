import { describe, expect, it } from 'vitest'
import source from '../research/sources/builtin-proc-melee-localization-identity.json'
import { collectBuiltinProcLocalizationSourceErrors, verifyBuiltinProcLocalizationSource } from '../scripts/builtin-proc-locres-source'

describe('finite two-target localization source boundary', () => {
  it('pins only exact independent names, raw keys, source hash, indexes and ranges', () => {
    expect(collectBuiltinProcLocalizationSourceErrors(source)).toEqual([])
    expect(source.bridges.map((b) => [b.domainId, b.rawIdentity, b.displayName])).toEqual([['whirlwind', 'DoubleAxe_Unique1', 'Whirlwind'], ['stormlander', 'Hammer_Unique1', 'Stormlander']])
    expect(() => verifyBuiltinProcLocalizationSource(Buffer.alloc(source.source.size))).toThrow('hash')
    expect(collectBuiltinProcLocalizationSourceErrors(undefined).length).toBeGreaterThan(0)
  })
  it('fails closed on each identity/provenance/scope drift and unauthorized population expansion', () => {
    for (const index of [0, 1]) for (const mutate of [
      (s: typeof source) => { s.bridges[index]!.key = 'Hammer_Unique2' },
      (s: typeof source) => { s.bridges[index]!.rawIdentity += '_other' },
      (s: typeof source) => { s.bridges[index]!.namespace = 'Texture' },
      (s: typeof source) => { s.bridges[index]!.displayName = 'Great Hammer' },
      (s: typeof source) => { s.bridges[index]!.localizedStringIndex += 1 },
      (s: typeof source) => { s.bridges[index]!.sourceStringHash += 1 },
      (s: typeof source) => { s.bridges[index]!.entryRange[0]! += 1 },
      (s: typeof source) => { s.bridges[index]!.localizedStringRecordRange[1]! += 1 },
      (s: typeof source) => { s.source.sha256 = 'unknown' },
      (s: typeof source) => { s.scope = 'gameplay' },
      (s: typeof source) => { s.bridges.push(s.bridges[index]!) },
    ]) { const changed = structuredClone(source); mutate(changed); expect(collectBuiltinProcLocalizationSourceErrors(changed).length).toBeGreaterThan(0) }
    expect(collectBuiltinProcLocalizationSourceErrors({ ...source, payload: 'not permitted' }).length).toBeGreaterThan(0)
  })
})

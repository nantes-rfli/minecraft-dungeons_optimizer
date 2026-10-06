import fs from 'node:fs'
import { describe, expect, it } from 'vitest'
import { resolveJsonPointer, verifyValueRawTraceProvenance } from '../scripts/formal-value-source-provenance.ts'
import type { RawTrace } from '../src/domain/formal/rawProjection.ts'

const repositoryRoot = fs.realpathSync('.')
const value = JSON.parse(fs.readFileSync('research/domain/formal/value-availability-v2.json', 'utf8')) as {
  provenance: { evidence: { provenance: RawTrace }[] }
}

describe('Raw JSON pointer resolution', () => {
  it.each(['__proto__', 'constructor', 'toString', 'hasOwnProperty'])('rejects inherited object member %s', (key) => {
    expect(resolveJsonPointer(JSON.parse('{"data":{}}'), `/data/${key}`)).toBeUndefined()
  })

  it.each(['00', '01', '000', '-0', '+0', '-', '1.0', '1e0', '2', '9007199254740993'])('rejects invalid or absent array index %s', (key) => {
    expect(resolveJsonPointer({ data: ['zero', 'one'] }, `/data/${key}`)).toBeUndefined()
  })

  it.each(['~', '~2', '~~0', '~10~'])('rejects malformed escapes even when the literal member exists: %s', (key) => {
    const decoded = key.replace(/~1/g, '/').replace(/~0/g, '~')
    expect(resolveJsonPointer({ [decoded]: 'not a valid pointer' }, `/${key}`)).toBeUndefined()
  })

  it('resolves escaped and empty own members, including names also found on prototypes', () => {
    const raw = JSON.parse('{"":{"a/b":{"~key":{"~1":0}}},"constructor":false,"__proto__":[],"01":"object key"}')
    expect(resolveJsonPointer(raw, '')).toBe(raw)
    expect(resolveJsonPointer(raw, '//a~1b/~0key/~01')).toBe(0)
    expect(resolveJsonPointer(raw, '/constructor')).toBe(false)
    expect(resolveJsonPointer(raw, '/__proto__')).toEqual([])
    expect(resolveJsonPointer(raw, '/01')).toBe('object key')
    expect(resolveJsonPointer([null, false, 0, []], '/0')).toBeNull()
    expect(resolveJsonPointer([null, false, 0, []], '/1')).toBe(false)
    expect(resolveJsonPointer([null, false, 0, []], '/2')).toBe(0)
    expect(resolveJsonPointer([null, false, 0, []], '/3')).toEqual([])
  })

  it.each(['data', '#/data', '/data/missing', '/data/value/child'])('leaves unresolved nodes absent: %s', (pointer) => {
    expect(resolveJsonPointer({ data: { value: null } }, pointer)).toBeUndefined()
  })

  describe.each(['full-raw-snapshot', 'structural-inventory-shard'] as const)('%s provenance', (kind) => {
    const trace = value.provenance.evidence.find(({ provenance }) =>
      (kind === 'full-raw-snapshot') === provenance.artifactPath.startsWith('research/raw/packages/'))!.provenance
    const objectPointer = kind === 'full-raw-snapshot' ? '/package' : trace.nodePointer.match(/^\/packages\/\d+/)![0]

    it.each(['__proto__', 'constructor', 'toString'])('rejects fabricated occurrence %s with unchanged package provenance', (key) => {
      expect(() => verifyValueRawTraceProvenance(repositoryRoot, { ...trace, nodePointer: `${objectPointer}/${key}` }))
        .toThrow(/nodePointer does not resolve/)
    })

    it('rejects a zero-padded index on an otherwise resolving committed occurrence', () => {
      const nodePointer = trace.nodePointer.replace(/\/(\d+)(?=\/|$)/, '/0$1')
      expect(nodePointer).not.toBe(trace.nodePointer)
      expect(() => verifyValueRawTraceProvenance(repositoryRoot, { ...trace, nodePointer })).toThrow(/nodePointer/)
    })
  })
})

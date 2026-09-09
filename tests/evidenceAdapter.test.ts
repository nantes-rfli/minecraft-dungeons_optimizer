import { describe, expect, it } from 'vitest'
import { assertIndependent, toLegacyEvidence, validateLedger } from '../src/research/evidenceAdapter/model'
import type { EvidenceLedger } from '../src/research/evidenceAdapter/model'
import ledgerJson from '../research/external-community/evidence-ledger.json'

function fixture(): EvidenceLedger {
  return {
    schemaVersion: 1,
    sources: [{ id: 's@1', sourceId: 's', revision: 1, reference: { id: 's', label: 'Synthetic fixture', kind: 'model-assumption' }, retrievedAt: null, snapshot: { sha256: null, reason: 'Synthetic test, not game evidence' }, originGroup: 'experiment-a', reviewed: true }],
    claims: [{ id: 'c@1', claimId: 'c', revision: 1, sourceRevisionIds: ['s@1'], entity: 'fixture', property: 'damage', kind: 'synthetic', statement: 'Synthetic zero', locator: 'fixture', value: 0, unknownReason: null, unit: 'damage', conditions: { active: true }, gameVersion: 'test' }],
    relations: [],
    decisions: [{ id: 'd@1', decisionId: 'd', revision: 1, claimId: 'c@1', status: 'limited', purpose: 'test', conditions: { active: true }, gameVersion: 'test', blockers: [], regression: 'passed', confidence: 'low', reason: 'Test only' }],
  }
}
const request = { decisionId: 'd@1', entity: 'fixture', property: 'damage', purpose: 'test', gameVersion: 'test', conditions: { active: true }, accepts: (v: unknown): v is number => typeof v === 'number' }
function second(l: EvidenceLedger) {
  l.sources.push({ ...l.sources[0]!, id: 's2@1', sourceId: 's2', reference: { ...l.sources[0]!.reference, id: 's2' }, originGroup: 'experiment-b' })
  l.claims.push({ ...l.claims[0]!, id: 'c2@1', claimId: 'c2', sourceRevisionIds: ['s2@1'], value: 4.3 })
}
describe('Phase 6.9C Evidence adapter', () => {
  it('preserves the exact legacy shape and genuine zero, without confidence weighting', () => {
    expect(toLegacyEvidence(fixture(), request)).toEqual({ value: 0, source: { id: 's', label: 'Synthetic fixture', kind: 'model-assumption' }, confidence: 'low', note: 'Synthetic zero [claim=c@1; decision=d@1; sources=s@1]' })
  })
  it.each([null, undefined, NaN, Infinity, { amount: null }, [0, null]])('rejects unknown/nonfinite payload %j even with permissive decoder', (value) => {
    const l = fixture(); l.claims[0]!.value = value; l.claims[0]!.unknownReason = 'unresolved'
    expect(() => toLegacyEvidence(l, { ...request, accepts: (v): v is number => { void v; return true } })).toThrow('unknown claim')
  })
  it('requires a reason for unknown data and rejects incompatible decoding', () => {
    const l = fixture(); l.claims[0]!.value = null
    expect(() => validateLedger(l)).toThrow('unknown value needs reason')
    expect(() => toLegacyEvidence(fixture(), { ...request, accepts: (v): v is number => { void v; return false } })).toThrow('incompatible')
  })
  it('rejects missing refs, duplicate IDs/revisions and cycles', () => {
    const mutations: ((l: EvidenceLedger) => void)[] = [
      (l) => { l.claims[0]!.sourceRevisionIds = ['missing'] },
      (l) => { l.decisions[0]!.claimId = 'missing' },
      (l) => { l.sources.push(l.sources[0]!) },
      (l) => { l.claims.push({ ...l.claims[0]!, id: 'alias' }) },
      (l) => { l.decisions[0]!.revision = 0 },
      (l) => { l.relations.push({ id: 'r', from: 'c@1', to: 'missing', kind: 'supports', overlap: 'exact', reason: 'test' }) },
      (l) => { second(l); l.relations.push({ id: 'r', from: 'c@1', to: 'c2@1', kind: 'derived-from', overlap: 'exact', reason: 'test' }, { id: 'r2', from: 'c2@1', to: 'c@1', kind: 'corrects', overlap: 'exact', reason: 'test' }) },
    ]
    for (const mutate of mutations) { const l = fixture(); mutate(l); expect(() => validateLedger(l)).toThrow() }
  })
  it('blocks old values only for matching corrections and preserves their history', () => {
    const l = fixture(); second(l)
    l.relations.push({ id: 'r', from: 'c2@1', to: 'c@1', kind: 'corrects', overlap: 'exact', reason: 'Author correction' })
    expect(() => toLegacyEvidence(l, request)).toThrow('corrected claim')
    expect(l.claims[0]!.value).toBe(0)
    l.decisions[0]!.claimId = 'c2@1'
    expect(toLegacyEvidence(l, request).value).toBe(4.3)
    l.claims[1]!.conditions = { active: false }
    expect(() => validateLedger(l)).toThrow('correction scope mismatch')
    l.relations[0]!.overlap = 'disjoint'; l.decisions[0]!.claimId = 'c@1'
    expect(toLegacyEvidence(l, request).value).toBe(0)
  })
  it.each(['partial', 'unknown'] as const)('refuses unresolved %s correction scope', (overlap) => {
    const l = fixture(); second(l); l.relations.push({ id: 'r', from: 'c2@1', to: 'c@1', kind: 'corrects', overlap, reason: 'Unresolved' })
    expect(() => toLegacyEvidence(l, request)).toThrow('unresolved conflict')
  })
  it('checks contradictions and transitive corrected/unknown dependencies', () => {
    const l = fixture(); second(l)
    l.relations.push({ id: 'r', from: 'c@1', to: 'c2@1', kind: 'contradicts', overlap: 'unknown', reason: 'Conflict' })
    expect(() => toLegacyEvidence(l, request)).toThrow('unresolved conflict')
    l.relations[0]!.kind = 'derived-from'; l.claims[1]!.value = null; l.claims[1]!.unknownReason = 'Unknown dependency'
    expect(() => toLegacyEvidence(l, request)).toThrow('unknown claim')
  })
  it('rejects wrong domains, pending adoption, stale decisions and unreviewed sources', () => {
    for (const change of [{ purpose: 'runtime' }, { gameVersion: 'other' }, { entity: 'other' }, { property: 'other' }, { conditions: {} }, { decisionId: 'missing' }]) expect(() => toLegacyEvidence(fixture(), { ...request, ...change })).toThrow()
    const mutations: ((l: EvidenceLedger) => void)[] = [
      (l) => { l.decisions[0]!.status = 'research-only' }, (l) => { l.decisions[0]!.blockers = ['pending'] },
      (l) => { l.decisions[0]!.regression = 'not-run' }, (l) => { l.sources[0]!.reviewed = false },
      (l) => { l.decisions.push({ ...l.decisions[0]!, id: 'd@2', revision: 2, status: 'research-only' }) },
    ]
    for (const mutate of mutations) { const l = fixture(); mutate(l); expect(() => toLegacyEvidence(l, request)).toThrow() }
  })
  it('rejects reused origins and derived holdouts, requiring known independent origins', () => {
    const l = fixture(); second(l)
    expect(() => assertIndependent(l, ['c@1'], ['c2@1'])).not.toThrow()
    l.relations.push({ id: 'r', from: 'c2@1', to: 'c@1', kind: 'derived-from', overlap: 'partial', reason: 'Derived table' })
    expect(() => assertIndependent(l, ['c@1'], ['c2@1'])).toThrow('duplicate origin')
    l.relations = []; l.sources[1]!.originGroup = 'experiment-a'
    expect(() => assertIndependent(l, ['c@1'], ['c2@1'])).toThrow('duplicate origin')
    l.sources[1]!.originGroup = null
    expect(() => assertIndependent(l, ['c@1'], ['c2@1'])).toThrow('unknown origin')
    expect(() => assertIndependent(l, ['missing'], ['c@1'])).toThrow('invalid validation')
  })
  it('keeps all imported external claims research-only with no runtime promotion', () => {
    const l = ledgerJson as EvidenceLedger
    validateLedger(l)
    expect(l.decisions).toHaveLength(l.claims.length)
    for (const d of l.decisions) expect(() => toLegacyEvidence(l, { ...request, decisionId: d.id })).toThrow('adoption blocked')
  })
})

import { describe, expect, it } from 'vitest'
import { buildEvidenceRepository, independentEvidenceIds, parseEvidenceRepository, serializeEvidenceRepository, type EvidenceIntakeRecord, type EvidenceRepository } from '../src/research/evidenceIntake'
import { PHASE8_EVIDENCE_RECORDS, buildPhase8Artifacts } from '../scripts/audit-phase8-evidence'

const base = (): EvidenceIntakeRecord => ({
  ...structuredClone(PHASE8_EVIDENCE_RECORDS[0]!),
  id: 'fixture@1', recordId: 'fixture', revision: 1, corrects: null, correctionReason: null,
  source: { ...structuredClone(PHASE8_EVIDENCE_RECORDS[0]!.source), sourceId: 'fixture-source', originGroup: 'fixture-a' },
  claim: { claimId: 'fixture-claim', entity: 'fixture:item', property: 'damage', statement: 'Measured fixture damage', value: 10 },
  context: { gameVersion: '1.17.0.0', equipment: [{ id: 'fixture:item', power: 251 }], conditions: { target: 'dummy' } },
  measurement: { unit: 'damage', repetitions: 1, observations: [{ value: 10, locator: 'frame 1' }], missingReasons: [] },
  partition: 'calibration',
})

describe('Phase 8A evidence intake', () => {
  it('saves and reloads accepted records without changing validation results', () => {
    const repository = buildEvidenceRepository([base()])
    expect(repository.entries[0]!.assessment).toEqual({ outcome: 'accepted', reasons: [] })
    expect(parseEvidenceRepository(serializeEvidenceRepository(repository))).toEqual(repository)
  })

  it('keeps incomplete external evidence with explicit quarantine reasons', () => {
    const repository = buildEvidenceRepository(PHASE8_EVIDENCE_RECORDS)
    expect(repository.entries.every((entry) => entry.assessment.outcome === 'quarantined')).toBe(true)
    expect(parseEvidenceRepository(serializeEvidenceRepository(repository))).toEqual(repository)
    expect(repository.entries.map((entry) => entry.record.id)).toContain('phase8-dr-ehp-current@1')
    expect(repository.entries[0]!.assessment.reasons).toContain('game-version-missing')
    expect(repository.entries[1]!.assessment.reasons).toContain('origin-independence-unknown')
  })

  it('preserves corrections as sequential revisions and records their diff', () => {
    const first = base()
    const second: EvidenceIntakeRecord = { ...first, id: 'fixture@2', revision: 2, claim: { ...first.claim, value: 11 }, corrects: first.id, correctionReason: 'Corrected frame reading', capturedAt: '2026-09-10T01:00:00+09:00' }
    const third: EvidenceIntakeRecord = { ...second, id: 'fixture@3', revision: 3, claim: { ...second.claim, value: 12 }, corrects: second.id, correctionReason: 'Corrected a second frame reading', capturedAt: '2026-09-10T02:00:00+09:00' }
    const repository = buildEvidenceRepository([first, second, third])
    expect(repository.entries).toHaveLength(3)
    expect(repository.entries[1]!.changedFields).toEqual(['claim'])
    expect(repository.entries[1]!.assessment.reasons).toContain('correction-recorded')
    expect(repository.entries[1]!.assessment.outcome).toBe('accepted')
    expect(repository.entries[2]!.assessment.reasons).not.toContain('unresolved-conflict')
    expect(repository.entries[0]!.record.claim.value).toBe(10)
  })

  it('rejects malformed records, invalid revisions and tampered saved assessments', () => {
    const bad = { ...base(), source: { ...base().source, url: 'http://insecure.example' } }
    expect(() => buildEvidenceRepository([bad])).toThrow('invalid source URL')
    expect(() => buildEvidenceRepository([{ ...base(), claim: { ...base().claim, value: Number.NaN } }])).toThrow('invalid claim value')
    const second = { ...base(), id: 'fixture@2', revision: 2 } as EvidenceIntakeRecord
    expect(() => buildEvidenceRepository([base(), second])).toThrow('must correct previous')
    const repository = buildEvidenceRepository([base()])
    const tampered = { ...repository, entries: [{ ...repository.entries[0]!, assessment: { outcome: 'accepted', reasons: ['invented'] } }] } as EvidenceRepository
    expect(() => parseEvidenceRepository(JSON.stringify(tampered))).toThrow('drift')
  })

  it('accepts generated self-observation URNs but keeps external sources HTTPS-only', () => {
    const selfObserved: EvidenceIntakeRecord = {
      ...base(),
      source: { ...base().source, url: 'urn:minecraft-dungeons-optimizer:phase7:raw-trace:self-1', originKind: 'self-observation' },
      locators: [{ kind: 'table', locator: 'urn:minecraft-dungeons-optimizer:phase7:raw-trace:self-1', url: null }],
    }
    expect(buildEvidenceRepository([selfObserved]).entries[0]!.assessment.outcome).toBe('accepted')
    const external = { ...selfObserved, source: { ...selfObserved.source, originKind: 'external' as const } }
    expect(() => buildEvidenceRepository([external])).toThrow('invalid source URL')
  })

  it('detects conflicts, unresolved reposts and calibration/holdout origin reuse', () => {
    const first = base()
    const conflict: EvidenceIntakeRecord = { ...base(), id: 'conflict@1', recordId: 'conflict', claim: { ...base().claim, claimId: 'other', value: 12 }, partition: 'unassigned' }
    expect(buildEvidenceRepository([first, conflict]).entries[1]!.assessment.reasons).toContain('unresolved-conflict')
    const holdout: EvidenceIntakeRecord = { ...base(), id: 'holdout@1', recordId: 'holdout', claim: { ...base().claim, claimId: 'holdout' }, partition: 'holdout' }
    expect(buildEvidenceRepository([first, holdout]).entries[1]!.assessment).toMatchObject({ outcome: 'rejected', reasons: expect.arrayContaining(['calibration-holdout-origin-overlap']) })
    const repost: EvidenceIntakeRecord = { ...base(), id: 'repost@1', recordId: 'repost', source: { ...base().source, sourceId: 'repost', repostOfSourceRevisionId: 'missing@1' }, partition: 'unassigned' }
    expect(buildEvidenceRepository([repost]).entries[0]!.assessment).toMatchObject({ outcome: 'rejected', reasons: expect.arrayContaining(['repost-origin-unresolved']) })
  })

  it('distinguishes entity, property, version, equipment ID/Power, conditions and unit in the claim domain', () => {
    const first = { ...base(), partition: 'unassigned' as const }
    const variants: EvidenceIntakeRecord[] = [
      { ...base(), id: 'entity@1', recordId: 'entity', claim: { ...base().claim, claimId: 'entity', entity: 'fixture:other', value: 11 }, partition: 'unassigned' },
      { ...base(), id: 'property@1', recordId: 'property', claim: { ...base().claim, claimId: 'property', property: 'damage-per-second', value: 12 }, partition: 'unassigned' },
      { ...base(), id: 'version@1', recordId: 'version', context: { ...base().context, gameVersion: '1.16.2.0' }, claim: { ...base().claim, claimId: 'version', value: 13 }, partition: 'unassigned' },
      { ...base(), id: 'equipment@1', recordId: 'equipment', context: { ...base().context, equipment: [{ id: 'fixture:other', power: 251 }] }, claim: { ...base().claim, claimId: 'equipment', value: 14 }, partition: 'unassigned' },
      { ...base(), id: 'power@1', recordId: 'power', context: { ...base().context, equipment: [{ id: 'fixture:item', power: 263 }] }, claim: { ...base().claim, claimId: 'power', value: 15 }, partition: 'unassigned' },
      { ...base(), id: 'conditions@1', recordId: 'conditions', context: { ...base().context, conditions: { target: 'armored-dummy' } }, claim: { ...base().claim, claimId: 'conditions', value: 16 }, partition: 'unassigned' },
      { ...base(), id: 'unit@1', recordId: 'unit', measurement: { ...base().measurement, unit: 'damage-per-second' }, claim: { ...base().claim, claimId: 'unit', value: 17 }, partition: 'unassigned' },
    ]
    const repository = buildEvidenceRepository([first, ...variants])
    for (const entry of repository.entries.slice(1)) expect(entry.assessment.reasons).not.toContain('unresolved-conflict')
  })

  it('flags contradictory values only when the complete observation domain matches', () => {
    const first = { ...base(), partition: 'unassigned' as const }
    const conflict: EvidenceIntakeRecord = { ...base(), id: 'same-domain@1', recordId: 'same-domain', claim: { ...base().claim, claimId: 'same-domain', value: 99 }, partition: 'unassigned' }
    expect(buildEvidenceRepository([first, conflict]).entries[1]!.assessment.reasons).toContain('unresolved-conflict')
  })

  it('does not count unknown or derivative origins as independent evidence', () => {
    const repository = buildEvidenceRepository(PHASE8_EVIDENCE_RECORDS)
    const current = repository.entries.find((entry) => entry.record.id === 'phase8-dr-ehp-current@2')!
    expect(current.record.source.repostOfSourceRevisionId).toBe('caramel-dr-guide@1')
    expect(current.assessment.reasons).toEqual(expect.arrayContaining(['origin-independence-unknown', 'repost-not-independent', 'correction-recorded']))
    expect(independentEvidenceIds(repository, ['phase8-dr-ehp-current@2', 'phase8-caramel-dr-guide@1', 'phase8-iron-hide-wiki-tests@1'])).toEqual([])
  })
})

describe('Phase 8B queue reassessment', () => {
  it('partitions every remaining Gap while preserving the 1,307-record handoff baseline', () => {
    const { reassessment } = buildPhase8Artifacts()
    const counts = reassessment.summary
    expect(reassessment.baseline.phase66HandoffCount).toBe(1307)
    expect(counts['external-resolved'] + counts['limited-measurement'] + counts['implementation-missing'] + counts.hold).toBe(counts.total)
    expect(new Set(reassessment.records.map((record) => record.gapId)).size).toBe(counts.total)
    expect(reassessment.selectedUnit).toMatchObject({ outcome: 'hold', promotionCount: 0, newGapClosures: 0 })
    expect(reassessment.selectedUnit.independentEvidenceRecordIds).toEqual([])
    expect(reassessment.selectedUnit.supersededEvidenceRecordIds).toEqual(['phase8-dr-ehp-current@1'])
  })
})

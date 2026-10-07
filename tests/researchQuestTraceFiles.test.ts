import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { auditResearchQuestSubmission } from '../scripts/lib/research-quest-submission'
import { buildPhase7Submission, captureResearchQuestRun, defaultResearchQuestState, type ResearchQuestRunDraft } from '../src/research/researchQuest'
import { LIMITED_DR_ACCEPTANCE_PLAN } from '../src/research/limitedDrValidation'

const bytes = Buffer.from([0xff, 0, 13, 10, 0x80, 65])
const locator = 'https://example.test/trace.bin'
const now = '2026-10-07T06:00:00Z'
function draft(condition: ResearchQuestRunDraft['condition'] = 'baseline', overrides: Partial<ResearchQuestRunDraft> = {}): ResearchQuestRunDraft {
  const equipment = [{ id: 'mercenary-armor', power: 251 }, { id: 'iron-hide-amulet', power: 251 }, { id: 'guarding-strike', power: 251 }]
  const counts = { baseline: 0, 'armor-35': 1, 'iron-hide': 1, 'guarding-strike': 1, 'armor-iron': 2, 'armor-guarding': 2, 'iron-guarding': 2, 'armor-iron-guarding': 3 }
  return { id: 'external-run', condition, originGroup: 'test-source', incomingHitId: 'zombie', originKind: 'external',
    rawTraceUrl: locator, rawTraceSha256: createHash('sha256').update(bytes).digest('hex'), rawTraceRecord: null,
    activationFrameLocators: condition === 'baseline' ? [] : ['frames 1-20'], baselineDamage: 100000, observedDamage: Array(10).fill(100000),
    platform: 'Windows', difficulty: 'Apocalypse +25', capturedAt: now, reviewed: true,
    equipment: equipment.slice(0, counts[condition]), ...overrides }
}
const serialize = (...runs: ResearchQuestRunDraft[]) => JSON.stringify(buildPhase7Submission({ ...defaultResearchQuestState(now), runs }, now))
const trace = { locator, bytes }
const audit = (runs = [draft()], traces = [trace]) => auditResearchQuestSubmission(serialize(...runs), traces)

describe('offline local trace byte verification', () => {
  for (const condition of LIMITED_DR_ACCEPTANCE_PLAN.requiredConditions) {
    it(`verifies exact binary bytes for ${condition} without changing the research decision`, () => {
      const serialized = serialize(draft(condition))
      const before = auditResearchQuestSubmission(serialized)
      expect(before.externalRawTracesNotChecked).toBe(1)
      expect(auditResearchQuestSubmission(serialized, [trace])).toEqual({ ...before, verifiedExternalRawTraces: 1, externalRawTracesNotChecked: 0 })
      expect(before.measurementAuthenticity).toBe('not-checked')
      expect(before.runtimePromotionCount).toBe(0)
    })
  }
  it('also verifies non-embedded self-observation HTTPS traces', () => {
    expect(audit([draft('baseline', { originKind: 'self-observation' })]).verifiedExternalRawTraces).toBe(1)
  })
  it('preserves repeated-trace independence exclusions with one file for its locator', () => {
    expect(audit([draft(), draft('baseline', { id: 'copy' })])).toMatchObject({ submittedRuns: 2, verifiedExternalRawTraces: 2, eligibleIndependentHoldoutRuns: 1 })
  })
  it('accepts an empty complete trace set for an empty submission', () => {
    expect(audit([], [])).toMatchObject({ verifiedExternalRawTraces: 0, externalRawTracesNotChecked: 0, recomputedDecision: 'hold' })
  })
  it('keeps embedded and external verification separate in a mixed submission', async () => {
    const embedded = await captureResearchQuestRun(draft('baseline', { id: 'embedded', originKind: 'self-observation' }), {
      weapons: [{ instanceId: 'weapon', weaponId: 'double-axe', powerLevel: 251, enchantmentSlots: [{ candidates: ['guarding-strike'], selected: { enchantmentId: 'guarding-strike', tier: 3 } }] }],
      armors: [{ instanceId: 'armor', armorId: 'mercenary-armor', powerLevel: 251, enchantmentSlots: [] }],
      artifacts: [{ instanceId: 'iron', artifactId: 'iron-hide-amulet', powerLevel: 251 }],
    })
    expect(audit([embedded, draft()])).toMatchObject({ submittedRuns: 2, verifiedEmbeddedRawRecords: 1, verifiedExternalRawTraces: 1, externalRawTracesNotChecked: 0 })
    expect(audit([embedded], []).verifiedEmbeddedRawRecords).toBe(1)
    expect(() => audit([embedded], [{ locator: embedded.rawTraceUrl, bytes }])).toThrow('unexpected local trace')
  })
  it('rejects absent, duplicate and unrelated locators', () => {
    expect(() => audit([draft()], [])).toThrow('missing local trace')
    expect(() => audit([draft()], [trace, trace])).toThrow('duplicate local trace')
    expect(() => audit([draft()], [{ ...trace, locator: 'https://example.test/other' }])).toThrow('unexpected local trace')
  })
  it('rejects changed bytes and UTF-8 re-encoding of binary bytes', () => {
    for (const changed of [Buffer.from('different'), Buffer.from(bytes.toString('utf8'))]) {
      expect(() => audit([draft()], [{ locator, bytes: changed }])).toThrow('hash mismatch')
    }
  })
  it('rejects one locator claimed with conflicting hashes', () => {
    expect(() => audit([draft(), draft('baseline', { id: 'other', rawTraceSha256: 'a'.repeat(64) })])).toThrow('conflicting hashes')
  })
  it('rejects non-byte inputs and rejects bad submission before trace verification', () => {
    expect(() => auditResearchQuestSubmission(serialize(draft()), [{ locator, bytes: 'text' } as never])).toThrow('invalid local trace')
    expect(() => auditResearchQuestSubmission('{}', [trace])).toThrow('unsupported')
  })
  it('requires complete coverage for multiple distinct locators', () => {
    const other = 'https://example.test/other'
    const runs = [draft(), draft('baseline', { id: 'other', rawTraceUrl: other })]
    expect(() => audit(runs)).toThrow('missing local trace')
    expect(audit(runs, [trace, { locator: other, bytes }]).verifiedExternalRawTraces).toBe(2)
  })
  it('CLI resolves files relative to its manifest, reads binary bytes, and never writes inputs', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcd-local-traces-'))
    try {
      const submission = path.join(dir, 'submission.json')
      const manifest = path.join(dir, 'traces.json')
      const file = path.join(dir, 'trace.bin')
      fs.writeFileSync(submission, serialize(draft()))
      fs.writeFileSync(file, bytes)
      const run = (extra = ['--trace-files', manifest]) => spawnSync(process.execPath, ['scripts/audit-research-quest-submission.ts', submission, ...extra], { encoding: 'utf8' })
      const valid = { schemaVersion: 1, traces: [{ locator, path: 'trace.bin' }] }
      fs.writeFileSync(manifest, JSON.stringify(valid))
      const before = [submission, manifest, file].map(p => fs.readFileSync(p))
      const result = run()
      expect(result.status, result.stderr).toBe(0)
      expect(JSON.parse(result.stdout)).toMatchObject({ verifiedExternalRawTraces: 1, externalRawTracesNotChecked: 0, measurementAuthenticity: 'not-checked', runtimePromotionCount: 0 })
      expect([submission, manifest, file].map(p => fs.readFileSync(p))).toEqual(before)
      for (const value of [null, {}, { ...valid, schemaVersion: 2 }, { ...valid, traces: [] }, { ...valid, traces: [null] },
        { ...valid, traces: [{ locator, path: '' }] }, { ...valid, traces: [{ locator, path: 'missing' }] }, { ...valid, traces: [{ locator, path: '.' }] }]) {
        fs.writeFileSync(manifest, JSON.stringify(value))
        expect(run().status).toBe(1)
      }
      fs.writeFileSync(manifest, '{bad')
      expect(run().status).toBe(1)
      for (const args of [['--trace-files'], ['--wrong', manifest], ['--trace-files', manifest, 'extra']]) expect(run(args).status).toBe(1)
      fs.writeFileSync(manifest, JSON.stringify(valid))
      fs.writeFileSync(file, 'changed')
      expect(run().status).toBe(1)
    } finally { fs.rmSync(dir, { recursive: true, force: true }) }
  })
})

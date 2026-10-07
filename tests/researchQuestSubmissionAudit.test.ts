import { createHash } from 'node:crypto'
import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { auditResearchQuestSubmission } from '../scripts/lib/research-quest-submission'
import { buildPhase7Submission, captureResearchQuestRun, defaultResearchQuestState, type ResearchQuestRunDraft } from '../src/research/researchQuest'
import { LIMITED_DR_ACCEPTANCE_PLAN, proposedDamageTaken } from '../src/research/limitedDrValidation'
import type { Inventory } from '../src/core/types'

const inventory: Inventory = {
  weapons: [{ instanceId: 'weapon', weaponId: 'double-axe', powerLevel: 251, enchantmentSlots: [{ candidates: ['guarding-strike'], selected: { enchantmentId: 'guarding-strike', tier: 3 } }] }],
  armors: [{ instanceId: 'armor', armorId: 'mercenary-armor', powerLevel: 251, enchantmentSlots: [] }],
  artifacts: [{ instanceId: 'iron', artifactId: 'iron-hide-amulet', powerLevel: 251 }],
}
const generatedAt = '2026-10-07T05:00:00Z'
async function submission(condition: ResearchQuestRunDraft['condition'] = 'baseline', originKind: ResearchQuestRunDraft['originKind'] = 'self-observation') {
  const draft = await captureResearchQuestRun({
    id: 'test-run', condition, originGroup: 'test-player', incomingHitId: 'test-zombie', originKind,
    rawTraceUrl: 'https://example.test/test-run.csv', rawTraceSha256: 'a'.repeat(64), rawTraceRecord: null,
    activationFrameLocators: condition === 'baseline' ? [] : ['frames 1-20'], baselineDamage: 100000, observedDamage: Array(10).fill(100000),
    platform: 'Windows', difficulty: 'Apocalypse +25', capturedAt: generatedAt, reviewed: true, equipment: [],
  }, inventory)
  return buildPhase7Submission({ ...defaultResearchQuestState(generatedAt), runs: [draft] }, generatedAt)
}
const audit = (value: unknown) => auditResearchQuestSubmission(JSON.stringify(value))

describe('offline Research Quest submission audit', () => {
  for (const condition of LIMITED_DR_ACCEPTANCE_PLAN.requiredConditions) {
    for (const origin of ['self-observation', 'external'] as const) {
      it(`replays ${condition} / ${origin} without claiming authenticity or promotion`, async () => {
        const value = await submission(condition, origin)
        expect(audit(value)).toMatchObject({ submittedRuns: 1, verifiedEmbeddedRawRecords: origin === 'self-observation' ? 1 : 0,
          externalRawTracesNotChecked: origin === 'external' ? 1 : 0, recomputedDecision: 'hold', measurementAuthenticity: 'not-checked', runtimePromotionCount: 0 })
      })
    }
  }
  it('preserves captured blank and baseline frames while replaying exported normalization', async () => {
    const original = await submission()
    const raw = original.rawRecords[0]!
    const decoded = JSON.parse(raw.content)
    decoded.run.activationFrameLocators = [' ', 'unneeded baseline frame']
    const content = JSON.stringify(decoded)
    const sha256 = createHash('sha256').update(content).digest('hex')
    const value = JSON.parse(JSON.stringify(original))
    value.rawRecords[0] = { ...raw, content, sha256 }
    value.runs[0].rawTraceSha256 = sha256
    value.evidenceRepository.entries[0].record.source.snapshotSha256 = sha256
    expect(audit(value).verifiedEmbeddedRawRecords).toBe(1)
  })
  it('replays full synthetic coverage without promoting or authenticating it', async () => {
    const runs = await Promise.all(LIMITED_DR_ACCEPTANCE_PLAN.requiredConditions.flatMap((condition, ci) => [0, 1, 2].map(async index => {
      const initial = await submission(condition)
      const record = initial.evidenceRepository.entries[0]!.record
      return captureResearchQuestRun({
        id: `${condition}-${index}`, condition, originGroup: 'synthetic-player', incomingHitId: 'test-zombie',
        originKind: 'self-observation', rawTraceUrl: '', rawTraceSha256: '', rawTraceRecord: null,
        activationFrameLocators: condition === 'baseline' ? [] : [' ', 'frames 1-20', ''],
        baselineDamage: 100000, observedDamage: Array(10).fill(Math.round(100000 * proposedDamageTaken(condition))),
        platform: String(record.context.conditions.platform), difficulty: String(record.context.conditions.difficulty),
        capturedAt: new Date(Date.UTC(2026, 9, 7, 5, ci, index)).toISOString(), reviewed: true, equipment: [],
      }, inventory)
    })))
    const value = buildPhase7Submission({ ...defaultResearchQuestState(generatedAt), runs }, generatedAt)
    expect(audit(value)).toMatchObject({ submittedRuns: 24, verifiedEmbeddedRawRecords: 24, eligibleHits: 240,
      recomputedDecision: 'adopt', measurementAuthenticity: 'not-checked', runtimePromotionCount: 0 })
  })
  it('preserves duplicate-trace exclusions instead of counting each submitted run', async () => {
    const value = await submission('baseline', 'external')
    const first = value.runs[0]!
    const draft: ResearchQuestRunDraft = {
      id: 'second', condition: 'baseline', originGroup: first.originGroup, incomingHitId: first.incomingHitId,
      originKind: 'external', rawTraceUrl: first.rawTraceLocator, rawTraceSha256: first.rawTraceSha256, rawTraceRecord: null,
      activationFrameLocators: [], baselineDamage: first.baselineDamage, observedDamage: first.observedDamage,
      platform: 'Windows', difficulty: 'Apocalypse +25', capturedAt: generatedAt, reviewed: true, equipment: [],
    }
    const firstDraft = { ...draft, id: first.id }
    const combined = buildPhase7Submission({ ...defaultResearchQuestState(generatedAt), runs: [firstDraft, draft] }, generatedAt)
    expect(combined.validation.evidenceBoundary.excludedDuplicateRunIds).toEqual(['second'])
    expect(audit(combined)).toMatchObject({ submittedRuns: 2, eligibleIndependentHoldoutRuns: 1, recomputedDecision: 'hold' })
  })
  it('keeps absent Evidence as hold and missing error metrics as null', () => {
    const value = buildPhase7Submission(defaultResearchQuestState(generatedAt), generatedAt)
    expect(audit(value)).toMatchObject({ submittedRuns: 0, eligibleHits: 0, recomputedDecision: 'hold' })
    expect(value.validation.comparison.proposedMeanAbsoluteFractionError).toBeNull()
  })
  it('detects bytes that the export builder alone does not authenticate', async () => {
    const value = await submission()
    const changed = { ...value, rawRecords: [{ ...value.rawRecords[0]!, content: 'changed bytes' }] }
    expect(() => audit(changed)).toThrow('hash mismatch')
  })
  it('rejects a rehashed raw record with different observations', async () => {
    const value = await submission()
    const raw = value.rawRecords[0]!
    const content = JSON.parse(raw.content)
    content.run.observedDamage[0] = 1
    const text = JSON.stringify(content)
    const sha256 = createHash('sha256').update(text).digest('hex')
    const changed = JSON.parse(JSON.stringify(value))
    changed.rawRecords[0] = { ...raw, content: text, sha256 }
    changed.runs[0].rawTraceSha256 = sha256
    changed.evidenceRepository.entries[0].record.source.snapshotSha256 = sha256
    expect(() => audit(changed)).toThrow('content mismatch')
  })
  const mutations: [string, (value: ReturnType<typeof JSON.parse>) => void][] = [
    ['header', v => { v.phase = '8C' }],
    ['timestamp', v => { v.generatedAt = '' }],
    ['missing Evidence', v => { v.evidenceRepository.entries = [] }],
    ['assessment drift', v => { v.evidenceRepository.entries[0].assessment.outcome = 'rejected' }],
    ['claim drift', v => { v.evidenceRepository.entries[0].record.claim.value = [7] }],
    ['equipment drift', v => { v.runs[0].equipment = [{ id: 'other', power: 251 }] }],
    ['run identity', v => { v.runs[0].id = 'other' }],
    ['unknown condition', v => { v.runs[0].condition = 'unknown' }],
    ['partition', v => { v.runs[0].partition = 'calibration' }],
    ['missing raw', v => { v.rawRecords = [] }],
    ['duplicate raw', v => { v.rawRecords.push(v.rawRecords[0]) }],
    ['orphan raw', v => { v.rawRecords.push({ ...v.rawRecords[0], locator: 'urn:orphan' }) }],
    ['run hash', v => { v.runs[0].rawTraceSha256 = 'b'.repeat(64) }],
    ['raw metadata', v => { v.runs[0].baselineDamage = 50000 }],
    ['validation decision', v => { v.validation.adoptionDecision.decision = 'adopt' }],
    ['validation coverage', v => { v.validation.conditionCoverage.baseline.eligibleRuns = 3 }],
    ['frozen gate', v => { v.validation.plan.minimumHitsPerRun = 1 }],
    ['extra run', v => { v.runs.push(v.runs[0]) }],
  ]
  for (const [name, mutate] of mutations) it(`rejects ${name}`, async () => {
    const value = JSON.parse(JSON.stringify(await submission()))
    mutate(value)
    expect(() => audit(value)).toThrow()
  })
  it('rejects an embedded record attached to an external trace', async () => {
    const external = await submission('baseline', 'external')
    const self = await submission()
    const value = { ...external, rawRecords: [{ ...self.rawRecords[0]!, locator: external.runs[0]!.rawTraceLocator }] }
    expect(() => audit(value)).toThrow('unexpected')
  })
  it('handles malformed JSON and missing sections without accepting them', () => {
    for (const input of ['{bad', 'null', '{}', '{"schemaVersion":1,"phase":"7B","questId":"limited-dr-composition"}']) {
      expect(() => auditResearchQuestSubmission(input)).toThrow()
    }
  })
  it('runs the CLI read-only and returns nonzero for invalid input or arguments', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcd-submission-test-'))
    try {
      const file = path.join(dir, 'submission.json')
      const bytes = JSON.stringify(await submission())
      fs.writeFileSync(file, bytes)
      const stdout = execFileSync(process.execPath, ['scripts/audit-research-quest-submission.ts', file], { encoding: 'utf8' })
      expect(JSON.parse(stdout).recomputedDecision).toBe('hold')
      expect(fs.readFileSync(file, 'utf8')).toBe(bytes)
      fs.writeFileSync(file, '{}')
      expect(spawnSync(process.execPath, ['scripts/audit-research-quest-submission.ts', file]).status).toBe(1)
      expect(spawnSync(process.execPath, ['scripts/audit-research-quest-submission.ts']).status).toBe(1)
    } finally { fs.rmSync(dir, { recursive: true, force: true }) }
  })
})

import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { buildPhase7Submission, defaultResearchQuestState, type Phase7Submission, type ResearchQuestRunDraft } from '../../src/research/researchQuest.ts'
import { LIMITED_DR_ACCEPTANCE_PLAN } from '../../src/research/limitedDrValidation.ts'
import { parseEvidenceRepository } from '../../src/research/evidenceIntake.ts'

export interface LocalResearchTrace {
  readonly locator: string
  readonly bytes: Uint8Array
}

/** Offline integrity check, not authentication of a measurement or an adoption action.
 * Supplying local traces requires complete coverage of non-embedded locators.
 */
export function auditResearchQuestSubmission(serialized: string, localTraces?: readonly LocalResearchTrace[]) {
  const submission = JSON.parse(serialized) as Phase7Submission
  assert(submission && submission.schemaVersion === 1 && submission.phase === '7B' && submission.questId === 'limited-dr-composition', 'unsupported Research Quest submission')
  assert(typeof submission.generatedAt === 'string' && Number.isFinite(Date.parse(submission.generatedAt)), 'invalid generatedAt')
  assert(Array.isArray(submission.runs) && Array.isArray(submission.rawRecords), 'runs and rawRecords must be arrays')
  const repository = parseEvidenceRepository(JSON.stringify(submission.evidenceRepository))
  assert.equal(repository.entries.length, submission.runs.length, 'one Evidence record is required per run')
  const rawByLocator = new Map<string, Phase7Submission['rawRecords'][number]>()
  for (const raw of submission.rawRecords) {
    assert(raw && typeof raw.locator === 'string' && typeof raw.content === 'string' && typeof raw.sha256 === 'string', 'invalid embedded raw record')
    assert(!rawByLocator.has(raw.locator), 'duplicate embedded raw locator')
    assert.equal(createHash('sha256').update(raw.content).digest('hex'), raw.sha256, 'embedded raw content hash mismatch')
    rawByLocator.set(raw.locator, raw)
  }
  const usedRaw = new Set<string>()
  const drafts: ResearchQuestRunDraft[] = submission.runs.map((run, index) => {
    assert(run && typeof run.id === 'string', 'invalid run')
    assert(LIMITED_DR_ACCEPTANCE_PLAN.requiredConditions.includes(run.condition), 'unknown run condition')
    assert.equal(run.partition, 'holdout', 'Research Quest exports holdout runs only')
    const record = repository.entries[index]!.record
    assert.equal(record.recordId, `phase7-${run.id}`, 'Evidence/run identity mismatch')
    const conditions = record.context.conditions
    assert(typeof conditions.platform === 'string' && typeof conditions.difficulty === 'string', 'platform and difficulty are required')
    assert(record.source.originGroup !== null, 'origin group is required')
    const raw = rawByLocator.get(run.rawTraceLocator)
    const embedded = record.source.originKind === 'self-observation' && run.rawTraceLocator.startsWith('urn:')
    assert(embedded === Boolean(raw), 'embedded raw record missing or unexpected')
    let draft: ResearchQuestRunDraft = {
      id: run.id, condition: run.condition, originGroup: run.originGroup, incomingHitId: run.incomingHitId,
      originKind: record.source.originKind, rawTraceUrl: run.rawTraceLocator, rawTraceSha256: run.rawTraceSha256,
      rawTraceRecord: raw?.content ?? null, activationFrameLocators: run.activationFrameLocators,
      baselineDamage: run.baselineDamage, observedDamage: run.observedDamage,
      platform: conditions.platform, difficulty: conditions.difficulty, capturedAt: run.capturedAt,
      reviewed: record.source.reviewed, equipment: run.equipment,
    }
    if (raw) {
      assert.equal(raw.sha256, run.rawTraceSha256, 'raw/run hash mismatch')
      assert.equal(raw.locator, `urn:minecraft-dungeons-optimizer:phase7:raw-trace:${encodeURIComponent(run.id)}`, 'raw/run locator mismatch')
      const decoded = JSON.parse(raw.content)
      assert(Array.isArray(decoded?.run?.activationFrameLocators) && decoded.run.activationFrameLocators.every((value: unknown) => typeof value === 'string'), 'invalid raw activation frames')
      // The exporter normalizes blank frames and discards baseline frames in LimitedDrRun.
      // Retain captured frames for byte/content verification, then replay that normalization.
      draft = { ...draft, activationFrameLocators: decoded.run.activationFrameLocators }
      // Check decoded observations and metadata as well as bytes: a rehashed stale record is not this run.
      const { originKind: _originKind, rawTraceUrl: _url, rawTraceSha256: _hash, rawTraceRecord: _raw, ...capturedRun } = draft
      void _originKind; void _url; void _hash; void _raw
      assert.deepEqual(decoded, { schemaVersion: 1, kind: 'limited-dr-self-observation', run: capturedRun }, 'embedded raw/run content mismatch')
      usedRaw.add(raw.locator)
    }
    return draft
  })
  assert.equal(usedRaw.size, rawByLocator.size, 'orphan embedded raw record')
  const replayed = buildPhase7Submission({ ...defaultResearchQuestState(submission.generatedAt), runs: drafts }, submission.generatedAt)
  assert.deepEqual(submission, replayed, 'submission differs from recomputed Evidence, runs or frozen validation')
  let verifiedExternalRawTraces = 0
  if (localTraces !== undefined) {
    const expected = new Map<string, string>()
    for (const run of replayed.runs) {
      if (usedRaw.has(run.rawTraceLocator)) continue
      assert.equal(new URL(run.rawTraceLocator).protocol, 'https:', 'non-embedded trace must use HTTPS')
      const previous = expected.get(run.rawTraceLocator)
      assert(previous === undefined || previous === run.rawTraceSha256, 'conflicting hashes for one trace locator')
      expected.set(run.rawTraceLocator, run.rawTraceSha256)
    }
    const supplied = new Set<string>()
    for (const trace of localTraces) {
      assert(trace && typeof trace.locator === 'string' && trace.bytes instanceof Uint8Array, 'invalid local trace')
      assert(!supplied.has(trace.locator), 'duplicate local trace locator')
      assert(expected.has(trace.locator), 'unexpected local trace locator')
      assert.equal(createHash('sha256').update(trace.bytes).digest('hex'), expected.get(trace.locator), 'local trace content hash mismatch')
      supplied.add(trace.locator)
    }
    assert.equal(supplied.size, expected.size, 'missing local trace locator')
    verifiedExternalRawTraces = replayed.runs.length - usedRaw.size
  }
  return {
    scope: 'offline-integrity-only',
    submittedRuns: replayed.runs.length,
    verifiedEmbeddedRawRecords: usedRaw.size,
    verifiedExternalRawTraces,
    externalRawTracesNotChecked: replayed.runs.length - usedRaw.size - verifiedExternalRawTraces,
    eligibleIndependentHoldoutRuns: replayed.validation.evidenceBoundary.eligibleIndependentHoldoutRuns,
    eligibleHits: replayed.validation.comparison.eligibleHitCount,
    recomputedDecision: replayed.validation.adoptionDecision.decision,
    measurementAuthenticity: 'not-checked',
    runtimePromotionCount: 0,
  } as const
}

import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import type { Inventory } from '../src/core'
import {
  buildPhase7Submission,
  captureResearchQuestRun,
  defaultResearchQuestState,
  independentResearchQuestRuns,
  parseResearchQuestState,
  RESEARCH_QUEST_STORAGE_KEY,
  resolveResearchQuestReadiness,
  saveResearchQuestState,
  type ResearchQuestRunDraft,
} from '../src/research/researchQuest'
import { ResearchQuestPage } from '../src/screens/ResearchQuestPage'

const inventory = (complete = true): Inventory => ({
  weapons: [{ instanceId: 'weapon-1', weaponId: 'double-axe', powerLevel: 251, enchantmentSlots: [{ candidates: complete ? ['guarding-strike'] : ['critical-hit'], ...(complete ? { locked: 'guarding-strike' as const } : {}) }] }],
  armors: complete ? [{ instanceId: 'armor-1', armorId: 'mercenary-armor', powerLevel: 251, enchantmentSlots: [] }] : [],
  artifacts: complete ? [{ instanceId: 'iron-1', artifactId: 'iron-hide-amulet', powerLevel: 251 }] : [],
})

const draft = (id = 'run-1'): ResearchQuestRunDraft => ({
  id, condition: 'armor-iron-guarding', originGroup: `player-${id}`, incomingHitId: 'zombie-melee-fixed',
  originKind: 'external', rawTraceUrl: `https://example.test/${id}.csv`, rawTraceSha256: 'a'.repeat(64), rawTraceRecord: null,
  activationFrameLocators: ['frames 10-30'], baselineDamage: 100000,
  observedDamage: Array(10).fill(19697), platform: 'Windows', difficulty: 'Apocalypse +25',
  capturedAt: '2026-09-10T10:00:00+09:00', reviewed: true,
  equipment: [],
})

describe('Phase 7 Personal Research Quest', () => {
  it('assigns the limited DR quest only when all required equipment is actually owned', () => {
    expect(resolveResearchQuestReadiness(inventory())).toMatchObject({ ready: true, guardingStrikeStatus: 'usable', missing: [], selectionRequired: [] })
    expect(resolveResearchQuestReadiness(inventory(false))).toMatchObject({ ready: false })
    expect(resolveResearchQuestReadiness(inventory(false)).missing).toEqual(expect.arrayContaining([
      '35% damage reduction付き防具', 'アイアンハイドアミュレット', 'ガードストライクを持つ近接武器',
    ]))
  })

  it('distinguishes an unselected Guarding Strike candidate while keeping gilded Guarding Strike usable', () => {
    const candidateOnly: Inventory = { ...inventory(), weapons: [{ ...inventory().weapons[0]!, enchantmentSlots: [{ candidates: ['guarding-strike'] }] }] }
    expect(resolveResearchQuestReadiness(candidateOnly)).toMatchObject({ ready: false, guardingStrikeStatus: 'selection-required', selectionRequired: ['近接武器の候補からガードストライクを選択'] })
    const gilded: Inventory = { ...candidateOnly, weapons: [{ ...candidateOnly.weapons[0]!, gilded: { enchantmentId: 'guarding-strike', tier: 3 } }] }
    expect(resolveResearchQuestReadiness(gilded)).toMatchObject({ ready: true, guardingStrikeStatus: 'usable', selectionRequired: [] })
    expect(renderToStaticMarkup(createElement(ResearchQuestPage, { inventory: candidateOnly }))).toContain('選択が必要')
  })

  it('uses an audited runtime-unsupported 35% DR armor for Research Quest without promoting it to runtime', async () => {
    const catalogArmor: Inventory = {
      ...inventory(), armors: [],
      catalogItems: [{ instanceId: 'catalog-armor', category: 'armor', catalogId: 'champion-s-armor', powerLevel: 251 }],
    }
    expect(resolveResearchQuestReadiness(catalogArmor)).toMatchObject({ ready: true, armorInstanceId: 'catalog-armor' })
    const captured = await captureResearchQuestRun(draft('catalog-run'), catalogArmor)
    expect(captured.equipment[0]).toEqual({ id: 'armor:champion-s-armor', power: 251 })
  })

  it('renders the three acquisition modes and an owned-filtered task summary', () => {
    const html = renderToStaticMarkup(createElement(ResearchQuestPage, { inventory: inventory() }))
    for (const label of ['Observe', 'Measure', 'Experiment', '限定DRの組合せ', '24 runs · 240 hits']) expect(html).toContain(label)
    expect(html).toContain('実施可能')
  })

  it('persists pause, skip and resume state independently from Inventory storage', () => {
    const stored = new Map<string, string>()
    vi.stubGlobal('localStorage', { getItem: (key: string) => stored.get(key) ?? null, setItem: (key: string, value: string) => stored.set(key, value) })
    const state = { ...defaultResearchQuestState('2026-09-10T00:00:00Z'), status: 'paused' as const, draft: { ...draft('draft-run'), id: '', reviewed: false } }
    saveResearchQuestState(state)
    expect(stored.has(RESEARCH_QUEST_STORAGE_KEY)).toBe(true)
    expect(parseResearchQuestState(stored.get(RESEARCH_QUEST_STORAGE_KEY)!)).toEqual(state)
    const legacyDraft = { ...draft('legacy') } as Record<string, unknown>
    delete legacyDraft.originKind
    delete legacyDraft.rawTraceRecord
    const legacyState = { ...state, draft: legacyDraft }
    expect(parseResearchQuestState(JSON.stringify(legacyState)).draft).toMatchObject({ originKind: 'self-observation', rawTraceRecord: null })
    expect(() => parseResearchQuestState('{bad')).toThrow('読み取れません')
    vi.unstubAllGlobals()
  })

  it('hands one real-format run to the 8A repository and frozen 8C validator', async () => {
    const captured = await captureResearchQuestRun(draft(), inventory())
    const state = { ...defaultResearchQuestState(), status: 'active' as const, runs: [captured] }
    const submission = buildPhase7Submission(state, '2026-09-10T12:00:00+09:00')
    expect(submission.evidenceRepository.entries[0]!.assessment).toEqual({ outcome: 'accepted', reasons: [] })
    expect(submission.evidenceRepository.entries[0]!.record.source).toMatchObject({ originKind: 'external', url: 'https://example.test/run-1.csv', snapshotSha256: 'a'.repeat(64) })
    expect(submission.rawRecords).toEqual([])
    expect(submission.validation.evidenceBoundary.eligibleIndependentHoldoutRuns).toBe(1)
    expect(submission.validation.adoptionDecision.decision).toBe('hold')
    expect(submission.runs[0]!.equipment.map((item) => item.id)).toEqual([
      'armor:mercenary-armor', 'artifact:iron-hide-amulet', 'melee:double-axe:guarding-strike:slot-1:tier-3',
    ])
  })

  it('generates a raw record and SHA-256 for a self-observation without manual URL or hash', async () => {
    const selfDraft = { ...draft('self-1'), originKind: 'self-observation' as const, rawTraceUrl: '', rawTraceSha256: '' }
    const captured = await captureResearchQuestRun(selfDraft, inventory())
    expect(captured.rawTraceUrl).toBe('urn:minecraft-dungeons-optimizer:phase7:raw-trace:self-1')
    expect(captured.rawTraceSha256).toMatch(/^[a-f0-9]{64}$/)
    expect(captured.rawTraceRecord).toContain('"observedDamage"')
    const submission = buildPhase7Submission({ ...defaultResearchQuestState(), runs: [captured] })
    expect(submission.rawRecords).toEqual([{ locator: captured.rawTraceUrl, sha256: captured.rawTraceSha256, content: captured.rawTraceRecord }])
    expect(submission.evidenceRepository.entries[0]!.assessment.outcome).toBe('accepted')
  })

  it('uses distinct run and raw-trace identity for Research Quest progress, not origin-group uniqueness', () => {
    const samePlayerRuns = [1, 2, 3].map((index) => ({ ...draft(`same-player-${index}`), condition: 'baseline' as const, originGroup: 'same-player', rawTraceSha256: index.toString(16).padStart(64, '0'), capturedAt: `2026-09-10T10:0${index}:00+09:00` }))
    expect(independentResearchQuestRuns(samePlayerRuns)).toHaveLength(3)
    const copied = { ...samePlayerRuns[0]!, id: 'copied', rawTraceUrl: 'https://example.test/copied.csv', rawTraceSha256: 'f'.repeat(64) }
    const reusedTrace = { ...samePlayerRuns[1]!, id: 'reused', rawTraceUrl: samePlayerRuns[0]!.rawTraceUrl, rawTraceSha256: samePlayerRuns[0]!.rawTraceSha256 }
    expect(independentResearchQuestRuns([...samePlayerRuns, copied, reusedTrace]).map((run) => run.id)).toEqual(['same-player-1', 'same-player-2', 'same-player-3'])
  })

  it('rejects short traces and duplicate run identities before handoff', async () => {
    const short = { ...draft(), observedDamage: [19697] }
    expect(() => buildPhase7Submission({ ...defaultResearchQuestState(), runs: [short] })).toThrow('10 hit以上')
    const captured = await captureResearchQuestRun(draft(), inventory())
    expect(() => buildPhase7Submission({ ...defaultResearchQuestState(), runs: [captured, captured] })).toThrow('重複')
  })
})

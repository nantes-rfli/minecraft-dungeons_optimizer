import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import type { Inventory } from '../src/core'
import {
  buildPhase7Submission,
  captureResearchQuestRun,
  defaultResearchQuestState,
  parseResearchQuestState,
  RESEARCH_QUEST_STORAGE_KEY,
  resolveResearchQuestReadiness,
  saveResearchQuestState,
  type ResearchQuestRunDraft,
} from '../src/research/researchQuest'
import { ResearchQuestPage } from '../src/screens/ResearchQuestPage'

const inventory = (complete = true): Inventory => ({
  weapons: [{ instanceId: 'weapon-1', weaponId: 'double-axe', powerLevel: 251, enchantmentSlots: [{ candidates: complete ? ['guarding-strike'] : ['critical-hit'] }] }],
  armors: complete ? [{ instanceId: 'armor-1', armorId: 'mercenary-armor', powerLevel: 251, enchantmentSlots: [] }] : [],
  artifacts: complete ? [{ instanceId: 'iron-1', artifactId: 'iron-hide-amulet', powerLevel: 251 }] : [],
})

const draft = (id = 'run-1'): ResearchQuestRunDraft => ({
  id, condition: 'armor-iron-guarding', originGroup: `player-${id}`, incomingHitId: 'zombie-melee-fixed',
  rawTraceUrl: `https://example.test/${id}.csv`, rawTraceSha256: 'a'.repeat(64),
  activationFrameLocators: ['frames 10-30'], baselineDamage: 100000,
  observedDamage: Array(10).fill(19697), platform: 'Windows', difficulty: 'Apocalypse +25',
  capturedAt: '2026-09-10T10:00:00+09:00', reviewed: true,
  equipment: [],
})

describe('Phase 7 Personal Research Quest', () => {
  it('assigns the limited DR quest only when all required equipment is actually owned', () => {
    expect(resolveResearchQuestReadiness(inventory())).toMatchObject({ ready: true, missing: [] })
    expect(resolveResearchQuestReadiness(inventory(false))).toMatchObject({ ready: false })
    expect(resolveResearchQuestReadiness(inventory(false)).missing).toEqual(expect.arrayContaining([
      '35% damage reduction付き防具', 'アイアンハイドアミュレット', 'ガードストライクを候補または金色枠に持つ近接武器',
    ]))
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
    expect(() => parseResearchQuestState('{bad')).toThrow('読み取れません')
    vi.unstubAllGlobals()
  })

  it('hands one real-format run to the 8A repository and frozen 8C validator', () => {
    const captured = captureResearchQuestRun(draft(), inventory())
    const state = { ...defaultResearchQuestState(), status: 'active' as const, runs: [captured] }
    const submission = buildPhase7Submission(state, '2026-09-10T12:00:00+09:00')
    expect(submission.evidenceRepository.entries[0]!.assessment).toEqual({ outcome: 'accepted', reasons: [] })
    expect(submission.validation.evidenceBoundary.eligibleIndependentHoldoutRuns).toBe(1)
    expect(submission.validation.adoptionDecision.decision).toBe('hold')
    expect(submission.runs[0]!.equipment.map((item) => item.id)).toEqual([
      'armor:mercenary-armor', 'artifact:iron-hide-amulet', 'melee:double-axe:guarding-strike:slot-1:tier-3',
    ])
  })

  it('rejects short traces and duplicate run identities before handoff', () => {
    const short = { ...draft(), observedDamage: [19697] }
    expect(() => buildPhase7Submission({ ...defaultResearchQuestState(), runs: [short] })).toThrow('10 hit以上')
    const captured = captureResearchQuestRun(draft(), inventory())
    expect(() => buildPhase7Submission({ ...defaultResearchQuestState(), runs: [captured, captured] })).toThrow('重複')
  })
})

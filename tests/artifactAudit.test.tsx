import { describe, expect, it } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { ARTIFACT_AUDIT, collectArtifactAuditErrors, collectArtifactSupportErrors, summarizeArtifactAudit } from '../src/research/artifactAudit'
import { ARTIFACT_RUNTIME_SUPPORT, artifactRuntimeSupportSummaryText, summarizeArtifactRuntimeSupport } from '../src/core/artifactRuntimeSupport'
import { ARTIFACT_EXPANSION_PLAN, artifactImplementationPriority, collectArtifactExpansionPlanErrors } from '../src/research/artifactExpansionPlan'
import { ArtifactRuntimeSupportSection } from '../src/views/ArtifactRuntimeSupport'
import { ARTIFACTS } from '../src/data/artifacts'
import { evaluate } from '../src/core/evaluate'
import { optimize } from '../src/core/optimizer'
import { representativeBuild } from '../src/research/runtimeCombinations'
import { DEFAULT_SCENARIO } from '../src/data/scenarios'
import { deserializeInventory, serializeInventory } from '../src/inventory/storage'
import type { ArtifactId } from '../src/core/types'
import { digest } from './fixtures/runtimeBaselineDigest'
import { ROADMAP_PHASES, ROADMAP_PROGRESS } from '../src/data/roadmap'

describe('artifact source audit and separate runtime manifest', () => {
  it('validates all 44 sources/entries and catalog equality', () => {
    expect(collectArtifactAuditErrors(ARTIFACT_AUDIT)).toEqual([])
    expect(collectArtifactSupportErrors(ARTIFACT_RUNTIME_SUPPORT)).toEqual([])
    expect(new Set(ARTIFACT_AUDIT.entries.map((entry) => entry.id)).size).toBe(44)
    expect(Object.keys(ARTIFACTS).sort()).toEqual(['death-cap-mushroom', 'iron-hide-amulet'])
    expect(ARTIFACT_RUNTIME_SUPPORT.entries.filter((entry) => entry.supportLevel !== 'research-only').map((entry) => entry.id)).toEqual(Object.keys(ARTIFACTS).sort())
    expect(summarizeArtifactRuntimeSupport()).toEqual({ population: 44, runtime: 2, full: 2, limited: 0, researchOnly: 42 })
    const summary = summarizeArtifactAudit()
    expect(summary.obtainable).toBe(43)
    expect(Object.values(summary.families).reduce((a, b) => a + b, 0)).toBe(44)
    expect(Object.values(summary.readiness).reduce((a, b) => a + b, 0)).toBe(44)
    expect(summary.supplemental).toBe(1)
  })
  it('pins the observed primary ID set without confusing it with the game-wide population', () => {
    expect(digest(ARTIFACT_AUDIT.entries.map((entry) => entry.id).sort())).toBe('b53947c16b8aaca0726ce7cd4ecbf61c1d68a2e5067ee5fb319eb4172febb35f')
    expect(ARTIFACT_AUDIT.populationDifferences.map((entry) => entry.id)).toEqual(['corrupted-seeds'])
    expect(ARTIFACT_AUDIT.phaseStatus).toBe('partial')
    const pumpkin = ARTIFACT_AUDIT.entries.find((entry) => entry.id === 'corrupted-pumpkin')!
    expect([pumpkin.obtainable, pumpkin.eventExclusive, pumpkin.unique, pumpkin.reskinOf]).toEqual([false, true, true, 'corrupted-beacon'])
  })
  it.each([null, [], {}, { entries: [null], sources: [null] }])('rejects malformed roots without crashing: %j', (input) => {
    expect(collectArtifactAuditErrors(input).length).toBeGreaterThan(0)
    expect(collectArtifactSupportErrors(input).length).toBeGreaterThan(0)
  })
  it.each([
    ['mechanicFamily', 'invented'], ['runtimeReadiness', 'full'], ['confidence', 'certain'],
    ['cooldown', null], ['cooldown', { seconds: 0 }], ['cooldown', { seconds: Infinity }],
    ['duration', {}], ['targeting', null], ['interactions', null], ['obtainability', null],
    ['sourceIds', []], ['sourceIds', ['missing']], ['gameVersion', '1.0'], ['id', 'fake'],
    ['obtainable', 'yes'], ['eventExclusive', null], ['contentPack', null], ['reskinOf', 'missing'],
    ['powerScaling', {}], ['stacking', {}], ['soul', {}], ['blockers', []], ['deepAudit', null],
  ])('rejects entry drift: %s', (key, value) => {
    const input = structuredClone(ARTIFACT_AUDIT)
    Object.assign(input.entries.find((entry) => entry.id === 'gong-of-weakening')!, { [key as string]: value })
    expect(collectArtifactAuditErrors(input).length).toBeGreaterThan(0)
  })
  it('rejects source, numeric, population and research-to-runtime corruption', () => {
    const mutations = [
      (data: typeof ARTIFACT_AUDIT) => { data.population = 43 },
      (data: typeof ARTIFACT_AUDIT) => { data.phaseStatus = 'complete' },
      (data: typeof ARTIFACT_AUDIT) => { data.populationDifferences = [] },
      (data: typeof ARTIFACT_AUDIT) => { data.entries[0] = data.entries[1]! },
      (data: typeof ARTIFACT_AUDIT) => { data.sources[0]!.url = 'javascript:alert(1)' },
      (data: typeof ARTIFACT_AUDIT) => { data.sources.push(data.sources[0]!) },
      (data: typeof ARTIFACT_AUDIT) => { data.entries[0]!.powerScaling.quality.extrapolationAllowed = true },
      (data: typeof ARTIFACT_AUDIT) => { data.entries[0]!.powerScaling.quality.publishedSampleCount = -1 },
      (data: typeof ARTIFACT_AUDIT) => { data.entries[0]!.soul.costPerUse = 0 },
      (data: typeof ARTIFACT_AUDIT) => { data.entries[0]!.duration.sourceIds = [] },
      (data: typeof ARTIFACT_AUDIT) => { data.entries.find((entry) => entry.id === 'death-cap-mushroom')!.cooldown.seconds = 20 },
    ]
    for (const mutate of mutations) {
      const input = structuredClone(ARTIFACT_AUDIT); mutate(input)
      expect(collectArtifactAuditErrors(input).length).toBeGreaterThan(0)
    }
  })
  it.each([
    ['death-cap-mushroom', 'supportLevel', 'research-only'], ['iron-hide-amulet', 'supportLevel', 'limited'],
    ['gong-of-weakening', 'supportLevel', 'full'], ['gong-of-weakening', 'reasons', ['generic unsupported']],
    ['gong-of-weakening', 'sourceIds', ['missing']], ['death-cap-mushroom', 'boundaries', ['new restriction']],
    ['gong-of-weakening', 'assumptionRefs', []], ['gong-of-weakening', 'mechanicFamily', 'mobility'],
  ])('rejects support drift: %s %s', (id, field, value) => {
    const input = structuredClone(ARTIFACT_RUNTIME_SUPPORT)
    Object.assign(input.entries.find((entry) => entry.id === id)!, { [field as string]: value })
    expect(collectArtifactSupportErrors(input).length).toBeGreaterThan(0)
  })
  it.each(ARTIFACT_RUNTIME_SUPPORT.entries.filter((entry) => entry.supportLevel === 'research-only'))('$id cannot be evaluated, optimized, or imported as a fake zero', ({ id }) => {
    const build = { ...representativeBuild(['artifact-synergy']), artifacts: [{ instanceId: 'unimplemented', artifactId: id as ArtifactId, powerLevel: 251 }] }
    const inventory = { weapons: [build.weapon], artifacts: build.artifacts }
    expect(() => evaluate(build, DEFAULT_SCENARIO)).toThrow()
    expect(() => optimize(inventory, DEFAULT_SCENARIO)).toThrow()
    expect(() => deserializeInventory(serializeInventory(inventory))).toThrow()
  })
})

describe('generated coverage, conditional shortlist and UI', () => {
  it('keeps planning scores distinct from game strength and runtime support', () => {
    expect(collectArtifactExpansionPlanErrors()).toEqual([])
    expect(ARTIFACT_EXPANSION_PLAN.entries.filter((entry) => entry.classification === 'target-shortlist')).toHaveLength(11)
    const score = ARTIFACT_EXPANSION_PLAN.entries.find((entry) => entry.id === 'gong-of-weakening')!.scores!
    expect(artifactImplementationPriority({ ...score, targetingUncertainty: score.targetingUncertainty + 1 })).toBe(artifactImplementationPriority(score) - 1)
    expect(() => artifactImplementationPriority({ ...score, powerAvailability: 6 })).toThrow()
    expect(ARTIFACT_EXPANSION_PLAN.entries.find((entry) => entry.id === 'corrupted-beacon')!.classification).toBe('deferred')
  })
  it('shows separate counts and two runtime rows without selectable research items', () => {
    const html = renderToStaticMarkup(<ArtifactRuntimeSupportSection />)
    for (const text of ['Full 2', 'Limited 0', 'Research-only 42', 'Death Cap Mushroom', 'Iron Hide Amulet', 'Corrupted Seeds', 'Phase 2-2A partial']) expect(html).toContain(text)
    expect(html).not.toMatch(/<input|<option/)
    expect(html).not.toContain('Powershaker')
  })
  it('keeps generated summaries, valid links and phase counts synchronized', () => {
    for (const file of ['README.md', 'ROADMAP.md', 'docs/artifact-audit.md', 'docs/artifact-runtime-support.md']) expect(readFileSync(file, 'utf8')).toContain(artifactRuntimeSupportSummaryText())
    for (const entry of ARTIFACT_RUNTIME_SUPPORT.entries) for (const ref of entry.assumptionRefs) expect(existsSync(ref)).toBe(true)
    for (const file of ['docs/artifact-model.md', 'docs/artifact-audit.md', 'docs/artifact-runtime-support.md', 'docs/artifact-expansion-plan.md']) {
      for (const match of readFileSync(file, 'utf8').matchAll(/\]\(([^)]+)\)/g)) {
        const target = match[1]!.split('#')[0]!
        if (!target || /^https?:/.test(target)) continue
        expect(existsSync(new URL(target, new URL(file, `file://${process.cwd()}/`))), `${file}: ${target}`).toBe(true)
      }
    }
    const roadmap = readFileSync('ROADMAP.md', 'utf8')
    expect(roadmap.match(/^- \[[ x]\]/gm)).toHaveLength(ROADMAP_PROGRESS.total)
    expect(roadmap.match(/^- \[x\]/gm)).toHaveLength(ROADMAP_PROGRESS.completed)
    expect(roadmap).toContain(`${ROADMAP_PROGRESS.completed} / ${ROADMAP_PROGRESS.total}（${ROADMAP_PROGRESS.percentage}%）`)
    expect(ROADMAP_PHASES.flatMap((phase) => phase.items).find((item) => item.label.startsWith('Phase 2-2A partial'))!.status).toBe('in-progress')
    expect(roadmap).toContain('- [ ] アーティファクトを10〜15種類へ拡張')
  })
})

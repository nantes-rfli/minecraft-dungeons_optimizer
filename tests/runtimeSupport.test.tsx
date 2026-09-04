import { describe, expect, it } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import baseline from './fixtures/runtime-support-baseline.json'
import { digest, fieldDigests } from './fixtures/runtimeBaselineDigest'
import { MELEE_RUNTIME_SUPPORT, getEnchantmentRuntimeSupport, runtimeCombinationPartners, runtimeLimitationLines, runtimeSupportSummaryText, summarizeRuntimeSupport } from '../src/core/runtimeSupport'
import { collectRuntimeSupportErrors } from '../src/research/runtimeSupportAudit'
import { auditRepresentativeCombinations, representativeBuild, representativeCases, representativeUnsupportedCases } from '../src/research/runtimeCombinations'
import { RuntimeSupportBadge, RuntimeSupportSection, RuntimeSupportWarnings } from '../src/views/RuntimeSupport'
import { evaluate, evaluateCandidate } from '../src/core/evaluate'
import { optimize } from '../src/core/optimizer'
import { DEFAULT_SCENARIO } from '../src/data/scenarios'
import { ENCHANTMENTS } from '../src/data/enchantments'
import { ROADMAP_PHASES, ROADMAP_PROGRESS } from '../src/data/roadmap'
import type { EnchantmentId } from '../src/core/types'

const full = ['ambush', 'anima-conduit', 'artifact-synergy', 'committed', 'critical-hit', 'freezing', 'gravity', 'guarding-strike', 'leeching', 'radiance', 'rampaging', 'refreshment', 'sharpness', 'smiting', 'soul-siphon', 'stunning', 'unchanting', 'void-strike', 'weakening']
const limited = ['chains', 'dynamo', 'exploding', 'fire-aspect', 'pain-cycle', 'poison-cloud', 'shockwave', 'swirling', 'thundering']
const research = ['busy-bee', 'echo', 'enigma-resonator', 'looting', 'prospector']
const entries = MELEE_RUNTIME_SUPPORT.entries
const cases = representativeCases()

describe('runtime support taxonomy (not Evidence or phase status)', () => {
  it('fixes both counts and exact entry lists intentionally', () => {
    expect(summarizeRuntimeSupport()).toEqual({ population: 33, runtime: 28, full: 19, limited: 9, researchOnly: 5, broadPower: 22, powerLimited: 6 })
    for (const [level, ids] of [['full', full], ['limited', limited], ['research-only', research]] as const) expect(entries.filter((entry) => entry.supportLevel === level).map((entry) => entry.id)).toEqual(ids)
    expect([...full, ...limited].sort()).toEqual(Object.keys(ENCHANTMENTS).sort())
    expect(collectRuntimeSupportErrors(MELEE_RUNTIME_SUPPORT)).toEqual([])
  })
  it('keeps low-confidence assumptions and native soul legality separate', () => {
    for (const id of ['weakening', 'committed', 'ambush', 'stunning', 'anima-conduit', 'soul-siphon', 'rampaging', 'artifact-synergy']) expect(getEnchantmentRuntimeSupport(id).supportLevel).toBe('full')
    expect(runtimeCombinationPartners('sharpness')).toEqual(['dynamo', 'pain-cycle'])
    expect(getEnchantmentRuntimeSupport('looting').blockerCategory).toBe('objective')
    expect(getEnchantmentRuntimeSupport('prospector').reasons).toEqual(['objective-missing'])
    for (const id of research.slice(0, 3)) expect(getEnchantmentRuntimeSupport(id).blockerCategory).toBe('mechanics')
    expect(() => getEnchantmentRuntimeSupport('invented')).toThrow('metadata is missing')
  })
  it('every limited entry exposes 1–3 concrete lines and valid assumption links', () => {
    for (const entry of entries) {
      if (entry.supportLevel === 'limited') expect(runtimeLimitationLines(entry).length).toBeGreaterThan(0)
      expect(runtimeLimitationLines(entry).length).toBeLessThanOrEqual(3)
      for (const ref of entry.assumptionRefs) expect(existsSync(ref)).toBe(true)
    }
  })
  it.each([null, [], {}, { population: 33, entries: [null] }])('rejects malformed root/entries without crashing: %j', (input) => expect(collectRuntimeSupportErrors(input).length).toBeGreaterThan(0))
  it.each([
    ['sharpness', 'supportLevel', 'research-only'], ['sharpness', 'supportLevel', 'limited'],
    ['dynamo', 'reasons', ['combination-limited']], ['chains', 'reasons', ['broad-runtime']],
    ['pain-cycle', 'unsupportedCombinations', []], ['sharpness', 'unsupportedCombinations', ['void-strike']],
    ['echo', 'blockerCategory', 'objective'], ['looting', 'reasons', ['state-model-missing']],
    ['dynamo', 'runtimePowerRange', { min: 50, max: 263 }], ['chains', 'runtimeMaxCopies', 4],
    ['sharpness', 'reasons', ['objective-missing']], ['sharpness', 'runtimeMaxCopies', null],
    ['sharpness', 'runtimeMaxCopies', 0], ['sharpness', 'name', 'Wrong'],
    ['anima-conduit', 'weaponLegality', 'melee'], ['dynamo', 'supportLevel', 'complete'],
    ['sharpness', 'assumptionRefs', []], ['sharpness', 'phaseOrigin', 'made-up'],
    ['dynamo', 'runtimePowerRange', 'invalid'], ['sharpness', 'reasons', ['invented']],
  ])('detects drift: %s %s', (id, field, value) => {
    const input = structuredClone(MELEE_RUNTIME_SUPPORT)
    const entry = input.entries.find((item) => item.id === id)!
    Object.assign(entry, { [field as string]: value })
    expect(collectRuntimeSupportErrors(input).length).toBeGreaterThan(0)
  })
  it('rejects duplicate/missing population and wrong total/version', () => {
    for (const input of [
      { ...MELEE_RUNTIME_SUPPORT, population: 32 }, { ...MELEE_RUNTIME_SUPPORT, gameVersion: 'old' },
      { ...MELEE_RUNTIME_SUPPORT, entries: entries.slice(1) },
      { ...MELEE_RUNTIME_SUPPORT, entries: [entries[0], ...entries.slice(0, -1)] },
    ]) expect(collectRuntimeSupportErrors(input).length).toBeGreaterThan(0)
  })
})

describe('practical usability and no silent zero fallback', () => {
  it('all nine families, both normal/gilded tiers, have stable usability counts', () => {
    expect(new Set(cases.map((item) => item.family)).size).toBe(9)
    expect(auditRepresentativeCombinations()).toEqual({ total: 104, supported: 72, unsupported: 32, reasons: { 'charge-modifier': 8, 'charge-pair': 4, 'dot-void': 12, 'copy-count': 8 } })
    expect([...new Set(cases.flatMap(({ build }) => build.enchantments.map((item) => item.enchantmentId)))].sort()).toEqual(Object.keys(ENCHANTMENTS).sort())
  })
  it.each(representativeUnsupportedCases())('$name: free choices exclude with reason, forced choices error', ({ build }) => {
    expect(() => evaluate(build, DEFAULT_SCENARIO)).toThrow(/未対応/)
    const forced = { ...build.weapon, enchantmentSlots: build.weapon.enchantmentSlots.map((slot) => ({ ...slot, locked: slot.candidates[0]! })) }
    expect(() => optimize({ weapons: [forced], artifacts: build.artifacts }, DEFAULT_SCENARIO)).toThrow(/未対応/)
    const free = { ...build.weapon, enchantmentSlots: build.weapon.enchantmentSlots.map((slot, index) => ({ candidates: [...slot.candidates, index === 0 ? 'leeching' as const : 'radiance' as const] })) }
    const result = optimize({ weapons: [free], artifacts: build.artifacts }, DEFAULT_SCENARIO)
    expect(result.unsupportedChoices.length).toBeGreaterThan(0)
    expect(result.unsupportedChoices.join(' ')).toMatch(/未対応/)
    expect(result.evaluatedBuildCount).toBeGreaterThan(0)
  })
  it.each(entries.filter((entry) => entry.runtimePowerRange))('$id: unsupported Power cannot fall back even with observed weapon damage', (entry) => {
    for (const power of [entry.runtimePowerRange!.min - 1, entry.runtimePowerRange!.max + 1]) {
      const input = representativeBuild([entry.id as EnchantmentId], 'double-axe', undefined, power)
      const build = { ...input, weapon: { ...input.weapon, observedDamagePerHit: 100 } }
      expect(() => evaluate(build, DEFAULT_SCENARIO)).toThrow(/Power/)
      expect(() => optimize({ weapons: [build.weapon], artifacts: [] }, DEFAULT_SCENARIO)).toThrow(/Power/)
    }
  })
  it.each(research)('%s: unknown runtime effects never become zero candidates', (id) => {
    const build = representativeBuild([id as EnchantmentId], 'soul-scythe')
    expect(() => evaluate(build, DEFAULT_SCENARIO)).toThrow(/未対応|research-only/)
    expect(() => optimize({ weapons: [build.weapon], artifacts: [] }, DEFAULT_SCENARIO)).toThrow(/未対応|research-only/)
  })
  it('supported zero is valid, unlike an unsupported effect', () => {
    const synergy = { ...representativeBuild(['artifact-synergy']), artifacts: [] }
    const result = evaluate(synergy, DEFAULT_SCENARIO)
    expect(result.contributions.find((item) => item.sourceId === 'artifact-synergy')!.singleTargetDpsDelta).toBe(0)
    const dynamo = evaluate(representativeBuild(['dynamo']), { ...DEFAULT_SCENARIO, rollsPerSecond: 0, dynamoInitialStacks: 0 })
    expect(dynamo.damage.dynamoState!.directDps).toBe(0)
  })
  it.each(Object.keys(ENCHANTMENTS))('%s has a real evaluated channel; Soul Siphon has resource output', (id) => {
    const build = representativeBuild([id as EnchantmentId], 'soul-scythe')
    const result = evaluate(build, { ...DEFAULT_SCENARIO, rollsPerSecond: 1, dynamoInitialStacks: 10 })
    if (id === 'soul-siphon') expect(result.soulState!.siphonPickupEventsPerSecond).toBeGreaterThan(0)
    else expect(result.contributions.some((item) => item.sourceId === id && [item.aoeDpsDelta, item.healingPerSecondDelta, item.effectiveHealthDelta, item.controlUtilityDelta].some((value) => value !== 0))).toBe(true)
  })
})

describe('fc83d2bd exact software-output regression; not independent game evidence', () => {
  it('pins the baseline commit and every named input', () => {
    expect(baseline.baselineCommit).toBe('fc83d2bd94770736c76564bf3c2369e769909a13')
    expect(cases.map((item) => item.name)).toEqual(baseline.cases.map((item) => item.name))
  })
  it.each(cases)('$name: every evaluation field and entire optimize result is identical', ({ name, build, scenario }) => {
    const expected = baseline.cases.find((item) => item.name === name)!
    const result = evaluate(build, scenario)
    expect(fieldDigests(result)).toEqual(expected.evaluation)
    expect(digest(optimize({ weapons: [build.weapon], artifacts: build.artifacts }, scenario))).toBe(expected.optimization)
    const candidate = evaluateCandidate(build, scenario)
    for (const key of ['damage', 'healing', 'defense', 'control', 'soulState', 'temporalState', 'utilities', 'objectiveScore'] as const) expect(candidate[key]).toEqual(result[key])
  })
  it('preserves cross-family ranking, objective and Pareto frontier exactly', () => {
    const inventory = { weapons: cases.map(({ name, build }) => ({ ...build.weapon, instanceId: name })), artifacts: cases[0]!.build.artifacts }
    expect(digest(optimize(inventory, cases[0]!.scenario))).toBe(baseline.combined)
  })
})

describe('visibility, generated docs and historical gates', () => {
  it('renders all three levels without creating selectable research candidates', () => {
    const html = renderToStaticMarkup(<RuntimeSupportSection />)
    for (const text of ['Full runtime support', 'Limited', 'Research-only', 'Historical phase partial', 'Evidence confidence', 'mechanics blocker', 'objective blocker']) expect(html).toContain(text)
    expect(html).not.toMatch(/<input|<option/)
    expect(renderToStaticMarkup(<RuntimeSupportBadge id="sharpness" />)).toContain('Full')
  })
  it('warns only for selected limited effects, deduplicated with a detail link', () => {
    expect(renderToStaticMarkup(<RuntimeSupportWarnings enchantments={representativeBuild(['sharpness']).enchantments} />)).toBe('')
    const selected = representativeBuild(['dynamo']).enchantments
    const html = renderToStaticMarkup(<RuntimeSupportWarnings enchantments={[...selected, ...selected]} />)
    expect(html).toContain('制限付き対応')
    expect(html.match(/Power 210–263/g)).toHaveLength(1)
    expect(html).toContain('href="#methodology"')
  })
  it('keeps generated summaries and roadmap counts synchronized', () => {
    for (const file of ['README.md', 'ROADMAP.md', 'research/melee-enchantment-coverage.md', 'docs/melee-runtime-support.md']) expect(readFileSync(file, 'utf8')).toContain(runtimeSupportSummaryText())
    expect(ROADMAP_PROGRESS).toEqual({ completed: 43, total: 58, percentage: 74 })
    const roadmap = readFileSync('ROADMAP.md', 'utf8')
    expect(roadmap.match(/^- \[x\]/gm)).toHaveLength(ROADMAP_PROGRESS.completed)
    expect(roadmap.match(/^- \[[ x]\]/gm)).toHaveLength(ROADMAP_PROGRESS.total)
    for (const phase of ['2-1D', '2-1F', '2-1G', '2-1H', '2-1I', '2-1J']) {
      expect(roadmap).toContain(`- [ ] Phase ${phase} partial`)
      expect(ROADMAP_PHASES.flatMap((item) => item.items).find((item) => item.label.startsWith(`Phase ${phase} partial`))!.status).toBe('in-progress')
    }
  })
  it('keeps edited documentation links and priority counts valid', () => {
    for (const file of ['README.md', 'ROADMAP.md', 'research/melee-enchantment-coverage.md', 'docs/melee-runtime-support.md', 'docs/runtime-limitations.md']) {
      const source = readFileSync(file, 'utf8')
      for (const match of source.matchAll(/\]\(([^)]+)\)/g)) {
        const target = match[1]!.split('#')[0]!
        if (!target || /^https?:/.test(target)) continue
        expect(existsSync(new URL(target, new URL(file, `file://${process.cwd()}/`))), `${file}: ${target}`).toBe(true)
      }
    }
    const backlog = readFileSync('docs/runtime-limitations.md', 'utf8')
    for (const [priority, count] of [['P0', 1], ['P1', 8], ['P2', 7], ['P3', 10]] as const) expect(backlog.match(new RegExp(`\\| ${priority} \\|`, 'g')) ?? []).toHaveLength(count)
  })
})

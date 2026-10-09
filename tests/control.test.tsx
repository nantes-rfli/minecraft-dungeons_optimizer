import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import legacy from './fixtures/cc-legacy-baseline.json'
import audit from '../research/cc-subsystem-audit.json'
import { calculateControl, calculateControlUtility } from '../src/core/control'
import { calculateRefreshEffectCoverage, finiteRefreshCoverage } from '../src/core/refreshCoverage'
import { evaluate } from '../src/core/evaluate'
import { optimize, dominates, calculateParetoFrontier } from '../src/core/optimizer'
import { validateScenario } from '../src/core/validation'
import type { Build, ControlEnchantmentId, ControlMetrics, EnchantmentId, EnchantmentTier, Scenario, SelectedEnchantment, WeaponId } from '../src/core/types'
import { CONTROL_IDS, CONTROL_ENCHANTMENTS, DEFAULT_CONTROL_POLICY } from '../src/data/control'
import { DEFAULT_SCENARIO, SCENARIO_PROFILES } from '../src/data/scenarios'
import { deserializeInventory, loadInventory, saveInventory, serializeInventory } from '../src/inventory/storage'
import { ControlDetails, ControlSettings } from '../src/views/ControlDetails'
import { ObjectiveWeightsControls } from '../src/views/ObjectiveWeightsControls'

const selection = (enchantmentId: EnchantmentId, tier: EnchantmentTier = 3, source: SelectedEnchantment['source'] = 'slot'): SelectedEnchantment => ({ enchantmentId, tier, source })
function buildFor(enchantments: SelectedEnchantment[], weaponId: WeaponId = 'double-axe'): Build {
  const gilded = enchantments.find((item) => item.source === 'gilded')
  return { weapon: { instanceId: 'cc', weaponId, powerLevel: 251, observedDamagePerHit: 100,
    enchantmentSlots: enchantments.filter((item) => item.source === 'slot').map((item) => ({ candidates: [item.enchantmentId] })),
    ...(gilded ? { gilded: { enchantmentId: gilded.enchantmentId, tier: gilded.tier } } : {}),
  }, enchantments, artifacts: [] }
}
const ccBuild = (id: ControlEnchantmentId, tier: EnchantmentTier = 3) => buildFor([selection('radiance'), selection(id, tier, 'gilded')])
const coverage = (intervals: number[], probability: number, duration: number, encounter: number, speed = 1) => calculateRefreshEffectCoverage({ hitIntervalSequence: intervals, triggerChance: probability, durationSeconds: duration, encounterDurationSeconds: encounter, attackSpeedMultiplier: speed })
const noControlWeight: Scenario = { ...DEFAULT_SCENARIO, weights: { ...DEFAULT_SCENARIO.weights, control: 0 } }
const percentages = (control: ControlMetrics) => [control.hardDisableCoverage, control.attackSlowEquivalentCoverage, control.rootCoverage, control.groupingCoverage, control.utility]
afterEach(() => vi.unstubAllGlobals())

// Independent oracle: enumerate every proc outcome and integrate its interval union.
// Intentionally small fixtures, never used by runtime or treated as game evidence.
function enumeratedCoverage(intervals: number[], p: number, duration: number, encounter: number): number {
  const times: number[] = []
  for (let t = 0, i = 0; t < encounter; t += intervals[i++ % intervals.length]!) times.push(t)
  if (times.length > 12) throw new Error('Oracle fixture too large')
  let expected = 0
  for (let mask = 0; mask < 2 ** times.length; mask++) {
    let chance = 1
    let end = 0
    let total = 0
    times.forEach((time, i) => {
      const proc = (mask & (1 << i)) !== 0
      chance *= proc ? p : 1 - p
      if (proc) {
        const expiry = Math.min(encounter, time + duration)
        total += Math.max(0, expiry - Math.max(end, time))
        end = Math.max(end, expiry)
      }
    })
    expected += chance * total / encounter
  }
  return expected
}

describe('finite periodic Bernoulli refresh coverage', () => {
  it.each([
    [[1], 0.3, 1.5, 4.2], [[0.4, 1.1], 0.15, 2, 4.7],
    [[1, 3, 0.5], 0.3, 0.8, 8], [[0.2, 0.3], 0.05, 8, 2],
    [[2, 1], 0.9, 3, 7.5], [[4], 0.3, 3, 0.2],
  ] as const)('matches exhaustive outcome unions: %j p=%s d=%s T=%s', (intervals, p, d, t) => {
    expect(coverage([...intervals], p, d, t)).toBeCloseTo(enumeratedCoverage([...intervals], p, d, t), 12)
  })
  it('first hit at zero and encounter-end clipping are finite, not stationary', () => {
    expect(coverage([4], 0.3, 3, 2)).toBeCloseTo(0.3, 14)
    expect(coverage([4], 0.3, 3, 4)).toBeCloseTo(0.225, 14)
    expect(coverage([4], 0.3, 3, 6)).toBeCloseTo(0.25, 14)
    expect(coverage([4], 0, 3, 6)).toBe(0)
    expect(coverage([4], 0.3, 0, 6)).toBe(0)
  })
  it('guaranteed refresh shares Fire time semantics and saturates', () => {
    expect(finiteRefreshCoverage([4], 1, 8, 3)).toBe(0.75)
    expect(coverage([4], 1, 3, 8)).toBe(0.75)
    expect(coverage([0.1, 0.4], 1, 3, 30)).toBe(1)
    expect(coverage([4], 1, 3, 8, 2)).toBe(1)
  })
  it('community 30-hit check is 1-.85^30, with a finite startup deficit', () => {
    const stationary = 1 - 0.85 ** 30
    expect(stationary).toBeCloseTo(0.9923692404, 9)
    expect(coverage([1 / 15], 0.15, 2, 30)).toBeLessThan(stationary)
    expect(coverage([1 / 15], 0.15, 2, 1e9)).toBeCloseTo(stationary, 8)
    // Poisson is a different approximation, not a second definition of exact coverage.
    expect(Math.abs(stationary - (1 - Math.exp(-15 * 0.15 * 2)))).toBeGreaterThan(0.003)
  })
  it('handles long encounters without a per-hit simulator', () => {
    expect(coverage([0.01, 0.03, 0.02], 0.3, 3, 1e10)).toBeCloseTo(1, 8)
  })
  it.each([-1, NaN, Infinity])('rejects invalid times and cadence %s', (value) => {
    expect(() => coverage([value], 0.3, 3, 30)).toThrow()
    expect(() => coverage([1], 0.3, value, 30)).toThrow()
    expect(() => coverage([1], 0.3, 3, value)).toThrow()
    expect(() => coverage([1], 0.3, 3, 30, value)).toThrow()
  })
  it('rejects empty/zero cadence, invalid probability, and unrepresentable hit counts', () => {
    for (const p of [-0.1, 1.1, NaN, Infinity]) expect(() => coverage([1], p, 3, 30)).toThrow()
    expect(() => coverage([], 0.3, 3, 30)).toThrow()
    expect(() => coverage([0], 0.3, 3, 30)).toThrow()
    expect(() => coverage([1], 0.3, 3, 0)).toThrow()
    expect(() => coverage([1], 0.3, 3, 30, 0)).toThrow()
    expect(() => coverage([1e-300], 0.3, 3, 1e300)).toThrow()
  })
})

describe('CC states, policy and isolation from other mechanics', () => {
  it.each(CONTROL_IDS)('%s tiers match the audit and increase coverage without altering other axes', (id) => {
    const entry = audit.entries.find((item) => item.id === id)!
    let previous = 0
    for (const tier of [1, 2, 3] as const) {
      const result = evaluate(ccBuild(id, tier), DEFAULT_SCENARIO)
      const state = result.control[id]!
      expect(state.triggerChance).toBe(entry.trigger.tierProbabilities[tier - 1])
      expect(state.durationSeconds).toBe(entry.effect.tierDurationSeconds[tier - 1])
      if (id === 'freezing') expect(result.control.freezing!.attackSpeedReduction).toBe([0.3, 0.4, 0.5][tier - 1])
      expect(result.control.utility).toBeGreaterThanOrEqual(previous)
      previous = result.control.utility
      for (const value of percentages(result.control)) { expect(Number.isFinite(value)).toBe(true); expect(value).toBeGreaterThanOrEqual(0); expect(value).toBeLessThanOrEqual(1) }
      const contribution = result.contributions.find((item) => item.sourceId === id)!
      expect(contribution.controlUtilityDelta).toBe(result.control.utility)
      expect(contribution.objectiveDelta).toBeGreaterThan(0)
      expect(contribution.aoeDpsDelta).toBe(0)
      expect(contribution.singleTargetDpsDelta).toBe(0)
      expect(contribution.healingPerSecondDelta).toBe(0)
      expect(contribution.effectiveHealthDelta).toBe(0)
      const off = evaluate(ccBuild(id, tier), noControlWeight)
      expect(off.control).toEqual(result.control)
      expect(off.contributions.find((item) => item.sourceId === id)!.objectiveDelta).toBe(0)
    }
  })
  it('keeps root, grouping, attack slow and hard disable separate', () => {
    expect(evaluate(ccBuild('chains'), DEFAULT_SCENARIO).control.hardDisableCoverage).toBe(0)
    const freezing = evaluate(ccBuild('freezing'), DEFAULT_SCENARIO).control
    expect(freezing.freezing!.attackSpeedReduction).toBe(0.5)
    expect(freezing.attackSlowEquivalentCoverage).toBe(freezing.freezing!.activeCoverage * 0.5 * 0.5)
    expect([freezing.rootCoverage, freezing.groupingCoverage, freezing.hardDisableCoverage]).toEqual([0, 0, 0])
    const gravity = evaluate(ccBuild('gravity'), DEFAULT_SCENARIO).control
    expect([gravity.hardDisableCoverage, gravity.rootCoverage, gravity.attackSlowEquivalentCoverage]).toEqual([0, 0, 0])
  })
  it.each(CONTROL_IDS)('%s eligibility endpoints and target-time semantics', (id) => {
    const zero = { ...DEFAULT_SCENARIO, crowdControl: { ...DEFAULT_SCENARIO.crowdControl, [`${id}EligibleTargetShare`]: 0 } }
    const one = { ...DEFAULT_SCENARIO, crowdControl: { ...DEFAULT_SCENARIO.crowdControl, [`${id}EligibleTargetShare`]: 1 } }
    expect(evaluate(ccBuild(id), zero).control.utility).toBe(0)
    expect(evaluate(ccBuild(id), one).control.utility).toBeCloseTo(2 * evaluate(ccBuild(id), DEFAULT_SCENARIO).control.utility, 14)
    if (id === 'stunning') {
      const result = evaluate(ccBuild(id), one).control
      expect(result.hardDisableCoverage).toBe(result.stunning!.activeCoverage)
      expect(evaluate(ccBuild(id), SCENARIO_PROFILES.boss).control.hardDisableCoverage).toBe(0)
      expect(evaluate(ccBuild(id), { ...one, crowdControl: { ...one.crowdControl, stunningEffectiveDurationMultiplier: 0 } }).control.hardDisableCoverage).toBe(0)
    }
  })
  it.each(['chains', 'gravity'] as const)('%s changes only affected fraction when target count increases', (id) => {
    const key = id === 'chains' ? 'chainsExpectedTargetsPerProc' : 'gravityExpectedTargetsPerHit'
    const first = evaluate(ccBuild(id), DEFAULT_SCENARIO)
    const expanded = evaluate(ccBuild(id), { ...DEFAULT_SCENARIO, crowdControl: { ...DEFAULT_SCENARIO.crowdControl, [key]: DEFAULT_SCENARIO.averageTargetsInReach } })
    expect(expanded.control[id]!.activeCoverage).toBe(first.control[id]!.activeCoverage)
    expect(expanded.control.utility).toBeCloseTo(first.control.utility * DEFAULT_SCENARIO.averageTargetsInReach, 14)
    expect(expanded.damage).toEqual(first.damage)
    expect(expanded.control[id]!.opportunitiesPerSecond).toBe(expanded.damage.hitsPerSecond)
  })
  it.each(CONTROL_IDS)('%s follows Death Cap and converged Rampaging cadence', (id) => {
    const base = ccBuild(id)
    const plain = evaluate(base, DEFAULT_SCENARIO)
    const fast = evaluate({ ...base, artifacts: [{ instanceId: 'm', artifactId: 'death-cap-mushroom', powerLevel: 251 }] }, DEFAULT_SCENARIO)
    const rampaging = buildFor([selection('radiance'), selection('rampaging'), selection(id)])
    const ramp = evaluate(rampaging, DEFAULT_SCENARIO)
    for (const result of [fast, ramp]) {
      expect(result.damage.hitsPerSecond).toBeGreaterThan(plain.damage.hitsPerSecond)
      expect(result.control[id]!.opportunitiesPerSecond).toBe(result.damage.hitsPerSecond)
      expect(result.control[id]!.activeCoverage).toBeGreaterThanOrEqual(plain.control[id]!.activeCoverage - 1e-12)
      expect(result.control).toEqual(calculateControl(result.build, DEFAULT_SCENARIO, result.temporalState.attackSpeedMultiplier, result.damage.hitsPerSecond))
    }
  })
  it('weighted mean is bounded even with overlapping states and zero or huge weights', () => {
    const all = { hardDisableCoverage: 1, attackSlowEquivalentCoverage: 1, rootCoverage: 1, groupingCoverage: 1 }
    expect(calculateControlUtility(all, DEFAULT_CONTROL_POLICY)).toBe(1)
    expect(calculateControlUtility(all, { hardDisable: 0, attackSlow: 0, root: 0, grouping: 0 })).toBe(0)
    expect(calculateControlUtility(all, { hardDisable: 1e308, attackSlow: 1e308, root: 1e308, grouping: 1e308 })).toBe(1)
    expect(calculateControlUtility({ ...all, rootCoverage: 0 }, { hardDisable: 0, attackSlow: 0, root: 3, grouping: 1 })).toBe(0.25)
  })
  it('Gravity + Stunning does not raise stun probability, opportunities or utility with a hidden bonus', () => {
    const single = evaluate(ccBuild('stunning'), DEFAULT_SCENARIO)
    const both = evaluate(buildFor([selection('radiance'), selection('gravity'), selection('stunning')]), DEFAULT_SCENARIO)
    expect(both.control.stunning).toEqual(single.control.stunning)
    expect(both.damage).toEqual(single.damage)
    expect(both.control.utility).toBeCloseTo((both.control.hardDisableCoverage + both.control.groupingCoverage) / 4, 14)
  })
})

describe('regression against the unchanged pre-CC commit', () => {
  it.each(legacy.cases)('$name: control=0 reproduces old score and all combat/state metrics exactly', (fixture) => {
    const build = fixture.build as Build
    const scenario: Scenario = { ...DEFAULT_SCENARIO, ...fixture.scenario, profileId: fixture.scenario.profileId as Scenario['profileId'], weights: { ...fixture.scenario.weights, control: 0 } }
    const result = evaluate(build, scenario)
    expect(result).toMatchObject(fixture.expected)
    expect(result.objectiveScore).toBe(fixture.expected.objectiveScore)
    expect(result.control.utility).toBe(0)
    for (const id of CONTROL_IDS) {
      const withCc = evaluate({ ...build, weapon: { ...build.weapon, gilded: { enchantmentId: id, tier: 3 } }, enchantments: [...build.enchantments, selection(id, 3, 'gilded')] }, scenario)
      expect(withCc).toMatchObject(fixture.expected)
      expect(withCc.objectiveScore).toBe(result.objectiveScore)
    }
  })
  it('CC never changes Ambush or Weakening assumptions', () => {
    const base = evaluate(buildFor([selection('ambush'), selection('weakening')]), DEFAULT_SCENARIO)
    for (const id of CONTROL_IDS) {
      const result = evaluate(buildFor([selection('ambush'), selection('weakening'), selection(id)]), DEFAULT_SCENARIO)
      expect(result.damage).toEqual(base.damage)
      expect(result.defense).toEqual(base.defense)
      expect(result.combatState).toEqual(base.combatState)
    }
  })
})

describe('Control optimizer, persistence and UI', () => {
  it('chooses useful CC over equal combat metrics when Control has a positive weight', () => {
    const weapon = { ...buildFor([selection('stunning')]).weapon, enchantmentSlots: [{ candidates: ['stunning', 'freezing'] as const }] }
    const settings = { ...DEFAULT_SCENARIO, controlPolicy: { hardDisable: 1, attackSlow: 0, root: 0, grouping: 0 } }
    const result = optimize({ weapons: [weapon], artifacts: [] }, settings)
    expect(result.best.build.enchantments[0]!.enchantmentId).toBe('stunning')
    const other = result.alternatives[0]!
    expect(result.best.damage).toEqual(other.damage)
    expect(result.best.healing).toEqual(other.healing)
    expect(result.best.defense).toEqual(other.defense)
    expect(result.best.objectiveScore).toBeGreaterThan(other.objectiveScore)
    expect(dominates(result.best, other)).toBe(true)
    expect(dominates(other, result.best)).toBe(false)
    expect(calculateParetoFrontier([other, result.best])).toEqual([result.best])
    const zero = optimize({ weapons: [weapon], artifacts: [] }, { ...settings, weights: { ...settings.weights, control: 0 } })
    expect(zero.best.objectiveScore).toBe(zero.alternatives[0]!.objectiveScore)
  })
  it('a damage/control tradeoff survives Pareto, while all-four inferior is dominated', () => {
    const cc = evaluate(buildFor([selection('stunning')]), DEFAULT_SCENARIO)
    const damage = evaluate(buildFor([selection('critical-hit')]), DEFAULT_SCENARIO)
    expect(dominates(cc, damage)).toBe(false)
    expect(dominates(damage, cc)).toBe(false)
    expect(calculateParetoFrontier([cc, damage])).toHaveLength(2)
    const worse = { ...cc, control: { ...cc.control, utility: 0 }, damage: { ...cc.damage, aoeDps: 0 }, healing: { ...cc.healing, totalPerSecond: 0 }, defense: { ...cc.defense, effectiveHealth: 0 } }
    expect(dominates(cc, worse)).toBe(true)
  })
  it('optimized Pareto matches exhaustive four-axis dominance and preserves stable ties', () => {
    const baseline = evaluate(ccBuild('stunning'), DEFAULT_SCENARIO)
    const candidates = Array.from({ length: 120 }, (_, i) => ({
      ...baseline,
      objectiveScore: (i * 7) % 11,
      damage: { ...baseline.damage, aoeDps: i % 5 },
      healing: { ...baseline.healing, totalPerSecond: (i * 3) % 7 },
      defense: { ...baseline.defense, effectiveHealth: i % 3 },
      control: { ...baseline.control, utility: (i % 4) / 4 },
    }))
    candidates.push(...candidates.slice(0, 20))
    const oracle = candidates.filter((candidate, i) => !candidates.some((other, j) => i !== j && dominates(other, candidate)))
      .sort((a, b) => b.objectiveScore - a.objectiveScore).slice(0, 10)
    expect(calculateParetoFrontier(candidates)).toEqual(oracle)
  })
  it.each(CONTROL_IDS)('%s supports normal/locked and gilded I/II/III through JSON and storage', (id) => {
    const stored = new Map<string, string>()
    vi.stubGlobal('localStorage', { getItem: (key: string) => stored.get(key), setItem: (key: string, value: string) => stored.set(key, value) })
    for (const tier of [1, 2, 3] as const) {
      const build = ccBuild(id, tier)
      const inventory = { weapons: [build.weapon], artifacts: [] }
      const roundtrip = deserializeInventory(serializeInventory(inventory))
      saveInventory(inventory)
      expect(loadInventory({ weapons: [], artifacts: [] })).toEqual(roundtrip)
      const result = optimize(roundtrip, DEFAULT_SCENARIO)
      expect(result.best.build.enchantments.at(-1)).toEqual(selection(id, tier, 'gilded'))
      expect(result.best.control.utility).toBeGreaterThan(0)
    }
    const locked = { ...ccBuild(id).weapon, gilded: undefined, enchantmentSlots: [{ candidates: [id, 'critical-hit'] as EnchantmentId[], locked: id }] }
    expect(optimize({ weapons: [locked], artifacts: [] }, DEFAULT_SCENARIO).best.build.enchantments[0]!.enchantmentId).toBe(id)
  })
  it('rejects Chains multiple copies and excludes only illegal free combinations', () => {
    for (const source of ['slot', 'gilded'] as const) {
      expect(() => evaluate(buildFor([selection('chains'), selection('chains', 3, source)]), DEFAULT_SCENARIO)).toThrow(/Chains.*1個/)
    }
    const weapon = { ...ccBuild('chains').weapon, enchantmentSlots: [{ candidates: ['chains', 'critical-hit'] as const }] }
    const result = optimize({ weapons: [weapon], artifacts: [] }, DEFAULT_SCENARIO)
    expect(result.evaluatedBuildCount).toBe(1)
    expect(result.unsupportedChoices.join(' ')).toMatch(/Chains.*1個/)
    expect(() => optimize({ weapons: [{ ...weapon, enchantmentSlots: [{ candidates: ['chains'], selected: { enchantmentId: 'chains', tier: 3 as const } }] }], artifacts: [] }, DEFAULT_SCENARIO)).toThrow(/Chains.*1個/)
    expect(() => optimize({ weapons: [buildFor([selection('chains'), selection('chains')]).weapon], artifacts: [] }, DEFAULT_SCENARIO)).toThrow(/Chains/)
  })
  it.each(['stunning', 'freezing', 'gravity'] as const)('%s rejects non-stackable normal/gilded pairs', (id) => {
    for (const source of ['slot', 'gilded'] as const) {
      const build = buildFor([selection(id), selection(id, 3, source)])
      expect(() => evaluate(build, DEFAULT_SCENARIO)).toThrow(/最大1個/)
      expect(() => optimize({ weapons: [build.weapon], artifacts: [] }, DEFAULT_SCENARIO)).toThrow(/stacking/)
    }
  })
  it('has no CC confidence factors on unselected builds and never treats policy as evidence', () => {
    const plain = evaluate(buildFor([selection('radiance')]), DEFAULT_SCENARIO)
    expect(plain.confidence.factors.some((f) => f.id.startsWith('cc-'))).toBe(false)
    const stunning = evaluate(ccBuild('stunning'), DEFAULT_SCENARIO)
    expect(stunning.confidence.factors.find((f) => f.id === 'cc-stunning-duration')!.confidence).toBe('low')
    expect(stunning.confidence.factors.some((f) => f.id === 'cc-targets-gravity')).toBe(false)
    const changedPolicy = evaluate(ccBuild('stunning'), { ...DEFAULT_SCENARIO, controlPolicy: { hardDisable: 4, attackSlow: 0, root: 0, grouping: 0 } })
    expect(changedPolicy.confidence).toEqual(stunning.confidence)
  })
  it('renders raw metrics, separate utility, duration uncertainty and editable assumptions', () => {
    const build = buildFor([selection('chains'), selection('stunning'), selection('freezing'), selection('gravity', 3, 'gilded')])
    const html = renderToStaticMarkup(<ControlDetails evaluation={evaluate(build, DEFAULT_SCENARIO)} />)
    for (const label of ['Hard disable', 'Attack slow', 'Root', 'Grouping', 'Control utility', '信頼度低', '攻撃可能', 'DPS bonusなし', '被ダメージ削減率ではありません']) expect(html).toContain(label)
    const controls = renderToStaticMarkup(<ControlSettings scenario={DEFAULT_SCENARIO} onChange={() => undefined} />)
    for (const label of ['Stunning 適用可能', 'Chains 適用可能', 'Freezing 適用可能', 'Gravity 適用可能', '平均対象数 / proc', '平均対象数 / hit', 'Control utility内の順位付けの好み']) expect(controls).toContain(label)
    const objectiveWeights = renderToStaticMarkup(<ObjectiveWeightsControls scenario={DEFAULT_SCENARIO} onChange={() => undefined} />)
    for (const label of ['Damageの重み', 'Healingの重み', 'Defenseの重み', 'Controlの重み', '選択中の目的の重みに戻す']) expect(objectiveWeights).toContain(label)
  })
})

describe('Control scenario validation', () => {
  it.each(['stunningEligibleTargetShare', 'chainsEligibleTargetShare', 'freezingEligibleTargetShare', 'gravityEligibleTargetShare', 'stunningEffectiveDurationMultiplier', 'shockPowderEligibleTargetShare', 'shockPowderAffectedTargetShare'] as const)('rejects invalid %s', (key) => {
    for (const value of [-0.1, 1.1, NaN, Infinity]) expect(() => validateScenario({ ...DEFAULT_SCENARIO, crowdControl: { ...DEFAULT_SCENARIO.crowdControl, [key]: value } })).toThrow(/crowdControl/)
  })
  it.each(['chainsExpectedTargetsPerProc', 'gravityExpectedTargetsPerHit'] as const)('rejects illogical target counts %s', (key) => {
    for (const value of [0, 3, NaN, Infinity]) expect(() => validateScenario({ ...DEFAULT_SCENARIO, crowdControl: { ...DEFAULT_SCENARIO.crowdControl, [key]: value } })).toThrow(/crowdControl/)
  })
  it('rejects invalid policy weights but permits all-zero subweights and Control-only objective', () => {
    for (const value of [-1, NaN, Infinity]) {
      for (const key of Object.keys(DEFAULT_CONTROL_POLICY)) expect(() => validateScenario({ ...DEFAULT_SCENARIO, controlPolicy: { ...DEFAULT_CONTROL_POLICY, [key]: value } })).toThrow(/controlPolicy/)
      expect(() => validateScenario({ ...DEFAULT_SCENARIO, weights: { ...DEFAULT_SCENARIO.weights, control: value } })).toThrow(/weights/)
    }
    expect(() => validateScenario({ ...DEFAULT_SCENARIO, weights: { damage: 0, healing: 0, defense: 0, control: 1 } })).not.toThrow()
    expect(() => validateScenario({ ...DEFAULT_SCENARIO, controlPolicy: { hardDisable: 0, attackSlow: 0, root: 0, grouping: 0 } })).not.toThrow()
    for (const scenario of Object.values(SCENARIO_PROFILES)) expect(() => validateScenario(scenario)).not.toThrow()
  })
  it('retains high-confidence tier chances separate from low-confidence duration', () => {
    expect(CONTROL_ENCHANTMENTS.stunning.tiers.confidence).toBe('high')
    expect(audit.entries.find((entry) => entry.id === 'stunning')!.effect.durationConfidence).toBe('low')
  })
})

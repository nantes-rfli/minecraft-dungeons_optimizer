import { afterEach, describe, expect, it, vi } from 'vitest'
import baseline from './fixtures/artifact-foundation-baseline.json'
import { digest, fieldDigests } from './fixtures/runtimeBaselineDigest'
import { artifactRegressionCases } from '../src/research/artifactRegressionCases'
import { evaluate, evaluateCandidate } from '../src/core/evaluate'
import { optimize } from '../src/core/optimizer'
import { calculateArtifactActivationOpportunities, calculateArtifactActivationState, calculateArtifactDuration, calculateArtifactEffectiveCooldown, calculateArtifactEffects, calculateTimedArtifactUptime } from '../src/core/artifact'
import * as catalog from '../src/core/catalog'
import { ARTIFACTS } from '../src/data/artifacts'
import { DEFAULT_SCENARIO } from '../src/data/scenarios'
import type { ArtifactDurationModel } from '../src/core/artifactMechanics'

const cases = artifactRegressionCases()
describe('artifact foundation exact regression against 34e9b72', () => {
  it('uses the pinned pre-refactor commit and covers all 180 combinations', () => {
    expect(baseline.baselineCommit).toBe('34e9b729ccf8ec947932ec8936541c9ea38c67d7')
    expect(cases).toHaveLength(180)
    expect(cases.map((item) => item.name)).toEqual(baseline.cases.map((item) => item.name))
  })
  it.each(cases.map((input, index) => ({ ...input, expected: baseline.cases[index]! })))('$name: all evaluate/candidate fields, contributions and optimizer', ({ build, scenario, expected }) => {
    expect(fieldDigests(evaluate(build, scenario))).toEqual(expected.evaluation)
    expect(fieldDigests(evaluateCandidate(build, scenario))).toEqual(expected.candidate)
    expect(digest(optimize({ weapons: [build.weapon], artifacts: build.artifacts }, scenario))).toBe(expected.optimization)
  })
  it('preserves combined objective ordering, Pareto and explanations', () => {
    const inventory = { weapons: cases.filter((_, index) => index % 30 === 0).map(({ name, build }) => ({ ...build.weapon, instanceId: name })), artifacts: cases[21]!.build.artifacts }
    expect(digest(optimize(inventory, cases[0]!.scenario))).toBe(baseline.combined)
  })
})

const evidence = (value: number) => ({ ...ARTIFACTS['death-cap-mushroom'].cooldownSeconds, value })
describe('duration and use actions are different contracts', () => {
  afterEach(() => vi.restoreAllMocks())
  it('counts an instant use without requiring duration but refuses unimplemented effects', () => {
    const base = ARTIFACTS['death-cap-mushroom']
    vi.spyOn(catalog, 'getArtifactDefinition').mockReturnValue({ id: base.id, name: base.name, cooldownSeconds: base.cooldownSeconds, stacking: base.stacking, mechanic: 'instant-heal', use: { kind: 'cooldown-only', cooldownStarts: 'use' }, healing: { kind: 'fixed', amount: evidence(10) }, targeting: 'self' })
    const owned = { instanceId: 'synthetic-contract-test', artifactId: base.id, powerLevel: 251 }
    const uses = calculateArtifactActivationOpportunities([owned], DEFAULT_SCENARIO)
    expect(calculateArtifactActivationState(uses).totalActivationsPerSecond).toBe(1 / 30)
    expect(() => calculateTimedArtifactUptime(owned, DEFAULT_SCENARIO)).toThrow(/Unsupported artifact mechanics/)
    expect(() => calculateArtifactEffects([owned], DEFAULT_SCENARIO)).toThrow(/Unsupported artifact mechanics/)
  })
  it('refuses to substitute cooldown capacity for resource/channel-limited uses', () => {
    const base = ARTIFACTS['death-cap-mushroom']
    const mock = vi.spyOn(catalog, 'getArtifactDefinition')
    for (const use of [
      { kind: 'soul-spending' as const, cooldownStarts: 'use' as const, soulGathering: evidence(1), cost: evidence(50) },
      { kind: 'soul-channel' as const, cooldownStarts: 'deactivation' as const, soulGathering: evidence(1), soulsPerSecond: evidence(20) },
    ]) {
      mock.mockReturnValue({ ...base, use })
      const owned = { instanceId: 'synthetic-contract-test', artifactId: base.id, powerLevel: 251 }
      expect(() => calculateArtifactActivationOpportunities([owned], DEFAULT_SCENARIO)).toThrow(/resource\/channel/)
      expect(() => calculateTimedArtifactUptime(owned, DEFAULT_SCENARIO)).toThrow(/resource\/channel/)
    }
  })
  it('counts every equipped use without duration or aura ticks', () => {
    const artifacts = cases[21]!.build.artifacts
    const uses = calculateArtifactActivationOpportunities(artifacts, DEFAULT_SCENARIO)
    expect(uses).toHaveLength(3)
    expect(uses.every((use) => !('durationSeconds' in use))).toBe(true)
    expect(calculateArtifactActivationState(uses).totalActivationsPerSecond).toBe(1 / 30 + 1 / 25 + 1 / 25)
  })
  it('evaluates fixed, linear and bounded published duration tables independently', () => {
    expect(calculateArtifactDuration({ kind: 'fixed', seconds: evidence(3) }, 263)).toBe(3)
    expect(calculateArtifactDuration(ARTIFACTS['death-cap-mushroom'].duration, 251)).toBe(8 + 0.052 * 251)
    const table: ArtifactDurationModel = { kind: 'published-table', supportedPowerRange: { min: 100, max: 200 }, points: [{ power: 100, seconds: evidence(5) }, { power: 200, seconds: evidence(7) }] }
    expect(calculateArtifactDuration(table, 100)).toBe(5)
    expect(calculateArtifactDuration(table, 150)).toBe(6)
    expect(calculateArtifactDuration(table, 200)).toBe(7)
    expect(() => calculateArtifactDuration(table, 210)).toThrow(/extrapolation/)
    expect(() => calculateArtifactDuration({ ...table, points: [...table.points].reverse() }, 150)).toThrow(/Invalid/)
  })
  it.each([NaN, Infinity, -1, 0])('rejects invalid duration input %s', (power) => {
    expect(() => calculateArtifactDuration({ kind: 'fixed', seconds: evidence(3) }, power)).toThrow()
  })
  it.each([NaN, Infinity, -1, 1])('rejects invalid cooldown reduction %s', (reduction) => {
    expect(() => calculateArtifactEffectiveCooldown(30, reduction)).toThrow()
  })
  it('rejects event budgets as duration and invalid numeric outputs', () => {
    expect(() => calculateArtifactDuration({ kind: 'event-limited', expiresAfterSeconds: evidence(15), maximumTriggers: evidence(5) } as unknown as ArtifactDurationModel, 251)).toThrow(/Unsupported/)
    expect(() => calculateArtifactDuration({ kind: 'fixed', seconds: evidence(NaN) }, 251)).toThrow(/finite/)
    expect(() => calculateArtifactEffectiveCooldown(0, 0)).toThrow()
  })
  it('retains the game limit of three equipped artifacts including duplicates', () => {
    const build = cases[21]!.build
    expect(() => evaluate(build, DEFAULT_SCENARIO)).not.toThrow()
    expect(() => evaluate({ ...build, artifacts: [...build.artifacts, { ...build.artifacts[0]!, instanceId: 'fourth' }] }, DEFAULT_SCENARIO)).toThrow(/3/)
  })
})

import { describe, expect, it } from 'vitest'
import {
  calculateArtifactDuration,
  calculateArtifactEffectiveCooldown,
} from '../src/core/artifact'
import { deriveArtifactControlState } from '../src/core/artifactControl'
import { evaluate } from '../src/core/evaluate'
import { optimize } from '../src/core/optimizer'
import { ARTIFACTS } from '../src/data/artifacts'
import { DEFAULT_SCENARIO } from '../src/data/scenarios'
import { deserializeInventory, serializeInventory } from '../src/inventory/storage'
import { representativeBuild } from '../src/research/runtimeCombinations'

const shock = { instanceId: 'shock-1', artifactId: 'shock-powder' as const, powerLevel: 108 }

describe('Shock Powder bounded hard-control runtime', () => {
  it.each([
    [12, 3.5],
    [58, 5.3],
    [108, 7.2],
    [262, 13],
  ])('preserves the published Power %i knot at %ss', (power, seconds) => {
    expect(calculateArtifactDuration(ARTIFACTS['shock-powder'].duration, power)).toBe(seconds)
  })

  it('uses piecewise-linear interpolation only inside Power 12–262', () => {
    expect(calculateArtifactDuration(ARTIFACTS['shock-powder'].duration, 83)).toBeCloseTo(6.25, 12)
    expect(() => calculateArtifactDuration(ARTIFACTS['shock-powder'].duration, 11)).toThrow(/extrapolation/)
    expect(() => calculateArtifactDuration(ARTIFACTS['shock-powder'].duration, 263)).toThrow(/extrapolation/)
  })

  it('separates raw uptime, eligibility and affected-target coverage', () => {
    const state = deriveArtifactControlState([shock], DEFAULT_SCENARIO)!
    expect(state.durationSeconds).toBe(7.2)
    expect(state.effectiveCooldownSeconds).toBe(15)
    expect(state.rawActiveCoverage).toBeCloseTo(0.48, 14)
    expect(state.hardDisableCoverage).toBeCloseTo(0.12, 14)
    expect(state.positionalControlCoverage).toBe(0)
  })

  it('applies cooldown reduction and saturates coverage at one', () => {
    expect(calculateArtifactEffectiveCooldown(15, 0.5)).toBe(7.5)
    const scenario = {
      ...DEFAULT_SCENARIO,
      cooldownReduction: 0.75,
      crowdControl: {
        ...DEFAULT_SCENARIO.crowdControl,
        shockPowderEligibleTargetShare: 1,
        shockPowderAffectedTargetShare: 1,
      },
    }
    const state = deriveArtifactControlState([{ ...shock, powerLevel: 262 }], scenario)!
    expect(state.effectiveCooldownSeconds).toBe(3.75)
    expect(state.rawActiveCoverage).toBe(1)
    expect(state.hardDisableCoverage).toBe(1)
  })

  it('changes only Control and one use action, not combat channels', () => {
    const build = representativeBuild(['artifact-synergy'])
    const base = evaluate({ ...build, artifacts: [] }, DEFAULT_SCENARIO)
    const result = evaluate({ ...build, artifacts: [shock] }, DEFAULT_SCENARIO)
    expect(result.control.hardDisableCoverage).toBeCloseTo(0.12, 14)
    expect(result.control.shockPowder?.sourceArtifactId).toBe('shock-powder')
    expect(result.control.artifactContributions).toHaveLength(1)
    expect(result.confidence.factors.find((factor) => factor.id === 'artifact-control-interpolation-shock-1')?.confidence).toBe('low')
    expect(result.confidence.factors.find((factor) => factor.id === 'artifact-control-target-model-shock-1')?.confidence).toBe('low')
    expect(result.temporalState.artifactActivation.totalActivationsPerSecond).toBeCloseTo(1 / 15, 14)
    expect(result.temporalState.artifactSynergy.chargedAttacksPerSecond).toBeCloseTo(1 / 15, 14)
    expect(result.damage.aoeDps).toBeGreaterThan(base.damage.aoeDps)
    expect(result.healing).toEqual(base.healing)
    expect(result.defense).toEqual(base.defense)
    expect(result.soulState).toEqual(base.soulState)
    expect(result.combatState.estimatedKillsPerSecond).toBeGreaterThanOrEqual(base.combatState.estimatedKillsPerSecond)
  })

  it('does not alter DPS, healing, defense, souls or kills without Artifact Synergy', () => {
    const build = representativeBuild(['critical-hit'])
    const base = evaluate({ ...build, artifacts: [] }, DEFAULT_SCENARIO)
    const result = evaluate({ ...build, artifacts: [shock] }, DEFAULT_SCENARIO)
    expect(result.damage).toEqual(base.damage)
    expect(result.healing).toEqual(base.healing)
    expect(result.defense).toEqual(base.defense)
    expect(result.soulState).toEqual(base.soulState)
    expect(result.combatState).toEqual(base.combatState)
  })

  it('rejects duplicate copies and out-of-range builds explicitly', () => {
    const build = representativeBuild(['critical-hit'])
    expect(() => evaluate({ ...build, artifacts: [shock, { ...shock, instanceId: 'shock-2' }] }, DEFAULT_SCENARIO)).toThrow(/最大1個/)
    expect(() => evaluate({ ...build, artifacts: [{ ...shock, powerLevel: 263 }] }, DEFAULT_SCENARIO)).toThrow(/extrapolation/)
  })

  it('round-trips storage and participates in optimizer evaluation', () => {
    const build = representativeBuild(['critical-hit'])
    const inventory = { weapons: [build.weapon], artifacts: [shock] }
    expect(deserializeInventory(serializeInventory(inventory))).toEqual(inventory)
    const result = optimize(inventory, DEFAULT_SCENARIO)
    expect(result.best.build.artifacts).toEqual([shock])
    expect(result.best.contributions.find((item) => item.sourceId === 'shock-powder')?.controlUtilityDelta).toBeGreaterThan(0)
  })
})

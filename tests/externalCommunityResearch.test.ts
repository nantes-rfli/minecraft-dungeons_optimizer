import { describe, expect, it } from 'vitest'
import { continuousCommittedGain, finiteCommitted, inverseArmorDamageTaken } from '../scripts/external-community-models'
import { committedTrajectory } from '../src/core/enemyStateDamage'
import { ATTACK_PROFILES } from '../src/data/attackProfiles'
import { calculateBaseHitsPerSecond } from '../src/core/attackProfile'
import hps from '../research/external-community/hps-observations.json'

describe('external community research hypotheses (not runtime promotion)', () => {
  it('reproduces rounded DR examples with explicit family assignment', () => {
    expect(1 - inverseArmorDamageTaken([0.35, 0.5])).toBeCloseTo(0.606, 3)
    expect(1 - inverseArmorDamageTaken([0.35, 0.5], [0.5])).toBeCloseTo(0.803, 3)
    expect(1 - inverseArmorDamageTaken([0.9, 0.5])).toBeCloseTo(0.909, 3)
    expect(1 - inverseArmorDamageTaken([0.9], [0.5])).toBeCloseTo(0.95, 12)
    expect(inverseArmorDamageTaken([])).toBe(1)
    expect(inverseArmorDamageTaken([0.35])).toBeCloseTo(0.65, 12)
  })

  it('requires state-by-state DR evaluation before averaging uptime', () => {
    const meanOfStates = (inverseArmorDamageTaken([0.35]) + inverseArmorDamageTaken([0.35, 0.9])) / 2
    const reductionAtMeanInput = inverseArmorDamageTaken([0.35, 0.45])
    expect(Math.abs(meanOfStates - reductionAtMeanInput)).toBeGreaterThan(0.05)
  })

  it('confirms the existing Committed runtime already implements the full-health continuous limit', () => {
    for (const bonus of [0, 0.5, 0.75, 1]) {
      expect(continuousCommittedGain(bonus)).toBeCloseTo(committedTrajectory(100, 0, bonus).directMultiplier, 12)
    }
    expect(continuousCommittedGain(1)).toBeCloseTo(1 / Math.log(2), 12)
    expect(continuousCommittedGain(1, 0.5)).toBeCloseTo(0.5 / Math.log(4 / 3), 12)
  })

  it('keeps overkill, hit cost and initial hit convention separate', () => {
    const input = { maxHealth: 100, startingHpFraction: 1, damagePerHit: 45, hitsPerSecond: 2, bonus: 1 }
    const result = finiteCommitted(input)
    expect(result).toMatchObject({ baselineHits: 3, hits: 2, overkill: 10.25, attackBudgetSeconds: 1, firstHitAtZeroKillSeconds: 0.5, attackBudgetGain: 1.5 })
    // Finite thresholds can exceed the continuous multiplier; it is not a universal upper bound.
    expect(result.attackBudgetGain).toBeGreaterThan(continuousCommittedGain(1))
    expect(finiteCommitted({ ...input, damagePerHit: 60 })).toMatchObject({ baselineHits: 2, hits: 2, overkill: 56, attackBudgetGain: 1 })
    expect(finiteCommitted({ ...input, damagePerHit: 150 })).toMatchObject({ hits: 1, overkill: 50, firstHitAtZeroKillSeconds: 0, attackBudgetGain: 1 })
    expect(finiteCommitted({ ...input, damagePerHit: 0.01 }).attackBudgetGain).toBeCloseTo(continuousCommittedGain(1), 3)
  })

  it('compares the four existing profiles without substituting external aggregate HPS', () => {
    const pairs = [
      ['anchor', 'Anchor'], ['double-axe', 'Double Axe/Cursed Axe'],
      ['fighters-bindings', 'Fighters Bindings'], ['soul-scythe', "Soul Scythe/Frost Scythe/Jailor's Scythe"],
    ] as const
    const differences = pairs.map(([id, label]) => {
      const row = hps.records.find((record) => record.label === label)!
      const runtime = calculateBaseHitsPerSecond(ATTACK_PROFILES[id].value)
      return { id, runtime, reported: row.values[0], relativeDifference: (row.values[0]! / runtime - 1) * 100 }
    })
    expect(differences.map((row) => row.reported)).toEqual([0.42, 1.6, 6.8, 1.8])
    expect(differences.map((row) => Number(row.relativeDifference.toFixed(2)))).toEqual([5, -4, -2.25, -6.4])
  })

  it('rejects invalid inputs and impractically large synthetic runs', () => {
    for (const value of [-1, NaN, Infinity, 1]) expect(() => inverseArmorDamageTaken([value])).toThrow()
    for (const value of [-1, NaN, Infinity, 1.1]) expect(() => continuousCommittedGain(value)).toThrow()
    expect(() => continuousCommittedGain(1, 0)).toThrow()
    const valid = { maxHealth: 100, startingHpFraction: 1, damagePerHit: 10, hitsPerSecond: 2, bonus: 1 }
    for (const key of ['maxHealth', 'damagePerHit', 'hitsPerSecond', 'startingHpFraction'] as const) {
      for (const value of [0, -1, NaN, Infinity]) expect(() => finiteCommitted({ ...valid, [key]: value })).toThrow()
    }
    expect(() => finiteCommitted({ ...valid, damagePerHit: 1e-9 })).toThrow('budget')
    expect(() => finiteCommitted({ ...valid, bonus: 2 })).toThrow()
  })
})

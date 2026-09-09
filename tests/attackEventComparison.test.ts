import { describe, expect, it } from 'vitest'
import { countEvents, eventRate, validateAttackObservation } from '../src/research/attackEventComparison'
import comparison from '../research/external-community/attack-event-comparison.json'
import { ATTACK_PROFILES } from '../src/data/attackProfiles'
import { calculateBaseHitsPerSecond } from '../src/core/attackProfile'

describe('Phase 6.9D attack/event comparison', () => {
  it('keeps aggregate rates distinct from event sequences and definitions', () => {
    const anchor = comparison.profiles.find((profile) => profile.id === 'anchor')!
    expect(() => countEvents(anchor.aggregate as never, 'damage-hit')).toThrow('cannot provide event counts')
    expect(() => countEvents(anchor.configured as never, 'damage-hit')).toThrow('cannot provide event counts')
    expect(eventRate(anchor.runtime!.observation as never, 'damage-hit')).toBeCloseTo(anchor.runtime!.ratePerSecond, 12)
  })
  it('maps all six profiles and retains grouped mapping scope', () => {
    expect(comparison.profiles.map((profile) => profile.id)).toEqual(['anchor', 'double-axe', 'fighters-bindings', 'soul-scythe', 'claymore', 'sawblade'])
    expect(comparison.profiles.filter((profile) => profile.mapping === 'exact')).toHaveLength(1)
    expect(comparison.profiles.every((profile) => profile.configuredAsset.includes('/MeleeWeapons/'))).toBe(true)
  })
  it('does not collapse Sawblade proc opportunities into damage hits', () => {
    expect(comparison.sawbladeMetricSplit).toMatchObject({ procOpportunitiesPerSecond: 4, damageHitsPerSecond: 6 })
    expect(comparison.sawbladeMetricSplit.relationship).toContain('no synthetic event sequence')
  })
  it('uses external base HPS only as an unused comparison for runtime profiles', () => {
    expect(comparison.unusedObservationComparison.comparedProfiles).toBe(4)
    expect(comparison.unusedObservationComparison.result.map((row) => Number(row.relativeDifferencePercent.toFixed(2)))).toEqual([5, -4, -2.25, -6.4])
    expect(comparison.promotionCount).toBe(0)
    expect(comparison.newGapClosures).toBe(0)
    for (const row of comparison.unusedObservationComparison.result) {
      expect(row.runtimeRatePerSecond).toBeCloseTo(calculateBaseHitsPerSecond(ATTACK_PROFILES[row.id as keyof typeof ATTACK_PROFILES].value), 12)
    }
  })
  it('rejects malformed sequences and definitions', () => {
    expect(() => validateAttackObservation({ kind: 'aggregate-rate', ratePerSecond: 1, metric: 'reported-average-hps', conditions: {} })).toThrow('conditions')
    expect(() => validateAttackObservation({ kind: 'event-sequence', cycleSeconds: 1, conditions: {}, events: [{ offsetSeconds: 1, kind: 'damage-hit', variant: 'x' }] })).toThrow('order/range')
    expect(() => validateAttackObservation({ kind: 'attack-definition', variants: [], unresolvedPlaybackRules: [] })).toThrow('requires variants')
  })
})

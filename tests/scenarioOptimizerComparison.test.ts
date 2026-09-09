import { describe, expect, it } from 'vitest'
import { rankFiniteCandidates, simulateFiniteCandidate } from '../src/research/scenarioOptimizerComparison'
import type { FiniteCandidate, FiniteScenario, ObjectivePolicy } from '../src/research/scenarioOptimizerComparison'
import comparison from '../research/external-community/scenario-optimizer-comparison.json'

const scenario: FiniteScenario = { id: 'test@1', durationSeconds: 2, enemies: [{ id: 'enemy', maxHealth: 100, spawnTimeSeconds: 0 }], hero: { maxHealth: 100, initialHealth: 50, incomingDamageEvents: [] } }
const policy: ObjectivePolicy = { revision: 'test-policy@1', weights: { effectiveDamage: 1, kills: 1, actualHealing: 1, damageAvoided: 0, control: 0 }, targets: { effectiveDamage: 100, kills: 1, actualHealing: 50, control: 1 } }
const candidate = (overrides: Partial<FiniteCandidate> = {}): FiniteCandidate => ({ id: 'candidate', modelRevision: 'test-model@1', events: [{ timeSeconds: 1, targetId: 'enemy', actionId: 'a1', componentId: 'hit', sourceEffect: 'weapon', damage: 120, ownership: 'direct-melee' }], directKillHealingFraction: 0.5, incomingDamageMultiplier: 1, unresolvedMechanics: [], ...overrides })

describe('Phase 6.9F Scenario / Optimizer comparison', () => {
  it('uses finite damage, overkill, final-blow ownership, and actual healing', () => {
    const result = simulateFiniteCandidate(candidate(), scenario)
    expect(result.status).toBe('ranked')
    if (result.status !== 'ranked') return
    expect(result.metrics).toMatchObject({ effectiveDamage: 100, overkillDamage: 20, kills: 1, directOwnedKills: 1, actualHealing: 50 })
    const indirect = simulateFiniteCandidate(candidate({ events: [{ ...candidate().events[0]!, ownership: 'indirect' }] }), scenario)
    expect(indirect.status === 'ranked' && indirect.metrics.actualHealing).toBe(0)
  })

  it('excludes unresolved mechanics and final-blow ownership instead of scoring them as zero', () => {
    expect(simulateFiniteCandidate(candidate({ unresolvedMechanics: ['unknown modifier family'] }), scenario)).toEqual({ status: 'excluded', candidateId: 'candidate', reasons: ['unknown modifier family'] })
    const unknown = simulateFiniteCandidate(candidate({ events: [{ ...candidate().events[0]!, ownership: null }] }), scenario)
    expect(unknown.status).toBe('excluded')
    expect(unknown.status === 'excluded' && unknown.reasons[0]).toContain('ownership')
  })

  it('ranks with revisioned scenario and objective keys and a deterministic tie break', () => {
    const rows = rankFiniteCandidates([candidate({ id: 'z' }), candidate({ id: 'a' })], scenario, policy)
    expect(rows.map((row) => row.candidateId)).toEqual(['a', 'z'])
    const first = rows[0]!
    expect(first.status === 'ranked' && first.comparisonKey).toBe('test-model@1|test@1|test-policy@1')
    expect(rankFiniteCandidates([candidate({ id: 'z' }), candidate({ id: 'a' })], scenario, policy)).toEqual(rows)
  })

  it('validates scenario, candidate, and policy inputs', () => {
    expect(() => simulateFiniteCandidate(candidate(), { ...scenario, durationSeconds: 0 })).toThrow('duration')
    expect(() => simulateFiniteCandidate(candidate({ incomingDamageMultiplier: NaN }), scenario)).toThrow('multiplier')
    expect(() => simulateFiniteCandidate(candidate({ events: [{ ...candidate().events[0]!, targetId: 'missing' }] }), scenario)).toThrow('unknown target')
    expect(() => rankFiniteCandidates([candidate()], scenario, { ...policy, weights: { effectiveDamage: 0, kills: 0, actualHealing: 0, damageAvoided: 0, control: 0 } })).toThrow('at least one')
    expect(() => rankFiniteCandidates([], scenario, policy)).toThrow('candidates are required')
    expect(() => rankFiniteCandidates([candidate(), candidate()], scenario, policy)).toThrow('duplicate candidate')
    expect(() => rankFiniteCandidates([candidate(), candidate({ id: 'other', modelRevision: 'other-model@1' })], scenario, policy)).toThrow('mixed model revisions')
  })

  it('records objective and duration rank sensitivity without promotion', () => {
    expect(comparison.ownershipComparison.damageRanking[0]!.candidateId).toBe('indirect-finisher')
    expect(comparison.ownershipComparison.sustainRanking[0]!.candidateId).toBe('direct-finisher')
    expect(comparison.durationSensitivity.shortScenario[0]!.candidateId).toBe('burst')
    expect(comparison.durationSensitivity.longScenario[0]!.candidateId).toBe('steady')
    expect(comparison.reproducibility.repeatedRunsEqual).toBe(true)
    expect(comparison.performance.resultCount).toBe(comparison.performance.candidateCount)
    expect(comparison.promotionCount).toBe(0)
    expect(comparison.newGapClosures).toBe(0)
  })
})

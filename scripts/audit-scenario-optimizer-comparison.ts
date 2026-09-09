import assert from 'node:assert/strict'
import fs from 'node:fs'
import { performance } from 'node:perf_hooks'
import { rankFiniteCandidates, simulateFiniteCandidate } from '../src/research/scenarioOptimizerComparison.ts'
import type { FiniteCandidate, FiniteDamageEvent, FiniteScenario, ObjectivePolicy } from '../src/research/scenarioOptimizerComparison.ts'

const event = (timeSeconds: number, targetId: string, damage: number, ownership: FiniteDamageEvent['ownership'], componentId = 'weapon-hit'): FiniteDamageEvent => ({
  timeSeconds, targetId, damage, ownership, componentId, actionId: `action-${timeSeconds}`, sourceEffect: ownership === 'indirect' ? 'shockwave' : 'weapon',
})
const enemies = ['e1', 'e2', 'e3', 'e4'].map((id) => ({ id, maxHealth: 100, spawnTimeSeconds: 0 }))
const ownershipScenario: FiniteScenario = {
  id: 'ownership-4s@1', durationSeconds: 4, enemies,
  hero: { maxHealth: 100, initialHealth: 100, incomingDamageEvents: [{ timeSeconds: 0.1, damage: 20 }, { timeSeconds: 1.1, damage: 20 }, { timeSeconds: 2.1, damage: 20 }] },
}
const direct: FiniteCandidate = {
  id: 'direct-finisher', modelRevision: 'finite-events@1', directKillHealingFraction: 0.2, incomingDamageMultiplier: 1, unresolvedMechanics: [],
  events: [event(0.4, 'e1', 100, 'direct-melee'), event(1.4, 'e2', 100, 'direct-melee'), event(2.4, 'e3', 100, 'direct-melee')],
}
const indirect: FiniteCandidate = {
  id: 'indirect-finisher', modelRevision: 'finite-events@1', directKillHealingFraction: 0.2, incomingDamageMultiplier: 1, unresolvedMechanics: [],
  events: enemies.flatMap((enemy, index) => [event(index + 0.2, enemy.id, 90, 'direct-melee'), event(index + 0.3, enemy.id, 20, 'indirect', 'shockwave')]),
}
const unknown: FiniteCandidate = {
  id: 'unknown-ownership', modelRevision: 'finite-events@1', directKillHealingFraction: 0.2, incomingDamageMultiplier: 1, unresolvedMechanics: [],
  events: [event(0.5, 'e1', 100, null, 'unresolved-component')],
}
const targets = { effectiveDamage: 400, kills: 4, actualHealing: 100, control: 4 }
const damagePolicy: ObjectivePolicy = { revision: 'damage@1', weights: { effectiveDamage: 0.7, kills: 0.3, actualHealing: 0, damageAvoided: 0, control: 0 }, targets }
const sustainPolicy: ObjectivePolicy = { revision: 'sustain@1', weights: { effectiveDamage: 0.2, kills: 0, actualHealing: 0.8, damageAvoided: 0, control: 0 }, targets }
const damageRanking = rankFiniteCandidates([direct, indirect, unknown], ownershipScenario, damagePolicy)
const sustainRanking = rankFiniteCandidates([direct, indirect, unknown], ownershipScenario, sustainPolicy)
assert.equal(damageRanking[0]!.candidateId, 'indirect-finisher')
assert.equal(sustainRanking[0]!.candidateId, 'direct-finisher')
assert.equal(damageRanking.at(-1)!.status, 'excluded')

const directResult = simulateFiniteCandidate(direct, ownershipScenario)
const indirectResult = simulateFiniteCandidate(indirect, ownershipScenario)
assert.equal(directResult.status, 'ranked')
assert.equal(indirectResult.status, 'ranked')
assert.equal(directResult.metrics.directOwnedKills, 3)
assert.equal(indirectResult.metrics.indirectOwnedKills, 4)
assert.equal(directResult.metrics.actualHealing, 60)
assert.equal(indirectResult.metrics.actualHealing, 0)
const legacyDirectKillShare = 0.9
const legacyComparison = {
  assumption: { directKillShare: legacyDirectKillShare, healingFractionPerDirectKill: 0.2 },
  finiteKills: indirectResult.metrics.kills,
  assumedDirectKills: indirectResult.metrics.kills * legacyDirectKillShare,
  assumedHealingCapacity: indirectResult.metrics.kills * legacyDirectKillShare * 100 * 0.2,
  finiteDirectOwnedKills: indirectResult.metrics.directOwnedKills,
  finiteActualHealing: indirectResult.metrics.actualHealing,
  note: 'legacy steady-state proxy applies Scenario directKillShare and reports capacity; finite events preserve final-blow ownership and cap healing by missing health',
}

const burst: FiniteCandidate = { id: 'burst', modelRevision: 'finite-events@1', directKillHealingFraction: 0, incomingDamageMultiplier: 1, unresolvedMechanics: [], events: [event(0.2, 'e1', 100, 'direct-melee')] }
const steady: FiniteCandidate = { id: 'steady', modelRevision: 'finite-events@1', directKillHealingFraction: 0, incomingDamageMultiplier: 1, unresolvedMechanics: [], events: [event(0.5, 'e1', 70, 'direct-melee'), event(1.5, 'e1', 70, 'direct-melee'), event(2.5, 'e2', 100, 'direct-melee')] }
const durationPolicy: ObjectivePolicy = { revision: 'finite-damage@1', weights: { effectiveDamage: 1, kills: 0, actualHealing: 0, damageAvoided: 0, control: 0 }, targets: { ...targets, effectiveDamage: 200 } }
const shortScenario = { ...ownershipScenario, id: 'short-1s@1', durationSeconds: 1, hero: { ...ownershipScenario.hero, incomingDamageEvents: [] } }
const longScenario = { ...ownershipScenario, id: 'long-3s@1', durationSeconds: 3, hero: { ...ownershipScenario.hero, incomingDamageEvents: [] } }
const durationSensitivity = {
  short: rankFiniteCandidates([burst, steady], shortScenario, durationPolicy),
  long: rankFiniteCandidates([burst, steady], longScenario, durationPolicy),
}
assert.equal(durationSensitivity.short[0]!.candidateId, 'burst')
assert.equal(durationSensitivity.long[0]!.candidateId, 'steady')

const reproducibilityA = rankFiniteCandidates([indirect, direct, unknown], ownershipScenario, sustainPolicy)
const reproducibilityB = rankFiniteCandidates([indirect, direct, unknown], ownershipScenario, sustainPolicy)
assert.deepEqual(reproducibilityA, reproducibilityB)
const workload = Array.from({ length: 500 }, (_, index) => ({ ...direct, id: `candidate-${index.toString().padStart(3, '0')}` }))
const started = performance.now()
const performanceResults = rankFiniteCandidates(workload, ownershipScenario, damagePolicy)
const elapsedMs = performance.now() - started
const performanceThresholdMs = 1_000
assert.equal(performanceResults.length, workload.length)
assert.ok(elapsedMs < performanceThresholdMs, `6.9F performance probe exceeded ${performanceThresholdMs} ms: ${elapsedMs.toFixed(2)} ms`)

const rankedOnly = (rows: typeof damageRanking) => rows.filter((row) => row.status === 'ranked')
const stableScore = (score: number) => Number(score.toFixed(12))
const result = {
  schemaVersion: 1, scope: 'research-only', modelRevision: 'scenario-optimizer-comparison@1',
  comparisonKeyContract: ['candidate.modelRevision', 'scenario.id', 'objective.revision'],
  legacyVsFinite: legacyComparison,
  ownershipComparison: {
    direct: directResult.metrics, indirect: indirectResult.metrics,
    damageRanking: rankedOnly(damageRanking).map(({ candidateId, comparisonKey, score }) => ({ candidateId, comparisonKey, score: stableScore(score) })),
    sustainRanking: rankedOnly(sustainRanking).map(({ candidateId, comparisonKey, score }) => ({ candidateId, comparisonKey, score: stableScore(score) })),
    excluded: damageRanking.filter((row) => row.status === 'excluded'),
  },
  durationSensitivity: {
    shortScenario: durationSensitivity.short.map((row) => ({ candidateId: row.candidateId, status: row.status, ...(row.status === 'ranked' ? { score: stableScore(row.score), effectiveDamage: row.metrics.effectiveDamage, overkillDamage: row.metrics.overkillDamage } : {}) })),
    longScenario: durationSensitivity.long.map((row) => ({ candidateId: row.candidateId, status: row.status, ...(row.status === 'ranked' ? { score: stableScore(row.score), effectiveDamage: row.metrics.effectiveDamage, overkillDamage: row.metrics.overkillDamage } : {}) })),
  },
  reproducibility: { repeatedRunsEqual: true, stableTieBreak: 'candidateId ascending', sameInputRuns: 2 },
  performance: { candidateCount: workload.length, thresholdMs: performanceThresholdMs, resultCount: performanceResults.length, assertion: 'wall-clock checked during audit; unstable elapsed value is not serialized' },
  blockers: ['event-sequence-observations-missing', 'target-switching-rule-unverified', 'same-frame-order-unverified', 'actual-overheal-observations-missing', 'incoming-damage-timeline-missing', 'control-event-ownership-unverified', 'objective-targets-unvalidated'],
  promotionCount: 0, newGapClosures: 0,
}

const path = new URL('../research/external-community/scenario-optimizer-comparison.json', import.meta.url)
const serialized = JSON.stringify(result, null, 2) + '\n'
if (process.argv.includes('--write')) fs.writeFileSync(path, serialized)
assert.equal(fs.readFileSync(path, 'utf8'), serialized, 'Scenario/Optimizer comparison drift; run generate:scenario-optimizer-comparison')
console.log(`Scenario/Optimizer comparison audit passed: 3 ownership candidates, 2 objective rankings, 2 duration scenarios, ${workload.length} performance candidates; promotions 0, Gap closures 0.`)

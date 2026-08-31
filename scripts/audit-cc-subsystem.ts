import assert from 'node:assert/strict'
import fs from 'node:fs'

const read = (name: string) => JSON.parse(fs.readFileSync(new URL(`../research/${name}`, import.meta.url), 'utf8'))
const audit = read('cc-subsystem-audit.json')
const melee = read('melee-enchantment-audit.json')
assert.equal(audit.schemaVersion, 1)
assert.equal(audit.gameVersion, '1.17.0.0')
assert.equal(audit.phaseStatus, 'partial')
assert.deepEqual(audit.entries.map((entry: { id: string }) => entry.id), ['chains', 'stunning', 'freezing', 'gravity'])
const ids = new Set(audit.sources.map((source: { id: string }) => source.id))
assert.equal(ids.size, audit.sources.length)
for (const source of audit.sources) {
  assert.match(source.url, /^https:\/\//)
  assert.match(source.retrievedAt, /^\d{4}-\d{2}-\d{2}$/)
  assert.ok(['high', 'medium', 'low'].includes(source.confidence))
  assert.ok(source.note)
}
for (const entry of audit.entries) {
  assert.equal(entry.runtimeStatus, 'implemented')
  const record = melee.entries.find((item: { id: string }) => item.id === entry.id)
  assert.equal(record.runtimeStatus, entry.runtimeStatus)
  assert.equal(record.runtimeMaxCopies, entry.stacking.runtimeMaxCopies)
  assert.equal(entry.powerIndependent, true)
  assert.ok(entry.sourceIds.length >= 2 && entry.sourceIds.every((id: string) => ids.has(id)))
  assert.equal(entry.stacking.runtimeMaxCopies, 1)
  assert.ok(entry.blockers.length >= 2)
  assert.equal(entry.repeatedApplication.confidence, 'low')
  for (const key of ['bosses', 'powerfulMobs', 'apocalypsePlusResistance']) assert.ok(entry.targetEligibility[key])
  for (const [index, probability] of entry.trigger.tierProbabilities.entries()) {
    assert.ok(Number.isFinite(probability) && probability > 0 && probability <= 1)
    assert.ok(entry.effect.tierDurationSeconds[index] > 0)
    const tier = record.tierValues[index + 1].interpreted
    if (entry.id === 'chains' || entry.id === 'stunning') assert.equal(tier.triggerChance, probability)
    if (entry.id !== 'stunning') assert.equal(tier.durationSeconds, entry.effect.tierDurationSeconds[index])
  }
}
const [chains, stunning, freezing, gravity] = audit.entries
assert.equal(chains.stacking.gameMaxCopies, 4)
assert.equal(chains.stacking.unresolvedCases.length, 6)
assert.equal(chains.stacking.independentRollSanity.runtimeAdopted, false)
assert.deepEqual(chains.effect.tierDurationSeconds, [1, 2, 3])
assert.deepEqual(stunning.trigger.tierProbabilities, [0.05, 0.1, 0.15])
assert.equal(stunning.effect.durationConfidence, 'low')
assert.deepEqual(stunning.effect.tierDurationSeconds, [2, 2, 2])
for (const key of ['gameData', 'wiki', 'community', 'version', 'decision']) assert.ok(stunning.durationGate[key])
assert.equal(freezing.effect.movementSpeedReduction, 0)
assert.equal(melee.entries.find((e: { id: string }) => e.id === 'freezing').modelCategory, 'attack-speed-slow')
assert.deepEqual(freezing.effect.tierAttackSpeedReductions, [0.3, 0.4, 0.5])
assert.deepEqual(gravity.effect.tierDurationSeconds, [1, 1.5, 2])
assert.equal(audit.policy.isGameEvidence, false)
assert.equal(audit.defaults.bossStunningEligibleTargetShare, 0)
assert.equal(audit.defaults.eligibleTargetShares, 0.5)
assert.equal(audit.coverageModel.method, 'finite-periodic-bernoulli-window-exact')
assert.ok(Object.values(audit.priorPhases).every((status) => status === 'partial'))
const runtime = melee.entries.filter((e: { runtimeStatus: string }) => e.runtimeStatus === 'implemented').length
const limited = melee.entries.filter((e: { runtimePowerRange?: unknown }) => e.runtimePowerRange).length
assert.equal(runtime, 28)
assert.equal(limited, 6)
console.log(`CC audit passed: ${runtime}/33 catalog, ${runtime - limited}/33 broad Power, ${limited} limited; Chains single-copy and Stunning low-confidence duration keep Phase 2-1I partial.`)

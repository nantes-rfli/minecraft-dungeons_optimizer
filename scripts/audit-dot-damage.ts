import assert from 'node:assert/strict'
import fs from 'node:fs'

const read = (name: string) => JSON.parse(fs.readFileSync(new URL(`../research/${name}`, import.meta.url), 'utf8'))
const audit = read('dot-damage-event-audit.json')
const melee = read('melee-enchantment-audit.json')
assert.equal(audit.schemaVersion, 1)
assert.equal(audit.gameVersion, '1.17.0.0')
assert.equal(audit.phaseStatus, 'partial')
assert.deepEqual(audit.entries.map((e: { id: string }) => e.id), ['fire-aspect', 'poison-cloud', 'exploding'])
const sourceIds = new Set(audit.sources.map((s: { id: string }) => s.id))
assert.equal(sourceIds.size, audit.sources.length)
for (const s of audit.sources) {
  assert.match(s.url, /^https:\/\//)
  assert.match(s.retrievedAt, /^\d{4}-\d{2}-\d{2}$/)
  assert.ok(s.note)
}
for (const entry of audit.entries) {
  assert.ok(entry.sourceIds.length > 0 && entry.sourceIds.every((id: string) => sourceIds.has(id)))
  assert.ok(entry.blockers.length >= 3)
  assert.equal(entry.runtimeStatus, 'implemented')
  assert.equal(melee.entries.find((e: { id: string }) => e.id === entry.id)?.runtimeStatus, entry.runtimeStatus)
  assert.equal(entry.attribution.qualifiesAsDirectWeaponKill, false)
  assert.match(entry.voidInteraction.runtime, /unsupported/)
  assert.ok(entry.voidInteraction.amplification && entry.voidInteraction.consumesVoid && entry.voidInteraction.resetsOrReappliesVoid)
  assert.equal(entry.stacking.runtimeMaxCopies, 1)
  if (entry.id === 'exploding') {
    assert.deepEqual(entry.powerScaling.tierRatios, [0.2, 0.4, 0.6])
    assert.equal(entry.powerScaling.unit, 'defeated-enemy-health-fraction')
    assert.equal(entry.powerScaling.powerIndependent, true)
    assert.equal(entry.targeting.singleTargetDps, 0)
    assert.equal(entry.repeatedApplication.chainReaction, false)
    assert.equal(entry.solver.chainReaction, false)
    assert.equal(entry.attribution.sourceKills, 'CombatState.directWeaponKillsPerSecond')
    continue
  }
  const power = entry.powerScaling
  assert.equal(power.unit, 'damage-per-second')
  assert.equal(entry.durationSeconds, 3)
  assert.equal(entry.trigger.probability, entry.id === 'fire-aspect' ? 1 : 0.3)
  assert.deepEqual(power.tierRatios, entry.id === 'fire-aspect' ? [1, 1.25, 1.5] : [1, 2, 3])
  assert.equal(power.publishedRows.length, entry.id === 'fire-aspect' ? 11 : 7)
  assert.deepEqual(power.excludedRuntimePowers, entry.id === 'fire-aspect' ? [250] : [])
  assert.deepEqual(power.supportedPowerRange, { min: entry.id === 'fire-aspect' ? 70 : 184, max: 251 })
  assert.deepEqual(melee.entries.find((e: { id: string }) => e.id === entry.id).runtimePowerRange, power.supportedPowerRange)
  for (const [i, row] of power.publishedRows.entries()) {
    assert.equal(row.length, 4)
    assert.ok(row.every((v: number) => Number.isFinite(v) && v > 0))
    if (i > 0) assert.ok(row[0] > power.publishedRows[i - 1][0])
  }
}
const fire = audit.entries[0]
assert.equal(fire.powerScaling.publishedRows.find((row: number[]) => row[0] === 250)[1], 126649)
assert.equal(fire.stacking.gameMaxCopies, 4)
assert.equal(audit.fireOutlier.cause, 'unconfirmed')
assert.match(audit.commonCurveInvestigation.decision, /No low-Power extrapolation/)
assert.deepEqual(audit.priorPhases, { '2-1D': 'partial', '2-1F': 'partial', '2-1G': 'partial' })
const runtime = melee.entries.filter((e: { runtimeStatus: string }) => e.runtimeStatus === 'implemented').length
const limited = melee.entries.filter((e: { runtimePowerRange?: unknown }) => e.runtimePowerRange).length
console.log(`DoT audit passed: ${runtime}/33 runtime; ${runtime - limited} broad Power, ${limited} limited; ${33 - runtime} research-only. Phase 2-1H partial.`)

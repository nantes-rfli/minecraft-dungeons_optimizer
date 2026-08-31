import assert from 'node:assert/strict'
import fs from 'node:fs'
import { DYNAMO_DAMAGE_POINTS, PAIN_CHARGED_MULTIPLIERS, CHARGE_UNVERIFIED_MODIFIERS, CHARGE_WEAPONS } from '../src/data/chargeConsume.ts'

const read = (file: string) => JSON.parse(fs.readFileSync(new URL(`../research/${file}`, import.meta.url), 'utf8'))
const audit = read('charge-consume-enchantment-audit.json')
const melee = read('melee-enchantment-audit.json')
assert.equal(audit.schemaVersion, 1)
assert.equal(audit.gameVersion, '1.17.0.0')
assert.equal(audit.phaseStatus, 'partial')
assert.deepEqual(audit.entries.map((entry: { id: string }) => entry.id).sort(), ['dynamo', 'pain-cycle'])
const sourceIds = new Set(audit.sources.map((source: { id: string }) => source.id))
assert.equal(sourceIds.size, audit.sources.length)
for (const entry of audit.entries) {
  const main = melee.entries.find((item: { id: string }) => item.id === entry.id)
  assert.equal(entry.runtimeStatus, 'implemented')
  assert.equal(entry.runtimeStatus, main.runtimeStatus)
  assert.deepEqual(entry.stacking, { maxCopies: 1, behavior: 'non-stackable' })
  assert.deepEqual(entry.stacking, main.stacking)
  for (const name of ['chargeSource', 'chargeCap', 'chargeGranularity', 'consume', 'miss', 'damageFormula', 'attribution', 'aoe', 'modifierInteraction', 'runtimeBlocker']) assert.ok(entry.claims[name], `${entry.id}: missing ${name}`)
  for (const claim of Object.values(entry.claims) as { value: string; status: string; confidence: string; sourceIds: string[] }[]) {
    assert.ok(claim.value.length > 0)
    assert.ok(['high', 'medium', 'low'].includes(claim.confidence))
    assert.ok(['supported', 'limited-model', 'model-derived', 'assumption', 'unresolved'].includes(claim.status))
    assert.ok(claim.sourceIds.length > 0 && claim.sourceIds.every((id) => sourceIds.has(id)))
    if (claim.status === 'unresolved' || claim.status === 'assumption') assert.equal(claim.confidence, 'low')
  }
  for (const id of [...CHARGE_UNVERIFIED_MODIFIERS, entry.id === 'pain-cycle' ? 'dynamo' : 'pain-cycle']) {
    const row = entry.interactionMatrix.find((item: { with: string }) => item.with === id)
    assert.ok(row, `${entry.id}: missing interaction ${id}`)
    assert.equal(row.runtime, 'unsupported')
    assert.ok(row.sourceIds.every((source: string) => sourceIds.has(source)))
  }
  assert.ok(entry.blockers.length >= 3)
}
const pain = audit.entries.find((entry: { id: string }) => entry.id === 'pain-cycle')
assert.deepEqual(pain.tiers, Object.values(PAIN_CHARGED_MULTIPLIERS))
assert.equal(pain.requiredChargingAttacks, 5)
assert.equal(pain.cycleLengthAttacks, 6)
assert.equal(pain.selfHealthFraction, 0.03)
const painMain = melee.entries.find((entry: { id: string }) => entry.id === 'pain-cycle')
for (const tier of [1, 2, 3]) {
  assert.equal(painMain.tierValues[tier].interpreted.chargedDamageMultiplier, pain.tiers[tier - 1])
  assert.equal(painMain.tierValues[tier].interpreted.requiredChargingAttacks, 5)
  assert.equal(painMain.tierValues[tier].interpreted.cycleLengthAttacks, 6)
  assert.ok(!('fifthHitDamageMultiplier' in painMain.tierValues[tier].interpreted))
}
const dynamo = audit.entries.find((entry: { id: string }) => entry.id === 'dynamo')
assert.deepEqual(dynamo.numericSamples, DYNAMO_DAMAGE_POINTS)
assert.equal(dynamo.cap, 20)
assert.deepEqual(dynamo.defaults, { rollsPerSecond: 0, dynamoInitialStacks: 0 })
assert.deepEqual(dynamo.runtimePowerRange, { min: 210, max: 263 })
assert.deepEqual(dynamo.runtimePowerRange, melee.entries.find((entry: { id: string }) => entry.id === 'dynamo').runtimePowerRange)
assert.deepEqual(audit.attackProfileReview.map((entry: { weaponId: string }) => entry.weaponId), CHARGE_WEAPONS)
console.log('Charge/consume audit passed: Pain finite six-action cycle and self-cost; Dynamo30 independent values/Power210–263; unresolved pairs rejected; partial evidence explicit.')

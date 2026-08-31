import assert from 'node:assert/strict'
import fs from 'node:fs'

const read = (name: string) => JSON.parse(fs.readFileSync(new URL(`../research/${name}`, import.meta.url), 'utf8'))
const audit = read('temporal-enchantment-audit.json')
const melee = read('melee-enchantment-audit.json')
assert.equal(audit.gameVersion, '1.17.0.0')
assert.equal(audit.schemaVersion, 1)
assert.equal(audit.phaseStatus, 'partial')
const expected = ['artifact-synergy', 'echo', 'rampaging']
assert.deepEqual(audit.entries.map((entry: { id: string }) => entry.id).sort(), expected)
const sourceIds = new Set(audit.sources.map((source: { id: string }) => source.id))
assert.equal(sourceIds.size, audit.sources.length)
for (const entry of audit.entries) {
  const main = melee.entries.find((item: { id: string }) => item.id === entry.id)
  assert.ok(main, `${entry.id}: absent from main audit`)
  assert.equal(entry.runtimeStatus, main.runtimeStatus)
  assert.deepEqual(entry.stacking, main.stacking)
  assert.equal(entry.tiers.length, 3)
  const field = entry.id === 'artifact-synergy' ? 'nextAttackDamageBonus' : entry.id === 'rampaging' ? 'durationSeconds' : 'cooldownSeconds'
  for (const tier of [1, 2, 3]) assert.equal(entry.tiers[tier - 1], main.tierValues[tier].interpreted[field])
  for (const claim of Object.values(entry.claims) as { confidence: string; status: string; value: string; sourceIds: string[] }[]) {
    assert.ok(['high', 'medium', 'low'].includes(claim.confidence))
    assert.ok(['supported', 'assumption', 'limited-model', 'model-derived', 'unresolved'].includes(claim.status))
    assert.ok(claim.value.length > 0 && claim.sourceIds.length > 0)
    assert.ok(claim.sourceIds.every((id) => sourceIds.has(id)), `${entry.id}: unknown claim source`)
    if (claim.status === 'assumption' || claim.status === 'unresolved') assert.equal(claim.confidence, 'low')
  }
  if (entry.id === 'echo') {
    assert.equal(entry.runtimeStatus, 'needs-state-model')
    assert.ok(entry.blockers.length >= 7)
  } else assert.equal(entry.runtimeStatus, 'implemented')
}
assert.deepEqual(audit.attackProfileReview.map((entry: { weaponId: string }) => entry.weaponId).sort(), ['anchor', 'double-axe', 'fighters-bindings'])
const rampaging = audit.entries.find((entry: { id: string }) => entry.id === 'rampaging')
assert.equal(rampaging.triggerChance, 0.1)
assert.equal(rampaging.attackSpeedBonus, 0.5)
console.log('Temporal enchantment audit passed: Artifact Synergy / Rampaging bounded runtime; Echo research-only; all claims linked to evidence.')

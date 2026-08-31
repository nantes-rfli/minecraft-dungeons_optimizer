import assert from 'node:assert/strict'
import fs from 'node:fs'

const read = (name: string) => JSON.parse(fs.readFileSync(new URL(`../research/${name}`, import.meta.url), 'utf8'))
const audit = read('soul-subsystem-audit.json')
const melee = read('melee-enchantment-audit.json')
const attacks = read('melee-attack-profile-audit.json')
assert.equal(audit.schemaVersion, 1)
assert.equal(audit.gameVersion, '1.17.0.0')
assert.equal(audit.phaseStatus, 'partial')
assert.match(audit.auditedAt, /^\d{4}-\d{2}-\d{2}$/)
const sources = new Set(audit.sources.map((source: { id: string }) => source.id))
assert.equal(sources.size, audit.sources.length)
for (const source of audit.sources) {
  assert.ok(source.id && source.version && source.note)
  assert.match(source.url, /^https:\/\//)
  assert.ok(['game-files', 'published-reference', 'community-test', 'model-assumption'].includes(source.kind))
}
function claims(values: Record<string, { value: unknown; confidence: string; status: string; sourceIds: string[] }>) {
  for (const [id, claim] of Object.entries(values)) {
    assert.notEqual(claim.value, undefined, `${id}: missing value`)
    assert.ok(['high', 'medium', 'low'].includes(claim.confidence), id)
    assert.ok(['supported', 'assumption', 'limited-model', 'model-derived', 'unresolved'].includes(claim.status), id)
    assert.ok(claim.sourceIds.length > 0 && claim.sourceIds.every((source) => sources.has(source)), id)
    if (['assumption', 'unresolved'].includes(claim.status)) assert.equal(claim.confidence, 'low', id)
  }
}
claims(audit.claims)
for (const key of ['capacity', 'initialSouls', 'gatheringMeaning', 'additiveGathering', 'gildedGathering', 'normalPickupEvents', 'normalResourceUnits', 'eligibleKillSources', 'artifactKillExclusions', 'trajectory', 'capacityOverflow', 'spending']) assert.ok(audit.claims[key], key)
assert.equal(audit.claims.capacity.value, 300)
assert.equal(audit.claims.initialSouls.value, 0)
assert.equal(audit.claims.spending.value, 0)
assert.deepEqual(audit.entries.map((entry: { id: string }) => entry.id).sort(), ['anima-conduit', 'enigma-resonator', 'soul-siphon'])
for (const entry of audit.entries) {
  const main = melee.entries.find((item: { id: string }) => item.id === entry.id)
  assert.ok(main)
  assert.equal(entry.runtimeStatus, main.runtimeStatus)
  assert.equal(entry.soulGearOnly, true)
  assert.equal(main.applicability.soulGearOnly, true)
  assert.equal(entry.soulGathering, 1)
  assert.deepEqual(entry.stacking, { maxCopies: 1, behavior: 'non-stackable' })
  assert.deepEqual(entry.stacking, main.stacking)
  assert.equal(entry.tiers.length, 3)
  const field = entry.id === 'anima-conduit' ? 'maxHealthHealedPerPickup' : entry.id === 'soul-siphon' ? 'extraPickupCount' : 'maxTriggerChance'
  for (const tier of [1, 2, 3]) assert.equal(entry.tiers[tier - 1], main.tierValues[tier].interpreted[field])
  claims(entry.claims)
  if (entry.id === 'enigma-resonator') {
    assert.equal(entry.runtimeStatus, 'needs-state-model')
    assert.ok(entry.blockers.length >= 4)
    assert.equal(entry.damageMultiplier, 3)
  } else assert.equal(entry.runtimeStatus, 'implemented')
}
assert.equal(audit.entries.find((entry: { id: string }) => entry.id === 'soul-siphon').triggerChance, 0.2)
const weapon = audit.weaponPromotion
assert.equal(weapon.weaponId, 'soul-scythe')
assert.equal(weapon.strictRuntimeReady, true)
assert.equal(weapon.variant, 'common')
assert.deepEqual(weapon.builtInEnchantments, [])
assert.equal(weapon.internalPowerRating, 6.915)
assert.equal(weapon.baseSoulGathering, 1)
assert.ok(weapon.sourceIds.every((id: string) => sources.has(id)))
const profile = attacks.weapons.find((entry: { weaponId: string }) => entry.weaponId === weapon.weaponId)
assert.equal(profile.status, 'exact')
assert.equal(profile.confidence, weapon.attackProfileConfidence)
assert.equal(profile.specialHandlingRequired, false)
assert.deepEqual(profile.attackProfile.hitDurationsSeconds, weapon.hitDurationsSeconds)
assert.deepEqual(profile.damageProfile.hitDamageRatios, weapon.hitDamageRatios)
const implemented = melee.entries.filter((entry: { runtimeStatus: string }) => entry.runtimeStatus === 'implemented').length
const limited = melee.entries.filter((entry: { runtimePowerRange?: unknown }) => entry.runtimePowerRange).length
assert.deepEqual(audit.coverage, {
  catalogRuntime: implemented, broadPowerRuntime: implemented - limited, powerRangeLimitedProc: limited,
  researchOnly: melee.entries.length - implemented,
  needsStateModel: melee.entries.filter((entry: { runtimeStatus: string }) => entry.runtimeStatus === 'needs-state-model').length,
})
assert.equal(audit.solver.tolerance, 1e-8)
assert.equal(audit.solver.maxIterations, 100)
console.log('Soul audit passed: Soul Scythe; separate pickups/resources; Anima + Siphon limited runtime; Enigma research-only; 19/33 catalog, 16 broad Power, 3 limited.')

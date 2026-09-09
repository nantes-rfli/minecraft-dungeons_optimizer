import assert from 'node:assert/strict'
import fs from 'node:fs'
import { continuousCommittedGain, finiteCommitted, inverseArmorDamageTaken } from './external-community-models.ts'
import registry from '../research/external-community/registry.json' with { type: 'json' }
import hps from '../research/external-community/hps-observations.json' with { type: 'json' }

assert.equal(registry.schemaVersion, 1)
assert.equal(registry.scope, 'research-only')
assert.equal(hps.scope, 'research-only')
const sources = new Map(registry.sources.map((source) => [source.id, source]))
assert.equal(sources.size, registry.sources.length, 'duplicate source IDs')
assert.equal(new Set(registry.claims.map((claim) => claim.id)).size, registry.claims.length, 'duplicate claim IDs')
for (const source of registry.sources) {
  assert.equal(new URL(source.url).protocol, 'https:')
  assert.ok(['lead-only', 'retrieval-failed', 'content-reviewed', 'data-extracted', 'index-only'].includes(source.retrievalStatus))
  assert.ok(source.notes.length > 0)
  assert.equal(source.gameVersion, null, 'publication dates must not become game versions')
}
for (const claim of registry.claims) {
  assert.equal(claim.decision, 'research-only', `${claim.id}: no runtime promotion in this dataset`)
  assert.ok(claim.blockers.length > 0)
  assert.ok(claim.locator.length > 0)
  assert.ok(claim.sourceIds.length > 0)
  assert.ok(['community_claim', 'community_formula', 'community_derived', 'later_reanalysis', 'author_correction'].includes(claim.kind))
  for (const id of claim.sourceIds) {
    const source = sources.get(id)
    assert.ok(source, `${claim.id}: missing source ${id}`)
    assert.ok(['content-reviewed', 'data-extracted'].includes(source.retrievalStatus), `${claim.id}: unreviewed source`)
  }
}
assert.ok(sources.has(hps.sourceId))
assert.equal(hps.columns.length, 4)
assert.equal(hps.records.length, 55)
assert.equal(hps.damageColumnPower, 263)
assert.equal(new Set(hps.records.map((row) => row.sourceRow)).size, 55)
for (const [index, row] of hps.records.entries()) {
  assert.equal(row.sourceRow, index + 2)
  assert.equal(row.locator, `Sheet1!A${row.sourceRow}:E${row.sourceRow}`)
  assert.ok(row.label.trim())
  assert.equal(row.values.length, 4)
  assert.ok(row.values.every((value) => Number.isFinite(value) && value > 0))
}
const sawRows = hps.records.filter((row) => row.label.includes('Sawblade'))
assert.equal(sawRows.length, 2)
assert.deepEqual(sawRows.map((row) => row.metric), ['proc-opportunities-per-second', 'damage-hits-per-second'])
assert.deepEqual(sawRows.map((row) => row.values), [[4, 4, 4, 4], [6, 6, 6, 6]])
assert.ok(registry.claims.find((claim) => claim.id === 'sawblade-rate-split')!.locator.includes(`A${sawRows[0]!.sourceRow}:`))
assert.ok(registry.claims.find((claim) => claim.id === 'sawblade-rate-split')!.locator.includes(`A${sawRows[1]!.sourceRow}:`))
assert.match(registry.handoff.sha256, /^[0-9a-f]{64}$/)
for (const hash of Object.values(hps.exportSha256)) assert.match(hash, /^[0-9a-f]{64}$/)

const defense = [
  { claimId: 'dr-armor-iron', armor: [0.35, 0.5], separate: [] },
  { claimId: 'dr-armor-iron-guard', armor: [0.35, 0.5], separate: [0.5] },
  { claimId: 'dr-barrier-iron', armor: [0.9, 0.5], separate: [] },
  { claimId: 'dr-barrier-guard', armor: [0.9], separate: [0.5] },
].map((input) => {
  const reported = registry.claims.find((claim) => claim.id === input.claimId)!.value
  assert.equal(typeof reported, 'number')
  const predicted = 1 - inverseArmorDamageTaken(input.armor, input.separate)
  const residual = predicted - (reported as number)
  assert.ok(Math.abs(residual) <= 0.0005, `${input.claimId}: outside reported rounding precision`)
  return { ...input, reported, predicted, residual, validationKind: 'same-source arithmetic consistency' }
})
const committed = [150, 60, 45, 10, 1, 0.01].map((damagePerHit) => ({
  input: { maxHealth: 100, startingHpFraction: 1, damagePerHit, hitsPerSecond: 2, bonus: 1 },
  output: finiteCommitted({ maxHealth: 100, startingHpFraction: 1, damagePerHit, hitsPerSecond: 2, bonus: 1 }),
}))
const result = {
  schemaVersion: 1, scope: 'research-only',
  interpretation: 'Synthetic mathematical probes, not game observations or independent validation samples.',
  defense, committed,
  committedContinuous: { fullHealth: continuousCommittedGain(1), halfHealth: continuousCommittedGain(1, 0.5) },
  promotionCount: 0, newGapClosures: 0,
}
const output = new URL('../research/external-community/model-comparison.json', import.meta.url)
const serialized = JSON.stringify(result, null, 2) + '\n'
if (process.argv.includes('--write')) fs.writeFileSync(output, serialized)
assert.equal(fs.readFileSync(output, 'utf8'), serialized, 'model comparison drift; run generate:external-community')
console.log(`External community audit passed: ${sources.size} sources, ${registry.claims.length} claims, ${hps.records.length} HPS rows; runtime promotions 0, Gap closures 0.`)

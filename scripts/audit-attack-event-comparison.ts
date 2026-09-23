import assert from 'node:assert/strict'
import { fightersBindingsFormalIdentity } from '../src/domain/formal/identityDefinitions.ts'
import fs from 'node:fs'
import { eventRate, validateAttackObservation } from '../src/research/attackEventComparison.ts'
import type { AggregateRateObservation, AttackDefinitionObservation, EventSequenceObservation } from '../src/research/attackEventComparison.ts'
import hps from '../research/external-community/hps-observations.json' with { type: 'json' }
import timing from '../research/game-data-timing/weapon-timing.json' with { type: 'json' }

const mappings = [
  { id: 'anchor', hpsLabel: 'Anchor', assetSuffix: '/Anchor/BP_AnchorInstance', mapping: 'exact' },
  { id: 'double-axe', hpsLabel: 'Double Axe/Cursed Axe', assetSuffix: '/DoubleAxe/BP_DoubleAxeInstance', mapping: 'family-row' },
  { id: fightersBindingsFormalIdentity.assertion.domainId, hpsLabel: 'Fighters Bindings', assetSuffix: fightersBindingsFormalIdentity.assertion.applicationScope.packagePath.slice(fightersBindingsFormalIdentity.assertion.applicationScope.packagePath.lastIndexOf('/' + fightersBindingsFormalIdentity.assertion.rawIdentity + '/')), mapping: fightersBindingsFormalIdentity.assertion.reviewState, identityAssertionId: fightersBindingsFormalIdentity.assertion.id },
  { id: 'soul-scythe', hpsLabel: "Soul Scythe/Frost Scythe/Jailor's Scythe", assetSuffix: '/SoulScythe/BP_SoulScytheInstance', mapping: 'family-row' },
  { id: 'claymore', hpsLabel: 'Claymore/Great Axeblade/Heartstealer', assetSuffix: '/Claymore/BP_ClaymoreInstance', mapping: 'family-row' },
  { id: 'sawblade', hpsLabel: 'Broken Sawblade/Mechanized Sawblade Enchant Hps', assetSuffix: '/Chainsword/BP_ChainswordInstance', mapping: 'family-row-and-metric-split' },
] as const

// Duplicated intentionally as retained comparison input. Vitest cross-checks these values
// against runtime, while this offline generator remains independent of the app module graph.
const runtimeDurations: Readonly<Record<string, readonly number[]>> = {
  anchor: [2.5],
  'double-axe': [0.6, 0.6],
  'fighters-bindings': [0.15, 0.15, 0.15, 0.125],
  'soul-scythe': [0.48, 0.56],
}

function numberValue(value: number | string): number {
  if (typeof value === 'number') return value
  if (value === '+0') return 0
  throw new Error(`Unexpected timing value: ${value}`)
}
function definition(assetSuffix: string): { asset: string; observation: AttackDefinitionObservation } {
  const weapon = timing.weapons.find((row) => row.asset.endsWith(assetSuffix))
  assert.ok(weapon, `missing asset ${assetSuffix}`)
  const observation: AttackDefinitionObservation = {
    kind: 'attack-definition',
    variants: weapon.variants.map((variant) => ({
      name: variant.Name,
      durationSeconds: numberValue(variant.AttackAnimationTimeDurationSeconds),
      damageDelaySeconds: numberValue(variant.DamageDelaySeconds),
      continuousDamageIntervalSeconds: numberValue(variant.ContinuousDamageInterval) || null,
      loopAmount: variant.VariantLoopAmount,
      triggersAfterDamage: variant.EnchantmentTriggerSettings.bTriggerEnchantmentsAfterDamage,
      triggersOnRelease: variant.EnchantmentTriggerSettings.bTriggerEnchantmentsOnRelease,
    })),
    unresolvedPlaybackRules: ['configured-duration-to-effective-time', 'cooldown-scheduling', 'speed-scaling', 'cancel-behavior', 'damage-notify-cardinality'],
  }
  validateAttackObservation(observation)
  return { asset: weapon.asset, observation }
}

const profiles = mappings.map((mapping) => {
  const row = hps.records.find((record) => record.label === mapping.hpsLabel)
  assert.ok(row, `missing HPS row ${mapping.hpsLabel}`)
  const aggregate: AggregateRateObservation = { kind: 'aggregate-rate', ratePerSecond: row.values[0]!, metric: row.metric as AggregateRateObservation['metric'], conditions: { column: hps.columns[0]!, attackSpeedBuff: 'none-reported', measurementMethod: hps.measurementMethod, gameVersion: hps.gameVersion } }
  validateAttackObservation(aggregate)
  const configured = definition(mapping.assetSuffix)
  const durations = runtimeDurations[mapping.id]
  if (durations) {
    const events = durations.map((_, index) => ({ offsetSeconds: durations.slice(0, index).reduce((sum, value) => sum + value, 0), kind: 'damage-hit' as const, variant: `hit-${index + 1}` }))
    const sequence: EventSequenceObservation = { kind: 'event-sequence', cycleSeconds: durations.reduce((sum, value) => sum + value, 0), events, conditions: { source: 'runtime-profile', speedMultiplier: 1 } }
    validateAttackObservation(sequence)
    const runtimeRate = durations.length / sequence.cycleSeconds
    assert.ok(Math.abs(eventRate(sequence, 'damage-hit') - runtimeRate) < 1e-12)
    return { ...mapping, sourceRow: row.sourceRow, aggregate, configuredAsset: configured.asset, configured: configured.observation, runtime: { observation: sequence, ratePerSecond: runtimeRate, relativeDifferencePercent: (aggregate.ratePerSecond / runtimeRate - 1) * 100 }, comparison: mapping.id === fightersBindingsFormalIdentity.assertion.domainId ? 'provisional-identity-only; identity and external conditions/version remain unresolved' : 'eligible-same-metric-only; external conditions/version remain unresolved' }
  }
  return { ...mapping, sourceRow: row.sourceRow, aggregate, configuredAsset: configured.asset, configured: configured.observation, runtime: null, comparison: 'ineligible-without-playback-rule' }
})

const sawDamage = hps.records.find((row) => row.label === 'Broken Sawblade/Mechanized Sawblade Damage Hps')!
assert.equal(sawDamage.metric, 'damage-hits-per-second')
assert.equal(profiles.find((profile) => profile.id === 'sawblade')!.aggregate.ratePerSecond, 4)
assert.equal(sawDamage.values[0], 6)
const result = {
  schemaVersion: 1, scope: 'research-only', modelRevision: 'attack-event-comparison@1',
  conditions: { hpsColumns: hps.columns, gameVersion: hps.gameVersion, measurementMethod: hps.measurementMethod, interpretation: 'Column labels are preserved; buffs, equipment, input cadence, targets, rounding and sample method were not recovered.' },
  profiles,
  sawbladeMetricSplit: { procOpportunitiesPerSecond: 4, damageHitsPerSecond: 6, relationship: 'distinct aggregate metrics; no synthetic event sequence' },
  unusedObservationComparison: { kind: 'external HPS rows not used to fit runtime profiles', comparedProfiles: 4, result: profiles.filter((profile) => profile.runtime).map((profile) => ({ id: profile.id, runtimeRatePerSecond: profile.runtime!.ratePerSecond, externalBaseRatePerSecond: profile.aggregate.ratePerSecond, relativeDifferencePercent: profile.runtime!.relativeDifferencePercent })) },
  blockers: ['external-game-version', 'external-measurement-method', 'buff-condition-definition', 'configured-playback-rule', 'independent-event-sequence-holdout'],
  promotionCount: 0, newGapClosures: 0,
}
const path = new URL('../research/external-community/attack-event-comparison.json', import.meta.url)
const serialized = JSON.stringify(result, null, 2) + '\n'
if (process.argv.includes('--write')) fs.writeFileSync(path, serialized)
assert.equal(fs.readFileSync(path, 'utf8'), serialized, 'attack/event comparison drift; run generate:attack-event-comparison')
console.log(`Attack/event comparison audit passed: ${profiles.length} profiles, 4 runtime comparisons, 2 Sawblade metrics; promotions 0, Gap closures 0.`)

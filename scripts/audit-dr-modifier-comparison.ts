import assert from 'node:assert/strict'
import fs from 'node:fs'
import { composeFactorizedRuntimeProxy, composeModifierHypothesis, expectedDamageTaken, resolveDefenseState } from '../src/research/drModifierComparison.ts'
import type { DefenseEffectId } from '../src/research/drModifierComparison.ts'

const baselineDamage = 396_591
const holdouts: { id: string; active: DefenseEffectId[]; reportedReduction: number; rawDamage: number }[] = [
  { id: 'armor-gong-iron-ghost', active: ['armor-35', 'gong', 'iron-hide', 'ghost-cloak'], reportedReduction: 0.788, rawDamage: 84_060 },
  { id: 'armor-gong-weakening-ghost', active: ['armor-35', 'gong', 'weakening', 'ghost-cloak'], reportedReduction: 0.803, rawDamage: 78_116 },
  { id: 'armor-gong-weakening-iron', active: ['armor-35', 'gong', 'weakening', 'iron-hide'], reportedReduction: 0.803, rawDamage: 78_116 },
  { id: 'armor-iron-guarding', active: ['armor-35', 'iron-hide', 'guarding-strike'], reportedReduction: 0.803, rawDamage: 78_116 },
  { id: 'iron-ghost', active: ['iron-hide', 'ghost-cloak'], reportedReduction: 0.6667, rawDamage: 132_197 },
  { id: 'armor-iron-ghost', active: ['armor-35', 'iron-hide', 'ghost-cloak'], reportedReduction: 0.717, rawDamage: 112_080 },
]
const evaluatedHoldouts = holdouts.map((row) => {
  const predictedDamageTaken = resolveDefenseState(row.active, 'direct-mob-attack')
  const rawDamageTaken = row.rawDamage / baselineDamage
  assert.ok(Math.abs(predictedDamageTaken - rawDamageTaken) < 0.0001, `${row.id}: raw holdout mismatch`)
  assert.ok(Math.abs(1 - predictedDamageTaken - row.reportedReduction) <= 0.0005, `${row.id}: rounded holdout mismatch`)
  return { ...row, baselineDamage, predictedDamageTaken, rawDamageTaken, residualDamageTaken: predictedDamageTaken - rawDamageTaken, validationKind: 'withheld same-origin row; not independent evidence' }
})

assert.throws(() => resolveDefenseState(['ghost-cloak', 'guarding-strike'], 'direct-mob-attack'), /unresolved/)
assert.equal(resolveDefenseState(['weakening'], 'mob-enchantment'), 1)
const jointStateTaken = expectedDamageTaken([
  { probability: 0.5, active: ['armor-35'] },
  { probability: 0.5, active: ['armor-35', 'potion-barrier'] },
], 'direct-mob-attack')
const meanInputTaken = 1 / (1 + 0.35 / (1 - 0.35) + 0.45 / (1 - 0.45))
const defenseComparator = 0.4
assert.ok(jointStateTaken < defenseComparator && meanInputTaken > defenseComparator, 'defense rank sensitivity must flip')

const modifierInput = { basePhysical: 100, additivePhysical: [0.33, 0.2], physicalMultipliers: [0.4], dynamo: 0, otherIndirect: 0, fullMultiplier: 1 }
const taxonomy = composeModifierHypothesis(modifierInput, '2021-indirect')
const factorized = composeFactorizedRuntimeProxy(modifierInput)
const modifierComparator = 220
assert.ok(taxonomy.total < modifierComparator && factorized > modifierComparator, 'modifier rank sensitivity must flip')
const dynamoInput = { ...modifierInput, additivePhysical: [0.33], physicalMultipliers: [], dynamo: 100 }
const dynamo2021 = composeModifierHypothesis(dynamoInput, '2021-indirect')
const dynamo2026 = composeModifierHypothesis(dynamoInput, '2026-inside-additive')
assert.ok(dynamo2026.total > dynamo2021.total)

const result = {
  schemaVersion: 1,
  scope: 'research-only',
  modelRevision: 'dr-modifier-comparison@1',
  sourceBoundary: {
    sourceIds: ['shin-dr-video', 'reddit-ptddv6', 'reddit-1bsib6o', 'shin-modifiers', 'reddit-1u8yqtg'],
    independenceGroups: ['shin-dr', 'shin-modifiers', 'anotherraalt'],
    note: 'Defense formula and holdouts share the Shin/ShinkuNY origin; withheld rows test implementation drift, not independent game validity.',
  },
  defense: {
    rounding: { baselineDamage, comparison: 'raw integer damage residual < 0.0001 damage-taken; displayed DR residual <= 0.0005' },
    holdouts: evaluatedHoldouts,
    channelScope: { weakening: { directMobAttack: 'applies', mobEnchantment: 'does-not-apply' }, otherEffects: 'comparison limited to retrieved direct-attack observations' },
    conflictResolution: { combination: ['ghost-cloak', 'guarding-strike'], outcome: 'reject', reason: '2021 narration reports diminished Ghost Cloak while the later family explanation treats Guarding Strike as separate; no version-matched independent observation resolves it.' },
    stateComparison: { jointStateTaken, meanInputTaken, comparatorTaken: defenseComparator, rankWithJointStates: 'candidate-before-comparator', rankWithMeanReductionInput: 'candidate-after-comparator' },
  },
  modifier: {
    boundaries: ['direct-physical', 'neutral-indirect', 'elemental-indirect-with-focus', 'full-target-damage', 'explicit-exception'],
    taxonomyVsRuntimeProxy: { input: modifierInput, taxonomyTotal: taxonomy.total, factorizedRuntimeProxyTotal: factorized, comparatorTotal: modifierComparator, rankWithTaxonomy: 'candidate-after-comparator', rankWithRuntimeProxy: 'candidate-before-comparator' },
    dynamoConflict: { input: dynamoInput, taxonomy2021Total: dynamo2021.total, formula2026Total: dynamo2026.total, outcome: 'unresolved; do not merge or promote' },
    exceptions: { junglePoison: 'physical flat/multiplicative eligibility with named exclusions plus Poison Focus; not generalized', fireworksArrow: 'ranged damage buff exception; not generalized' },
  },
  blockers: ['game-version-unverified', 'independent-defense-holdout-missing', 'ghost-guarding-conflict', 'modifier-application-order-unverified', 'dynamo-placement-conflict', 'rounding-stage-unverified', 'activation-overlap-distribution-unverified'],
  promotionCount: 0,
  newGapClosures: 0,
}

const path = new URL('../research/external-community/dr-modifier-comparison.json', import.meta.url)
const serialized = JSON.stringify(result, null, 2) + '\n'
if (process.argv.includes('--write')) fs.writeFileSync(path, serialized)
assert.equal(fs.readFileSync(path, 'utf8'), serialized, 'DR/modifier comparison drift; run generate:dr-modifier-comparison')
console.log(`DR/modifier comparison audit passed: ${holdouts.length} same-origin holdouts, 2 rank sensitivity flips; promotions 0, Gap closures 0.`)

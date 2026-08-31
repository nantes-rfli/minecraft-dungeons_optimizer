import { DEFAULT_SCENARIO, SCENARIO_PROFILES } from '../data/scenarios'
import { evaluate } from '../core/evaluate'
import { optimize } from '../core/optimizer'
import type { Build, EnchantmentId, EnchantmentTier, Scenario, WeaponId } from '../core/types'

interface Family {
  readonly family: string
  readonly weapon: WeaponId
  readonly pairs: readonly (readonly EnchantmentId[])[]
  readonly gilded: EnchantmentId
  readonly scenario?: Scenario
}
export const REPRESENTATIVE_FAMILIES: readonly Family[] = [
  { family: 'fast weapon damage', weapon: 'fighters-bindings', pairs: [['critical-hit', 'radiance'], ['swirling', 'thundering', 'shockwave']], gilded: 'sharpness' },
  { family: 'slow weapon damage', weapon: 'anchor', pairs: [['sharpness', 'committed'], ['smiting', 'ambush', 'unchanting']], gilded: 'leeching' },
  { family: 'boss Void', weapon: 'anchor', pairs: [['void-strike', 'critical-hit'], ['void-strike', 'committed', 'sharpness']], gilded: 'weakening', scenario: SCENARIO_PROFILES.boss },
  { family: 'mobbing AoE', weapon: 'double-axe', pairs: [['fire-aspect', 'poison-cloud'], ['exploding', 'rampaging', 'refreshment']], gilded: 'gravity', scenario: SCENARIO_PROFILES.mobbing },
  { family: 'sustain', weapon: 'double-axe', pairs: [['leeching', 'guarding-strike'], ['radiance', 'refreshment', 'weakening']], gilded: 'rampaging' },
  { family: 'control', weapon: 'fighters-bindings', pairs: [['chains', 'stunning'], ['gravity', 'freezing', 'stunning']], gilded: 'radiance' },
  { family: 'soul', weapon: 'soul-scythe', pairs: [['anima-conduit', 'soul-siphon'], ['anima-conduit', 'soul-siphon', 'rampaging']], gilded: 'artifact-synergy' },
  { family: 'Pain Cycle standalone', weapon: 'double-axe', pairs: [['pain-cycle', 'leeching'], ['pain-cycle', 'rampaging', 'guarding-strike']], gilded: 'radiance' },
  { family: 'Dynamo standalone', weapon: 'anchor', pairs: [['dynamo', 'leeching'], ['dynamo', 'rampaging', 'gravity']], gilded: 'weakening' },
]

export function representativeBuild(ids: readonly EnchantmentId[], weaponId: WeaponId = 'double-axe', gilded?: { enchantmentId: EnchantmentId; tier: EnchantmentTier }, powerLevel = 251): Build {
  return {
    weapon: { instanceId: 'runtime-smoke', weaponId, powerLevel, enchantmentSlots: ids.map((id) => ({ candidates: [id] })), ...(gilded ? { gilded } : {}) },
    enchantments: [...ids.map((enchantmentId) => ({ enchantmentId, tier: 3 as const, source: 'slot' as const })), ...(gilded ? [{ ...gilded, source: 'gilded' as const }] : [])],
    artifacts: [{ instanceId: 'mushroom', artifactId: 'death-cap-mushroom', powerLevel: 251 }, { instanceId: 'hide', artifactId: 'iron-hide-amulet', powerLevel: 251 }],
  }
}

export function representativeCases() {
  return REPRESENTATIVE_FAMILIES.flatMap((family) => family.pairs.flatMap((ids, index) =>
    ([undefined, 1, 2, 3] as const).map((tier) => ({
      name: `${family.family}/${index + 1}/${tier ? `gilded-${tier}` : 'normal'}`,
      family: family.family,
      build: representativeBuild(ids, family.weapon, tier ? { enchantmentId: family.gilded, tier } : undefined),
      scenario: { ...(family.scenario ?? DEFAULT_SCENARIO), rollsPerSecond: 0.5, dynamoInitialStacks: 5 },
    })),
  ))
}

const BOUNDARY_PAIRS: readonly (readonly [EnchantmentId, EnchantmentId, string])[] = [
  ['pain-cycle', 'critical-hit', 'charge-modifier'], ['dynamo', 'sharpness', 'charge-modifier'],
  ['pain-cycle', 'dynamo', 'charge-pair'], ['fire-aspect', 'void-strike', 'dot-void'],
  ['poison-cloud', 'void-strike', 'dot-void'], ['exploding', 'void-strike', 'dot-void'],
  ['chains', 'chains', 'copy-count'], ['fire-aspect', 'fire-aspect', 'copy-count'],
]

export function representativeUnsupportedCases() {
  return BOUNDARY_PAIRS.flatMap(([left, right, reasonCategory]) => ([undefined, 1, 2, 3] as const).map((tier) => ({
    name: `${left}+${right}/${tier ? `gilded-${tier}` : 'normal'}`,
    reasonCategory,
    build: representativeBuild(tier ? [left] : [left, right], 'double-axe', tier ? { enchantmentId: right, tier } : undefined),
  })))
}

export function auditRepresentativeCombinations() {
  for (const { name, build, scenario } of representativeCases()) {
    const result = evaluate(build, scenario)
    const optimized = optimize({ weapons: [build.weapon], artifacts: build.artifacts }, scenario)
    if (!Number.isFinite(result.objectiveScore) || optimized.evaluatedBuildCount !== 1 || optimized.unsupportedChoices.length) throw new Error(`${name}: expected supported evaluation/search`)
  }
  const reasons: Record<string, number> = {}
  for (const { name, build, reasonCategory } of representativeUnsupportedCases()) {
    let rejected = false
    try { evaluate(build, DEFAULT_SCENARIO) } catch (error) {
      if (!(error instanceof Error) || !('code' in error) || error.code !== 'UNSUPPORTED_ENCHANTMENT_COMBINATION') throw error
      rejected = true
    }
    if (!rejected) throw new Error(`${name}: unsupported combination silently evaluated`)
    reasons[reasonCategory] = (reasons[reasonCategory] ?? 0) + 1
  }
  const supported = representativeCases().length
  const unsupported = representativeUnsupportedCases().length
  return { total: supported + unsupported, supported, unsupported, reasons }
}

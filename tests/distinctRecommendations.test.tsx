import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { calculateParetoFrontier, optimize } from '../src/core/optimizer'
import { distinctRecommendations } from '../src/core/distinctRecommendations'
import { evaluateCandidate } from '../src/core/evaluate'
import { hasValidEnchantmentStacking } from '../src/core/enchantment'
import { DEFAULT_SCENARIO } from '../src/data/scenarios'
import type { Build, Inventory, SelectedEnchantment } from '../src/core/types'
import { OptimizeResults } from '../src/screens/OptimizeResults'

const inventory: Inventory = {
  weapons: [{ instanceId: 'permutations', weaponId: 'fighters-bindings', powerLevel: 251,
    enchantmentSlots: Array.from({ length: 3 }, () => ({ candidates: ['critical-hit', 'radiance', 'leeching'] })) }],
  artifacts: [],
}

describe('distinct recommendations', () => {
  it('uses next-best slots for different compositions, preserving exhaustive count and best', () => {
    const result = optimize(inventory, DEFAULT_SCENARIO)
    const compositions = [result.best, ...result.alternatives].map((item) =>
      item.build.enchantments.map((enchantment) => enchantment.enchantmentId).sort().join(','))
    expect(new Set(compositions).size).toBe(compositions.length)
    expect(result.evaluatedBuildCount).toBeGreaterThan(compositions.length)
    expect(result.alternatives.length).toBeGreaterThan(0)
    const pareto = result.paretoFrontier.map((item) =>
      item.build.enchantments.map((enchantment) => enchantment.enchantmentId).sort().join(','))
    expect(new Set(pareto).size).toBe(pareto.length)
    const html = renderToStaticMarkup(<OptimizeResults weights={DEFAULT_SCENARIO.weights} result={result} error={null} status="complete" />)
    expect(html).toContain('Enchantの枠順だけが異なる同じ構成はまとめて表示します。')
  })

  it('preserves the best feasible allocation, exact scores and Pareto vectors against exhaustive evaluation', () => {
    const choices = ['critical-hit', 'radiance', 'leeching'] as const
    const evaluations = choices.flatMap((a) => choices.flatMap((b) => choices.flatMap((c) => {
      const enchantments: SelectedEnchantment[] = [a, b, c].map((enchantmentId) => ({ enchantmentId, tier: 3, source: 'slot' }))
      return hasValidEnchantmentStacking(enchantments)
        ? [evaluateCandidate({ weapon: inventory.weapons[0]!, enchantments, artifacts: [] }, DEFAULT_SCENARIO)] : []
    }))).sort((left, right) => right.objectiveScore - left.objectiveScore)
    const result = optimize(inventory, DEFAULT_SCENARIO)
    expect(result.evaluatedBuildCount).toBe(evaluations.length)
    expect(result.best.build).toEqual(evaluations[0]!.build)
    expect(result.best.objectiveScore).toBe(evaluations[0]!.objectiveScore)
    const vector = (item: typeof result.best | typeof evaluations[number]) => JSON.stringify([
      item.damage.aoeDps, item.healing.totalPerSecond, item.defense.effectiveHealth, item.control.utility,
    ])
    expect(new Set(result.paretoFrontier.map(vector))).toEqual(new Set(calculateParetoFrontier(evaluations).map(vector)))
    const serialized = JSON.stringify(inventory)
    expect(optimize(inventory, DEFAULT_SCENARIO)).toEqual(result)
    expect(JSON.stringify(inventory)).toBe(serialized)
  })

  it('keeps tied individual items, tiers, sources, copy counts and differing metrics distinct', () => {
    const base = optimize(inventory, DEFAULT_SCENARIO).best
    const first = base.build.enchantments[0]!
    const withBuild = (build: Build) => ({ ...base, build })
    const distinct = [
      base,
      withBuild({ ...base.build, weapon: { ...base.build.weapon, instanceId: 'another-copy' } }),
      withBuild({ ...base.build, enchantments: [{ ...first, tier: 1 }, ...base.build.enchantments.slice(1)] }),
      withBuild({ ...base.build, enchantments: [{ ...first, source: 'gilded' }, ...base.build.enchantments.slice(1)] }),
      withBuild({ ...base.build, enchantments: [...base.build.enchantments, first] }),
      { ...base, damage: { ...base.damage, aoeDps: base.damage.aoeDps + 1 } },
      { ...base, healing: { ...base.healing, totalPerSecond: -1 } },
    ]
    const reordered = withBuild({ ...base.build, enchantments: [...base.build.enchantments].reverse() })
    expect(distinctRecommendations([...distinct, reordered])).toEqual(distinct)
  })

  it('applies the shared identity to Armor, Ranged and Artifact compositions without collapsing individual copies', () => {
    const base = optimize(inventory, DEFAULT_SCENARIO).best
    const build: Build = {
      ...base.build,
      armor: { instanceId: 'armor', armorId: 'hunters-armor', powerLevel: 251, enchantmentSlots: [], observedHealthBonus: 100 },
      armorEnchantments: [{ enchantmentId: 'chilling', tier: 3, source: 'slot' }, { enchantmentId: 'snowball', tier: 1, source: 'gilded' }],
      rangedWeapon: { instanceId: 'ranged', weaponId: 'bow', powerLevel: 251, enchantmentSlots: [] },
      rangedEnchantments: [{ enchantmentId: 'power', tier: 3, source: 'slot' }, { enchantmentId: 'critical-hit', tier: 1, source: 'gilded' }],
      artifacts: [{ instanceId: 'artifact-a', artifactId: 'death-cap-mushroom', powerLevel: 251 }, { instanceId: 'artifact-b', artifactId: 'iron-hide-amulet', powerLevel: 251 }],
    }
    // Identity-only fixtures; not executable game builds or new Evidence.
    const candidate = { ...base, build }
    const variants = [
      candidate,
      { ...base, build: { ...build, armor: { ...build.armor!, instanceId: 'armor-copy' } } },
      { ...base, build: { ...build, armorEnchantments: [{ ...build.armorEnchantments![0]!, tier: 1 as const }, build.armorEnchantments![1]!] } },
      { ...base, build: { ...build, rangedWeapon: { ...build.rangedWeapon!, instanceId: 'ranged-copy' } } },
      { ...base, build: { ...build, rangedEnchantments: [{ ...build.rangedEnchantments![0]!, source: 'gilded' as const }, build.rangedEnchantments![1]!] } },
      { ...base, build: { ...build, artifacts: [{ ...build.artifacts[0]!, instanceId: 'artifact-copy' }, build.artifacts[1]!] } },
    ]
    const reordered = { ...base, build: { ...build, armorEnchantments: [...build.armorEnchantments!].reverse(), rangedEnchantments: [...build.rangedEnchantments!].reverse(), artifacts: [...build.artifacts].reverse() } }
    const serialized = JSON.stringify(variants)
    expect(distinctRecommendations([...variants, reordered])).toEqual(variants)
    expect(JSON.stringify(variants)).toBe(serialized)
  })

  it('keeps fail-closed exclusions and explains when only one composition is available', () => {
    const only: Inventory = { weapons: [{ ...inventory.weapons[0]!, enchantmentSlots: [
      { candidates: ['critical-hit', 'radiance'] }, { candidates: ['critical-hit', 'radiance'] },
    ] }], artifacts: [], catalogItems: [{ instanceId: 'unknown', category: 'artifact', catalogId: 'gong-of-weakening', powerLevel: 251 }] }
    const result = optimize(only, DEFAULT_SCENARIO)
    expect(result.evaluatedBuildCount).toBe(3)
    expect(result.best.build.artifacts).toEqual([])
    expect(result.alternatives).toHaveLength(1)
    const locked = optimize({ ...only, weapons: [{ ...only.weapons[0]!, enchantmentSlots: [{ candidates: ['critical-hit'], selected: { enchantmentId: 'critical-hit', tier: 3 } }] }] }, DEFAULT_SCENARIO)
    expect(locked.alternatives).toEqual([])
    const html = renderToStaticMarkup(<OptimizeResults weights={DEFAULT_SCENARIO.weights} result={locked} error={null} status="complete" />)
    expect(html).toContain('現在の条件で評価できる別構成の候補はありません。')
  })
})

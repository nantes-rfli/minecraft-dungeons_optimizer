import { describe, expect, it } from 'vitest'
import { optimize, OptimizerInputError } from '../src/core'
import { DEFAULT_SCENARIO } from '../src/data/scenarios'
import type { Inventory } from '../src/core'

const inventory: Inventory = {
  weapons: [
    {
      instanceId: 'bindings-test',
      weaponId: 'fighters-bindings',
      powerLevel: 251,
      enchantmentSlots: [
        { candidates: ['radiance', 'critical-hit'] },
        { candidates: ['leeching', 'guarding-strike'] },
        { candidates: ['void-strike', 'critical-hit'] },
      ],
    },
    {
      instanceId: 'anchor-test',
      weaponId: 'anchor',
      powerLevel: 251,
      enchantmentSlots: [
        { candidates: ['void-strike', 'critical-hit'] },
        { candidates: ['leeching', 'guarding-strike'] },
        { candidates: ['radiance', 'critical-hit'] },
      ],
    },
  ],
  artifacts: [
    { instanceId: 'mushroom-test', artifactId: 'death-cap-mushroom', powerLevel: 251 },
    { instanceId: 'amulet-test', artifactId: 'iron-hide-amulet', powerLevel: 251 },
  ],
}

describe('optimize', () => {
  it('exhaustively evaluates every enchantment combination', () => {
    const result = optimize(inventory, DEFAULT_SCENARIO)
    expect(result.evaluatedBuildCount).toBe(16)
    expect(result.alternatives).toHaveLength(4)
    expect(result.best.objectiveScore).toBeGreaterThanOrEqual(
      result.alternatives[0]?.objectiveScore ?? 0,
    )
    result.best.build.enchantments.forEach((enchantment, index) => {
      expect(result.best.build.weapon.enchantmentSlots[index]?.candidates).toContain(enchantment)
    })
    expect(result.searchMode).toBe('exhaustive')
    expect(result.paretoFrontier.length).toBeGreaterThan(0)
  })

  it('changes rankings when scenario weights change', () => {
    const damage = optimize(inventory, {
      ...DEFAULT_SCENARIO,
      weights: { damage: 1, healing: 0, defense: 0 },
    })
    const survival = optimize(inventory, {
      ...DEFAULT_SCENARIO,
      weights: { damage: 0, healing: 0.5, defense: 0.5 },
    })
    expect(damage.best.build.enchantments).not.toEqual(survival.best.build.enchantments)
  })

  it('rejects an empty inventory with a clear domain error', () => {
    expect(() => optimize({ weapons: [], artifacts: [] }, DEFAULT_SCENARIO)).toThrowError(
      OptimizerInputError,
    )
  })
})

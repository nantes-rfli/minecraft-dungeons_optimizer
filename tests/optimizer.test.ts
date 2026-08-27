import { describe, expect, it } from 'vitest'
import { optimize, OptimizerInputError } from '../src/core'
import { DEFAULT_SCENARIO } from '../src/data/scenarios'
import type { Inventory } from '../src/core'

const inventory: Inventory = {
  weapons: [
    {
      instanceId: 'bindings-test',
      weaponId: 'fighters-bindings',
      enchantmentSlots: [
        ['radiance', 'critical-hit'],
        ['leeching', 'guarding-strike'],
        ['void-strike', 'critical-hit'],
      ],
    },
    {
      instanceId: 'anchor-test',
      weaponId: 'anchor',
      enchantmentSlots: [
        ['void-strike', 'critical-hit'],
        ['leeching', 'guarding-strike'],
        ['radiance', 'critical-hit'],
      ],
    },
  ],
  artifacts: ['death-cap-mushroom', 'iron-hide-amulet'],
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
      expect(result.best.build.weapon.enchantmentSlots[index]).toContain(enchantment)
    })
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

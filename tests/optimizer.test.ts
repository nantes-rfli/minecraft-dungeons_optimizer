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
    expect(result.evaluatedBuildCount).toBe(12)
    expect(result.alternatives).toHaveLength(4)
    expect(result.best.objectiveScore).toBeGreaterThanOrEqual(
      result.alternatives[0]?.objectiveScore ?? 0,
    )
    result.best.build.enchantments.forEach((enchantment, index) => {
      expect(result.best.build.weapon.enchantmentSlots[index]?.candidates).toContain(
        enchantment.enchantmentId,
      )
    })
    expect(result.searchMode).toBe('exhaustive')
    expect(result.paretoFrontier.length).toBeGreaterThan(0)
  })

  it('changes rankings when scenario weights change', () => {
    const damage = optimize(inventory, {
      ...DEFAULT_SCENARIO,
      weights: { damage: 1, healing: 0, defense: 0, control: 0 },
    })
    const survival = optimize(inventory, {
      ...DEFAULT_SCENARIO,
      weights: { damage: 0, healing: 0.5, defense: 0.5, control: 0 },
    })
    expect(damage.best.build.enchantments).not.toEqual(survival.best.build.enchantments)
  })

  it('honors a locked slot and includes a Tier III gilded enchantment', () => {
    const weapon = {
      ...inventory.weapons[0]!,
      enchantmentSlots: [
        { candidates: ['radiance', 'critical-hit'] as const, locked: 'radiance' as const },
        { candidates: ['leeching', 'guarding-strike'] as const },
        { candidates: ['void-strike', 'critical-hit'] as const },
      ],
      gilded: { enchantmentId: 'critical-hit' as const, tier: 3 as const },
    }
    const result = optimize({ weapons: [weapon], artifacts: [] }, DEFAULT_SCENARIO)

    expect(result.evaluatedBuildCount).toBe(2)
    expect(result.best.build.enchantments[0]).toEqual({
      enchantmentId: 'radiance', tier: 3, source: 'slot',
    })
    expect(result.best.build.enchantments.at(-1)).toEqual({
      enchantmentId: 'critical-hit', tier: 3, source: 'gilded',
    })
  })

  it('preserves gilded tier and produces different Tier I and III results', () => {
    const baseWeapon = {
      ...inventory.weapons[0]!,
      enchantmentSlots: [
        { candidates: ['radiance'] as const, locked: 'radiance' as const },
        { candidates: ['leeching'] as const, locked: 'leeching' as const },
        { candidates: ['void-strike'] as const, locked: 'void-strike' as const },
      ],
    }
    const tierOne = optimize({
      weapons: [{
        ...baseWeapon,
        gilded: { enchantmentId: 'critical-hit', tier: 1 },
      }],
      artifacts: [],
    }, DEFAULT_SCENARIO)
    const tierTwo = optimize({
      weapons: [{
        ...baseWeapon,
        gilded: { enchantmentId: 'critical-hit', tier: 2 },
      }],
      artifacts: [],
    }, DEFAULT_SCENARIO)
    const tierThree = optimize({
      weapons: [{
        ...baseWeapon,
        gilded: { enchantmentId: 'critical-hit', tier: 3 },
      }],
      artifacts: [],
    }, DEFAULT_SCENARIO)

    expect(tierOne.best.build.enchantments.at(-1)?.tier).toBe(1)
    expect(tierTwo.best.build.enchantments.at(-1)?.tier).toBe(2)
    expect(tierThree.best.build.enchantments.at(-1)?.tier).toBe(3)
    expect(tierTwo.best.damage.singleTargetDps).toBeGreaterThan(
      tierOne.best.damage.singleTargetDps,
    )
    expect(tierThree.best.damage.singleTargetDps).toBeGreaterThan(
      tierTwo.best.damage.singleTargetDps,
    )
  })

  it('does not generate builds with duplicate non-stackable enchantments', () => {
    const result = optimize({
      weapons: [{
        ...inventory.weapons[0]!,
        enchantmentSlots: [
          { candidates: ['critical-hit'] },
          { candidates: ['critical-hit', 'radiance'] },
        ],
      }],
      artifacts: [],
    }, DEFAULT_SCENARIO)

    expect(result.evaluatedBuildCount).toBe(1)
    expect(result.best.build.enchantments.map((item) => item.enchantmentId)).toEqual([
      'critical-hit', 'radiance',
    ])
  })

  it('reports an impossible non-stackable inventory instead of silently omitting it', () => {
    expect(() => optimize({
      weapons: [{
        ...inventory.weapons[0]!,
        enchantmentSlots: [
          { candidates: ['critical-hit'] },
          { candidates: ['critical-hit'] },
        ],
      }],
      artifacts: [],
    }, DEFAULT_SCENARIO)).toThrow('stacking制約を満たす組み合わせがありません')
  })

  it('rejects an empty inventory with a clear domain error', () => {
    expect(() => optimize({ weapons: [], artifacts: [] }, DEFAULT_SCENARIO)).toThrowError(
      OptimizerInputError,
    )
  })

  it('rejects comparisons that mix observed and normalized damage scales', () => {
    const weapons = inventory.weapons.map((weapon, index) =>
      index === 0 ? { ...weapon, observedDamagePerHit: 100 } : weapon,
    )
    expect(() => optimize({ ...inventory, weapons }, DEFAULT_SCENARIO)).toThrow(
      '比較するすべての武器に入力',
    )
  })

  it('compares all weapons on the observed scale when every value is supplied', () => {
    const weapons = inventory.weapons.map((weapon, index) => ({
      ...weapon,
      observedDamagePerHit: index === 0 ? 100 : 200,
    }))
    const result = optimize({ ...inventory, weapons }, DEFAULT_SCENARIO)
    expect(result.best.damage.damageSource).toBe('observed-input')
  })
})

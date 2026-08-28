import { describe, expect, it } from 'vitest'
import type { EnchantmentTier } from '../src/core'
import {
  changeGildedEnchantment,
  changeGildedTier,
} from '../src/inventory/gilded'

describe('gilded enchantment editor state', () => {
  it.each([1, 2, 3] as const)('preserves Tier %s in UI state updates', (tier) => {
    const updated = changeGildedTier(
      { enchantmentId: 'critical-hit', tier: 3 },
      tier satisfies EnchantmentTier,
    )
    expect(updated.tier).toBe(tier)
  })

  it('does not reset the selected tier when the enchantment changes', () => {
    const updated = changeGildedEnchantment(
      { enchantmentId: 'critical-hit', tier: 2 },
      'void-strike',
    )

    expect(updated).toEqual({ enchantmentId: 'void-strike', tier: 2 })
  })
})

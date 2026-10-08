import { describe, expect, it } from 'vitest'
import type { Inventory } from '../src/core'
import { inventoryGridItemMatchesQuery, inventoryGridItems } from '../src/inventory/gridPresentation'

const inventory: Inventory = {
  weapons: [{
    instanceId: 'bindings-control-copy',
    weaponId: 'fighters-bindings',
    powerLevel: 251,
    rarity: 'rare',
    notes: 'keep for control build',
    enchantmentSlots: [
      { candidates: ['radiance', 'critical-hit'] },
      { candidates: ['leeching'], selected: { enchantmentId: 'leeching', tier: 2 } },
    ],
    gilded: { enchantmentId: 'sharpness', tier: 1 },
  }],
  artifacts: [],
}

const item = inventoryGridItems(inventory)[0]!

describe('inventory search', () => {
  it('matches item identity, names, category, Power, rarity, and notes', () => {
    for (const query of ['bindings-control-copy', 'fighters-bindings', 'Power 251', '近接', 'rare', 'レア', 'control build']) {
      expect(inventoryGridItemMatchesQuery(item, query), query).toBe(true)
    }
  })

  it('matches every enchantment roll, the selected enchantment, and Gilded enchantment', () => {
    for (const query of ['radiance', 'Critical Hit', 'critical-hit', 'Leeching', 'sharpness', '切れ味']) {
      expect(inventoryGridItemMatchesQuery(item, query), query).toBe(true)
    }
    expect(inventoryGridItemMatchesQuery(item, 'chilling')).toBe(false)
  })

  it('treats whitespace-only queries as a match', () => {
    expect(inventoryGridItemMatchesQuery(item, '   ')).toBe(true)
  })

  it('matches preserved research enchantment IDs and localized names', () => {
    const researchInventory: Inventory = {
      weapons: [],
      artifacts: [],
      catalogItems: [{
        instanceId: 'research-robe',
        category: 'armor',
        catalogId: 'battle-robe',
        powerLevel: 251,
        research: { enchantments: [{ enchantmentId: 'chilling', tier: 3, source: 'gilded' }] },
      }],
    }
    const researchItem = inventoryGridItems(researchInventory)[0]!

    expect(inventoryGridItemMatchesQuery(researchItem, 'chilling')).toBe(true)
    expect(inventoryGridItemMatchesQuery(researchItem, '冷気')).toBe(true)
    expect(researchItem.gilded).toBe(true)
  })
})

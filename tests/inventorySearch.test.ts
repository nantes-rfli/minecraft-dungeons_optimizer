import { describe, expect, it } from 'vitest'
import type { Inventory } from '../src/core'
import { inventoryGridItemMatchesFilters, inventoryGridItemMatchesQuery, inventoryGridItems } from '../src/inventory/gridPresentation'

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

  it('filters favorite equipment independently of search and gameplay support', () => {
    const favorites = inventoryGridItems({
      weapons: [{ ...inventory.weapons[0]!, isFavorite: true }],
      artifacts: [],
      catalogItems: [{ instanceId: 'unsupported-favorite', category: 'artifact', catalogId: 'gong-of-weakening', powerLevel: 251, isFavorite: true }],
    })
    const filters = { query: '', category: 'all' as const, gilded: 'all' as const, powerMinimum: null, powerMaximum: null, favoritesOnly: true }

    expect(inventoryGridItemMatchesQuery(favorites[0]!, 'お気に入り')).toBe(true)
    expect(favorites.filter((candidate) => inventoryGridItemMatchesFilters(candidate, filters)).map((candidate) => candidate.instanceId)).toEqual(['bindings-control-copy', 'unsupported-favorite'])
    expect(inventoryGridItemMatchesFilters(item, filters)).toBe(false)
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

  it('filters Power ranges inclusively and rejects invalid or reversed bounds', () => {
    const filters = { query: 'bindings', category: 'melee' as const, gilded: 'gilded' as const, powerMinimum: 251, powerMaximum: 251 }
    expect(inventoryGridItemMatchesFilters(item, filters)).toBe(true)
    expect(inventoryGridItemMatchesFilters(item, { ...filters, powerMinimum: 252 })).toBe(false)
    expect(inventoryGridItemMatchesFilters(item, { ...filters, powerMaximum: 250 })).toBe(false)
    expect(inventoryGridItemMatchesFilters(item, { ...filters, powerMinimum: 252, powerMaximum: 250 })).toBe(false)
    expect(inventoryGridItemMatchesFilters(item, { ...filters, powerMinimum: Number.NaN })).toBe(false)
    expect(inventoryGridItemMatchesFilters(item, { ...filters, powerMaximum: -1 })).toBe(false)
  })
})

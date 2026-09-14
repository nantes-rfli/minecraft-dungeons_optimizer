import { describe, expect, it } from 'vitest'
import type { Inventory } from '../src/core'
import { EQUIPMENT_CATALOG } from '../src/data/equipmentCatalog'
import { hasJapaneseEquipmentName } from '../src/data/equipmentNames.ja'
import { addEquipmentToInventory, collectionSummary, equipmentKey, inventoryStatistics, ownedEquipmentKeys } from '../src/inventory/collection'
import { deserializeInventory, serializeInventory } from '../src/inventory/storage'

const emptyInventory = (): Inventory => ({ weapons: [], armors: [], rangedWeapons: [], artifacts: [], catalogItems: [] })

describe('equipment collection', () => {
  it('has a Japanese primary label for every equipment entry', () => {
    expect(EQUIPMENT_CATALOG.length).toBeGreaterThan(250)
    for (const item of EQUIPMENT_CATALOG) {
      expect(hasJapaneseEquipmentName(item.category, item.id), equipmentKey(item.category, item.id)).toBe(true)
      expect(item.name.ja, equipmentKey(item.category, item.id)).toBeTruthy()
    }
  })

  it('can register every catalog entry without changing unsupported effects into optimizer values', () => {
    const inventory = EQUIPMENT_CATALOG.reduce(
      (current, item, index) => addEquipmentToInventory(current, item, `collection-${index}`),
      emptyInventory(),
    )
    const summary = collectionSummary(inventory)
    expect(summary).toMatchObject({ collected: EQUIPMENT_CATALOG.length, total: EQUIPMENT_CATALOG.length, missing: [] })
    expect(ownedEquipmentKeys(inventory).size).toBe(EQUIPMENT_CATALOG.length)
    expect(inventory.catalogItems?.length).toBe(EQUIPMENT_CATALOG.filter((item) => item.runtimeSupport === 'unsupported').length)
  })

  it('counts equipment types once while preserving multiple owned copies', () => {
    const item = EQUIPMENT_CATALOG.find((entry) => entry.category === 'melee' && entry.id === 'fighters-bindings')!
    const once = addEquipmentToInventory(emptyInventory(), item, 'bindings-1')
    const twice = addEquipmentToInventory(once, item, 'bindings-2')
    expect(twice.weapons).toHaveLength(2)
    expect(collectionSummary(twice).collected).toBe(1)
  })

  it.each(['melee', 'armor', 'ranged'] as const)('registers and round-trips a 3×3 selected and gilded draft for %s', (category) => {
    const item = EQUIPMENT_CATALOG.find((entry) => entry.category === category && entry.runtimeSupport !== 'unsupported')!
    const candidates = category === 'melee' ? ['critical-hit', 'sharpness', 'radiance'] : category === 'armor' ? ['chilling', 'thorns', 'protection'] : ['power', 'multishot', 'rapid-fire']
    const slots = [1, 2, 3].map((tier) => ({ candidates, selected: { enchantmentId: candidates[tier - 1]!, tier: tier as 1 | 2 | 3 } }))
    const registered = addEquipmentToInventory(emptyInventory(), item, `${category}-full`, 251, 'rare', { slots, gilded: { enchantmentId: candidates[0]!, tier: 2 } })
    const restored = deserializeInventory(serializeInventory(registered))
    const owned = category === 'melee' ? restored.weapons[0] : category === 'armor' ? restored.armors?.[0] : restored.rangedWeapons?.[0]
    expect(owned?.enchantmentSlots).toEqual(slots)
    expect(owned?.gilded).toEqual({ enchantmentId: candidates[0], tier: 2 })
  })

  it('never attaches normal or gilded enchantments to an artifact', () => {
    const item = EQUIPMENT_CATALOG.find((entry) => entry.category === 'artifact')!
    const registered = addEquipmentToInventory(emptyInventory(), item, 'artifact', 251, undefined, { slots: [{ candidates: ['cool-down'] }], gilded: { enchantmentId: 'cool-down', tier: 3 } })
    const owned = registered.artifacts[0] ?? registered.catalogItems?.[0]
    expect(owned).not.toHaveProperty('enchantmentSlots')
    expect(owned).not.toHaveProperty('gilded')
  })

  it('summarizes power, gilded items, duplicates, missing equipment and enchantments without inventing rarity', () => {
    const item = EQUIPMENT_CATALOG.find((entry) => entry.category === 'melee' && entry.id === 'fighters-bindings')!
    const recorded = { slots: [{ candidates: ['critical-hit'], selected: { enchantmentId: 'critical-hit', tier: 3 as const } }] }
    const once = addEquipmentToInventory(emptyInventory(), item, 'bindings-1', 249, undefined, recorded)
    const twice = addEquipmentToInventory(once, item, 'bindings-2', 251, undefined, recorded)
    const gilded: Inventory = { ...twice, weapons: twice.weapons.map((weapon, index) => index === 0 ? { ...weapon, gilded: { enchantmentId: 'critical-hit', tier: 3 } } : weapon) }
    const stats = inventoryStatistics(gilded)

    expect(stats.totalItems).toBe(2)
    expect(stats.collectedTypes).toBe(1)
    expect(stats.gildedItems).toBe(1)
    expect(stats.gildedRate).toBe(.5)
    expect(stats.duplicateTypes[0]).toMatchObject({ id: 'fighters-bindings', count: 2 })
    expect(stats.powerDistribution.find((band) => band.label === '200–249')?.count).toBe(1)
    expect(stats.powerDistribution.find((band) => band.label === '250–263')?.count).toBe(1)
    expect(stats.enchantments[0]?.count).toBeGreaterThan(1)
    expect(stats.missing).toHaveLength(EQUIPMENT_CATALOG.length - 1)
  })
})

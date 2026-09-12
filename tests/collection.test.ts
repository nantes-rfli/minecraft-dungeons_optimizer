import { describe, expect, it } from 'vitest'
import type { Inventory } from '../src/core'
import { EQUIPMENT_CATALOG } from '../src/data/equipmentCatalog'
import { hasJapaneseEquipmentName } from '../src/data/equipmentNames.ja'
import { addEquipmentToInventory, collectionSummary, equipmentKey, ownedEquipmentKeys } from '../src/inventory/collection'

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
})

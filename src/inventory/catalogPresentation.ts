import type { CatalogInventoryItem, EquipmentCategory } from '../core'

export type CatalogItemsByCategory = Readonly<Record<EquipmentCategory, readonly CatalogInventoryItem[]>>

export function groupCatalogItemsByCategory(items: readonly CatalogInventoryItem[]): CatalogItemsByCategory {
  return {
    melee: items.filter((item) => item.category === 'melee'),
    armor: items.filter((item) => item.category === 'armor'),
    ranged: items.filter((item) => item.category === 'ranged'),
    artifact: items.filter((item) => item.category === 'artifact'),
  }
}

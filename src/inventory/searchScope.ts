import type { EquipmentCategory, Inventory } from '../core/types'

export function applyInventorySearchScope(inventory: Inventory, excludedIds: ReadonlySet<string>): {
  readonly inventory: Inventory
  readonly excludedCount: number
  readonly emptiedCategories: readonly EquipmentCategory[]
} {
  if (excludedIds.size === 0) return { inventory, excludedCount: 0, emptiedCategories: [] }

  const keep = ({ instanceId }: { readonly instanceId: string }) => !excludedIds.has(instanceId)
  const weapons = inventory.weapons.filter(keep)
  const armors = inventory.armors?.filter(keep)
  const rangedWeapons = inventory.rangedWeapons?.filter(keep)
  const artifacts = inventory.artifacts.filter(keep)
  const removedByCategory = [
    { category: 'melee', before: inventory.weapons.length, after: weapons.length },
    { category: 'armor', before: inventory.armors?.length ?? 0, after: armors?.length ?? 0 },
    { category: 'ranged', before: inventory.rangedWeapons?.length ?? 0, after: rangedWeapons?.length ?? 0 },
    { category: 'artifact', before: inventory.artifacts.length, after: artifacts.length },
  ] as const
  const excludedCount = removedByCategory.reduce((sum, { before, after }) => sum + before - after, 0)
  if (!excludedCount) return { inventory, excludedCount, emptiedCategories: [] }

  return {
    inventory: { ...inventory, weapons, artifacts, ...(armors ? { armors } : {}), ...(rangedWeapons ? { rangedWeapons } : {}) },
    excludedCount,
    emptiedCategories: removedByCategory.filter(({ before, after }) => before > 0 && after === 0).map(({ category }) => category),
  }
}

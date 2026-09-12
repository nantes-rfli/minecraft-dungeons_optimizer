import type { EquipmentCategory, EquipmentRarity, Inventory } from '../core'
import { ENCHANTMENTS } from '../data/enchantments'
import { getEquipmentCatalogEntry, type EquipmentCatalogEntry } from '../data/equipmentCatalog'
import { equipmentKey } from './collection'

export interface InventoryGridItem {
  readonly instanceId: string
  readonly category: EquipmentCategory
  readonly catalogId: string
  readonly powerLevel: number
  readonly rarity: EquipmentRarity | 'unrecorded'
  readonly gilded: boolean
  readonly notes?: string
  readonly enchantments: readonly string[]
  readonly catalog: EquipmentCatalogEntry
}

export function inventoryGridItems(inventory: Inventory): InventoryGridItem[] {
  const item = (instanceId: string, category: EquipmentCategory, catalogId: string, powerLevel: number, rarity: EquipmentRarity | undefined, gilded: boolean, enchantments: readonly string[], notes?: string): InventoryGridItem => {
    const catalog = getEquipmentCatalogEntry(category, catalogId)
    if (!catalog) throw new Error(`Equipment catalog missing: ${equipmentKey(category, catalogId)}`)
    return { instanceId, category, catalogId, powerLevel, rarity: rarity ?? (catalog.rarityFamily === 'unique' ? 'unique' : 'unrecorded'), gilded, enchantments, ...(notes ? { notes } : {}), catalog }
  }
  return [
    ...inventory.weapons.map((owned) => item(owned.instanceId, 'melee', owned.weaponId, owned.powerLevel, owned.rarity, Boolean(owned.gilded), owned.enchantmentSlots.flatMap((slot) => slot.candidates).map((id) => ENCHANTMENTS[id]?.name.ja ?? id))),
    ...(inventory.armors ?? []).map((owned) => item(owned.instanceId, 'armor', owned.armorId, owned.powerLevel, owned.rarity, Boolean(owned.gilded), owned.enchantmentSlots.flatMap((slot) => slot.candidates).map((roll) => roll.enchantmentId))),
    ...(inventory.rangedWeapons ?? []).map((owned) => item(owned.instanceId, 'ranged', owned.weaponId, owned.powerLevel, owned.rarity, Boolean(owned.gilded), owned.enchantmentSlots.flatMap((slot) => slot.candidates).map((roll) => roll.enchantmentId))),
    ...inventory.artifacts.map((owned) => item(owned.instanceId, 'artifact', owned.artifactId, owned.powerLevel, owned.rarity, false, [])),
    ...(inventory.catalogItems ?? []).map((owned) => item(owned.instanceId, owned.category, owned.catalogId, owned.powerLevel, owned.rarity, Boolean(owned.research?.enchantments?.some((enchantment) => enchantment.source === 'gilded')), owned.research?.enchantments?.map((enchantment) => enchantment.enchantmentId) ?? [], owned.notes)),
  ]
}

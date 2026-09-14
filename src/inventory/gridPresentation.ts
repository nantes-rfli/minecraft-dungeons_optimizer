import type { EnchantmentTier, EquipmentCategory, EquipmentRarity, Inventory, OwnedEnchantmentSlot } from '../core'
import { resolveEnchantment } from '../data/enchantmentCatalog'
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
  readonly enchantmentSlots: readonly OwnedEnchantmentSlot<string>[]
  readonly gildedEnchantment?: { readonly enchantmentId: string; readonly tier: EnchantmentTier }
  readonly catalog: EquipmentCatalogEntry
}

export function inventoryGridItems(inventory: Inventory): InventoryGridItem[] {
  const selectedNames = (slots: readonly OwnedEnchantmentSlot<string>[]) => slots.flatMap((slot) => slot.selected ? [resolveEnchantment(slot.selected.enchantmentId)?.name.ja ?? slot.selected.enchantmentId] : [])
  const item = (instanceId: string, category: EquipmentCategory, catalogId: string, powerLevel: number, rarity: EquipmentRarity | undefined, gilded: boolean, enchantments: readonly string[], enchantmentSlots: readonly OwnedEnchantmentSlot<string>[] = [], gildedEnchantment?: { enchantmentId: string; tier: EnchantmentTier }, notes?: string): InventoryGridItem => {
    const catalog = getEquipmentCatalogEntry(category, catalogId)
    if (!catalog) throw new Error(`Equipment catalog missing: ${equipmentKey(category, catalogId)}`)
    return { instanceId, category, catalogId, powerLevel, rarity: rarity ?? (catalog.rarityFamily === 'unique' ? 'unique' : 'unrecorded'), gilded, enchantments, enchantmentSlots, ...(gildedEnchantment ? { gildedEnchantment } : {}), ...(notes ? { notes } : {}), catalog }
  }
  return [
    ...inventory.weapons.map((owned) => item(owned.instanceId, 'melee', owned.weaponId, owned.powerLevel, owned.rarity, Boolean(owned.gilded), selectedNames(owned.enchantmentSlots), owned.enchantmentSlots, owned.gilded)),
    ...(inventory.armors ?? []).map((owned) => item(owned.instanceId, 'armor', owned.armorId, owned.powerLevel, owned.rarity, Boolean(owned.gilded), selectedNames(owned.enchantmentSlots), owned.enchantmentSlots, owned.gilded)),
    ...(inventory.rangedWeapons ?? []).map((owned) => item(owned.instanceId, 'ranged', owned.weaponId, owned.powerLevel, owned.rarity, Boolean(owned.gilded), selectedNames(owned.enchantmentSlots), owned.enchantmentSlots, owned.gilded)),
    ...inventory.artifacts.map((owned) => item(owned.instanceId, 'artifact', owned.artifactId, owned.powerLevel, owned.rarity, false, [])),
    ...(inventory.catalogItems ?? []).map((owned) => item(owned.instanceId, owned.category, owned.catalogId, owned.powerLevel, owned.rarity, Boolean(owned.gilded ?? owned.research?.enchantments?.some((enchantment) => enchantment.source === 'gilded')), owned.enchantmentSlots ? selectedNames(owned.enchantmentSlots) : owned.research?.enchantments?.filter((enchantment) => enchantment.source === 'slot').map((enchantment) => resolveEnchantment(enchantment.enchantmentId)?.name.ja ?? enchantment.enchantmentId) ?? [], owned.enchantmentSlots ?? [], owned.gilded, owned.notes)),
  ]
}

import type { EnchantmentTier, EquipmentCategory, EquipmentRarity, Inventory, OwnedEnchantmentSlot } from '../core'
import { resolveEnchantment } from '../data/enchantmentCatalog'
import { getEquipmentCatalogEntry, type EquipmentCatalogEntry } from '../data/equipmentCatalog'
import { equipmentKey } from './collection'

export interface InventoryGridItem {
  readonly instanceId: string
  readonly category: EquipmentCategory
  readonly catalogId: string
  readonly powerLevel: number
  readonly isFavorite: boolean
  readonly rarity: EquipmentRarity | 'unrecorded'
  readonly gilded: boolean
  readonly notes?: string
  readonly enchantments: readonly string[]
  readonly enchantmentSlots: readonly OwnedEnchantmentSlot<string>[]
  readonly researchEnchantmentIds: readonly string[]
  readonly gildedEnchantment?: { readonly enchantmentId: string; readonly tier: EnchantmentTier }
  readonly catalog: EquipmentCatalogEntry
}

export interface InventoryGridFilters {
  readonly query: string
  readonly category: 'all' | EquipmentCategory
  readonly gilded: 'all' | 'gilded' | 'standard'
  readonly powerMinimum: number | null
  readonly powerMaximum: number | null
  readonly favoritesOnly?: boolean
}

export function inventoryGridItems(inventory: Inventory): InventoryGridItem[] {
  const selectedNames = (slots: readonly OwnedEnchantmentSlot<string>[]) => slots.flatMap((slot) => slot.selected ? [resolveEnchantment(slot.selected.enchantmentId)?.name.ja ?? slot.selected.enchantmentId] : [])
  const item = (instanceId: string, category: EquipmentCategory, catalogId: string, powerLevel: number, rarity: EquipmentRarity | undefined, gilded: boolean, enchantments: readonly string[], enchantmentSlots: readonly OwnedEnchantmentSlot<string>[] = [], gildedEnchantment?: { enchantmentId: string; tier: EnchantmentTier }, notes?: string, researchEnchantmentIds: readonly string[] = [], isFavorite?: boolean): InventoryGridItem => {
    const catalog = getEquipmentCatalogEntry(category, catalogId)
    if (!catalog) throw new Error(`Equipment catalog missing: ${equipmentKey(category, catalogId)}`)
    return { instanceId, category, catalogId, powerLevel, isFavorite: isFavorite ?? false, rarity: rarity ?? (catalog.rarityFamily === 'unique' ? 'unique' : 'unrecorded'), gilded, enchantments, enchantmentSlots, researchEnchantmentIds, ...(gildedEnchantment ? { gildedEnchantment } : {}), ...(notes ? { notes } : {}), catalog }
  }
  return [
    ...inventory.weapons.map((owned) => item(owned.instanceId, 'melee', owned.weaponId, owned.powerLevel, owned.rarity, Boolean(owned.gilded), selectedNames(owned.enchantmentSlots), owned.enchantmentSlots, owned.gilded, owned.notes, [], owned.isFavorite)),
    ...(inventory.armors ?? []).map((owned) => item(owned.instanceId, 'armor', owned.armorId, owned.powerLevel, owned.rarity, Boolean(owned.gilded), selectedNames(owned.enchantmentSlots), owned.enchantmentSlots, owned.gilded, owned.notes, [], owned.isFavorite)),
    ...(inventory.rangedWeapons ?? []).map((owned) => item(owned.instanceId, 'ranged', owned.weaponId, owned.powerLevel, owned.rarity, Boolean(owned.gilded), selectedNames(owned.enchantmentSlots), owned.enchantmentSlots, owned.gilded, owned.notes, [], owned.isFavorite)),
    ...inventory.artifacts.map((owned) => item(owned.instanceId, 'artifact', owned.artifactId, owned.powerLevel, owned.rarity, false, [], undefined, undefined, owned.notes, [], owned.isFavorite)),
    ...(inventory.catalogItems ?? []).map((owned) => item(owned.instanceId, owned.category, owned.catalogId, owned.powerLevel, owned.rarity, Boolean(owned.gilded ?? owned.research?.enchantments?.some((enchantment) => enchantment.source === 'gilded')), owned.enchantmentSlots ? selectedNames(owned.enchantmentSlots) : owned.research?.enchantments?.filter((enchantment) => enchantment.source === 'slot').map((enchantment) => resolveEnchantment(enchantment.enchantmentId)?.name.ja ?? enchantment.enchantmentId) ?? [], owned.enchantmentSlots ?? [], owned.gilded, owned.notes, owned.research?.enchantments?.map((enchantment) => enchantment.enchantmentId) ?? [], owned.isFavorite)),
  ]
}

const categorySearchLabels: Readonly<Record<EquipmentCategory, string>> = {
  melee: '近接',
  armor: '防具',
  ranged: '遠距離',
  artifact: 'アーティファクト',
}

const raritySearchLabels: Readonly<Record<InventoryGridItem['rarity'], string>> = {
  common: 'コモン common',
  rare: 'レア rare',
  unique: 'ユニーク unique',
  unrecorded: '未記録 unrecorded',
}

export function inventoryGridItemMatchesQuery(item: InventoryGridItem, query: string): boolean {
  const normalizedQuery = query.trim().toLocaleLowerCase()
  if (!normalizedQuery) return true

  const enchantmentIds = new Set([
    ...item.enchantmentSlots.flatMap((slot) => [
      ...slot.candidates,
      ...(slot.selected ? [slot.selected.enchantmentId] : []),
    ]),
    ...item.researchEnchantmentIds,
    ...(item.gildedEnchantment ? [item.gildedEnchantment.enchantmentId] : []),
    ...item.catalog.builtInEnchantments.map((enchantment) => enchantment.enchantmentId),
  ])
  const enchantmentTerms = [...enchantmentIds].flatMap((id) => {
    const enchantment = resolveEnchantment(id)
    return [id, enchantment?.name.ja, enchantment?.name.en]
  })
  const searchableText = [
    item.instanceId,
    item.catalogId,
    item.category,
    categorySearchLabels[item.category],
    item.catalog.name.ja,
    item.catalog.name.en,
    'Power',
    String(item.powerLevel),
    item.rarity,
    raritySearchLabels[item.rarity],
    item.gilded ? 'gilded gold 金色' : 'standard 通常',
    item.isFavorite ? 'お気に入り favorite' : undefined,
    item.notes,
    ...item.enchantments,
    ...enchantmentTerms,
  ].filter((term): term is string => Boolean(term)).join(' ').toLocaleLowerCase()

  return searchableText.includes(normalizedQuery)
}

export function inventoryGridItemMatchesFilters(item: InventoryGridItem, filters: InventoryGridFilters): boolean {
  if (filters.favoritesOnly && !item.isFavorite) return false
  if (filters.category !== 'all' && item.category !== filters.category) return false
  if (filters.gilded !== 'all' && (filters.gilded === 'gilded') !== item.gilded) return false

  const { powerMinimum, powerMaximum } = filters
  if (powerMinimum !== null && (!Number.isFinite(powerMinimum) || powerMinimum < 0 || item.powerLevel < powerMinimum)) return false
  if (powerMaximum !== null && (!Number.isFinite(powerMaximum) || powerMaximum < 0 || item.powerLevel > powerMaximum)) return false
  if (powerMinimum !== null && powerMaximum !== null && powerMinimum > powerMaximum) return false

  return inventoryGridItemMatchesQuery(item, filters.query)
}

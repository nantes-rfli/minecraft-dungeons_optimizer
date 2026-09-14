import type { ArtifactId, CatalogInventoryItem, EnchantmentTier, EquipmentCategory, Inventory, OwnedArtifact, OwnedEnchantmentSlot, OwnedWeapon, WeaponId } from '../core'
import type { ArmorId, OwnedArmor } from '../core/armor'
import type { OwnedRangedWeapon } from '../core/rangedTypes'
import { ARMORS } from '../data/armors'
import { ARTIFACTS } from '../data/artifacts'
import { ENCHANTMENTS } from '../data/enchantments'
import { EQUIPMENT_CATALOG, getEquipmentCatalogEntry, type EquipmentCatalogEntry } from '../data/equipmentCatalog'
import { RANGED_WEAPONS } from '../data/ranged'
import { WEAPONS } from '../data/weapons'

export const equipmentKey = (category: EquipmentCategory, id: string): string => `${category}:${id}`

export function ownedEquipmentKeys(inventory: Inventory): Set<string> {
  return new Set([
    ...inventory.weapons.map((item) => equipmentKey('melee', item.weaponId)),
    ...(inventory.armors ?? []).map((item) => equipmentKey('armor', item.armorId)),
    ...(inventory.rangedWeapons ?? []).map((item) => equipmentKey('ranged', item.weaponId)),
    ...inventory.artifacts.map((item) => equipmentKey('artifact', item.artifactId)),
    ...(inventory.catalogItems ?? []).map((item) => equipmentKey(item.category, item.catalogId)),
  ])
}

export function collectionSummary(inventory: Inventory) {
  const owned = ownedEquipmentKeys(inventory)
  const categories = (['melee', 'armor', 'ranged', 'artifact'] as const).map((category) => {
    const entries = EQUIPMENT_CATALOG.filter((item) => item.category === category)
    const collected = entries.filter((item) => owned.has(equipmentKey(category, item.id))).length
    return { category, collected, total: entries.length }
  })
  return {
    collected: EQUIPMENT_CATALOG.filter((item) => owned.has(equipmentKey(item.category, item.id))).length,
    total: EQUIPMENT_CATALOG.length,
    categories,
    missing: EQUIPMENT_CATALOG.filter((item) => !owned.has(equipmentKey(item.category, item.id))),
  }
}

export interface InventoryStatistics {
  readonly totalItems: number
  readonly collectedTypes: number
  readonly totalTypes: number
  readonly gildedItems: number
  readonly gildedRate: number
  readonly duplicateTypes: readonly { category: EquipmentCategory; id: string; name: string; count: number }[]
  readonly powerDistribution: readonly { label: string; count: number }[]
  readonly enchantments: readonly { id: string; name: string; count: number }[]
  readonly missing: readonly EquipmentCatalogEntry[]
}

export function inventoryStatistics(inventory: Inventory): InventoryStatistics {
  const summary = collectionSummary(inventory)
  const instances = [
    ...inventory.weapons.map((item) => ({ category: 'melee' as const, id: item.weaponId, power: item.powerLevel, gilded: Boolean(item.gilded) })),
    ...(inventory.armors ?? []).map((item) => ({ category: 'armor' as const, id: item.armorId, power: item.powerLevel, gilded: Boolean(item.gilded) })),
    ...(inventory.rangedWeapons ?? []).map((item) => ({ category: 'ranged' as const, id: item.weaponId, power: item.powerLevel, gilded: Boolean(item.gilded) })),
    ...inventory.artifacts.map((item) => ({ category: 'artifact' as const, id: item.artifactId, power: item.powerLevel, gilded: false })),
    ...(inventory.catalogItems ?? []).map((item) => ({
      category: item.category,
      id: item.catalogId,
      power: item.powerLevel,
      gilded: Boolean(item.research?.enchantments?.some((enchantment) => enchantment.source === 'gilded')),
    })),
  ]
  const counts = new Map<string, number>()
  instances.forEach((item) => counts.set(equipmentKey(item.category, item.id), (counts.get(equipmentKey(item.category, item.id)) ?? 0) + 1))
  const duplicateTypes = [...counts.entries()].filter(([, count]) => count > 1).map(([key, count]) => {
    const [category, ...idParts] = key.split(':')
    const id = idParts.join(':')
    const catalog = getEquipmentCatalogEntry(category as EquipmentCategory, id)
    return { category: category as EquipmentCategory, id, name: catalog?.name.ja ?? catalog?.name.en ?? id, count }
  }).sort((left, right) => right.count - left.count || left.name.localeCompare(right.name, 'ja'))
  const powerBands = [
    { label: '1–99', min: 1, max: 99 },
    { label: '100–199', min: 100, max: 199 },
    { label: '200–249', min: 200, max: 249 },
    { label: '250–263', min: 250, max: 263 },
    { label: '264+', min: 264, max: Number.POSITIVE_INFINITY },
  ]
  const enchantmentCounts = new Map<string, number>()
  const countEnchant = (id: string) => enchantmentCounts.set(id, (enchantmentCounts.get(id) ?? 0) + 1)
  inventory.weapons.forEach((item) => { item.enchantmentSlots.forEach((slot) => { if (slot.selected) countEnchant(slot.selected.enchantmentId) }); if (item.gilded) countEnchant(item.gilded.enchantmentId) })
  ;(inventory.armors ?? []).forEach((item) => { item.enchantmentSlots.forEach((slot) => { if (slot.selected) countEnchant(slot.selected.enchantmentId) }); if (item.gilded) countEnchant(item.gilded.enchantmentId) })
  ;(inventory.rangedWeapons ?? []).forEach((item) => { item.enchantmentSlots.forEach((slot) => { if (slot.selected) countEnchant(slot.selected.enchantmentId) }); if (item.gilded) countEnchant(item.gilded.enchantmentId) })
  ;(inventory.catalogItems ?? []).forEach((item) => {
    if (item.enchantmentSlots) item.enchantmentSlots.forEach((slot) => { if (slot.selected) countEnchant(slot.selected.enchantmentId) })
    else item.research?.enchantments?.filter((enchantment) => enchantment.source === 'slot').forEach((enchantment) => countEnchant(enchantment.enchantmentId))
    if (item.gilded) countEnchant(item.gilded.enchantmentId)
    else item.research?.enchantments?.filter((enchantment) => enchantment.source === 'gilded').forEach((enchantment) => countEnchant(enchantment.enchantmentId))
  })
  const gildedItems = instances.filter((item) => item.gilded).length
  return {
    totalItems: instances.length,
    collectedTypes: summary.collected,
    totalTypes: summary.total,
    gildedItems,
    gildedRate: instances.length === 0 ? 0 : gildedItems / instances.length,
    duplicateTypes,
    powerDistribution: powerBands.map((band) => ({ label: band.label, count: instances.filter((item) => item.power >= band.min && item.power <= band.max).length })),
    enchantments: [...enchantmentCounts.entries()].map(([id, count]) => ({ id, name: ENCHANTMENTS[id as keyof typeof ENCHANTMENTS]?.name.ja ?? id, count })).sort((left, right) => right.count - left.count || left.name.localeCompare(right.name, 'ja')),
    missing: summary.missing,
  }
}

export function addEquipmentToInventory(inventory: Inventory, selected: EquipmentCatalogEntry, instanceId: string, powerLevel = 251, rarity?: 'common' | 'rare' | 'unique', enchantment?: { slots: readonly OwnedEnchantmentSlot<string>[]; gilded?: { enchantmentId: string; tier: EnchantmentTier } }): Inventory {
  if (selected.category === 'melee' && selected.id in WEAPONS) {
    const weapon: OwnedWeapon = {
      instanceId, weaponId: selected.id as WeaponId, powerLevel, ...(rarity ? { rarity } : {}),
      enchantmentSlots: enchantment?.slots ?? [], ...(enchantment?.gilded ? { gilded: enchantment.gilded } : {}),
    }
    return { ...inventory, weapons: [...inventory.weapons, weapon] }
  }
  if (selected.category === 'armor' && selected.id in ARMORS) {
    const armor: OwnedArmor = {
      instanceId, armorId: selected.id as ArmorId, powerLevel, observedHealthBonus: 1_880_000, ...(rarity ? { rarity } : {}),
      enchantmentSlots: enchantment?.slots ?? [], ...(enchantment?.gilded ? { gilded: enchantment.gilded } : {}),
    }
    return { ...inventory, armors: [...(inventory.armors ?? []), armor] }
  }
  if (selected.category === 'ranged' && selected.id in RANGED_WEAPONS) {
    const weapon: OwnedRangedWeapon = { instanceId, weaponId: selected.id, powerLevel, enchantmentSlots: enchantment?.slots ?? [], ...(enchantment?.gilded ? { gilded: enchantment.gilded } : {}), ...(rarity ? { rarity } : {}) }
    return { ...inventory, rangedWeapons: [...(inventory.rangedWeapons ?? []), weapon] }
  }
  if (selected.category === 'artifact' && selected.id in ARTIFACTS) {
    const artifact: OwnedArtifact = { instanceId, artifactId: selected.id as ArtifactId, powerLevel, ...(rarity ? { rarity } : {}) }
    return { ...inventory, artifacts: [...inventory.artifacts, artifact] }
  }
  const item: CatalogInventoryItem = { instanceId, category: selected.category, catalogId: selected.id, powerLevel, ...(rarity ? { rarity } : {}), ...(selected.category !== 'artifact' && enchantment?.slots ? { enchantmentSlots: enchantment.slots } : {}), ...(selected.category !== 'artifact' && enchantment?.gilded ? { gilded: enchantment.gilded } : {}) }
  return { ...inventory, catalogItems: [...(inventory.catalogItems ?? []), item] }
}

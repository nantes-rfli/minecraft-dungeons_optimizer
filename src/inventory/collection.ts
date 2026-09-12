import type { ArtifactId, CatalogInventoryItem, EquipmentCategory, Inventory, OwnedArtifact, OwnedWeapon, WeaponId } from '../core'
import type { ArmorId, OwnedArmor } from '../core/armor'
import type { OwnedRangedWeapon } from '../core/rangedTypes'
import { ARMORS } from '../data/armors'
import { ARTIFACTS } from '../data/artifacts'
import { EQUIPMENT_CATALOG, type EquipmentCatalogEntry } from '../data/equipmentCatalog'
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

export function addEquipmentToInventory(inventory: Inventory, selected: EquipmentCatalogEntry, instanceId: string): Inventory {
  if (selected.category === 'melee' && selected.id in WEAPONS) {
    const weapon: OwnedWeapon = {
      instanceId, weaponId: selected.id as WeaponId, powerLevel: 251,
      enchantmentSlots: [{ candidates: ['critical-hit', 'radiance'] }, { candidates: ['leeching', 'guarding-strike'] }, { candidates: ['void-strike', 'critical-hit'] }],
    }
    return { ...inventory, weapons: [...inventory.weapons, weapon] }
  }
  if (selected.category === 'armor' && selected.id in ARMORS) {
    const armor: OwnedArmor = {
      instanceId, armorId: selected.id as ArmorId, powerLevel: 251, observedHealthBonus: 1_880_000,
      enchantmentSlots: [{ candidates: [{ enchantmentId: 'cool-down', tier: 3 }, { enchantmentId: 'potion-barrier', tier: 3 }, { enchantmentId: 'chilling', tier: 3 }] }],
    }
    return { ...inventory, armors: [...(inventory.armors ?? []), armor] }
  }
  if (selected.category === 'ranged' && selected.id in RANGED_WEAPONS) {
    const weapon: OwnedRangedWeapon = { instanceId, weaponId: selected.id, powerLevel: 251, enchantmentSlots: [] }
    return { ...inventory, rangedWeapons: [...(inventory.rangedWeapons ?? []), weapon] }
  }
  if (selected.category === 'artifact' && selected.id in ARTIFACTS) {
    const artifact: OwnedArtifact = { instanceId, artifactId: selected.id as ArtifactId, powerLevel: 251 }
    return { ...inventory, artifacts: [...inventory.artifacts, artifact] }
  }
  const item: CatalogInventoryItem = { instanceId, category: selected.category, catalogId: selected.id, powerLevel: 251 }
  return { ...inventory, catalogItems: [...(inventory.catalogItems ?? []), item] }
}

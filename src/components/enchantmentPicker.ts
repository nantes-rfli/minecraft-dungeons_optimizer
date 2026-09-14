import type { OwnedEnchantmentSlot } from '../core/types'
import { ENCHANTMENT_CATALOG, type EnchantmentCatalogCategory } from '../data/enchantmentCatalog'

export function availableEnchantments(category: EnchantmentCatalogCategory, soulGear: boolean, availability: 'normalSlot' | 'gilded') {
  return ENCHANTMENT_CATALOG.filter((entry) => entry.applicableCategories.includes(category) && entry.availability[availability] && (!entry.soulGearOnly || soulGear))
}

export function addEnchantmentCandidate(slots: readonly OwnedEnchantmentSlot<string>[], slotIndex: number, enchantmentId: string): readonly OwnedEnchantmentSlot<string>[] {
  if (slotIndex === slots.length && slots.length < 3) return [...slots, { candidates: [enchantmentId] }]
  return slots.map((slot, current) => current !== slotIndex || slot.candidates.includes(enchantmentId) || slot.candidates.length >= 3 ? slot : { ...slot, candidates: [...slot.candidates, enchantmentId] })
}

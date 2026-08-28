import type {
  EnchantmentId,
  EnchantmentTier,
  GildedEnchantment,
} from '../core'

export const DEFAULT_GILDED_ENCHANTMENT: GildedEnchantment = {
  enchantmentId: 'critical-hit',
  tier: 3,
}

export function changeGildedEnchantment(
  gilded: GildedEnchantment,
  enchantmentId: EnchantmentId,
): GildedEnchantment {
  return { ...gilded, enchantmentId }
}

export function changeGildedTier(
  gilded: GildedEnchantment,
  tier: EnchantmentTier,
): GildedEnchantment {
  return { ...gilded, tier }
}

import { getEnchantmentDefinition } from './catalog'
import type {
  EnchantmentId,
  EnchantmentTierValues,
  SelectedEnchantment,
} from './types'

export function enchantmentsById(
  enchantments: readonly SelectedEnchantment[],
  enchantmentId: EnchantmentId,
): SelectedEnchantment[] {
  return enchantments.filter((selected) => selected.enchantmentId === enchantmentId)
}

export function hasEnchantment(
  enchantments: readonly SelectedEnchantment[],
  enchantmentId: EnchantmentId,
): boolean {
  return enchantmentsById(enchantments, enchantmentId).length > 0
}

export function getTierValues(selected: SelectedEnchantment): EnchantmentTierValues {
  return getEnchantmentDefinition(selected.enchantmentId).tiers.value[selected.tier]
}

export function hasValidEnchantmentStacking(
  enchantments: readonly SelectedEnchantment[],
): boolean {
  const counts = new Map<EnchantmentId, number>()
  for (const selected of enchantments) {
    const count = (counts.get(selected.enchantmentId) ?? 0) + 1
    if (count > getEnchantmentDefinition(selected.enchantmentId).stacking.value.maxCopies) {
      return false
    }
    counts.set(selected.enchantmentId, count)
  }
  return true
}

export function combineEnchantmentValues(
  enchantments: readonly SelectedEnchantment[],
  enchantmentId: EnchantmentId,
  valueForTier: (values: EnchantmentTierValues) => number,
): number {
  const definition = getEnchantmentDefinition(enchantmentId)
  const values = enchantmentsById(enchantments, enchantmentId)
    .map((selected) => valueForTier(getTierValues(selected)))
    .sort((left, right) => right - left)
  if (values.length === 0) return 0

  switch (definition.stacking.value.behavior) {
    case 'non-stackable':
      return values[0]!
    case 'additive':
      return values.reduce((sum, value) => sum + value, 0)
    case 'multiplicative':
      return values.reduce((product, value) => product * (1 + value), 1) - 1
    case 'special': {
      const copyEffectMultipliers = definition.stacking.value.copyEffectMultipliers
      const additionalCopyMultiplier =
        definition.stacking.value.additionalCopyMultiplier ?? 1
      return values.reduce(
        (sum, value, index) => sum + value * (
          copyEffectMultipliers?.[index] ?? additionalCopyMultiplier ** index
        ),
        0,
      )
    }
  }
}

export function combineDirectWeaponBonuses(
  enchantments: readonly SelectedEnchantment[],
  enchantmentId: EnchantmentId,
): number {
  return combineEnchantmentValues(enchantments, enchantmentId, (values) => {
    if (!values.directWeaponEffect) {
      throw new Error(`Missing direct weapon effect for ${enchantmentId}`)
    }
    return values.directWeaponEffect.bonus
  })
}

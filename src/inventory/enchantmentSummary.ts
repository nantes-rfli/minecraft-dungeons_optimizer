import type { OwnedEnchantmentSlot } from '../core'
import { resolveEnchantment } from '../data/enchantmentCatalog'

export function selectedEnchantmentSummary(slots: readonly OwnedEnchantmentSlot<string>[] = []): string {
  const names = slots.flatMap((slot) => {
    if (!slot.selected) return []
    const enchantment = resolveEnchantment(slot.selected.enchantmentId)
    return [enchantment?.name.ja ?? enchantment?.name.en ?? slot.selected.enchantmentId]
  })
  return names.join(' · ') || '選択済みEnchantなし'
}

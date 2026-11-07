import source from '../../research/sources/fixed-observed-melee-combo-source.json' with { type: 'json' }
import type { SelectedEnchantment } from '../core/types'

export const FIXED_OBSERVED_MELEE_COMBO_IDS = ['cackling-broom', 'dark-katana', 'grave-bane', 'hawkbrand', 'sinister-sword'] as const
export type FixedObservedMeleeComboId = (typeof FIXED_OBSERVED_MELEE_COMBO_IDS)[number]
export const isFixedObservedMeleeComboId = (id: string): id is FixedObservedMeleeComboId =>
  (FIXED_OBSERVED_MELEE_COMBO_IDS as readonly string[]).includes(id)

export const FIXED_OBSERVED_MELEE_COMBO_SOURCE = source
export const FIXED_OBSERVED_MELEE_COMBO_EFFECTS = {
  'cackling-broom': 'smiting',
  'dark-katana': 'smiting',
  'grave-bane': 'smiting',
  hawkbrand: 'critical-hit',
  'sinister-sword': 'critical-hit',
} as const

export function fixedObservedMeleeComboEnchantments(id: string): readonly SelectedEnchantment[] {
  return isFixedObservedMeleeComboId(id)
    ? [{ enchantmentId: FIXED_OBSERVED_MELEE_COMBO_EFFECTS[id], tier: 1, source: 'built-in' }]
    : []
}

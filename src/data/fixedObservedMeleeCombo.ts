import source from '../../research/sources/fixed-observed-melee-combo-source.json' with { type: 'json' }
import sharpnessSource from '../../research/sources/observed-sharpness-combo-source.json' with { type: 'json' }
import type { SelectedEnchantment } from '../core/types'

export const CONDITIONAL_OBSERVED_MELEE_COMBO_IDS = ['cackling-broom', 'dark-katana', 'grave-bane', 'hawkbrand', 'sinister-sword'] as const
export const SHARPNESS_OBSERVED_MELEE_COMBO_ID = 'diamond-sword'
export const FIXED_OBSERVED_MELEE_COMBO_IDS = [...CONDITIONAL_OBSERVED_MELEE_COMBO_IDS, SHARPNESS_OBSERVED_MELEE_COMBO_ID] as const
export type FixedObservedMeleeComboId = (typeof FIXED_OBSERVED_MELEE_COMBO_IDS)[number]
export const isFixedObservedMeleeComboId = (id: string): id is FixedObservedMeleeComboId =>
  (FIXED_OBSERVED_MELEE_COMBO_IDS as readonly string[]).includes(id)

export const FIXED_OBSERVED_MELEE_COMBO_SOURCE = source
export const SHARPNESS_OBSERVED_MELEE_COMBO_SOURCE = sharpnessSource
export const CONDITIONAL_OBSERVED_MELEE_COMBO_EFFECTS = {
  'cackling-broom': 'smiting',
  'dark-katana': 'smiting',
  'grave-bane': 'smiting',
  hawkbrand: 'critical-hit',
  'sinister-sword': 'critical-hit',
} as const

const fixedEffects = { ...CONDITIONAL_OBSERVED_MELEE_COMBO_EFFECTS, [SHARPNESS_OBSERVED_MELEE_COMBO_ID]: 'sharpness' } as const

export function fixedObservedMeleeComboEnchantments(id: string): readonly SelectedEnchantment[] {
  return isFixedObservedMeleeComboId(id)
    ? [{ enchantmentId: fixedEffects[id], tier: 1, source: 'built-in' }]
    : []
}

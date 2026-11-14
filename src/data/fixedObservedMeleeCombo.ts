import source from '../../research/sources/fixed-observed-melee-combo-source.json' with { type: 'json' }
import sharpnessSource from '../../research/sources/observed-sharpness-combo-source.json' with { type: 'json' }
import radianceSource from '../../research/sources/observed-radiance-combo-source.json' with { type: 'json' }
import freezingSource from '../../research/sources/observed-freezing-scythes.json' with { type: 'json' }
import poisonCloudSource from '../../research/sources/observed-poison-cloud-melee.json' with { type: 'json' }
import weakeningSource from '../../research/sources/observed-weakening-blade.json' with { type: 'json' }
import committedSource from '../../research/sources/observed-committed-knife.json' with { type: 'json' }
import soulSiphonSource from '../../research/sources/observed-soul-siphon-knife.json' with { type: 'json' }
import type { SelectedEnchantment } from '../core/types'

export const CONDITIONAL_OBSERVED_MELEE_COMBO_IDS = ['cackling-broom', 'dark-katana', 'grave-bane', 'hawkbrand', 'sinister-sword'] as const
export const SHARPNESS_OBSERVED_MELEE_COMBO_ID = 'diamond-sword'
export const RADIANCE_OBSERVED_MELEE_COMBO_ID = 'suns-grace'
export const FREEZING_OBSERVED_MELEE_COMBO_IDS = ['frost-scythe', 'skull-scythe'] as const
export const POISON_CLOUD_OBSERVED_MELEE_COMBO_IDS = ['nightmares-bite', 'venom-glaive'] as const
export const WEAKENING_OBSERVED_MELEE_COMBO_ID = 'nameless-blade'
export const COMMITTED_OBSERVED_MELEE_COMBO_ID = 'truthseeker'
export const SOUL_SIPHON_OBSERVED_MELEE_COMBO_ID = 'eternal-knife'
export const SOUL_OBSERVED_MELEE_COMBO_IDS = [...FREEZING_OBSERVED_MELEE_COMBO_IDS, COMMITTED_OBSERVED_MELEE_COMBO_ID, SOUL_SIPHON_OBSERVED_MELEE_COMBO_ID] as const
export const isSoulObservedMeleeComboId = (id: string): boolean => (SOUL_OBSERVED_MELEE_COMBO_IDS as readonly string[]).includes(id)
export const FIXED_OBSERVED_MELEE_COMBO_IDS = [...CONDITIONAL_OBSERVED_MELEE_COMBO_IDS, SHARPNESS_OBSERVED_MELEE_COMBO_ID, RADIANCE_OBSERVED_MELEE_COMBO_ID, ...FREEZING_OBSERVED_MELEE_COMBO_IDS, ...POISON_CLOUD_OBSERVED_MELEE_COMBO_IDS, WEAKENING_OBSERVED_MELEE_COMBO_ID, COMMITTED_OBSERVED_MELEE_COMBO_ID, SOUL_SIPHON_OBSERVED_MELEE_COMBO_ID] as const
export type FixedObservedMeleeComboId = (typeof FIXED_OBSERVED_MELEE_COMBO_IDS)[number]
export const isFixedObservedMeleeComboId = (id: string): id is FixedObservedMeleeComboId =>
  (FIXED_OBSERVED_MELEE_COMBO_IDS as readonly string[]).includes(id)

export const FIXED_OBSERVED_MELEE_COMBO_SOURCE = source
export const SHARPNESS_OBSERVED_MELEE_COMBO_SOURCE = sharpnessSource
export const RADIANCE_OBSERVED_MELEE_COMBO_SOURCE = radianceSource
export const FREEZING_OBSERVED_MELEE_COMBO_SOURCE = freezingSource
export const POISON_CLOUD_OBSERVED_MELEE_COMBO_SOURCE = poisonCloudSource
export const WEAKENING_OBSERVED_MELEE_COMBO_SOURCE = weakeningSource
export const COMMITTED_OBSERVED_MELEE_COMBO_SOURCE = committedSource
export const SOUL_SIPHON_OBSERVED_MELEE_COMBO_SOURCE = soulSiphonSource
export const isFreezingObservedMeleeComboId = (id: string): boolean => (FREEZING_OBSERVED_MELEE_COMBO_IDS as readonly string[]).includes(id)
export const isPoisonCloudObservedMeleeComboId = (id: string): boolean => (POISON_CLOUD_OBSERVED_MELEE_COMBO_IDS as readonly string[]).includes(id)
export const CONDITIONAL_OBSERVED_MELEE_COMBO_EFFECTS = {
  'cackling-broom': 'smiting',
  'dark-katana': 'smiting',
  'grave-bane': 'smiting',
  hawkbrand: 'critical-hit',
  'sinister-sword': 'critical-hit',
} as const

const fixedEffects = {
  ...CONDITIONAL_OBSERVED_MELEE_COMBO_EFFECTS,
  [SHARPNESS_OBSERVED_MELEE_COMBO_ID]: 'sharpness', [RADIANCE_OBSERVED_MELEE_COMBO_ID]: 'radiance',
  'frost-scythe': 'freezing', 'skull-scythe': 'freezing',
  'nightmares-bite': 'poison-cloud', 'venom-glaive': 'poison-cloud',
  'nameless-blade': 'weakening', truthseeker: 'committed', 'eternal-knife': 'soul-siphon',
} as const

export function fixedObservedMeleeComboEnchantments(id: string): readonly SelectedEnchantment[] {
  return isFixedObservedMeleeComboId(id)
    ? [{ enchantmentId: fixedEffects[id], tier: 1, source: 'built-in' }]
    : []
}

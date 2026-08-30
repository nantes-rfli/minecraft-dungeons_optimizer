import type { Evidence } from '../core/types'
import { MVP_MODEL_SOURCE, UNCHANTING_SOURCE } from './sources'

export const UNCHANTING_TARGET_CONDITION: Evidence<'enchanted-enemy'> = {
  value: 'enchanted-enemy',
  source: UNCHANTING_SOURCE,
  confidence: 'high',
  note: 'Only enchanted targets receive the tier bonus; no boss-profile override.',
}

export const DIRECT_WEAPON_COMPOSITION: Evidence<'independent-multipliers'> = {
  value: 'independent-multipliers',
  source: MVP_MODEL_SOURCE,
  confidence: 'low',
  note: 'Direct melee only: Sharpness × Critical expectation × Void expectation × Unchanting × Smiting × Ambush, then Committed health trajectory with independent proc context. Tier/stacking references do not independently verify all 1.17.0.0 interactions. Crit, hit interval, enemy conditions and health are factorized. No Strength, armor damage aura, proc or DoT amplification is implied.',
}

export const UNCHANTING_MIXTURE: Evidence<'equal-baseline-damage'> = {
  value: 'equal-baseline-damage',
  source: MVP_MODEL_SOURCE,
  confidence: 'low',
  note: 'Expected multiplier = 1 + enchantedShare × tierBonus. Ignores enemy HP differences, enchanted HP bias, target priority, encounter sequencing and target switching.',
}

import type { Evidence, SourceReference } from '../core/types'
import { MVP_MODEL_SOURCE } from './sources'

export const AMBUSH_SOURCE: SourceReference = {
  id: 'dungeons-tools-ambush', label: 'dungeons.tools: Ambush (1.17.0.0)',
  url: 'https://www.dungeons.tools/enchantments/ambush', kind: 'game-files',
}
export const SMITING_SOURCE: SourceReference = {
  id: 'dungeons-tools-smiting', label: 'dungeons.tools: Smiting (1.17.0.0)',
  url: 'https://www.dungeons.tools/enchantments/smiting', kind: 'game-files',
}
export const COMMITTED_SOURCE: SourceReference = {
  id: 'dungeons-tools-committed', label: 'dungeons.tools: Committed (1.17.0.0)',
  url: 'https://www.dungeons.tools/enchantments/committed', kind: 'game-files',
}
export const SMITING_STACKING_SOURCE: SourceReference = {
  id: 'minecraft-wiki-smiting-stacking', label: 'Minecraft Wiki: Smiting stacking / Enchantsmith / 1.16.2.0 history',
  url: 'https://minecraft.wiki/w/Dungeons:Smiting', kind: 'published-reference',
}
export const AMBUSH_VERSION: Evidence<string> = {
  value: '1.16.2.0: 15/30/45 -> 20/40/60', confidence: 'high',
  source: { id: 'minecraft-wiki-ambush-history', label: 'Minecraft Wiki: Ambush history', url: 'https://minecraft.wiki/w/Dungeons:Ambush', kind: 'published-reference' },
}
export const SMITING_VERSION: Evidence<string> = {
  value: '1.16.2.0: 20/30/40 -> 25/35/45', confidence: 'high', source: SMITING_STACKING_SOURCE,
}
export const AMBUSH_TARGET_CONDITION: Evidence<'not-targeting-hero'> = {
  value: 'not-targeting-hero', source: AMBUSH_SOURCE, confidence: 'high',
}
export const SMITING_TARGET_CONDITION: Evidence<'undead-enemy'> = {
  value: 'undead-enemy', source: SMITING_SOURCE, confidence: 'high',
}
export const CONDITIONAL_STATE_FACTORIZATION: Evidence<string> = {
  value: 'independent-condition-exposures', source: MVP_MODEL_SOURCE, confidence: 'low',
  note: 'Multiplies expected enchanted, undead and targeting modifiers, ignoring their joint distribution. Same-condition copies are combined BEFORE expectation. Not exact cross-condition simulation.',
}
export const COMMITTED_HEALTH_SCALING: Evidence<string> = {
  value: 'linear-with-health-lost', confidence: 'high',
  source: { id: 'minecraft-wiki-committed-health', label: 'Minecraft Wiki: Committed health-lost mechanics', url: 'https://minecraft.wiki/w/Dungeons:Committed', kind: 'published-reference' },
  note: 'Full HP gives zero; Tier III at 50% health lost gives +50%. Wiki prose says 44.25% while its 1/ln(2) formula gives 44.2695%; runtime uses the derived formula, not the rounded prose.',
}
export const COMMITTED_ANALYTIC_INTEGRATION: Evidence<string> = {
  value: 'continuous-health-trajectory-integral', source: MVP_MODEL_SOURCE, confidence: 'high',
  note: 'Mathematically derived and independently numerically integrated in tests; this confidence is about the integral ONLY, not real combat accuracy.',
}
export const COMMITTED_FRESH_TARGET: Evidence<string> = {
  value: 'fresh-target-to-defeat', source: MVP_MODEL_SOURCE, confidence: 'low',
  note: 'Starts at full HP and continues until defeat under constant rates. Excludes incomplete encounters, switching, burst, overkill and discrete hits; can undervalue already-wounded targets / co-op focus fire.',
}
export const COMMITTED_AOE_TRAJECTORY: Evidence<string> = {
  value: 'homogeneous-aggregate-target-health', source: MVP_MODEL_SOURCE, confidence: 'low',
  note: 'Applies the integral separately to aggregate direct/proc AoE rates; no per-enemy HP or hit/proc coverage distribution.',
}

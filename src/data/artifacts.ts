import type { ArtifactDefinition, ArtifactId } from '../core/types'
import {
  COMMUNITY_ARTIFACT_STACKING_SOURCE,
  MINECRAFT_WIKI_DEATH_CAP_SOURCE,
  MINECRAFT_WIKI_IRON_HIDE_SOURCE,
} from './sources'

export const ARTIFACTS: Readonly<Record<ArtifactId, ArtifactDefinition>> = {
  'death-cap-mushroom': {
    id: 'death-cap-mushroom',
    name: { ja: 'シロタマゴテングタケ', en: 'Death Cap Mushroom' },
    cooldownSeconds: {
      value: 30,
      source: MINECRAFT_WIKI_DEATH_CAP_SOURCE,
      confidence: 'high',
    },
    durationIntercept: {
      value: 8,
      source: MINECRAFT_WIKI_DEATH_CAP_SOURCE,
      confidence: 'medium',
      note: 'Community-derived duration formula: 0.052 × power + 8.',
    },
    durationPerPower: {
      value: 0.052,
      source: MINECRAFT_WIKI_DEATH_CAP_SOURCE,
      confidence: 'medium',
    },
    attackSpeedBonus: {
      value: 1,
      source: MINECRAFT_WIKI_DEATH_CAP_SOURCE,
      confidence: 'high',
    },
    stacking: {
      value: { maxCopies: 3, behavior: 'refresh' },
      source: COMMUNITY_ARTIFACT_STACKING_SOURCE,
      confidence: 'low',
      note: 'Duplicate buffs do not increase attack speed; optimal staggered activation is modeled.',
    },
  },
  'iron-hide-amulet': {
    id: 'iron-hide-amulet',
    name: { ja: 'アイアンハイドアミュレット', en: 'Iron Hide Amulet' },
    cooldownSeconds: {
      value: 25,
      source: MINECRAFT_WIKI_IRON_HIDE_SOURCE,
      confidence: 'high',
    },
    durationIntercept: {
      value: 8,
      source: MINECRAFT_WIKI_IRON_HIDE_SOURCE,
      confidence: 'low',
      note: 'Linear fit from published duration samples; requires in-game verification.',
    },
    durationPerPower: {
      value: 0.052,
      source: MINECRAFT_WIKI_IRON_HIDE_SOURCE,
      confidence: 'low',
      note: 'Linear fit from published duration samples; requires in-game verification.',
    },
    damageReduction: {
      value: 0.5,
      source: MINECRAFT_WIKI_IRON_HIDE_SOURCE,
      confidence: 'medium',
    },
    stacking: {
      value: { maxCopies: 3, behavior: 'refresh' },
      source: COMMUNITY_ARTIFACT_STACKING_SOURCE,
      confidence: 'low',
      note: 'Duplicate buffs do not exceed 50% reduction; optimal staggered activation is modeled.',
    },
  },
}

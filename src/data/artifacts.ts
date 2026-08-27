import type { ArtifactDefinition, ArtifactId } from '../core/types'
import {
  MINECRAFT_WIKI_DEATH_CAP_SOURCE,
  MINECRAFT_WIKI_IRON_HIDE_SOURCE,
} from './sources'

export const ARTIFACTS: Readonly<Record<ArtifactId, ArtifactDefinition>> = {
  'death-cap-mushroom': {
    id: 'death-cap-mushroom',
    name: 'Death Cap Mushroom',
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
  },
  'iron-hide-amulet': {
    id: 'iron-hide-amulet',
    name: 'Iron Hide Amulet',
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
  },
}

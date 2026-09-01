import type { ArtifactDefinition, ArtifactId } from '../core/types'
import {
  COMMUNITY_ARTIFACT_STACKING_SOURCE,
  MINECRAFT_WIKI_DEATH_CAP_SOURCE,
  MINECRAFT_WIKI_IRON_HIDE_SOURCE,
  MINECRAFT_WIKI_SHOCK_POWDER_SOURCE,
} from './sources'

export const ARTIFACTS = {
  'death-cap-mushroom': {
    id: 'death-cap-mushroom',
    name: { ja: 'シロタマゴテングタケ', en: 'Death Cap Mushroom' },
    cooldownSeconds: {
      value: 30,
      source: MINECRAFT_WIKI_DEATH_CAP_SOURCE,
      confidence: 'high',
    },
    mechanic: 'timed-self-buff',
    use: { kind: 'cooldown-only', cooldownStarts: 'use' },
    duration: {
      kind: 'linear-power',
      intercept: {
        value: 8,
        source: MINECRAFT_WIKI_DEATH_CAP_SOURCE,
        confidence: 'medium',
        note: 'Community-derived duration formula: 0.052 × power + 8.',
      },
      perPower: {
        value: 0.052,
        source: MINECRAFT_WIKI_DEATH_CAP_SOURCE,
        confidence: 'medium',
      },
    },
    effect: {
      kind: 'attack-speed',
      bonus: {
        value: 1,
        source: MINECRAFT_WIKI_DEATH_CAP_SOURCE,
        confidence: 'high',
      },
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
    mechanic: 'timed-self-buff',
    use: { kind: 'cooldown-only', cooldownStarts: 'use' },
    duration: {
      kind: 'linear-power',
      intercept: {
        value: 8,
        source: MINECRAFT_WIKI_IRON_HIDE_SOURCE,
        confidence: 'low',
        note: 'Linear fit from published duration samples; requires in-game verification.',
      },
      perPower: {
        value: 0.052,
        source: MINECRAFT_WIKI_IRON_HIDE_SOURCE,
        confidence: 'low',
        note: 'Linear fit from published duration samples; requires in-game verification.',
      },
    },
    effect: {
      kind: 'damage-reduction',
      reduction: {
        value: 0.5,
        source: MINECRAFT_WIKI_IRON_HIDE_SOURCE,
        confidence: 'medium',
      },
    },
    stacking: {
      value: { maxCopies: 3, behavior: 'refresh' },
      source: COMMUNITY_ARTIFACT_STACKING_SOURCE,
      confidence: 'low',
      note: 'Duplicate buffs do not exceed 50% reduction; optimal staggered activation is modeled.',
    },
  },
  'shock-powder': {
    id: 'shock-powder',
    name: { ja: 'ショックパウダー', en: 'Shock Powder' },
    cooldownSeconds: {
      value: 15,
      source: MINECRAFT_WIKI_SHOCK_POWDER_SOURCE,
      confidence: 'high',
    },
    mechanic: 'hard-control',
    use: { kind: 'cooldown-only', cooldownStarts: 'use' },
    duration: {
      kind: 'published-table',
      supportedPowerRange: { min: 12, max: 262 },
      points: [
        { power: 12, seconds: { value: 3.5, source: MINECRAFT_WIKI_SHOCK_POWDER_SOURCE, confidence: 'medium' } },
        { power: 58, seconds: { value: 5.3, source: MINECRAFT_WIKI_SHOCK_POWDER_SOURCE, confidence: 'medium' } },
        { power: 108, seconds: { value: 7.2, source: MINECRAFT_WIKI_SHOCK_POWDER_SOURCE, confidence: 'medium' } },
        { power: 262, seconds: { value: 13, source: MINECRAFT_WIKI_SHOCK_POWDER_SOURCE, confidence: 'medium' } },
      ],
    },
    effect: {
      kind: 'hard-stun',
      semantics: {
        value: 'movement-and-attacks-disabled',
        source: MINECRAFT_WIKI_SHOCK_POWDER_SOURCE,
        confidence: 'medium',
      },
    },
    stacking: {
      value: { maxCopies: 1, behavior: 'non-stackable' },
      source: MINECRAFT_WIKI_SHOCK_POWDER_SOURCE,
      confidence: 'low',
      note: 'Runtime is limited to one copy because duplicate refresh/overlap behavior is unresolved.',
    },
  },
} as const satisfies Readonly<Record<ArtifactId, ArtifactDefinition>>

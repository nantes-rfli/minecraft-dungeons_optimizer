import type { WeaponDefinition, WeaponId } from '../core/types'
import {
  DUNGEONS_TOOLS_SOURCE,
  MINECRAFT_WIKI_ANCHOR_SOURCE,
  MINECRAFT_WIKI_DOUBLE_AXE_SOURCE,
  MINECRAFT_WIKI_FIGHTERS_BINDINGS_SOURCE,
} from './sources'

export const WEAPONS: Readonly<Record<WeaponId, WeaponDefinition>> = {
  'fighters-bindings': {
    id: 'fighters-bindings',
    name: { ja: '闘士の締め具', en: "Fighter's Bindings" },
    power: { value: 2.0, source: DUNGEONS_TOOLS_SOURCE, confidence: 'high' },
    speed: { value: 14.0, source: DUNGEONS_TOOLS_SOURCE, confidence: 'high' },
    area: { value: 1.4, source: DUNGEONS_TOOLS_SOURCE, confidence: 'high' },
    baseHitDamage: {
      value: 25,
      source: MINECRAFT_WIKI_FIGHTERS_BINDINGS_SOURCE,
      confidence: 'medium',
      note: 'All four published hits use 25. Cross-weapon scaling is provisional: P114 is a 21.3% validation outlier, while P135 and P251 are inside published ranges.',
    },
  },
  'double-axe': {
    id: 'double-axe',
    name: { ja: 'ダブルアックス', en: 'Double Axe' },
    power: { value: 8.7, source: DUNGEONS_TOOLS_SOURCE, confidence: 'high' },
    speed: { value: 2.1, source: DUNGEONS_TOOLS_SOURCE, confidence: 'high' },
    area: { value: 12.9, source: DUNGEONS_TOOLS_SOURCE, confidence: 'high' },
    baseHitDamage: {
      value: 100,
      source: MINECRAFT_WIKI_DOUBLE_AXE_SOURCE,
      confidence: 'medium',
      note: 'Both published hits use 100. The common ratio model stays within 6.23% of 14 published Power ranges.',
    },
  },
  anchor: {
    id: 'anchor',
    name: { ja: 'アンカー', en: 'Anchor' },
    power: { value: 14.0, source: DUNGEONS_TOOLS_SOURCE, confidence: 'high' },
    speed: { value: 1.0, source: DUNGEONS_TOOLS_SOURCE, confidence: 'high' },
    area: { value: 14.0, source: DUNGEONS_TOOLS_SOURCE, confidence: 'high' },
    baseHitDamage: {
      value: 238,
      source: MINECRAFT_WIKI_ANCHOR_SOURCE,
      confidence: 'medium',
      note: 'The published hit uses 238 and defines the Anchor reference curve; it is not independent cross-weapon evidence.',
    },
  },
}

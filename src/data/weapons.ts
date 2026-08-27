import type { WeaponDefinition, WeaponId } from '../core/types'
import { DUNGEONS_TOOLS_SOURCE } from './sources'

export const WEAPONS: Readonly<Record<WeaponId, WeaponDefinition>> = {
  'fighters-bindings': {
    id: 'fighters-bindings',
    name: { ja: '闘士の締め具', en: "Fighter's Bindings" },
    power: { value: 2.0, source: DUNGEONS_TOOLS_SOURCE, confidence: 'high' },
    speed: { value: 14.0, source: DUNGEONS_TOOLS_SOURCE, confidence: 'high' },
    area: { value: 1.4, source: DUNGEONS_TOOLS_SOURCE, confidence: 'high' },
  },
  'double-axe': {
    id: 'double-axe',
    name: { ja: 'ダブルアックス', en: 'Double Axe' },
    power: { value: 8.7, source: DUNGEONS_TOOLS_SOURCE, confidence: 'high' },
    speed: { value: 2.1, source: DUNGEONS_TOOLS_SOURCE, confidence: 'high' },
    area: { value: 12.9, source: DUNGEONS_TOOLS_SOURCE, confidence: 'high' },
  },
  anchor: {
    id: 'anchor',
    name: { ja: 'アンカー', en: 'Anchor' },
    power: { value: 14.0, source: DUNGEONS_TOOLS_SOURCE, confidence: 'high' },
    speed: { value: 1.0, source: DUNGEONS_TOOLS_SOURCE, confidence: 'high' },
    area: { value: 14.0, source: DUNGEONS_TOOLS_SOURCE, confidence: 'high' },
  },
}

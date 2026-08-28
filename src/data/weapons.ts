import type { WeaponDefinition, WeaponId } from '../core/types'
import { DUNGEONS_TOOLS_SOURCE } from './sources'

export const WEAPONS: Readonly<Record<WeaponId, WeaponDefinition>> = {
  'fighters-bindings': {
    id: 'fighters-bindings',
    name: { ja: '闘士の締め具', en: "Fighter's Bindings" },
    internalPowerRating: {
      value: 2.045,
      source: DUNGEONS_TOOLS_SOURCE,
      confidence: 'high',
      note: 'Exact float from the 1.17.0.0 item stat table, before the UI rounds it to the 1–14 scale.',
    },
    speed: { value: 14.0, source: DUNGEONS_TOOLS_SOURCE, confidence: 'high' },
    area: { value: 1.4, source: DUNGEONS_TOOLS_SOURCE, confidence: 'high' },
  },
  'double-axe': {
    id: 'double-axe',
    name: { ja: 'ダブルアックス', en: 'Double Axe' },
    internalPowerRating: {
      value: 8.686,
      source: DUNGEONS_TOOLS_SOURCE,
      confidence: 'high',
      note: 'Exact float from the 1.17.0.0 item stat table, before the UI rounds it to the 1–14 scale.',
    },
    speed: { value: 2.1, source: DUNGEONS_TOOLS_SOURCE, confidence: 'high' },
    area: { value: 12.9, source: DUNGEONS_TOOLS_SOURCE, confidence: 'high' },
  },
  anchor: {
    id: 'anchor',
    name: { ja: 'アンカー', en: 'Anchor' },
    internalPowerRating: {
      value: 14,
      source: DUNGEONS_TOOLS_SOURCE,
      confidence: 'high',
      note: 'Exact float from the 1.17.0.0 item stat table and the reference coefficient for damage scaling.',
    },
    speed: { value: 1.0, source: DUNGEONS_TOOLS_SOURCE, confidence: 'high' },
    area: { value: 14.0, source: DUNGEONS_TOOLS_SOURCE, confidence: 'high' },
  },
}

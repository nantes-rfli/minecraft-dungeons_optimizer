import type { WeaponDefinition, WeaponId } from '../core/types'
import { DUNGEONS_TOOLS_SOURCE } from './sources'
import { SOUL_SCYTHE_SOURCE } from './souls'

export const WEAPONS: Readonly<Record<WeaponId, WeaponDefinition>> = {
  'soul-scythe': {
    id: 'soul-scythe',
    name: { ja: 'ソウルサイス', en: 'Soul Scythe' },
    soul: { acceptsSoulEnchantments: true, baseSoulGathering: { value: 1, source: { ...SOUL_SCYTHE_SOURCE, url: 'https://www.dungeons.tools/weapons/soul-scythe' }, confidence: 'high' } },
    internalPowerRating: { value: 6.915, source: SOUL_SCYTHE_SOURCE, confidence: 'high', note: 'Exact serialized 1.17.0.0 calculator row; common variant without built-in enchantments.' },
    speed: { value: 2.646, source: SOUL_SCYTHE_SOURCE, confidence: 'high' },
    area: { value: 9.425, source: SOUL_SCYTHE_SOURCE, confidence: 'high' },
  },
  'fighters-bindings': {
    id: 'fighters-bindings',
    name: { ja: '闘士の締め具', en: "Fighter's Bindings" },
    soul: { acceptsSoulEnchantments: false, baseSoulGathering: { value: 0, source: DUNGEONS_TOOLS_SOURCE, confidence: 'high' } },
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
    soul: { acceptsSoulEnchantments: false, baseSoulGathering: { value: 0, source: DUNGEONS_TOOLS_SOURCE, confidence: 'high' } },
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
    soul: { acceptsSoulEnchantments: false, baseSoulGathering: { value: 0, source: DUNGEONS_TOOLS_SOURCE, confidence: 'high' } },
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

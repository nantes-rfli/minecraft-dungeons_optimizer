import type { EnchantmentDefinition, EnchantmentId } from '../core/types'
import { MINECRAFT_WIKI_ENCHANTMENTS_SOURCE } from './sources'

const wiki = MINECRAFT_WIKI_ENCHANTMENTS_SOURCE

export const ENCHANTMENTS: Readonly<Record<EnchantmentId, EnchantmentDefinition>> = {
  'critical-hit': {
    id: 'critical-hit',
    name: 'Critical Hit III',
    tier: 3,
    triggerChance: { value: 0.2, source: wiki, confidence: 'high' },
    damageMultiplier: { value: 3, source: wiki, confidence: 'high' },
  },
  radiance: {
    id: 'radiance',
    name: 'Radiance III',
    tier: 3,
    triggerChance: { value: 0.2, source: wiki, confidence: 'high' },
  },
  leeching: {
    id: 'leeching',
    name: 'Leeching III',
    tier: 3,
    healingFraction: { value: 0.09, source: wiki, confidence: 'high' },
  },
  'void-strike': {
    id: 'void-strike',
    name: 'Void Strike III',
    tier: 3,
    maxBonusDamage: { value: 6, source: wiki, confidence: 'high' },
  },
  'guarding-strike': {
    id: 'guarding-strike',
    name: 'Guarding Strike III',
    tier: 3,
    durationSeconds: { value: 4, source: wiki, confidence: 'high' },
    damageReduction: { value: 0.5, source: wiki, confidence: 'high' },
  },
}

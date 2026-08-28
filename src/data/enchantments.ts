import type { EnchantmentDefinition, EnchantmentId } from '../core/types'
import {
  COMMUNITY_RADIANCE_STACKING_SOURCE,
  MINECRAFT_WIKI_ENCHANTMENTS_SOURCE,
} from './sources'

const wiki = MINECRAFT_WIKI_ENCHANTMENTS_SOURCE

export const ENCHANTMENTS: Readonly<Record<EnchantmentId, EnchantmentDefinition>> = {
  'critical-hit': {
    id: 'critical-hit',
    name: { ja: 'クリティカルヒット', en: 'Critical Hit' },
    tiers: {
      value: {
        1: { triggerChance: 0.1, damageMultiplier: 3 },
        2: { triggerChance: 0.15, damageMultiplier: 3 },
        3: { triggerChance: 0.2, damageMultiplier: 3 },
      },
      source: wiki,
      confidence: 'high',
    },
    stacking: {
      value: { maxCopies: 1, behavior: 'non-stackable' },
      source: wiki,
      confidence: 'high',
    },
  },
  radiance: {
    id: 'radiance',
    name: { ja: '輝き', en: 'Radiance' },
    tiers: {
      value: {
        1: { triggerChance: 0.2, radianceHealMultiplier: 0.5 },
        2: { triggerChance: 0.2, radianceHealMultiplier: 0.75 },
        3: { triggerChance: 0.2, radianceHealMultiplier: 1 },
      },
      source: wiki,
      confidence: 'high',
    },
    stacking: {
      value: {
        maxCopies: 4,
        behavior: 'special',
        copyEffectMultipliers: [1, 0.75, 0.5, 0.25],
      },
      source: COMMUNITY_RADIANCE_STACKING_SOURCE,
      confidence: 'low',
      note: 'Trigger chance remains 20%; reported total healing is 100% / 175% / 225% / 250%. Mixed tiers apply the largest tier value first.',
    },
  },
  leeching: {
    id: 'leeching',
    name: { ja: '吸血', en: 'Leeching' },
    tiers: {
      value: {
        1: { healingFraction: 0.05 },
        2: { healingFraction: 0.07 },
        3: { healingFraction: 0.09 },
      },
      source: wiki,
      confidence: 'high',
    },
    stacking: {
      value: { maxCopies: 4, behavior: 'special', additionalCopyMultiplier: 0.75 },
      source: wiki,
      confidence: 'medium',
      note: 'Community measurements report approximately 25% less effect per extra copy.',
    },
  },
  'void-strike': {
    id: 'void-strike',
    name: { ja: '虚無の一撃', en: 'Void Strike' },
    tiers: {
      value: {
        1: { maxBonusDamage: 2 },
        2: { maxBonusDamage: 4 },
        3: { maxBonusDamage: 6 },
      },
      source: wiki,
      confidence: 'high',
    },
    stacking: {
      value: { maxCopies: 1, behavior: 'non-stackable' },
      source: wiki,
      confidence: 'high',
    },
  },
  'guarding-strike': {
    id: 'guarding-strike',
    name: { ja: 'ガードストライク', en: 'Guarding Strike' },
    tiers: {
      value: {
        1: { durationSeconds: 2, damageReduction: 0.5 },
        2: { durationSeconds: 3, damageReduction: 0.5 },
        3: { durationSeconds: 4, damageReduction: 0.5 },
      },
      source: wiki,
      confidence: 'high',
    },
    stacking: {
      value: { maxCopies: 1, behavior: 'non-stackable' },
      source: wiki,
      confidence: 'high',
    },
  },
}

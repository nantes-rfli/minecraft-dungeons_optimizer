import type { EnchantmentDefinition, EnchantmentId } from '../core/types'
import {
  COMMUNITY_RADIANCE_STACKING_SOURCE,
  DUNGEONS_TOOLS_ENCHANTMENTS_SOURCE,
  MINECRAFT_WIKI_ENCHANTMENTS_SOURCE,
  SHARPNESS_SOURCE,
  REFRESHMENT_SOURCE,
  WEAKENING_SOURCE,
  WEAKENING_STACKING_SOURCE,
  UNCHANTING_SOURCE,
} from './sources'

import { WEAKENING_DURATION } from './enemyDebuffs'
import { PROC_TIER_MULTIPLIERS } from './damageEvents'
import { AMBUSH_SOURCE, SMITING_SOURCE, SMITING_STACKING_SOURCE, COMMITTED_SOURCE } from './enemyStateDamage'

const wiki = MINECRAFT_WIKI_ENCHANTMENTS_SOURCE

export const ENCHANTMENTS: Readonly<Record<EnchantmentId, EnchantmentDefinition>> = {
  ambush: {
    id: 'ambush',
    name: { ja: '奇襲', en: 'Ambush' },
    tiers: {
      value: {
        1: { effect: { kind: 'conditional-weapon-damage', condition: 'not-targeting-hero', bonus: 0.2 } },
        2: { effect: { kind: 'conditional-weapon-damage', condition: 'not-targeting-hero', bonus: 0.4 } },
        3: { effect: { kind: 'conditional-weapon-damage', condition: 'not-targeting-hero', bonus: 0.6 } },
      },
      source: AMBUSH_SOURCE, confidence: 'high',
    },
    stacking: { value: { maxCopies: 1, behavior: 'non-stackable' }, source: AMBUSH_SOURCE, confidence: 'high' },
    applicability: { value: { melee: true, ranged: false, armor: false }, source: AMBUSH_SOURCE, confidence: 'high' },
  },
  smiting: {
    id: 'smiting',
    name: { ja: '強打', en: 'Smiting' },
    tiers: {
      value: {
        1: { effect: { kind: 'conditional-weapon-damage', condition: 'undead-enemy', bonus: 0.25 } },
        2: { effect: { kind: 'conditional-weapon-damage', condition: 'undead-enemy', bonus: 0.35 } },
        3: { effect: { kind: 'conditional-weapon-damage', condition: 'undead-enemy', bonus: 0.45 } },
      },
      source: SMITING_SOURCE, confidence: 'high',
    },
    stacking: {
      value: { maxCopies: 4, behavior: 'multiplicative' }, source: SMITING_STACKING_SOURCE, confidence: 'high',
      note: 'Three normal slots plus gilded through Enchantsmith. Multiply active undead bonuses, then apply the shared undead exposure once. Unique built-ins are out of runtime scope.',
    },
    applicability: { value: { melee: true, ranged: true, armor: false }, source: SMITING_SOURCE, confidence: 'high' },
  },
  committed: {
    id: 'committed',
    name: { ja: '追い討ち', en: 'Committed' },
    tiers: {
      value: {
        1: { effect: { kind: 'target-health-weapon-damage', maxBonus: 0.5 } },
        2: { effect: { kind: 'target-health-weapon-damage', maxBonus: 0.75 } },
        3: { effect: { kind: 'target-health-weapon-damage', maxBonus: 1 } },
      },
      source: COMMITTED_SOURCE, confidence: 'high',
    },
    stacking: { value: { maxCopies: 1, behavior: 'non-stackable' }, source: COMMITTED_SOURCE, confidence: 'high' },
    applicability: { value: { melee: true, ranged: true, armor: false }, source: COMMITTED_SOURCE, confidence: 'high' },
  },
  shockwave: {
    id: 'shockwave',
    name: { ja: '衝撃波', en: 'Shockwave' },
    tiers: {
      value: {
        1: { effect: { kind: 'combo-finisher-damage', procDamageId: 'shockwave', tierMultiplier: PROC_TIER_MULTIPLIERS.shockwave[1] } },
        2: { effect: { kind: 'combo-finisher-damage', procDamageId: 'shockwave', tierMultiplier: PROC_TIER_MULTIPLIERS.shockwave[2] } },
        3: { effect: { kind: 'combo-finisher-damage', procDamageId: 'shockwave', tierMultiplier: PROC_TIER_MULTIPLIERS.shockwave[3] } },
      },
      source: DUNGEONS_TOOLS_ENCHANTMENTS_SOURCE, confidence: 'high',
    },
    stacking: {
      value: { maxCopies: 1, behavior: 'non-stackable' },
      source: DUNGEONS_TOOLS_ENCHANTMENTS_SOURCE, confidence: 'high',
    },
  },
  swirling: {
    id: 'swirling',
    name: { ja: '旋風', en: 'Swirling' },
    tiers: {
      value: {
        1: { effect: { kind: 'combo-finisher-damage', procDamageId: 'swirling', tierMultiplier: PROC_TIER_MULTIPLIERS.swirling[1] } },
        2: { effect: { kind: 'combo-finisher-damage', procDamageId: 'swirling', tierMultiplier: PROC_TIER_MULTIPLIERS.swirling[2] } },
        3: { effect: { kind: 'combo-finisher-damage', procDamageId: 'swirling', tierMultiplier: PROC_TIER_MULTIPLIERS.swirling[3] } },
      },
      source: DUNGEONS_TOOLS_ENCHANTMENTS_SOURCE, confidence: 'high',
    },
    stacking: {
      value: { maxCopies: 1, behavior: 'non-stackable' },
      source: DUNGEONS_TOOLS_ENCHANTMENTS_SOURCE, confidence: 'high',
    },
  },
  thundering: {
    id: 'thundering',
    name: { ja: '雷', en: 'Thundering' },
    tiers: {
      value: {
        1: { effect: { kind: 'on-hit-proc-damage', procDamageId: 'thundering', triggerChance: 0.3, tierMultiplier: PROC_TIER_MULTIPLIERS.thundering[1] } },
        2: { effect: { kind: 'on-hit-proc-damage', procDamageId: 'thundering', triggerChance: 0.3, tierMultiplier: PROC_TIER_MULTIPLIERS.thundering[2] } },
        3: { effect: { kind: 'on-hit-proc-damage', procDamageId: 'thundering', triggerChance: 0.3, tierMultiplier: PROC_TIER_MULTIPLIERS.thundering[3] } },
      },
      source: DUNGEONS_TOOLS_ENCHANTMENTS_SOURCE, confidence: 'high',
    },
    stacking: {
      value: { maxCopies: 1, behavior: 'non-stackable' },
      source: DUNGEONS_TOOLS_ENCHANTMENTS_SOURCE, confidence: 'high',
    },
  },
  sharpness: {
    id: 'sharpness',
    name: { ja: '切れ味', en: 'Sharpness' },
    tiers: {
      value: {
        1: { effect: { kind: 'passive-weapon-damage', bonus: 0.1 } },
        2: { effect: { kind: 'passive-weapon-damage', bonus: 0.21 } },
        3: { effect: { kind: 'passive-weapon-damage', bonus: 0.33 } },
      },
      source: SHARPNESS_SOURCE,
      confidence: 'high',
    },
    stacking: {
      value: { maxCopies: 4, behavior: 'multiplicative' },
      source: SHARPNESS_SOURCE,
      confidence: 'high',
      note: 'Audit values preserved: up to three normal slots plus gilded via Enchantsmith in 1.17.0.0. Mixed tier products are order-independent.',
    },
    applicability: {
      value: { melee: true, ranged: false, armor: false },
      source: SHARPNESS_SOURCE,
      confidence: 'high',
    },
  },
  unchanting: {
    id: 'unchanting',
    name: { ja: 'エンチャント解除', en: 'Unchanting' },
    tiers: {
      value: {
        1: { effect: { kind: 'conditional-weapon-damage', condition: 'enchanted-enemy', bonus: 0.5 } },
        2: { effect: { kind: 'conditional-weapon-damage', condition: 'enchanted-enemy', bonus: 0.75 } },
        3: { effect: { kind: 'conditional-weapon-damage', condition: 'enchanted-enemy', bonus: 1 } },
      },
      source: UNCHANTING_SOURCE,
      confidence: 'high',
    },
    stacking: {
      value: { maxCopies: 1, behavior: 'non-stackable' },
      source: UNCHANTING_SOURCE,
      confidence: 'high',
    },
    applicability: {
      value: { melee: true, ranged: true, armor: false },
      source: UNCHANTING_SOURCE,
      confidence: 'high',
      note: 'Audit applicability includes ranged; this runtime only implements direct melee hits.',
    },
  },
  refreshment: {
    id: 'refreshment',
    name: { ja: 'リフレッシュ', en: 'Refreshment' },
    tiers: {
      value: {
        1: { effect: { kind: 'potion-cooldown-on-direct-kill', potionCooldownReductionSeconds: 1 } },
        2: { effect: { kind: 'potion-cooldown-on-direct-kill', potionCooldownReductionSeconds: 2 } },
        3: { effect: { kind: 'potion-cooldown-on-direct-kill', potionCooldownReductionSeconds: 3 } },
      },
      source: REFRESHMENT_SOURCE,
      confidence: 'high',
    },
    stacking: {
      value: { maxCopies: 1, behavior: 'non-stackable' },
      source: REFRESHMENT_SOURCE,
      confidence: 'high',
    },
    applicability: {
      value: { melee: true, ranged: true, armor: false },
      source: REFRESHMENT_SOURCE,
      confidence: 'high',
      note: 'Runtime only evaluates direct melee weapon kills.',
    },
  },
  weakening: {
    id: 'weakening',
    name: { ja: '弱体化', en: 'Weakening' },
    tiers: {
      value: {
        1: { effect: { kind: 'enemy-damage-debuff', enemyDamageReduction: 0.2, durationSeconds: WEAKENING_DURATION.value } },
        2: { effect: { kind: 'enemy-damage-debuff', enemyDamageReduction: 0.3, durationSeconds: WEAKENING_DURATION.value } },
        3: { effect: { kind: 'enemy-damage-debuff', enemyDamageReduction: 0.4, durationSeconds: WEAKENING_DURATION.value } },
      },
      source: WEAKENING_SOURCE,
      confidence: 'high',
    },
    stacking: {
      value: { maxCopies: 1, behavior: 'non-stackable' },
      source: WEAKENING_STACKING_SOURCE,
      confidence: 'medium',
      note: 'Phase 2-1C uses the requested non-stackable rule, supported by Wiki including gilded slots. dungeons.tools says STACKS Yes; source conflict is retained in the audit, not presented as resolved game-file evidence.',
    },
    applicability: {
      value: { melee: true, ranged: false, armor: false },
      source: WEAKENING_SOURCE,
      confidence: 'medium',
      note: 'Melee-only runtime; retains the priority game-data audit scope. Wiki also lists ranged since 1.10.2.0; conflict documented, ranged runtime remains out of scope.',
    },
  },
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
      source: DUNGEONS_TOOLS_ENCHANTMENTS_SOURCE,
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

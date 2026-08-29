import type { Evidence, VoidStrikeCurve } from '../core/types'
import {
  COMMUNITY_VOID_STRIKE_CURVE_SOURCE,
  COMMUNITY_VOID_STRIKE_EXPIRATION_SOURCE,
  MINECRAFT_WIKI_VOID_STRIKE_SOURCE,
  MVP_MODEL_SOURCE,
} from './sources'

export const VOID_STRIKE_EXPIRATION: Evidence<number> = {
  value: 5,
  source: COMMUNITY_VOID_STRIKE_EXPIRATION_SOURCE,
  confidence: 'medium',
  note: 'Multiple community reports place expiration near 5 seconds; exact frame is unverified.',
}

export const VOID_STRIKE_ARMED_MINIMUM: Evidence<number> = {
  value: 1.25,
  source: COMMUNITY_VOID_STRIKE_CURVE_SOURCE,
  confidence: 'medium',
  note: 'Community tests repeatedly report an immediate +25% floor; exact per-tier behavior remains unverified.',
}

export const VOID_STRIKE_CURVE: Evidence<VoidStrikeCurve> = {
  value: {
    method: 'published-measurements',
    applicationHitMultiplier: 1,
    armedMinimumMultiplier: VOID_STRIKE_ARMED_MINIMUM.value,
    referenceMaximumMultiplier: 7,
    points: [
      { elapsedSeconds: 0, multiplier: VOID_STRIKE_ARMED_MINIMUM.value },
      { elapsedSeconds: 3.6, multiplier: 7 },
    ],
    expiresAfterSeconds: VOID_STRIKE_EXPIRATION.value,
  },
  source: COMMUNITY_VOID_STRIKE_CURVE_SOURCE,
  confidence: 'low',
  note: 'Decision B: best-supported linear model. Published reports disagree between 3.0 and 3.6 seconds and do not provide a complete frame series.',
}

export const VOID_STRIKE_RESET_SEMANTICS: Evidence<boolean> = {
  value: true,
  source: MINECRAFT_WIKI_VOID_STRIKE_SOURCE,
  confidence: 'high',
  note: 'A follow-up weapon hit consumes the current multiplier and immediately reapplies Void Strike.',
}

export const VOID_STRIKE_EXTERNAL_DAMAGE_CONSUMPTION: Evidence<boolean> = {
  value: true,
  source: MINECRAFT_WIKI_VOID_STRIKE_SOURCE,
  confidence: 'medium',
  note: 'Melee, ranged, and pet hits are community-confirmed consumers; indirect and DoT exceptions remain only partially mapped.',
}

export const VOID_STRIKE_TIER_SCALING: Evidence<'shared-minimum-linear-ramp'> = {
  value: 'shared-minimum-linear-ramp',
  source: MVP_MODEL_SOURCE,
  confidence: 'low',
  note: 'The 1.25× armed minimum is kept common across tiers; only the remaining ramp is scaled to 3× / 5× / 7×. Public tier tests support this shape but do not isolate the first armed frame for every tier.',
}

import { SOUL_SCYTHE_PROFILE_SOURCE } from './souls'
import type {
  CrossWeaponDamageScaling,
  Evidence,
  GearPowerCurve,
  WeaponId,
} from '../core/types'
import {
  DUNGEONS_TOOLS_DAMAGE_CALCULATOR_SOURCE,
  MINECRAFT_WIKI_ANCHOR_POWER_CURVE_SOURCE,
  MINECRAFT_WIKI_ANCHOR_SOURCE,
  MINECRAFT_WIKI_DOUBLE_AXE_SOURCE,
  MINECRAFT_WIKI_FIGHTERS_BINDINGS_SOURCE,
} from './sources'

/**
 * Wiki values retained for research comparison only. Their origin does not
 * establish that they are cross-weapon damage coefficients in game files.
 */
export const WIKI_BASE_HIT_DAMAGE: Readonly<Record<WeaponId, Evidence<number>>> = {
  'soul-scythe': { value: 80, source: SOUL_SCYTHE_PROFILE_SOURCE, confidence: 'low', note: 'Phase 1A published value; never used as the runtime Power coefficient.' },
  'fighters-bindings': {
    value: 25,
    source: MINECRAFT_WIKI_FIGHTERS_BINDINGS_SOURCE,
    confidence: 'low',
    note: 'All four Wiki hits use 25, but the uncited value is not verified as a 1.17.0.0 cross-weapon coefficient.',
  },
  'double-axe': {
    value: 100,
    source: MINECRAFT_WIKI_DOUBLE_AXE_SOURCE,
    confidence: 'low',
    note: 'Both Wiki hits use 100, but the uncited value is not verified as a 1.17.0.0 cross-weapon coefficient.',
  },
  anchor: {
    value: 238,
    source: MINECRAFT_WIKI_ANCHOR_SOURCE,
    confidence: 'low',
    note: 'The Wiki hit uses 238. It normalizes Model W but is not independent cross-weapon evidence.',
  },
}

export const CROSS_WEAPON_DAMAGE_SCALING: Evidence<CrossWeaponDamageScaling> = {
  value: {
    method: 'internal-power-ratio',
  },
  source: DUNGEONS_TOOLS_DAMAGE_CALCULATOR_SOURCE,
  confidence: 'medium',
  note: 'The public 1.17.0.0 calculator describes one common Gear Power curve and uses the exact internal rating linearly. The raw extraction field and pipeline are not published independently.',
}

/**
 * Raw published Anchor card-damage samples. The source does not identify the
 * row version, so this curve remains independent from the 1.17.0.0 ratings.
 * Runtime interpolation stays inside this observed Power range and never extrapolates.
 */
export const GEAR_POWER_CURVE: Evidence<GearPowerCurve> = {
  value: {
    referenceWeaponId: 'anchor',
    points: [
      { powerLevel: 50, referenceDamage: 477 },
      { powerLevel: 75, referenceDamage: 1_329 },
      { powerLevel: 100, referenceDamage: 3_699 },
      { powerLevel: 125, referenceDamage: 10_298 },
      { powerLevel: 150, referenceDamage: 28_665 },
      { powerLevel: 175, referenceDamage: 79_791 },
      { powerLevel: 200, referenceDamage: 222_108 },
      { powerLevel: 225, referenceDamage: 618_262 },
      { powerLevel: 250, referenceDamage: 1_721_003 },
      { powerLevel: 251, referenceDamage: 1_792_941 },
      { powerLevel: 256, referenceDamage: 2_200_329 },
      { powerLevel: 263, referenceDamage: 2_930_746 },
    ],
  },
  source: MINECRAFT_WIKI_ANCHOR_POWER_CURVE_SOURCE,
  confidence: 'medium',
  note: 'Log-linear interpolation only within Power 50–263. This absolute Anchor curve is separate from the cross-weapon coefficient model.',
}

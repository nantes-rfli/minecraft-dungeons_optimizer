import type { Evidence, GearPowerCurve } from '../core/types'
import { MINECRAFT_WIKI_ANCHOR_POWER_CURVE_SOURCE } from './sources'

/**
 * Raw Anchor card-damage samples published for Minecraft Dungeons 1.17.0.0.
 * Runtime interpolation stays inside this observed Power range and never extrapolates.
 */
export const GEAR_POWER_CURVE: Evidence<GearPowerCurve> = {
  value: {
    referenceBaseHitDamage: 238,
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
  note: 'Log-linear interpolation only within Power 50–263. Item-card rolls can vary at the same Power.',
}

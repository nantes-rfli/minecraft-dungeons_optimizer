import type { WeaponPowerValidationSample } from '../core/types'
import {
  COMMUNITY_FIGHTERS_BINDINGS_POWER_251_SOURCE,
  MINECRAFT_WIKI_ANCHOR_POWER_CURVE_SOURCE,
  MINECRAFT_WIKI_DOUBLE_AXE_POWER_SOURCE,
  MINECRAFT_WIKI_FIGHTERS_BINDINGS_POWER_SOURCE,
} from './sources'

const DOUBLE_AXE_PUBLISHED_RANGES = [
  [50, 209, 218], [55, 258, 269], [60, 319, 332], [65, 393, 409],
  [70, 483, 503], [75, 594, 619], [80, 730, 760], [85, 896, 934],
  [90, 1_100, 1_146], [95, 1_350, 1_406], [100, 1_655, 1_724],
  [105, 2_030, 2_114], [108, 2_294, 2_389], [251, 745_829, 766_840],
] as const

const ANCHOR_PUBLISHED_DAMAGE = [
  [50, 477], [75, 1_329], [100, 3_699], [125, 10_298],
  [150, 28_665], [175, 79_791], [200, 222_108], [225, 618_262],
  [250, 1_721_003], [251, 1_792_941], [256, 2_200_329], [263, 2_930_746],
] as const

/**
 * Published observations copied independently from the runtime curve and formula.
 * Do not generate or rewrite these values from calculatePowerScaledHitDamage.
 */
export const POWER_SCALING_VALIDATION_SAMPLES = [
  {
    id: 'fighters-bindings-p114-wiki',
    weaponId: 'fighters-bindings', powerLevel: 114,
    publishedDamage: { kind: 'range', min: 876, max: 957 },
    publishedGameVersion: 'not-stated',
    source: MINECRAFT_WIKI_FIGHTERS_BINDINGS_POWER_SOURCE,
    note: 'The table does not identify the game version or item sub-power roll.',
  },
  {
    id: 'fighters-bindings-p135-wiki',
    weaponId: 'fighters-bindings', powerLevel: 135,
    publishedDamage: { kind: 'range', min: 1_285, max: 2_647 },
    publishedGameVersion: 'not-stated',
    source: MINECRAFT_WIKI_FIGHTERS_BINDINGS_POWER_SOURCE,
    note: 'The unusually wide range is preserved as published; its cause is not stated.',
  },
  {
    id: 'fighters-bindings-p251-community',
    weaponId: 'fighters-bindings', powerLevel: 251,
    publishedDamage: { kind: 'range', min: 188_000, max: 191_710 },
    publishedGameVersion: 'not-stated',
    source: COMMUNITY_FIGHTERS_BINDINGS_POWER_251_SOURCE,
    note: 'The lower bound is an approximate typical card value; 191,710 is reported as the cap.',
  },
  ...DOUBLE_AXE_PUBLISHED_RANGES.map(([powerLevel, min, max]) => ({
    id: `double-axe-p${powerLevel}-wiki`,
    weaponId: 'double-axe' as const,
    powerLevel,
    publishedDamage: { kind: 'range' as const, min, max },
    publishedGameVersion: 'not-stated',
    source: MINECRAFT_WIKI_DOUBLE_AXE_POWER_SOURCE,
    note: 'The Wiki states that item-card damage can vary at the same Power; row version is unstated.',
  })),
  ...ANCHOR_PUBLISHED_DAMAGE.map(([powerLevel, value]) => ({
    id: `anchor-p${powerLevel}-wiki`,
    weaponId: 'anchor' as const,
    powerLevel,
    publishedDamage: { kind: 'exact' as const, value },
    publishedGameVersion: 'not-stated',
    source: MINECRAFT_WIKI_ANCHOR_POWER_CURVE_SOURCE,
    note: 'This published row is also an Anchor interpolation knot, so it validates regression only.',
  })),
] as const satisfies readonly WeaponPowerValidationSample[]

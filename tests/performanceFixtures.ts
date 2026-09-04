import type { Inventory } from '../src/core/types'
import { DEFAULT_SCENARIO } from '../src/data/scenarios'

// Synthetic workload only: never import these into research/Evidence.
export const PERFORMANCE_SIZES = ['small', 'medium', 'large'] as const
export type PerformanceSize = typeof PERFORMANCE_SIZES[number]
export const PERFORMANCE_SCENARIO = { ...DEFAULT_SCENARIO, rangedTimeShare: 0.2 }
export function performanceInventory(size: PerformanceSize): Inventory {
  const count = { small: 2, medium: 6, large: 12 }[size]
  return {
    weapons: Array.from({ length: count }, (_, i) => ({
      instanceId: `perf-melee-${i}`, weaponId: i % 2 ? 'double-axe' : 'fighters-bindings', powerLevel: 251,
      enchantmentSlots: [{ candidates: ['critical-hit', 'radiance'] }, { candidates: ['leeching', 'guarding-strike'] }],
      gilded: { enchantmentId: 'sharpness', tier: 1 },
    })),
    armors: Array.from({ length: count / 2 }, (_, i) => ({
      instanceId: `perf-armor-${i}`, armorId: 'battle-robe', powerLevel: 251, observedHealthBonus: 1_880_000,
      enchantmentSlots: [{ candidates: [{ enchantmentId: 'health-synergy', tier: 3 }, { enchantmentId: 'snowball', tier: 3 }] }],
      gilded: { enchantmentId: 'chilling', tier: 1 },
    })),
    rangedWeapons: Array.from({ length: count / 2 }, (_, i) => ({
      instanceId: `perf-ranged-${i}`, weaponId: i % 2 ? 'crossbow' : 'bow', powerLevel: 251,
      observation: { gameVersion: '1.17.0.0', mode: i % 2 ? 'single' : 'uncharged', projectileDamage: 100_000, shotCycleSeconds: 1, availableAmmo: 50, sourceNote: 'SYNTHETIC PERFORMANCE FIXTURE — not game Evidence' },
      enchantmentSlots: [{ candidates: [{ enchantmentId: 'power', tier: 3 }, { enchantmentId: 'unchanting', tier: 3 }] }],
      gilded: { enchantmentId: 'critical-hit', tier: 1 },
    })),
    artifacts: Array.from({ length: 3 }, (_, i) => ({ instanceId: `perf-artifact-${i}`, artifactId: 'death-cap-mushroom', powerLevel: 251 })),
  }
}

import type { Evaluation } from './types'

function enchantmentKey(enchantments: readonly { readonly enchantmentId: string; readonly tier: number; readonly source: string }[] = []) {
  // Preserve tiers, sources and copy counts; only slot ordering is ignored.
  return enchantments.map((item) => JSON.stringify([item.enchantmentId, item.tier, item.source])).sort()
}

/** Keep the first (highest-ranked) feasible allocation for each owned composition.
 * Use only within one search: instance IDs refer to its validated inventory.
 * Equal scores or metrics alone never make different equipment interchangeable.
 */
export function distinctRecommendations<T extends Pick<Evaluation, 'build' | 'damage' | 'healing' | 'defense' | 'control' | 'objectiveScore'>>(ranked: readonly T[]): T[] {
  const seen = new Set<string>()
  return ranked.filter((candidate) => {
    const { build } = candidate
    const key = JSON.stringify([
      build.weapon.instanceId, enchantmentKey(build.enchantments),
      build.armor?.instanceId ?? null, enchantmentKey(build.armorEnchantments),
      build.rangedWeapon?.instanceId ?? null, enchantmentKey(build.rangedEnchantments),
      build.artifacts.map((item) => item.instanceId).sort(),
      // Do not assume order-independent semantics: retain any different
      // score or comparison/Pareto metric even for the same composition.
      candidate.objectiveScore, candidate.damage.singleTargetDps, candidate.damage.aoeDps,
      candidate.healing.totalPerSecond, candidate.defense.effectiveHealth, candidate.control.utility,
    ])
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

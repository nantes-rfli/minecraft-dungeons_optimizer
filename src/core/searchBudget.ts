import type { Inventory } from './types'
import { OptimizerInputError } from './errors'

export const SEARCH_WARNING_CANDIDATES = 1_000
export const SEARCH_MAX_CANDIDATES = 25_000

// An upper bound before unsupported/stacking filters, without materializing builds.
// Saturation avoids Infinity/unsafe integer values even for imported inventories.
const bounded = (value: number) => Math.min(Number.MAX_SAFE_INTEGER, value)
function slotCount(slots: readonly { candidates: readonly unknown[]; locked?: string }[]): number {
  return slots.reduce((total, slot) => bounded(total * (slot.locked ? 1 : slot.candidates.length)), 1)
}
export function estimateSearchCandidates(inventory: Inventory): number {
  const melee = inventory.weapons.reduce((sum, weapon) => bounded(sum + slotCount(weapon.enchantmentSlots)), 0)
  const armor = inventory.armors?.length ? inventory.armors.reduce((sum, item) => bounded(sum + slotCount(item.enchantmentSlots)), 0) : 1
  const ranged = inventory.rangedWeapons?.length ? inventory.rangedWeapons.reduce((sum, item) => bounded(sum + slotCount(item.enchantmentSlots)), 0) : 1
  const n = inventory.artifacts.length
  const artifacts = n < 3 ? 1 : bounded(n * (n - 1) * (n - 2) / 6)
  return bounded(bounded(bounded(melee * armor) * ranged) * artifacts)
}
export function assertSearchBudget(inventory: Inventory): number {
  const count = estimateSearchCandidates(inventory)
  if (count > SEARCH_MAX_CANDIDATES) throw new OptimizerInputError('SEARCH_LIMIT_EXCEEDED', `候補数の上限推定が${count.toLocaleString()}通りで、安全上限${SEARCH_MAX_CANDIDATES.toLocaleString()}通りを超えています。装備や候補を減らすかスロットを確定してください。探索は実行していません。`)
  return count
}

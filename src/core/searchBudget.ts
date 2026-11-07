import { observedMeleeComboPreparationIssue } from './observedMeleeComboReuse'
import type { Inventory, Scenario } from './types'
import { OptimizerInputError } from './errors'

export const SEARCH_WARNING_CANDIDATES = 1_000
export const SEARCH_MAX_CANDIDATES = 25_000

// An upper bound before unsupported/stacking filters, without materializing builds.
// Saturation avoids Infinity/unsafe integer values even for imported inventories.
const bounded = (value: number) => Math.min(Number.MAX_SAFE_INTEGER, value)
function slotCount(slots: readonly { candidates: readonly unknown[]; selected?: unknown }[]): number {
  return slots.reduce((total, slot) => bounded(total * (slot.selected || (slot as { locked?: string }).locked ? 1 : slot.candidates.length)), 1)
}
export function estimateSearchCandidates(inventory: Inventory, scenario?: Pick<Scenario, 'includeUnequippedArtifacts'>): number {
  const preparedMelee = inventory.weapons.filter((weapon) => !observedMeleeComboPreparationIssue(weapon))
  if (inventory.weapons.length > 0 && preparedMelee.length === 0) return 0
  const melee = preparedMelee.reduce((sum, weapon) => bounded(sum + slotCount(weapon.enchantmentSlots)), 0)
  const armor = inventory.armors?.length ? inventory.armors.reduce((sum, item) => bounded(sum + slotCount(item.enchantmentSlots)), 0) : 1
  const ranged = inventory.rangedWeapons?.length ? inventory.rangedWeapons.reduce((sum, item) => bounded(sum + slotCount(item.enchantmentSlots)), 0) : 1
  const n = inventory.artifacts.length
  const triples = n < 3 ? 0 : bounded(n * (n - 1) * (n - 2) / 6)
  if (scenario?.includeUnequippedArtifacts !== true) return bounded(bounded(bounded(melee * armor) * ranged) * (n < 3 ? 1 : triples))
  const artifacts = bounded(1 + n + (n < 2 ? 0 : bounded(n * (n - 1) / 2)) + triples)
  // Melee and Artifact candidates are built before Armor/Ranged preparation.
  // An empty slot in a direct Core input must not erase that workload.
  const meleeWithArtifacts = bounded(Math.max(1, melee) * artifacts)
  return bounded(bounded(meleeWithArtifacts * Math.max(1, armor)) * Math.max(1, ranged))
}
export function assertSearchBudget(inventory: Inventory, scenario?: Pick<Scenario, 'includeUnequippedArtifacts'>): number {
  const count = estimateSearchCandidates(inventory, scenario)
  if (count > SEARCH_MAX_CANDIDATES) throw new OptimizerInputError('SEARCH_LIMIT_EXCEEDED', `候補数の上限推定が${count.toLocaleString()}通りで、安全上限${SEARCH_MAX_CANDIDATES.toLocaleString()}通りを超えています。装備や候補を減らすか選択済みにしてください。探索は実行していません。`)
  return count
}

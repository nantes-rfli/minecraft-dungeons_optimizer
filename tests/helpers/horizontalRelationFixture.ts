import type { HorizontalRawFactInventory, JsonRecord } from '../../scripts/game-data-horizontal-fact-inventory.ts'

function deepFreeze<T>(value: T): T {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) return value
  for (const child of Object.values(value)) deepFreeze(child)
  return Object.freeze(value)
}

/**
 * Keep the complete population, but copy only the mutation surface of a family
 * fixture. The shared population is frozen so accidental writes fail immediately.
 * Every source row referenced by the selected item's candidates is copied,
 * including duplicate matches; no ambiguity or foreign-item checks are hidden.
 */
export function cloneHorizontalRelationFixture(
  inventory: HorizontalRawFactInventory,
  category: string,
  catalogId: string,
): HorizontalRawFactInventory {
  deepFreeze(inventory)
  const items = inventory.items.map((item) => item.category === category && item.catalogId === catalogId
    ? structuredClone(item) : item)
  const edgeIds = new Set<string>()
  for (const item of items.filter((item) => item.category === category && item.catalogId === catalogId)) {
    for (const candidate of item.rawCandidate.candidates as JsonRecord[]) {
      for (const reference of candidate.relations as JsonRecord[]) edgeIds.add(reference.edgeId)
    }
  }
  return {
    ...inventory,
    items,
    sourceRelations: (inventory.sourceRelations as JsonRecord[]).map((source) => edgeIds.has(source.edgeId)
      ? structuredClone(source) : source),
  }
}

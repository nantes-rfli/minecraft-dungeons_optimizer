import { describe, expect, it } from 'vitest'
import { assertSearchBudget, estimateSearchCandidates, SEARCH_MAX_CANDIDATES } from '../src/core/searchBudget'
import { optimize } from '../src/core/optimizer'
import { DEFAULT_SCENARIO } from '../src/data/scenarios'
import type { Inventory } from '../src/core/types'

const inventory: Inventory = { weapons: [{ instanceId: 'w', weaponId: 'double-axe', powerLevel: 251, enchantmentSlots: [{ candidates: ['critical-hit', 'radiance'] }] }], artifacts: [] }
describe('search budget', () => {
  it('counts optional equipment, locks, candidate slots and unordered artifact triples', () => {
    expect(estimateSearchCandidates(inventory)).toBe(2)
    const input: Inventory = { ...inventory, weapons: [{ ...inventory.weapons[0]!, enchantmentSlots: [{ candidates: ['critical-hit', 'radiance'], locked: 'critical-hit' }] }], artifacts: Array.from({ length: 4 }, (_, i) => ({ instanceId: `a${i}`, artifactId: 'death-cap-mushroom', powerLevel: 251 })) }
    expect(estimateSearchCandidates(input)).toBe(4)
    expect(optimize(input, DEFAULT_SCENARIO).evaluatedBuildCount).toBe(4)
  })
  it('rejects excessive exploration before materializing candidate builds', () => {
    const huge: Inventory = { ...inventory, artifacts: Array.from({ length: 100 }, (_, i) => ({ instanceId: `a${i}`, artifactId: 'death-cap-mushroom', powerLevel: 251 })) }
    expect(estimateSearchCandidates(huge)).toBeGreaterThan(SEARCH_MAX_CANDIDATES)
    expect(() => assertSearchBudget(huge)).toThrow('探索は実行していません')
    expect(() => optimize(huge, DEFAULT_SCENARIO)).toThrow('安全上限')
  })
})

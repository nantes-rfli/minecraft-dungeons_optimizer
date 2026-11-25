import { describe, expect, it } from 'vitest'
import { optimize } from '../src/core/optimizer'
import { estimateSearchCandidates, SEARCH_MAX_CANDIDATES } from '../src/core/searchBudget'
import type { Inventory } from '../src/core/types'
import { DEFAULT_SCENARIO } from '../src/data/scenarios'
import { applyInventorySearchScope } from '../src/inventory/searchScope'
import { retainTrialCandidate } from '../src/inventory/trialCandidate'

const inventory: Inventory = {
  weapons: [{ instanceId: 'melee', weaponId: 'double-axe', powerLevel: 251, enchantmentSlots: [{ candidates: ['critical-hit'] }] }],
  armors: [{ instanceId: 'armor', armorId: 'battle-robe', powerLevel: 251, observedHealthBonus: 500, enchantmentSlots: [{ candidates: ['snowball'] }] }],
  rangedWeapons: [{ instanceId: 'bow', weaponId: 'bow', powerLevel: 251, enchantmentSlots: [] }],
  artifacts: [{ instanceId: 'artifact', artifactId: 'iron-hide-amulet', powerLevel: 251 }],
  catalogItems: [{ instanceId: 'catalog', category: 'artifact', catalogId: 'gong-of-weakening', powerLevel: 251 }],
}

describe('owned inventory search scope', () => {
  it('filters only explicitly excluded identities and reports any registered category emptied by the selection', () => {
    const before = structuredClone(inventory)
    const scope = applyInventorySearchScope(inventory, new Set(['melee', 'armor', 'bow', 'artifact', 'catalog', 'missing']))
    expect(scope.excludedCount).toBe(4)
    expect(scope.emptiedCategories).toEqual(['melee', 'armor', 'ranged', 'artifact'])
    expect(scope.inventory).toEqual({ ...inventory, weapons: [], armors: [], rangedWeapons: [], artifacts: [] })
    expect(scope.inventory.catalogItems).toBe(inventory.catalogItems)
    expect(inventory).toEqual(before)
    expect(applyInventorySearchScope(inventory, new Set()).inventory).toBe(inventory)
    expect(applyInventorySearchScope(inventory, new Set(['missing'])).inventory).toBe(inventory)
  })

  it('allows evaluation within the unchanged budget even when the full collection exceeds the limit', () => {
    const source = {
      weapons: inventory.weapons, artifacts: Array.from({ length: 55 }, (_, index) => ({ ...inventory.artifacts[0]!, instanceId: `artifact-${index}` })),
    }
    expect(estimateSearchCandidates(source)).toBeGreaterThan(SEARCH_MAX_CANDIDATES)
    expect(() => optimize(source, DEFAULT_SCENARIO)).toThrow(expect.objectContaining({ code: 'SEARCH_LIMIT_EXCEEDED' }))

    const scope = applyInventorySearchScope(source, new Set(source.artifacts.slice(1).map(({ instanceId }) => instanceId)))
    expect(scope.excludedCount).toBe(54)
    expect(scope.emptiedCategories).toEqual([])
    expect(estimateSearchCandidates(scope.inventory)).toBe(1)
    expect(optimize(scope.inventory, DEFAULT_SCENARIO).best.build.artifacts).toEqual([source.artifacts[0]])
    expect(source.artifacts).toHaveLength(55)
  })

  it('can compare a trial with a scoped projection while keeping all originals when accepted', () => {
    const owned = { ...inventory, armors: undefined, rangedWeapons: undefined }
    const trialWeapon = { ...inventory.weapons[0]!, instanceId: 'trial' }
    const trial = { ...owned, weapons: [...owned.weapons, trialWeapon] }
    const exclusions = new Set(['melee'])
    const scopedTrial = applyInventorySearchScope(trial, exclusions)
    expect(scopedTrial.inventory.weapons).toEqual([trialWeapon])
    expect(retainTrialCandidate(owned, scopedTrial.inventory, trialWeapon.instanceId)).toEqual(trial)
  })
})

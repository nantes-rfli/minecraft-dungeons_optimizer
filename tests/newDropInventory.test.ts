import { describe, expect, it } from 'vitest'
import type { Inventory } from '../src/core/types'
import { retainTrialCandidate } from '../src/inventory/trialCandidate'

describe('retainTrialCandidate', () => {
  it('copies the selected staged instance and preserves its recorded facts', () => {
    const inventory: Inventory = {
      weapons: [{ instanceId: 'saved-axe', weaponId: 'double-axe', powerLevel: 100, enchantmentSlots: [{ candidates: ['sharpness'] }] }],
      artifacts: [],
    }
    const stagedWeapon = {
      instanceId: 'staged-axe', weaponId: 'double-axe' as const, powerLevel: 263,
      rarity: 'rare' as const, notes: 'Synthetic test note', observedDamagePerHit: 0,
      enchantmentSlots: [{ candidates: ['sharpness'], selected: { enchantmentId: 'sharpness', tier: 2 as const } }],
      gilded: { enchantmentId: 'void-strike' as const, tier: 3 as const },
    }
    const trialInventory: Inventory = { ...inventory, weapons: [...inventory.weapons, stagedWeapon] }

    const retained = retainTrialCandidate(inventory, trialInventory, 'staged-axe')

    expect(retained).toEqual({ ...inventory, weapons: [...inventory.weapons, stagedWeapon] })
    expect(retained?.weapons.at(-1)).toBe(stagedWeapon)
    expect(inventory.weapons).toHaveLength(1)
  })

  it('preserves unknown catalog research without converting it to runtime equipment', () => {
    const inventory: Inventory = { weapons: [], artifacts: [], catalogItems: [] }
    const stagedItem = {
      instanceId: 'staged-unknown', category: 'armor' as const, catalogId: 'champion-s-armor', powerLevel: 251,
      research: { observations: [{ parameterId: 'incoming-damage', value: 'unknown', notes: 'Synthetic test data' }] },
    }

    const retained = retainTrialCandidate(inventory, { ...inventory, catalogItems: [stagedItem] }, 'staged-unknown')

    expect(retained?.catalogItems).toEqual([stagedItem])
    expect(retained?.armors).toBeUndefined()
    expect(retained?.weapons).toEqual([])
  })

  it('retains staged armor, ranged weapon, and artifact copies in their existing category arrays', () => {
    const inventory: Inventory = { weapons: [], artifacts: [] }
    const staged: Inventory = {
      weapons: [],
      armors: [{ instanceId: 'staged-armor', armorId: 'battle-robe', powerLevel: 251, observedHealthBonus: 0, enchantmentSlots: [] }],
      rangedWeapons: [{ instanceId: 'staged-ranged', weaponId: 'bow', powerLevel: 251, enchantmentSlots: [] }],
      artifacts: [{ instanceId: 'staged-artifact', artifactId: 'iron-hide-amulet', powerLevel: 251 }],
    }

    expect(retainTrialCandidate(inventory, staged, 'staged-armor')?.armors).toEqual(staged.armors)
    expect(retainTrialCandidate(inventory, staged, 'staged-ranged')?.rangedWeapons).toEqual(staged.rangedWeapons)
    expect(retainTrialCandidate(inventory, staged, 'staged-artifact')?.artifacts).toEqual(staged.artifacts)
    expect(inventory).toEqual({ weapons: [], artifacts: [] })
  })

  it('refuses a missing, ambiguous, or already saved instance', () => {
    const inventory: Inventory = {
      weapons: [{ instanceId: 'saved-axe', weaponId: 'double-axe', powerLevel: 100, enchantmentSlots: [] }],
      artifacts: [],
    }
    const staged = { instanceId: 'staged-axe', weaponId: 'double-axe' as const, powerLevel: 263, enchantmentSlots: [] }
    const trialInventory: Inventory = { ...inventory, weapons: [...inventory.weapons, staged] }

    expect(retainTrialCandidate(inventory, trialInventory, 'missing')).toBeNull()
    expect(retainTrialCandidate(inventory, { ...trialInventory, catalogItems: [{ instanceId: 'staged-axe', category: 'artifact', catalogId: 'gong-of-weakening', powerLevel: 251 }] }, 'staged-axe')).toBeNull()
    expect(retainTrialCandidate({ ...inventory, weapons: [...inventory.weapons, staged] }, trialInventory, 'staged-axe')).toBeNull()
  })
})

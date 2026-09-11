import { afterEach, describe, expect, it, vi } from 'vitest'
import type { EnchantmentTier, Inventory } from '../src/core'
import {
  deserializeInventory,
  loadInventory,
  saveInventory,
  serializeInventory,
} from '../src/inventory/storage'

const inventory: Inventory = {
  weapons: [{
    instanceId: 'weapon-1',
    weaponId: 'anchor',
    powerLevel: 250,
    observedDamagePerHit: 123456,
    enchantmentSlots: [{ candidates: ['void-strike', 'critical-hit'], locked: 'void-strike' }],
    gilded: { enchantmentId: 'guarding-strike', tier: 3 },
  }],
  artifacts: [
    { instanceId: 'artifact-1', artifactId: 'iron-hide-amulet', powerLevel: 248 },
    { instanceId: 'artifact-2', artifactId: 'iron-hide-amulet', powerLevel: 251 },
  ],
  catalogItems: [{ instanceId: 'catalog-1', category: 'artifact', catalogId: 'gong-of-weakening', powerLevel: 251, notes: 'Research Quest用' }],
}

describe('inventory JSON', () => {
  it('round-trips owned items including duplicate artifact definitions', () => {
    expect(deserializeInventory(serializeInventory(inventory))).toEqual(inventory)
  })

  it('writes schema v3 and retains audited runtime-unsupported equipment', () => {
    const serialized = serializeInventory(inventory)
    expect(JSON.parse(serialized).version).toBe(3)
    expect(deserializeInventory(serialized).catalogItems).toEqual(inventory.catalogItems)
  })

  it('rejects non-audited catalog-only equipment', () => {
    const json = serializeInventory(inventory).replace('gong-of-weakening', 'invented-artifact')
    expect(() => deserializeInventory(json)).toThrow('監査済み')
  })

  it('rejects unknown identifiers with a useful error', () => {
    const json = serializeInventory(inventory).replace('anchor', 'unknown-weapon')
    expect(() => deserializeInventory(json)).toThrow('未対応ID')
  })

  it('rejects malformed JSON', () => {
    expect(() => deserializeInventory('{')).toThrow('JSONの構文')
  })

  it('rejects an invalid observed damage value', () => {
    const json = serializeInventory(inventory).replace('123456', '0')
    expect(() => deserializeInventory(json)).toThrow('0より大きい数値')
  })

  it.each([1, 2, 3] as const)('round-trips gilded Tier %s through JSON', (tier) => {
    const tieredInventory: Inventory = {
      ...inventory,
      weapons: [{
        ...inventory.weapons[0]!,
        gilded: { enchantmentId: 'void-strike', tier: tier satisfies EnchantmentTier },
      }],
    }

    expect(deserializeInventory(serializeInventory(tieredInventory))).toEqual(tieredInventory)
  })
})

describe('inventory localStorage', () => {
  afterEach(() => vi.unstubAllGlobals())

  it.each([1, 2, 3] as const)('preserves gilded Tier %s', (tier) => {
    const values = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    })
    const tieredInventory: Inventory = {
      ...inventory,
      weapons: [{
        ...inventory.weapons[0]!,
        gilded: { enchantmentId: 'radiance', tier: tier satisfies EnchantmentTier },
      }],
    }

    saveInventory(tieredInventory)
    expect(loadInventory({ weapons: [], artifacts: [] })).toEqual(tieredInventory)
  })
})

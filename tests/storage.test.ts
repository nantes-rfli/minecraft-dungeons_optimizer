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
    enchantmentSlots: [{ candidates: ['void-strike', 'critical-hit'], selected: { enchantmentId: 'void-strike', tier: 3 } }],
    gilded: { enchantmentId: 'guarding-strike', tier: 3 },
  }],
  artifacts: [
    { instanceId: 'artifact-1', artifactId: 'iron-hide-amulet', powerLevel: 248 },
    { instanceId: 'artifact-2', artifactId: 'iron-hide-amulet', powerLevel: 251 },
  ],
  catalogItems: [{
    instanceId: 'catalog-1', category: 'armor', catalogId: 'champion-s-armor', powerLevel: 251, notes: 'Research Quest用',
    research: {
      enchantments: [{ enchantmentId: 'protection', tier: 3, source: 'gilded' }],
      intrinsicProperties: [{ kind: 'damage-reduction', raw: '35% damage reduction' }],
      observations: [{ parameterId: 'incoming-damage', value: '65000', unit: 'damage', conditions: 'Apocalypse +25', gameVersion: '1.17.0.0', notes: 'fixed hit' }],
    },
  }],
}

describe('inventory JSON', () => {
  it('round-trips owned items including duplicate artifact definitions', () => {
    expect(deserializeInventory(serializeInventory(inventory))).toEqual(inventory)
  })

  it('writes schema v5 and retains research attributes for audited runtime-unsupported equipment', () => {
    const serialized = serializeInventory(inventory)
    expect(JSON.parse(serialized).version).toBe(5)
    expect(deserializeInventory(serialized).catalogItems).toEqual(inventory.catalogItems)
  })

  it('rejects non-audited catalog-only equipment', () => {
    const json = serializeInventory(inventory).replace('champion-s-armor', 'invented-armor')
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

  it('migrates legacy melee locks to selected Tier III because the old UI was fixed to Tier III', () => {
    const legacy = JSON.stringify({ version: 4, inventory: { weapons: [{ instanceId: 'legacy-melee', weaponId: 'double-axe', powerLevel: 251, enchantmentSlots: [{ candidates: ['radiance', 'critical-hit'], locked: 'radiance' }] }], artifacts: [] } })
    expect(deserializeInventory(legacy).weapons[0]?.enchantmentSlots[0]).toEqual({ candidates: ['radiance', 'critical-hit'], selected: { enchantmentId: 'radiance', tier: 3 } })
  })

  it('moves only the locked legacy Armor and Ranged candidate tier to selected', () => {
    const legacy = JSON.stringify({ version: 4, inventory: {
      weapons: [], artifacts: [],
      armors: [{ instanceId: 'legacy-armor', armorId: 'battle-robe', powerLevel: 251, enchantmentSlots: [{ candidates: [{ enchantmentId: 'chilling', tier: 2 }, { enchantmentId: 'thorns', tier: 1 }], locked: 'chilling' }] }],
      rangedWeapons: [{ instanceId: 'legacy-ranged', weaponId: 'bow', powerLevel: 251, enchantmentSlots: [{ candidates: [{ enchantmentId: 'power', tier: 2 }, { enchantmentId: 'multishot', tier: 1 }], locked: 'power' }] }],
    } })
    const restored = deserializeInventory(legacy)
    expect(restored.armors?.[0]?.enchantmentSlots[0]).toEqual({ candidates: ['chilling', 'thorns'], selected: { enchantmentId: 'chilling', tier: 2 } })
    expect(restored.rangedWeapons?.[0]?.enchantmentSlots[0]).toEqual({ candidates: ['power', 'multishot'], selected: { enchantmentId: 'power', tier: 2 } })
  })

  it('does not infer a selection from legacy candidate tiers without a lock', () => {
    const legacy = JSON.stringify({ version: 4, inventory: { weapons: [], artifacts: [], armors: [{ instanceId: 'legacy-armor', armorId: 'battle-robe', powerLevel: 251, enchantmentSlots: [{ candidates: [{ enchantmentId: 'chilling', tier: 2 }] }] }] } })
    expect(deserializeInventory(legacy).armors?.[0]?.enchantmentSlots[0]).toEqual({ candidates: ['chilling'] })
  })

  it.each([
    [{ candidates: ['radiance', 'critical-hit', 'sharpness', 'echo'] }],
    Array.from({ length: 4 }, () => ({ candidates: ['radiance'] })),
    [{ candidates: ['radiance', 'radiance'] }],
    [{ candidates: ['radiance'], selected: { enchantmentId: 'critical-hit', tier: 3 } }],
    [{ candidates: ['radiance'], selected: { enchantmentId: 'radiance', tier: 4 } }],
  ] as unknown[])('rejects invalid canonical slot state %#', (enchantmentSlots) => {
    const invalid = JSON.stringify({ version: 5, inventory: { weapons: [{ instanceId: 'invalid', weaponId: 'double-axe', powerLevel: 251, enchantmentSlots }], artifacts: [] } })
    expect(() => deserializeInventory(invalid)).toThrow()
  })

  it('rejects Soul-only candidates on non-Soul equipment without using runtime support as an import gate', () => {
    const invalid = JSON.stringify({ version: 5, inventory: { weapons: [{ instanceId: 'invalid', weaponId: 'double-axe', powerLevel: 251, enchantmentSlots: [{ candidates: ['anima-conduit'] }] }], artifacts: [] } })
    expect(() => deserializeInventory(invalid)).toThrow('Soul gear限定')
    const supportedInventory = { ...inventory, weapons: [{ ...inventory.weapons[0]!, weaponId: 'soul-scythe' as const, enchantmentSlots: [{ candidates: ['enigma-resonator'] }] }] }
    expect(deserializeInventory(serializeInventory(supportedInventory)).weapons[0]?.enchantmentSlots[0]?.candidates).toEqual(['enigma-resonator'])
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

import { describe, expect, it } from 'vitest'
import type { Inventory } from '../src/core'
import { deserializeInventory, serializeInventory } from '../src/inventory/storage'

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
}

describe('inventory JSON', () => {
  it('round-trips owned items including duplicate artifact definitions', () => {
    expect(deserializeInventory(serializeInventory(inventory))).toEqual(inventory)
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
})

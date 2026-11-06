import { describe, expect, it } from 'vitest'
import { deserializeInventory, serializeInventory } from '../src/inventory/storage'
import { inspectInventoryReadiness, optimizeWithMetadata } from '../src/core/optimizer'
import { evaluate } from '../src/core/evaluate'
import { DEFAULT_SCENARIO } from '../src/data/scenarios'
import { readinessMelee } from './inventoryReadinessFixtures'
import { inventoryGridItems, inventoryGridItemMatchesQuery } from '../src/inventory/gridPresentation'
import { inventoryStatistics } from '../src/inventory/collection'

// Historical schema fixtures, not gameplay measurements or adopted Research.
const legacyItem = (catalogId: string) => ({
  instanceId: `old-${catalogId}`, category: 'armor', catalogId, powerLevel: 251,
  rarity: catalogId === 'dark-armor' ? 'rare' : 'unique', isFavorite: true, notes: '保持する個体メモ',
  enchantmentSlots: [{ candidates: ['chilling', 'thorns'], selected: { enchantmentId: 'chilling', tier: 2 } }],
  gilded: { enchantmentId: 'health-synergy', tier: 1 },
  research: {
    enchantments: [{ enchantmentId: 'health-synergy', tier: 1, source: 'gilded' }, { enchantmentId: 'chilling', tier: 2, source: 'slot' }],
    intrinsicProperties: [{ kind: 'damage-reduction', raw: '35% damage reduction' }],
    observations: [{ parameterId: 'health', value: '9999', unit: 'HP', gameVersion: '1.17.0.0', conditions: 'unaccepted', notes: 'not a runtime input' }],
  },
})

describe('Dark Armor Catalog compatibility', () => {
  it.each([1, 2, 3, 4, 5, 6])('migrates both previous Catalog identities losslessly and idempotently from schema %s', (version) => {
    const items = ['dark-armor', 'titan-s-shroud'].map(legacyItem)
    const existing = { instanceId: 'keep', armorId: 'battle-robe', powerLevel: 100, enchantmentSlots: [] }
    const other = { instanceId: 'other', category: 'armor', catalogId: 'archer-s-armor', powerLevel: 251 }
    const restored = deserializeInventory(JSON.stringify({ version, inventory: { ...readinessMelee, armors: [existing], catalogItems: [items[0], other, items[1]] } }))
    expect(restored.armors?.[0]).toEqual(existing)
    expect(restored.catalogItems).toEqual([other])
    for (const [index, item] of items.entries()) {
      const { category, catalogId, ...fields } = item
      expect(category).toBe('armor')
      expect(restored.armors?.[index + 1]).toEqual({ ...fields, armorId: catalogId })
      expect(restored.armors?.[index + 1]?.observedHealthBonus).toBeUndefined()
    }
    const reloaded = deserializeInventory(serializeInventory(restored))
    expect(reloaded).toEqual(restored)
    expect(deserializeInventory(serializeInventory(reloaded))).toEqual(restored)
  })

  it.each(['dark-armor', 'titan-s-shroud'])('keeps %s unevaluated until explicit HP is supplied, then reaches optimize without Research becoming values', (id) => {
    const item = legacyItem(id)
    const restored = deserializeInventory(JSON.stringify({ version: 6, inventory: { ...readinessMelee, catalogItems: [item] } }))
    const report = inspectInventoryReadiness(restored, DEFAULT_SCENARIO)
    expect(report.equipment.find((entry) => entry.instanceId === item.instanceId)).toMatchObject({ status: 'input-required' })
    const completed = { ...restored, armors: restored.armors!.map((armor) => ({ ...armor, observedHealthBonus: 400 })) }
    const result = optimizeWithMetadata(completed, DEFAULT_SCENARIO)
    expect(result.evaluatedInstanceIds).toContain(item.instanceId)
    expect(result.result.best.build.armor?.observedHealthBonus).toBe(400)
    expect(result.result.best.build.armorEnchantments).toEqual([
      { enchantmentId: 'chilling', tier: 2, source: 'slot' },
      { enchantmentId: 'health-synergy', tier: 1, source: 'gilded' },
    ])
    expect(result.result.best.build.armor?.research).toEqual(item.research)
  })

  it('does not infer slots, gilded or HP from Research when actual rolls were never recorded', () => {
    const item = { ...legacyItem('dark-armor'), enchantmentSlots: undefined, gilded: undefined }
    const restored = deserializeInventory(JSON.stringify({ version: 6, inventory: { weapons: [], artifacts: [], catalogItems: [item] } }))
    expect(restored.armors?.[0]).toMatchObject({ enchantmentSlots: [], research: item.research })
    expect(restored.armors?.[0]?.gilded).toBeUndefined()
    expect(restored.armors?.[0]?.observedHealthBonus).toBeUndefined()
    const presentation = inventoryGridItems(restored)[0]!
    expect(presentation.gilded).toBe(true) // existing inert Catalog organization hint
    expect(presentation.gildedEnchantment).toBeUndefined()
    expect(inventoryGridItemMatchesQuery(presentation, 'health-synergy')).toBe(true)
    expect(inventoryStatistics(restored).gildedItems).toBe(1)
  })

  it('preserves unsupported actual alternatives and rejects collisions or noneligible Catalog IDs', () => {
    const item = { ...legacyItem('dark-armor'), enchantmentSlots: [{ candidates: ['chilling', 'thorns'] }] }
    const restored = deserializeInventory(JSON.stringify({ version: 6, inventory: { ...readinessMelee, catalogItems: [item] } }))
    expect(restored.armors?.[0]?.enchantmentSlots).toEqual(item.enchantmentSlots)
    expect(inspectInventoryReadiness(restored, DEFAULT_SCENARIO).equipment.find((entry) => entry.instanceId === item.instanceId)?.status).toBe('unsupported')
    const document = (catalogItems: unknown[], armors: unknown[] = []) => JSON.stringify({ version: 6, inventory: { weapons: [], artifacts: [], catalogItems, armors } })
    expect(() => deserializeInventory(document([item], [{ instanceId: item.instanceId, armorId: 'battle-robe', powerLevel: 251, enchantmentSlots: [] }]))).toThrow('重複')
    expect(() => deserializeInventory(document([{ ...item, catalogId: 'invented-armor' }]))).toThrow('監査済み')
    expect(() => deserializeInventory(document([{ ...item, category: 'melee' }]))).toThrow('監査済み')
    expect(() => deserializeInventory(document([{ ...item, catalogId: 'battle-robe' }]))).toThrow('監査済み')
  })

  it('never ignores unreconciled recorded effects after HP and actual slots are filled', () => {
    const source = legacyItem('dark-armor')
    const matched = deserializeInventory(JSON.stringify({ version: 6, inventory: { ...readinessMelee, catalogItems: [source] } }))
    const baseline = optimizeWithMetadata({ ...matched, armors: matched.armors!.map((armor) => ({ ...armor, observedHealthBonus: 400 })) }, DEFAULT_SCENARIO).result.best.build
    const patches = [
      { gilded: undefined },
      { research: { ...source.research, enchantments: [{ enchantmentId: 'protection', tier: 3, source: 'gilded' }] } },
      { research: { ...source.research, enchantments: [...source.research.enchantments, ...source.research.enchantments] } },
      { research: { ...source.research, enchantments: [{ enchantmentId: 'health-synergy', tier: 1, source: 'built-in' }] } },
      { research: { ...source.research, enchantments: [{ enchantmentId: 'thorns', tier: 3, source: 'slot' }] } },
      { research: { ...source.research, enchantments: [{ enchantmentId: 'chilling', tier: 2, source: 'slot' }, { enchantmentId: 'chilling', tier: 2, source: 'slot' }] } },
      { research: { ...source.research, intrinsicProperties: [{ kind: 'unreviewed', raw: 'unknown effect' }] } },
    ]
    for (const patch of patches) {
      const restored = deserializeInventory(JSON.stringify({ version: 6, inventory: { ...readinessMelee, catalogItems: [{ ...source, ...patch }] } }))
      const completed = { ...restored, armors: restored.armors!.map((armor) => ({ ...armor, observedHealthBonus: 400 })) }
      expect(() => optimizeWithMetadata(completed, DEFAULT_SCENARIO)).toThrow(/UNSUPPORTED_ARMOR_RESEARCH/)
      const armor = completed.armors[0]!
      const armorEnchantments = baseline.armorEnchantments!.filter((effect) => armor.gilded || effect.source !== 'gilded')
      expect(() => evaluate({ ...baseline, armor, armorEnchantments }, DEFAULT_SCENARIO)).toThrow(/UNSUPPORTED_ARMOR_RESEARCH/)
      expect(deserializeInventory(serializeInventory(completed))).toEqual(completed)
    }
  })
})

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { Inventory } from '../src/core'
import { InventoryGameGrid, VisualEquipmentPicker } from '../src/components/InventoryGameGrid'
import { getEquipmentCatalogEntry, type EquipmentCatalogEntry } from '../src/data/equipmentCatalog'
import { inventoryGridItems } from '../src/inventory/gridPresentation'
import { equipmentDisplaySections } from '../src/data/equipmentPresentation'
import { deserializeInventory, serializeInventory } from '../src/inventory/storage'
import { hrefForEquipment } from '../src/app/routes'

const inventory: Inventory = {
  weapons: [
    { instanceId: 'common-axe', weaponId: 'double-axe', powerLevel: 250, rarity: 'rare', enchantmentSlots: [{ candidates: ['critical-hit'] }] },
    { instanceId: 'gilded-soul', weaponId: 'soul-scythe', powerLevel: 251, rarity: 'unique', enchantmentSlots: [{ candidates: ['anima-conduit'] }], gilded: { enchantmentId: 'soul-siphon', tier: 3 } },
  ],
  armors: [], rangedWeapons: [], artifacts: [], catalogItems: [],
}

describe('inventory and data presentation', () => {
  it('renders every owned instance as an accessible selectable game slot', () => {
    const html = renderToStaticMarkup(createElement(InventoryGameGrid, { inventory, onChange: () => undefined, onOpenFullEditor: () => undefined, query: '', category: 'all', gilded: 'all', sort: 'recent' }))
    expect(inventoryGridItems(inventory)).toHaveLength(2)
    expect(html.match(/role="option"/g)).toHaveLength(2)
    expect(html).toContain('aria-label="両刃斧、Double Axe"')
    expect(html).toContain('data-rarity="rare"')
    expect(html).toContain('data-gilded="true"')
    expect(html).toContain('Soul 装備')
    expect(html).toContain('Power')
    expect(html).toContain('role="tooltip"')
    expect(html).toContain('<strong>両刃斧</strong><small lang="en">Double Axe</small>')
  })

  it('filters the visual picker by class and Japanese or English search text', () => {
    const japanese = renderToStaticMarkup(createElement(VisualEquipmentPicker, { category: 'melee', classFilter: 'normal', query: '両刃斧', selectedKey: '', onSelect: () => undefined }))
    const english = renderToStaticMarkup(createElement(VisualEquipmentPicker, { category: 'melee', classFilter: 'normal', query: 'Double Axe', selectedKey: '', onSelect: () => undefined }))
    const unique = renderToStaticMarkup(createElement(VisualEquipmentPicker, { category: 'melee', classFilter: 'unique', query: 'Encrusted Anchor', selectedKey: '', onSelect: () => undefined }))
    expect(japanese).toContain('Double Axe')
    expect(english).toContain('両刃斧')
    expect(unique).toContain('Encrusted Anchor')
  })

  it('round-trips optional rarity while continuing to accept old v4 documents', () => {
    expect(deserializeInventory(serializeInventory(inventory)).weapons.map((item) => item.rarity)).toEqual(['rare', 'unique'])
    const legacy = JSON.stringify({ version: 4, inventory: { weapons: [{ instanceId: 'legacy', weaponId: 'double-axe', powerLevel: 251, enchantmentSlots: [{ candidates: ['critical-hit'] }] }], artifacts: [] } })
    expect(deserializeInventory(legacy).weapons[0]?.rarity).toBeUndefined()
  })

  it('keeps a category-specific field structure and renders missing facts as dashes', () => {
    const melee = equipmentDisplaySections({ category: 'melee', nameJa: 'ダブルアックス', nameEn: 'Double Axe', family: 'axe', facts: [] })
    const ranged = equipmentDisplaySections({ category: 'ranged', nameJa: '弓', nameEn: 'Bow', family: 'bow', facts: [{ property: 'ammo', value: 99, status: 'accepted' }] })
    const armor = equipmentDisplaySections({ category: 'armor', nameJa: '防具', family: 'armor', facts: [] })
    const artifact = equipmentDisplaySections({ category: 'artifact', nameJa: 'キノコ', family: 'artifact', facts: [] })
    expect(melee.flatMap((section) => section.fields).find((field) => field.id === 'combo')?.value).toBe('—')
    expect(ranged.flatMap((section) => section.fields).find((field) => field.id === 'ammo')?.value).toBe('99')
    expect(armor.flatMap((section) => section.fields).some((field) => field.id === 'health')).toBe(true)
    expect(artifact.flatMap((section) => section.fields).some((field) => field.id === 'cooldown')).toBe(true)
  })

  it('prefers structured catalog presentation values without Harvest duplication', () => {
    const catalog: EquipmentCatalogEntry = {
      category: 'armor', id: 'fixture', name: { ja: '試験防具', en: 'Fixture Armor' }, runtimeSupport: 'unsupported', legacyRuntimeSupport: 'research-only', auditStatus: 'audited',
      family: 'soul-robe', rarityFamily: 'unique', soulGear: true,
      intrinsicProperties: [{ kind: 'soul-gathering', raw: '+50% soul gathering' }], builtInEnchantments: [{ enchantmentId: 'cool-down', tier: 1 }],
    }
    const fields = equipmentDisplaySections({ category: 'armor', nameJa: catalog.name.ja!, nameEn: catalog.name.en, family: 'fallback', catalog, facts: [] }).flatMap((section) => section.fields)
    expect(fields.find((field) => field.id === 'rarity')?.value).toBe('Unique')
    expect(fields.find((field) => field.id === 'soul')?.value).toBe('あり')
    expect(fields.find((field) => field.id === 'intrinsic')?.value).toContain('+50% soul gathering')
    expect(fields.find((field) => field.id === 'builtIn')?.value).toBe('cool-down Tier 1')
  })

  it('targets an exact equipment entry and marks audited catalog-only Soul gear', () => {
    expect(hrefForEquipment('/data/melee', 'double-axe')).toBe('#/data/melee?item=double-axe')
    const soulGear = getEquipmentCatalogEntry('melee', 'moon-daggers')
    expect(soulGear?.runtimeSupport).toBe('unsupported')
    expect(soulGear?.soulGear).toBe(true)
  })
})

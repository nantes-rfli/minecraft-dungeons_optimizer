import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { Inventory } from '../src/core'
import { GildedEnchantmentEditor } from '../src/components/GildedEnchantmentEditor'
import { EnchantmentSlotEditor } from '../src/components/EnchantmentSlotEditor'
import { addEnchantmentCandidate, availableEnchantments } from '../src/components/enchantmentPicker'
import { DataBrowserPage } from '../src/screens/DataBrowserPage'
import { inventoryStatistics } from '../src/inventory/collection'
import { InventoryStatisticsView } from '../src/WorkspaceApp'
import { resolveEnchantment } from '../src/data/enchantmentCatalog'

describe('enchantment UX final fix-up', () => {
  it('does not create a normal slot until the user chooses its first candidate', () => {
    const original: readonly [] = []
    const html = renderToStaticMarkup(createElement(EnchantmentSlotEditor, { slots: original, category: 'melee', soulGear: false, onChange: () => undefined }))
    expect(original).toEqual([])
    expect(html).toContain('＋ スロットを追加')
    expect(addEnchantmentCandidate(original, 0, 'critical-hit')).toEqual([{ candidates: ['critical-hit'] }])
  })

  it('uses an independent visual add/change/remove flow for gilded enchantments', () => {
    const empty = renderToStaticMarkup(createElement(GildedEnchantmentEditor, { category: 'ranged', soulGear: false, onChange: () => undefined }))
    expect(empty).toContain('＋ 金色エンチャントを追加')
    expect(empty).not.toContain('type="checkbox"')
    const selected = renderToStaticMarkup(createElement(GildedEnchantmentEditor, { value: { enchantmentId: 'void-strike', tier: 2 }, category: 'ranged', soulGear: false, onChange: () => undefined }))
    expect(selected).toContain('/assets/enchantments/void-strike-ranged.webp')
    expect(selected).toContain('変更')
    expect(selected).toContain('削除')
    expect(selected).toContain('Tier II')
  })

  it('filters gilded choices by category, availability, and Soul gear', () => {
    const normal = availableEnchantments('ranged', false, 'gilded')
    const soul = availableEnchantments('ranged', true, 'gilded')
    expect(normal.every((entry) => entry.availability.gilded && entry.applicableCategories.includes('ranged') && !entry.soulGearOnly)).toBe(true)
    expect(normal.every((entry) => soul.some((candidate) => candidate.id === entry.id))).toBe(true)
  })

  it('renders the enchantment catalog with icon-only diamonds and a dedicated comparison layout', () => {
    const html = renderToStaticMarkup(createElement(DataBrowserPage, { route: '/data/enchantments' }))
    expect(html).toContain('enchantment-diamond--icon-only')
    expect(html).toContain('aria-label="基本情報"')
    expect(html).toContain('<table>')
    expect(html).toContain('Tier比較')
    expect(html).toContain('入手形態')
    expect(html).toContain('内部ID')
    expect(html).not.toContain('class="property-table"')
    expect(html).not.toContain('enchantment-detail-header')
    const critical = resolveEnchantment('critical-hit')!
    expect(html.split(critical.name.ja!).length - 1).toBe(1)
    expect(html.split(critical.name.en).length - 1).toBe(1)
  })

  it('counts owned-model gilded values first and resolves research-only names canonically', () => {
    const inventory: Inventory = {
      weapons: [], armors: [], rangedWeapons: [], artifacts: [],
      catalogItems: [{
        instanceId: 'catalog-1', category: 'armor', catalogId: 'hungry-horror', powerLevel: 251,
        gilded: { enchantmentId: 'tumblebee', tier: 3 },
        research: { enchantments: [{ enchantmentId: 'burning', tier: 3, source: 'gilded' }] },
      }],
    }
    const stats = inventoryStatistics(inventory)
    expect(stats.gildedItems).toBe(1)
    expect(stats.enchantments).toContainEqual(expect.objectContaining({ id: 'tumblebee', name: 'タンブルビー', count: 1 }))
    expect(stats.enchantments.some((entry) => entry.id === 'burning')).toBe(false)
    const html = renderToStaticMarkup(createElement(InventoryStatisticsView, { inventory }))
    expect(html).toContain('enchantment-diamond--compact')
    expect(html).toContain('タンブルビー')
    expect(html).toContain('/assets/enchantments/tumblebee.webp')
  })

  it('keeps the legacy research gilded fallback when the owned field is absent', () => {
    const inventory: Inventory = {
      weapons: [], armors: [], rangedWeapons: [], artifacts: [],
      catalogItems: [{
        instanceId: 'legacy-catalog', category: 'armor', catalogId: 'hungry-horror', powerLevel: 251,
        research: { enchantments: [{ enchantmentId: 'burning', tier: 3, source: 'gilded' }] },
      }],
    }
    const stats = inventoryStatistics(inventory)
    expect(stats.gildedItems).toBe(1)
    expect(stats.enchantments).toContainEqual(expect.objectContaining({ id: 'burning', count: 1 }))
  })
})

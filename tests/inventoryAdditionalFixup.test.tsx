import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { CatalogInventoryItem, Inventory } from '../src/core'
import { InventoryDeleteButton } from '../src/components/InventoryDeleteButton'
import { groupCatalogItemsByCategory } from '../src/inventory/catalogPresentation'
import { CatalogInventoryItems, InventoryStatisticsView } from '../src/WorkspaceApp'

const catalogItems: readonly CatalogInventoryItem[] = [
  { instanceId: 'melee-item', category: 'melee', catalogId: 'diamond-sword', powerLevel: 251 },
  { instanceId: 'armor-item', category: 'armor', catalogId: 'hungry-horror', powerLevel: 250 },
  { instanceId: 'ranged-item', category: 'ranged', catalogId: 'bow-of-lost-souls', powerLevel: 249 },
  { instanceId: 'artifact-item', category: 'artifact', catalogId: 'blast-fungus', powerLevel: 248 },
]

const inventory: Inventory = { weapons: [], armors: [], rangedWeapons: [], artifacts: [], catalogItems }

describe('inventory enchantment additional fix-up', () => {
  it('groups catalog-backed items into real equipment categories exactly once', () => {
    const grouped = groupCatalogItemsByCategory(catalogItems)
    expect(grouped.melee.map((item) => item.instanceId)).toEqual(['melee-item'])
    expect(grouped.armor.map((item) => item.instanceId)).toEqual(['armor-item'])
    expect(grouped.ranged.map((item) => item.instanceId)).toEqual(['ranged-item'])
    expect(grouped.artifact.map((item) => item.instanceId)).toEqual(['artifact-item'])
    expect(Object.values(grouped).flat().map((item) => item.instanceId).sort()).toEqual(catalogItems.map((item) => item.instanceId).sort())
  })

  it('keeps catalog-backed editing while removing the separate collection section', () => {
    const html = renderToStaticMarkup(createElement(CatalogInventoryItems, { inventory, onChange: () => undefined, items: groupedMelee() }))
    expect(html).toContain('パワー')
    expect(html).toContain('レアリティ')
    expect(html).toContain('エンチャント')
    expect(html).toContain('GILDED ENCHANTMENT')
    expect(html).toContain('ダイヤモンドの剣を削除')
    expect(html).not.toContain('COLLECTION ITEMS')
    expect(html).not.toContain('コレクション装備')
  })

  it('renders concrete accessible danger delete controls', () => {
    const html = renderToStaticMarkup(createElement(InventoryDeleteButton, { label: 'テスト装備', onClick: () => undefined }))
    expect(html).toContain('class="danger-button"')
    expect(html).toContain('aria-label="テスト装備を削除"')
    expect(html).toContain('>削除</button>')
  })

  it('uses category-neutral artwork for cross-category enchantment statistics', () => {
    const statsInventory: Inventory = {
      weapons: [{ instanceId: 'melee', weaponId: 'fighters-bindings', powerLevel: 251, enchantmentSlots: [{ candidates: ['void-strike'], selected: { enchantmentId: 'void-strike', tier: 3 } }] }],
      armors: [], rangedWeapons: [], artifacts: [],
      catalogItems: [{ instanceId: 'ranged', category: 'ranged', catalogId: 'bow-of-lost-souls', powerLevel: 251, enchantmentSlots: [{ candidates: ['void-strike'], selected: { enchantmentId: 'void-strike', tier: 2 } }] }],
    }
    const html = renderToStaticMarkup(createElement(InventoryStatisticsView, { inventory: statsInventory }))
    expect(html).toContain('虚無の一撃')
    expect(html).not.toContain('void-strike-melee.webp')
    expect(html).not.toContain('void-strike-ranged.webp')
  })
})

function groupedMelee(): readonly CatalogInventoryItem[] {
  return groupCatalogItemsByCategory(catalogItems).melee
}

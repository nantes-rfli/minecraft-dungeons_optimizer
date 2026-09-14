import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { CatalogInventoryItem, Inventory } from '../src/core'
import type { OwnedArmor } from '../src/core/armor'
import type { OwnedRangedWeapon } from '../src/core/rangedTypes'
import { getEquipmentCatalogEntry } from '../src/data/equipmentCatalog'
import { deserializeInventory, serializeInventory } from '../src/inventory/storage'
import { DataBrowserPage } from '../src/screens/DataBrowserPage'
import { CatalogInventoryItems, OwnedArmorEditor, OwnedArtifactEditor, OwnedMeleeEditor } from '../src/WorkspaceApp'
import { OwnedRangedEditor } from '../src/views/RangedEquipment'

const runtimeInventory: Inventory = {
  weapons: [{ instanceId: 'runtime-melee', weaponId: 'fighters-bindings', powerLevel: 251, rarity: 'unique', notes: '近接メモ', observedDamagePerHit: 123456, enchantmentSlots: [] }],
  armors: [{ instanceId: 'runtime-armor', armorId: 'battle-robe', powerLevel: 251, rarity: 'rare', notes: '防具メモ', observedHealthBonus: 98765, enchantmentSlots: [] }],
  rangedWeapons: [{ instanceId: 'runtime-ranged', weaponId: 'bow', powerLevel: 251, rarity: 'common', notes: '遠距離メモ', enchantmentSlots: [] }],
  artifacts: [{ instanceId: 'runtime-artifact', artifactId: 'death-cap-mushroom', powerLevel: 251, notes: 'アーティファクトメモ' }],
}

const catalogItems: readonly CatalogInventoryItem[] = [
  { instanceId: 'catalog-melee', category: 'melee', catalogId: 'diamond-sword', powerLevel: 251, rarity: 'rare', notes: 'カタログ近接', enchantmentSlots: [] },
  { instanceId: 'catalog-armor', category: 'armor', catalogId: 'hungry-horror', powerLevel: 250, rarity: 'unique', notes: 'カタログ防具', enchantmentSlots: [] },
  { instanceId: 'catalog-ranged', category: 'ranged', catalogId: 'bow-of-lost-souls', powerLevel: 249, rarity: 'unique', notes: 'カタログ遠距離', enchantmentSlots: [] },
  { instanceId: 'catalog-artifact', category: 'artifact', catalogId: 'blast-fungus', powerLevel: 248, notes: 'カタログアーティファクト' },
]

const noop = () => undefined
function renderRuntimeEditors(): Record<string, string> {
  return {
    melee: renderToStaticMarkup(createElement(OwnedMeleeEditor, { weapon: runtimeInventory.weapons[0]!, onChange: noop, onRemove: noop })),
    armor: renderToStaticMarkup(createElement(OwnedArmorEditor, { armor: runtimeInventory.armors![0] as OwnedArmor, onChange: noop, onRemove: noop })),
    ranged: renderToStaticMarkup(createElement(OwnedRangedEditor, { weapon: runtimeInventory.rangedWeapons![0] as OwnedRangedWeapon, onChange: noop, onRemove: noop })),
    artifact: renderToStaticMarkup(createElement(OwnedArtifactEditor, { artifact: runtimeInventory.artifacts[0]!, onChange: noop, onRemove: noop })),
  }
}

function renderCatalogEditors(): Record<string, string> {
  const inventory = { ...runtimeInventory, catalogItems }
  return Object.fromEntries(catalogItems.map((item) => [item.category, renderToStaticMarkup(createElement(CatalogInventoryItems, { inventory, items: [item], onChange: noop }))]))
}

function equipmentRow(html: string, id: string): string {
  const start = html.indexOf(`data-equipment-id="${id}"`)
  expect(start).toBeGreaterThanOrEqual(0)
  const next = html.indexOf('<details class="catalog-row"', start + 1)
  return html.slice(start, next < 0 ? undefined : next)
}

describe('unified equipment editor and Data Browser cleanup', () => {
  it('uses the same base editor shell for all eight runtime and catalog-backed category combinations', () => {
    const runtime = renderRuntimeEditors()
    const catalog = renderCatalogEditors()

    for (const source of [runtime, catalog]) {
      for (const category of ['melee', 'armor', 'ranged', 'artifact']) {
        const html = source[category]!
        expect(html).toContain(`class="editor-body equipment-instance-editor" data-category="${category}"`)
        expect(html).toContain('>個体情報</h3>')
        expect(html).toContain('>Power<input')
        expect(html).toContain('自分用メモ')
        expect(html).toContain('class="equipment-editor-actions"')
        expect(html).toContain('>削除</button>')
        if (category === 'artifact') {
          expect(html).not.toContain('equipment-rarity-field')
          expect(html).not.toContain('enchantment-slot-editor')
          expect(html).not.toContain('gilded-enchantment-editor')
        } else {
          expect(html).toContain('equipment-rarity-field')
          expect(html).toContain('enchantment-slot-editor')
          expect(html).toContain('gilded-enchantment-editor')
        }
      }
    }
  })

  it('keeps runtime-only measurements under 詳細値 and does not add them to catalog-backed editors', () => {
    const runtime = renderRuntimeEditors()
    const catalog = renderCatalogEditors()
    expect(runtime.melee).toContain('詳細値')
    expect(runtime.melee).toContain('表示ダメージ')
    expect(runtime.armor).toContain('詳細値')
    expect(runtime.armor).toContain('追加HP')
    expect(runtime.ranged).toContain('詳細値')
    expect(runtime.ranged).toContain('通常矢の記録')
    expect(runtime.artifact).not.toContain('詳細値')
    expect(Object.values(catalog).every((html) => !html.includes('詳細値'))).toBe(true)
  })

  it('offers only rarity values valid for the fixed catalog family', () => {
    const runtime = renderRuntimeEditors()
    const catalog = renderCatalogEditors()
    expect(runtime.melee).toContain('<option value="unique"')
    expect(runtime.melee).not.toContain('<option value="common">Common</option>')
    expect(runtime.armor).toContain('<option value="common">Common</option>')
    expect(runtime.armor).not.toContain('<option value="unique">Unique</option>')
    expect(catalog.armor).toContain('<option value="unique"')
    expect(catalog.armor).not.toContain('<option value="rare">Rare</option>')
  })

  it('round-trips optional personal notes for every runtime equipment category', () => {
    expect(deserializeInventory(serializeInventory(runtimeInventory))).toEqual(runtimeInventory)
  })

  it.each([
    ['/data/melee', 'anchor'],
    ['/data/ranged', 'bow-of-lost-souls'],
    ['/data/armor', 'hungry-horror'],
    ['/data/artifacts', 'blast-fungus'],
  ] as const)('shows each equipment name and artwork only in the Data Browser summary for %s', (route, id) => {
    const catalog = getEquipmentCatalogEntry(route === '/data/artifacts' ? 'artifact' : route.slice('/data/'.length) as 'melee' | 'ranged' | 'armor', id)!
    const html = renderToStaticMarkup(createElement(DataBrowserPage, { route }))
    const row = equipmentRow(html, id)
    expect(row.match(new RegExp(`<strong>${catalog.name.ja!}</strong>`, 'g'))).toHaveLength(1)
    expect(row.match(new RegExp(`<small lang="en">${catalog.name.en}</small>`, 'g'))).toHaveLength(1)
    expect(row.match(/class="equipment-artwork compact"/g)).toHaveLength(1)
    expect(row).not.toContain('<dt>日本語名</dt>')
    expect(row).not.toContain('<dt>英語名</dt>')
    expect(row).not.toContain('catalog-detail-header')
  })

  it('keeps the common fields fluid at two columns and collapses them to one column on small screens', () => {
    const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8')
    expect(css).toMatch(/\.equipment-instance-fields\s*\{[^}]*grid-template-columns:\s*minmax\(90px, 120px\) minmax\(140px, 200px\)/s)
    expect(css).toMatch(/\.equipment-instance-fields input[^}]*min-width:\s*0;[^}]*width:\s*100%/s)
    expect(css).toMatch(/@media \(max-width: 410px\)[\s\S]*?\.equipment-instance-fields\s*\{\s*grid-template-columns:\s*1fr;/)
  })
})

import fs from 'node:fs'
import path from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import manifest from '../generated/equipment-icons/manifest.json'
import uiManifest from '../generated/ui-icons/manifest.json'
import { auditManifest, auditUiManifest, decodeDxt5, equipmentIconWebPath, type EquipmentIconManifest, type UiIconManifest } from '../scripts/equipment-icons'
import { InventoryGameGrid, SelectedEquipmentPane, VisualEquipmentPicker } from '../src/components/InventoryGameGrid'
import { EquipmentArtwork, EquipmentCategoryIcon, SoulMarker } from '../src/components/EquipmentArtwork'
import { shouldRenderUiIcon } from '../src/components/uiIconState'
import { DataBrowserPage } from '../src/screens/DataBrowserPage'
import type { Inventory } from '../src/core'
import { EQUIPMENT_CATALOG, getEquipmentCatalogEntry, type EquipmentCatalogEntry } from '../src/data/equipmentCatalog'
import { inventoryGridItems } from '../src/inventory/gridPresentation'

const repositoryRoot = path.resolve(import.meta.dirname, '..')

describe('equipment icon extraction and integration', () => {
  it('derives category-specific safe output paths from catalog IDs', () => {
    expect(equipmentIconWebPath('melee', 'double-axe')).toBe('/assets/equipment/melee/double-axe.webp')
    expect(equipmentIconWebPath('artifact', 'death-cap-mushroom')).toBe('/assets/equipment/artifact/death-cap-mushroom.webp')
    expect(equipmentIconWebPath('armor', '../escape')).toBeUndefined()
  })

  it('covers every catalog entry with a valid, unique manifest status', () => {
    expect(manifest.entries).toHaveLength(EQUIPMENT_CATALOG.length)
    expect(auditManifest(manifest as EquipmentIconManifest)).toEqual([])
    expect(new Set(manifest.entries.map((entry) => `${entry.category}:${entry.catalogId}`)).size).toBe(manifest.entries.length)
    expect(manifest.entries.filter((entry) => entry.status === 'not-found').map((entry) => entry.catalogId)).toEqual(['ender-armor', 'vanguard-armor'])
  })

  it('keeps every matched WebP decodable, non-empty, and within 128 pixels', async () => {
    const matched = manifest.entries.filter((entry) => entry.status === 'matched')
    expect(matched).toHaveLength(269)
    for (const entry of matched) {
      expect(entry.sourceAsset).toBeTruthy()
      expect(entry.outputWebp).toBeTruthy()
      const absolute = path.join(repositoryRoot, entry.outputWebp!)
      expect(fs.statSync(absolute).size).toBeGreaterThan(0)
      const metadata = await sharp(absolute).metadata()
      expect(metadata.format).toBe('webp')
      expect(metadata.width).toBeGreaterThan(0)
      expect(metadata.height).toBeGreaterThan(0)
      expect(metadata.width).toBeLessThanOrEqual(128)
      expect(metadata.height).toBeLessThanOrEqual(128)
    }
  }, 30_000)

  it('decodes DXT5 alpha endpoints and keeps transparent pixels', () => {
    const block = Buffer.alloc(16)
    block[0] = 0
    block[1] = 255
    block.writeUInt16LE(0xffff, 8)
    block.writeUInt16LE(0, 10)
    const decoded = decodeDxt5(block, 4, 4)
    expect(decoded).toHaveLength(64)
    expect(decoded[3]).toBe(0)
    expect(decoded[0]).toBe(255)
  })

  it('renders an image when the catalog has an icon and the existing fallback otherwise', () => {
    const matched = getEquipmentCatalogEntry('melee', 'double-axe')!
    const fallback: EquipmentCatalogEntry = { ...matched, id: 'fallback', icon: undefined }
    const imageHtml = renderToStaticMarkup(createElement(EquipmentArtwork, { catalog: matched }))
    expect(imageHtml).toContain(`<img src="${matched.icon}"`)
    expect(imageHtml).toContain('width="128" height="128" loading="lazy" decoding="async" fetchPriority="low"')
    expect(renderToStaticMarkup(createElement(EquipmentArtwork, { catalog: matched, priority: true }))).toContain('loading="eager" decoding="async" fetchPriority="high"')
    const fallbackHtml = renderToStaticMarkup(createElement(EquipmentArtwork, { catalog: fallback }))
    expect(fallbackHtml).not.toContain('<img')
    expect(fallbackHtml).toContain('⚔')
  })

  it('tracks and renders the extracted Soul and equipment category UI icons', async () => {
    expect(auditUiManifest(uiManifest as UiIconManifest, true)).toEqual([])
    expect(uiManifest.entries).toHaveLength(5)
    for (const entry of uiManifest.entries) {
      expect(entry.status).toBe('matched')
      const metadata = await sharp(path.join(repositoryRoot, entry.outputWebp)).metadata()
      expect(metadata.format).toBe('webp')
      expect(metadata.width).toBeGreaterThan(0)
      expect(metadata.height).toBeGreaterThan(0)
      expect(metadata.width).toBeLessThanOrEqual(64)
      expect(metadata.height).toBeLessThanOrEqual(64)
    }
    expect(Object.fromEntries(uiManifest.entries.map((entry) => [entry.id, entry.sourceAsset]))).toMatchObject({
      'category-melee': 'Dungeons/Content/UI/Materials/Inventory2/Filter/filter_melee',
      'category-ranged': 'Dungeons/Content/UI/Materials/Inventory2/Filter/filter_ranged',
      'category-armor': 'Dungeons/Content/UI/Materials/MissionSelectMap/marker/shield_dungeon',
      'category-artifact': 'Dungeons/Content/UI/Materials/Inventory2/Filter/filter_consume',
    })
    expect(renderToStaticMarkup(createElement(SoulMarker))).toContain('src="/assets/ui/soul.webp"')
    expect(renderToStaticMarkup(createElement(EquipmentCategoryIcon, { category: 'melee' }))).toContain('src="/assets/ui/category-melee.webp"')
  })

  it('keeps category and Soul fallbacks available after missing or failed image loads', () => {
    expect(shouldRenderUiIcon(undefined, undefined)).toBe(false)
    expect(shouldRenderUiIcon('/assets/ui/category-armor.webp', '/assets/ui/category-armor.webp')).toBe(false)
    expect(shouldRenderUiIcon('/assets/ui/category-armor.webp', undefined)).toBe(true)
  })

  it('shows the smaller Grid Soul marker only for Soul gear', () => {
    const baseProps = { onChange: () => undefined, onOpenFullEditor: () => undefined, query: '', category: 'all' as const, gilded: 'all' as const, sort: 'recent' as const }
    const soulInventory: Inventory = { weapons: [{ instanceId: 'moon-daggers-1', weaponId: 'moon-daggers', powerLevel: 251, rarity: 'unique', enchantmentSlots: [] }], artifacts: [] }
    const regularInventory: Inventory = { weapons: [{ instanceId: 'double-axe-1', weaponId: 'double-axe', powerLevel: 251, rarity: 'rare', enchantmentSlots: [] }], artifacts: [] }
    const soulHtml = renderToStaticMarkup(createElement(InventoryGameGrid, { ...baseProps, inventory: soulInventory }))
    const regularHtml = renderToStaticMarkup(createElement(InventoryGameGrid, { ...baseProps, inventory: regularInventory }))
    expect(soulHtml).toContain('class="soul-marker soul-marker--small"')
    expect(regularHtml).not.toContain('aria-label="Soul 装備"')
  })

  it('shares the catalog icon across picker, inventory grid data, and selected detail', () => {
    const catalog = getEquipmentCatalogEntry('melee', 'double-axe')!
    const inventory: Inventory = { weapons: [{ instanceId: 'double-axe-1', weaponId: 'double-axe', powerLevel: 251, rarity: 'rare', enchantmentSlots: [] }], artifacts: [] }
    const item = inventoryGridItems(inventory)[0]!
    const picker = renderToStaticMarkup(createElement(VisualEquipmentPicker, { category: 'melee', classFilter: 'normal', query: 'Double Axe', selectedKey: '', onSelect: () => undefined }))
    const detail = renderToStaticMarkup(createElement(SelectedEquipmentPane, { item, duplicateCount: 1, inventory, onChange: () => undefined, onOpenFullEditor: () => undefined, onClose: () => undefined }))
    expect(item.catalog.icon).toBe(catalog.icon)
    expect(picker).toContain(`src="${catalog.icon}"`)
    expect(detail).toContain(`src="${catalog.icon}"`)
    expect(detail).toContain('loading="eager"')
  })

  it('uses catalog artwork in the Data Browser list and detail header', () => {
    const catalog = getEquipmentCatalogEntry('melee', 'anchor')!
    const html = renderToStaticMarkup(createElement(DataBrowserPage, { route: '/data/melee' }))
    expect(html).toContain('class="catalog-identity"')
    expect(html).toContain('class="catalog-detail-header"')
    expect(html).toContain(`src="${catalog.icon}"`)
  })
})

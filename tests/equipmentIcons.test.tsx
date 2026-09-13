import fs from 'node:fs'
import path from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import manifest from '../generated/equipment-icons/manifest.json'
import { auditManifest, decodeDxt5, equipmentIconWebPath, type EquipmentIconManifest } from '../scripts/equipment-icons'
import { EquipmentArtwork, SelectedEquipmentPane, VisualEquipmentPicker } from '../src/components/InventoryGameGrid'
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
    expect(renderToStaticMarkup(createElement(EquipmentArtwork, { catalog: matched }))).toContain(`<img src="${matched.icon}"`)
    const fallbackHtml = renderToStaticMarkup(createElement(EquipmentArtwork, { catalog: fallback }))
    expect(fallbackHtml).not.toContain('<img')
    expect(fallbackHtml).toContain('⚔')
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
  })
})

import fs from 'node:fs'
import path from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import manifest from '../generated/enchantment-icons/manifest.json'
import { auditEnchantmentIconManifest, loadEnchantmentCatalog, type EnchantmentIconManifest } from '../scripts/enchantment-icons'
import { EnchantmentArtwork, EnchantmentIdentity } from '../src/components/EnchantmentArtwork'
import { shouldRenderUiIcon } from '../src/components/uiIconState'
import { SelectedEquipmentPane } from '../src/components/InventoryGameGrid'
import { DataBrowserPage } from '../src/screens/DataBrowserPage'
import { ENCHANTMENT_CATALOG, resolveEnchantment } from '../src/data/enchantmentCatalog'
import { inventoryGridItems } from '../src/inventory/gridPresentation'
import type { Inventory } from '../src/core'

const repositoryRoot = path.resolve(import.meta.dirname, '..')

describe('enchantment icon extraction and UI integration', () => {
  it('builds the catalog from the normalized audit union rather than runtime support', () => {
    expect(loadEnchantmentCatalog()).toHaveLength(97)
    expect(ENCHANTMENT_CATALOG).toHaveLength(97)
    expect(ENCHANTMENT_CATALOG.some((entry) => entry.id === 'tumblebee')).toBe(true)
    expect(new Set(ENCHANTMENT_CATALOG.map((entry) => entry.id)).size).toBe(97)
  })

  it('covers every catalog entry and preserves category-specific ambiguity', async () => {
    expect(await auditEnchantmentIconManifest(manifest as EnchantmentIconManifest, true)).toEqual([])
    expect(manifest.entries).toHaveLength(97)
    expect(manifest.entries.filter((entry) => entry.status === 'matched')).toHaveLength(93)
    expect(manifest.entries.filter((entry) => entry.status === 'multiple-candidates').map((entry) => entry.enchantmentId)).toEqual(['anima-conduit', 'dynamo', 'refreshment', 'void-strike'])
    expect(manifest.entries.filter((entry) => entry.status === 'multiple-candidates').every((entry) => Object.keys(entry.categoryOutputs ?? {}).length === 2)).toBe(true)
    expect(manifest.entries.filter((entry) => entry.status === 'not-found')).toEqual([])
  }, 30_000)

  it('keeps matched outputs decodable, non-empty, transparent-capable, and within 64 pixels', async () => {
    for (const entry of manifest.entries.filter((item) => item.status === 'matched')) {
      const output = path.join(repositoryRoot, entry.outputWebp!)
      expect(fs.statSync(output).size).toBeGreaterThan(0)
      const metadata = await sharp(output).metadata()
      const stats = await sharp(output).stats()
      expect(metadata.format).toBe('webp')
      expect(metadata.width).toBeGreaterThan(0)
      expect(metadata.height).toBeGreaterThan(0)
      expect(metadata.width).toBeLessThanOrEqual(64)
      expect(metadata.height).toBeLessThanOrEqual(64)
      expect(metadata.hasAlpha).toBe(true)
      expect(stats.channels[3]?.max).toBeGreaterThan(0)
    }
  }, 30_000)

  it('resolves canonical IDs and legacy English or Japanese display names', () => {
    expect(resolveEnchantment('radiance')?.id).toBe('radiance')
    expect(resolveEnchantment('Radiance')?.id).toBe('radiance')
    expect(resolveEnchantment('輝き')?.id).toBe('radiance')
    expect(resolveEnchantment('Critical Hit Tier III')?.id).toBe('critical-hit')
    expect(resolveEnchantment('unknown legacy enchant')).toBeUndefined()
  })

  it('renders matched artwork and retains fallback and readable names', () => {
    const image = renderToStaticMarkup(createElement(EnchantmentArtwork, { enchantmentId: 'radiance' }))
    expect(image).toContain('src="/assets/enchantments/radiance.webp"')
    expect(image).toContain('width="32" height="32" loading="lazy" decoding="async"')
    expect(renderToStaticMarkup(createElement(EnchantmentArtwork, { enchantmentId: 'void-strike', category: 'melee' }))).toContain('/assets/enchantments/void-strike-melee.webp')
    expect(renderToStaticMarkup(createElement(EnchantmentArtwork, { enchantmentId: 'void-strike' }))).toContain('enchantment-artwork-fallback')
    expect(shouldRenderUiIcon('/assets/enchantments/radiance.webp', '/assets/enchantments/radiance.webp')).toBe(false)
    const identity = renderToStaticMarkup(createElement(EnchantmentIdentity, { value: '輝き' }))
    expect(identity).toContain('輝き')
    expect(identity).toContain('Radiance')
    expect(renderToStaticMarkup(createElement(EnchantmentIdentity, { value: 'legacy enchant' }))).toContain('legacy enchant')
  })

  it('adds icons to registered inventory enchantments without changing the empty state', () => {
    const inventory: Inventory = { weapons: [{ instanceId: 'double-axe-1', weaponId: 'double-axe', powerLevel: 251, rarity: 'rare', enchantmentSlots: [{ candidates: ['radiance'], selected: { enchantmentId: 'radiance', tier: 3 } }] }], artifacts: [] }
    const item = inventoryGridItems(inventory)[0]!
    const html = renderToStaticMarkup(createElement(SelectedEquipmentPane, { item, duplicateCount: 1, inventory, onChange: () => undefined, onOpenFullEditor: () => undefined, onClose: () => undefined }))
    expect(html).toContain('/assets/enchantments/radiance.webp')
    expect(html).toContain('輝き')
    const emptyInventory: Inventory = { weapons: [{ ...inventory.weapons[0]!, enchantmentSlots: [] }], artifacts: [] }
    const emptyItem = inventoryGridItems(emptyInventory)[0]!
    const emptyHtml = renderToStaticMarkup(createElement(SelectedEquipmentPane, { item: emptyItem, duplicateCount: 1, inventory: emptyInventory, onChange: () => undefined, onOpenFullEditor: () => undefined, onClose: () => undefined }))
    expect(emptyHtml).toMatch(/通常エンチャント<\/h3><p>未記録<\/p>/)
  })

  it('reuses the same artwork for confirmed built-in enchantments', () => {
    const html = renderToStaticMarkup(createElement(DataBrowserPage, { route: '/data/armor' }))
    expect(html).toContain('built-in-enchantments')
    expect(html).toContain('/assets/enchantments/burning.webp')
    expect(html).toContain('Burning')
  })
})

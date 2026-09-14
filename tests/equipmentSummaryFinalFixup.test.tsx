import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { CatalogInventoryItem, Inventory } from '../src/core'
import { selectedEnchantmentSummary } from '../src/inventory/enchantmentSummary'
import { CatalogInventoryItems, OwnedArmorEditor, OwnedArtifactEditor, OwnedMeleeEditor } from '../src/WorkspaceApp'
import { OwnedRangedEditor } from '../src/views/RangedEquipment'

const noop = () => undefined

const inventory: Inventory = {
  weapons: [{
    instanceId: 'runtime-melee',
    weaponId: 'fighters-bindings',
    powerLevel: 251,
    enchantmentSlots: [
      { candidates: ['critical-hit'], selected: { enchantmentId: 'critical-hit', tier: 3 } },
      { candidates: ['radiance'], selected: { enchantmentId: 'radiance', tier: 2 } },
    ],
    gilded: { enchantmentId: 'guarding-strike', tier: 3 },
  }],
  armors: [{ instanceId: 'runtime-armor', armorId: 'battle-robe', powerLevel: 248, enchantmentSlots: [{ candidates: ['chilling'], selected: { enchantmentId: 'chilling', tier: 2 } }] }],
  rangedWeapons: [{ instanceId: 'runtime-ranged', weaponId: 'bow', powerLevel: 247, enchantmentSlots: [{ candidates: ['multishot'], selected: { enchantmentId: 'multishot', tier: 1 } }] }],
  artifacts: [{ instanceId: 'runtime-artifact', artifactId: 'death-cap-mushroom', powerLevel: 251 }],
}

const catalogMelee: CatalogInventoryItem = {
  instanceId: 'catalog-melee',
  category: 'melee',
  catalogId: 'diamond-sword',
  powerLevel: 250,
  enchantmentSlots: [{ candidates: ['gravity'], selected: { enchantmentId: 'gravity', tier: 2 } }],
  gilded: { enchantmentId: 'critical-hit', tier: 3 },
}

const catalogArtifact: CatalogInventoryItem = {
  instanceId: 'catalog-artifact',
  category: 'artifact',
  catalogId: 'blast-fungus',
  powerLevel: 249,
}

function summary(html: string): string {
  return html.slice(html.indexOf('<summary>'), html.indexOf('</summary>') + '</summary>'.length)
}

function renderForView(view: 'compact' | 'list', child: ReturnType<typeof createElement>): string {
  return renderToStaticMarkup(createElement('div', { className: `inventory-collection view-${view}` }, child))
}

describe('equipment summary final fix-up', () => {
  it('resolves selected slot enchantments through the canonical catalog and excludes Gilded', () => {
    expect(selectedEnchantmentSummary(catalogMelee.enchantmentSlots)).toBe('重力')
    expect(selectedEnchantmentSummary()).toBe('選択済みEnchantなし')
  })

  it.each(['compact', 'list'] as const)('shows the same Power and selected Enchant structure for runtime melee in %s view', (view) => {
    const html = summary(renderForView(view, createElement(OwnedMeleeEditor, { weapon: inventory.weapons[0]!, onChange: noop, onRemove: noop })))
    expect(html).toContain('Power 251<small>クリティカルヒット · 輝き</small>')
    expect(html).toContain('class="gilded-badge">金色</span>')
    expect(html).not.toContain('ガードストライク')
  })

  it.each(['compact', 'list'] as const)('shows the same format and canonical non-runtime Enchant name for catalog-backed melee in %s view', (view) => {
    const owned = { ...inventory, catalogItems: [catalogMelee] }
    const html = summary(renderForView(view, createElement(CatalogInventoryItems, { inventory: owned, items: [catalogMelee], onChange: noop })))
    expect(html).toContain('Power 250<small>重力</small>')
    expect(html).not.toContain('>gravity<')
    expect(html).not.toContain('<small>近接</small>')
    expect(html).toContain('class="gilded-badge">金色</span>')
    expect(html).not.toContain('クリティカルヒット')
  })

  it('shows the explicit empty state for non-artifact equipment', () => {
    const empty = { ...catalogMelee, enchantmentSlots: [] }
    const owned = { ...inventory, catalogItems: [empty] }
    const html = summary(renderToStaticMarkup(createElement(CatalogInventoryItems, { inventory: owned, items: [empty], onChange: noop })))
    expect(html).toContain('Power 250<small>選択済みEnchantなし</small>')
  })

  it.each(['compact', 'list'] as const)('uses the shared summary structure for runtime and catalog-backed Armor and Ranged in %s view', (view) => {
    const runtimeArmor = summary(renderForView(view, createElement(OwnedArmorEditor, { armor: inventory.armors![0]!, onChange: noop, onRemove: noop })))
    const runtimeRanged = summary(renderForView(view, createElement(OwnedRangedEditor, { weapon: inventory.rangedWeapons![0]!, onChange: noop, onRemove: noop })))
    const catalogArmor = { instanceId: 'catalog-armor', category: 'armor', catalogId: 'hungry-horror', powerLevel: 246, enchantmentSlots: [{ candidates: ['chilling'], selected: { enchantmentId: 'chilling', tier: 3 } }] } as const
    const catalogRanged = { instanceId: 'catalog-ranged', category: 'ranged', catalogId: 'bow-of-lost-souls', powerLevel: 245, enchantmentSlots: [{ candidates: ['multishot'], selected: { enchantmentId: 'multishot', tier: 2 } }] } as const
    const owned = { ...inventory, catalogItems: [catalogArmor, catalogRanged] }
    const catalogArmorHtml = summary(renderForView(view, createElement(CatalogInventoryItems, { inventory: owned, items: [catalogArmor], onChange: noop })))
    const catalogRangedHtml = summary(renderForView(view, createElement(CatalogInventoryItems, { inventory: owned, items: [catalogRanged], onChange: noop })))
    expect(runtimeArmor).toContain('Power 248<small>冷気</small>')
    expect(catalogArmorHtml).toContain('Power 246<small>冷気</small>')
    expect(runtimeRanged).toContain('Power 247<small>マルチショット</small>')
    expect(catalogRangedHtml).toContain('Power 245<small>マルチショット</small>')
    expect(catalogArmorHtml).not.toContain('<small>防具</small>')
    expect(catalogRangedHtml).not.toContain('<small>遠距離</small>')
  })

  it('keeps runtime and catalog-backed Artifact summaries to Power only', () => {
    const runtimeHtml = summary(renderToStaticMarkup(createElement(OwnedArtifactEditor, { artifact: inventory.artifacts[0]!, onChange: noop, onRemove: noop })))
    const owned = { ...inventory, catalogItems: [catalogArtifact] }
    const catalogHtml = summary(renderToStaticMarkup(createElement(CatalogInventoryItems, { inventory: owned, items: [catalogArtifact], onChange: noop })))
    expect(runtimeHtml).toContain('Power 251</span>')
    expect(catalogHtml).toContain('Power 249</span>')
    expect(runtimeHtml).not.toContain('選択済みEnchant')
    expect(catalogHtml).not.toContain('選択済みEnchant')
    expect(catalogHtml).not.toContain('アーティファクト</small>')
  })
})

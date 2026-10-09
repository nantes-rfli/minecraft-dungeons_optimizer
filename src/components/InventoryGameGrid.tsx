"use client"

import { useMemo, useState } from 'react'
import type { EquipmentCategory, EquipmentRarity, Inventory } from '../core'
import { EQUIPMENT_CATALOG } from '../data/equipmentCatalog'
import { equipmentKey } from '../inventory/collection'
import { hrefForEquipment } from '../app/routes'
import { inventoryGridItemMatchesFilters, inventoryGridItems, type InventoryGridItem } from '../inventory/gridPresentation'
import { nextInventoryGridIndex, type InventoryGridNavigationKey } from '../inventory/gridKeyboardNavigation'
import { EquipmentArtwork, EquipmentCategoryIcon, SoulMarker } from './EquipmentArtwork'
import { EnchantmentIdentity } from './EnchantmentArtwork'
import { EnchantmentDiamond } from './EnchantmentSlotEditor'
import type { EnchantmentCatalogCategory } from '../data/enchantmentCatalog'
import { InventoryDeleteButton } from './InventoryDeleteButton'

const EQUIPMENT_CATEGORY_LABELS = { melee: '近接', armor: '防具', ranged: '遠距離', artifact: 'アーティファクト' } as const
const RARITY_LABELS: Record<EquipmentRarity | 'unrecorded', string> = { common: 'コモン', rare: 'レア', unique: 'ユニーク', unrecorded: '未記録' }

function isInventoryGridNavigationKey(key: string): key is InventoryGridNavigationKey {
  return key === 'ArrowDown' || key === 'ArrowLeft' || key === 'ArrowRight' || key === 'ArrowUp' || key === 'End' || key === 'Home'
}

export { EquipmentArtwork } from './EquipmentArtwork'

function updateOwnedItem(inventory: Inventory, target: InventoryGridItem, patch: { powerLevel?: number; rarity?: EquipmentRarity }): Inventory {
  const update = <T extends { instanceId: string }>(items: readonly T[]): T[] => items.map((owned) => owned.instanceId === target.instanceId ? { ...owned, ...patch } : owned)
  if (target.category === 'melee' && inventory.weapons.some((owned) => owned.instanceId === target.instanceId)) return { ...inventory, weapons: update(inventory.weapons) }
  if (target.category === 'armor' && inventory.armors?.some((owned) => owned.instanceId === target.instanceId)) return { ...inventory, armors: update(inventory.armors) }
  if (target.category === 'ranged' && inventory.rangedWeapons?.some((owned) => owned.instanceId === target.instanceId)) return { ...inventory, rangedWeapons: update(inventory.rangedWeapons) }
  if (target.category === 'artifact' && inventory.artifacts.some((owned) => owned.instanceId === target.instanceId)) return { ...inventory, artifacts: update(inventory.artifacts) }
  return { ...inventory, catalogItems: update(inventory.catalogItems ?? []) }
}

function removeOwnedItem(inventory: Inventory, instanceId: string): Inventory {
  const keep = <T extends { instanceId: string }>(items: readonly T[] | undefined): T[] => (items ?? []).filter((item) => item.instanceId !== instanceId)
  return { ...inventory, weapons: keep(inventory.weapons), armors: keep(inventory.armors), rangedWeapons: keep(inventory.rangedWeapons), artifacts: keep(inventory.artifacts), catalogItems: keep(inventory.catalogItems) }
}

export function SelectedEquipmentPane({ item, duplicateCount, inventory, onChange, onOpenFullEditor, onClose }: { item: InventoryGridItem; duplicateCount: number; inventory: Inventory; onChange: (inventory: Inventory) => void; onOpenFullEditor: (name: string, instanceId: string) => void; onClose: () => void }) {
  const [editing, setEditing] = useState(false)
  return <aside className="selected-equipment-pane" aria-label="選択した装備の詳細">
    <button className="sheet-close" type="button" onClick={onClose} aria-label="装備詳細を閉じる">×</button>
    <div className="detail-art"><EquipmentArtwork catalog={item.catalog} priority /><span className="detail-category-glyph"><EquipmentCategoryIcon category={item.category as EnchantmentCatalogCategory} /></span></div>
    <p className="section-label">SELECTED EQUIPMENT</p><h2>{item.catalog.name.ja}</h2><p className="detail-english" lang="en">{item.catalog.name.en}</p>
    <dl className="detail-facts"><div><dt>カテゴリ</dt><dd>{EQUIPMENT_CATEGORY_LABELS[item.category]}</dd></div><div><dt>レアリティ</dt><dd>{RARITY_LABELS[item.rarity]}</dd></div><div><dt>Power</dt><dd>{item.powerLevel}</dd></div><div><dt>金色</dt><dd>{item.gilded ? 'あり' : 'なし'}</dd></div><div><dt>Soul</dt><dd>{item.catalog.soulGear ? 'Soul 装備' : '—'}</dd></div><div><dt>所持数</dt><dd>{duplicateCount}</dd></div></dl>
    {item.category !== 'artifact' && <section className="detail-enchantments"><h3>通常エンチャント</h3>{item.enchantmentSlots.length ? <div className="detail-enchantment-slots">{item.enchantmentSlots.map((slot, index) => <article key={index}><h4>SLOT {index + 1}</h4><div>{slot.candidates.map((id) => <EnchantmentDiamond key={id} enchantmentId={id} category={item.category as EnchantmentCatalogCategory} selected={slot.selected?.enchantmentId === id} />)}</div><p>選択済み: {slot.selected ? <EnchantmentIdentity value={slot.selected.enchantmentId} tier={slot.selected.tier} category={item.category as EnchantmentCatalogCategory} /> : '—'}</p></article>)}</div> : <p>未記録</p>}{item.gildedEnchantment && <div className="detail-gilded"><h3>金色エンチャント</h3><EnchantmentIdentity value={item.gildedEnchantment.enchantmentId} tier={item.gildedEnchantment.tier} category={item.category as EnchantmentCatalogCategory} /></div>}{item.catalog.builtInEnchantments.length > 0 && <div className="detail-built-in"><h3>固有エンチャント</h3>{item.catalog.builtInEnchantments.map((builtIn) => <EnchantmentIdentity key={builtIn.enchantmentId} value={builtIn.enchantmentId} tier={builtIn.tier} category={item.category as EnchantmentCatalogCategory} />)}</div>}{item.notes && <p className="instance-note">{item.notes}</p>}</section>}
    {editing && <form className="quick-instance-editor" onSubmit={(event) => event.preventDefault()}><label>Power<input aria-label="選択装備のPower" type="number" min="1" value={item.powerLevel} onChange={(event) => onChange(updateOwnedItem(inventory, item, { powerLevel: Number(event.target.value) }))} /></label>{item.category !== 'artifact' && item.catalog.rarityFamily !== 'unique' && <label>レアリティ<select aria-label="選択装備のレアリティ" value={item.rarity === 'unrecorded' ? '' : item.rarity} onChange={(event) => event.target.value && onChange(updateOwnedItem(inventory, item, { rarity: event.target.value as EquipmentRarity }))}><option value="" disabled>選択してください</option><option value="common">Common</option><option value="rare">Rare</option></select></label>}<button type="button" className="full-editor-button" onClick={() => onOpenFullEditor(item.catalog.name.en, item.instanceId)}>Enchant・金色を詳細編集</button></form>}
    <div className="detail-actions"><button type="button" onClick={() => setEditing((value) => !value)} aria-expanded={editing}>{editing ? '編集を閉じる' : '編集'}</button><a href={hrefForEquipment(`/data/${item.category === 'artifact' ? 'artifacts' : item.category}`, item.catalogId)}>{EQUIPMENT_CATEGORY_LABELS[item.category]}データを見る</a><InventoryDeleteButton label={item.catalog.name.ja ?? item.catalog.name.en} onClick={() => { onChange(removeOwnedItem(inventory, item.instanceId)); onClose() }} /></div>
  </aside>
}

export function InventoryGameGrid({ inventory, onChange, onOpenFullEditor, query, category, gilded, powerMinimum, powerMaximum, sort }: { inventory: Inventory; onChange: (inventory: Inventory) => void; onOpenFullEditor: (name: string, instanceId: string) => void; query: string; category: 'all' | EquipmentCategory; gilded: 'all' | 'gilded' | 'standard'; powerMinimum: number | null; powerMaximum: number | null; sort: 'name' | 'power-desc' | 'power-asc' | 'recent' }) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const items = useMemo(() => {
    const filters = { query, category, gilded, powerMinimum, powerMaximum }
    const filtered = inventoryGridItems(inventory).filter((item) => inventoryGridItemMatchesFilters(item, filters))
    return filtered.sort((left, right) => sort === 'power-desc' ? right.powerLevel - left.powerLevel : sort === 'power-asc' ? left.powerLevel - right.powerLevel : sort === 'name' ? (left.catalog.name.ja ?? left.catalog.name.en).localeCompare(right.catalog.name.ja ?? right.catalog.name.en, 'ja') : 0)
  }, [inventory, query, category, gilded, powerMinimum, powerMaximum, sort])
  const selected = items.find((item) => item.instanceId === selectedId) ?? null
  const tabStopId = selected?.instanceId ?? items[0]?.instanceId ?? null
  return <div className={`inventory-game-layout ${selected ? 'has-selection' : ''}`}>
    <section className="inventory-grid-panel" aria-label="所持装備グリッド"><div className="game-inventory-grid" role="listbox" aria-label="所持装備">
      {items.map((item, index) => {
        const label = `${item.catalog.name.ja}、${item.catalog.name.en}${item.enchantments.length ? `、選択済み ${item.enchantments.join('、')}` : ''}`
        const tooltipId = `slot-tooltip-${item.instanceId.replace(/[^a-zA-Z0-9_-]/g, '-')}`
        return <button
          key={item.instanceId}
          type="button"
          role="option"
          aria-selected={selectedId === item.instanceId}
          tabIndex={tabStopId === item.instanceId ? 0 : -1}
          aria-label={label}
          aria-describedby={tooltipId}
          className="inventory-slot"
          data-rarity={item.rarity}
          data-gilded={item.gilded || undefined}
          onClick={() => setSelectedId(item.instanceId)}
          onKeyDown={(event) => {
            if (!isInventoryGridNavigationKey(event.key)) return
            const listbox = event.currentTarget.parentElement
            const columnTemplate = listbox ? window.getComputedStyle(listbox).gridTemplateColumns.trim() : ''
            const columns = columnTemplate.split(/\s+/).filter(Boolean).length || 1
            const targetIndex = nextInventoryGridIndex(index, items.length, columns, event.key)
            event.preventDefault()
            if (targetIndex === index || targetIndex < 0) return
            const targetItem = items[targetIndex]
            if (!targetItem) return
            setSelectedId(targetItem.instanceId)
            listbox?.querySelectorAll<HTMLButtonElement>('[role="option"]')[targetIndex]?.focus()
          }}
        >
          <EquipmentArtwork catalog={item.catalog} priority={index < 12} />
          {item.catalog.soulGear && <SoulMarker size="small" />}
          {item.enchantments.length > 0 && <span className="slot-selected-enchants" aria-hidden="true">◇{item.enchantments.length}</span>}
          <span className="slot-power"><i><EquipmentCategoryIcon category={item.category as EnchantmentCatalogCategory} /></i><b>{item.powerLevel}</b></span>
          <span className="sr-only">{RARITY_LABELS[item.rarity]}{item.gilded ? '、金色' : ''}</span>
          <span className="slot-name-tooltip" id={tooltipId} role="tooltip"><strong>{item.catalog.name.ja}</strong><small lang="en">{item.catalog.name.en}</small>{item.enchantments.length > 0 && <small>選択済み: {item.enchantments.join(' · ')}</small>}</span>
        </button>
      })}
    </div>{items.length === 0 && <div className="grid-empty" role="status"><strong>該当する装備がありません</strong><p>検索語や絞り込みを変更してください。</p></div>}</section>
    {selected ? <SelectedEquipmentPane item={selected} duplicateCount={inventoryGridItems(inventory).filter((item) => item.category === selected.category && item.catalogId === selected.catalogId).length} inventory={inventory} onChange={onChange} onOpenFullEditor={onOpenFullEditor} onClose={() => setSelectedId(null)} /> : <aside className="selected-equipment-pane detail-empty"><span aria-hidden="true">◇</span><h2>装備を選択してください</h2><p>スロットを選ぶと、この個体の Power・Enchant・金色状態を確認できます。</p></aside>}
  </div>
}

export function VisualEquipmentPicker({ category, classFilter, query, selectedKey, onSelect }: { category: EquipmentCategory; classFilter: 'normal' | 'unique'; query: string; selectedKey: string; onSelect: (key: string) => void }) {
  const items = EQUIPMENT_CATALOG.filter((item) => item.category === category && (category === 'artifact' || item.rarityFamily === classFilter) && `${item.name.ja} ${item.name.en}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()))
  return <div className="visual-equipment-picker" role="listbox" aria-label="登録する装備">{items.map((item) => { const key = equipmentKey(item.category, item.id); return <button key={key} type="button" role="option" aria-selected={selectedKey === key} aria-label={`${item.name.ja}、${item.name.en}`} onClick={() => onSelect(key)}><EquipmentArtwork catalog={item} compact /><span><strong>{item.name.ja}</strong><small lang="en">{item.name.en}</small></span></button> })}{items.length === 0 && <p className="picker-empty">該当する装備がありません。</p>}</div>
}

"use client"

import type { ReactNode } from 'react'
import type { EnchantmentTier, EquipmentCategory, EquipmentRarity, OwnedEnchantmentSlot } from '../core'
import type { EquipmentCatalogEntry } from '../data/equipmentCatalog'
import { EnchantmentSlotEditor } from './EnchantmentSlotEditor'
import { GildedEnchantmentEditor } from './GildedEnchantmentEditor'
import { InventoryDeleteButton } from './InventoryDeleteButton'

export interface EquipmentInstanceEditorProps {
  readonly category: EquipmentCategory
  readonly catalog: EquipmentCatalogEntry
  readonly powerLevel: number
  readonly rarity?: EquipmentRarity
  readonly notes?: string
  readonly enchantmentSlots?: readonly OwnedEnchantmentSlot<string>[]
  readonly gilded?: { readonly enchantmentId: string; readonly tier: EnchantmentTier }
  readonly powerMin?: number
  readonly powerMax?: number
  readonly onPowerChange: (value: number) => void
  readonly onRarityChange?: (value?: EquipmentRarity) => void
  readonly onNotesChange: (value?: string) => void
  readonly onEnchantmentSlotsChange?: (value: readonly OwnedEnchantmentSlot<string>[]) => void
  readonly onGildedChange?: (value?: { enchantmentId: string; tier: EnchantmentTier }) => void
  readonly onDelete: () => void
  readonly extraFields?: ReactNode
}

export function EquipmentInstanceEditor({ category, catalog, powerLevel, rarity, notes, enchantmentSlots, gilded, powerMin = 1, powerMax, onPowerChange, onRarityChange, onNotesChange, onEnchantmentSlotsChange, onGildedChange, onDelete, extraFields }: EquipmentInstanceEditorProps) {
  const displayName = catalog.name.ja ?? catalog.name.en
  const supportsEnchantments = category !== 'artifact' && Boolean(onEnchantmentSlotsChange) && Boolean(onGildedChange)
  const rarityOptions = catalog.rarityFamily === 'unique' ? [['unique', 'Unique']] as const : [['common', 'Common'], ['rare', 'Rare']] as const
  return <div className="editor-body equipment-instance-editor" data-category={category}>
    <section className="equipment-instance-section equipment-instance-base" aria-label={`${displayName}の個体情報`}><h3>個体情報</h3><div className="equipment-instance-fields">
      <label className="equipment-power-field">Power<input aria-label={`${displayName}のPower`} type="number" min={powerMin} max={powerMax} value={powerLevel} onChange={(event) => onPowerChange(Number(event.target.value))} /></label>
      {category !== 'artifact' && onRarityChange && <label className="equipment-rarity-field">レアリティ<select aria-label={`${displayName}のレアリティ`} value={rarity ?? ''} onChange={(event) => onRarityChange(event.target.value === '' ? undefined : event.target.value as EquipmentRarity)}><option value="">未記録</option>{rarityOptions.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>}
      <label className="equipment-notes-field">自分用メモ<input value={notes ?? ''} placeholder="入手場所やお気に入りポイントなど" onChange={(event) => onNotesChange(event.target.value || undefined)} /></label>
    </div></section>
    {supportsEnchantments && <><EnchantmentSlotEditor slots={enchantmentSlots ?? []} category={category} soulGear={Boolean(catalog.soulGear)} onChange={onEnchantmentSlotsChange} /><GildedEnchantmentEditor value={gilded} category={category} soulGear={Boolean(catalog.soulGear)} onChange={onGildedChange} /></>}
    {extraFields && <section className="equipment-instance-section equipment-runtime-fields" aria-label={`${displayName}の詳細値`}><h3>詳細値</h3>{extraFields}</section>}
    <div className="equipment-editor-actions"><InventoryDeleteButton label={displayName} onClick={onDelete} /></div>
  </div>
}

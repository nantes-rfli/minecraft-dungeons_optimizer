"use client"

import { useState } from 'react'
import type { EnchantmentTier } from '../core/types'
import type { EnchantmentCatalogCategory } from '../data/enchantmentCatalog'
import { resolveEnchantment } from '../data/enchantmentCatalog'
import { EnchantmentDiamond, EnchantmentPicker } from './EnchantmentSlotEditor'

const TIER_LABELS = { 1: 'I', 2: 'II', 3: 'III' } as const

export type GildedEnchantment = { enchantmentId: string; tier: EnchantmentTier }

export function GildedEnchantmentEditor({ value, category, soulGear, onChange, label = 'GILDED ENCHANTMENT' }: {
  value?: GildedEnchantment
  category: EnchantmentCatalogCategory
  soulGear: boolean
  onChange: (value: GildedEnchantment | undefined) => void
  label?: string
}) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const entry = value ? resolveEnchantment(value.enchantmentId) : undefined
  return <section className="gilded-enchantment-editor" aria-label={label}>
    <h3>{label}</h3>
    {!value ? <button type="button" className="add-gilded-button" onClick={() => setPickerOpen(true)}>＋ 金色エンチャントを追加</button> : <div className="gilded-enchantment-value" aria-label={`${entry?.name.ja ?? value.enchantmentId}、${entry?.rarity === 'powerful' ? 'Powerful' : 'Common'}、Tier ${TIER_LABELS[value.tier]}`}>
      <EnchantmentDiamond enchantmentId={value.enchantmentId} category={category} selected />
      <label>Tier<select aria-label={`${entry?.name.ja ?? value.enchantmentId}の金色エンチャントTier`} value={value.tier} onChange={(event) => onChange({ ...value, tier: Number(event.target.value) as EnchantmentTier })}>{([1, 2, 3] as const).map((tier) => <option key={tier} value={tier}>{TIER_LABELS[tier]}</option>)}</select></label>
      <div className="gilded-enchantment-actions"><button type="button" onClick={() => setPickerOpen(true)}>変更</button><button type="button" onClick={() => onChange(undefined)}>削除</button></div>
    </div>}
    {pickerOpen && <EnchantmentPicker category={category} soulGear={soulGear} availability="gilded" title="金色エンチャントを選択" description="通常枠とは別に付く追加エンチャント" onSelect={(selected) => { onChange({ enchantmentId: selected.id, tier: value?.tier ?? 3 }); setPickerOpen(false) }} onClose={() => setPickerOpen(false)} />}
  </section>
}

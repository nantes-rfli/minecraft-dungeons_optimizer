"use client"

import { useMemo, useState } from 'react'
import type { EnchantmentTier, OwnedEnchantmentSlot } from '../core/types'
import { ENCHANTMENT_CATALOG, type EnchantmentCatalogCategory, type EnchantmentCatalogEntry } from '../data/enchantmentCatalog'
import { EnchantmentArtwork } from './EnchantmentArtwork'
import { addEnchantmentCandidate, availableEnchantments } from './enchantmentPicker'

const TIER_LABELS = { 1: 'I', 2: 'II', 3: 'III' } as const
const CATEGORY_LABELS = { melee: '近接', ranged: '遠距離', armor: '防具' } as const

export type EnchantmentDiamondVariant = 'full' | 'compact' | 'icon-only'

export function EnchantmentDiamond({ enchantmentId, category, selected = false, variant = 'full' }: { enchantmentId: string; category: EnchantmentCatalogCategory; selected?: boolean; variant?: EnchantmentDiamondVariant }) {
  const enchantment = ENCHANTMENT_CATALOG.find((entry) => entry.id === enchantmentId)
  return <span className={`enchantment-diamond enchantment-diamond--${variant}`} data-rarity={enchantment?.rarity ?? 'unknown'} data-selected={selected || undefined} title={`${enchantment?.rarity === 'powerful' ? 'Powerful' : enchantment?.rarity === 'common' ? 'Common' : 'Rarity未確認'} · ${CATEGORY_LABELS[category]}`}>
    <span className="enchantment-diamond-frame"><EnchantmentArtwork enchantmentId={enchantmentId} category={category} /></span>
    {variant === 'full' && <span className="enchantment-diamond-copy"><strong>{enchantment?.name.ja ?? enchantment?.name.en ?? enchantmentId}</strong>{enchantment?.name.ja && <small lang="en">{enchantment.name.en}</small>}<small>{enchantment?.rarity === 'powerful' ? 'Powerful' : enchantment?.rarity === 'common' ? 'Common' : 'Rarity確認中'}</small></span>}
  </span>
}

export function EnchantmentPicker({ category, soulGear, availability, excludedIds = [], title, description, onSelect, onClose }: {
  category: EnchantmentCatalogCategory
  soulGear: boolean
  availability: 'normalSlot' | 'gilded'
  excludedIds?: readonly string[]
  title: string
  description: string
  onSelect: (entry: EnchantmentCatalogEntry) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const choices = useMemo(() => availableEnchantments(category, soulGear, availability), [availability, category, soulGear])
  const normalized = query.trim().toLocaleLowerCase()
  const filtered = choices.filter((entry) => `${entry.name.ja ?? ''} ${entry.name.en} ${entry.id}`.toLocaleLowerCase().includes(normalized))
  return <div className="enchantment-picker" role="dialog" aria-modal="true" aria-label={title} onKeyDown={(event) => { if (event.key === 'Escape') onClose() }}>
    <div className="enchantment-picker-card"><header><div><strong>{title}</strong><small>{description}</small></div><button type="button" aria-label="エンチャント選択を閉じる" onClick={onClose}>×</button></header>
    <label className="picker-search">日本語名・英語名で検索<input autoFocus type="search" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
    <div className="enchantment-picker-list">{filtered.map((entry) => { const excluded = excludedIds.includes(entry.id); return <button type="button" key={entry.id} disabled={excluded} onClick={() => onSelect(entry)}><EnchantmentDiamond enchantmentId={entry.id} category={category} /><span>{CATEGORY_LABELS[category]} · {excluded ? '候補登録済み' : entry.soulGearOnly ? 'Soul限定' : '選択可能'}</span></button> })}</div>
    {!filtered.length && <p>一致するエンチャントがありません。</p>}</div>
  </div>
}

export function EnchantmentSlotEditor({ slots, category, soulGear, onChange, label = 'エンチャント' }: {
  slots: readonly OwnedEnchantmentSlot<string>[]
  category: EnchantmentCatalogCategory
  soulGear: boolean
  onChange: (slots: readonly OwnedEnchantmentSlot<string>[]) => void
  label?: string
}) {
  const [pickerSlot, setPickerSlot] = useState<number | null>(null)
  const updateSlot = (index: number, update: (slot: OwnedEnchantmentSlot<string>) => OwnedEnchantmentSlot<string>) => onChange(slots.map((slot, current) => current === index ? update(slot) : slot))
  const addCandidate = (slotIndex: number, enchantmentId: string) => {
    onChange(addEnchantmentCandidate(slots, slotIndex, enchantmentId))
    setPickerSlot(null)
  }
  return <section className="enchantment-slot-editor" aria-label={label}>
    <div className="enchantment-slot-grid">{slots.map((slot, slotIndex) => <fieldset className="enchantment-slot" key={slotIndex}>
      <legend>SLOT {slotIndex + 1}</legend>
      <div className="enchantment-candidates">{slot.candidates.map((id) => <div className="enchantment-candidate" key={id}>
        <button type="button" className="enchantment-choice" aria-pressed={slot.selected?.enchantmentId === id} onClick={() => updateSlot(slotIndex, (current) => ({ ...current, selected: current.selected?.enchantmentId === id ? undefined : { enchantmentId: id, tier: 3 } }))}>
          <EnchantmentDiamond enchantmentId={id} category={category} selected={slot.selected?.enchantmentId === id} />
        </button>
        {slot.candidates.length > 1 && <button type="button" className="candidate-remove" aria-label={`${id}を候補から削除`} onClick={() => updateSlot(slotIndex, (current) => ({ candidates: current.candidates.filter((candidate) => candidate !== id), ...(current.selected?.enchantmentId === id ? {} : current.selected ? { selected: current.selected } : {}) }))}>×</button>}
      </div>)}</div>
      {slot.candidates.length < 3 && <button type="button" className="add-candidate-button" onClick={() => setPickerSlot(slotIndex)}>＋ 候補を追加</button>}
      <div className="selected-enchantment"><span>選択済み</span>{slot.selected ? <><EnchantmentDiamond enchantmentId={slot.selected.enchantmentId} category={category} selected /><label>Tier<select aria-label={`スロット${slotIndex + 1}のTier`} value={slot.selected.tier} onChange={(event) => updateSlot(slotIndex, (current) => current.selected ? { ...current, selected: { ...current.selected, tier: Number(event.target.value) as EnchantmentTier } } : current)}>{([1, 2, 3] as const).map((tier) => <option value={tier} key={tier}>{TIER_LABELS[tier]}</option>)}</select></label><button type="button" onClick={() => updateSlot(slotIndex, (current) => ({ candidates: current.candidates }))}>まだ選んでいない</button></> : <strong>—</strong>}</div>
      <button type="button" className="remove-slot-button" onClick={() => onChange(slots.filter((_, current) => current !== slotIndex))}>このスロットを削除</button>
    </fieldset>)}</div>
    {slots.length < 3 && <button type="button" className="add-slot-button" onClick={() => setPickerSlot(slots.length)}>＋ スロットを追加</button>}
    {pickerSlot !== null && <EnchantmentPicker category={category} soulGear={soulGear} availability="normalSlot" excludedIds={slots[pickerSlot]?.candidates ?? []} title={pickerSlot === slots.length ? `スロット${pickerSlot + 1}を追加` : `スロット${pickerSlot + 1}の候補を追加`} description="この装備に存在する通常枠のみ" onSelect={(entry) => addCandidate(pickerSlot, entry.id)} onClose={() => setPickerSlot(null)} />}
  </section>
}

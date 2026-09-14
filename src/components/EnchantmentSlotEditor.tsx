"use client"

import { useMemo, useState } from 'react'
import type { EnchantmentTier, OwnedEnchantmentSlot } from '../core/types'
import { ENCHANTMENT_CATALOG, type EnchantmentCatalogCategory } from '../data/enchantmentCatalog'
import { EnchantmentArtwork } from './EnchantmentArtwork'

const TIER_LABELS = { 1: 'I', 2: 'II', 3: 'III' } as const
const CATEGORY_LABELS = { melee: '近接', ranged: '遠距離', armor: '防具' } as const

export function EnchantmentDiamond({ enchantmentId, category, selected = false }: { enchantmentId: string; category: EnchantmentCatalogCategory; selected?: boolean }) {
  const enchantment = ENCHANTMENT_CATALOG.find((entry) => entry.id === enchantmentId)
  return <span className="enchantment-diamond" data-rarity={enchantment?.rarity ?? 'unknown'} data-selected={selected || undefined} title={`${enchantment?.rarity === 'powerful' ? 'Powerful' : enchantment?.rarity === 'common' ? 'Common' : 'Rarity未確認'} · ${category}`}>
    <span className="enchantment-diamond-frame"><EnchantmentArtwork enchantmentId={enchantmentId} category={category} /></span>
    <span className="enchantment-diamond-copy"><strong>{enchantment?.name.ja ?? enchantment?.name.en ?? enchantmentId}</strong>{enchantment?.name.ja && <small lang="en">{enchantment.name.en}</small>}<small>{enchantment?.rarity === 'powerful' ? 'Powerful' : enchantment?.rarity === 'common' ? 'Common' : 'Rarity確認中'}</small></span>
  </span>
}

export function EnchantmentSlotEditor({ slots, category, soulGear, onChange, label = 'エンチャント' }: {
  slots: readonly OwnedEnchantmentSlot<string>[]
  category: EnchantmentCatalogCategory
  soulGear: boolean
  onChange: (slots: readonly OwnedEnchantmentSlot<string>[]) => void
  label?: string
}) {
  const [pickerSlot, setPickerSlot] = useState<number | null>(null)
  const [query, setQuery] = useState('')
  const choices = useMemo(() => ENCHANTMENT_CATALOG.filter((entry) => entry.applicableCategories.includes(category) && entry.availability.normalSlot && (!entry.soulGearOnly || soulGear)), [category, soulGear])
  const filtered = choices.filter((entry) => `${entry.name.ja ?? ''} ${entry.name.en} ${entry.id}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
  const updateSlot = (index: number, update: (slot: OwnedEnchantmentSlot<string>) => OwnedEnchantmentSlot<string>) => onChange(slots.map((slot, current) => current === index ? update(slot) : slot))
  const addCandidate = (slotIndex: number, enchantmentId: string) => {
    updateSlot(slotIndex, (slot) => slot.candidates.includes(enchantmentId) || slot.candidates.length >= 3 ? slot : { ...slot, candidates: [...slot.candidates, enchantmentId] })
    setPickerSlot(null); setQuery('')
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
      {slot.candidates.length < 3 && <button type="button" className="add-candidate-button" onClick={() => { setPickerSlot(slotIndex); setQuery('') }}>＋ 候補を追加</button>}
      <div className="selected-enchantment"><span>選択済み</span>{slot.selected ? <><EnchantmentDiamond enchantmentId={slot.selected.enchantmentId} category={category} selected /><label>Tier<select aria-label={`スロット${slotIndex + 1}のTier`} value={slot.selected.tier} onChange={(event) => updateSlot(slotIndex, (current) => current.selected ? { ...current, selected: { ...current.selected, tier: Number(event.target.value) as EnchantmentTier } } : current)}>{([1, 2, 3] as const).map((tier) => <option value={tier} key={tier}>{TIER_LABELS[tier]}</option>)}</select></label><button type="button" onClick={() => updateSlot(slotIndex, (current) => ({ candidates: current.candidates }))}>まだ選んでいない</button></> : <strong>—</strong>}</div>
      <button type="button" className="remove-slot-button" onClick={() => onChange(slots.filter((_, current) => current !== slotIndex))}>このスロットを削除</button>
    </fieldset>)}</div>
    {slots.length < 3 && <button type="button" className="add-slot-button" onClick={() => { const first = choices[0]; if (first) onChange([...slots, { candidates: [first.id] }]) }}>＋ スロットを追加</button>}
    {pickerSlot !== null && <div className="enchantment-picker" role="dialog" aria-modal="true" aria-label={`スロット${pickerSlot + 1}の候補を追加`} onKeyDown={(event) => { if (event.key === 'Escape') setPickerSlot(null) }}>
      <div className="enchantment-picker-card"><header><div><strong>候補を追加</strong><small>この装備に存在する通常枠のみ</small></div><button type="button" aria-label="候補選択を閉じる" onClick={() => setPickerSlot(null)}>×</button></header>
      <label className="picker-search">日本語名・英語名で検索<input autoFocus type="search" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
      <div className="enchantment-picker-list">{filtered.map((entry) => { const isCandidate = slots[pickerSlot]?.candidates.includes(entry.id); const isSelected = slots[pickerSlot]?.selected?.enchantmentId === entry.id; return <button type="button" key={entry.id} disabled={isCandidate} onClick={() => addCandidate(pickerSlot, entry.id)}><EnchantmentDiamond enchantmentId={entry.id} category={category} selected={isSelected} /><span>{CATEGORY_LABELS[category]} · {isSelected ? '選択済み' : isCandidate ? '候補登録済み' : entry.soulGearOnly ? 'Soul限定' : '追加可能'}</span></button> })}</div>
      {!filtered.length && <p>一致するエンチャントがありません。</p>}</div>
    </div>}
  </section>
}

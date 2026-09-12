import { useId, useState } from 'react'
import type { Inventory, Scenario, EnchantmentTier, Evaluation } from '../core/types'
import type { OwnedRangedWeapon, RangedRoll, RangedShotMode } from '../core/rangedTypes'
import { parseRangedWeapon, rangedWeaponUnsupportedReason } from '../core/ranged'
import { RANGED_WEAPON_AUDIT, RANGED_ENCHANTMENT_AUDIT } from '../research/rangedAudit'
import { RANGED_ENCHANTMENTS, RANGED_WEAPONS } from '../data/ranged'
import { japaneseEquipmentName } from '../data/equipmentNames.ja'

const enchantOptions = RANGED_ENCHANTMENT_AUDIT.entries
function RollEditor({ value, label, onChange }: { value: RangedRoll; label: string; onChange: (roll: RangedRoll) => void }) {
  return <div className="weapon-fields"><label>{label}<select aria-label={label} value={value.enchantmentId} onChange={(e) => onChange({ ...value, enchantmentId: e.target.value })}>
    {enchantOptions.map((entry) => <option key={entry.id} value={entry.id}>{entry.name.ja ?? entry.name.en}</option>)}
  </select></label><label>Tier<select aria-label={`${label} Tier`} value={value.tier} onChange={(e) => onChange({ ...value, tier: Number(e.target.value) as EnchantmentTier })}>{[1, 2, 3].map((tier) => <option key={tier} value={tier}>{['I', 'II', 'III'][tier - 1]}</option>)}</select></label></div>
}
function OwnedRangedEditor({ weapon, onChange, onRemove }: { weapon: OwnedRangedWeapon; onChange: (value: OwnedRangedWeapon) => void; onRemove: () => void }) {
  const errorId = useId()
  const observed = weapon.observation
  const observationDraft = () => ({ mode: observed?.mode ?? (weapon.weaponId.includes('crossbow') ? 'single' : 'uncharged'), damage: observed?.projectileDamage.toString() ?? '', cycle: observed?.shotCycleSeconds.toString() ?? '', ammo: observed?.availableAmmo.toString() ?? '', note: observed?.sourceNote ?? '' })
  const [draft, setDraft] = useState(observationDraft)
  const [previousObservation, setPreviousObservation] = useState(observed)
  // Sync imported/reset observations without remounting the focused editor.
  if (previousObservation !== observed) {
    setPreviousObservation(observed)
    setDraft(observationDraft())
  }
  const [error, setError] = useState('')
  const audited = RANGED_WEAPON_AUDIT.entries.find((item) => item.id === weapon.weaponId)!
  const changeSlot = (index: number, slot: OwnedRangedWeapon['enchantmentSlots'][number]) => onChange({ ...weapon, enchantmentSlots: weapon.enchantmentSlots.map((item, i) => i === index ? slot : item) })
  const saveObservation = () => {
    try {
      if ([draft.damage, draft.cycle, draft.ammo, draft.note].some((value) => value.trim() === '')) throw new Error('観測値とメモをすべて入力してください。')
      onChange(parseRangedWeapon({ ...weapon, observation: { gameVersion: '1.17.0.0', mode: draft.mode, projectileDamage: Number(draft.damage), shotCycleSeconds: Number(draft.cycle), availableAmmo: Number(draft.ammo), sourceNote: draft.note } }))
      setError('')
    } catch (err) { setError(err instanceof Error ? err.message : '観測値の形式が不正です。') }
  }
  return <details className="inventory-item equipment-card"><summary><span className="equipment-icon ranged" aria-hidden="true"><span>➶</span><small>{japaneseEquipmentName('ranged', weapon.weaponId, audited.name.ja).slice(0, 1)}</small></span><span className="equipment-title"><strong>{japaneseEquipmentName('ranged', weapon.weaponId, audited.name.ja)}</strong><small lang="en">{audited.name.en}</small></span><span className="equipment-meta">パワー {weapon.powerLevel}</span><span className="edit-label">編集</span></summary>
    <label>パワー<input aria-label={`${weapon.instanceId} 遠距離武器のパワー`} type="number" min="1" value={weapon.powerLevel} onChange={(e) => onChange({ ...weapon, powerLevel: Number(e.target.value) })} /></label>
    <p>固有効果: {[...audited.intrinsic.own, ...audited.intrinsic.inherited].join(' / ') || '追加効果なし'}</p>
    <details className="advanced-collection-fields"><summary>最適化に使う詳しい数値を入力する</summary><div><p>{rangedWeaponUnsupportedReason(weapon) ?? '入力した数値を使って、対応している組み合わせを比較します。'}</p><fieldset aria-describedby={error ? errorId : undefined} aria-invalid={Boolean(error)}><legend>通常矢の記録（1.17.0.0）</legend>
      <p>補正のない1本のダメージ、発射にかかる時間、使える矢の数を入力してください。弓はチャージ状態もそろえます。</p>
      <label>発射モード<select aria-label={`${weapon.instanceId} 発射モード`} value={draft.mode} onChange={(e) => setDraft({ ...draft, mode: e.target.value as RangedShotMode })}><option value="uncharged">弓・未チャージ</option><option value="charged">弓・フルチャージ</option><option value="single">クロスボウ・単射</option></select></label>
      {(['damage', 'cycle', 'ammo'] as const).map((field) => <label key={field}>{field === 'damage' ? 'neutral 1矢damage' : field === 'cycle' ? '完全発射周期（秒・charge/recovery込み）' : '戦闘中に使える通常矢数（補給なし）'}<input aria-label={`${weapon.instanceId} ${field}`} type="number" min={field === 'ammo' ? 0 : 0.000001} step={field === 'ammo' ? 1 : 'any'} value={draft[field]} onChange={(e) => setDraft({ ...draft, [field]: e.target.value })} /></label>)}
      <label>観測メモ / 出典<input aria-label={`${weapon.instanceId} 観測メモ`} value={draft.note} placeholder="対象・装備・版・記録箇所" onChange={(e) => setDraft({ ...draft, note: e.target.value })} /></label>
      <button type="button" onClick={saveObservation}>観測値を適用</button>{observed && <button type="button" onClick={() => onChange({ ...weapon, observation: undefined })}>観測値を解除</button>}
      {error && <p id={errorId} role="alert">{error}</p>}
    </fieldset>
    {weapon.enchantmentSlots.map((slot, index) => <fieldset key={index}><legend>Ranged slot {index + 1}</legend>
      {slot.candidates.map((candidate, i) => <div key={i}><RollEditor value={candidate} label={`${weapon.instanceId} slot ${index + 1} 候補 ${i + 1}`} onChange={(next) => changeSlot(index, { ...slot, candidates: slot.candidates.map((item, j) => j === i ? next : item), locked: undefined })} />{slot.candidates.length > 1 && <button type="button" onClick={() => changeSlot(index, { candidates: slot.candidates.filter((_, j) => i !== j) })}>候補を削除</button>}</div>)}
      {slot.candidates.length < 3 && <button type="button" onClick={() => changeSlot(index, { ...slot, candidates: [...slot.candidates, { enchantmentId: enchantOptions.find((entry) => !slot.candidates.some((item) => item.enchantmentId === entry.id))!.id, tier: 3 }] })}>候補を追加</button>}
      <label>確定候補<select aria-label={`${weapon.instanceId} slot ${index + 1} lock`} value={slot.locked ?? ''} onChange={(e) => changeSlot(index, { ...slot, locked: e.target.value || undefined })}><option value="">自由（未対応が混ざる個体は除外）</option>{slot.candidates.map((item, i) => <option key={i} value={item.enchantmentId}>{item.enchantmentId}</option>)}</select></label>
      <button type="button" onClick={() => onChange({ ...weapon, enchantmentSlots: weapon.enchantmentSlots.filter((_, i) => i !== index) })}>スロットを削除</button>
    </fieldset>)}
    {weapon.enchantmentSlots.length < 3 && <button type="button" onClick={() => onChange({ ...weapon, enchantmentSlots: [...weapon.enchantmentSlots, { candidates: [{ enchantmentId: 'power', tier: 3 }] }] })}>Rangedスロットを追加</button>}
    <label><input type="checkbox" checked={!!weapon.gilded} onChange={(e) => onChange({ ...weapon, gilded: e.target.checked ? { enchantmentId: 'critical-hit', tier: 1 } : undefined })} />Ranged 金色エンチャント</label>
    {weapon.gilded && <RollEditor value={weapon.gilded} label={`${weapon.instanceId} 金色エンチャント`} onChange={(gilded) => onChange({ ...weapon, gilded })} />}</div></details>
    <button type="button" aria-label={`${weapon.instanceId} 遠距離武器を削除`} onClick={onRemove}>遠距離武器を削除</button>
  </details>
}

export function RangedInventorySection({ inventory, onChange, scenario, onScenarioChange, showScenario = true, visibleWeapons }: { inventory: Inventory; onChange: (value: Inventory) => void; scenario: Scenario; onScenarioChange: (value: Scenario) => void; showScenario?: boolean; visibleWeapons?: readonly OwnedRangedWeapon[] }) {
  const weapons = inventory.rangedWeapons ?? []
  const renderedWeapons = visibleWeapons ?? weapons
  return <section className="control-section inventory-group"><div className="section-heading"><div><p className="section-label">RANGED</p><h2>遠距離武器</h2></div></div>
    {weapons.length > 0 && showScenario && <label>遠距離に使う攻撃時間の割合<input aria-label="遠距離時間割合" type="number" min="0.01" max="0.99" step="0.05" value={scenario.rangedTimeShare ?? ''} placeholder="入力してください" onChange={(e) => onScenarioChange({ ...scenario, rangedTimeShare: e.target.value === '' ? undefined : Number(e.target.value) })} /></label>}
    {renderedWeapons.map((weapon) => <OwnedRangedEditor key={weapon.instanceId} weapon={weapon} onChange={(next) => onChange({ ...inventory, rangedWeapons: weapons.map((item) => item.instanceId === next.instanceId ? next : item) })} onRemove={() => onChange({ ...inventory, rangedWeapons: weapons.filter((item) => item.instanceId !== weapon.instanceId) })} />)}
  </section>
}

export function RangedResult({ evaluation }: { evaluation: Evaluation }) {
  const state = evaluation.damage.ranged
  if (!state || !evaluation.build.rangedWeapon) return null
  return <section aria-label="遠距離の評価内訳"><h3>{RANGED_WEAPONS[state.weaponId]!.name.ja} · Limited</h3>
    <p>Power {evaluation.build.rangedWeapon.powerLevel} · {state.mode} · {state.shots}射 / 矢{state.ammoConsumed}本{state.ammoLimited ? '（弾数上限）' : ''}</p>
    <p>{(evaluation.build.rangedEnchantments ?? []).map((item) => `${RANGED_ENCHANTMENTS[item.enchantmentId]!.name.ja} ${['I', 'II', 'III'][item.tier - 1]} (${item.source})`).join(' / ') || 'Enchantなし'}</p>
    <dl><dt>直接近接DPS</dt><dd>{evaluation.damage.directWeaponSingleTargetDps.toFixed(2)}</dd><dt>間接近接DPS（proc / DoTは既存内訳）</dt><dd>{evaluation.damage.indirectSingleTargetDps.toFixed(2)}</dd><dt>直接遠距離DPS</dt><dd>{state.directSingleTargetDps.toFixed(2)}</dd><dt>間接遠距離DPS</dt><dd>0（対応効果未選択。Research-onlyの0点評価ではありません）</dd></dl>
    <p>根拠: {evaluation.build.rangedWeapon.observation!.sourceNote}（利用者観測、独立検証なし）</p>
    <p>{RANGED_WEAPONS[state.weaponId]!.intrinsic}</p>
  </section>
}

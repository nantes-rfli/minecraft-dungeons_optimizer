"use client"

import { useEffect, useMemo, useState, useSyncExternalStore, type ChangeEvent } from 'react'
import { optimize, summarizeDamageRegression } from './core'
import type {
  ArtifactId,
  EnchantmentId,
  EnchantmentTier,
  Evaluation,
  Inventory,
  LocalizedName,
  OwnedArtifact,
  OwnedWeapon,
  Scenario,
  ScenarioProfileId,
  WeaponId,
} from './core'
import type { ArmorEnchantmentTier, ArmorId, OwnedArmor } from './core/armor'
import { ARTIFACTS } from './data/artifacts'
import { ENCHANTMENTS } from './data/enchantments'
import { DAMAGE_REGRESSION_SAMPLES } from './data/regressionSamples'
import { DEFAULT_SCENARIO, SCENARIO_PROFILES } from './data/scenarios'
import { WEAPONS } from './data/weapons'
import { ARMORS, ARMOR_ENCHANTMENTS } from './data/armors'
import {
  changeGildedEnchantment,
  changeGildedTier,
  DEFAULT_GILDED_ENCHANTMENT,
} from './inventory/gilded'
import { deserializeInventory, loadInventoryState, saveInventory, serializeInventory } from './inventory/storage'
import { ControlDetails, ControlSettings } from './views/ControlDetails'
import { MethodologyPage } from './views/MethodologyPage'
import { RuntimeSupportWarnings } from './views/RuntimeSupport'
import { DpsRegressionPanel } from './views/DpsRegressionPanel'
import { EnemyCompositionControl } from './views/EnemyCompositionControl'
import { AmbushShareControl, UndeadShareControl } from './views/EnemyStateControls'
import { DirectDamageDetails } from './views/DirectDamageDetails'
import { EnemyDebuffControl } from './views/EnemyDebuffControl'
import { SoulStateDetails } from './views/SoulStateDetails'
import { TemporalStateDetails } from './views/TemporalStateDetails'
import { ChargeConsumeControls, ChargeConsumeDetails } from './views/ChargeConsumeDetails'
import { StateModelDetails } from './views/StateModelDetails'
import { DamageEventDetails, DamageEventTargetingControl, PersistentAreaTargetingControl, ProcPowerSupport } from './views/DamageEventControls'
import { enchantmentUnsupportedReason } from './core/damageEvents'
import { ARMOR_ENCHANTMENT_REFERENCE_CATALOG, ARMOR_ENCHANTMENT_REFERENCE_IDS } from './research/armorEnchantmentAudit'
import { RangedInventorySection, RangedResult } from './views/RangedEquipment'

const ENCHANTMENT_IDS = Object.keys(ENCHANTMENTS) as EnchantmentId[]
const WEAPON_IDS = Object.keys(WEAPONS) as WeaponId[]
const ARTIFACT_IDS = Object.keys(ARTIFACTS) as ArtifactId[]
const ARMOR_IDS = Object.keys(ARMORS) as ArmorId[]
const ARMOR_ENCHANTMENT_IDS = ARMOR_ENCHANTMENT_REFERENCE_IDS

const DEFAULT_INVENTORY: Inventory = {
  weapons: [
    {
      instanceId: 'bindings-1', weaponId: 'fighters-bindings', powerLevel: 251,
      enchantmentSlots: [
        { candidates: ['radiance', 'critical-hit'] },
        { candidates: ['leeching', 'guarding-strike'] },
        { candidates: ['void-strike', 'critical-hit'] },
      ],
    },
    {
      instanceId: 'double-axe-1', weaponId: 'double-axe', powerLevel: 251,
      enchantmentSlots: [
        { candidates: ['critical-hit', 'void-strike'] },
        { candidates: ['leeching', 'radiance'] },
        { candidates: ['guarding-strike', 'critical-hit'] },
      ],
    },
    {
      instanceId: 'anchor-1', weaponId: 'anchor', powerLevel: 251,
      enchantmentSlots: [
        { candidates: ['void-strike', 'critical-hit'] },
        { candidates: ['leeching', 'guarding-strike'] },
        { candidates: ['radiance', 'critical-hit'] },
      ],
    },
  ],
  artifacts: [
    { instanceId: 'mushroom-1', artifactId: 'death-cap-mushroom', powerLevel: 251 },
    { instanceId: 'amulet-1', artifactId: 'iron-hide-amulet', powerLevel: 251 },
  ],
}

const PROFILE_ORDER: ScenarioProfileId[] = ['balanced', 'damage', 'survival', 'boss', 'mobbing', 'apocalypse-plus']
const numberFormat = new Intl.NumberFormat('ja-JP', { maximumFractionDigits: 2 })
const percentage = (value: number): string => `${Math.round(value * 100)}%`
const CONFIDENCE_LABELS = { high: '高', medium: '中', low: '低' } as const
const TIER_LABELS = { 1: 'I', 2: 'II', 3: 'III' } as const
const ENCHANTMENT_TIERS: readonly EnchantmentTier[] = [1, 2, 3]
const ENCHANTMENT_SOURCE_LABELS = { slot: '通常枠', gilded: '金色', 'built-in': '固有' } as const
const subscribeToHydration = () => () => undefined
const getClientHydrationSnapshot = () => true
const getServerHydrationSnapshot = () => false
const DAMAGE_MODEL_ERROR = summarizeDamageRegression(DAMAGE_REGRESSION_SAMPLES)

function BilingualName({ name }: { name: LocalizedName }) {
  return <><span>{name.ja}</span><small lang="en">{name.en}</small></>
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="metric"><span>{label}</span><strong>{numberFormat.format(value)}</strong></div>
}

function BuildSummary({ evaluation, compact = false, title }: { evaluation: Evaluation; compact?: boolean; title?: string }) {
  const weapon = WEAPONS[evaluation.build.weapon.weaponId]
  return (
    <article className={compact ? 'result-card compact' : 'result-card'}>
      <div className="result-heading">
        <div><p className="eyebrow">{title ?? (compact ? '次点候補' : '推奨ビルド')}</p><h2>{weapon.name.ja}<small lang="en">{weapon.name.en} · Power {evaluation.build.weapon.powerLevel}</small></h2></div>
        <div className="score"><span>目的スコア / 100</span><strong>{numberFormat.format(evaluation.objectiveScore)}</strong></div>
      </div>
      <div className="chips">
        {evaluation.build.armor && <span className="chip armor"><BilingualName name={ARMORS[evaluation.build.armor.armorId as ArmorId].name} /></span>}
        {evaluation.build.armorEnchantments?.map((selected, index) => <span className="chip armor" key={`armor-${selected.enchantmentId}-${selected.source}-${index}`}><span>{ARMOR_ENCHANTMENTS[selected.enchantmentId].name.ja} {TIER_LABELS[selected.tier]}</span><small lang="en">{ARMOR_ENCHANTMENTS[selected.enchantmentId].name.en} {TIER_LABELS[selected.tier]} · {ENCHANTMENT_SOURCE_LABELS[selected.source]}</small></span>)}
        {evaluation.build.enchantments.map((selected, index) => <span className="chip" key={`${selected.enchantmentId}-${selected.source}-${index}`}><span>{ENCHANTMENTS[selected.enchantmentId].name.ja} {TIER_LABELS[selected.tier]}</span><small lang="en">{ENCHANTMENTS[selected.enchantmentId].name.en} {TIER_LABELS[selected.tier]} · {ENCHANTMENT_SOURCE_LABELS[selected.source]}</small></span>)}
        {evaluation.build.artifacts.map((item) => <span className="chip artifact" key={item.instanceId}><BilingualName name={ARTIFACTS[item.artifactId].name} /></span>)}
      </div>
      <p className="control-score">Control utility {percentage(evaluation.control.utility)} · 行動阻害・集敵の評価</p>
      <RangedResult evaluation={evaluation} />
      {!compact && <>
        <div className="metrics-grid">
          <Metric label={evaluation.damage.ranged ? '単体DPS（近接＋遠距離観測）' : evaluation.damage.damageSource === 'observed-input' ? '単体DPS（表示値ベース）' : '単体DPS（Power換算）'} value={evaluation.damage.singleTargetDps} />
          <Metric label={evaluation.damage.ranged ? 'AoE DPS（近接＋遠距離観測）' : evaluation.damage.damageSource === 'observed-input' ? 'AoE DPS（表示値ベース）' : 'AoE DPS（Power換算）'} value={evaluation.damage.aoeDps} />
          <Metric label={evaluation.damage.painCycleState ? 'Net sustain / 秒' : evaluation.build.enchantments.some((item) => item.enchantmentId === 'refreshment') ? '回復・容量 / 秒' : '回復 / 秒'} value={evaluation.healing.totalPerSecond} />
          <Metric label="実効HP" value={evaluation.defense.effectiveHealth} />
        </div>
        <ul className="reasons">{evaluation.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
        <DirectDamageDetails evaluation={evaluation} />
        <StateModelDetails evaluation={evaluation} />
        <ControlDetails evaluation={evaluation} />
        <TemporalStateDetails evaluation={evaluation} />
        <RuntimeSupportWarnings enchantments={evaluation.build.enchantments} />
        <ChargeConsumeDetails evaluation={evaluation} />
        <SoulStateDetails evaluation={evaluation} />
        <DamageEventDetails evaluation={evaluation} />
        <details className="contributions"><summary>効果ごとの数値寄与を見る</summary>
          {evaluation.damage.painCycleState && <p>回復列は自己damageを差し引いたNet sustainの差分です。自己damageそのものは上の内訳に分離表示しています。</p>}
          {evaluation.build.enchantments.some((item) => item.enchantmentId === 'refreshment') && <p>回復の差分にはRefreshmentの追加ポーション回復容量（実回復ではない近似）を含みます。</p>}
          <div className="contribution-table">
            <div className="table-head"><span>効果</span><span>Score</span><span>AoE</span><span>回復</span><span>EHP</span><span>Control Δ</span></div>
            {evaluation.contributions.map((item, index) => <div key={`${item.sourceType}-${item.sourceId}-${index}`}><span>{item.label.ja}<small>{item.label.en}</small></span><b>{item.objectiveDelta >= 0 ? '+' : ''}{numberFormat.format(item.objectiveDelta)}</b><span>{numberFormat.format(item.aoeDpsDelta)}</span><span>{numberFormat.format(item.healingPerSecondDelta)}</span><span>{numberFormat.format(item.effectiveHealthDelta)}</span><span>{numberFormat.format(item.controlUtilityDelta * 100)}pt</span></div>)}
          </div>
        </details>
      </>}
    </article>
  )
}

function nextInstanceId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function artifactPowerBounds(artifactId: ArtifactId): { min: number; max?: number } {
  const artifact = ARTIFACTS[artifactId]
  if ('supportedPowerRange' in artifact.duration && artifact.duration.supportedPowerRange) {
    return artifact.duration.supportedPowerRange
  }
  return { min: 1 }
}

function OwnedArmorEditor({ armor, onChange, onRemove }: { armor: OwnedArmor; onChange: (armor: OwnedArmor) => void; onRemove: () => void }) {
  const updateSlot = (slotIndex: number, updater: (slot: OwnedArmor['enchantmentSlots'][number]) => OwnedArmor['enchantmentSlots'][number]) => onChange({ ...armor, enchantmentSlots: armor.enchantmentSlots.map((slot, index) => index === slotIndex ? updater(slot) : slot) })
  return <details className="inventory-item"><summary><span>{ARMORS[armor.armorId as ArmorId]?.name.ja ?? armor.armorId}<small>{ARMORS[armor.armorId as ArmorId]?.name.en}</small></span><button type="button" onClick={(event) => { event.preventDefault(); onRemove() }}>削除</button></summary>
    <div className="weapon-fields"><label>Power <input aria-label={`${armor.instanceId}のArmor Power`} type="number" min="1" value={armor.powerLevel} onChange={(event) => onChange({ ...armor, powerLevel: Number(event.target.value) })} /></label><label>Armor card +Health <input aria-label={`${armor.instanceId}のArmor Health`} type="number" min="0" value={armor.observedHealthBonus ?? ''} onChange={(event) => onChange({ ...armor, observedHealthBonus: event.target.value === '' ? undefined : Number(event.target.value) })} /></label></div>
    {armor.enchantmentSlots.map((slot, slotIndex) => <fieldset key={slotIndex}><legend>Armorスロット {slotIndex + 1}</legend>{ARMOR_ENCHANTMENT_IDS.map((id) => { const roll = slot.candidates.find((candidate) => candidate.enchantmentId === id); const reference = ARMOR_ENCHANTMENT_REFERENCE_CATALOG[id]!; const runtime = id in ARMOR_ENCHANTMENTS; return <div className="gilded-fields armor-enchant-option" key={id}><label className="mini-check"><input type="checkbox" checked={Boolean(roll)} onChange={() => updateSlot(slotIndex, (current) => { const exists = current.candidates.some((candidate) => candidate.enchantmentId === id); if (exists && current.candidates.length === 1) return current; return { ...current, candidates: exists ? current.candidates.filter((candidate) => candidate.enchantmentId !== id) : [...current.candidates, { enchantmentId: id, tier: 3 }], locked: current.locked === id ? undefined : current.locked } })} /><span>{reference.name}<small>{id} · {runtime ? 'runtime対応（Limited）' : `未対応 / ${reference.runtimeReadiness}`}</small></span></label>{roll && <select aria-label={`Armorスロット${slotIndex + 1}の${id} Tier`} value={roll.tier} onChange={(event) => updateSlot(slotIndex, (current) => ({ ...current, candidates: current.candidates.map((candidate) => candidate.enchantmentId === id ? { ...candidate, tier: Number(event.target.value) as ArmorEnchantmentTier } : candidate) }))}>{ENCHANTMENT_TIERS.map((tier) => <option key={tier} value={tier}>{TIER_LABELS[tier]} · {reference.tiers[tier - 1]}</option>)}</select>}</div>})}<label className="slot-lock">確定済み<select value={slot.locked ?? ''} onChange={(event) => updateSlot(slotIndex, (current) => ({ ...current, locked: event.target.value || undefined }))}><option value="">未確定（全候補を比較）</option>{slot.candidates.map((roll) => <option key={roll.enchantmentId} value={roll.enchantmentId}>{ARMOR_ENCHANTMENT_REFERENCE_CATALOG[roll.enchantmentId]?.name ?? roll.enchantmentId} {TIER_LABELS[roll.tier]} · {roll.enchantmentId in ARMOR_ENCHANTMENTS ? 'runtime対応' : '未対応'}</option>)}</select></label>{armor.enchantmentSlots.length > 1 && <button type="button" onClick={() => onChange({ ...armor, enchantmentSlots: armor.enchantmentSlots.filter((_, index) => index !== slotIndex) })}>このスロットを削除</button>}</fieldset>)}
    {armor.enchantmentSlots.length < 3 && <button type="button" onClick={() => onChange({ ...armor, enchantmentSlots: [...armor.enchantmentSlots, { candidates: [{ enchantmentId: 'chilling', tier: 3 }] }] })}>＋ Armorスロットを追加</button>}
    <div className="gilded-editor"><label className="mini-check"><input type="checkbox" checked={armor.gilded !== undefined} onChange={(event) => onChange({ ...armor, gilded: event.target.checked ? { enchantmentId: 'chilling', tier: 3 } : undefined })} />金色Armor Enchantを含める</label>{armor.gilded && <div className="gilded-fields"><select value={armor.gilded.enchantmentId} onChange={(event) => onChange({ ...armor, gilded: armor.gilded ? { ...armor.gilded, enchantmentId: event.target.value } : undefined })}>{ARMOR_ENCHANTMENT_IDS.map((id) => <option key={id} value={id}>{ARMOR_ENCHANTMENT_REFERENCE_CATALOG[id]?.name} · {id in ARMOR_ENCHANTMENTS ? 'runtime対応' : '未対応'}</option>)}</select><select value={armor.gilded.tier} onChange={(event) => onChange({ ...armor, gilded: armor.gilded ? { ...armor.gilded, tier: Number(event.target.value) as ArmorEnchantmentTier } : undefined })}>{ENCHANTMENT_TIERS.map((tier) => <option key={tier} value={tier}>{TIER_LABELS[tier]}</option>)}</select></div>}</div>
  </details>
}

function OptimizerPage() {
  const hydrated = useSyncExternalStore(
    subscribeToHydration,
    getClientHydrationSnapshot,
    getServerHydrationSnapshot,
  )
  const [initialInventory] = useState(() => loadInventoryState(DEFAULT_INVENTORY))
  const [inventory, setInventory] = useState<Inventory>(initialInventory.inventory)
  const [loadError, setLoadError] = useState(initialInventory.error)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [scenario, setScenario] = useState<Scenario>(DEFAULT_SCENARIO)
  const [jsonText, setJsonText] = useState(initialInventory.error ? initialInventory.storedJson : '')
  const [dataMessage, setDataMessage] = useState('ブラウザに自動保存されます。')

  useEffect(() => {
    if (!hydrated || loadError) return
    const task = setTimeout(() => {
      try { saveInventory(inventory); setSaveError(null) }
      catch (error) { setSaveError(`自動保存を保留しました。入力を修正してください: ${error instanceof Error ? error.message : '不明なエラー'}`) }
    }, 100)
    return () => clearTimeout(task)
  }, [hydrated, inventory, loadError])

  const optimization = useMemo(() => {
    try { return { result: optimize(inventory, scenario), error: null } }
    catch (error) { return { result: null, error: error instanceof Error ? error.message : '計算中に不明なエラーが発生しました。' } }
  }, [inventory, scenario])
  const usesObservedDamage = inventory.weapons.some(
    (weapon) => weapon.observedDamagePerHit !== undefined,
  )
  const addWeapon = (weaponId: WeaponId) => {
    const weapon: OwnedWeapon = { instanceId: nextInstanceId(weaponId), weaponId, powerLevel: 251, enchantmentSlots: [{ candidates: ['critical-hit', 'radiance'] }, { candidates: ['leeching', 'guarding-strike'] }, { candidates: ['void-strike', 'critical-hit'] }] }
    setInventory((current) => ({ ...current, weapons: [...current.weapons, weapon] }))
  }
  const updateWeapon = (instanceId: string, updater: (weapon: OwnedWeapon) => OwnedWeapon) => setInventory((current) => ({ ...current, weapons: current.weapons.map((item) => item.instanceId === instanceId ? updater(item) : item) }))
  const addArmor = (armorId: ArmorId) => {
    const armor: OwnedArmor = { instanceId: nextInstanceId(armorId), armorId, powerLevel: 251, observedHealthBonus: 1_880_000, enchantmentSlots: [
      { candidates: [{ enchantmentId: 'cool-down', tier: 3 }, { enchantmentId: 'potion-barrier', tier: 3 }, { enchantmentId: 'chilling', tier: 3 }] },
    ] }
    setInventory((current) => ({ ...current, armors: [...(current.armors ?? []), armor] }))
  }
  const updateArmor = (instanceId: string, updater: (armor: OwnedArmor) => OwnedArmor) => setInventory((current) => ({ ...current, armors: (current.armors ?? []).map((item) => item.instanceId === instanceId ? updater(item) : item) }))
  const toggleCandidate = (instanceId: string, slotIndex: number, enchantmentId: EnchantmentId) => updateWeapon(instanceId, (weapon) => ({ ...weapon, enchantmentSlots: weapon.enchantmentSlots.map((slot, index) => {
    if (index !== slotIndex) return slot
    const exists = slot.candidates.includes(enchantmentId)
    if (exists && slot.candidates.length === 1) return slot
    return { ...slot, candidates: exists ? slot.candidates.filter((id) => id !== enchantmentId) : [...slot.candidates, enchantmentId], locked: slot.locked === enchantmentId ? undefined : slot.locked }
  }) }))
  const updateSlotLock = (instanceId: string, slotIndex: number, enchantmentId?: EnchantmentId) => updateWeapon(instanceId, (weapon) => ({ ...weapon, enchantmentSlots: weapon.enchantmentSlots.map((slot, index) => index === slotIndex ? { ...slot, locked: enchantmentId } : slot) }))
  const setGildedEnabled = (instanceId: string, enabled: boolean) => updateWeapon(instanceId, (weapon) => ({ ...weapon, gilded: enabled ? DEFAULT_GILDED_ENCHANTMENT : undefined }))
  const updateGildedEnchantment = (instanceId: string, enchantmentId: EnchantmentId) => updateWeapon(instanceId, (weapon) => ({
    ...weapon,
    gilded: weapon.gilded ? changeGildedEnchantment(weapon.gilded, enchantmentId) : undefined,
  }))
  const updateGildedTier = (instanceId: string, tier: EnchantmentTier) => updateWeapon(instanceId, (weapon) => ({
    ...weapon,
    gilded: weapon.gilded ? changeGildedTier(weapon.gilded, tier) : undefined,
  }))
  const addArtifact = (artifactId: ArtifactId) => {
    const item: OwnedArtifact = { instanceId: nextInstanceId(artifactId), artifactId, powerLevel: 251 }
    setInventory((current) => ({ ...current, artifacts: [...current.artifacts, item] }))
  }
  const importData = () => {
    try { const imported = deserializeInventory(jsonText); setInventory(imported); setLoadError(null); setDataMessage('JSONを読み込みました。') }
    catch (error) { setDataMessage(error instanceof Error ? error.message : '読み込みに失敗しました。') }
  }

  const updateNumber = (key: keyof Pick<Scenario,
    | 'enemySupplyPerSecond'
    | 'averageTargetsInReach'
    | 'cooldownReduction'
    | 'initialSoulUnits'
    | 'averageEnemyHealth'
    | 'incomingDamagePerSecond'
    | 'maxHealth'
    | 'radianceHealPerProc'
  >) => (event: ChangeEvent<HTMLInputElement>) => setScenario((current) => {
    const value = Number(event.target.value)
    return { ...current, [key]: value, ...(key === 'averageTargetsInReach' ? {
      crowdControl: { ...current.crowdControl,
        chainsExpectedTargetsPerProc: Math.min(current.crowdControl.chainsExpectedTargetsPerProc, value),
        gravityExpectedTargetsPerHit: Math.min(current.crowdControl.gravityExpectedTargetsPerHit, value),
      },
      damageEventTargeting: {
        shockwave: Math.min(current.damageEventTargeting.shockwave, value),
        swirling: Math.min(current.damageEventTargeting.swirling, value),
        thundering: Math.min(current.damageEventTargeting.thundering, value),
      },
    } : {}) }
  })

  if (!hydrated) return <main className="loading-state" aria-label="保存データを読み込み中">保存データを読み込んでいます…</main>

  return <main>
    <header className="hero"><div><p className="eyebrow">最適化コア試作版 · v0.1</p><h1>Minecraft Dungeons<br />最適装備ツール</h1><p className="product-name" lang="en">Gear Optimizer</p><p className="lede">実際の手持ち候補を全探索し、火力・回復・防御・Controlを目的別に比較します。</p></div><div className="confidence-note"><span>計算モデル</span><strong>検証中</strong><p>推測値は根拠と信頼度を分離。詳しい式と実装状況は「仕組み」ページで公開しています。</p></div></header>
    <section className="workspace">
      <aside className="controls">
        <div className="control-section"><p className="section-label">01 / 手持ち武器</p><div className="add-buttons">{WEAPON_IDS.map((id) => <button key={id} type="button" onClick={() => addWeapon(id)}>＋ {WEAPONS[id].name.ja}</button>)}</div>
          {inventory.weapons.map((weapon, weaponIndex) => <details className="inventory-item" key={weapon.instanceId} open={weaponIndex === 0}><summary><span>{WEAPONS[weapon.weaponId].name.ja}<small>{WEAPONS[weapon.weaponId].name.en}</small></span><button type="button" aria-label={`${WEAPONS[weapon.weaponId].name.ja}を削除`} onClick={(event) => { event.preventDefault(); setInventory((current) => ({ ...current, weapons: current.weapons.filter((item) => item.instanceId !== weapon.instanceId) })) }}>削除</button></summary>
            <div className="weapon-fields"><label title="自動換算の対応範囲はPower 50〜263です。範囲外では表示ダメージを入力してください。">Power <input type="number" min="1" max="263" value={weapon.powerLevel} onChange={(event) => updateWeapon(weapon.instanceId, (item) => ({ ...item, powerLevel: Number(event.target.value) }))} /></label><label title="ゲーム内の武器カードに表示される1ヒットのダメージ。使う場合は全武器に入力します。">表示ダメージ <input aria-label={`${WEAPONS[weapon.weaponId].name.ja}の表示ダメージ`} type="number" min="0.01" step="any" placeholder="任意" value={weapon.observedDamagePerHit ?? ''} onChange={(event) => updateWeapon(weapon.instanceId, (item) => ({ ...item, observedDamagePerHit: event.target.value === '' ? undefined : Number(event.target.value) }))} /></label></div>
            <ProcPowerSupport weapon={weapon} />
            {weapon.enchantmentSlots.map((slot, slotIndex) => <fieldset key={slotIndex}><legend>スロット {slotIndex + 1}</legend>{ENCHANTMENT_IDS.map((id) => <label className="mini-check" key={id} title={enchantmentUnsupportedReason(weapon, id)}><input type="checkbox" disabled={!slot.candidates.includes(id) && Boolean(enchantmentUnsupportedReason(weapon, id))} checked={slot.candidates.includes(id)} onChange={() => toggleCandidate(weapon.instanceId, slotIndex, id)} />{ENCHANTMENTS[id].name.ja} III</label>)}<label className="slot-lock">確定済み<select aria-label={`スロット${slotIndex + 1}の確定済みエンチャント`} value={slot.locked ?? ''} onChange={(event) => updateSlotLock(weapon.instanceId, slotIndex, event.target.value ? event.target.value as EnchantmentId : undefined)}><option value="">未確定（全候補を比較）</option>{slot.candidates.map((id) => <option key={id} value={id} disabled={Boolean(enchantmentUnsupportedReason(weapon, id))}>{ENCHANTMENTS[id].name.ja} III</option>)}</select></label></fieldset>)}
            <div className="gilded-editor"><label className="mini-check"><input type="checkbox" checked={weapon.gilded !== undefined} onChange={(event) => setGildedEnabled(weapon.instanceId, event.target.checked)} />金色エンチャントを含める</label>{weapon.gilded && <div className="gilded-fields"><label><span>Enchant</span><select aria-label={`${WEAPONS[weapon.weaponId].name.ja}の金色エンチャント`} value={weapon.gilded.enchantmentId} onChange={(event) => updateGildedEnchantment(weapon.instanceId, event.target.value as EnchantmentId)}>{ENCHANTMENT_IDS.map((id) => <option key={id} value={id} disabled={Boolean(enchantmentUnsupportedReason(weapon, id))}>{ENCHANTMENTS[id].name.ja}</option>)}</select></label><label><span>Tier</span><select aria-label={`${WEAPONS[weapon.weaponId].name.ja}の金色エンチャントTier`} value={weapon.gilded.tier} onChange={(event) => updateGildedTier(weapon.instanceId, Number(event.target.value) as EnchantmentTier)}>{ENCHANTMENT_TIERS.map((tier) => <option key={tier} value={tier}>{TIER_LABELS[tier]}</option>)}</select></label></div>}</div>
          </details>)}
        </div>
        <div className="control-section"><p className="section-label">02 / 手持ちArmor</p><div className="add-buttons">{ARMOR_IDS.map((id) => <button key={id} type="button" onClick={() => addArmor(id)}>＋ {ARMORS[id].name.ja}</button>)}</div>{(inventory.armors ?? []).map((armor) => <OwnedArmorEditor key={armor.instanceId} armor={armor} onChange={(next) => updateArmor(armor.instanceId, () => next)} onRemove={() => setInventory((current) => ({ ...current, armors: (current.armors ?? []).filter((item) => item.instanceId !== armor.instanceId) }))} />)}</div>
        <RangedInventorySection inventory={inventory} onChange={setInventory} scenario={scenario} onScenarioChange={setScenario} />
        <div className="control-section"><p className="section-label">03 / 手持ちアーティファクト</p><div className="add-buttons">{ARTIFACT_IDS.map((id) => <button key={id} type="button" onClick={() => addArtifact(id)}>＋ {ARTIFACTS[id].name.ja}</button>)}</div>
          {inventory.artifacts.map((artifact) => {
            const bounds = artifactPowerBounds(artifact.artifactId)
            return <div className="artifact-row" key={artifact.instanceId}><span>{ARTIFACTS[artifact.artifactId].name.ja}<small>{ARTIFACTS[artifact.artifactId].name.en}</small></span><input aria-label={`${ARTIFACTS[artifact.artifactId].name.ja}のPower`} type="number" min={bounds.min} max={bounds.max} value={artifact.powerLevel} onChange={(event) => setInventory((current) => ({ ...current, artifacts: current.artifacts.map((item) => item.instanceId === artifact.instanceId ? { ...item, powerLevel: Number(event.target.value) } : item) }))} /><button type="button" onClick={() => setInventory((current) => ({ ...current, artifacts: current.artifacts.filter((item) => item.instanceId !== artifact.instanceId) }))}>削除</button></div>
          })}
        </div>
        <div className="control-section"><p className="section-label">04 / 目的・シナリオ</p><div className="profile-buttons">{PROFILE_ORDER.map((id) => <button className={scenario.profileId === id ? 'active' : ''} key={id} type="button" onClick={() => setScenario(SCENARIO_PROFILES[id])}>{SCENARIO_PROFILES[id].name}</button>)}</div></div>
        <div className="control-section sliders"><p className="section-label">05 / 微調整</p><ChargeConsumeControls scenario={scenario} onChange={setScenario} /><ControlSettings scenario={scenario} onChange={setScenario} /><DamageEventTargetingControl value={scenario.damageEventTargeting} maximum={scenario.averageTargetsInReach} onChange={(damageEventTargeting) => setScenario((current) => ({ ...current, damageEventTargeting }))} /><PersistentAreaTargetingControl value={scenario.persistentAreaTargeting} maximum={scenario.averageTargetsInReach} onChange={(persistentAreaTargeting) => setScenario((current) => ({ ...current, persistentAreaTargeting }))} /><EnemyDebuffControl value={scenario.enemyDebuffs} onChange={(enemyDebuffs) => setScenario((current) => ({ ...current, enemyDebuffs }))} /><UndeadShareControl value={scenario.enemyComposition} onChange={(enemyComposition) => setScenario((current) => ({ ...current, enemyComposition }))} /><AmbushShareControl value={scenario.enemyState} onChange={(enemyState) => setScenario((current) => ({ ...current, enemyState }))} /><EnemyCompositionControl value={scenario.enemyComposition} onChange={(enemyComposition) => setScenario((current) => ({ ...current, enemyComposition }))} /><label title="シナリオが供給する敵数の上限です。実際の撃破速度はBuildのDPSから計算します。"><span>敵供給上限 / 秒 <output>{scenario.enemySupplyPerSecond.toFixed(1)}</output></span><input type="range" min="0" max="2" step="0.1" value={scenario.enemySupplyPerSecond} onChange={updateNumber('enemySupplyPerSecond')} /></label><label><span>射程内の敵 <output>{scenario.averageTargetsInReach.toFixed(1)}</output></span><input type="range" min="1" max="6" step="0.5" value={scenario.averageTargetsInReach} onChange={updateNumber('averageTargetsInReach')} /></label><label><span>開始Soul <output>{scenario.initialSoulUnits ?? 0}</output></span><input aria-label="開始Soul" type="range" min="0" max="300" step="5" value={scenario.initialSoulUnits ?? 0} onChange={updateNumber('initialSoulUnits')} /></label><label title="Cowardice使用時だけ必須。0〜1の明示的なモデル仮定です。"><span>Cowardice 満タンHP時間割合</span><input aria-label="Cowardice 満タンHP時間割合" type="number" min="0" max="1" step="0.05" placeholder="Cowardice使用時に入力" value={scenario.cowardiceFullHealthShare ?? ''} onChange={(event) => setScenario((current) => ({ ...current, cowardiceFullHealthShare: event.target.value === '' ? undefined : Number(event.target.value) }))} /></label><label><span>Artifactのクールダウン短縮 <output>{percentage(scenario.cooldownReduction)}</output></span><input type="range" min="0" max="0.75" step="0.05" value={scenario.cooldownReduction} onChange={updateNumber('cooldownReduction')} /></label><details className="scenario-values" open><summary>HP・ダメージの実数値</summary><p>{usesObservedDamage ? '表示ダメージ' : 'Power換算ダメージ'}と同じゲーム内単位で入力してください。</p><label><span>平均敵HP</span><input aria-label="平均敵HP" type="number" min="0.01" step="any" value={scenario.averageEnemyHealth} onChange={updateNumber('averageEnemyHealth')} /></label><label><span>被ダメージ / 秒</span><input aria-label="被ダメージ毎秒" type="number" min="0" step="any" value={scenario.incomingDamagePerSecond} onChange={updateNumber('incomingDamagePerSecond')} /></label><label title={(inventory.armors?.length ?? 0) > 0 ? 'Armor cardの+Healthから最大HPを解決します。' : 'ArmorなしBuild用のlegacy最大HPです。'}><span>{(inventory.armors?.length ?? 0) > 0 ? '最大HP（Armor使用時は無効）' : '最大HP'}</span><input aria-label="最大HP" type="number" min="0.01" step="any" disabled={(inventory.armors?.length ?? 0) > 0} value={scenario.maxHealth} onChange={updateNumber('maxHealth')} /></label><label><span>輝き1回の回復量</span><input aria-label="輝き1回の回復量" type="number" min="0" step="any" value={scenario.radianceHealPerProc} onChange={updateNumber('radianceHealPerProc')} /></label></details></div>
        {(loadError || saveError) && <p role="alert">{loadError ?? saveError}</p>}
        <details className="control-section data-tools"><summary>保存データ / JSON</summary><textarea value={jsonText} placeholder="ここにJSONを書き出すか、読み込むJSONを貼り付けます" onChange={(event) => setJsonText(event.target.value)} /><div><button type="button" onClick={() => { setJsonText(serializeInventory(inventory)); setDataMessage('JSONを書き出しました。') }}>書き出す</button><button type="button" onClick={importData}>読み込む</button></div><p>{dataMessage}</p></details>
      </aside>
      <section className="results" aria-live="polite">{optimization.error && <div className="error-panel">{optimization.error}</div>}{optimization.result && <>{optimization.result.unsupportedChoices.length > 0 && <div className="model-warning" role="note"><strong>未対応の候補は評価から除外しました（0点として採用しません）</strong>{optimization.result.unsupportedChoices.map((reason) => <p key={reason}>{reason}</p>)}</div>}{optimization.result.best.damage.damageSource === 'power-curve-estimate' && <div className="model-warning" role="note"><strong>Power換算は1.17.0.0の内部rating比を使う推定値です</strong><span>Power 50〜263に対応します。version不明のWiki damage表とは最大45.06%ずれます。正確な個体値が必要なら全武器へ表示ダメージを入力し、HP・回復量も同じゲーム内単位へ合わせてください。</span></div>}<div className="result-meta"><span>{optimization.result.evaluatedBuildCount}通りを全探索 · {optimization.result.best.damage.damageSource === 'observed-input' ? '表示ダメージ' : 'Power換算値'}</span><span>推定撃破 {numberFormat.format(optimization.result.best.combatState.estimatedKillsPerSecond)} / 秒（供給上限 {numberFormat.format(scenario.enemySupplyPerSecond)}）</span><span>Evidence coverage {Math.round(optimization.result.best.confidence.coverageScore * 100)} / 100（{CONFIDENCE_LABELS[optimization.result.best.confidence.label]}）</span></div><DpsRegressionPanel summary={DAMAGE_MODEL_ERROR} predictedDps={optimization.result.best.damage.singleTargetDps} /><BuildSummary evaluation={optimization.result.best} />
        <h3 className="alternatives-title">Pareto前線 — 火力・回復・防御・Controlのどれかで劣らない候補</h3><div className="alternatives">{optimization.result.paretoFrontier.slice(0, 3).map((evaluation, index) => <BuildSummary compact title={`PARETO ${index + 1}`} evaluation={evaluation} key={`pareto-${evaluation.build.weapon.instanceId}-${evaluation.build.enchantments.map((selected) => `${selected.enchantmentId}-${selected.tier}`).join('-')}`} />)}</div>
        <h3 className="alternatives-title">次点候補</h3><div className="alternatives">{optimization.result.alternatives.map((evaluation) => <BuildSummary compact evaluation={evaluation} key={`${evaluation.build.weapon.instanceId}-${evaluation.build.enchantments.map((selected) => `${selected.enchantmentId}-${selected.tier}`).join('-')}`} />)}</div><details className="caveats"><summary>計算上の注意</summary><ul>{optimization.result.best.confidence.caveats.map((caveat) => <li key={caveat}>{caveat}</li>)}</ul></details></>}</section>
    </section>
  </main>
}

export default function App() {
  const [page, setPage] = useState<'methodology' | 'optimizer'>('optimizer')
  useEffect(() => { const onHashChange = () => setPage(globalThis.location.hash === '#methodology' ? 'methodology' : 'optimizer'); onHashChange(); globalThis.addEventListener('hashchange', onHashChange); return () => globalThis.removeEventListener('hashchange', onHashChange) }, [])
  return <><nav className="site-nav"><a className="brand" href="#optimizer">MCD / OPT</a><div><a className={page === 'optimizer' ? 'active' : ''} href="#optimizer">最適化</a><a className={page === 'methodology' ? 'active' : ''} href="#methodology">仕組み・実装状況</a></div></nav>{page === 'methodology' ? <MethodologyPage /> : <OptimizerPage />}</>
}

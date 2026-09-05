"use client"

import { useEffect, useState, useSyncExternalStore, type ChangeEvent } from 'react'
import { summarizeDamageRegression } from './core/modelError'
import { useOptimizer } from './optimizer/useOptimizer'
import { estimateSearchCandidates, SEARCH_WARNING_CANDIDATES, SEARCH_MAX_CANDIDATES } from './core/searchBudget'
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
import { RANGED_WEAPONS } from './data/ranged'
import { AppShell } from './app/AppShell'
import { useAppRoute, type AppRoute } from './app/routes'
import { DataBrowserPage } from './screens/DataBrowserPage'
import { ModelExplorerPage } from './screens/ModelExplorerPage'
import { ChangesPage } from './screens/ChangesPage'

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
          <table className="contribution-table"><caption>効果別の寄与度</caption>
            <thead><tr><th scope="col">効果</th><th scope="col">Score</th><th scope="col">AoE</th><th scope="col">回復</th><th scope="col">EHP</th><th scope="col">Control Δ</th></tr></thead>
            <tbody>{evaluation.contributions.map((item, index) => <tr key={`${item.sourceType}-${item.sourceId}-${index}`}><th scope="row">{item.label.ja}<small>{item.label.en}</small></th><td>{item.objectiveDelta >= 0 ? '+' : ''}{numberFormat.format(item.objectiveDelta)}</td><td>{numberFormat.format(item.aoeDpsDelta)}</td><td>{numberFormat.format(item.healingPerSecondDelta)}</td><td>{numberFormat.format(item.effectiveHealthDelta)}</td><td>{numberFormat.format(item.controlUtilityDelta * 100)}pt</td></tr>)}</tbody>
          </table>
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
  return <details className="inventory-item"><summary><span>{ARMORS[armor.armorId as ArmorId]?.name.ja ?? armor.armorId}<small>{ARMORS[armor.armorId as ArmorId]?.name.en}</small></span></summary><button type="button" onClick={(event) => { event.preventDefault(); onRemove() }}>削除</button>
    <div className="weapon-fields"><label>Power <input aria-label={`${armor.instanceId}のArmor Power`} type="number" min="1" value={armor.powerLevel} onChange={(event) => onChange({ ...armor, powerLevel: Number(event.target.value) })} /></label><label>Armor card +Health <input aria-label={`${armor.instanceId}のArmor Health`} type="number" min="0" value={armor.observedHealthBonus ?? ''} onChange={(event) => onChange({ ...armor, observedHealthBonus: event.target.value === '' ? undefined : Number(event.target.value) })} /></label></div>
    {armor.enchantmentSlots.map((slot, slotIndex) => <fieldset key={slotIndex}><legend>Armorスロット {slotIndex + 1}</legend>{ARMOR_ENCHANTMENT_IDS.map((id) => { const roll = slot.candidates.find((candidate) => candidate.enchantmentId === id); const reference = ARMOR_ENCHANTMENT_REFERENCE_CATALOG[id]!; const runtime = id in ARMOR_ENCHANTMENTS; return <div className="gilded-fields armor-enchant-option" key={id}><label className="mini-check"><input type="checkbox" checked={Boolean(roll)} onChange={() => updateSlot(slotIndex, (current) => { const exists = current.candidates.some((candidate) => candidate.enchantmentId === id); if (exists && current.candidates.length === 1) return current; return { ...current, candidates: exists ? current.candidates.filter((candidate) => candidate.enchantmentId !== id) : [...current.candidates, { enchantmentId: id, tier: 3 }], locked: current.locked === id ? undefined : current.locked } })} /><span>{reference.name}<small>{id} · {runtime ? 'runtime対応（Limited）' : `未対応 / ${reference.runtimeReadiness}`}</small></span></label>{roll && <select aria-label={`Armorスロット${slotIndex + 1}の${id} Tier`} value={roll.tier} onChange={(event) => updateSlot(slotIndex, (current) => ({ ...current, candidates: current.candidates.map((candidate) => candidate.enchantmentId === id ? { ...candidate, tier: Number(event.target.value) as ArmorEnchantmentTier } : candidate) }))}>{ENCHANTMENT_TIERS.map((tier) => <option key={tier} value={tier}>{TIER_LABELS[tier]} · {reference.tiers[tier - 1]}</option>)}</select>}</div>})}<label className="slot-lock">確定済み<select value={slot.locked ?? ''} onChange={(event) => updateSlot(slotIndex, (current) => ({ ...current, locked: event.target.value || undefined }))}><option value="">未確定（全候補を比較）</option>{slot.candidates.map((roll) => <option key={roll.enchantmentId} value={roll.enchantmentId}>{ARMOR_ENCHANTMENT_REFERENCE_CATALOG[roll.enchantmentId]?.name ?? roll.enchantmentId} {TIER_LABELS[roll.tier]} · {roll.enchantmentId in ARMOR_ENCHANTMENTS ? 'runtime対応' : '未対応'}</option>)}</select></label>{armor.enchantmentSlots.length > 1 && <button type="button" onClick={() => onChange({ ...armor, enchantmentSlots: armor.enchantmentSlots.filter((_, index) => index !== slotIndex) })}>このスロットを削除</button>}</fieldset>)}
    {armor.enchantmentSlots.length < 3 && <button type="button" onClick={() => onChange({ ...armor, enchantmentSlots: [...armor.enchantmentSlots, { candidates: [{ enchantmentId: 'chilling', tier: 3 }] }] })}>＋ Armorスロットを追加</button>}
    <div className="gilded-editor"><label className="mini-check"><input type="checkbox" checked={armor.gilded !== undefined} onChange={(event) => onChange({ ...armor, gilded: event.target.checked ? { enchantmentId: 'chilling', tier: 3 } : undefined })} />金色Armor Enchantを含める</label>{armor.gilded && <div className="gilded-fields"><select aria-label={`${armor.instanceId}の金色Armor Enchant`} value={armor.gilded.enchantmentId} onChange={(event) => onChange({ ...armor, gilded: armor.gilded ? { ...armor.gilded, enchantmentId: event.target.value } : undefined })}>{ARMOR_ENCHANTMENT_IDS.map((id) => <option key={id} value={id}>{ARMOR_ENCHANTMENT_REFERENCE_CATALOG[id]?.name} · {id in ARMOR_ENCHANTMENTS ? 'runtime対応' : '未対応'}</option>)}</select><select aria-label={`${armor.instanceId}の金色Armor Tier`} value={armor.gilded.tier} onChange={(event) => onChange({ ...armor, gilded: armor.gilded ? { ...armor.gilded, tier: Number(event.target.value) as ArmorEnchantmentTier } : undefined })}>{ENCHANTMENT_TIERS.map((tier) => <option key={tier} value={tier}>{TIER_LABELS[tier]}</option>)}</select></div>}</div>
  </details>
}

function OptimizerPage({ route }: { route: AppRoute }) {
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
  const [dataError, setDataError] = useState(false)
  const [dataMessage, setDataMessage] = useState('ブラウザに自動保存されます。')
  const [weaponToAdd, setWeaponToAdd] = useState<WeaponId>(WEAPON_IDS[0]!)
  const [armorToAdd, setArmorToAdd] = useState<ArmorId>(ARMOR_IDS[0]!)
  const [artifactToAdd, setArtifactToAdd] = useState<ArtifactId>(ARTIFACT_IDS[0]!)

  useEffect(() => {
    if (!hydrated || loadError) return
    const task = setTimeout(() => {
      try { saveInventory(inventory); setSaveError(null) }
      catch (error) { setSaveError(`自動保存を保留しました。入力を修正してください: ${error instanceof Error ? error.message : '不明なエラー'}`) }
    }, 100)
    return () => clearTimeout(task)
  }, [hydrated, inventory, loadError])

  const optimization = useOptimizer(inventory, scenario)
  const candidateEstimate = estimateSearchCandidates(inventory)
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
    try { const imported = deserializeInventory(jsonText); setDataError(false); setInventory(imported); setLoadError(null); setDataMessage('JSONを読み込みました。') }
    catch (error) { setDataError(true); setDataMessage(error instanceof Error ? error.message : '読み込みに失敗しました。') }
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

  if (route.startsWith('/data')) return <DataBrowserPage route={route} />
  if (route.startsWith('/model')) return <ModelExplorerPage route={route} />
  if (route === '/changes') return <ChangesPage />

  if (route === '/storage') return <main id="main-content" tabIndex={-1} className="page-main narrow-page">
    <header className="page-intro"><p className="eyebrow">UTILITY / LOCAL DATA</p><h1>保存・復元</h1><p>装備データはこのブラウザへ自動保存されます。JSON schema v2で別ブラウザへの移行や復旧ができます。</p></header>
    {(loadError || saveError) && <div className="error-panel" role="alert"><strong>自動保存を確認してください</strong><p>{loadError ?? saveError}</p></div>}
    <section className="storage-card"><div><p className="section-label">LOCAL STORAGE</p><h2>{loadError ? '復旧が必要です' : '自動保存は有効です'}</h2><p>{loadError ? '保存済みJSONを確認し、修正したデータを読み込んでください。' : '装備を変更すると、この端末のブラウザ内へ保存します。'}</p></div><span className={loadError ? 'storage-status error' : 'storage-status'}>{loadError ? '要確認' : '保存中'}</span></section>
    <section className="panel data-tools storage-tools"><h2>JSONを書き出す / 読み込む</h2><p>書き出したJSONには所持装備、候補、lock、Gilded、観測値が含まれます。Scenario設定は含みません。</p><textarea aria-label="Inventory JSON" aria-describedby="json-message" aria-invalid={dataError} value={jsonText} placeholder="「書き出す」で現在のデータを表示するか、読み込むJSONを貼り付けます" onChange={(event) => setJsonText(event.target.value)} /><div><button className="primary-button" type="button" onClick={() => { setDataError(false); setJsonText(serializeInventory(inventory)); setDataMessage('JSON schema v2を書き出しました。') }}>現在の装備を書き出す</button><button type="button" onClick={importData}>JSONを読み込む</button></div><p id="json-message" role={dataError ? 'alert' : 'status'}>{dataMessage}</p><details><summary>schemaと復旧について</summary><p>schema v1 / v2を読み込み、常にv2を書き出します。読み込みに失敗したデータは自動的に上書きしないため、この画面で修正できます。</p></details></section>
  </main>

  if (route === '/inventory') {
    const rangedCount = inventory.rangedWeapons?.length ?? 0
    const ownedCount = inventory.weapons.length + (inventory.armors?.length ?? 0) + rangedCount + inventory.artifacts.length
    const needsReview = inventory.weapons.filter((item) => item.powerLevel > 263 && item.observedDamagePerHit === undefined).length + (inventory.rangedWeapons ?? []).filter((item) => item.observation === undefined).length
    const supportedRanged = (inventory.rangedWeapons ?? []).filter((item) => item.weaponId in RANGED_WEAPONS)
    const optimizerReady = inventory.weapons.length + (inventory.armors?.length ?? 0) + inventory.artifacts.length + supportedRanged.filter((item) => item.observation !== undefined).length
    const limited = (inventory.armors?.length ?? 0) + supportedRanged.length + inventory.artifacts.filter((item) => item.artifactId === 'shock-powder').length
    const researchOnly = rangedCount - supportedRanged.length
    return <main id="main-content" tabIndex={-1} className="page-main inventory-page">
      <header className="page-intro page-intro-row"><div><p className="eyebrow">INVENTORY / MY BOX</p><h1>装備</h1><p>自分が持っている装備と実際の候補だけを登録します。最適化条件は「最適化」で設定します。</p></div><div className="inventory-total"><strong>{ownedCount}</strong><span>登録済み</span></div></header>
      <section className="inventory-summary" aria-label="所持品サマリー"><article><span>近接</span><strong>{inventory.weapons.length}</strong></article><article><span>防具</span><strong>{inventory.armors?.length ?? 0}</strong></article><article><span>遠距離</span><strong>{rangedCount}</strong></article><article><span>Artifact</span><strong>{inventory.artifacts.length}</strong></article><article><span>Optimizer利用可</span><strong>{optimizerReady}</strong></article><article><span>Limited</span><strong>{limited}</strong></article><article><span>Research-only</span><strong>{researchOnly}</strong></article><article className={needsReview ? 'needs-review' : ''}><span>要確認</span><strong>{needsReview}</strong></article></section>
      {(loadError || saveError) && <p className="inline-alert" role="alert">{loadError ?? saveError}</p>}
      <section className="inventory-group"><div className="section-heading"><div><p className="section-label">MELEE</p><h2>近接武器</h2></div><div className="quick-add"><label><span className="sr-only">追加する近接武器</span><select aria-label="追加する近接武器" value={weaponToAdd} onChange={(event) => setWeaponToAdd(event.target.value as WeaponId)}>{WEAPON_IDS.map((id) => <option value={id} key={id}>{WEAPONS[id].name.ja}</option>)}</select></label><button type="button" onClick={() => addWeapon(weaponToAdd)}>＋ 装備を追加</button></div></div>
        <div className="equipment-list">{inventory.weapons.map((weapon) => <details className="equipment-card" key={weapon.instanceId}><summary><span className="equipment-title"><strong>{WEAPONS[weapon.weaponId].name.ja}</strong><small lang="en">{WEAPONS[weapon.weaponId].name.en}</small></span><span className="equipment-meta">Power {weapon.powerLevel}<small>{weapon.enchantmentSlots.flatMap((slot) => slot.candidates).slice(0, 3).map((id) => ENCHANTMENTS[id].name.ja).join(' · ')}</small></span><span className="edit-label">編集</span></summary><div className="editor-body"><button type="button" className="danger-button" aria-label={`${WEAPONS[weapon.weaponId].name.ja}を削除`} onClick={() => setInventory((current) => ({ ...current, weapons: current.weapons.filter((item) => item.instanceId !== weapon.instanceId) }))}>削除</button><div className="weapon-fields"><label>Power <input type="number" min="1" max="263" value={weapon.powerLevel} onChange={(event) => updateWeapon(weapon.instanceId, (item) => ({ ...item, powerLevel: Number(event.target.value) }))} /></label><label>表示ダメージ <input aria-label={`${WEAPONS[weapon.weaponId].name.ja}の表示ダメージ`} type="number" min="0.01" step="any" placeholder="任意" value={weapon.observedDamagePerHit ?? ''} onChange={(event) => updateWeapon(weapon.instanceId, (item) => ({ ...item, observedDamagePerHit: event.target.value === '' ? undefined : Number(event.target.value) }))} /></label></div><ProcPowerSupport weapon={weapon} />{weapon.enchantmentSlots.map((slot, slotIndex) => <fieldset key={slotIndex}><legend>スロット {slotIndex + 1}</legend>{ENCHANTMENT_IDS.map((id) => <label className="mini-check" key={id} title={enchantmentUnsupportedReason(weapon, id)}><input type="checkbox" disabled={!slot.candidates.includes(id) && Boolean(enchantmentUnsupportedReason(weapon, id))} checked={slot.candidates.includes(id)} onChange={() => toggleCandidate(weapon.instanceId, slotIndex, id)} />{ENCHANTMENTS[id].name.ja} III</label>)}<label className="slot-lock">確定済み<select aria-label={`スロット${slotIndex + 1}の確定済みエンチャント`} value={slot.locked ?? ''} onChange={(event) => updateSlotLock(weapon.instanceId, slotIndex, event.target.value ? event.target.value as EnchantmentId : undefined)}><option value="">未確定（全候補を比較）</option>{slot.candidates.map((id) => <option key={id} value={id} disabled={Boolean(enchantmentUnsupportedReason(weapon, id))}>{ENCHANTMENTS[id].name.ja} III</option>)}</select></label></fieldset>)}<div className="gilded-editor"><label className="mini-check"><input type="checkbox" checked={weapon.gilded !== undefined} onChange={(event) => setGildedEnabled(weapon.instanceId, event.target.checked)} />金色エンチャントを含める</label>{weapon.gilded && <div className="gilded-fields"><label><span>Enchant</span><select aria-label={`${WEAPONS[weapon.weaponId].name.ja}の金色エンチャント`} value={weapon.gilded.enchantmentId} onChange={(event) => updateGildedEnchantment(weapon.instanceId, event.target.value as EnchantmentId)}>{ENCHANTMENT_IDS.map((id) => <option key={id} value={id} disabled={Boolean(enchantmentUnsupportedReason(weapon, id))}>{ENCHANTMENTS[id].name.ja}</option>)}</select></label><label><span>Tier</span><select aria-label={`${WEAPONS[weapon.weaponId].name.ja}の金色エンチャントTier`} value={weapon.gilded.tier} onChange={(event) => updateGildedTier(weapon.instanceId, Number(event.target.value) as EnchantmentTier)}>{ENCHANTMENT_TIERS.map((tier) => <option key={tier} value={tier}>{TIER_LABELS[tier]}</option>)}</select></label></div>}</div></div></details>)}</div>
      </section>
      <section className="inventory-group"><div className="section-heading"><div><p className="section-label">ARMOR</p><h2>防具</h2></div><div className="quick-add"><label><span className="sr-only">追加する防具</span><select aria-label="追加する防具" value={armorToAdd} onChange={(event) => setArmorToAdd(event.target.value as ArmorId)}>{ARMOR_IDS.map((id) => <option value={id} key={id}>{ARMORS[id].name.ja}</option>)}</select></label><button type="button" onClick={() => addArmor(armorToAdd)}>＋ 装備を追加</button></div></div>{(inventory.armors ?? []).map((armor) => <OwnedArmorEditor key={armor.instanceId} armor={armor} onChange={(next) => updateArmor(armor.instanceId, () => next)} onRemove={() => setInventory((current) => ({ ...current, armors: (current.armors ?? []).filter((item) => item.instanceId !== armor.instanceId) }))} />)}</section>
      <RangedInventorySection inventory={inventory} onChange={setInventory} scenario={scenario} onScenarioChange={setScenario} showScenario={false} />
      <section className="inventory-group"><div className="section-heading"><div><p className="section-label">ARTIFACT</p><h2>アーティファクト</h2></div><div className="quick-add"><label><span className="sr-only">追加するアーティファクト</span><select aria-label="追加するアーティファクト" value={artifactToAdd} onChange={(event) => setArtifactToAdd(event.target.value as ArtifactId)}>{ARTIFACT_IDS.map((id) => <option value={id} key={id}>{ARTIFACTS[id].name.ja}</option>)}</select></label><button type="button" onClick={() => addArtifact(artifactToAdd)}>＋ 装備を追加</button></div></div><div className="equipment-list">{inventory.artifacts.map((artifact) => { const bounds = artifactPowerBounds(artifact.artifactId); return <details className="equipment-card" key={artifact.instanceId}><summary><span className="equipment-title"><strong>{ARTIFACTS[artifact.artifactId].name.ja}</strong><small lang="en">{ARTIFACTS[artifact.artifactId].name.en}</small></span><span className="equipment-meta">Power {artifact.powerLevel}</span><span className="edit-label">編集</span></summary><div className="editor-body artifact-editor"><label>Power<input aria-label={`${ARTIFACTS[artifact.artifactId].name.ja}のPower`} type="number" min={bounds.min} max={bounds.max} value={artifact.powerLevel} onChange={(event) => setInventory((current) => ({ ...current, artifacts: current.artifacts.map((item) => item.instanceId === artifact.instanceId ? { ...item, powerLevel: Number(event.target.value) } : item) }))} /></label><button type="button" className="danger-button" onClick={() => setInventory((current) => ({ ...current, artifacts: current.artifacts.filter((item) => item.instanceId !== artifact.instanceId) }))}>削除</button></div></details>})}</div></section>
    </main>
  }

  if (route === '/optimize') return <main id="main-content" tabIndex={-1} className="page-main optimize-page">
    <header className="page-intro"><p className="eyebrow">OPTIMIZATION / WORKSPACE</p><h1>最適化</h1><p>登録済みの{inventory.weapons.length + (inventory.armors?.length ?? 0) + (inventory.rangedWeapons?.length ?? 0) + inventory.artifacts.length}件から、目的に合う組み合わせを探します。</p></header>
    <section className="optimize-controls"><div className="objective-card"><label>目的<select aria-label="最適化の目的" value={scenario.profileId} onChange={(event) => setScenario(SCENARIO_PROFILES[event.target.value as ScenarioProfileId])}>{PROFILE_ORDER.map((id) => <option key={id} value={id}>{SCENARIO_PROFILES[id].name}</option>)}</select></label><div className="optimize-actions"><button className="primary-button" type="button" disabled={optimization.status === 'working' || candidateEstimate > SEARCH_MAX_CANDIDATES} onClick={optimization.start}>最適化する</button><button type="button" disabled={optimization.status !== 'working'} onClick={optimization.cancel}>探索を中止</button></div><p role="status">{optimization.status === 'working' ? '探索中…' : optimization.status === 'complete' ? `探索完了（${Math.round(optimization.durationMs ?? 0)} ms）` : optimization.status === 'cancelled' ? '探索を中止しました。再度開始できます。' : optimization.status === 'error' ? '探索に失敗しました。入力を確認して再実行してください。' : '目的を選び、最適化を開始してください。'}</p><small>候補数の上限推定: {candidateEstimate.toLocaleString()}通り</small>{candidateEstimate > SEARCH_MAX_CANDIDATES ? <p role="alert">安全上限{SEARCH_MAX_CANDIDATES.toLocaleString()}通りを超えています。装備画面で候補を減らすかlockしてください。</p> : candidateEstimate >= SEARCH_WARNING_CANDIDATES && <p>候補が多いため時間がかかる場合があります。</p>}</div>
      <details className="advanced-settings"><summary><span><strong>詳細条件</strong><small>敵・回復・Controlなどのモデル入力</small></span><span aria-hidden="true">＋</span></summary><div className="sliders"><ChargeConsumeControls scenario={scenario} onChange={setScenario} /><ControlSettings scenario={scenario} onChange={setScenario} /><DamageEventTargetingControl value={scenario.damageEventTargeting} maximum={scenario.averageTargetsInReach} onChange={(damageEventTargeting) => setScenario((current) => ({ ...current, damageEventTargeting }))} /><PersistentAreaTargetingControl value={scenario.persistentAreaTargeting} maximum={scenario.averageTargetsInReach} onChange={(persistentAreaTargeting) => setScenario((current) => ({ ...current, persistentAreaTargeting }))} /><EnemyDebuffControl value={scenario.enemyDebuffs} onChange={(enemyDebuffs) => setScenario((current) => ({ ...current, enemyDebuffs }))} /><UndeadShareControl value={scenario.enemyComposition} onChange={(enemyComposition) => setScenario((current) => ({ ...current, enemyComposition }))} /><AmbushShareControl value={scenario.enemyState} onChange={(enemyState) => setScenario((current) => ({ ...current, enemyState }))} /><EnemyCompositionControl value={scenario.enemyComposition} onChange={(enemyComposition) => setScenario((current) => ({ ...current, enemyComposition }))} /><label><span>敵供給上限 / 秒 <output>{scenario.enemySupplyPerSecond.toFixed(1)}</output></span><input type="range" min="0" max="2" step="0.1" value={scenario.enemySupplyPerSecond} onChange={updateNumber('enemySupplyPerSecond')} /></label><label><span>射程内の敵 <output>{scenario.averageTargetsInReach.toFixed(1)}</output></span><input type="range" min="1" max="6" step="0.5" value={scenario.averageTargetsInReach} onChange={updateNumber('averageTargetsInReach')} /></label>{(inventory.rangedWeapons?.length ?? 0) > 0 && <label><span>遠距離に予約する攻撃時間割合</span><input aria-label="遠距離時間割合" type="number" min="0.01" max="0.99" step="0.05" value={scenario.rangedTimeShare ?? ''} placeholder="明示入力が必要" onChange={(event) => setScenario((current) => ({ ...current, rangedTimeShare: event.target.value === '' ? undefined : Number(event.target.value) }))} /></label>}<label><span>開始Soul <output>{scenario.initialSoulUnits ?? 0}</output></span><input aria-label="開始Soul" type="range" min="0" max="300" step="5" value={scenario.initialSoulUnits ?? 0} onChange={updateNumber('initialSoulUnits')} /></label><label><span>Cowardice 満タンHP時間割合</span><input aria-label="Cowardice 満タンHP時間割合" type="number" min="0" max="1" step="0.05" placeholder="使用時に入力" value={scenario.cowardiceFullHealthShare ?? ''} onChange={(event) => setScenario((current) => ({ ...current, cowardiceFullHealthShare: event.target.value === '' ? undefined : Number(event.target.value) }))} /></label><label><span>Artifactのクールダウン短縮 <output>{percentage(scenario.cooldownReduction)}</output></span><input type="range" min="0" max="0.75" step="0.05" value={scenario.cooldownReduction} onChange={updateNumber('cooldownReduction')} /></label><details className="scenario-values"><summary>HP・ダメージの実数値</summary><p>{usesObservedDamage ? '表示ダメージ' : 'Power換算ダメージ'}と同じゲーム内単位で入力してください。</p><label><span>平均敵HP</span><input aria-label="平均敵HP" type="number" min="0.01" step="any" value={scenario.averageEnemyHealth} onChange={updateNumber('averageEnemyHealth')} /></label><label><span>被ダメージ / 秒</span><input aria-label="被ダメージ毎秒" type="number" min="0" step="any" value={scenario.incomingDamagePerSecond} onChange={updateNumber('incomingDamagePerSecond')} /></label><label><span>{(inventory.armors?.length ?? 0) > 0 ? '最大HP（Armor使用時は無効）' : '最大HP'}</span><input aria-label="最大HP" type="number" min="0.01" step="any" disabled={(inventory.armors?.length ?? 0) > 0} value={scenario.maxHealth} onChange={updateNumber('maxHealth')} /></label><label><span>輝き1回の回復量</span><input aria-label="輝き1回の回復量" type="number" min="0" step="any" value={scenario.radianceHealPerProc} onChange={updateNumber('radianceHealPerProc')} /></label></details></div></details>
    </section>
    <section className="results optimize-results" aria-label="最適化結果">{optimization.error && <div className="error-panel" role="alert">{optimization.error}</div>}{!optimization.result && optimization.status !== 'working' && <div className="empty-state"><span aria-hidden="true">◎</span><h2>結果はここに表示されます</h2><p>まず目的を選び、「最適化する」を押してください。</p></div>}{optimization.status === 'working' && <div className="empty-state working"><span className="spinner" aria-hidden="true" /><h2>すべての候補を比較しています</h2><p>この間も探索を中止できます。</p></div>}{optimization.result && <>{optimization.result.unsupportedChoices.length > 0 && <div className="model-warning" role="note"><strong>未対応の候補は評価から除外しました（0点として採用しません）</strong>{optimization.result.unsupportedChoices.map((reason) => <p key={reason}>{reason}</p>)}</div>}<div className="result-meta"><span>{optimization.result.evaluatedBuildCount}通りを全探索</span><span>Evidence coverage {Math.round(optimization.result.best.confidence.coverageScore * 100)} / 100（{CONFIDENCE_LABELS[optimization.result.best.confidence.label]}）</span></div><DpsRegressionPanel summary={DAMAGE_MODEL_ERROR} predictedDps={optimization.result.best.damage.singleTargetDps} /><BuildSummary evaluation={optimization.result.best} /><h3 className="alternatives-title">次点候補</h3><div className="alternatives">{optimization.result.alternatives.slice(0, 4).map((evaluation, index) => <BuildSummary compact evaluation={evaluation} key={`alternative-${evaluation.build.weapon.instanceId}-${index}`} />)}</div><details className="secondary-results"><summary>パレート候補と計算上の注意</summary><h3>Pareto前線</h3><div className="alternatives">{optimization.result.paretoFrontier.slice(0, 3).map((evaluation, index) => <BuildSummary compact title={`PARETO ${index + 1}`} evaluation={evaluation} key={`pareto-${evaluation.build.weapon.instanceId}-${index}`} />)}</div><ul>{optimization.result.best.confidence.caveats.map((caveat) => <li key={caveat}>{caveat}</li>)}</ul></details></> }</section>
  </main>

  return null
}

export default function WorkspaceApp() {
  const route = useAppRoute()
  return <AppShell route={route}><OptimizerPage route={route} /></AppShell>
}

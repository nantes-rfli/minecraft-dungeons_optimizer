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
import { ARTIFACTS } from './data/artifacts'
import { ENCHANTMENTS } from './data/enchantments'
import { DAMAGE_REGRESSION_SAMPLES } from './data/regressionSamples'
import { DEFAULT_SCENARIO, SCENARIO_PROFILES } from './data/scenarios'
import { WEAPONS } from './data/weapons'
import {
  changeGildedEnchantment,
  changeGildedTier,
  DEFAULT_GILDED_ENCHANTMENT,
} from './inventory/gilded'
import { deserializeInventory, loadInventory, saveInventory, serializeInventory } from './inventory/storage'
import { ControlDetails, ControlSettings } from './views/ControlDetails'
import { MethodologyPage } from './views/MethodologyPage'
import { DpsRegressionPanel } from './views/DpsRegressionPanel'
import { EnemyCompositionControl } from './views/EnemyCompositionControl'
import { AmbushShareControl, UndeadShareControl } from './views/EnemyStateControls'
import { DirectDamageDetails } from './views/DirectDamageDetails'
import { EnemyDebuffControl } from './views/EnemyDebuffControl'
import { SoulStateDetails } from './views/SoulStateDetails'
import { TemporalStateDetails } from './views/TemporalStateDetails'
import { StateModelDetails } from './views/StateModelDetails'
import { DamageEventDetails, DamageEventTargetingControl, PersistentAreaTargetingControl, ProcPowerSupport } from './views/DamageEventControls'
import { enchantmentUnsupportedReason } from './core/damageEvents'

const ENCHANTMENT_IDS = Object.keys(ENCHANTMENTS) as EnchantmentId[]
const WEAPON_IDS = Object.keys(WEAPONS) as WeaponId[]
const ARTIFACT_IDS = Object.keys(ARTIFACTS) as ArtifactId[]

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
        {evaluation.build.enchantments.map((selected, index) => <span className="chip" key={`${selected.enchantmentId}-${selected.source}-${index}`}><span>{ENCHANTMENTS[selected.enchantmentId].name.ja} {TIER_LABELS[selected.tier]}</span><small lang="en">{ENCHANTMENTS[selected.enchantmentId].name.en} {TIER_LABELS[selected.tier]} · {ENCHANTMENT_SOURCE_LABELS[selected.source]}</small></span>)}
        {evaluation.build.artifacts.map((item) => <span className="chip artifact" key={item.instanceId}><BilingualName name={ARTIFACTS[item.artifactId].name} /></span>)}
      </div>
      <p className="control-score">Control utility {percentage(evaluation.control.utility)} · 行動阻害・集敵の評価</p>
      {!compact && <>
        <div className="metrics-grid">
          <Metric label={evaluation.damage.damageSource === 'observed-input' ? '単体DPS（表示値ベース）' : '単体DPS（Power換算）'} value={evaluation.damage.singleTargetDps} />
          <Metric label={evaluation.damage.damageSource === 'observed-input' ? 'AoE DPS（表示値ベース）' : 'AoE DPS（Power換算）'} value={evaluation.damage.aoeDps} />
          <Metric label={evaluation.build.enchantments.some((item) => item.enchantmentId === 'refreshment') ? '回復・容量 / 秒' : '回復 / 秒'} value={evaluation.healing.totalPerSecond} />
          <Metric label="実効HP" value={evaluation.defense.effectiveHealth} />
        </div>
        <ul className="reasons">{evaluation.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
        <DirectDamageDetails evaluation={evaluation} />
        <StateModelDetails evaluation={evaluation} />
        <ControlDetails evaluation={evaluation} />
        <TemporalStateDetails evaluation={evaluation} />
        <SoulStateDetails evaluation={evaluation} />
        <DamageEventDetails evaluation={evaluation} />
        <details className="contributions"><summary>効果ごとの数値寄与を見る</summary>
          {evaluation.build.enchantments.some((item) => item.enchantmentId === 'refreshment') && <p>回復の差分にはRefreshmentの追加ポーション回復容量（実回復ではない近似）を含みます。</p>}
          <div className="contribution-table">
            <div className="table-head"><span>効果</span><span>Score</span><span>AoE</span><span>回復</span><span>EHP</span><span>Control Δ</span></div>
            {evaluation.contributions.map((item, index) => <div key={`${item.sourceType}-${item.sourceId}-${index}`}><span>{item.label.ja}<small>{item.label.en}</small></span><b>+{numberFormat.format(item.objectiveDelta)}</b><span>{numberFormat.format(item.aoeDpsDelta)}</span><span>{numberFormat.format(item.healingPerSecondDelta)}</span><span>{numberFormat.format(item.effectiveHealthDelta)}</span><span>{numberFormat.format(item.controlUtilityDelta * 100)}pt</span></div>)}
          </div>
        </details>
      </>}
    </article>
  )
}

function nextInstanceId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function OptimizerPage() {
  const hydrated = useSyncExternalStore(
    subscribeToHydration,
    getClientHydrationSnapshot,
    getServerHydrationSnapshot,
  )
  const [inventory, setInventory] = useState<Inventory>(() => loadInventory(DEFAULT_INVENTORY))
  const [scenario, setScenario] = useState<Scenario>(DEFAULT_SCENARIO)
  const [jsonText, setJsonText] = useState('')
  const [dataMessage, setDataMessage] = useState('ブラウザに自動保存されます。')

  useEffect(() => {
    if (hydrated) saveInventory(inventory)
  }, [hydrated, inventory])

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
    try { const imported = deserializeInventory(jsonText); setInventory(imported); setDataMessage('JSONを読み込みました。') }
    catch (error) { setDataMessage(error instanceof Error ? error.message : '読み込みに失敗しました。') }
  }

  const updateNumber = (key: keyof Pick<Scenario,
    | 'enemySupplyPerSecond'
    | 'averageTargetsInReach'
    | 'cooldownReduction'
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
        <div className="control-section"><p className="section-label">02 / 手持ちアーティファクト</p><div className="add-buttons">{ARTIFACT_IDS.map((id) => <button key={id} type="button" onClick={() => addArtifact(id)}>＋ {ARTIFACTS[id].name.ja}</button>)}</div>
          {inventory.artifacts.map((artifact) => <div className="artifact-row" key={artifact.instanceId}><span>{ARTIFACTS[artifact.artifactId].name.ja}<small>{ARTIFACTS[artifact.artifactId].name.en}</small></span><input aria-label="アーティファクトのPower" type="number" min="1" value={artifact.powerLevel} onChange={(event) => setInventory((current) => ({ ...current, artifacts: current.artifacts.map((item) => item.instanceId === artifact.instanceId ? { ...item, powerLevel: Number(event.target.value) } : item) }))} /><button type="button" onClick={() => setInventory((current) => ({ ...current, artifacts: current.artifacts.filter((item) => item.instanceId !== artifact.instanceId) }))}>削除</button></div>)}
        </div>
        <div className="control-section"><p className="section-label">03 / 目的・シナリオ</p><div className="profile-buttons">{PROFILE_ORDER.map((id) => <button className={scenario.profileId === id ? 'active' : ''} key={id} type="button" onClick={() => setScenario(SCENARIO_PROFILES[id])}>{SCENARIO_PROFILES[id].name}</button>)}</div></div>
        <div className="control-section sliders"><p className="section-label">04 / 微調整</p><ControlSettings scenario={scenario} onChange={setScenario} /><DamageEventTargetingControl value={scenario.damageEventTargeting} maximum={scenario.averageTargetsInReach} onChange={(damageEventTargeting) => setScenario((current) => ({ ...current, damageEventTargeting }))} /><PersistentAreaTargetingControl value={scenario.persistentAreaTargeting} maximum={scenario.averageTargetsInReach} onChange={(persistentAreaTargeting) => setScenario((current) => ({ ...current, persistentAreaTargeting }))} /><EnemyDebuffControl value={scenario.enemyDebuffs} onChange={(enemyDebuffs) => setScenario((current) => ({ ...current, enemyDebuffs }))} /><UndeadShareControl value={scenario.enemyComposition} onChange={(enemyComposition) => setScenario((current) => ({ ...current, enemyComposition }))} /><AmbushShareControl value={scenario.enemyState} onChange={(enemyState) => setScenario((current) => ({ ...current, enemyState }))} /><EnemyCompositionControl value={scenario.enemyComposition} onChange={(enemyComposition) => setScenario((current) => ({ ...current, enemyComposition }))} /><label title="シナリオが供給する敵数の上限です。実際の撃破速度はBuildのDPSから計算します。"><span>敵供給上限 / 秒 <output>{scenario.enemySupplyPerSecond.toFixed(1)}</output></span><input type="range" min="0" max="2" step="0.1" value={scenario.enemySupplyPerSecond} onChange={updateNumber('enemySupplyPerSecond')} /></label><label><span>射程内の敵 <output>{scenario.averageTargetsInReach.toFixed(1)}</output></span><input type="range" min="1" max="6" step="0.5" value={scenario.averageTargetsInReach} onChange={updateNumber('averageTargetsInReach')} /></label><label><span>Artifactのクールダウン短縮 <output>{percentage(scenario.cooldownReduction)}</output></span><input type="range" min="0" max="0.75" step="0.05" value={scenario.cooldownReduction} onChange={updateNumber('cooldownReduction')} /></label><details className="scenario-values" open><summary>HP・ダメージの実数値</summary><p>{usesObservedDamage ? '表示ダメージ' : 'Power換算ダメージ'}と同じゲーム内単位で入力してください。</p><label><span>平均敵HP</span><input aria-label="平均敵HP" type="number" min="0.01" step="any" value={scenario.averageEnemyHealth} onChange={updateNumber('averageEnemyHealth')} /></label><label><span>被ダメージ / 秒</span><input aria-label="被ダメージ毎秒" type="number" min="0" step="any" value={scenario.incomingDamagePerSecond} onChange={updateNumber('incomingDamagePerSecond')} /></label><label><span>最大HP</span><input aria-label="最大HP" type="number" min="0.01" step="any" value={scenario.maxHealth} onChange={updateNumber('maxHealth')} /></label><label><span>輝き1回の回復量</span><input aria-label="輝き1回の回復量" type="number" min="0" step="any" value={scenario.radianceHealPerProc} onChange={updateNumber('radianceHealPerProc')} /></label></details></div>
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

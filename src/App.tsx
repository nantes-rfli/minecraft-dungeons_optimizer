"use client"

import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { optimize } from './core'
import type {
  ArtifactId,
  EnchantmentId,
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
import { DEFAULT_SCENARIO, SCENARIO_PROFILES } from './data/scenarios'
import { WEAPONS } from './data/weapons'
import { deserializeInventory, loadInventory, saveInventory, serializeInventory } from './inventory/storage'
import { MethodologyPage } from './views/MethodologyPage'

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
        {evaluation.build.enchantments.map((id, index) => <span className="chip" key={`${id}-${index}`}><BilingualName name={ENCHANTMENTS[id].name} /></span>)}
        {evaluation.build.artifacts.map((item) => <span className="chip artifact" key={item.instanceId}><BilingualName name={ARTIFACTS[item.artifactId].name} /></span>)}
      </div>
      {!compact && <>
        <div className="metrics-grid">
          <Metric label="単体DPS（正規化）" value={evaluation.damage.singleTargetDps} />
          <Metric label="AoE DPS（正規化）" value={evaluation.damage.aoeDps} />
          <Metric label="回復 / 秒" value={evaluation.healing.totalPerSecond} />
          <Metric label="実効HP" value={evaluation.defense.effectiveHealth} />
        </div>
        <ul className="reasons">{evaluation.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
        <details className="contributions"><summary>効果ごとの数値寄与を見る</summary>
          <div className="contribution-table">
            <div className="table-head"><span>効果</span><span>Score</span><span>AoE</span><span>回復</span><span>EHP</span></div>
            {evaluation.contributions.map((item, index) => <div key={`${item.sourceType}-${item.sourceId}-${index}`}><span>{item.label.ja}<small>{item.label.en}</small></span><b>+{numberFormat.format(item.objectiveDelta)}</b><span>{numberFormat.format(item.aoeDpsDelta)}</span><span>{numberFormat.format(item.healingPerSecondDelta)}</span><span>{numberFormat.format(item.effectiveHealthDelta)}</span></div>)}
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
  const [inventory, setInventory] = useState<Inventory>(() => loadInventory(DEFAULT_INVENTORY))
  const [scenario, setScenario] = useState<Scenario>(DEFAULT_SCENARIO)
  const [jsonText, setJsonText] = useState('')
  const [dataMessage, setDataMessage] = useState('ブラウザに自動保存されます。')

  useEffect(() => {
    saveInventory(inventory)
  }, [inventory])

  const optimization = useMemo(() => {
    try { return { result: optimize(inventory, scenario), error: null } }
    catch (error) { return { result: null, error: error instanceof Error ? error.message : '計算中に不明なエラーが発生しました。' } }
  }, [inventory, scenario])

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
  const addArtifact = (artifactId: ArtifactId) => {
    const item: OwnedArtifact = { instanceId: nextInstanceId(artifactId), artifactId, powerLevel: 251 }
    setInventory((current) => ({ ...current, artifacts: [...current.artifacts, item] }))
  }
  const importData = () => {
    try { const imported = deserializeInventory(jsonText); setInventory(imported); setDataMessage('JSONを読み込みました。') }
    catch (error) { setDataMessage(error instanceof Error ? error.message : '読み込みに失敗しました。') }
  }

  const updateNumber = (key: keyof Pick<Scenario, 'killsPerSecond' | 'averageTargetsInReach' | 'cooldownReduction'>) => (event: ChangeEvent<HTMLInputElement>) => setScenario((current) => ({ ...current, [key]: Number(event.target.value) }))

  return <main>
    <header className="hero"><div><p className="eyebrow">最適化コア試作版 · v0.1</p><h1>Minecraft Dungeons<br />最適装備ツール</h1><p className="product-name" lang="en">Gear Optimizer</p><p className="lede">実際の手持ち候補を全探索し、火力・回復・防御を目的別に比較します。</p></div><div className="confidence-note"><span>計算モデル</span><strong>検証中</strong><p>推測値は根拠と信頼度を分離。詳しい式と実装状況は「仕組み」ページで公開しています。</p></div></header>
    <section className="workspace">
      <aside className="controls">
        <div className="control-section"><p className="section-label">01 / 手持ち武器</p><div className="add-buttons">{WEAPON_IDS.map((id) => <button key={id} type="button" onClick={() => addWeapon(id)}>＋ {WEAPONS[id].name.ja}</button>)}</div>
          {inventory.weapons.map((weapon, weaponIndex) => <details className="inventory-item" key={weapon.instanceId} open={weaponIndex === 0}><summary><span>{WEAPONS[weapon.weaponId].name.ja}<small>{WEAPONS[weapon.weaponId].name.en}</small></span><button type="button" aria-label={`${WEAPONS[weapon.weaponId].name.ja}を削除`} onClick={(event) => { event.preventDefault(); setInventory((current) => ({ ...current, weapons: current.weapons.filter((item) => item.instanceId !== weapon.instanceId) })) }}>削除</button></summary>
            <label className="power-field">Power <input type="number" min="1" value={weapon.powerLevel} onChange={(event) => updateWeapon(weapon.instanceId, (item) => ({ ...item, powerLevel: Number(event.target.value) }))} /></label>
            {weapon.enchantmentSlots.map((slot, slotIndex) => <fieldset key={slotIndex}><legend>スロット {slotIndex + 1}</legend>{ENCHANTMENT_IDS.map((id) => <label className="mini-check" key={id}><input type="checkbox" checked={slot.candidates.includes(id)} onChange={() => toggleCandidate(weapon.instanceId, slotIndex, id)} />{ENCHANTMENTS[id].name.ja}</label>)}</fieldset>)}
          </details>)}
        </div>
        <div className="control-section"><p className="section-label">02 / 手持ちアーティファクト</p><div className="add-buttons">{ARTIFACT_IDS.map((id) => <button key={id} type="button" onClick={() => addArtifact(id)}>＋ {ARTIFACTS[id].name.ja}</button>)}</div>
          {inventory.artifacts.map((artifact) => <div className="artifact-row" key={artifact.instanceId}><span>{ARTIFACTS[artifact.artifactId].name.ja}<small>{ARTIFACTS[artifact.artifactId].name.en}</small></span><input aria-label="アーティファクトのPower" type="number" min="1" value={artifact.powerLevel} onChange={(event) => setInventory((current) => ({ ...current, artifacts: current.artifacts.map((item) => item.instanceId === artifact.instanceId ? { ...item, powerLevel: Number(event.target.value) } : item) }))} /><button type="button" onClick={() => setInventory((current) => ({ ...current, artifacts: current.artifacts.filter((item) => item.instanceId !== artifact.instanceId) }))}>削除</button></div>)}
        </div>
        <div className="control-section"><p className="section-label">03 / 目的・シナリオ</p><div className="profile-buttons">{PROFILE_ORDER.map((id) => <button className={scenario.profileId === id ? 'active' : ''} key={id} type="button" onClick={() => setScenario(SCENARIO_PROFILES[id])}>{SCENARIO_PROFILES[id].name}</button>)}</div></div>
        <div className="control-section sliders"><p className="section-label">04 / 微調整</p><label><span>撃破 / 秒 <output>{scenario.killsPerSecond.toFixed(1)}</output></span><input type="range" min="0" max="2" step="0.1" value={scenario.killsPerSecond} onChange={updateNumber('killsPerSecond')} /></label><label><span>射程内の敵 <output>{scenario.averageTargetsInReach.toFixed(1)}</output></span><input type="range" min="1" max="6" step="0.5" value={scenario.averageTargetsInReach} onChange={updateNumber('averageTargetsInReach')} /></label><label><span>クールダウン短縮 <output>{percentage(scenario.cooldownReduction)}</output></span><input type="range" min="0" max="0.75" step="0.05" value={scenario.cooldownReduction} onChange={updateNumber('cooldownReduction')} /></label></div>
        <details className="control-section data-tools"><summary>保存データ / JSON</summary><textarea value={jsonText} placeholder="ここにJSONを書き出すか、読み込むJSONを貼り付けます" onChange={(event) => setJsonText(event.target.value)} /><div><button type="button" onClick={() => { setJsonText(serializeInventory(inventory)); setDataMessage('JSONを書き出しました。') }}>書き出す</button><button type="button" onClick={importData}>読み込む</button></div><p>{dataMessage}</p></details>
      </aside>
      <section className="results" aria-live="polite">{optimization.error && <div className="error-panel">{optimization.error}</div>}{optimization.result && <><div className="result-meta"><span>{optimization.result.evaluatedBuildCount}通りを全探索</span><span>信頼度 {percentage(optimization.result.best.confidence.score)}（{CONFIDENCE_LABELS[optimization.result.best.confidence.label]}）</span></div><BuildSummary evaluation={optimization.result.best} />
        <h3 className="alternatives-title">Pareto前線 — 火力・回復・防御のどれかで劣らない候補</h3><div className="alternatives">{optimization.result.paretoFrontier.slice(0, 3).map((evaluation, index) => <BuildSummary compact title={`PARETO ${index + 1}`} evaluation={evaluation} key={`pareto-${evaluation.build.weapon.instanceId}-${evaluation.build.enchantments.join('-')}`} />)}</div>
        <h3 className="alternatives-title">次点候補</h3><div className="alternatives">{optimization.result.alternatives.map((evaluation) => <BuildSummary compact evaluation={evaluation} key={`${evaluation.build.weapon.instanceId}-${evaluation.build.enchantments.join('-')}`} />)}</div><details className="caveats"><summary>計算上の注意</summary><ul>{optimization.result.best.confidence.caveats.map((caveat) => <li key={caveat}>{caveat}</li>)}</ul></details></>}</section>
    </section>
  </main>
}

export default function App() {
  const [page, setPage] = useState(() => globalThis.location?.hash === '#methodology' ? 'methodology' : 'optimizer')
  useEffect(() => { const onHashChange = () => setPage(globalThis.location.hash === '#methodology' ? 'methodology' : 'optimizer'); globalThis.addEventListener('hashchange', onHashChange); return () => globalThis.removeEventListener('hashchange', onHashChange) }, [])
  return <><nav className="site-nav"><a className="brand" href="#optimizer">MCD / OPT</a><div><a className={page === 'optimizer' ? 'active' : ''} href="#optimizer">最適化</a><a className={page === 'methodology' ? 'active' : ''} href="#methodology">仕組み・実装状況</a></div></nav>{page === 'methodology' ? <MethodologyPage /> : <OptimizerPage />}</>
}

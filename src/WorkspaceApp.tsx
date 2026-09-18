"use client"

import { lazy, Suspense, useEffect, useRef, useState, useSyncExternalStore, type ChangeEvent } from 'react'
import { useOptimizer } from './optimizer/useOptimizer'
import { estimateSearchCandidates, SEARCH_WARNING_CANDIDATES, SEARCH_MAX_CANDIDATES } from './core/searchBudget'
import type {
  ArtifactId,
  CatalogInventoryItem,
  EnchantmentTier,
  Inventory,
  OwnedWeapon,
  Scenario,
  ScenarioProfileId,
  EvidencePolicy,
  OwnedEnchantmentSlot,
} from './core'
import type { ArmorId, OwnedArmor } from './core/armor'
import { ARTIFACTS } from './data/artifacts'
import { DEFAULT_SCENARIO, SCENARIO_PROFILES } from './data/scenarios'
import { WEAPONS } from './data/weapons'
import { ARMORS } from './data/armors'
import { deserializeInventory, loadInventoryState, saveInventory, serializeInventory } from './inventory/storage'
import { ControlSettings } from './views/ControlDetails'
import { EnemyCompositionControl } from './views/EnemyCompositionControl'
import { AmbushShareControl, UndeadShareControl } from './views/EnemyStateControls'
import { EnemyDebuffControl } from './views/EnemyDebuffControl'
import { ChargeConsumeControls } from './views/ChargeConsumeDetails'
import { DamageEventTargetingControl, PersistentAreaTargetingControl, ProcPowerSupport } from './views/DamageEventControls'
import { RangedInventorySection } from './views/RangedEquipment'
import { AppShell } from './app/AppShell'
import { useAppRoute, type AppRoute } from './app/routes'
import { ModelExplorerPage } from './screens/ModelExplorerPage'
import { ChangesPage } from './screens/ChangesPage'
import { OptimizeResults } from './screens/OptimizeResults'
import { ResearchQuestPage } from './screens/ResearchQuestPage'
import { EQUIPMENT_CATALOG, getEquipmentCatalogEntry } from './data/equipmentCatalog'
import { addEquipmentToInventory, equipmentKey, inventoryStatistics } from './inventory/collection'
import { InventoryGameGrid, VisualEquipmentPicker } from './components/InventoryGameGrid'
import { EquipmentArtwork, EquipmentCategoryIcon } from './components/EquipmentArtwork'
import { inventoryGridItems } from './inventory/gridPresentation'
import { EnchantmentSlotEditor } from './components/EnchantmentSlotEditor'
import { EnchantmentDiamond } from './components/EnchantmentSlotEditor'
import { GildedEnchantmentEditor } from './components/GildedEnchantmentEditor'
import { resolveEnchantment } from './data/enchantmentCatalog'
import { groupCatalogItemsByCategory } from './inventory/catalogPresentation'
import { EquipmentInstanceEditor } from './components/EquipmentInstanceEditor'
import { selectedEnchantmentSummary } from './inventory/enchantmentSummary'

const DataBrowserPage = lazy(() => import('./screens/DataBrowserPage').then((module) => ({ default: module.DataBrowserPage })))

const CATEGORY_LABELS = { melee: '近接', armor: '防具', ranged: '遠距離', artifact: 'アーティファクト' } as const

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
const percentage = (value: number): string => `${Math.round(value * 100)}%`
const subscribeToHydration = () => () => undefined
const getClientHydrationSnapshot = () => true
const getServerHydrationSnapshot = () => false
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

export function OwnedArmorEditor({ armor, onChange, onRemove }: { armor: OwnedArmor; onChange: (armor: OwnedArmor) => void; onRemove: () => void }) {
  const displayName = ARMORS[armor.armorId as ArmorId]?.name.ja ?? armor.armorId
  const catalog = getEquipmentCatalogEntry('armor', armor.armorId)!
  return <details className="inventory-item equipment-card"><summary><EquipmentIcon category="armor" label={displayName} /><span className="equipment-title"><strong>{displayName}</strong><small lang="en">{ARMORS[armor.armorId as ArmorId]?.name.en}</small></span><span className="equipment-meta">Power {armor.powerLevel}<small>{selectedEnchantmentSummary(armor.enchantmentSlots)}</small></span>{armor.gilded && <span className="gilded-badge">金色</span>}<span className="edit-label">編集</span></summary>
    <EquipmentInstanceEditor category="armor" catalog={catalog} powerLevel={armor.powerLevel} rarity={armor.rarity} notes={armor.notes} enchantmentSlots={armor.enchantmentSlots} gilded={armor.gilded} onPowerChange={(powerLevel) => onChange({ ...armor, powerLevel })} onRarityChange={(rarity) => onChange({ ...armor, rarity })} onNotesChange={(notes) => onChange({ ...armor, notes })} onEnchantmentSlotsChange={(enchantmentSlots) => onChange({ ...armor, enchantmentSlots })} onGildedChange={(gilded) => onChange({ ...armor, gilded })} onDelete={onRemove} extraFields={<label>追加HP<input aria-label={`${armor.instanceId}の追加HP`} type="number" min="0" value={armor.observedHealthBonus ?? ''} onChange={(event) => onChange({ ...armor, observedHealthBonus: event.target.value === '' ? undefined : Number(event.target.value) })} /></label>} />
  </details>
}

export function OwnedMeleeEditor({ weapon, onChange, onRemove }: { weapon: OwnedWeapon; onChange: (weapon: OwnedWeapon) => void; onRemove: () => void }) {
  const definition = WEAPONS[weapon.weaponId]
  const catalog = getEquipmentCatalogEntry('melee', weapon.weaponId)!
  return <details className="equipment-card"><summary><EquipmentIcon category="melee" label={definition.name.ja} /><span className="equipment-title"><strong>{definition.name.ja}</strong><small lang="en">{definition.name.en}</small></span><span className="equipment-meta">Power {weapon.powerLevel}<small>{selectedEnchantmentSummary(weapon.enchantmentSlots)}</small></span>{weapon.gilded && <span className="gilded-badge">金色</span>}<span className="edit-label">編集</span></summary>
    <EquipmentInstanceEditor category="melee" catalog={catalog} powerLevel={weapon.powerLevel} powerMax={263} rarity={weapon.rarity} notes={weapon.notes} enchantmentSlots={weapon.enchantmentSlots} gilded={weapon.gilded} onPowerChange={(powerLevel) => onChange({ ...weapon, powerLevel })} onRarityChange={(rarity) => onChange({ ...weapon, rarity })} onNotesChange={(notes) => onChange({ ...weapon, notes })} onEnchantmentSlotsChange={(enchantmentSlots) => onChange({ ...weapon, enchantmentSlots })} onGildedChange={(gilded) => onChange({ ...weapon, gilded })} onDelete={onRemove} extraFields={<><label>表示ダメージ<input aria-label={`${definition.name.ja}の表示ダメージ`} type="number" min="0.01" step="any" placeholder="任意" value={weapon.observedDamagePerHit ?? ''} onChange={(event) => onChange({ ...weapon, observedDamagePerHit: event.target.value === '' ? undefined : Number(event.target.value) })} /></label><ProcPowerSupport weapon={weapon} /></>} />
  </details>
}

export function OwnedArtifactEditor({ artifact, onChange, onRemove }: { artifact: Inventory['artifacts'][number]; onChange: (artifact: Inventory['artifacts'][number]) => void; onRemove: () => void }) {
  const definition = ARTIFACTS[artifact.artifactId]
  const catalog = getEquipmentCatalogEntry('artifact', artifact.artifactId)!
  const bounds = artifactPowerBounds(artifact.artifactId)
  return <details className="equipment-card"><summary><EquipmentIcon category="artifact" label={definition.name.ja} /><span className="equipment-title"><strong>{definition.name.ja}</strong><small lang="en">{definition.name.en}</small></span><span className="equipment-meta">Power {artifact.powerLevel}</span><span className="edit-label">編集</span></summary>
    <EquipmentInstanceEditor category="artifact" catalog={catalog} powerLevel={artifact.powerLevel} powerMin={bounds.min} powerMax={bounds.max} notes={artifact.notes} onPowerChange={(powerLevel) => onChange({ ...artifact, powerLevel })} onNotesChange={(notes) => onChange({ ...artifact, notes })} onDelete={onRemove} />
  </details>
}

function EquipmentIcon({ category, id, label }: { category: keyof typeof CATEGORY_LABELS; id?: string; label?: string }) {
  const catalog = id ? getEquipmentCatalogEntry(category, id) : EQUIPMENT_CATALOG.find((entry) => entry.category === category && (entry.name.ja === label || entry.name.en === label))
  return catalog ? <EquipmentArtwork catalog={catalog} compact /> : <span className={`equipment-icon ${category}`}><EquipmentCategoryIcon category={category} /></span>
}

function AddEquipmentDrawer({ inventory, open, onClose, onChange }: { inventory: Inventory; open: boolean; onClose: () => void; onChange: (inventory: Inventory) => void }) {
  const [category, setCategory] = useState<keyof typeof CATEGORY_LABELS>('melee')
  const [classFilter, setClassFilter] = useState<'normal' | 'unique'>('normal')
  const [query, setQuery] = useState('')
  const initial = EQUIPMENT_CATALOG.find((item) => item.category === 'melee' && item.rarityFamily === 'normal') ?? EQUIPMENT_CATALOG[0]!
  const [selectedKey, setSelectedKey] = useState(equipmentKey(initial.category, initial.id))
  const [powerLevel, setPowerLevel] = useState(251)
  const [rarity, setRarity] = useState<'common' | 'rare' | 'unique'>('common')
  const [enchantmentSlots, setEnchantmentSlots] = useState<readonly OwnedEnchantmentSlot<string>[]>([])
  const [gilded, setGilded] = useState<{ enchantmentId: string; tier: EnchantmentTier }>()
  const [message, setMessage] = useState('')
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const selected = EQUIPMENT_CATALOG.find((item) => equipmentKey(item.category, item.id) === selectedKey) ?? EQUIPMENT_CATALOG[0]!
  useEffect(() => {
    if (!open) return
    closeButtonRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])
  const add = () => {
    const instanceId = nextInstanceId(selected.id)
    onChange(addEquipmentToInventory(inventory, selected, instanceId, powerLevel, selected.rarityFamily === 'unique' ? 'unique' : selected.category === 'artifact' ? undefined : rarity, selected.category === 'artifact' ? undefined : { slots: enchantmentSlots, ...(gilded ? { gilded } : {}) }))
    setMessage(`${selected.name.ja}を装備に追加しました。`)
  }
  const chooseCategory = (next: keyof typeof CATEGORY_LABELS) => {
    const nextClass = next === 'artifact' ? 'normal' : classFilter
    const first = EQUIPMENT_CATALOG.find((item) => item.category === next && (next === 'artifact' || item.rarityFamily === nextClass))
    setCategory(next); setSelectedKey(first ? equipmentKey(first.category, first.id) : ''); setQuery(''); setMessage(''); setEnchantmentSlots([]); setGilded(undefined)
  }
  const chooseClass = (next: 'normal' | 'unique') => {
    const first = EQUIPMENT_CATALOG.find((item) => item.category === category && item.rarityFamily === next)
    setClassFilter(next); setSelectedKey(first ? equipmentKey(first.category, first.id) : ''); setMessage(''); setEnchantmentSlots([]); setGilded(undefined)
  }
  if (!open) return null
  return <><button className="drawer-scrim" type="button" aria-label="装備登録を閉じる" onClick={onClose} /><aside className="equipment-drawer" role="dialog" aria-modal="true" aria-labelledby="equipment-drawer-title">
    <header><div><p className="section-label">ADD EQUIPMENT</p><h2 id="equipment-drawer-title">装備を登録</h2></div><button ref={closeButtonRef} type="button" className="drawer-close" onClick={onClose} aria-label="装備登録を閉じる">×</button></header>
    <div className="drawer-form"><fieldset className="picker-step"><legend><b>1</b> カテゴリ</legend><div className="picker-segments">{(['melee', 'ranged', 'armor', 'artifact'] as const).map((value) => <button type="button" key={value} aria-pressed={category === value} onClick={() => chooseCategory(value)}><EquipmentCategoryIcon category={value} />{CATEGORY_LABELS[value]}</button>)}</div></fieldset>
      {category !== 'artifact' && <fieldset className="picker-step"><legend><b>2</b> 装備クラス</legend><div className="picker-segments two">{(['normal', 'unique'] as const).map((value) => <button type="button" key={value} aria-pressed={classFilter === value} onClick={() => chooseClass(value)}>{value === 'normal' ? '通常装備' : 'Unique'}</button>)}</div></fieldset>}
      <fieldset className="picker-step picker-browser"><legend><b>3</b> 装備を選択</legend><label className="picker-search"><span className="sr-only">装備を検索</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="日本語名・英語名で検索" /></label><VisualEquipmentPicker category={category} classFilter={classFilter} query={query} selectedKey={selectedKey} onSelect={(key) => { setSelectedKey(key); setMessage(''); setEnchantmentSlots([]); setGilded(undefined) }} /></fieldset>
      <div className="drawer-selection"><EquipmentArtwork catalog={selected} compact priority /><div><strong>{selected.name.ja}</strong><small lang="en">{selected.name.en}</small><span>{CATEGORY_LABELS[selected.category]}</span></div></div>
      <fieldset className="picker-step instance-properties"><legend><b>4</b> 個体情報</legend>{category !== 'artifact' && selected.rarityFamily !== 'unique' && <label>レアリティ<select value={rarity} onChange={(event) => setRarity(event.target.value as typeof rarity)}><option value="common">Common</option><option value="rare">Rare</option></select></label>}<label>Power<input type="number" min="1" value={powerLevel} onChange={(event) => setPowerLevel(Number(event.target.value))} /></label></fieldset>
      {category !== 'artifact' && <fieldset className="picker-step drawer-enchantments"><legend><b>5</b> Enchantment</legend><EnchantmentSlotEditor slots={enchantmentSlots} category={category} soulGear={Boolean(selected.soulGear)} onChange={setEnchantmentSlots} label="登録する装備のエンチャント" /></fieldset>}
      {category !== 'artifact' && <fieldset className="picker-step drawer-gilded"><legend><b>6</b> Gilded</legend><GildedEnchantmentEditor value={gilded} category={category} soulGear={Boolean(selected.soulGear)} onChange={setGilded} /></fieldset>}
      <button className="primary-button" type="button" disabled={!Number.isInteger(powerLevel) || powerLevel < 1} onClick={add}>装備に追加</button><p role="status">{message}</p>
    </div>
  </aside></>
}

export function InventoryStatisticsView({ inventory }: { inventory: Inventory }) {
  const stats = inventoryStatistics(inventory)
  const maxPowerBand = Math.max(1, ...stats.powerDistribution.map((item) => item.count))
  const maxRarity = Math.max(1, ...stats.rarityDistribution.map((item) => item.count))
  return <div className="inventory-statistics">
    <section className="stat-overview" aria-label="装備サマリー"><article><span>所持個体</span><strong>{stats.totalItems}</strong></article><article><span>所持種類</span><strong>{stats.collectedTypes}<small> / {stats.totalTypes}</small></strong></article><article><span>金色率</span><strong>{Math.round(stats.gildedRate * 100)}<small>% · {stats.gildedItems}個</small></strong></article><article><span>重複種類</span><strong>{stats.duplicateTypes.length}</strong></article></section>
    <div className="statistics-grid"><section className="statistics-panel"><div className="section-heading"><div><p className="section-label">POWER</p><h2>Power分布</h2></div></div><div className="bar-chart">{stats.powerDistribution.map((item) => <div key={item.label}><span>{item.label}</span><i><b style={{ width: `${item.count / maxPowerBand * 100}%` }} /></i><strong>{item.count}</strong></div>)}</div></section>
      <section className="statistics-panel"><div className="section-heading"><div><p className="section-label">RARITY</p><h2>レアリティ分布</h2></div></div><div className="bar-chart">{stats.rarityDistribution.map((item) => <div key={item.rarity}><span>{item.label}</span><i><b style={{ width: `${item.count / maxRarity * 100}%` }} /></i><strong>{item.count}</strong></div>)}</div></section>
      <section className="statistics-panel"><div className="section-heading"><div><p className="section-label">DUPLICATES</p><h2>同一装備の重複</h2></div></div>{stats.duplicateTypes.length ? <ol className="rank-list">{stats.duplicateTypes.slice(0, 8).map((item) => <li key={equipmentKey(item.category, item.id)}><EquipmentIcon category={item.category} id={item.id} /><span>{item.name}<small>{CATEGORY_LABELS[item.category]}</small></span><strong>× {item.count}</strong></li>)}</ol> : <p className="quiet-empty">重複している装備はありません。</p>}</section>
      <section className="statistics-panel"><div className="section-heading"><div><p className="section-label">ENCHANT</p><h2>よく付いているEnchant</h2></div></div>{stats.enchantments.length ? <ol className="rank-list enchant-ranks">{stats.enchantments.slice(0, 8).map((item, index) => { const entry = resolveEnchantment(item.id); return <li key={item.id}><b>{String(index + 1).padStart(2, '0')}</b><EnchantmentDiamond enchantmentId={item.id} variant="compact" /><span>{entry?.name.ja ?? entry?.name.en ?? item.id}<small lang="en">{entry?.name.en ?? item.id}</small></span><strong>{item.count}</strong></li> })}</ol> : <p className="quiet-empty">Enchantが登録されていません。</p>}</section>
      <section className="statistics-panel missing-panel"><div className="section-heading"><div><p className="section-label">MISSING</p><h2>未所持装備</h2></div><span>{stats.missing.length}種類</span></div><div className="missing-equipment-list">{stats.missing.slice(0, 24).map((item) => <span key={equipmentKey(item.category, item.id)}><EquipmentIcon category={item.category} id={item.id} />{item.name.ja}</span>)}</div>{stats.missing.length > 24 && <p>ほか {stats.missing.length - 24}種類</p>}</section>
    </div>
  </div>
}

export function CatalogInventoryItems({ inventory, onChange, items = inventory.catalogItems ?? [] }: { inventory: Inventory; onChange: (inventory: Inventory) => void; items?: readonly CatalogInventoryItem[] }) {
  const update = (instanceId: string, updater: (item: CatalogInventoryItem) => CatalogInventoryItem) => onChange({ ...inventory, catalogItems: (inventory.catalogItems ?? []).map((item) => item.instanceId === instanceId ? updater(item) : item) })
  if (!items.length) return null
  return <>{items.map((item) => {
      const catalog = getEquipmentCatalogEntry(item.category, item.catalogId)
      const displayName = catalog?.name.ja ?? catalog?.name.en ?? item.catalogId
      return <details className="equipment-card" key={item.instanceId}><summary><EquipmentIcon category={item.category} id={item.catalogId} /><span className="equipment-title"><strong>{displayName}</strong><small lang="en">{catalog?.name.en}</small></span><span className="equipment-meta">Power {item.powerLevel}{item.category !== 'artifact' && <small>{selectedEnchantmentSummary(item.enchantmentSlots)}</small>}</span>{item.gilded && <span className="gilded-badge">金色</span>}<span className="edit-label">編集</span></summary>
        {catalog && <EquipmentInstanceEditor category={item.category} catalog={catalog} powerLevel={item.powerLevel} rarity={item.rarity} notes={item.notes} enchantmentSlots={item.enchantmentSlots} gilded={item.gilded} onPowerChange={(powerLevel) => update(item.instanceId, (current) => ({ ...current, powerLevel }))} onRarityChange={item.category === 'artifact' ? undefined : (rarity) => update(item.instanceId, (current) => ({ ...current, rarity }))} onNotesChange={(notes) => update(item.instanceId, (current) => ({ ...current, notes }))} onEnchantmentSlotsChange={item.category === 'artifact' ? undefined : (enchantmentSlots) => update(item.instanceId, (current) => ({ ...current, enchantmentSlots }))} onGildedChange={item.category === 'artifact' ? undefined : (gilded) => update(item.instanceId, (current) => ({ ...current, gilded }))} onDelete={() => onChange({ ...inventory, catalogItems: (inventory.catalogItems ?? []).filter((current) => current.instanceId !== item.instanceId) })} />}
      </details>
    })}</>
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
  const [inventoryTab, setInventoryTab] = useState<'list' | 'statistics'>('list')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [inventoryQuery, setInventoryQuery] = useState('')
  const [inventoryCategory, setInventoryCategory] = useState<'all' | keyof typeof CATEGORY_LABELS>('all')
  const [inventoryGilded, setInventoryGilded] = useState<'all' | 'gilded' | 'standard'>('all')
  const [inventorySort, setInventorySort] = useState<'name' | 'power-desc' | 'power-asc' | 'recent'>('recent')
  const [inventoryView, setInventoryView] = useState<'compact' | 'list' | 'grid'>('grid')
  const [fullEditorPending, setFullEditorPending] = useState<string | null>(null)

  useEffect(() => {
    if (!hydrated || loadError) return
    const task = setTimeout(() => {
      try { saveInventory(inventory); setSaveError(null) }
      catch (error) { setSaveError(`自動保存を保留しました。入力を修正してください: ${error instanceof Error ? error.message : '不明なエラー'}`) }
    }, 100)
    return () => clearTimeout(task)
  }, [hydrated, inventory, loadError])

  useEffect(() => {
    if (fullEditorPending === null || inventoryView !== 'list') return
    const frame = requestAnimationFrame(() => {
      const normalized = inventoryQuery.toLocaleLowerCase()
      const occurrence = inventoryGridItems(inventory).filter((item) => `${item.catalog.name.ja} ${item.catalog.name.en} ${item.powerLevel}`.toLocaleLowerCase().includes(normalized)).findIndex((item) => item.instanceId === fullEditorPending)
      const editor = document.querySelectorAll<HTMLDetailsElement>('.inventory-collection details.equipment-card')[occurrence]
      if (!editor) return
      editor.open = true
      editor.scrollIntoView({ block: 'center' })
      editor.querySelector<HTMLElement>('summary')?.focus()
      setFullEditorPending(null)
    })
    return () => cancelAnimationFrame(frame)
  }, [fullEditorPending, inventoryView, inventoryQuery, inventory])

  const optimization = useOptimizer(inventory, scenario)
  const candidateEstimate = estimateSearchCandidates(inventory)
  const usesObservedDamage = inventory.weapons.some(
    (weapon) => weapon.observedDamagePerHit !== undefined,
  )
  const updateWeapon = (instanceId: string, updater: (weapon: OwnedWeapon) => OwnedWeapon) => setInventory((current) => ({ ...current, weapons: current.weapons.map((item) => item.instanceId === instanceId ? updater(item) : item) }))
  const updateArmor = (instanceId: string, updater: (armor: OwnedArmor) => OwnedArmor) => setInventory((current) => ({ ...current, armors: (current.armors ?? []).map((item) => item.instanceId === instanceId ? updater(item) : item) }))
  const openFullEditor = (name: string, instanceId: string) => {
    setInventoryTab('list')
    setInventoryQuery(name)
    setInventoryCategory('all')
    setInventoryGilded('all')
    setInventorySort('recent')
    setInventoryView('list')
    setFullEditorPending(instanceId)
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

  if (route.startsWith('/data')) return <Suspense fallback={<main id="main-content" tabIndex={-1} role="status" className="page-main">ゲームデータを読み込み中…</main>}><DataBrowserPage route={route} /></Suspense>
  if (route.startsWith('/model')) return <ModelExplorerPage route={route} />
  if (route === '/research') return <ResearchQuestPage inventory={inventory} />
  if (route === '/changes') return <ChangesPage />

  if (route === '/storage') return <main id="main-content" tabIndex={-1} className="page-main narrow-page">
    <header className="page-intro"><p className="eyebrow">UTILITY / LOCAL DATA</p><h1>保存・復元</h1><p>装備データはこのブラウザへ自動保存されます。JSON schema v4で別ブラウザへの移行や復旧ができます。</p></header>
    {(loadError || saveError) && <div className="error-panel" role="alert"><strong>自動保存を確認してください</strong><p>{loadError ?? saveError}</p></div>}
    <section className="storage-card"><div><p className="section-label">LOCAL STORAGE</p><h2>{loadError ? '復旧が必要です' : '自動保存は有効です'}</h2><p>{loadError ? '保存済みJSONを確認し、修正したデータを読み込んでください。' : '装備を変更すると、この端末のブラウザ内へ保存します。'}</p></div><span className={loadError ? 'storage-status error' : 'storage-status'}>{loadError ? '要確認' : '保存中'}</span></section>
    <section className="panel data-tools storage-tools"><h2>JSONを書き出す / 読み込む</h2><p>書き出したJSONにはコレクションの全装備、エンチャント候補、金色効果、詳しい記録が含まれます。最適化条件は含みません。</p><textarea aria-label="Inventory JSON" aria-describedby="json-message" aria-invalid={dataError} value={jsonText} placeholder="「書き出す」で現在のデータを表示するか、読み込むJSONを貼り付けます" onChange={(event) => setJsonText(event.target.value)} /><div><button className="primary-button" type="button" onClick={() => { setDataError(false); setJsonText(serializeInventory(inventory)); setDataMessage('JSON schema v4を書き出しました。') }}>現在の装備を書き出す</button><button type="button" onClick={importData}>JSONを読み込む</button></div><p id="json-message" role={dataError ? 'alert' : 'status'}>{dataMessage}</p><details><summary>データ形式と復旧について</summary><p>schema v1〜v4を読み込み、常にv4を書き出します。読み込みに失敗したデータは自動的に上書きしないため、この画面で修正できます。</p></details></section>
  </main>

  if (route === '/inventory') {
    const rangedCount = inventory.rangedWeapons?.length ?? 0
    const ownedCount = inventory.weapons.length + (inventory.armors?.length ?? 0) + rangedCount + inventory.artifacts.length + (inventory.catalogItems?.length ?? 0)
    const query = inventoryQuery.trim().toLocaleLowerCase()
    const visible = (category: keyof typeof CATEGORY_LABELS, name: string, english: string, power: number, gilded: boolean) => (inventoryCategory === 'all' || inventoryCategory === category) && (inventoryGilded === 'all' || (inventoryGilded === 'gilded') === gilded) && (!query || `${name} ${english} ${power}`.toLocaleLowerCase().includes(query))
    const sortItems = <T extends { powerLevel: number; instanceId: string },>(items: readonly T[], name: (item: T) => string) => [...items].sort((left, right) => inventorySort === 'power-desc' ? right.powerLevel - left.powerLevel : inventorySort === 'power-asc' ? left.powerLevel - right.powerLevel : inventorySort === 'name' ? name(left).localeCompare(name(right), 'ja') : 0)
    const visibleWeapons = sortItems(inventory.weapons.filter((item) => visible('melee', WEAPONS[item.weaponId].name.ja, WEAPONS[item.weaponId].name.en, item.powerLevel, Boolean(item.gilded))), (item) => WEAPONS[item.weaponId].name.ja)
    const visibleArmors = sortItems((inventory.armors ?? []).filter((item) => { const name = ARMORS[item.armorId as ArmorId]?.name; return visible('armor', name?.ja ?? item.armorId, name?.en ?? '', item.powerLevel, Boolean(item.gilded)) }), (item) => ARMORS[item.armorId as ArmorId]?.name.ja ?? item.armorId)
    const visibleRanged = sortItems((inventory.rangedWeapons ?? []).filter((item) => { const catalog = getEquipmentCatalogEntry('ranged', item.weaponId)!; return visible('ranged', catalog.name.ja ?? catalog.name.en, catalog.name.en, item.powerLevel, Boolean(item.gilded)) }), (item) => getEquipmentCatalogEntry('ranged', item.weaponId)?.name.ja ?? item.weaponId)
    const visibleArtifacts = sortItems(inventory.artifacts.filter((item) => visible('artifact', ARTIFACTS[item.artifactId].name.ja, ARTIFACTS[item.artifactId].name.en, item.powerLevel, false)), (item) => ARTIFACTS[item.artifactId].name.ja)
    const visibleCatalog = sortItems((inventory.catalogItems ?? []).filter((item) => { const catalog = getEquipmentCatalogEntry(item.category, item.catalogId)!; const gilded = Boolean(item.gilded ?? item.research?.enchantments?.some((enchantment) => enchantment.source === 'gilded')); return visible(item.category, catalog.name.ja ?? catalog.name.en, catalog.name.en, item.powerLevel, gilded) }), (item) => getEquipmentCatalogEntry(item.category, item.catalogId)?.name.ja ?? item.catalogId)
    const catalogByCategory = groupCatalogItemsByCategory(visibleCatalog)
    const visibleCount = visibleWeapons.length + visibleArmors.length + visibleRanged.length + visibleArtifacts.length + visibleCatalog.length
    return <main id="main-content" tabIndex={-1} className="page-main inventory-page">
      <header className="page-intro page-intro-row"><div><p className="eyebrow">TOOLS / INVENTORY</p><h1>装備</h1><p>所持している装備を一覧・整理し、コレクション全体の傾向を確認できます。</p></div><div className="inventory-heading-actions"><div className="inventory-total"><strong>{ownedCount}</strong><span>登録した個体</span></div><button className="primary-button add-equipment-button" type="button" onClick={() => setDrawerOpen(true)}>＋ 装備を登録</button></div></header>
      <div className="inventory-tabs" role="tablist" aria-label="装備の表示"><button role="tab" aria-selected={inventoryTab === 'list'} onClick={() => setInventoryTab('list')}>一覧 <span>{ownedCount}</span></button><button role="tab" aria-selected={inventoryTab === 'statistics'} onClick={() => setInventoryTab('statistics')}>統計</button></div>
      {(loadError || saveError) && <p className="inline-alert" role="alert">{loadError ?? saveError}</p>}
      {inventoryTab === 'statistics' ? <InventoryStatisticsView inventory={inventory} /> : <>
        <section className="inventory-toolbar" aria-label="装備一覧の表示設定"><label className="inventory-search"><span className="sr-only">装備を検索</span><input type="search" value={inventoryQuery} onChange={(event) => setInventoryQuery(event.target.value)} placeholder="装備名・Powerで検索" /></label><label><span>種類</span><select value={inventoryCategory} onChange={(event) => setInventoryCategory(event.target.value as typeof inventoryCategory)}><option value="all">すべて</option>{Object.entries(CATEGORY_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label><label><span>金色</span><select value={inventoryGilded} onChange={(event) => setInventoryGilded(event.target.value as typeof inventoryGilded)}><option value="all">すべて</option><option value="gilded">金色のみ</option><option value="standard">通常のみ</option></select></label><label><span>並び順</span><select value={inventorySort} onChange={(event) => setInventorySort(event.target.value as typeof inventorySort)}><option value="recent">登録順</option><option value="name">名前順</option><option value="power-desc">Power 高い順</option><option value="power-asc">Power 低い順</option></select></label><div className="view-switcher" aria-label="表示形式">{(['compact', 'list', 'grid'] as const).map((view) => <button type="button" key={view} aria-pressed={inventoryView === view} onClick={() => setInventoryView(view)}>{view === 'compact' ? 'コンパクト' : view === 'list' ? 'リスト' : 'グリッド'}</button>)}</div></section>
        <p className="inventory-result-count" role="status">{visibleCount}件を表示</p>
        {inventoryView === 'grid' ? <InventoryGameGrid inventory={inventory} onChange={setInventory} onOpenFullEditor={openFullEditor} query={inventoryQuery} category={inventoryCategory} gilded={inventoryGilded} sort={inventorySort} /> : <div className={`inventory-collection view-${inventoryView}`}>
        {(visibleWeapons.length + catalogByCategory.melee.length) > 0 && <section className="inventory-group"><div className="section-heading"><div><p className="section-label">MELEE</p><h2>近接武器</h2></div><span>{visibleWeapons.length + catalogByCategory.melee.length}</span></div><div className="equipment-list">{visibleWeapons.map((weapon) => <OwnedMeleeEditor key={weapon.instanceId} weapon={weapon} onChange={(next) => updateWeapon(weapon.instanceId, () => next)} onRemove={() => setInventory((current) => ({ ...current, weapons: current.weapons.filter((item) => item.instanceId !== weapon.instanceId) }))} />)}<CatalogInventoryItems inventory={inventory} onChange={setInventory} items={catalogByCategory.melee} /></div></section>}
        {(visibleArmors.length + catalogByCategory.armor.length) > 0 && <section className="inventory-group"><div className="section-heading"><div><p className="section-label">ARMOR</p><h2>防具</h2></div><span>{visibleArmors.length + catalogByCategory.armor.length}</span></div><div className="equipment-list">{visibleArmors.map((armor) => <OwnedArmorEditor key={armor.instanceId} armor={armor} onChange={(next) => updateArmor(armor.instanceId, () => next)} onRemove={() => setInventory((current) => ({ ...current, armors: (current.armors ?? []).filter((item) => item.instanceId !== armor.instanceId) }))} />)}<CatalogInventoryItems inventory={inventory} onChange={setInventory} items={catalogByCategory.armor} /></div></section>}
        {(visibleRanged.length + catalogByCategory.ranged.length) > 0 && <RangedInventorySection inventory={inventory} onChange={setInventory} scenario={scenario} onScenarioChange={setScenario} showScenario={false} visibleWeapons={visibleRanged} additionalCount={catalogByCategory.ranged.length} additionalItems={<CatalogInventoryItems inventory={inventory} onChange={setInventory} items={catalogByCategory.ranged} />} />}
        {(visibleArtifacts.length + catalogByCategory.artifact.length) > 0 && <section className="inventory-group"><div className="section-heading"><div><p className="section-label">ARTIFACT</p><h2>アーティファクト</h2></div><span>{visibleArtifacts.length + catalogByCategory.artifact.length}</span></div><div className="equipment-list">{visibleArtifacts.map((artifact) => <OwnedArtifactEditor key={artifact.instanceId} artifact={artifact} onChange={(next) => setInventory((current) => ({ ...current, artifacts: current.artifacts.map((item) => item.instanceId === next.instanceId ? next : item) }))} onRemove={() => setInventory((current) => ({ ...current, artifacts: current.artifacts.filter((item) => item.instanceId !== artifact.instanceId) }))} />)}<CatalogInventoryItems inventory={inventory} onChange={setInventory} items={catalogByCategory.artifact} /></div></section>}
        {visibleCount === 0 && <div className="empty-state"><span>◇</span><h2>該当する装備がありません</h2><p>検索語やフィルタを変更してください。</p></div>}
        </div>}</>}
      <AddEquipmentDrawer inventory={inventory} open={drawerOpen} onClose={() => setDrawerOpen(false)} onChange={setInventory} />
    </main>
  }

  if (route === '/optimize') return <main id="main-content" tabIndex={-1} className="page-main optimize-page">
    <header className="page-intro"><p className="eyebrow">OPTIMIZATION / WORKSPACE</p><h1>最適化</h1><p>Runtime対応の{inventory.weapons.length + (inventory.armors?.length ?? 0) + (inventory.rangedWeapons?.length ?? 0) + inventory.artifacts.length}件から探索します。未対応の所持品{inventory.catalogItems?.length ?? 0}件は調査用に保持し、評価しません。</p></header>
    <fieldset className="evidence-policy"><legend>評価に使うEvidence</legend>{([{ id: 'high-confidence-only', label: '確度の高い情報のみ', note: 'Estimatedを含むArtifactを候補から除外' }, { id: 'include-estimated', label: 'Estimatedを含める', note: '推定箇所を結果に明示' }] satisfies readonly { id: EvidencePolicy; label: string; note: string }[]).map((option) => <label key={option.id}><input type="radio" name="evidence-policy" value={option.id} checked={(scenario.evidencePolicy ?? 'include-estimated') === option.id} onChange={() => setScenario((current) => ({ ...current, evidencePolicy: option.id }))} /><span>{option.label}<small>{option.note}</small></span></label>)}</fieldset>
    <section className="optimize-controls"><div className="objective-card"><label>目的<select aria-label="最適化の目的" value={scenario.profileId} onChange={(event) => setScenario(SCENARIO_PROFILES[event.target.value as ScenarioProfileId])}>{PROFILE_ORDER.map((id) => <option key={id} value={id}>{SCENARIO_PROFILES[id].name}</option>)}</select></label><div className="optimize-actions"><button className="primary-button" type="button" disabled={optimization.status === 'working' || candidateEstimate > SEARCH_MAX_CANDIDATES} onClick={optimization.start}>最適化する</button><button type="button" disabled={optimization.status !== 'working'} onClick={optimization.cancel}>探索を中止</button></div><p role="status">{optimization.status === 'working' ? '探索中…' : optimization.status === 'complete' ? `探索完了（${Math.round(optimization.durationMs ?? 0)} ms）` : optimization.status === 'cancelled' ? '探索を中止しました。再度開始できます。' : optimization.status === 'error' ? '探索に失敗しました。入力を確認して再実行してください。' : '目的を選び、最適化を開始してください。'}</p><small>候補数の上限推定: {candidateEstimate.toLocaleString()}通り</small>{candidateEstimate > SEARCH_MAX_CANDIDATES ? <p role="alert">安全上限{SEARCH_MAX_CANDIDATES.toLocaleString()}通りを超えています。装備画面で候補を減らすかlockしてください。</p> : candidateEstimate >= SEARCH_WARNING_CANDIDATES && <p>候補が多いため時間がかかる場合があります。</p>}</div>
      <details className="advanced-settings"><summary><span><strong>詳細条件</strong><small>敵・回復・Controlなどのモデル入力</small></span><span aria-hidden="true">＋</span></summary><div className="sliders"><ChargeConsumeControls scenario={scenario} onChange={setScenario} /><ControlSettings scenario={scenario} onChange={setScenario} /><DamageEventTargetingControl value={scenario.damageEventTargeting} maximum={scenario.averageTargetsInReach} onChange={(damageEventTargeting) => setScenario((current) => ({ ...current, damageEventTargeting }))} /><PersistentAreaTargetingControl value={scenario.persistentAreaTargeting} maximum={scenario.averageTargetsInReach} onChange={(persistentAreaTargeting) => setScenario((current) => ({ ...current, persistentAreaTargeting }))} /><EnemyDebuffControl value={scenario.enemyDebuffs} onChange={(enemyDebuffs) => setScenario((current) => ({ ...current, enemyDebuffs }))} /><UndeadShareControl value={scenario.enemyComposition} onChange={(enemyComposition) => setScenario((current) => ({ ...current, enemyComposition }))} /><AmbushShareControl value={scenario.enemyState} onChange={(enemyState) => setScenario((current) => ({ ...current, enemyState }))} /><EnemyCompositionControl value={scenario.enemyComposition} onChange={(enemyComposition) => setScenario((current) => ({ ...current, enemyComposition }))} /><label><span>敵供給上限 / 秒 <output>{scenario.enemySupplyPerSecond.toFixed(1)}</output></span><input type="range" min="0" max="2" step="0.1" value={scenario.enemySupplyPerSecond} onChange={updateNumber('enemySupplyPerSecond')} /></label><label><span>射程内の敵 <output>{scenario.averageTargetsInReach.toFixed(1)}</output></span><input type="range" min="1" max="6" step="0.5" value={scenario.averageTargetsInReach} onChange={updateNumber('averageTargetsInReach')} /></label>{(inventory.rangedWeapons?.length ?? 0) > 0 && <label><span>遠距離に予約する攻撃時間割合</span><input aria-label="遠距離時間割合" type="number" min="0.01" max="0.99" step="0.05" value={scenario.rangedTimeShare ?? ''} placeholder="明示入力が必要" onChange={(event) => setScenario((current) => ({ ...current, rangedTimeShare: event.target.value === '' ? undefined : Number(event.target.value) }))} /></label>}<label><span>開始Soul <output>{scenario.initialSoulUnits ?? 0}</output></span><input aria-label="開始Soul" type="range" min="0" max="300" step="5" value={scenario.initialSoulUnits ?? 0} onChange={updateNumber('initialSoulUnits')} /></label><label><span>Cowardice 満タンHP時間割合</span><input aria-label="Cowardice 満タンHP時間割合" type="number" min="0" max="1" step="0.05" placeholder="使用時に入力" value={scenario.cowardiceFullHealthShare ?? ''} onChange={(event) => setScenario((current) => ({ ...current, cowardiceFullHealthShare: event.target.value === '' ? undefined : Number(event.target.value) }))} /></label><label><span>Artifactのクールダウン短縮 <output>{percentage(scenario.cooldownReduction)}</output></span><input type="range" min="0" max="0.75" step="0.05" value={scenario.cooldownReduction} onChange={updateNumber('cooldownReduction')} /></label><details className="scenario-values"><summary>HP・ダメージの実数値</summary><p>{usesObservedDamage ? '表示ダメージ' : 'Power換算ダメージ'}と同じゲーム内単位で入力してください。</p><label><span>平均敵HP</span><input aria-label="平均敵HP" type="number" min="0.01" step="any" value={scenario.averageEnemyHealth} onChange={updateNumber('averageEnemyHealth')} /></label><label><span>被ダメージ / 秒</span><input aria-label="被ダメージ毎秒" type="number" min="0" step="any" value={scenario.incomingDamagePerSecond} onChange={updateNumber('incomingDamagePerSecond')} /></label><label><span>{(inventory.armors?.length ?? 0) > 0 ? '最大HP（Armor使用時は無効）' : '最大HP'}</span><input aria-label="最大HP" type="number" min="0.01" step="any" disabled={(inventory.armors?.length ?? 0) > 0} value={scenario.maxHealth} onChange={updateNumber('maxHealth')} /></label><label><span>輝き1回の回復量</span><input aria-label="輝き1回の回復量" type="number" min="0" step="any" value={scenario.radianceHealPerProc} onChange={updateNumber('radianceHealPerProc')} /></label></details></div></details>
    </section>
    <OptimizeResults error={optimization.error} result={optimization.result} status={optimization.status} evidencePolicy={scenario.evidencePolicy} />
  </main>

  return null
}

export default function WorkspaceApp() {
  const route = useAppRoute()
  return <AppShell route={route}><OptimizerPage route={route} /></AppShell>
}

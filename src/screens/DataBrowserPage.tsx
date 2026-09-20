"use client"

import { useEffect, useMemo, useState } from 'react'
import meleeAudit from '../../research/melee-enchantment-audit.json'
import meleeWeaponAudit from '../../research/melee-attack-profile-audit.json'
import armorEnchantAudit from '../../research/armor-enchantment-audit.json'
import armorSupport from '../../research/runtime/armor-runtime-support.json'
import sourceHarvest from '../../research/source-harvest-browser.json'
import { ARTIFACT_AUDIT } from '../research/artifactAudit'
import { RANGED_ENCHANTMENT_AUDIT, RANGED_WEAPON_AUDIT } from '../research/rangedAudit'
import { hrefFor, readRouteItem, type AppRoute } from '../app/routes'
import { WEAPONS } from '../data/weapons'
import { ARMOR_ENCHANTMENTS } from '../data/armors'
import { ARTIFACTS } from '../data/artifacts'
import { DataSummary } from '../views/DataSummary'
import { japaneseEquipmentName } from '../data/equipmentNames.ja'
import { equipmentDisplaySections, type EquipmentPresentationCategory } from '../data/equipmentPresentation'
import { getEquipmentCatalogEntry } from '../data/equipmentCatalog'
import { EquipmentArtwork } from '../components/EquipmentArtwork'
import { EnchantmentIdentity } from '../components/EnchantmentArtwork'
import { EnchantmentDiamond } from '../components/EnchantmentSlotEditor'
import { ENCHANTMENT_CATALOG } from '../data/enchantmentCatalog'
import { FightersBindingsDataBrowser } from './dataBrowser/FightersBindingsDataBrowser'
import { fightersBindingsBrowserProjection } from './dataBrowser/fightersBindingsBrowserModel'

type Support = 'full' | 'limited' | 'research-only'
type HarvestCategory = 'melee-weapon' | 'melee-enchantment' | 'armor' | 'armor-enchantment' | 'ranged-weapon' | 'ranged-enchantment' | 'artifact'
type HarvestFact = { property: string; value: unknown; confidence: string; status: string; notes?: string; sourceIds: string[]; targetGameVersion: string; applicableGameVersion?: string; versionStatus: string }
type HarvestAttempt = { sourceId: string; result: string; note?: string }
type HarvestRecord = {
  category: HarvestCategory
  id: string
  known: HarvestFact[]
  unknown: { property: string; kind: string; notes?: string; sourceAttempts: HarvestAttempt[] }[]
  conflicts: { property: string; probableReason: string; resolutionStatus: string }[]
  sourceIds: string[]
  version: { target: string; currentVersionVerified: boolean; staleRisk: boolean; notes: string }
}
type HarvestSource = { id: string; title: string; url?: string; sourceType: string; gameVersion: string; versionStatus: string }
type CatalogItem = { id: string; name: string; secondary?: string; family: string; support: Support; known: string; blockers: string[]; harvest: HarvestRecord }

const harvestRecords = sourceHarvest.records as HarvestRecord[]
const harvestSources = new Map((sourceHarvest.sources as HarvestSource[]).map((source) => [source.id, source]))
const harvestIndex = new Map(harvestRecords.map((record) => [`${record.category}:${record.id}`, record]))
function getHarvest(category: HarvestCategory, id: string): HarvestRecord {
  const record = harvestIndex.get(`${category}:${id}`)
  if (!record) throw new Error(`Source Harvest record missing: ${category}:${id}`)
  return record
}
function displayValue(value: unknown): string {
  const rendered = typeof value === 'string' ? value : JSON.stringify(value)
  return rendered.length > 180 ? `${rendered.slice(0, 177)}…` : rendered
}

const propertyLabel = (property: string): string => ({
  speed: '攻撃速度', area: '攻撃範囲', damage: 'ダメージ', rarity: 'レアリティ', cooldown: 'クールダウン',
  ammo: '弾薬数', power: 'Power', duration: '持続時間', health: '追加HP', family: '系統',
}[property] ?? property.replaceAll('-', ' '))

function PropertySources({ sourceIds }: { sourceIds: string[] }) {
  const sources = sourceIds.map((id) => harvestSources.get(id)).filter((source): source is HarvestSource => Boolean(source))
  return <span className="property-sources">{sources.map((source, index) => <span key={source.id}>{index > 0 && ' · '}{source.url ? <a href={source.url} target="_blank" rel="noreferrer">{source.title}</a> : source.title}</span>)}</span>
}

const supportLabel: Record<Support, string> = { full: '通常評価', limited: '一部条件で評価', 'research-only': 'コレクション登録のみ' }
const categoryRoutes: { route: AppRoute; label: string; count: number }[] = [
  { route: '/data/melee', label: '近接', count: 82 },
  { route: '/data/armor', label: '防具', count: 73 },
  { route: '/data/ranged', label: '遠距離', count: 71 },
  { route: '/data/artifacts', label: 'アーティファクト', count: 45 },
  { route: '/data/enchantments', label: 'エンチャント', count: ENCHANTMENT_CATALOG.length },
]

const enchantmentCategoryLabel = { melee: '近接', ranged: '遠距離', armor: '防具' } as const
function EnchantmentCatalogView({ query, onQueryChange, targetItemId }: { query: string; onQueryChange: (value: string) => void; targetItemId: string | null }) {
  const filtered = ENCHANTMENT_CATALOG.filter((entry) => `${entry.name.ja ?? ''} ${entry.name.en} ${entry.id}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()))
  const enchantmentHarvest = harvestRecords.filter((record) => record.category.endsWith('-enchantment'))
  const enchantmentSourceIds = [...new Set(enchantmentHarvest.flatMap((record) => record.sourceIds))]
  return <section className="catalog-panel enchantment-catalog-panel"><div className="catalog-toolbar"><label>エンチャントを検索<input type="search" value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="日本語名または英語名" /></label><p role="status">{filtered.length}件</p></div>
    <div className="catalog-list">{filtered.map((entry) => {
      const category = entry.applicableCategories[0] ?? 'melee'
      const rarity = entry.rarity === 'powerful' ? 'Powerful' : entry.rarity === 'common' ? 'Common' : '確認中'
      return <details className="catalog-row enchantment-catalog-row" data-equipment-id={entry.id} open={targetItemId === entry.id || undefined} key={entry.id}><summary><span className="catalog-identity"><EnchantmentDiamond enchantmentId={entry.id} category={category} variant="icon-only" /><span><strong>{entry.name.ja ?? entry.name.en}</strong>{entry.name.ja && <small lang="en">{entry.name.en}</small>}</span></span><span>{rarity}</span><span>{entry.applicableCategories.map((value) => enchantmentCategoryLabel[value]).join(' · ')}</span></summary><div className="catalog-detail enchantment-detail">
        <dl className="enchantment-metadata" aria-label="基本情報"><div><dt>Rarity</dt><dd>{rarity}</dd></div><div><dt>適用カテゴリ</dt><dd>{entry.applicableCategories.map((value) => enchantmentCategoryLabel[value]).join('・')}</dd></div><div><dt>Soul限定</dt><dd>{entry.soulGearOnly ? '対象' : '—'}</dd></div></dl>
        <section className="enchantment-tier-section" aria-labelledby={`tier-${entry.id}`}><h3 id={`tier-${entry.id}`}>Tier比較</h3><div className="enchantment-tier-scroll"><table><thead><tr><th scope="col">Category</th><th scope="col">Tier I</th><th scope="col">Tier II</th><th scope="col">Tier III</th></tr></thead><tbody>{entry.applicableCategories.map((value) => <tr key={value}><th scope="row">{enchantmentCategoryLabel[value]}</th>{[0, 1, 2].map((index) => <td key={index}>{entry.tierValuesByCategory[value]?.[index] ?? '—'}</td>)}</tr>)}</tbody></table></div></section>
        <section className="enchantment-availability" aria-labelledby={`availability-${entry.id}`}><h3 id={`availability-${entry.id}`}>入手形態</h3><div>{([['normalSlot', '通常slot'], ['gilded', 'Gilded'], ['builtIn', 'Built-in']] as const).map(([key, label]) => <span key={key} data-available={entry.availability[key]}>{entry.availability[key] ? '✓' : '—'} {label}</span>)}</div></section>
        <details className="technical-detail enchantment-technical-detail"><summary>技術情報・出典</summary><dl><dt>内部ID</dt><dd><code>{entry.id}</code></dd></dl></details>
      </div></details>
    })}</div>
    {filtered.length === 0 && <div className="empty-state"><h2>該当するデータがありません</h2><p>日本語名または英語名を変更してください。</p></div>}
    <details className="technical-detail canonical-enchantment-sources"><summary>技術情報・出典</summary><dl><dt>確認できているデータ</dt><dd>{enchantmentHarvest.reduce((total, record) => total + record.known.filter((fact) => fact.status === 'accepted').length, 0)}項目</dd><dt>確認中の項目</dt><dd>{enchantmentHarvest.reduce((total, record) => total + record.unknown.length, 0)}項目</dd><dt>確認先</dt><dd>{enchantmentSourceIds.map((id) => harvestSources.get(id)?.title ?? id).join(' · ')}</dd><dt>ゲームバージョン</dt><dd>1.17.0.0 · 古い可能性と claimed-current をレコード単位で保持</dd><dt>情報の競合</dt><dd>{[...new Set(enchantmentHarvest.flatMap((record) => record.conflicts.map((conflict) => `${conflict.probableReason} (${conflict.resolutionStatus})`)))].join(' · ') || 'ありません'}</dd></dl></details>
  </section>
}

const attackStatus = (status: string, hitsPerSecond: number | null): string => status === 'exact' && hitsPerSecond !== null
  ? `攻撃の速さは毎秒約${hitsPerSecond.toFixed(2)}ヒットです。`
  : '攻撃パターンの一部を確認中です。'

const firingModeName: Readonly<Record<string, string>> = {
  chargeable: 'チャージ式', 'rapid-fire': '連射式', 'single-shot': '単発式', burst: 'バースト式', 'wind-up': '加速連射式',
}

function itemsFor(route: AppRoute): CatalogItem[] {
  if (route === '/data/melee') return meleeWeaponAudit.weapons.map((item) => {
    const isFightersBindings = item.weaponId === fightersBindingsBrowserProjection.identity.domainId
    const configuredAttacks = fightersBindingsBrowserProjection.configuredAttacks
    return { id: item.weaponId, name: japaneseEquipmentName('melee', item.weaponId, item.name.ja), secondary: isFightersBindings ? fightersBindingsBrowserProjection.identity.displayName : item.name.en, family: `${japaneseEquipmentName('melee', item.family)}系`, support: (item.weaponId in WEAPONS ? 'full' : 'research-only') as Support, known: isFightersBindings ? configuredAttacks.state === 'known' ? `Domainでconfigured attack ${configuredAttacks.value.length}件を確認。最終ダメージと実効攻撃間隔は未解決です。` : 'Domainのconfigured attackは未解決です。' : attackStatus(item.status, item.attackProfile.hitsPerSecond), blockers: item.notes ? [item.notes] : item.weaponId in WEAPONS ? [] : ['Optimizer catalog未登録'], harvest: getHarvest('melee-weapon', item.weaponId) }
  })
  if (route === '/data/armor') return armorSupport.entries.map((item) => ({ id: item.id, name: japaneseEquipmentName('armor', item.id), secondary: item.name, family: '防具', support: item.supportLevel as Support, known: '固有効果と装備データを収録しています。', blockers: item.reasons, harvest: getHarvest('armor', item.id) }))
  if (route === '/data/ranged') return RANGED_WEAPON_AUDIT.entries.map((item) => ({ id: item.id, name: japaneseEquipmentName('ranged', item.id, item.name.ja), secondary: item.name.en, family: `${japaneseEquipmentName('ranged', item.family)}系`, support: item.supportLevel as Support, known: `${firingModeName[item.firingMode] ?? '固有方式'}の遠距離武器です。`, blockers: item.intrinsic.completeMechanicVerification ? [] : ['特殊効果・発射周期の独立検証が未完了'], harvest: getHarvest('ranged-weapon', item.id) }))
  if (route === '/data/artifacts') return [
    ...ARTIFACT_AUDIT.entries.map((item) => ({ id: item.id, name: japaneseEquipmentName('artifact', item.id), secondary: item.name, family: 'アーティファクト', support: (item.id in ARTIFACTS ? item.runtimeReadiness === 'ready-with-limits' ? 'limited' : 'full' : 'research-only') as Support, known: `再使用できるまで${item.cooldown.seconds}秒です。`, blockers: item.blockers, harvest: getHarvest('artifact', item.id) })),
    ...ARTIFACT_AUDIT.populationDifferences.map((item) => ({ id: item.id, name: japaneseEquipmentName('artifact', item.id), secondary: item.name, family: 'アーティファクト', support: 'research-only' as const, known: `再使用できるまで${item.cooldownSeconds}秒です。`, blockers: item.blockers, harvest: getHarvest('artifact', item.id) })),
  ]
  return [
    ...meleeAudit.entries.map((item) => ({ id: `melee-${item.id}`, name: item.name.ja ?? item.name.en, secondary: item.name.ja ? item.name.en : undefined, family: `近接 · ${item.modelCategory}`, support: (item.runtimeStatus === 'implemented' ? (item.runtimePowerRange ? 'limited' : 'full') : 'research-only') as Support, known: item.trigger, blockers: item.runtimeStatus === 'implemented' ? [] : [item.notes ?? item.runtimeStatus], harvest: getHarvest('melee-enchantment', item.id) })),
    ...armorEnchantAudit.entries.map((item) => ({ id: `armor-${item.id}`, name: item.name, family: `防具 · ${item.mechanicFamily}`, support: (item.id in ARMOR_ENCHANTMENTS ? 'limited' : 'research-only') as Support, known: item.tierLabel, blockers: item.blockers, harvest: getHarvest('armor-enchantment', item.id) })),
    ...RANGED_ENCHANTMENT_AUDIT.entries.map((item) => ({ id: `ranged-${item.id}`, name: item.name.ja ?? item.name.en, secondary: item.name.ja ? item.name.en : undefined, family: `遠距離 · ${item.triggerFamily}`, support: item.supportLevel as Support, known: item.directIndirectStatus, blockers: item.blockers, harvest: getHarvest('ranged-enchantment', item.id) })),
  ]
}

export function DataBrowserPage({ route }: { route: AppRoute }) {
  const [query, setQuery] = useState('')
  const items = useMemo(() => route === '/data/enchantments' ? [] : itemsFor(route), [route])
  const filtered = items.filter((item) => `${item.name} ${item.secondary ?? ''} ${item.id}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()))
  const targetItemId = readRouteItem()
  useEffect(() => {
    if (!targetItemId) return
    const target = document.querySelector<HTMLDetailsElement>(`[data-equipment-id="${CSS.escape(targetItemId)}"]`)
    if (!target) return
    target.open = true
    requestAnimationFrame(() => target.scrollIntoView({ block: 'center' }))
  }, [route, targetItemId])
  return <main id="main-content" tabIndex={-1} className="page-main">
    <header className="page-intro"><p className="eyebrow">GAME DATA / REFERENCE</p><h1>装備データ</h1><p>ゲームに登場する装備と効果を、日本語名から探せます。英語名も小さく併記しています。</p></header>
    <nav className="subnav" aria-label="データカテゴリ">{categoryRoutes.map((item) => <a key={item.route} href={hrefFor(item.route)} aria-current={route === item.route ? 'page' : undefined}>{item.label}<span>{item.count}</span></a>)}</nav>
    {route === '/data' ? <>
      <DataSummary />
      <details className="panel compact-panel"><summary>データの収録状況について</summary><p>すべての装備はコレクションに登録できます。計算への利用条件や調査状況は、各装備の「技術情報」で確認できます。</p></details>
    </> : route === '/data/enchantments' ? <EnchantmentCatalogView query={query} onQueryChange={setQuery} targetItemId={targetItemId} /> : <section className="catalog-panel">
      <div className="catalog-toolbar"><label>装備を検索<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="日本語名または英語名" /></label><p role="status">{filtered.length}件</p></div>
      <div className="catalog-list">{filtered.map((item) => {
        const sources = item.harvest.sourceIds.map((id) => harvestSources.get(id)).filter((source): source is HarvestSource => Boolean(source))
        const acceptedFacts = item.harvest.known.filter((fact) => fact.status === 'accepted')
        const unresolvedFacts = item.harvest.known.filter((fact) => fact.status !== 'accepted').map((fact) => ({ property: fact.property, kind: fact.status, notes: `${fact.notes ?? 'Current value is not accepted.'} Recorded value: ${displayValue(fact.value)}`, sourceAttempts: fact.sourceIds.map((sourceId) => ({ sourceId, result: fact.status })) }))
        const unknowns: { property: string; kind: string; notes: string; sourceAttempts?: HarvestAttempt[] }[] = [...item.blockers.map((notes) => ({ property: 'runtime', kind: 'blocker', notes })), ...item.harvest.unknown.map((entry) => ({ ...entry, notes: entry.notes ?? entry.kind })), ...unresolvedFacts]
        const presentationCategory: EquipmentPresentationCategory = route === '/data/melee' ? 'melee' : route === '/data/ranged' ? 'ranged' : route === '/data/armor' ? 'armor' : route === '/data/artifacts' ? 'artifact' : 'enchantment'
        const catalog = presentationCategory === 'enchantment' ? undefined : getEquipmentCatalogEntry(presentationCategory, item.id)
        const sections = equipmentDisplaySections({ category: presentationCategory, nameJa: item.name, nameEn: item.secondary, family: item.family, catalog, facts: item.harvest.known }).map((section) => ({
          ...section,
          fields: presentationCategory === 'enchantment' ? section.fields : section.fields.filter((field) => field.id !== 'nameJa' && field.id !== 'nameEn'),
        }))
        return <details className="catalog-row" data-equipment-id={item.id} open={targetItemId === item.id || undefined} key={item.id}><summary><span className="catalog-identity">{catalog && <EquipmentArtwork catalog={catalog} compact />}<span><strong>{item.name}</strong>{item.secondary && <small lang="en">{item.secondary}</small>}</span></span><span>{item.family}</span><span className="catalog-known">{item.known}</span></summary><div className="catalog-detail">{item.id === fightersBindingsBrowserProjection.identity.domainId ? <FightersBindingsDataBrowser /> : <><p className="catalog-user-summary">{item.known}</p><div className="equipment-data-sections">{sections.map((section) => <section className="property-table" aria-label={`${item.name}の${section.title}`} key={section.title}><h3>{section.title}</h3><dl>{section.fields.map((field) => <div key={field.id}><dt>{field.label}</dt><dd>{field.id === 'builtIn' && catalog?.builtInEnchantments.length ? <span className="built-in-enchantments">{catalog.builtInEnchantments.map((builtIn) => <EnchantmentIdentity key={`${builtIn.enchantmentId}-${builtIn.tier ?? 'unknown'}`} value={builtIn.enchantmentId} tier={builtIn.tier} category={catalog.category === 'artifact' ? undefined : catalog.category} />)}</span> : field.value}</dd></div>)}</dl></section>)}</div><details className="technical-detail"><summary>技術情報・出典</summary><dl><dt>管理ID</dt><dd><code>{item.id.replace(/^(melee|armor|ranged)-/, '')}</code></dd><dt>計算での扱い</dt><dd>{supportLabel[item.support]}</dd><dt>確認済み項目</dt><dd>{acceptedFacts.length}</dd><dt>対象バージョン</dt><dd>{item.harvest.version.target}</dd><dt>確認できているデータ</dt><dd>{acceptedFacts.length ? <ul>{acceptedFacts.map((fact) => <li key={fact.property}><code>{propertyLabel(fact.property)}</code>: {displayValue(fact.value)} <small>({fact.confidence}, {fact.versionStatus})</small><br /><PropertySources sourceIds={fact.sourceIds} /></li>)}</ul> : 'ありません'}</dd><dt>確認中の項目</dt><dd>{unknowns.length ? <ul>{unknowns.map((entry, index) => <li key={`${entry.property}-${index}`}><code>{entry.property}</code>: {entry.notes} <small>({entry.kind})</small>{entry.sourceAttempts?.length ? <><br /><small>確認先: {entry.sourceAttempts.map((attempt) => `${harvestSources.get(attempt.sourceId)?.title ?? attempt.sourceId} — ${attempt.result}`).join(' · ')}</small></> : null}</li>)}</ul> : 'ありません'}</dd><dt>出典</dt><dd><ul>{sources.map((source) => <li key={source.id}>{source.url ? <a href={source.url} target="_blank" rel="noreferrer">{source.title}</a> : source.title} <small>({source.sourceType}, {source.gameVersion})</small></li>)}</ul></dd><dt>ゲームバージョン</dt><dd>{item.harvest.version.target} · {item.harvest.version.staleRisk ? '古い可能性あり' : '古い可能性なし'}<br /><small>{item.harvest.version.notes}</small></dd><dt>情報の競合</dt><dd>{item.harvest.conflicts.length ? <ul>{item.harvest.conflicts.map((conflict) => <li key={conflict.property}><code>{conflict.property}</code>: {conflict.probableReason} ({conflict.resolutionStatus})</li>)}</ul> : 'ありません'}</dd></dl></details></>}</div></details>
      })}</div>
      {filtered.length === 0 && <div className="empty-state"><h2>該当するデータがありません</h2><p>検索語または対応状況を変更してください。</p></div>}
    </section>}
  </main>
}

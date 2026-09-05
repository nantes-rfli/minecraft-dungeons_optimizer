"use client"

import { useMemo, useState } from 'react'
import meleeAudit from '../../research/melee-enchantment-audit.json'
import meleeWeaponAudit from '../../research/melee-attack-profile-audit.json'
import armorEnchantAudit from '../../research/armor-enchantment-audit.json'
import armorSupport from '../../research/armor-runtime-support.json'
import sourceHarvest from '../../research/source-harvest-browser.json'
import { ARTIFACT_AUDIT } from '../research/artifactAudit'
import { RANGED_ENCHANTMENT_AUDIT, RANGED_WEAPON_AUDIT } from '../research/rangedAudit'
import { hrefFor, type AppRoute } from '../app/routes'
import { WEAPONS } from '../data/weapons'
import { ARMOR_ENCHANTMENTS } from '../data/armors'
import { ARTIFACTS } from '../data/artifacts'
import { DataSummary } from '../views/DataSummary'

type Support = 'full' | 'limited' | 'research-only'
type HarvestCategory = 'melee-weapon' | 'melee-enchantment' | 'armor' | 'armor-enchantment' | 'ranged-weapon' | 'ranged-enchantment' | 'artifact'
type HarvestFact = { property: string; value: unknown; confidence: string; status: string; notes?: string }
type HarvestRecord = {
  category: HarvestCategory
  id: string
  known: HarvestFact[]
  unknown: { property: string; kind: string; notes?: string }[]
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

const supportLabel: Record<Support, string> = { full: 'Full', limited: 'Limited', 'research-only': 'Research-only' }
const categoryRoutes: { route: AppRoute; label: string; count: number }[] = [
  { route: '/data/melee', label: '近接', count: 82 },
  { route: '/data/armor', label: '防具', count: 73 },
  { route: '/data/ranged', label: '遠距離', count: 71 },
  { route: '/data/artifacts', label: 'Artifact', count: 45 },
  { route: '/data/enchantments', label: 'Enchant', count: 115 },
]

function itemsFor(route: AppRoute): CatalogItem[] {
  if (route === '/data/melee') return meleeWeaponAudit.weapons.map((item) => ({ id: item.weaponId, name: item.name.ja ?? item.name.en, secondary: item.name.ja ? item.name.en : undefined, family: item.family, support: (item.weaponId in WEAPONS ? 'full' : 'research-only') as Support, known: `${item.status} · ${item.attackProfile.hitsPerSecond} hit/s`, blockers: item.notes ? [item.notes] : item.weaponId in WEAPONS ? [] : ['Optimizer catalog未登録'], harvest: getHarvest('melee-weapon', item.weaponId) }))
  if (route === '/data/armor') return armorSupport.entries.map((item) => ({ id: item.id, name: item.name, family: 'Armor', support: item.supportLevel as Support, known: item.boundaries.join(' / ') || '監査済み', blockers: item.reasons, harvest: getHarvest('armor', item.id) }))
  if (route === '/data/ranged') return RANGED_WEAPON_AUDIT.entries.map((item) => ({ id: item.id, name: item.name.ja ?? item.name.en, secondary: item.name.ja ? item.name.en : undefined, family: item.family, support: item.supportLevel as Support, known: item.firingMode, blockers: item.intrinsic.completeMechanicVerification ? [] : ['特殊効果・発射周期の独立検証が未完了'], harvest: getHarvest('ranged-weapon', item.id) }))
  if (route === '/data/artifacts') return [
    ...ARTIFACT_AUDIT.entries.map((item) => ({ id: item.id, name: item.name, family: item.mechanicFamily, support: (item.id in ARTIFACTS ? item.runtimeReadiness === 'ready-with-limits' ? 'limited' : 'full' : 'research-only') as Support, known: `${item.cooldown.seconds}秒 cooldown · confidence ${item.confidence}`, blockers: item.blockers, harvest: getHarvest('artifact', item.id) })),
    ...ARTIFACT_AUDIT.populationDifferences.map((item) => ({ id: item.id, name: item.name, family: item.mechanicFamily, support: 'research-only' as const, known: `${item.cooldownSeconds}秒 cooldown · secondary-only`, blockers: item.blockers, harvest: getHarvest('artifact', item.id) })),
  ]
  return [
    ...meleeAudit.entries.map((item) => ({ id: `melee-${item.id}`, name: item.name.ja ?? item.name.en, secondary: item.name.ja ? item.name.en : undefined, family: `近接 · ${item.modelCategory}`, support: (item.runtimeStatus === 'implemented' ? (item.runtimePowerRange ? 'limited' : 'full') : 'research-only') as Support, known: item.trigger, blockers: item.runtimeStatus === 'implemented' ? [] : [item.notes ?? item.runtimeStatus], harvest: getHarvest('melee-enchantment', item.id) })),
    ...armorEnchantAudit.entries.map((item) => ({ id: `armor-${item.id}`, name: item.name, family: `防具 · ${item.mechanicFamily}`, support: (item.id in ARMOR_ENCHANTMENTS ? 'limited' : 'research-only') as Support, known: item.tierLabel, blockers: item.blockers, harvest: getHarvest('armor-enchantment', item.id) })),
    ...RANGED_ENCHANTMENT_AUDIT.entries.map((item) => ({ id: `ranged-${item.id}`, name: item.name.ja ?? item.name.en, secondary: item.name.ja ? item.name.en : undefined, family: `遠距離 · ${item.triggerFamily}`, support: item.supportLevel as Support, known: item.directIndirectStatus, blockers: item.blockers, harvest: getHarvest('ranged-enchantment', item.id) })),
  ]
}

export function DataBrowserPage({ route }: { route: AppRoute }) {
  const [query, setQuery] = useState('')
  const [support, setSupport] = useState<'all' | Support>('all')
  const items = useMemo(() => itemsFor(route), [route])
  const filtered = items.filter((item) => `${item.name} ${item.secondary ?? ''} ${item.id}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()) && (support === 'all' || item.support === support))
  return <main id="main-content" tabIndex={-1} className="page-main">
    <header className="page-intro"><p className="eyebrow">GAME DATA / REFERENCE</p><h1>データ</h1><p>ゲーム全体の装備・効果と、このツールが評価できる範囲を確認します。自分の所持品は「装備」で管理します。</p></header>
    <nav className="subnav" aria-label="データカテゴリ">{categoryRoutes.map((item) => <a key={item.route} href={hrefFor(item.route)} aria-current={route === item.route ? 'page' : undefined}>{item.label}<span>{item.count}</span></a>)}</nav>
    {route === '/data' ? <>
      <DataSummary />
      <section className="panel compact-panel"><h2>対応状況の読み方</h2><div className="status-legend"><p><span className="support full">Full</span>現在のscopeで通常対応</p><p><span className="support limited">Limited</span>Power・組合せなどに制限</p><p><span className="support research-only">Research-only</span>根拠不足のためOptimizer候補外</p></div><p>カテゴリごとに母集団が異なるため、誤解を招く総合パーセントは表示しません。</p></section>
    </> : <section className="catalog-panel">
      <div className="catalog-toolbar"><label>検索<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="日本語名・英語名・ID" /></label><label>対応状況<select value={support} onChange={(event) => setSupport(event.target.value as 'all' | Support)}><option value="all">すべて</option><option value="full">Full</option><option value="limited">Limited</option><option value="research-only">Research-only</option></select></label><p role="status">{filtered.length}件</p></div>
      <div className="catalog-list">{filtered.map((item) => {
        const sources = item.harvest.sourceIds.map((id) => harvestSources.get(id)).filter((source): source is HarvestSource => Boolean(source))
        const acceptedFacts = item.harvest.known.filter((fact) => fact.status === 'accepted')
        const unresolvedFacts = item.harvest.known.filter((fact) => fact.status !== 'accepted').map((fact) => ({ property: fact.property, kind: fact.status, notes: `${fact.notes ?? 'Current value is not accepted.'} Recorded value: ${displayValue(fact.value)}` }))
        const unknowns = [...item.blockers.map((notes) => ({ property: 'runtime', kind: 'blocker', notes })), ...item.harvest.unknown.map((entry) => ({ ...entry, notes: entry.notes ?? entry.kind })), ...unresolvedFacts]
        return <details className="catalog-row" key={item.id}><summary><span><strong>{item.name}</strong>{item.secondary && <small lang="en">{item.secondary}</small>}</span><span>{item.family}</span><span className={`support ${item.support}`}>{supportLabel[item.support]}</span></summary><div className="catalog-detail"><dl><dt>Canonical ID</dt><dd><code>{item.id.replace(/^(melee|armor|ranged)-/, '')}</code></dd><dt>分類</dt><dd>{item.family}</dd><dt>Known</dt><dd><p>{item.known}</p><ul>{acceptedFacts.map((fact) => <li key={fact.property}><code>{fact.property}</code>: {displayValue(fact.value)} <small>({fact.confidence})</small></li>)}</ul></dd><dt>Unknown / Blockers</dt><dd>{unknowns.length ? <ul>{unknowns.map((entry, index) => <li key={`${entry.property}-${index}`}><code>{entry.property}</code>: {entry.notes} <small>({entry.kind})</small></li>)}</ul> : 'この表示範囲ではなし'}</dd><dt>Sources</dt><dd><ul>{sources.map((source) => <li key={source.id}>{source.url ? <a href={source.url} target="_blank" rel="noreferrer">{source.title}</a> : source.title} <small>({source.sourceType}, {source.gameVersion})</small></li>)}</ul></dd><dt>Version</dt><dd>{item.harvest.version.target} · {item.harvest.version.currentVersionVerified ? 'current version verified' : 'current version未独立検証'} · {item.harvest.version.staleRisk ? 'stale riskあり' : 'stale riskなし'}<br /><small>{item.harvest.version.notes}</small></dd><dt>Conflict</dt><dd>{item.harvest.conflicts.length ? <ul>{item.harvest.conflicts.map((conflict) => <li key={conflict.property}><code>{conflict.property}</code>: {conflict.probableReason} ({conflict.resolutionStatus})</li>)}</ul> : '記録なし'}</dd></dl></div></details>
      })}</div>
      {filtered.length === 0 && <div className="empty-state"><h2>該当するデータがありません</h2><p>検索語または対応状況を変更してください。</p></div>}
    </section>}
  </main>
}

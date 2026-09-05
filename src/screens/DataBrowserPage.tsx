"use client"

import { useMemo, useState } from 'react'
import coverage from '../../research/evidence-coverage-dashboard.json'
import meleeAudit from '../../research/melee-enchantment-audit.json'
import meleeWeaponAudit from '../../research/melee-attack-profile-audit.json'
import armorEnchantAudit from '../../research/armor-enchantment-audit.json'
import armorSupport from '../../research/armor-runtime-support.json'
import { ARTIFACT_AUDIT } from '../research/artifactAudit'
import { RANGED_ENCHANTMENT_AUDIT, RANGED_WEAPON_AUDIT } from '../research/rangedAudit'
import { hrefFor, type AppRoute } from '../app/routes'
import { WEAPONS } from '../data/weapons'
import { ARMOR_ENCHANTMENTS } from '../data/armors'
import { ARTIFACTS } from '../data/artifacts'

type Support = 'full' | 'limited' | 'research-only'
type CatalogItem = { id: string; name: string; secondary?: string; family: string; support: Support; known: string; blockers: string[]; source?: string }

const supportLabel: Record<Support, string> = { full: 'Full', limited: 'Limited', 'research-only': 'Research-only' }
const categoryRoutes: { route: AppRoute; label: string; count: number }[] = [
  { route: '/data/melee', label: '近接', count: 82 },
  { route: '/data/armor', label: '防具', count: 73 },
  { route: '/data/ranged', label: '遠距離', count: 71 },
  { route: '/data/artifacts', label: 'Artifact', count: 45 },
  { route: '/data/enchantments', label: 'Enchant', count: 115 },
]

function itemsFor(route: AppRoute): CatalogItem[] {
  if (route === '/data/melee') return meleeWeaponAudit.weapons.map((item) => ({ id: item.weaponId, name: item.name.ja ?? item.name.en, secondary: item.name.ja ? item.name.en : undefined, family: item.family, support: (item.weaponId in WEAPONS ? 'full' : 'research-only') as Support, known: `${item.status} · ${item.attackProfile.hitsPerSecond} hit/s`, blockers: item.notes ? [item.notes] : item.weaponId in WEAPONS ? [] : ['Optimizer catalog未登録'], source: item.sources[0]?.url }))
  if (route === '/data/armor') return armorSupport.entries.map((item) => ({ id: item.id, name: item.name, family: 'Armor', support: item.supportLevel as Support, known: item.boundaries.join(' / ') || '監査済み', blockers: item.reasons }))
  if (route === '/data/ranged') return RANGED_WEAPON_AUDIT.entries.map((item) => ({ id: item.id, name: item.name.ja ?? item.name.en, secondary: item.name.ja ? item.name.en : undefined, family: item.family, support: item.supportLevel as Support, known: item.firingMode, blockers: item.intrinsic.completeMechanicVerification ? [] : ['特殊効果・発射周期の独立検証が未完了'], source: item.sourceUrl }))
  if (route === '/data/artifacts') return [
    ...ARTIFACT_AUDIT.entries.map((item) => ({ id: item.id, name: item.name, family: item.mechanicFamily, support: (item.id in ARTIFACTS ? item.runtimeReadiness === 'ready-with-limits' ? 'limited' : 'full' : 'research-only') as Support, known: `${item.cooldown.seconds}秒 cooldown · confidence ${item.confidence}`, blockers: item.blockers, source: item.sourceIds[0] })),
    ...ARTIFACT_AUDIT.populationDifferences.map((item) => ({ id: item.id, name: item.name, family: item.mechanicFamily, support: 'research-only' as const, known: `${item.cooldownSeconds}秒 cooldown · secondary-only`, blockers: item.blockers })),
  ]
  return [
    ...meleeAudit.entries.map((item) => ({ id: `melee-${item.id}`, name: item.name.ja ?? item.name.en, secondary: item.name.ja ? item.name.en : undefined, family: `近接 · ${item.modelCategory}`, support: (item.runtimeStatus === 'implemented' ? (item.runtimePowerRange ? 'limited' : 'full') : 'research-only') as Support, known: item.trigger, blockers: item.runtimeStatus === 'implemented' ? [] : [item.notes ?? item.runtimeStatus], source: item.sources[0]?.url })),
    ...armorEnchantAudit.entries.map((item) => ({ id: `armor-${item.id}`, name: item.name, family: `防具 · ${item.mechanicFamily}`, support: (item.id in ARMOR_ENCHANTMENTS ? 'limited' : 'research-only') as Support, known: item.tierLabel, blockers: item.blockers })),
    ...RANGED_ENCHANTMENT_AUDIT.entries.map((item) => ({ id: `ranged-${item.id}`, name: item.name.ja ?? item.name.en, secondary: item.name.ja ? item.name.en : undefined, family: `遠距離 · ${item.triggerFamily}`, support: item.supportLevel as Support, known: item.directIndirectStatus, blockers: item.blockers, source: item.sourceUrl })),
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
      <section className="summary-grid" aria-label="データ対応状況">{coverage.categories.filter((item) => ['melee-enchantment', 'armor', 'ranged-weapon', 'artifact'].includes(item.id)).map((item) => <article key={item.id}><span>{item.label}</span><strong>{item.population}</strong><p><b>{item.runtime.full}</b> Full · <b>{item.runtime.limited}</b> Limited · <b>{item.runtime.researchOnly}</b> Research-only</p></article>)}</section>
      <section className="panel compact-panel"><h2>対応状況の読み方</h2><div className="status-legend"><p><span className="support full">Full</span>現在のscopeで通常対応</p><p><span className="support limited">Limited</span>Power・組合せなどに制限</p><p><span className="support research-only">Research-only</span>根拠不足のためOptimizer候補外</p></div><p>カテゴリごとに母集団が異なるため、誤解を招く総合パーセントは表示しません。</p></section>
    </> : <section className="catalog-panel">
      <div className="catalog-toolbar"><label>検索<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="日本語名・英語名・ID" /></label><label>対応状況<select value={support} onChange={(event) => setSupport(event.target.value as 'all' | Support)}><option value="all">すべて</option><option value="full">Full</option><option value="limited">Limited</option><option value="research-only">Research-only</option></select></label><p role="status">{filtered.length}件</p></div>
      <div className="catalog-list">{filtered.map((item) => <details className="catalog-row" key={item.id}><summary><span><strong>{item.name}</strong>{item.secondary && <small lang="en">{item.secondary}</small>}</span><span>{item.family}</span><span className={`support ${item.support}`}>{supportLabel[item.support]}</span></summary><div className="catalog-detail"><dl><dt>Canonical ID</dt><dd><code>{item.id.replace(/^(melee|armor|ranged)-/, '')}</code></dd><dt>分類</dt><dd>{item.family}</dd><dt>Known</dt><dd>{item.known}</dd><dt>Unknown / Blockers</dt><dd>{item.blockers.join(' / ') || 'この表示範囲ではなし'}</dd></dl>{item.source?.startsWith('http') && <a href={item.source} target="_blank" rel="noreferrer">Evidenceを確認</a>}</div></details>)}</div>
      {filtered.length === 0 && <div className="empty-state"><h2>該当するデータがありません</h2><p>検索語または対応状況を変更してください。</p></div>}
    </section>}
  </main>
}

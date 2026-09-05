"use client"

import { Suspense, lazy } from 'react'
import { hrefFor, type AppRoute } from '../app/routes'
import { ModelEvidencePage } from './ModelEvidencePage'

const MethodologyPage = lazy(() => import('../views/MethodologyPage').then((module) => ({ default: module.MethodologyPage })))
const pages: { route: AppRoute; label: string; description: string; formula: string; limitations: string }[] = [
  { route: '/model/damage', label: 'Damage', description: '近接・遠距離の直接ダメージと、proc・DoT・爆発を別経路で積み上げます。', formula: 'single target DPS + expected area damage / second', limitations: '未検証の発射挙動やPower範囲外を外挿しません。' },
  { route: '/model/healing', label: 'Healing', description: '実回復と、Refreshmentによるポーション回復容量を分けて評価します。', formula: 'healing / second = proc healing + life steal + potion capacity', limitations: '過剰回復を最大HPで飽和させます。' },
  { route: '/model/defense', label: 'Defense', description: 'Armor・Guarding Strike・Weakeningなどの稼働率から実効HPを求めます。', formula: 'effective health = max health / incoming damage multiplier', limitations: '同じ防御効果の重複規則はEvidenceのある範囲のみです。' },
  { route: '/model/control', label: 'Control', description: '行動阻害・集敵を火力とは独立したutilityとして評価します。', formula: 'control utility = uptime × affected enemy share × effect weight', limitations: 'ボス耐性や地形依存は完全には再現しません。' },
]

export function ModelExplorerPage({ route }: { route: AppRoute }) {
  const selected = pages.find((page) => page.route === route)
  if (route === '/model/evidence') return <ModelEvidencePage />
  if (route === '/model/evidence/details') return <Suspense fallback={<main id="main-content" tabIndex={-1} role="status" className="page-main">Evidenceを読み込み中…</main>}><MethodologyPage /></Suspense>
  return <main id="main-content" tabIndex={-1} className="page-main">
    <header className="page-intro"><p className="eyebrow">MODEL / EXPLAINER</p><h1>モデル</h1><p>Optimizerが候補を作り、比較し、推奨を決める流れを段階的に確認します。</p></header>
    <nav className="subnav" aria-label="モデルカテゴリ"><a href={hrefFor('/model')} aria-current={route === '/model' ? 'page' : undefined}>全体像</a>{pages.map((page) => <a key={page.route} href={hrefFor(page.route)} aria-current={route === page.route ? 'page' : undefined}>{page.label}</a>)}<a href={hrefFor('/model/evidence')} aria-current={route.startsWith('/model/evidence') ? 'page' : undefined}>Evidence / 精度</a></nav>
    {selected ? <article className="model-card"><p className="eyebrow">{selected.label.toUpperCase()}</p><h2>{selected.label}の評価</h2><p className="model-lede">{selected.description}</p><section><h3>基本式</h3><code className="formula">{selected.formula}</code></section><details><summary>詳細条件</summary><p>Scenarioの詳細条件と装備のruntime supportを使い、候補ごとに同じ評価経路を通します。</p></details><details><summary>Limitations</summary><p>{selected.limitations}</p></details><details><summary>Evidenceと実装詳細</summary><p>出典、仮定、未解決項目はEvidence / 精度ページで確認できます。</p><a href={hrefFor('/model/evidence')}>Evidence / 精度を開く</a></details></article> : <>
      <ol className="model-flow" aria-label="最適化モデルの流れ"><li><span>01</span><strong>Inventory</strong><small>登録済み装備</small></li><li><span>02</span><strong>Candidate Build</strong><small>候補を全生成</small></li><li><span>03</span><strong>Build評価</strong><small>Damage · Healing · Defense · Control</small></li><li><span>04</span><strong>Objective Score</strong><small>目的に応じて統合</small></li><li><span>05</span><strong>Best / Alternatives</strong><small>全探索で比較</small></li></ol>
      <section className="model-domain-grid">{pages.map((page) => <a key={page.route} href={hrefFor(page.route)}><span>{page.label.slice(0, 1)}</span><div><h2>{page.label}</h2><p>{page.description}</p></div></a>)}</section>
    </>}
  </main>
}

"use client"

import { useRef, useState, type ReactNode } from 'react'
import { hrefFor, routeTitle, type AppRoute } from './routes'

const groups: { label: string; items: { route: AppRoute; label: string; icon: string }[] }[] = [
  { label: 'ツール', items: [
    { route: '/inventory', label: '装備', icon: '◇' },
    { route: '/optimize', label: '最適化', icon: '◎' },
    { route: '/research', label: '調査クエスト', icon: '⌁' },
  ] },
  { label: '情報', items: [
    { route: '/data', label: 'データ', icon: '▦' },
    { route: '/model', label: 'モデル', icon: '∑' },
  ] },
  { label: 'その他', items: [
    { route: '/storage', label: '保存・復元', icon: '⇩' },
    { route: '/changes', label: '変更履歴', icon: '↻' },
  ] },
]

export function AppShell({ route, children }: { route: AppRoute; children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const closeMenu = (restoreFocus = false) => {
    setMenuOpen(false)
    if (restoreFocus) requestAnimationFrame(() => menuButtonRef.current?.focus())
  }
  const toggleMenu = () => {
    if (menuOpen) return closeMenu(true)
    setMenuOpen(true)
  }
  const isCurrent = (item: AppRoute) => item === '/data' ? route.startsWith('/data') : item === '/model' ? route.startsWith('/model') : route === item
  return <div className="app-shell" onKeyDown={(event) => { if (event.key === 'Escape' && menuOpen) closeMenu(true) }}>
    <a className="skip-link" href={hrefFor(route)} onClick={(event) => { event.preventDefault(); document.querySelector<HTMLElement>('#main-content')?.focus() }}>本文へ移動</a>
    <header className="mobile-topbar">
      <a className="brand" href={hrefFor('/inventory')}>DUNGEONS <span>OPTIMIZER</span></a>
      <button ref={menuButtonRef} type="button" className="menu-button" aria-expanded={menuOpen} aria-controls="primary-navigation" onClick={toggleMenu}>{menuOpen ? '閉じる' : 'メニュー'}</button>
    </header>
    {menuOpen && <button className="nav-scrim" type="button" tabIndex={-1} aria-label="メニューを閉じる" onClick={() => closeMenu(true)} />}
    <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
      <a className="sidebar-brand" href={hrefFor('/inventory')}><span className="brand-mark">MCD</span><span>DUNGEONS<br /><strong>OPTIMIZER</strong></span></a>
      <nav id="primary-navigation" aria-label="メインナビゲーション">
        {groups.map((group) => <section className="nav-group" key={group.label}><h2>{group.label}</h2>{group.items.map((item) => <a key={item.route} href={hrefFor(item.route)} onClick={() => closeMenu()} className={isCurrent(item.route) ? 'active' : ''} aria-current={isCurrent(item.route) ? 'page' : undefined}><span aria-hidden="true">{item.icon}</span>{item.label}</a>)}</section>)}
      </nav>
      <div className="sidebar-status"><span>PERSONAL WORKSPACE</span><strong>モデル検証中</strong></div>
    </aside>
    <div className="app-body">
      <header className="topbar"><p>{routeTitle(route)}</p><span>Minecraft Dungeons · 1.17.0.0</span></header>
      {children}
    </div>
  </div>
}

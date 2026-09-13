"use client"

import { useEffect, useState } from 'react'

export type AppRoute =
  | '/inventory'
  | '/optimize'
  | '/data'
  | '/data/melee'
  | '/data/armor'
  | '/data/ranged'
  | '/data/artifacts'
  | '/data/enchantments'
  | '/model'
  | '/model/damage'
  | '/model/healing'
  | '/model/defense'
  | '/model/control'
  | '/model/evidence'
  | '/model/evidence/details'
  | '/storage'
  | '/research'
  | '/changes'

const ROUTES = new Set<AppRoute>([
  '/inventory', '/optimize', '/data', '/data/melee', '/data/armor', '/data/ranged',
  '/data/artifacts', '/data/enchantments', '/model', '/model/damage', '/model/healing',
  '/model/defense', '/model/control', '/model/evidence', '/model/evidence/details', '/storage', '/research', '/changes',
])

export const hrefFor = (route: AppRoute) => `#${route}`
export const hrefForEquipment = (route: Extract<AppRoute, `/data/${string}`>, itemId: string) => `#${route}?item=${encodeURIComponent(itemId)}`

function hashLocation(): { route: string; search: URLSearchParams } {
  const [route = '', query = ''] = window.location.hash.replace(/^#/, '').split('?', 2)
  return { route, search: new URLSearchParams(query) }
}

export function readRouteItem(): string | null {
  if (typeof window === 'undefined') return null
  return hashLocation().search.get('item')
}

export function readRoute(): AppRoute {
  if (typeof window === 'undefined') return '/inventory'
  const hash = hashLocation().route
  if (hash === 'optimizer') return '/optimize'
  if (hash === 'methodology') return '/model/evidence/details'
  return ROUTES.has(hash as AppRoute) ? hash as AppRoute : '/inventory'
}

export function useAppRoute() {
  const [route, setRoute] = useState<AppRoute>('/inventory')
  useEffect(() => {
    const sync = () => setRoute(readRoute())
    sync()
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [])
  useEffect(() => {
    document.title = `${routeTitle(route)} | Dungeons Optimizer`
    requestAnimationFrame(() => document.querySelector<HTMLElement>('#main-content')?.focus())
  }, [route])
  return route
}

export function routeTitle(route: AppRoute): string {
  if (route === '/inventory') return '装備'
  if (route === '/optimize') return '最適化'
  if (route.startsWith('/data')) return 'データ'
  if (route.startsWith('/model')) return 'モデル'
  if (route === '/storage') return '保存・復元'
  if (route === '/research') return '調査クエスト'
  return '変更履歴'
}

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
  | '/changes'

const ROUTES = new Set<AppRoute>([
  '/inventory', '/optimize', '/data', '/data/melee', '/data/armor', '/data/ranged',
  '/data/artifacts', '/data/enchantments', '/model', '/model/damage', '/model/healing',
  '/model/defense', '/model/control', '/model/evidence', '/model/evidence/details', '/storage', '/changes',
])

export const hrefFor = (route: AppRoute) => `#${route}`

export function readRoute(): AppRoute {
  if (typeof window === 'undefined') return '/inventory'
  const hash = window.location.hash.replace(/^#/, '')
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
  return '変更履歴'
}

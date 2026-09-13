"use client"

import { useState } from 'react'
import uiIconManifest from '../../generated/ui-icons/manifest.json'
import type { EquipmentCategory } from '../core/types'
import type { EquipmentCatalogEntry } from '../data/equipmentCatalog'
import { shouldRenderUiIcon } from './uiIconState'

const CATEGORY_GLYPHS: Record<EquipmentCategory, string> = { melee: '⚔', armor: '⬟', ranged: '➶', artifact: '✦' }

const uiIcons = new Map(uiIconManifest.entries.filter((entry) => entry.status === 'matched' && entry.outputWebp).map((entry) => [entry.id, `/${entry.outputWebp!.replace(/^public\//, '')}`]))
const categoryIconIds: Record<EquipmentCategory, string> = { melee: 'category-melee', ranged: 'category-ranged', armor: 'category-armor', artifact: 'category-artifact' }

export function EquipmentArtwork({ catalog, compact = false, priority = false }: { catalog: EquipmentCatalogEntry; compact?: boolean; priority?: boolean }) {
  const [failedSource, setFailedSource] = useState<string>()
  const source = catalog.icon
  const showImage = Boolean(source && failedSource !== source)
  return <span className={`equipment-artwork ${compact ? 'compact' : ''}`} aria-hidden="true">
    {showImage ? <img src={source} alt="" width="128" height="128" loading={priority ? 'eager' : 'lazy'} decoding="async" fetchPriority={priority ? 'high' : 'low'} onError={() => setFailedSource(source)} /> : <><b>{CATEGORY_GLYPHS[catalog.category]}</b><small>{(catalog.name.ja ?? catalog.name.en).slice(0, 1)}</small></>}
  </span>
}

export function EquipmentCategoryIcon({ category }: { category: EquipmentCategory }) {
  const source = uiIcons.get(categoryIconIds[category])
  const [failedSource, setFailedSource] = useState<string>()
  return <span className={`equipment-category-icon ${category}`} aria-hidden="true">
    {shouldRenderUiIcon(source, failedSource) ? <img src={source} alt="" width="56" height="56" loading="lazy" decoding="async" onError={() => setFailedSource(source)} /> : CATEGORY_GLYPHS[category]}
  </span>
}

export function SoulMarker({ size = 'medium' }: { size?: 'small' | 'medium' }) {
  const source = uiIcons.get('soul')
  const [failedSource, setFailedSource] = useState<string>()
  return <span className={`soul-marker soul-marker--${size}`} role="img" aria-label="Soul 装備">
    {shouldRenderUiIcon(source, failedSource) ? <img src={source} alt="" width="32" height="32" loading="eager" decoding="async" onError={() => setFailedSource(source)} /> : <span aria-hidden="true">◉</span>}
  </span>
}

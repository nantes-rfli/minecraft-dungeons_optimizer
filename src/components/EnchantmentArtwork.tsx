"use client"

import { useState } from 'react'
import { resolveEnchantment } from '../data/enchantmentCatalog'
import { shouldRenderUiIcon } from './uiIconState'

export function EnchantmentArtwork({ enchantmentId, size = 'small', decorative = true }: { enchantmentId: string; size?: 'small' | 'medium'; decorative?: boolean }) {
  const enchantment = resolveEnchantment(enchantmentId)
  const source = enchantment?.icon
  const [failedSource, setFailedSource] = useState<string>()
  const showImage = shouldRenderUiIcon(source, failedSource)
  const accessible = decorative ? { 'aria-hidden': true as const } : { role: 'img', 'aria-label': enchantment?.name.ja ? `${enchantment.name.ja} / ${enchantment.name.en}` : enchantment?.name.en ?? enchantmentId }
  return <span className={`enchantment-artwork enchantment-artwork--${size}`} {...accessible}>
    {showImage ? <img src={source} alt="" width={size === 'medium' ? 64 : 32} height={size === 'medium' ? 64 : 32} loading="lazy" decoding="async" onError={() => setFailedSource(source)} /> : <span className="enchantment-artwork-fallback">✦</span>}
  </span>
}

export function EnchantmentIdentity({ value, tier }: { value: string; tier?: number }) {
  const enchantment = resolveEnchantment(value)
  if (!enchantment) return <span className="enchantment-identity enchantment-identity--unresolved">{value}{tier ? ` Tier ${tier}` : ''}</span>
  return <span className="enchantment-identity"><EnchantmentArtwork enchantmentId={enchantment.id} /><span><strong>{enchantment.name.ja ?? enchantment.name.en}</strong>{enchantment.name.ja && <small lang="en">{enchantment.name.en}</small>}{tier ? <small>Tier {tier}</small> : null}</span></span>
}

import type { AttackProfile, Evidence, WeaponId } from '../core/types'
import { MVP_MODEL_SOURCE } from './sources'

/**
 * Replace each proxy entry with a frame-measured profile once observations are available.
 * Keeping timing separate from weapon ratings lets model changes avoid touching calculation code.
 */
export const ATTACK_PROFILES: Readonly<Record<WeaponId, Evidence<AttackProfile>>> = {
  'fighters-bindings': {
    value: { method: 'speed-rating-proxy', hitsPerSecond: 7 },
    source: MVP_MODEL_SOURCE,
    confidence: 'low',
    note: 'Derived from Speed 14.0 × the legacy 0.5 attacks-per-second proxy.',
  },
  'double-axe': {
    value: { method: 'speed-rating-proxy', hitsPerSecond: 1.05 },
    source: MVP_MODEL_SOURCE,
    confidence: 'low',
    note: 'Derived from Speed 2.1 × the legacy 0.5 attacks-per-second proxy.',
  },
  anchor: {
    value: { method: 'speed-rating-proxy', hitsPerSecond: 0.5 },
    source: MVP_MODEL_SOURCE,
    confidence: 'low',
    note: 'Derived from Speed 1.0 × the legacy 0.5 attacks-per-second proxy.',
  },
}

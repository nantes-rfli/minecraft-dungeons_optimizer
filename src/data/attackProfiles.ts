import type { AttackProfile, Evidence, WeaponId } from '../core/types'
import {
  MINECRAFT_WIKI_ANCHOR_SOURCE,
  MINECRAFT_WIKI_DOUBLE_AXE_SOURCE,
  MINECRAFT_WIKI_FIGHTERS_BINDINGS_SOURCE,
} from './sources'

/**
 * Per-hit timings are kept separate from weapon ratings so HPS remains a derived value and
 * combo-sensitive effects can consume the raw structure in later phases.
 */
export const ATTACK_PROFILES: Readonly<Record<WeaponId, Evidence<AttackProfile>>> = {
  'fighters-bindings': {
    value: {
      method: 'published-hit-timings',
      hitDurationsSeconds: [0.15, 0.15, 0.15, 0.125],
      comboFinisherHit: 4,
    },
    source: MINECRAFT_WIKI_FIGHTERS_BINDINGS_SOURCE,
    confidence: 'medium',
    note: 'Minecraft Dungeons 1.17.0.0 audit; HPS is derived from all four published hit durations.',
  },
  'double-axe': {
    value: {
      method: 'published-hit-timings',
      hitDurationsSeconds: [0.6, 0.6],
      comboFinisherHit: 2,
    },
    source: MINECRAFT_WIKI_DOUBLE_AXE_SOURCE,
    confidence: 'medium',
    note: 'Minecraft Dungeons 1.17.0.0 audit; HPS is derived from both published hit durations.',
  },
  anchor: {
    value: {
      method: 'published-hit-timings',
      hitDurationsSeconds: [2.5],
      comboFinisherHit: 1,
    },
    source: MINECRAFT_WIKI_ANCHOR_SOURCE,
    confidence: 'medium',
    note: 'Minecraft Dungeons 1.17.0.0 audit; HPS is derived from the published single-hit duration.',
  },
}

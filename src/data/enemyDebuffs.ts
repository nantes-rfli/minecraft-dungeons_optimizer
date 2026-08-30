import type { Evidence } from '../core/types'
import { MVP_MODEL_SOURCE, WEAKENING_SOURCE } from './sources'

export const WEAKENING_DURATION: Evidence<number> = {
  value: 5,
  source: WEAKENING_SOURCE,
  confidence: 'high',
  note: 'Retained in tier mechanics. Time-weighted scenario coverage already includes duration; do not multiply by five again.',
}

export const WEAKENING_APPLICATION: Evidence<string> = {
  value: 'attacks-decrease-attack-damage-of-all-nearby-enemies',
  source: WEAKENING_SOURCE,
  confidence: 'high',
  note: 'Enemy outgoing attack damage, not unconditional hero damage reduction. No exact radius or target-switching simulator.',
}

export const WEAKENING_HERO_DR_COMPOSITION: Evidence<string> = {
  value: 'enemy-damage-multiplier-times-hero-damage-taken-multipliers',
  source: MVP_MODEL_SOURCE,
  confidence: 'low',
  note: 'Independent time-averaged stages; correlations between weakened attackers, Guarding Strike uptime and artifact uptime are not simulated.',
}

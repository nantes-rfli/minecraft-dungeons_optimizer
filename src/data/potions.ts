import type { Evidence } from '../core/types'
import {
  HEALTH_POTION_SOURCE, MVP_MODEL_SOURCE, REFRESHMENT_EXCLUSIONS_SOURCE, REFRESHMENT_KILL_SOURCE,
} from './sources'

export const HEALTH_POTION_BASE_COOLDOWN: Evidence<number> = {
  value: 45,
  source: HEALTH_POTION_SOURCE,
  confidence: 'high',
  note: 'Public base cooldown; independent of artifact cooldownReduction. Armor modifiers are not implemented.',
}

export const HEALTH_POTION_HEAL_FRACTION: Evidence<number> = {
  value: 0.75,
  source: HEALTH_POTION_SOURCE,
  confidence: 'medium',
  note: 'Approximately 75% of maximum health, not an exact measured fraction or guaranteed actual healing.',
}

export const REFRESHMENT_DIRECT_KILL_CONDITION: Evidence<string> = {
  value: 'direct-kill-by-enchanted-weapon',
  source: REFRESHMENT_KILL_SOURCE,
  confidence: 'high',
  note: 'Direct melee hits and direct ranged projectiles qualify. Runtime uses melee CombatState.directWeaponKillsPerSecond only.',
}

export const REFRESHMENT_INDIRECT_KILL_EXCLUSIONS: Evidence<string> = {
  value: 'exclude-enchantment-proc-dot-and-artifact-kills',
  source: REFRESHMENT_EXCLUSIONS_SOURCE,
  confidence: 'low',
  note: 'Exhaustive Fire Aspect/Thundering/etc. interaction list remains community-observed; direct-kill wording has separate high-confidence Evidence.',
}

export const REFRESHMENT_COOLDOWN_RATE_MODEL: Evidence<string> = {
  value: 'continuous-direct-kill-rate',
  source: MVP_MODEL_SOURCE,
  confidence: 'low',
  note: 'C / (1 + k × r): steady-state availability with constant direct kills during cooldown and immediate reuse. No banking, discrete timing, encounter edges or HP-deficit simulation; only incremental capacity enters utility.',
}

import type { Evidence } from '../core/types'
import { MVP_MODEL_SOURCE } from './sources'

export const MODEL = {
  maximumAreaRating: {
    value: 14,
    source: MVP_MODEL_SOURCE,
    confidence: 'medium',
    note: 'Largest area rating in the supported v0.1 weapon set.',
  },
  killRateModel: {
    value: 1,
    source: MVP_MODEL_SOURCE,
    confidence: 'low',
    note: 'Build-dependent min(enemy supply, AoE DPS / average enemy health), with direct weapon kills derived from directKillShare.',
  },
} as const satisfies Record<string, Evidence<number>>

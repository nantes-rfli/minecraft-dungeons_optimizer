import type { Evidence } from '../core/types'
import { MVP_MODEL_SOURCE } from './sources'

export const MODEL = {
  attacksPerSecondPerSpeedPoint: {
    value: 0.5,
    source: MVP_MODEL_SOURCE,
    confidence: 'low',
    note: 'Converts the game-file Speed rating to an attack-rate proxy.',
  },
  maximumAreaRating: {
    value: 14,
    source: MVP_MODEL_SOURCE,
    confidence: 'medium',
    note: 'Largest area rating in the supported v0.1 weapon set.',
  },
} as const satisfies Record<string, Evidence<number>>

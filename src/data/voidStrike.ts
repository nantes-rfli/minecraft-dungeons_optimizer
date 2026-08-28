import type { Evidence, VoidStrikeCurve } from '../core/types'
import { MVP_MODEL_SOURCE } from './sources'

export const VOID_STRIKE_CURVE: Evidence<VoidStrikeCurve> = {
  value: {
    method: 'linear-proxy',
    points: [
      { elapsedSeconds: 0, multiplier: 1 },
      { elapsedSeconds: 3, multiplier: 7 },
    ],
  },
  source: MVP_MODEL_SOURCE,
  confidence: 'low',
  note: 'Provisional linear ramp from 1× to the documented Tier III maximum of 7×.',
}

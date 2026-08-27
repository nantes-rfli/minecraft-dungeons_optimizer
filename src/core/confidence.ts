import { MODEL } from '../data/model'
import type { Confidence, ConfidenceSummary, EnchantmentId } from './types'

const CONFIDENCE_SCORE: Readonly<Record<Confidence, number>> = {
  high: 0.95,
  medium: 0.7,
  low: 0.4,
}

export function summarizeConfidence(enchantments: readonly EnchantmentId[]): ConfidenceSummary {
  const caveats = [
    MODEL.attacksPerSecondPerSpeedPoint.note ?? 'Attack-rate conversion needs measurement.',
    'Scenario values are user-controlled normalized units, not power-level damage values.',
  ]
  const confidences: Confidence[] = ['high', MODEL.attacksPerSecondPerSpeedPoint.confidence]

  if (enchantments.includes('void-strike')) {
    confidences.push('low')
    caveats.push('Void Strike uses a linear ramp approximation and resets on each weapon hit.')
  }

  const score = confidences.reduce((sum, value) => sum + CONFIDENCE_SCORE[value], 0) / confidences.length
  const label: Confidence = score >= 0.82 ? 'high' : score >= 0.58 ? 'medium' : 'low'
  return { score, label, caveats }
}

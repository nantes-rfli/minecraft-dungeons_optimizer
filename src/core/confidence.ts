import { MODEL } from '../data/model'
import type { Confidence, ConfidenceSummary, EnchantmentId } from './types'

const CONFIDENCE_SCORE: Readonly<Record<Confidence, number>> = {
  high: 0.95,
  medium: 0.7,
  low: 0.4,
}

export function summarizeConfidence(enchantments: readonly EnchantmentId[]): ConfidenceSummary {
  const caveats = [
    'スピード値から攻撃回数への換算は暫定値であり、ゲーム内計測が必要です。',
    'シナリオ値は装備パワーに応じた実ダメージではなく、比較用の正規化値です。',
  ]
  const confidences: Confidence[] = ['high', MODEL.attacksPerSecondPerSpeedPoint.confidence]

  if (enchantments.includes('void-strike')) {
    confidences.push('low')
    caveats.push('「虚無の一撃」は線形増加で近似し、武器が命中するたびにリセットしています。')
  }

  const score = confidences.reduce((sum, value) => sum + CONFIDENCE_SCORE[value], 0) / confidences.length
  const label: Confidence = score >= 0.82 ? 'high' : score >= 0.58 ? 'medium' : 'low'
  return { score, label, caveats }
}

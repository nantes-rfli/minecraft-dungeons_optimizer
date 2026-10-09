import type { ObjectiveUtilities, Scenario } from '../core/types'

export const SCORE_AXES = ['damage', 'healing', 'defense', 'control'] as const
export const SCORE_AXIS_LABELS = { damage: 'Damage', healing: 'Healing', defense: 'Defense', control: 'Control' } as const

const weightPercentFormat = new Intl.NumberFormat('ja-JP', { maximumFractionDigits: 1 })

export function objectiveWeightShares(weights: Scenario['weights']) {
  const total = SCORE_AXES.reduce((sum, axis) => sum + weights[axis], 0)
  return SCORE_AXES.map((axis) => {
    const weightFraction = weights[axis] / total
    return { axis, weightFraction, weightPercent: 100 * weightFraction }
  })
}

export function formatObjectiveWeightPercent(weightPercent: number): string {
  return weightPercentFormat.format(weightPercent)
}

export function formatObjectiveWeightSummary(weights: Scenario['weights']): string | null {
  const values = SCORE_AXES.map((axis) => weights[axis])
  const total = values.reduce((sum, value) => sum + value, 0)
  if (values.some((value) => !Number.isFinite(value) || value < 0) || !Number.isFinite(total) || total <= 0) return null
  const shares = objectiveWeightShares(weights)
  return shares.map(({ axis, weightPercent }) => SCORE_AXIS_LABELS[axis] + ' ' + formatObjectiveWeightPercent(weightPercent) + '%').join(' · ')
}

/** Presentation of already evaluated utilities; never evaluates unsupported effects. */
export function scoreBreakdown(utilities: ObjectiveUtilities, weights: Scenario['weights']) {
  return objectiveWeightShares(weights).map(({ axis, weightFraction, weightPercent }) => ({
    axis,
    weightPercent,
    utilityPoints: 100 * utilities[axis],
    scorePoints: 100 * utilities[axis] * weightFraction,
  }))
}

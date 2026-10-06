import type { ObjectiveUtilities, Scenario } from '../core/types'

export const SCORE_AXES = ['damage', 'healing', 'defense', 'control'] as const
export const SCORE_AXIS_LABELS = { damage: 'Damage', healing: 'Healing', defense: 'Defense', control: 'Control' } as const

/** Presentation of already evaluated utilities; never evaluates unsupported effects. */
export function scoreBreakdown(utilities: ObjectiveUtilities, weights: Scenario['weights']) {
  const total = weights.damage + weights.healing + weights.defense + weights.control
  return SCORE_AXES.map((axis) => ({
    axis,
    weightPercent: 100 * weights[axis] / total,
    utilityPoints: 100 * utilities[axis],
    scorePoints: 100 * utilities[axis] * weights[axis] / total,
  }))
}

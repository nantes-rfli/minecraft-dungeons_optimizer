import type { Scenario } from '../core/types'
import { formatObjectiveWeightSummary } from './objectiveScoreBreakdown'

export function ObjectiveWeightSummary({ weights }: { readonly weights: Scenario['weights'] }) {
  const summary = formatObjectiveWeightSummary(weights)
  return <p className="objective-weight-summary">
    {summary ? <>評価配分: {summary}</> : '有効な評価配分を表示できません。'}
  </p>
}

import { evaluate } from './evaluate'
import type {
  DamageRegressionSample,
  ModelErrorObservation,
  ModelErrorSummary,
  PredictionRange,
} from './types'

export const MINIMUM_MODEL_ERROR_SAMPLES = 5

function assertPositiveFinite(value: number, field: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`モデル誤差の${field}には0より大きい有限値を指定してください。`)
  }
}

function nearestRankPercentile(sortedValues: readonly number[], percentile: number): number {
  const index = Math.max(0, Math.ceil(percentile * sortedValues.length) - 1)
  const value = sortedValues[index]
  if (value === undefined) throw new Error('モデル誤差のパーセンタイルを計算できません。')
  return value
}

export function calculateModelErrorSummary(
  observations: readonly ModelErrorObservation[],
): ModelErrorSummary {
  observations.forEach((observation, index) => {
    assertPositiveFinite(observation.predicted, `observations[${index}].predicted`)
    assertPositiveFinite(observation.observed, `observations[${index}].observed`)
  })

  if (observations.length < MINIMUM_MODEL_ERROR_SAMPLES) {
    return {
      status: 'pending',
      sampleCount: observations.length,
      minimumSampleCount: MINIMUM_MODEL_ERROR_SAMPLES,
    }
  }

  const signedErrors = observations.map(
    ({ predicted, observed }) => (predicted - observed) / observed,
  )
  const absoluteErrors = signedErrors.map(Math.abs).sort((left, right) => left - right)
  const mean = (values: readonly number[]) =>
    values.reduce((sum, value) => sum + value, 0) / values.length

  return {
    status: 'available',
    sampleCount: observations.length,
    minimumSampleCount: MINIMUM_MODEL_ERROR_SAMPLES,
    meanAbsolutePercentageError: mean(absoluteErrors),
    p90AbsolutePercentageError: nearestRankPercentile(absoluteErrors, 0.9),
    maximumAbsolutePercentageError: absoluteErrors.at(-1)!,
    meanSignedPercentageError: mean(signedErrors),
  }
}

export function summarizeDamageRegression(
  samples: readonly DamageRegressionSample[],
): ModelErrorSummary {
  const ids = new Set<string>()
  const observations = samples.map((sample, index) => {
    if (!sample.id.trim()) throw new Error(`回帰サンプル[${index}]のidを指定してください。`)
    if (ids.has(sample.id)) throw new Error(`回帰サンプルのid「${sample.id}」が重複しています。`)
    ids.add(sample.id)
    if (!sample.gameVersion.trim()) {
      throw new Error(`回帰サンプル「${sample.id}」のgameVersionを指定してください。`)
    }
    if (sample.build.weapon.observedDamagePerHit === undefined) {
      throw new Error(
        `回帰サンプル「${sample.id}」の武器にはobservedDamagePerHitを指定してください。`,
      )
    }
    assertPositiveFinite(sample.observedSingleTargetDps, `${sample.id}.observedSingleTargetDps`)
    return {
      predicted: evaluate(sample.build, sample.scenario).damage.singleTargetDps,
      observed: sample.observedSingleTargetDps,
    }
  })
  return calculateModelErrorSummary(observations)
}

export function calculatePredictionRange(
  predicted: number,
  summary: ModelErrorSummary,
): PredictionRange | undefined {
  assertPositiveFinite(predicted, 'predicted')
  if (summary.status === 'pending') return undefined
  return {
    lower: Math.max(0, predicted * (1 - summary.p90AbsolutePercentageError)),
    upper: predicted * (1 + summary.p90AbsolutePercentageError),
  }
}

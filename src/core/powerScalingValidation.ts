import type {
  PowerScalingValidationObservation,
  PowerScalingValidationSummary,
  PublishedDamage,
  WeaponId,
  WeaponPowerValidationSample,
} from './types'
import { median, nearestRankPercentile } from './statistics'

export const POWER_SCALING_EXACT_ERROR_TOLERANCE = 0.05
export const POWER_SCALING_RANGE_ERROR_TOLERANCE = 0.08

function assertPositiveFinite(value: number, field: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Power Scaling検証の${field}には0より大きい有限値を指定してください。`)
  }
}

function calculatePublishedError(
  predicted: number,
  published: PublishedDamage,
): { absoluteError: number; relativeError: number; withinPublishedRange: boolean } {
  if (published.kind === 'exact') {
    assertPositiveFinite(published.value, 'publishedDamage.value')
    const absoluteError = Math.abs(predicted - published.value)
    return {
      absoluteError,
      relativeError: absoluteError / published.value,
      withinPublishedRange: predicted === published.value,
    }
  }

  assertPositiveFinite(published.min, 'publishedDamage.min')
  assertPositiveFinite(published.max, 'publishedDamage.max')
  if (published.min > published.max) {
    throw new Error('Power Scaling検証のdamage rangeはmin <= maxにしてください。')
  }
  if (predicted < published.min) {
    const absoluteError = published.min - predicted
    return {
      absoluteError,
      relativeError: absoluteError / published.min,
      withinPublishedRange: false,
    }
  }
  if (predicted > published.max) {
    const absoluteError = predicted - published.max
    return {
      absoluteError,
      relativeError: absoluteError / published.max,
      withinPublishedRange: false,
    }
  }
  return { absoluteError: 0, relativeError: 0, withinPublishedRange: true }
}

export function evaluatePowerScalingSamples(
  samples: readonly WeaponPowerValidationSample[],
  predict: (weaponId: WeaponId, powerLevel: number) => number,
): readonly PowerScalingValidationObservation[] {
  const ids = new Set<string>()
  return samples.map((sample, index) => {
    if (!sample.id.trim()) throw new Error(`Power Scaling検証sample[${index}]のidが空です。`)
    if (ids.has(sample.id)) throw new Error(`Power Scaling検証sample id「${sample.id}」が重複しています。`)
    ids.add(sample.id)
    if (!Number.isInteger(sample.powerLevel) || sample.powerLevel <= 0) {
      throw new Error(`Power Scaling検証sample「${sample.id}」のPowerが不正です。`)
    }
    if (!sample.publishedGameVersion.trim()) {
      throw new Error(`Power Scaling検証sample「${sample.id}」のgame versionが空です。`)
    }
    const predicted = predict(sample.weaponId, sample.powerLevel)
    assertPositiveFinite(predicted, `${sample.id}.predicted`)
    const error = calculatePublishedError(predicted, sample.publishedDamage)
    return {
      sample,
      predicted,
      ...error,
      withinTolerance: error.relativeError <= (sample.publishedDamage.kind === 'exact'
        ? POWER_SCALING_EXACT_ERROR_TOLERANCE
        : POWER_SCALING_RANGE_ERROR_TOLERANCE),
    }
  })
}

export function summarizePowerScalingValidation(
  scope: WeaponId | 'overall',
  observations: readonly PowerScalingValidationObservation[],
): PowerScalingValidationSummary {
  const matching = scope === 'overall'
    ? observations
    : observations.filter((observation) => observation.sample.weaponId === scope)
  if (matching.length === 0) {
    throw new Error(`Power Scaling検証の${scope} sampleがありません。`)
  }
  const errors = matching.map((observation) => observation.relativeError)
  return {
    scope,
    sampleCount: matching.length,
    medianRelativeError: median(errors),
    p90RelativeError: nearestRankPercentile(errors, 0.9),
    maximumRelativeError: Math.max(...errors),
    withinToleranceCount: matching.filter((observation) => observation.withinTolerance).length,
  }
}

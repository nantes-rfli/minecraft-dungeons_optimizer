import { evaluate } from './evaluate'
import type {
  DamageRegressionSample,
  DamageRegressionScopeSummary,
  ModelErrorObservation,
  ModelErrorSummary,
  PredictionRange,
} from './types'
import { median, nearestRankPercentile } from './statistics'

export const MINIMUM_MODEL_ERROR_SAMPLES = 5

const GAME_VERSION_CONFIDENCE = ['verified', 'probable', 'unknown'] as const
const CONFIDENCE_LEVELS = ['high', 'medium', 'low'] as const
const MECHANIC_TAGS = [
  'plain-weapon',
  'critical-hit',
  'void-strike',
  'attack-speed-modified',
] as const

function assertPositiveFinite(value: number, field: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`モデル誤差の${field}には0より大きい有限値を指定してください。`)
  }
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
    medianAbsolutePercentageError: median(absoluteErrors),
    p90AbsolutePercentageError: nearestRankPercentile(absoluteErrors, 0.9),
    maximumAbsolutePercentageError: absoluteErrors.at(-1)!,
    meanSignedPercentageError: mean(signedErrors),
    medianSignedPercentageError: median(signedErrors),
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
    if (!sample.auditEntryId.trim()) {
      throw new Error(`回帰サンプル「${sample.id}」のauditEntryIdを指定してください。`)
    }
    if (!GAME_VERSION_CONFIDENCE.includes(sample.gameVersionConfidence)) {
      throw new Error(`回帰サンプル「${sample.id}」のgameVersionConfidenceが不正です。`)
    }
    if (!CONFIDENCE_LEVELS.includes(sample.sourceConfidence)) {
      throw new Error(`回帰サンプル「${sample.id}」のsourceConfidenceが不正です。`)
    }
    if (!sample.source.id.trim() || !sample.source.label.trim() || !sample.source.url) {
      throw new Error(`回帰サンプル「${sample.id}」の公開sourceを指定してください。`)
    }
    try {
      const sourceUrl = new URL(sample.source.url)
      if (!['http:', 'https:'].includes(sourceUrl.protocol)) throw new Error('invalid protocol')
    } catch {
      throw new Error(`回帰サンプル「${sample.id}」のsource URLが不正です。`)
    }
    if (!sample.measurement.note.trim()) {
      throw new Error(`回帰サンプル「${sample.id}」のmeasurement noteを指定してください。`)
    }
    if (sample.measurement.kind === 'total-damage-over-time') {
      assertPositiveFinite(sample.measurement.durationSeconds ?? 0, `${sample.id}.durationSeconds`)
      assertPositiveFinite(sample.measurement.totalDamage ?? 0, `${sample.id}.totalDamage`)
      const derivedDps = sample.measurement.totalDamage! / sample.measurement.durationSeconds!
      if (Math.abs(derivedDps - sample.observedSingleTargetDps) > Math.max(1e-9, derivedDps * 1e-9)) {
        throw new Error(`回帰サンプル「${sample.id}」のtotal damage / durationとobserved DPSが一致しません。`)
      }
    }
    if (sample.measurement.sampleCount !== undefined
      && (!Number.isInteger(sample.measurement.sampleCount) || sample.measurement.sampleCount <= 0)) {
      throw new Error(`回帰サンプル「${sample.id}」のsampleCountには正の整数を指定してください。`)
    }
    if (sample.mechanicTags.length === 0
      || sample.mechanicTags.some((tag) => !MECHANIC_TAGS.includes(tag))) {
      throw new Error(`回帰サンプル「${sample.id}」のmechanicTagsが不正です。`)
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

export function summarizeDamageRegressionByScope(
  samples: readonly DamageRegressionSample[],
): DamageRegressionScopeSummary {
  const byWeapon = {
    'fighters-bindings': summarizeDamageRegression(
      samples.filter((sample) => sample.build.weapon.weaponId === 'fighters-bindings'),
    ),
    'double-axe': summarizeDamageRegression(
      samples.filter((sample) => sample.build.weapon.weaponId === 'double-axe'),
    ),
    'soul-scythe': summarizeDamageRegression(
      samples.filter((sample) => sample.build.weapon.weaponId === 'soul-scythe'),
    ),
    anchor: summarizeDamageRegression(
      samples.filter((sample) => sample.build.weapon.weaponId === 'anchor'),
    ),
  }
  const byMechanic = Object.fromEntries(MECHANIC_TAGS.map((tag) => [
    tag,
    summarizeDamageRegression(samples.filter((sample) => sample.mechanicTags.includes(tag))),
  ])) as unknown as DamageRegressionScopeSummary['byMechanic']
  return {
    overall: summarizeDamageRegression(samples),
    finalVersionOnly: summarizeDamageRegression(samples.filter(
      (sample) => sample.gameVersion === '1.17.0.0'
        && sample.gameVersionConfidence === 'verified',
    )),
    byWeapon,
    byMechanic,
  }
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

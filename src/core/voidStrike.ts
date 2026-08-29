import type {
  FrameMeasuredVoidStrikeCurve,
  VoidStrikeCurve,
  VoidStrikeCurvePoint,
} from './types'

const MINIMUM_MULTIPLIER_SAMPLES = 5

function assertFinite(value: number, field: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`Void Strike Curveの${field}には有限値を指定してください。`)
  }
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  const upper = sorted[middle]
  if (upper === undefined) throw new Error('Void Strike Curveの計測サンプルがありません。')
  if (sorted.length % 2 === 1) return upper
  const lower = sorted[middle - 1]
  if (lower === undefined) throw new Error('Void Strike Curveの中央値を計算できません。')
  return (lower + upper) / 2
}

function resolveMeasuredPoints(
  curve: FrameMeasuredVoidStrikeCurve,
  maximumMultiplier: number,
): VoidStrikeCurvePoint[] {
  return curve.points.map((point, pointIndex) => {
    assertFinite(point.elapsedSeconds, `points[${pointIndex}].elapsedSeconds`)
    if (point.multiplierSamples.length < MINIMUM_MULTIPLIER_SAMPLES) {
      throw new Error(
        `Void Strike Curveのpoints[${pointIndex}].multiplierSamplesには計測値を${MINIMUM_MULTIPLIER_SAMPLES}件以上指定してください。`,
      )
    }
    point.multiplierSamples.forEach((sample, sampleIndex) => {
      assertFinite(sample, `points[${pointIndex}].multiplierSamples[${sampleIndex}]`)
      if (sample < 1 || sample > maximumMultiplier) {
        throw new Error(
          `Void Strike Curveのpoints[${pointIndex}].multiplierSamples[${sampleIndex}]は1以上${maximumMultiplier}以下にしてください。`,
        )
      }
    })
    return { elapsedSeconds: point.elapsedSeconds, multiplier: median(point.multiplierSamples) }
  })
}

function validatePoints(
  points: readonly VoidStrikeCurvePoint[],
  maximumMultiplier: number,
  applicationHitMultiplier: number,
  armedMinimumMultiplier: number,
  expiresAfterSeconds?: number,
): void {
  assertFinite(maximumMultiplier, 'maximumMultiplier')
  assertFinite(applicationHitMultiplier, 'applicationHitMultiplier')
  assertFinite(armedMinimumMultiplier, 'armedMinimumMultiplier')
  if (maximumMultiplier < 1) {
    throw new Error('Void Strike CurveのmaximumMultiplierは1以上にしてください。')
  }
  if (applicationHitMultiplier !== 1) {
    throw new Error('Void Strike CurveのapplicationHitMultiplierは1にしてください。')
  }
  if (armedMinimumMultiplier < applicationHitMultiplier
    || armedMinimumMultiplier > maximumMultiplier) {
    throw new Error(
      'Void Strike CurveのarmedMinimumMultiplierはapplication hit以上、maximum以下にしてください。',
    )
  }
  if (points.length < 2) {
    throw new Error('Void Strike Curveのpointsには2点以上指定してください。')
  }
  points.forEach((point, index) => {
    assertFinite(point.elapsedSeconds, `points[${index}].elapsedSeconds`)
    assertFinite(point.multiplier, `points[${index}].multiplier`)
    if (point.elapsedSeconds < 0) {
      throw new Error(`Void Strike Curveのpoints[${index}].elapsedSecondsは0以上にしてください。`)
    }
    if (point.multiplier < 1 || point.multiplier > maximumMultiplier) {
      throw new Error(
        `Void Strike Curveのpoints[${index}].multiplierは1以上${maximumMultiplier}以下にしてください。`,
      )
    }
    const previous = points[index - 1]
    if (previous && previous.elapsedSeconds >= point.elapsedSeconds) {
      throw new Error('Void Strike Curveのpointsは経過時間の昇順で重複なく指定してください。')
    }
    if (previous && previous.multiplier > point.multiplier) {
      throw new Error('Void Strike Curveのmultiplierは時間とともに減少しない値を指定してください。')
    }
  })
  if (points[0]?.elapsedSeconds !== 0) {
    throw new Error('Void Strike Curveの最初の点はelapsedSeconds: 0にしてください。')
  }
  if (points[0]?.multiplier !== armedMinimumMultiplier) {
    throw new Error(
      'Void Strike Curveの最初の点はarmedMinimumMultiplierと一致させてください。',
    )
  }
  if (expiresAfterSeconds !== undefined) {
    assertFinite(expiresAfterSeconds, 'expiresAfterSeconds')
    const lastElapsed = points.at(-1)?.elapsedSeconds ?? 0
    if (expiresAfterSeconds <= lastElapsed) {
      throw new Error('Void Strike CurveのexpiresAfterSecondsは最後の計測時刻より後にしてください。')
    }
  }
}

export function calculateVoidStrikeMultiplier(
  curve: VoidStrikeCurve,
  elapsedSeconds: number,
  maximumMultiplier: number,
): number {
  assertFinite(elapsedSeconds, 'elapsedSeconds')
  if (elapsedSeconds < 0) {
    throw new Error('Void Strike CurveのelapsedSecondsは0以上にしてください。')
  }
  const referencePoints = curve.method === 'frame-measured'
    ? resolveMeasuredPoints(curve, curve.referenceMaximumMultiplier)
    : curve.points
  validatePoints(
    referencePoints,
    curve.referenceMaximumMultiplier,
    curve.applicationHitMultiplier,
    curve.armedMinimumMultiplier,
    curve.expiresAfterSeconds,
  )
  assertFinite(maximumMultiplier, 'maximumMultiplier')
  if (maximumMultiplier < curve.armedMinimumMultiplier) {
    throw new Error(
      'Void Strike Curveのtier maximumはarmedMinimumMultiplier以上にしてください。',
    )
  }

  if (curve.expiresAfterSeconds !== undefined && elapsedSeconds >= curve.expiresAfterSeconds) {
    return curve.applicationHitMultiplier
  }
  if (elapsedSeconds === 0) return curve.applicationHitMultiplier
  const first = referencePoints[0]!
  let referenceMultiplier: number
  if (elapsedSeconds <= first.elapsedSeconds) {
    referenceMultiplier = first.multiplier
  } else {
    const upperIndex = referencePoints.findIndex((point) => point.elapsedSeconds >= elapsedSeconds)
    if (upperIndex === -1) {
      referenceMultiplier = referencePoints.at(-1)!.multiplier
    } else {
      const upper = referencePoints[upperIndex]!
      const lower = referencePoints[upperIndex - 1]!
      const progress = (elapsedSeconds - lower.elapsedSeconds) /
        (upper.elapsedSeconds - lower.elapsedSeconds)
      referenceMultiplier = lower.multiplier + (upper.multiplier - lower.multiplier) * progress
    }
  }
  const referenceRamp = curve.referenceMaximumMultiplier - curve.armedMinimumMultiplier
  const tierRamp = maximumMultiplier - curve.armedMinimumMultiplier
  if (referenceRamp === 0) return curve.armedMinimumMultiplier
  return curve.armedMinimumMultiplier +
    (referenceMultiplier - curve.armedMinimumMultiplier) * tierRamp / referenceRamp
}

export function calculateAverageVoidStrikeMultiplier(
  curve: VoidStrikeCurve,
  hitIntervalSequence: readonly number[],
  encounterDurationSeconds: number,
  attackSpeedMultiplier: number,
  maximumMultiplier: number,
): number {
  assertFinite(encounterDurationSeconds, 'encounterDurationSeconds')
  assertFinite(attackSpeedMultiplier, 'attackSpeedMultiplier')
  if (encounterDurationSeconds <= 0) {
    throw new Error('Void StrikeのencounterDurationSecondsは0より大きくしてください。')
  }
  if (attackSpeedMultiplier <= 0) {
    throw new Error('Void StrikeのattackSpeedMultiplierは0より大きくしてください。')
  }
  if (hitIntervalSequence.length === 0) {
    throw new Error('Void StrikeのhitIntervalSequenceには1件以上指定してください。')
  }
  hitIntervalSequence.forEach((interval, index) => {
    assertFinite(interval, `hitIntervalSequence[${index}]`)
    if (interval <= 0) {
      throw new Error(`Void StrikeのhitIntervalSequence[${index}]は0より大きくしてください。`)
    }
  })

  let hitCount = 1
  let multiplierSum = calculateVoidStrikeMultiplier(curve, 0, maximumMultiplier)
  let elapsed = 0
  let intervalIndex = 0
  while (true) {
    const interval = hitIntervalSequence[intervalIndex]! / attackSpeedMultiplier
    elapsed += interval
    if (elapsed >= encounterDurationSeconds) break
    multiplierSum += calculateVoidStrikeMultiplier(curve, interval, maximumMultiplier)
    hitCount += 1
    intervalIndex = (intervalIndex + 1) % hitIntervalSequence.length
  }
  return multiplierSum / hitCount
}

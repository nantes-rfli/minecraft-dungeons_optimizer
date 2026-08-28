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
  expiresAfterSeconds?: number,
): void {
  assertFinite(maximumMultiplier, 'maximumMultiplier')
  if (maximumMultiplier < 1) {
    throw new Error('Void Strike CurveのmaximumMultiplierは1以上にしてください。')
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
  const points = curve.method === 'frame-measured'
    ? resolveMeasuredPoints(curve, maximumMultiplier)
    : curve.points
  validatePoints(points, maximumMultiplier, curve.expiresAfterSeconds)

  if (curve.expiresAfterSeconds !== undefined && elapsedSeconds >= curve.expiresAfterSeconds) {
    return 1
  }
  const first = points[0]!
  if (elapsedSeconds <= first.elapsedSeconds) return first.multiplier
  const upperIndex = points.findIndex((point) => point.elapsedSeconds >= elapsedSeconds)
  if (upperIndex === -1) return points.at(-1)!.multiplier
  const upper = points[upperIndex]!
  const lower = points[upperIndex - 1]!
  const progress = (elapsedSeconds - lower.elapsedSeconds) /
    (upper.elapsedSeconds - lower.elapsedSeconds)
  return lower.multiplier + (upper.multiplier - lower.multiplier) * progress
}

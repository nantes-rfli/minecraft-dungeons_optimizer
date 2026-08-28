import type { AttackProfile, FrameMeasuredAttackProfile } from './types'

const MINIMUM_FRAME_SAMPLES = 5

function assertPositiveFinite(value: number, field: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Attack Profileの${field}は0より大きい有限値にしてください。`)
  }
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  const upper = sorted[middle]
  if (upper === undefined) throw new Error('Attack Profileの計測サンプルがありません。')
  if (sorted.length % 2 === 1) return upper
  const lower = sorted[middle - 1]
  if (lower === undefined) throw new Error('Attack Profileの中央値を計算できません。')
  return (lower + upper) / 2
}

function calculateFrameMeasuredRate(profile: FrameMeasuredAttackProfile): number {
  assertPositiveFinite(profile.hitsPerCombo, 'hitsPerCombo')
  assertPositiveFinite(profile.framesPerSecond, 'framesPerSecond')
  if (profile.comboFrameSamples.length < MINIMUM_FRAME_SAMPLES) {
    throw new Error(
      `Attack ProfileのcomboFrameSamplesには計測値を${MINIMUM_FRAME_SAMPLES}件以上指定してください。`,
    )
  }
  profile.comboFrameSamples.forEach((frames, index) =>
    assertPositiveFinite(frames, `comboFrameSamples[${index}]`),
  )
  const medianFrames = median(profile.comboFrameSamples)
  return (profile.hitsPerCombo * profile.framesPerSecond) / medianFrames
}

export function calculateBaseHitsPerSecond(profile: AttackProfile): number {
  if (profile.method === 'speed-rating-proxy') {
    assertPositiveFinite(profile.hitsPerSecond, 'hitsPerSecond')
    return profile.hitsPerSecond
  }
  return calculateFrameMeasuredRate(profile)
}

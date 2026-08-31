import { OptimizerInputError } from './errors'

function finiteRange(value: number, minimum: number, maximum = Number.MAX_VALUE): void {
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    throw new OptimizerInputError('INVALID_SCENARIO', '効果coverageの間隔・速度・時間・確率は範囲内の有限値を指定してください。')
  }
}

function cadence(intervals: readonly number[], speed: number, encounter: number, duration: number) {
  finiteRange(speed, Number.MIN_VALUE)
  finiteRange(encounter, Number.MIN_VALUE)
  finiteRange(duration, 0)
  if (intervals.length === 0) throw new OptimizerInputError('INVALID_SCENARIO', '効果coverageには空でないhit間隔列が必要です。')
  const scaled = intervals.map((interval) => {
    finiteRange(interval, Number.MIN_VALUE)
    const value = interval / speed
    finiteRange(value, Number.MIN_VALUE)
    return value
  })
  const cycle = scaled.reduce((sum, interval) => sum + interval, 0)
  finiteRange(cycle, Number.MIN_VALUE)
  finiteRange(encounter / cycle, 0, Number.MAX_SAFE_INTEGER / intervals.length)
  return { scaled, cycle }
}

/** Guaranteed refresh; first hit at zero, tail clipped. Shared with Fire Aspect. */
export function finiteRefreshCoverage(intervals: readonly number[], speed: number, encounterSeconds: number, durationSeconds: number): number {
  const { scaled, cycle } = cadence(intervals, speed, encounterSeconds, durationSeconds)
  const coveredCycle = scaled.reduce((sum, interval) => sum + Math.min(interval, durationSeconds), 0)
  const cycles = Math.floor(encounterSeconds / cycle)
  let remaining = Math.max(0, encounterSeconds - cycles * cycle)
  let covered = cycles * coveredCycle
  for (const interval of scaled) {
    covered += Math.min(remaining, interval, durationSeconds)
    remaining = Math.max(0, remaining - interval)
  }
  return Math.min(1, covered / encounterSeconds)
}

export interface RefreshCoverageInput {
  readonly hitIntervalSequence: readonly number[]
  readonly attackSpeedMultiplier: number
  readonly encounterDurationSeconds: number
  readonly triggerChance: number
  readonly durationSeconds: number
}

/** Integrate P(active)=1-(1-p)^n(t), where n(t) counts eligible hits in the
 * trailing duration window. Initial cycles use a geometric sum; after duration
 * the window is periodic. Work depends on profile length, never encounter hits.
 * Exact expectation under the declared cadence/refresh model, not game validation. */
export function calculateRefreshEffectCoverage(input: RefreshCoverageInput): number {
  const { hitIntervalSequence, attackSpeedMultiplier, encounterDurationSeconds: encounter, triggerChance: p, durationSeconds: duration } = input
  finiteRange(p, 0, 1)
  const { scaled, cycle } = cadence(hitIntervalSequence, attackSpeedMultiplier, encounter, duration)
  if (p === 0 || duration === 0) return 0
  if (p === 1) return finiteRefreshCoverage(hitIntervalSequence, attackSpeedMultiplier, encounter, duration)

  const logFailure = Math.log1p(-p)
  const count = scaled.length
  const phases: number[] = []
  let phase = 0
  for (const interval of scaled) {
    phases.push(phase)
    phase += interval
  }

  // Before the first expiry, no hit can have fallen out of the window.
  const startup = Math.min(duration, encounter)
  const initialCycles = Math.floor(startup / cycle)
  const initialTail = Math.max(0, startup - initialCycles * cycle)
  const failureCycle = scaled.reduce((sum, interval, i) => sum + interval * Math.exp((i + 1) * logFailure), 0)
  const geometric = -Math.expm1(initialCycles * count * logFailure) / -Math.expm1(count * logFailure)
  const failureTail = scaled.reduce((sum, interval, i) =>
    sum + Math.max(0, Math.min(interval, initialTail - phases[i]!)) * Math.exp((initialCycles * count + i + 1) * logFailure), 0)
  let coveredFraction = startup / encounter - (failureCycle / encounter) * geometric - failureTail / encounter

  if (encounter > duration) {
    const fullWindowCycles = Math.floor(duration / cycle)
    const windowTail = Math.max(0, duration - fullWindowCycles * cycle)
    const modulo = (value: number) => ((value % cycle) + cycle) % cycle
    // Only hit phases and expiry phases can change the steady window count.
    const boundaries = [...new Set([0, cycle, ...phases, ...phases.map((s) => modulo(s + windowTail))])].sort((a, b) => a - b)
    const segments = boundaries.slice(0, -1).map((start, i) => {
      const end = boundaries[i + 1]!
      const middle = (start + end) / 2
      const tailHits = phases.filter((s) => modulo(middle - s) < windowTail).length
      return { start, end, coverage: -Math.expm1((fullWindowCycles * count + tailHits) * logFailure) }
    })
    const steadyIntegral = (seconds: number): number => {
      const cycles = Math.floor(seconds / cycle)
      const tail = Math.max(0, seconds - cycles * cycle)
      return segments.reduce((sum, s) => sum + s.coverage *
        (cycles * ((s.end - s.start) / encounter) + Math.max(0, Math.min(s.end, tail) - s.start) / encounter), 0)
    }
    coveredFraction += steadyIntegral(encounter) - steadyIntegral(duration)
  }
  finiteRange(coveredFraction, -1e-12, 1 + 1e-12)
  return Math.max(0, Math.min(1, coveredFraction))
}

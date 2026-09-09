export type ObservationKind = 'aggregate-rate' | 'event-sequence' | 'attack-definition'
export type EventKind = 'action' | 'damage-hit' | 'proc-opportunity' | 'release'

export interface AggregateRateObservation {
  kind: 'aggregate-rate'
  ratePerSecond: number
  metric: 'reported-average-hps' | 'damage-hits-per-second' | 'proc-opportunities-per-second'
  conditions: Record<string, string | number | boolean | null>
}
export interface AttackEvent {
  offsetSeconds: number
  kind: EventKind
  variant: string
}
export interface EventSequenceObservation {
  kind: 'event-sequence'
  cycleSeconds: number
  events: AttackEvent[]
  conditions: Record<string, string | number | boolean | null>
}
export interface AttackDefinitionObservation {
  kind: 'attack-definition'
  variants: { name: string; durationSeconds: number; damageDelaySeconds: number; continuousDamageIntervalSeconds: number | null; loopAmount: number; triggersAfterDamage: boolean; triggersOnRelease: boolean }[]
  unresolvedPlaybackRules: string[]
}
export type AttackObservation = AggregateRateObservation | EventSequenceObservation | AttackDefinitionObservation

function positive(value: number, field: string): void {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`Attack/event comparison: ${field} must be positive and finite`)
}

export function validateAttackObservation(observation: AttackObservation): void {
  if (observation.kind === 'aggregate-rate') {
    positive(observation.ratePerSecond, 'ratePerSecond')
    if (!Object.keys(observation.conditions).length) throw new Error('Attack/event comparison: aggregate conditions are required')
    return
  }
  if (observation.kind === 'event-sequence') {
    positive(observation.cycleSeconds, 'cycleSeconds')
    if (!observation.events.length) throw new Error('Attack/event comparison: event sequence is empty')
    let previous = -1
    for (const event of observation.events) {
      if (!Number.isFinite(event.offsetSeconds) || event.offsetSeconds < 0 || event.offsetSeconds >= observation.cycleSeconds || event.offsetSeconds < previous) throw new Error('Attack/event comparison: invalid event order/range')
      if (!event.variant.trim()) throw new Error('Attack/event comparison: event variant is required')
      previous = event.offsetSeconds
    }
    return
  }
  if (!observation.variants.length || !observation.unresolvedPlaybackRules.length) throw new Error('Attack/event comparison: definition requires variants and unresolved playback rules')
  for (const variant of observation.variants) {
    positive(variant.durationSeconds, 'durationSeconds')
    if (!Number.isFinite(variant.damageDelaySeconds) || variant.damageDelaySeconds < 0 || variant.damageDelaySeconds > variant.durationSeconds) throw new Error('Attack/event comparison: invalid damage delay')
    if (variant.continuousDamageIntervalSeconds !== null) positive(variant.continuousDamageIntervalSeconds, 'continuousDamageIntervalSeconds')
    if (!Number.isInteger(variant.loopAmount) || variant.loopAmount < 1) throw new Error('Attack/event comparison: invalid loop amount')
  }
}

/** Aggregate observations deliberately have no event synthesis path. */
export function countEvents(observation: AttackObservation, kind: EventKind): number {
  validateAttackObservation(observation)
  if (observation.kind !== 'event-sequence') throw new Error(`Attack/event comparison: ${observation.kind} cannot provide event counts`)
  return observation.events.filter((event) => event.kind === kind).length
}

export function eventRate(observation: EventSequenceObservation, kind: EventKind): number {
  return countEvents(observation, kind) / observation.cycleSeconds
}

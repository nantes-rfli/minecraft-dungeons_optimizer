/** Phase 6.9F research model. Runtime code must not import this module. */
export type EventOwnership = 'direct-melee' | 'indirect' | 'artifact'

export interface FiniteEnemy {
  readonly id: string
  readonly maxHealth: number
  readonly spawnTimeSeconds: number
}

export interface FiniteDamageEvent {
  readonly timeSeconds: number
  readonly targetId: string
  readonly actionId: string
  readonly componentId: string
  readonly sourceEffect: string
  readonly damage: number
  readonly ownership: EventOwnership | null
  readonly controlTargetSeconds?: number
}

export interface FiniteScenario {
  readonly id: string
  readonly durationSeconds: number
  readonly enemies: readonly FiniteEnemy[]
  readonly hero: {
    readonly maxHealth: number
    readonly initialHealth: number
    readonly incomingDamageEvents: readonly { readonly timeSeconds: number; readonly damage: number }[]
  }
}

export interface FiniteCandidate {
  readonly id: string
  readonly modelRevision: string
  readonly events: readonly FiniteDamageEvent[]
  readonly directKillHealingFraction: number
  readonly incomingDamageMultiplier: number
  readonly unresolvedMechanics: readonly string[]
}

export interface FiniteMetrics {
  readonly effectiveDamage: number
  readonly overkillDamage: number
  readonly kills: number
  readonly directOwnedKills: number
  readonly indirectOwnedKills: number
  readonly artifactOwnedKills: number
  readonly actualHealing: number
  readonly damageTaken: number
  readonly controlTargetSeconds: number
}

export type ObjectiveMetric = 'effectiveDamage' | 'kills' | 'actualHealing' | 'damageAvoided' | 'control'
export interface ObjectivePolicy {
  readonly revision: string
  readonly weights: Readonly<Record<ObjectiveMetric, number>>
  readonly targets: Readonly<Record<Exclude<ObjectiveMetric, 'damageAvoided'>, number>>
}

export type CandidateEvaluation =
  | { readonly status: 'ranked'; readonly candidateId: string; readonly comparisonKey: string; readonly score: number; readonly utilities: Readonly<Record<ObjectiveMetric, number>>; readonly metrics: FiniteMetrics }
  | { readonly status: 'excluded'; readonly candidateId: string; readonly reasons: readonly string[] }

function finiteNonNegative(value: number, field: string): void {
  if (!Number.isFinite(value) || value < 0) throw new Error(`6.9F ${field}: expected non-negative finite value`)
}

function positive(value: number, field: string): void {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`6.9F ${field}: expected positive finite value`)
}

function validateScenario(scenario: FiniteScenario): void {
  if (!scenario.id.trim()) throw new Error('6.9F scenario: id is required')
  positive(scenario.durationSeconds, 'scenario duration')
  positive(scenario.hero.maxHealth, 'hero max health')
  positive(scenario.hero.initialHealth, 'hero initial health')
  if (scenario.hero.initialHealth > scenario.hero.maxHealth) throw new Error('6.9F hero initial health exceeds maximum')
  if (!scenario.enemies.length) throw new Error('6.9F scenario: enemies are required')
  const ids = new Set<string>()
  for (const enemy of scenario.enemies) {
    if (!enemy.id.trim() || ids.has(enemy.id)) throw new Error('6.9F scenario: enemy ids must be unique and non-empty')
    ids.add(enemy.id)
    positive(enemy.maxHealth, 'enemy max health')
    finiteNonNegative(enemy.spawnTimeSeconds, 'enemy spawn time')
    if (enemy.spawnTimeSeconds > scenario.durationSeconds) throw new Error('6.9F scenario: enemy spawns after encounter')
  }
  for (const event of scenario.hero.incomingDamageEvents) {
    finiteNonNegative(event.timeSeconds, 'incoming damage time')
    finiteNonNegative(event.damage, 'incoming damage')
    if (event.timeSeconds > scenario.durationSeconds) throw new Error('6.9F scenario: incoming damage occurs after encounter')
  }
}

function validateCandidate(candidate: FiniteCandidate, scenario: FiniteScenario): void {
  if (!candidate.id.trim() || !candidate.modelRevision.trim()) throw new Error('6.9F candidate: id and model revision are required')
  if (candidate.directKillHealingFraction < 0 || candidate.directKillHealingFraction > 1 || !Number.isFinite(candidate.directKillHealingFraction)) throw new Error('6.9F direct kill healing fraction: expected [0, 1]')
  if (candidate.incomingDamageMultiplier < 0 || candidate.incomingDamageMultiplier > 1 || !Number.isFinite(candidate.incomingDamageMultiplier)) throw new Error('6.9F incoming damage multiplier: expected [0, 1]')
  const enemyIds = new Set(scenario.enemies.map((enemy) => enemy.id))
  for (const event of candidate.events) {
    finiteNonNegative(event.timeSeconds, 'damage event time')
    positive(event.damage, 'damage event damage')
    finiteNonNegative(event.controlTargetSeconds ?? 0, 'control target seconds')
    if (!enemyIds.has(event.targetId)) throw new Error(`6.9F candidate: unknown target ${event.targetId}`)
    if (![event.actionId, event.componentId, event.sourceEffect].every((value) => value.trim())) throw new Error('6.9F candidate: event provenance is required')
  }
  if (new Set(candidate.unresolvedMechanics).size !== candidate.unresolvedMechanics.length || candidate.unresolvedMechanics.some((reason) => !reason.trim())) throw new Error('6.9F candidate: unresolved mechanic reasons must be unique and non-empty')
}

/**
 * Incoming damage is resolved before candidate events at the same timestamp. This is an
 * explicit deterministic convention, not a claim about the game's frame ordering.
 */
export function simulateFiniteCandidate(candidate: FiniteCandidate, scenario: FiniteScenario): CandidateEvaluation {
  validateScenario(scenario)
  validateCandidate(candidate, scenario)
  if (candidate.unresolvedMechanics.length) return { status: 'excluded', candidateId: candidate.id, reasons: [...candidate.unresolvedMechanics] }

  const health = new Map(scenario.enemies.map((enemy) => [enemy.id, enemy.maxHealth]))
  const enemies = new Map(scenario.enemies.map((enemy) => [enemy.id, enemy]))
  const timeline = [
    ...scenario.hero.incomingDamageEvents.map((event, index) => ({ kind: 'incoming' as const, index, ...event })),
    ...candidate.events.filter((event) => event.timeSeconds <= scenario.durationSeconds).map((event, index) => ({ kind: 'candidate' as const, index, ...event })),
  ].sort((left, right) => left.timeSeconds - right.timeSeconds || (left.kind === right.kind ? left.index - right.index : left.kind === 'incoming' ? -1 : 1))

  let heroHealth = scenario.hero.initialHealth
  let effectiveDamage = 0
  let overkillDamage = 0
  let kills = 0
  let directOwnedKills = 0
  let indirectOwnedKills = 0
  let artifactOwnedKills = 0
  let actualHealing = 0
  let damageTaken = 0
  let controlTargetSeconds = 0

  for (const event of timeline) {
    if (event.kind === 'incoming') {
      const received = Math.min(heroHealth, event.damage * candidate.incomingDamageMultiplier)
      heroHealth -= received
      damageTaken += received
      if (heroHealth === 0) break
      continue
    }
    const enemy = enemies.get(event.targetId)!
    if (event.timeSeconds < enemy.spawnTimeSeconds) throw new Error(`6.9F candidate: target ${event.targetId} has not spawned`)
    const before = health.get(event.targetId)!
    if (before <= 0) {
      overkillDamage += event.damage
      continue
    }
    const applied = Math.min(before, event.damage)
    const after = before - applied
    health.set(event.targetId, after)
    effectiveDamage += applied
    overkillDamage += event.damage - applied
    controlTargetSeconds += Math.min(event.controlTargetSeconds ?? 0, scenario.durationSeconds - event.timeSeconds)
    if (after > 0) continue
    if (event.ownership === null) return { status: 'excluded', candidateId: candidate.id, reasons: [`unresolved final-blow ownership: ${event.actionId}/${event.componentId}`] }
    kills += 1
    if (event.ownership === 'direct-melee') {
      directOwnedKills += 1
      const capacity = enemy.maxHealth * candidate.directKillHealingFraction
      const healed = Math.min(scenario.hero.maxHealth - heroHealth, capacity)
      heroHealth += healed
      actualHealing += healed
    } else if (event.ownership === 'indirect') indirectOwnedKills += 1
    else artifactOwnedKills += 1
  }

  const metrics = { effectiveDamage, overkillDamage, kills, directOwnedKills, indirectOwnedKills, artifactOwnedKills, actualHealing, damageTaken, controlTargetSeconds }
  return { status: 'ranked', candidateId: candidate.id, comparisonKey: `${candidate.modelRevision}|${scenario.id}`, score: 0, utilities: { effectiveDamage: 0, kills: 0, actualHealing: 0, damageAvoided: 0, control: 0 }, metrics }
}

function validatePolicy(policy: ObjectivePolicy): void {
  if (!policy.revision.trim()) throw new Error('6.9F objective revision is required')
  for (const [metric, weight] of Object.entries(policy.weights)) finiteNonNegative(weight, `objective weight ${metric}`)
  if (Object.values(policy.weights).reduce((sum, value) => sum + value, 0) <= 0) throw new Error('6.9F objective weights: at least one must be positive')
  for (const [metric, target] of Object.entries(policy.targets)) positive(target, `objective target ${metric}`)
}

export function rankFiniteCandidates(candidates: readonly FiniteCandidate[], scenario: FiniteScenario, policy: ObjectivePolicy): CandidateEvaluation[] {
  validatePolicy(policy)
  if (!candidates.length) throw new Error('6.9F optimizer: candidates are required')
  if (new Set(candidates.map((candidate) => candidate.id)).size !== candidates.length) throw new Error('6.9F optimizer: duplicate candidate id')
  if (new Set(candidates.map((candidate) => candidate.modelRevision)).size > 1) throw new Error('6.9F optimizer: mixed model revisions')
  const weightTotal = Object.values(policy.weights).reduce((sum, value) => sum + value, 0)
  return candidates.map((candidate): CandidateEvaluation => {
    const evaluation = simulateFiniteCandidate(candidate, scenario)
    if (evaluation.status === 'excluded') return evaluation
    const { metrics } = evaluation
    const utilities = {
      effectiveDamage: Math.min(1, metrics.effectiveDamage / policy.targets.effectiveDamage),
      kills: Math.min(1, metrics.kills / policy.targets.kills),
      actualHealing: Math.min(1, metrics.actualHealing / policy.targets.actualHealing),
      damageAvoided: scenario.hero.incomingDamageEvents.length === 0 ? 0 : 1 - candidate.incomingDamageMultiplier,
      control: Math.min(1, metrics.controlTargetSeconds / policy.targets.control),
    }
    const score = 100 * Object.entries(policy.weights).reduce((sum, [metric, weight]) => sum + utilities[metric as ObjectiveMetric] * weight, 0) / weightTotal
    return { ...evaluation, comparisonKey: `${evaluation.comparisonKey}|${policy.revision}`, score, utilities }
  }).sort((left, right) => {
    if (left.status !== right.status) return left.status === 'ranked' ? -1 : 1
    if (left.status === 'ranked' && right.status === 'ranked' && left.score !== right.score) return right.score - left.score
    return left.candidateId.localeCompare(right.candidateId, 'en')
  })
}

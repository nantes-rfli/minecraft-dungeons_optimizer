import { resolveDefenseState, type DefenseEffectId } from './drModifierComparison.ts'

export type LimitedDrDecision = 'adopt' | 'hold' | 'reject'
export type LimitedDrConditionId = 'baseline' | 'armor-35' | 'iron-hide' | 'guarding-strike' | 'armor-iron' | 'armor-guarding' | 'iron-guarding' | 'armor-iron-guarding'

export interface LimitedDrAcceptancePlan {
  readonly frozenAt: string
  readonly gameVersion: '1.17.0.0'
  readonly damageChannel: 'direct-mob-attack'
  readonly requiredConditions: readonly LimitedDrConditionId[]
  readonly minimumIndependentRunsPerCondition: number
  readonly minimumHitsPerRun: number
  readonly maximumMeanAbsoluteFractionError: number
  readonly maximumPerHitRawDamageError: number
  readonly rankingComparatorDamageTaken: number
}

export interface LimitedDrRun {
  readonly id: string
  readonly condition: LimitedDrConditionId
  readonly partition: 'calibration' | 'holdout'
  readonly originGroup: string
  readonly gameVersion: string
  readonly damageChannel: string
  readonly incomingHitId: string
  readonly equipment: readonly { readonly id: string; readonly power: number }[]
  readonly activationFrameLocators: readonly string[]
  readonly rawTraceLocator: string
  readonly baselineDamage: number
  readonly observedDamage: readonly number[]
}

export interface LimitedDrReferenceRow {
  readonly id: string
  readonly condition: LimitedDrConditionId
  readonly baselineDamage: number
  readonly observedDamage: number
  readonly exclusionReasons: readonly string[]
}

export interface LimitedDrValidationInput {
  readonly plan: LimitedDrAcceptancePlan
  readonly calibrationOriginGroups: readonly string[]
  readonly runs: readonly LimitedDrRun[]
  readonly excludedReferenceRows: readonly LimitedDrReferenceRow[]
}

export const LIMITED_DR_ACCEPTANCE_PLAN: LimitedDrAcceptancePlan = {
  frozenAt: '2026-09-10T06:00:00+09:00',
  gameVersion: '1.17.0.0',
  damageChannel: 'direct-mob-attack',
  requiredConditions: ['baseline', 'armor-35', 'iron-hide', 'guarding-strike', 'armor-iron', 'armor-guarding', 'iron-guarding', 'armor-iron-guarding'],
  minimumIndependentRunsPerCondition: 3,
  minimumHitsPerRun: 10,
  maximumMeanAbsoluteFractionError: 0.005,
  maximumPerHitRawDamageError: 1,
  rankingComparatorDamageTaken: 0.18,
}

const CONDITION_EFFECTS: Readonly<Record<LimitedDrConditionId, readonly DefenseEffectId[]>> = {
  baseline: [],
  'armor-35': ['armor-35'],
  'iron-hide': ['iron-hide'],
  'guarding-strike': ['guarding-strike'],
  'armor-iron': ['armor-35', 'iron-hide'],
  'armor-guarding': ['armor-35', 'guarding-strike'],
  'iron-guarding': ['iron-hide', 'guarding-strike'],
  'armor-iron-guarding': ['armor-35', 'iron-hide', 'guarding-strike'],
}

const required: (condition: unknown, message: string) => asserts condition = (condition, message) => {
  if (!condition) throw new Error(`Phase 8C: ${message}`)
}

export function proposedDamageTaken(condition: LimitedDrConditionId): number {
  return resolveDefenseState(CONDITION_EFFECTS[condition], 'direct-mob-attack')
}

export function legacyDamageTaken(condition: LimitedDrConditionId): number {
  return CONDITION_EFFECTS[condition].reduce((taken, effect) => taken * (1 - ({ 'armor-35': 0.35, 'iron-hide': 0.5, 'guarding-strike': 0.5 } as const)[effect as 'armor-35' | 'iron-hide' | 'guarding-strike']), 1)
}

function validatePlan(plan: LimitedDrAcceptancePlan): void {
  required(!Number.isNaN(Date.parse(plan.frozenAt)), 'acceptance plan needs a valid frozenAt timestamp')
  required(plan.requiredConditions.length === 8 && new Set(plan.requiredConditions).size === 8, 'all eight baseline/single/pair/triple conditions are required')
  required(plan.minimumIndependentRunsPerCondition >= 3, 'at least three independent runs per condition are required')
  required(plan.minimumHitsPerRun >= 10, 'at least ten hits per run are required')
  required(plan.maximumMeanAbsoluteFractionError > 0 && plan.maximumMeanAbsoluteFractionError < 1, 'invalid fraction-error tolerance')
  required(Number.isInteger(plan.maximumPerHitRawDamageError) && plan.maximumPerHitRawDamageError >= 0, 'invalid raw-damage tolerance')
  required(plan.rankingComparatorDamageTaken > 0 && plan.rankingComparatorDamageTaken < 1, 'invalid ranking comparator')
}

function validateRun(run: LimitedDrRun): void {
  required(run.id.trim() && run.originGroup.trim() && run.incomingHitId.trim() && run.rawTraceLocator.trim(), 'run identity, provenance and raw-trace locator are required')
  required(run.equipment.every((item) => item.id.trim() && Number.isFinite(item.power) && item.power >= 0), `invalid equipment identity or Power: ${run.id}`)
  required(run.condition === 'baseline' || (run.equipment.length > 0 && run.activationFrameLocators.length > 0 && run.activationFrameLocators.every((locator) => locator.trim())), `active condition needs equipment and activation frames: ${run.id}`)
  required(Number.isFinite(run.baselineDamage) && run.baselineDamage > 0, `invalid baseline damage: ${run.id}`)
  required(run.observedDamage.length > 0 && run.observedDamage.every((value) => Number.isFinite(value) && value >= 0), `invalid observations: ${run.id}`)
}

function compareRow(condition: LimitedDrConditionId, baselineDamage: number, observedDamage: number) {
  const observedDamageTaken = observedDamage / baselineDamage
  const proposed = proposedDamageTaken(condition)
  const legacy = legacyDamageTaken(condition)
  return {
    observedDamageTaken,
    proposedDamageTaken: proposed,
    legacyDamageTaken: legacy,
    proposedAbsoluteFractionError: Math.abs(observedDamageTaken - proposed),
    legacyAbsoluteFractionError: Math.abs(observedDamageTaken - legacy),
    proposedRawDamageError: Math.abs(observedDamage - baselineDamage * proposed),
    legacyRawDamageError: Math.abs(observedDamage - baselineDamage * legacy),
  }
}

export function evaluateLimitedDrValidation(input: LimitedDrValidationInput) {
  validatePlan(input.plan)
  const calibrationOrigins = new Set(input.calibrationOriginGroups)
  const ids = new Set<string>()
  for (const run of input.runs) {
    validateRun(run)
    required(!ids.has(run.id), `duplicate run: ${run.id}`)
    ids.add(run.id)
  }

  const eligibleRuns = input.runs.filter((run) => run.partition === 'holdout' && run.gameVersion === input.plan.gameVersion && run.damageChannel === input.plan.damageChannel && !calibrationOrigins.has(run.originGroup) && run.observedDamage.length >= input.plan.minimumHitsPerRun)
  const conditionCoverage = Object.fromEntries(input.plan.requiredConditions.map((condition) => {
    const rows = eligibleRuns.filter((run) => run.condition === condition)
    return [condition, { eligibleRuns: rows.length, eligibleHits: rows.reduce((sum, row) => sum + row.observedDamage.length, 0), pass: rows.length >= input.plan.minimumIndependentRunsPerCondition }]
  })) as Record<LimitedDrConditionId, { eligibleRuns: number; eligibleHits: number; pass: boolean }>
  const commonIncomingHit = new Set(eligibleRuns.map((run) => run.incomingHitId)).size <= 1
  const comparisons = eligibleRuns.flatMap((run) => run.observedDamage.map((observedDamage, hitIndex) => ({ runId: run.id, hitIndex, condition: run.condition, ...compareRow(run.condition, run.baselineDamage, observedDamage) })))
  const mean = (values: readonly number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null
  const proposedMeanAbsoluteFractionError = mean(comparisons.map((row) => row.proposedAbsoluteFractionError))
  const legacyMeanAbsoluteFractionError = mean(comparisons.map((row) => row.legacyAbsoluteFractionError))
  const proposedMaximumRawDamageError = comparisons.length ? Math.max(...comparisons.map((row) => row.proposedRawDamageError)) : null
  const proposedWithinTolerance = proposedMeanAbsoluteFractionError !== null && proposedMaximumRawDamageError !== null && proposedMeanAbsoluteFractionError <= input.plan.maximumMeanAbsoluteFractionError && proposedMaximumRawDamageError <= input.plan.maximumPerHitRawDamageError
  const proposedOutperformsLegacy = proposedMeanAbsoluteFractionError !== null && legacyMeanAbsoluteFractionError !== null && proposedMeanAbsoluteFractionError <= legacyMeanAbsoluteFractionError
  const coverageComplete = input.plan.requiredConditions.every((condition) => conditionCoverage[condition].pass) && commonIncomingHit
  const blockers = [
    ...input.plan.requiredConditions.filter((condition) => !conditionCoverage[condition].pass).map((condition) => `insufficient-independent-holdout:${condition}`),
    ...(!commonIncomingHit ? ['incoming-hit-not-common'] : []),
    ...(comparisons.length === 0 ? ['no-eligible-independent-raw-trace'] : []),
  ]
  const decision: LimitedDrDecision = !coverageComplete ? 'hold' : proposedWithinTolerance && proposedOutperformsLegacy ? 'adopt' : 'reject'
  const tripleProposed = proposedDamageTaken('armor-iron-guarding')
  const tripleLegacy = legacyDamageTaken('armor-iron-guarding')

  return {
    schemaVersion: 1,
    phase: '8C',
    scope: 'research-only',
    plan: input.plan,
    evidenceBoundary: {
      submittedRuns: input.runs.length,
      eligibleIndependentHoldoutRuns: eligibleRuns.length,
      calibrationOriginGroups: [...input.calibrationOriginGroups],
      sameOriginCalibrationIsHoldout: false,
      syntheticProbeCanVerify: false,
    },
    conditionCoverage,
    comparison: { eligibleHitCount: comparisons.length, proposedMeanAbsoluteFractionError, legacyMeanAbsoluteFractionError, proposedMaximumRawDamageError, proposedWithinTolerance, proposedOutperformsLegacy, rows: comparisons },
    excludedReferenceComparisons: input.excludedReferenceRows.map((row) => ({ ...row, ...compareRow(row.condition, row.baselineDamage, row.observedDamage) })),
    rankingSensitivity: {
      comparatorDamageTaken: input.plan.rankingComparatorDamageTaken,
      proposedTripleDamageTaken: tripleProposed,
      legacyTripleDamageTaken: tripleLegacy,
      proposedRank: tripleProposed < input.plan.rankingComparatorDamageTaken ? 'candidate-before-comparator' : 'candidate-after-comparator',
      legacyRank: tripleLegacy < input.plan.rankingComparatorDamageTaken ? 'candidate-before-comparator' : 'candidate-after-comparator',
      rankChanges: (tripleProposed < input.plan.rankingComparatorDamageTaken) !== (tripleLegacy < input.plan.rankingComparatorDamageTaken),
    },
    reproducibility: { commonIncomingHit, measurementRunsAvailable: eligibleRuns.length > 0, complete: coverageComplete },
    adoptionDecision: { decision, blockers, promotionCount: 0, newGapClosures: 0 },
  }
}

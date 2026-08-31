import { CHARGE_UNVERIFIED_MODIFIERS, DYNAMO_CAP, DYNAMO_DAMAGE_POINTS, DYNAMO_POWER_RANGE, PAIN_CHARGED_MULTIPLIERS, PAIN_HEALTH_COST, PAIN_REQUIRED_CHARGES } from '../data/chargeConsume'
import { OptimizerInputError } from './errors'
import type { DynamoState, EnchantmentTier, PainCycleState, Scenario, SelectedEnchantment } from './types'

function range(name: string, value: number, min = 0, max = Number.MAX_VALUE) {
  if (!Number.isFinite(value) || value < min || value > max) throw new OptimizerInputError('INVALID_SCENARIO', `${name}は${min}〜${max}の有限値を指定してください。`)
}

export function validateChargeInputs(scenario: Pick<Scenario, 'rollsPerSecond' | 'dynamoInitialStacks'>) {
  range('rollsPerSecond', scenario.rollsPerSecond === undefined ? 0 : scenario.rollsPerSecond)
  const stacks = scenario.dynamoInitialStacks === undefined ? 0 : scenario.dynamoInitialStacks
  range('dynamoInitialStacks', stacks, 0, DYNAMO_CAP)
  if (!Number.isInteger(stacks)) throw new OptimizerInputError('INVALID_SCENARIO', 'dynamoInitialStacksは0〜20の整数を指定してください。')
}

export function chargeCombinationUnsupportedReason(enchantments: readonly SelectedEnchantment[]): string | undefined {
  const ids = enchantments.map((item) => item.enchantmentId)
  if (ids.includes('pain-cycle') && ids.includes('dynamo')) return 'Pain Cycle + Dynamoは加算・乗算順とcharge同時消費のEvidence不足のため未対応です。'
  for (const charge of ['pain-cycle', 'dynamo'] as const) {
    if (!ids.includes(charge)) continue
    const modifier = CHARGE_UNVERIFIED_MODIFIERS.find((id) => ids.includes(id))
    if (modifier) return `${charge} + ${modifier}はdamage合成・consume interactionのEvidence不足のため未対応です。`
  }
  return undefined
}

/** O(profile length), first action at t=0, encounter endpoint excluded.
 * Counts periodic phases rather than allocating a potentially huge hit timeline. */
export function finiteAttackCadence(intervals: readonly number[], speed: number, encounter: number) {
  range('attack speed', speed, Number.MIN_VALUE)
  range('encounter', encounter)
  if (intervals.length === 0) throw new OptimizerInputError('INVALID_SCENARIO', '攻撃間隔列が空です。')
  const scaled = intervals.map((interval) => {
    range('attack interval', interval, Number.MIN_VALUE)
    const gap = interval / speed
    range('scaled attack interval', gap, Number.MIN_VALUE)
    return gap
  })
  const cycle = scaled.reduce((sum, gap) => sum + gap, 0)
  range('attack cycle', cycle, Number.MIN_VALUE)
  range('attack count', encounter / cycle * scaled.length, 0, Number.MAX_SAFE_INTEGER / 2)
  let offset = 0
  let lastAttackTime = 0
  const counts = scaled.map((gap, index) => {
    const periods = (encounter - offset) / cycle
    // Snap only machine-rounding around an exact endpoint, not whole frames.
    const tolerance = 8 * Number.EPSILON * Math.max(1, Math.abs(periods))
    const count = index === 0 && encounter > 0 ? Math.max(1, Math.ceil(periods - tolerance)) : Math.max(0, Math.ceil(periods - tolerance))
    if (count > 0) lastAttackTime = Math.max(lastAttackTime, offset + (count - 1) * cycle)
    offset += gap
    return count
  })
  return { scaled, cycle, counts, lastAttackTime, totalAttackActions: counts.reduce((sum, count) => sum + count, 0) }
}

export function calculatePainCycle(totalAttackActions: number, tier: EnchantmentTier, baseHitDamage: number, maxHealth: number, encounterSeconds: number): PainCycleState {
  range('totalAttackActions', totalAttackActions, 0, Number.MAX_SAFE_INTEGER)
  if (!Number.isInteger(totalAttackActions)) throw new OptimizerInputError('INVALID_SCENARIO', 'totalAttackActionsは整数を指定してください。')
  range('base hit damage', baseHitDamage)
  range('maximum health', maxHealth, Number.MIN_VALUE)
  range('encounter', encounterSeconds, Number.MIN_VALUE)
  if (![1, 2, 3].includes(tier)) throw new OptimizerInputError('INVALID_BUILD', 'Pain Cycle Tierは1〜3です。')
  const cycleLengthAttacks = PAIN_REQUIRED_CHARGES + 1
  const empoweredAttacks = Math.floor(totalAttackActions / cycleLengthAttacks)
  const chargingAttacks = totalAttackActions - empoweredAttacks
  const unusedStacksAtEncounterEnd = totalAttackActions % cycleLengthAttacks
  const chargedMultiplier = PAIN_CHARGED_MULTIPLIERS[tier]
  const bonusDamage = empoweredAttacks * baseHitDamage * (chargedMultiplier - 1)
  const selfDamage = chargingAttacks * maxHealth * PAIN_HEALTH_COST.value
  const finiteBaseDamage = totalAttackActions * baseHitDamage
  for (const value of [finiteBaseDamage + bonusDamage, selfDamage, bonusDamage / encounterSeconds, selfDamage / encounterSeconds]) range('Pain Cycle result', value)
  return {
    requiredChargingAttacks: PAIN_REQUIRED_CHARGES, cycleLengthAttacks, chargedMultiplier,
    totalAttackActions, chargingAttacks, empoweredAttacks, unusedStacksAtEncounterEnd,
    endPhase: unusedStacksAtEncounterEnd === PAIN_REQUIRED_CHARGES ? 'ready' : 'charging',
    selfDamage, selfDamagePerSecond: selfDamage / encounterSeconds,
    bonusDamage, directDps: bonusDamage / encounterSeconds,
    finiteBaseDamage, finiteTotalDamage: finiteBaseDamage + bonusDamage,
    empoweredAttacksPerSecond: empoweredAttacks / encounterSeconds,
  }
}

export function dynamoDamagePerStack(power: number, tier: EnchantmentTier): number {
  if (!Number.isFinite(power) || power < DYNAMO_POWER_RANGE.min || power > DYNAMO_POWER_RANGE.max) throw new OptimizerInputError('UNSUPPORTED_DAMAGE_EVENT', 'DynamoはPower 210–263のみ対応です。外挿しません。')
  if (![1, 2, 3].includes(tier)) throw new OptimizerInputError('INVALID_BUILD', 'Dynamo Tierは1〜3です。')
  const exact = DYNAMO_DAMAGE_POINTS.find((point) => point.powerLevel === power)
  if (exact) return exact.damage[tier - 1]!
  const upperIndex = DYNAMO_DAMAGE_POINTS.findIndex((point) => point.powerLevel > power)
  const upper = DYNAMO_DAMAGE_POINTS[upperIndex]!
  const lower = DYNAMO_DAMAGE_POINTS[upperIndex - 1]!
  const fraction = (power - lower.powerLevel) / (upper.powerLevel - lower.powerLevel)
  return Math.exp(Math.log(lower.damage[tier - 1]!) * (1 - fraction) + Math.log(upper.damage[tier - 1]!) * fraction)
}

/** Expected continuous roll income between periodic attacks (fractional stacks).
 * Every attack consumes its entire capped balance, even the initial t=0 attack.
 * No roll animation loss. End-of-encounter charge is retained, never dealt early. */
export function calculateDynamo(cadence: ReturnType<typeof finiteAttackCadence>, encounterSeconds: number, rollsPerSecond: number, initialStacks: number, damagePerStack: number): DynamoState {
  validateChargeInputs({ rollsPerSecond, dynamoInitialStacks: initialStacks })
  range('encounter', encounterSeconds, Number.MIN_VALUE)
  range('damage per stack', damagePerStack)
  const { scaled, cycle, counts, totalAttackActions, lastAttackTime } = cadence
  let sustainedConsumedStacks = 0
  let overflowStacks = 0
  let consumedPerCycle = 0
  for (let i = 0; i < scaled.length; i++) {
    const gap = scaled[(i + scaled.length - 1) % scaled.length]!
    const income = rollsPerSecond * gap
    range('roll income per interval', income)
    const consumed = Math.min(DYNAMO_CAP, income)
    const gapCount = counts[i]! - (i === 0 && totalAttackActions > 0 ? 1 : 0)
    sustainedConsumedStacks += gapCount * consumed
    overflowStacks += gapCount * Math.max(0, income - DYNAMO_CAP)
    consumedPerCycle += consumed
  }
  const initialConsumedStacks = totalAttackActions > 0 ? initialStacks : 0
  const tailIncome = rollsPerSecond * Math.max(0, encounterSeconds - lastAttackTime) + (totalAttackActions === 0 ? initialStacks : 0)
  const unusedStacksAtEncounterEnd = Math.min(DYNAMO_CAP, tailIncome)
  overflowStacks += Math.max(0, tailIncome - DYNAMO_CAP)
  const totalConsumedStacks = initialConsumedStacks + sustainedConsumedStacks
  const bonusDamage = totalConsumedStacks * damagePerStack
  for (const value of [totalConsumedStacks, overflowStacks, tailIncome, bonusDamage, bonusDamage / encounterSeconds]) range('Dynamo result', value)
  return {
    cap: DYNAMO_CAP, rollsPerSecond, initialStacks, totalAttackActions,
    attackActionsPerSecond: scaled.length / cycle,
    consumptionCapacityPerSecond: DYNAMO_CAP * scaled.length / cycle,
    sustainedConsumedStacksPerSecond: consumedPerCycle / cycle,
    initialConsumedStacks, totalConsumedStacks,
    consumedStacksPerSecond: totalConsumedStacks / encounterSeconds,
    averageStacksPerAttack: totalAttackActions === 0 ? 0 : totalConsumedStacks / totalAttackActions,
    overflowStacks, overflowStacksPerSecond: overflowStacks / encounterSeconds, unusedStacksAtEncounterEnd,
    damagePerStack, firstAttackBonusDamage: initialConsumedStacks * damagePerStack,
    bonusDamage, directDps: bonusDamage / encounterSeconds,
  }
}

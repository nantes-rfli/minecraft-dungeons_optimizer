/** Phase 6.9E research model. Runtime code must not import this module. */
export type IncomingDamageChannel = 'direct-mob-attack' | 'mob-enchantment'
export type DefenseEffectId = 'armor-35' | 'iron-hide' | 'ghost-cloak' | 'potion-barrier' | 'guarding-strike' | 'weakening' | 'gong'
type DefenseFamily = 'hero-armor-score' | 'enemy-debuff-score' | 'separate-reduction'

export interface DefenseEffectDefinition {
  readonly id: DefenseEffectId
  readonly reduction: number
  readonly family: DefenseFamily
  readonly appliesTo: readonly IncomingDamageChannel[]
}

export const DEFENSE_EFFECTS: Readonly<Record<DefenseEffectId, DefenseEffectDefinition>> = {
  'armor-35': { id: 'armor-35', reduction: 0.35, family: 'hero-armor-score', appliesTo: ['direct-mob-attack', 'mob-enchantment'] },
  'iron-hide': { id: 'iron-hide', reduction: 0.5, family: 'hero-armor-score', appliesTo: ['direct-mob-attack', 'mob-enchantment'] },
  'ghost-cloak': { id: 'ghost-cloak', reduction: 0.5, family: 'hero-armor-score', appliesTo: ['direct-mob-attack', 'mob-enchantment'] },
  'potion-barrier': { id: 'potion-barrier', reduction: 0.9, family: 'hero-armor-score', appliesTo: ['direct-mob-attack', 'mob-enchantment'] },
  'guarding-strike': { id: 'guarding-strike', reduction: 0.5, family: 'separate-reduction', appliesTo: ['direct-mob-attack', 'mob-enchantment'] },
  weakening: { id: 'weakening', reduction: 0.4, family: 'enemy-debuff-score', appliesTo: ['direct-mob-attack'] },
  gong: { id: 'gong', reduction: 0.25, family: 'enemy-debuff-score', appliesTo: ['direct-mob-attack'] },
}

function fraction(value: number, field: string, includeOne = false): void {
  if (!Number.isFinite(value) || value < 0 || (includeOne ? value > 1 : value >= 1)) throw new Error(`6.9E ${field}: expected fraction ${includeOne ? '[0, 1]' : '[0, 1)'}`)
}

function inverseScore(reductions: readonly number[]): number {
  return 1 / (1 + reductions.reduce((sum, reduction) => sum + reduction / (1 - reduction), 0))
}

/**
 * Family membership is intentionally limited to the retrieved 2021/2024 same-author evidence.
 * Ghost Cloak + Guarding Strike is contradictory in that evidence and is rejected instead of guessed.
 */
export function resolveDefenseState(effectIds: readonly DefenseEffectId[], channel: IncomingDamageChannel): number {
  if (new Set(effectIds).size !== effectIds.length) throw new Error('6.9E defense state: duplicate effect')
  if (effectIds.includes('ghost-cloak') && effectIds.includes('guarding-strike')) throw new Error('6.9E defense state: unresolved Ghost Cloak + Guarding Strike conflict')
  const applicable = effectIds.map((id) => DEFENSE_EFFECTS[id]).filter((effect) => effect.appliesTo.includes(channel))
  const hero = applicable.filter((effect) => effect.family === 'hero-armor-score').map((effect) => effect.reduction)
  const enemy = applicable.filter((effect) => effect.family === 'enemy-debuff-score').map((effect) => effect.reduction)
  const separate = applicable.filter((effect) => effect.family === 'separate-reduction').map((effect) => effect.reduction)
  return inverseScore(hero) * inverseScore(enemy) * separate.reduce((taken, reduction) => taken * (1 - reduction), 1)
}

export interface WeightedDefenseState {
  readonly probability: number
  readonly active: readonly DefenseEffectId[]
}

/** Joint states are required: marginal uptimes do not determine overlap. */
export function expectedDamageTaken(states: readonly WeightedDefenseState[], channel: IncomingDamageChannel): number {
  if (!states.length) throw new Error('6.9E defense states: empty')
  let probability = 0
  const result = states.reduce((sum, state) => {
    fraction(state.probability, 'state probability', true)
    probability += state.probability
    return sum + state.probability * resolveDefenseState(state.active, channel)
  }, 0)
  if (Math.abs(probability - 1) > 1e-12) throw new Error('6.9E defense states: probabilities must sum to 1')
  return result
}

export type DynamoPlacement = '2021-indirect' | '2026-inside-additive'
export interface ModifierInput {
  readonly basePhysical: number
  readonly additivePhysical: readonly number[]
  readonly selfStackingAdditiveGroups?: readonly (readonly number[])[]
  readonly physicalMultipliers: readonly number[]
  readonly dynamo: number
  readonly otherIndirect: number
  readonly fullMultiplier: number
}

function nonNegative(value: number, field: string): void {
  if (!Number.isFinite(value) || value < 0) throw new Error(`6.9E ${field}: expected non-negative finite value`)
}

/** Compare the two retained Dynamo placements without declaring either current-game truth. */
export function composeModifierHypothesis(input: ModifierInput, placement: DynamoPlacement) {
  for (const [field, value] of Object.entries({ basePhysical: input.basePhysical, dynamo: input.dynamo, otherIndirect: input.otherIndirect, fullMultiplier: input.fullMultiplier })) nonNegative(value, field)
  if (input.fullMultiplier === 0) throw new Error('6.9E fullMultiplier: expected positive finite value')
  for (const value of [...input.additivePhysical, ...input.physicalMultipliers, ...(input.selfStackingAdditiveGroups ?? []).flat()]) fraction(value, 'modifier')
  const selfStackingBonus = (input.selfStackingAdditiveGroups ?? []).reduce((sum, group) => sum + group.reduce((factor, bonus) => factor * (1 + bonus), 1) - 1, 0)
  const additiveFactor = 1 + input.additivePhysical.reduce((sum, bonus) => sum + bonus, 0) + selfStackingBonus
  const physicalFactor = input.physicalMultipliers.reduce((factor, bonus) => factor * (1 + bonus), 1)
  const directPhysical = input.basePhysical * physicalFactor * additiveFactor
  const dynamo = placement === '2026-inside-additive' ? input.dynamo * additiveFactor : input.dynamo
  return { additiveFactor, physicalFactor, directPhysical, dynamo, otherIndirect: input.otherIndirect, total: input.fullMultiplier * (directPhysical + dynamo + input.otherIndirect) }
}

/** Existing runtime scalar behavior, exposed only as a comparison hypothesis. */
export function composeFactorizedRuntimeProxy(input: ModifierInput): number {
  const additiveFactor = [...input.additivePhysical, ...(input.selfStackingAdditiveGroups ?? []).flat()].reduce((factor, bonus) => factor * (1 + bonus), 1)
  return input.fullMultiplier * (input.basePhysical * additiveFactor * input.physicalMultipliers.reduce((factor, bonus) => factor * (1 + bonus), 1) + input.dynamo + input.otherIndirect)
}

export { evaluate } from './evaluate'
export { optimize } from './optimizer'
export { deriveCombatState } from './combatState'
export { derivePotionState } from './potion'
export { deriveEnemyDebuffState } from './enemyDebuffs'
export { calculateComboFinisherRate } from './attackProfile'
export { calculateDamageEvents, interpolateProcDamage, enchantmentUnsupportedReason } from './damageEvents'
export { OptimizerInputError } from './errors'
export {
  calculateModelErrorSummary,
  calculatePredictionRange,
  summarizeDamageRegression,
  summarizeDamageRegressionByScope,
} from './modelError'
export {
  evaluatePowerScalingSamples,
  POWER_SCALING_EXACT_ERROR_TOLERANCE,
  POWER_SCALING_RANGE_ERROR_TOLERANCE,
  summarizePowerScalingValidation,
} from './powerScalingValidation'
export type * from './types'

export { soulTrajectory, soulIncome, siphonIncome, animaHealingCapacity, deriveSoulState } from './souls'

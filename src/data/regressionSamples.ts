import type { DamageRegressionSample } from '../core/types'

/**
 * Controlled in-game measurements only. Do not add estimates or wiki values here.
 * The UI intentionally reports "pending" until at least five samples are available.
 */
export const DAMAGE_REGRESSION_SAMPLES = [] as const satisfies readonly DamageRegressionSample[]

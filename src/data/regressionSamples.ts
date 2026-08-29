import type { DamageRegressionSample } from '../core/types'

/**
 * Only audit entries marked eligible in research/dps-regression-audit.json belong here.
 * Do not add estimates, calculated tables, component fixtures, or model-derived values.
 * The UI intentionally reports "pending" until at least five samples are available.
 */
export const DAMAGE_REGRESSION_SAMPLES = [] as const satisfies readonly DamageRegressionSample[]

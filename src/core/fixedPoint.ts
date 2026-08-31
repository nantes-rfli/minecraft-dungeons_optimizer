export const FIXED_POINT_TOLERANCE = 1e-8
export const FIXED_POINT_MAX_ITERATIONS = 100

/** Returns the evaluated input and its residual so dependent metrics share one state. */
export function solveUnitIntervalFixedPoint<T>(
  evaluate: (value: number) => { readonly nextValue: number; readonly result: T },
  options: { readonly tolerance?: number; readonly maxIterations?: number } = {},
): { readonly value: number; readonly result: T; readonly iterations: number; readonly firstIterationValue: number; readonly residual: number } {
  const tolerance = options.tolerance ?? FIXED_POINT_TOLERANCE
  const maxIterations = options.maxIterations ?? FIXED_POINT_MAX_ITERATIONS
  if (!Number.isFinite(tolerance) || tolerance <= 0 || tolerance >= 1 || !Number.isSafeInteger(maxIterations) || maxIterations <= 0) {
    throw new Error('Invalid fixed-point tolerance or iteration limit')
  }
  let value = 0
  let firstIterationValue = 0
  for (let iterations = 1; iterations <= maxIterations; iterations++) {
    const { nextValue, result } = evaluate(value)
    if (!Number.isFinite(nextValue) || nextValue < 0 || nextValue > 1) throw new Error('Fixed-point update must be finite and in [0, 1]')
    if (iterations === 1) firstIterationValue = nextValue
    const residual = Math.abs(nextValue - value)
    if (residual <= tolerance) return { value, result, iterations, firstIterationValue, residual }
    value = nextValue
  }
  throw new Error(`Offensive steady state did not converge after ${maxIterations} iterations`)
}

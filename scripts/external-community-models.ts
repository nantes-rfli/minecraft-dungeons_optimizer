/** Research probes only. These hypotheses are not imported by runtime code. */
function fraction(value: number, name: string, includeOne = true): void {
  if (!Number.isFinite(value) || value < 0 || (includeOne ? value > 1 : value >= 1)) {
    throw new Error(`${name}: expected a finite fraction ${includeOne ? '[0, 1]' : '[0, 1)'}`)
  }
}

/** Caller assigns families explicitly; this function does not establish membership. */
export function inverseArmorDamageTaken(armorFamily: readonly number[], separate: readonly number[] = []): number {
  armorFamily.forEach((value) => fraction(value, 'armor reduction', false))
  separate.forEach((value) => fraction(value, 'separate reduction', false))
  const score = armorFamily.reduce((sum, value) => sum + value / (1 - value), 0)
  if (!Number.isFinite(score)) throw new Error('armor score exceeds finite range')
  return separate.reduce((taken, value) => taken * (1 - value), 1 / (1 + score))
}

export function continuousCommittedGain(bonus: number, startingHpFraction = 1): number {
  fraction(bonus, 'bonus')
  fraction(startingHpFraction, 'starting HP')
  if (startingHpFraction === 0) throw new Error('starting HP must be positive')
  if (bonus === 0) return 1
  const endRate = 1 + bonus * (1 - startingHpFraction)
  const x = bonus * startingHpFraction / endRate
  // log1p avoids cancellation at tiny bonuses or low starting HP.
  return x === 0 ? endRate : endRate * x / Math.log1p(x)
}

export interface FiniteCommittedInput {
  maxHealth: number
  startingHpFraction: number
  damagePerHit: number
  hitsPerSecond: number
  bonus: number
}

/** Fixed damage, one target, no proc/crit/rounding. A synthetic comparison, not game evidence. */
export function finiteCommitted(input: FiniteCommittedInput) {
  const { maxHealth, startingHpFraction, damagePerHit, hitsPerSecond, bonus } = input
  fraction(startingHpFraction, 'starting HP')
  fraction(bonus, 'bonus')
  for (const [name, value] of Object.entries({ maxHealth, damagePerHit, hitsPerSecond, startingHpFraction })) {
    if (!Number.isFinite(value) || value <= 0) throw new Error(`${name}: expected positive finite value`)
  }
  const initialHealth = maxHealth * startingHpFraction
  if (initialHealth === 0) throw new Error('starting health underflows')
  const baselineHits = Math.ceil(initialHealth / damagePerHit)
  if (!Number.isFinite(baselineHits) || baselineHits > 1_000_000) throw new Error('research hit budget exceeded')
  let remaining = initialHealth
  let hits = 0
  let overkill = 0
  while (remaining > 0) {
    const damage = damagePerHit * (1 + bonus * (1 - remaining / maxHealth))
    if (!Number.isFinite(damage)) throw new Error('damage exceeds finite range')
    const next = remaining - damage
    if (next === remaining) throw new Error('damage does not advance health')
    remaining = Math.max(0, next)
    overkill = Math.max(0, -next)
    hits += 1
    if (hits > 1_000_000) throw new Error('research hit budget exceeded')
  }
  const attackBudgetSeconds = hits / hitsPerSecond
  const firstHitAtZeroKillSeconds = (hits - 1) / hitsPerSecond
  if (!Number.isFinite(attackBudgetSeconds)) throw new Error('time exceeds finite range')
  return {
    baselineHits, hits, overkill, attackBudgetSeconds, firstHitAtZeroKillSeconds,
    // Renewal attack cost, not first-hit-at-zero TTK ratio (undefined for one-hit kills).
    attackBudgetGain: baselineHits / hits,
  }
}

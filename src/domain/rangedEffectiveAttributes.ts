import audit from '../../research/domain/ranged-effective-attributes.json' with { type: 'json' }
import type { RangedEffectiveAttributes } from './rangedFinalNative.ts'

/** A constructor default is not a resolved combat value, even for an unenchanted Bow.
 * Explicit values are conditional caller inputs, never accepted game evidence.
 */
export function resolveBareBowEffectiveAttributes(explicit?: Partial<RangedEffectiveAttributes>) {
  const supplied = typeof explicit === 'object' && explicit !== null && !Array.isArray(explicit) ? explicit : {}
  const attributes: Partial<Record<keyof RangedEffectiveAttributes, number>> = {}
  const unresolved: string[] = []
  for (const row of audit.attributes) {
    const name = row.attribute as keyof RangedEffectiveAttributes
    const value = supplied[name]
    if (Object.hasOwn(supplied, name) && typeof value === 'number' && Number.isFinite(value)
      && Math.fround(value) === value && value >= 0 && (value === 0 || value >= 2 ** -126)) attributes[name] = value
    else unresolved.push(name)
  }
  return unresolved.length
    ? { state: 'unknown' as const, reason: 'effective-attribute-writers-and-active-state-unresolved', unresolved, runtimePromotion: false as const }
    : { state: 'known' as const, attributes: attributes as RangedEffectiveAttributes, valueSource: 'explicit-conditional-input' as const, runtimePromotion: false as const }
}

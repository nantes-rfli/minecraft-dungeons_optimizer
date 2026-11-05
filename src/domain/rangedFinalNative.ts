import model from '../../research/domain/ranged-final-native-model.json' with { type: 'json' }
import replay from '../../research/native/ranged-final-20261101/verification.json' with { type: 'json' }
import { nativeRangedReference } from './rangedNative.ts'

export interface RangedEffectiveAttributes {
  readonly RangedAttackDamageIncrease: number
  readonly TakeDamageMultiplier: number
  readonly DamageMultiplier: number
  readonly DealDamageMul: number
  readonly DifficultyDealDamageMultiplier: number
  readonly RangedAttackDamageMultipler: number
  readonly TakeRangeDamageMultiplier: number
}
export interface ConditionalRangedInput {
  readonly weaponId: string
  readonly mode: 'uncharged' | 'charged' | 'single'
  readonly power: { readonly kind: 'internal-f32-bits'; readonly bits: string; readonly sourceNote: string }
    | { readonly kind: 'parsed-save-double'; readonly value: number; readonly sourceNote: string }
  readonly provider: string
  readonly projectile: string
  readonly powerEffect: string
  readonly attributes: RangedEffectiveAttributes
}
export const RANGED_NATIVE_CONTRACT = model
const buffer = new DataView(new ArrayBuffer(4))
export function float32Bits(value: number): string {
  buffer.setFloat32(0, value, true)
  return buffer.getUint32(0, true).toString(16).padStart(8, '0')
}
function fromBits(bits: string): number {
  buffer.setUint32(0, parseInt(bits, 16), true)
  return buffer.getFloat32(0, true)
}
const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const F = Math.fround
const finiteF32 = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && F(v) === v && (v === 0 || Math.abs(v) >= 2 ** -126)
const unknown = (reason: string) => ({ state: 'unknown' as const, reason, runtimePromotion: false as const })

/** Reference environment only. Table lookup is exact on bits; never interpolates.
 * No defaults for missing attributes, provider, FP state or projectile conditions.
 * Values outside the saved CRT replay need the private, bounded Native CLI.
 */
export function calculateConditionalRanged(request: unknown) {
  if (!record(request) || typeof request.weaponId !== 'string' || typeof request.mode !== 'string'
    || !record(request.power) || !record(request.attributes)) return unknown('malformed-conditional-input')
  const input = request as unknown as ConditionalRangedInput
  const reference = nativeRangedReference(input.weaponId)
  if (reference.state !== 'known') return unknown('unsupported-weapon')
  if (input.provider !== model.provider.id) return unknown('unverified-provider-or-mxcsr')
  if (input.projectile !== model.conditions.projectile) return unknown('unverified-projectile-or-events')
  if (input.powerEffect !== model.conditions.powerEffect) return unknown('unsupported-power-aggregation')
  if (!input.power || typeof input.power.sourceNote !== 'string' || !input.power.sourceNote.trim()) return unknown('missing-item-power-provenance')
  let itemPowerBits: string
  if (input.power.kind === 'internal-f32-bits' && typeof input.power.bits === 'string' && /^[a-fA-F0-9]{8}$/.test(input.power.bits)) itemPowerBits = input.power.bits.toLowerCase()
  else if (input.power.kind === 'parsed-save-double' && Number.isFinite(input.power.value)) itemPowerBits = float32Bits(input.power.value)
  else return unknown('missing-internal-or-parsed-save-power')
  const x = fromBits(itemPowerBits)
  if (!finiteF32(x) || x < 0 || x > 40) return unknown('power-outside-reviewed-domain')
  const row = replay.completePowerCases.find((r) => r.itemPowerBits === itemPowerBits)
  if (!row) return unknown('power-not-in-pinned-crt-replay-use-native-cli')
  const mode = input.mode
  const heavy = input.weaponId === 'heavy-crossbow'
  if ((heavy && mode !== 'single') || (!heavy && mode !== 'uncharged' && mode !== 'charged')) return unknown('unsupported-shot-mode')
  const h = mode === 'charged' ? reference.baselineBeforePower.charged : reference.baselineBeforePower.uncharged
  if (h === null) return unknown('unknown-baseline')
  const names = model.captures.filter((c) => c.attribute !== 'RangedAttackItemPowerFactor').map((c) => c.attribute as keyof RangedEffectiveAttributes)
  if (names.some((name) => !Object.hasOwn(input.attributes, name) || !finiteF32(input.attributes[name]) || input.attributes[name] < 0)) return unknown('missing-or-unsupported-effective-attribute')
  const a = input.attributes
  const q = fromBits(row.effectiveQBits)
  const sum = F(-a.RangedAttackDamageIncrease + -h)
  const v0 = F(sum * a.TakeDamageMultiplier)
  const damageProduct = F(v0 * a.DamageMultiplier)
  const v1 = F(damageProduct * a.DealDamageMul)
  const v2 = F(v1 * a.DifficultyDealDamageMultiplier)
  const v3 = F(q * v2)
  const v4 = F(v3 * a.RangedAttackDamageMultipler)
  const v = F(v4 * a.TakeRangeDamageMultiplier)
  if (![sum, v0, damageProduct, v1, v2, v3, v4, v].every(finiteF32)) return unknown('arithmetic-outside-reviewed-normal-domain')
  return { state: 'known' as const, evidenceStatus: 'derived' as const, runtimePromotion: false as const,
    gameVersion: model.gameVersion, identityAssertionId: reference.identityAssertionId,
    itemPowerBits, powerScalarBits: row.scalarBits, effectivePowerFactorBits: row.effectiveQBits,
    baselineBeforePower: h, signedCustomMagnitude: v, signedCustomMagnitudeBits: float32Bits(v),
    positiveCustomMagnitude: -v,
    hpLoss: { state: 'unknown' as const, reason: 'target-acceptance-tags-shield-barrier-health-aggregator-threshold-events-not-supplied' },
    combatDps: { state: 'unknown' as const, reason: 'no-promoted-damage-or-effective-cycle' },
    evidence: { model: 'research/domain/ranged-final-native-model.json', replay: model.verification },
  }
}

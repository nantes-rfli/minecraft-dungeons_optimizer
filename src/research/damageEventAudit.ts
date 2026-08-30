import type { Confidence, EnchantmentTier, ProcDamageId } from '../core/types'

export interface DamageEventAudit {
  readonly schemaVersion: 1
  readonly gameVersion: '1.17.0.0'
  readonly phaseStatus: 'partial'
  readonly completionBlocker: string
  readonly commonCurveAudit: {
    readonly decision: 'per-enchantment-log-linear'
    readonly validationTolerance: number
    readonly maxTierReconstructionRelativeErrors: Readonly<Record<ProcDamageId, number>>
  }
  readonly entries: readonly {
    readonly id: ProcDamageId
    readonly confidence: Confidence
    readonly trigger: { readonly type: string; readonly probability: number; readonly requiresTargetHit: boolean }
    readonly tiers: Readonly<Record<EnchantmentTier, { readonly raw: string; readonly multiplier: number }>>
    readonly powerScaling: {
      readonly publishedSamples: readonly { readonly powerLevel: number; readonly tier: EnchantmentTier; readonly damage: number; readonly source: string }[]
      readonly supportedPowerRange: { readonly min: number; readonly max: number }
    }
  }[]
}

const record = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {}
const positive = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0
const httpUrl = (value: unknown): boolean => typeof value === 'string' && /^https:\/\/[^\s]+$/.test(value)

export function collectDamageEventAuditErrors(value: unknown): string[] {
  const errors: string[] = []
  const root = record(value)
  if (root.schemaVersion !== 1 || root.gameVersion !== '1.17.0.0') errors.push('schema/version mismatch')
  if (root.phaseStatus !== 'partial' || typeof root.completionBlocker !== 'string' || !root.completionBlocker) errors.push('partial completion boundary required')
  const common = record(root.commonCurveAudit)
  if (common.decision !== 'per-enchantment-log-linear' || common.validationTolerance !== 0.003) errors.push('curve decision/tolerance mismatch')
  if (!Array.isArray(root.entries)) return [...errors, 'entries required']
  const entries = root.entries.map(record)
  if (entries.map((entry) => entry.id).sort().join(',') !== 'shockwave,swirling,thundering') errors.push('exact three proc IDs required')
  for (const entry of entries) {
    const id = String(entry.id)
    const trigger = record(entry.trigger)
    const thunder = id === 'thundering'
    if (trigger.type !== (thunder ? 'on-hit-probability' : 'combo-finisher') || trigger.probability !== (thunder ? 0.3 : 1) || trigger.requiresTargetHit !== (id !== 'shockwave')) errors.push(`${id}: trigger mismatch`)
    const targeting = record(entry.targeting)
    const geometry = id === 'shockwave' ? 'directional-wave' : thunder ? 'nearby-lightning' : 'local-radius'
    if (targeting.geometry !== geometry || targeting.defaultExpectedTargets !== 1 || targeting.confidence !== 'low' || targeting.quantitativeCoverageKnown !== false) errors.push(`${id}: explicit targeting assumption required`)
    const attribution = record(entry.attribution)
    if (attribution.directWeaponKill !== false || attribution.confidence !== 'low') errors.push(`${id}: indirect attribution required`)
    const voidInteraction = record(entry.voidStrikeInteraction)
    if (voidInteraction.amplification !== 'uncertain' || voidInteraction.consumesVoid !== 'uncertain') errors.push(`${id}: separate uncertain Void interactions required`)
    if (record(entry.stacking).maxCopies !== 1) errors.push(`${id}: non-stackable required`)
    const sources = Array.isArray(entry.sources) ? entry.sources.map(record) : []
    if (sources.length === 0 || sources.some((source) => !httpUrl(source.url) || !Array.isArray(source.supports) || !source.supports.length)) errors.push(`${id}: source provenance required`)
    const power = record(entry.powerScaling)
    if (!Array.isArray(power.publishedSamples) || power.publishedSamples.length === 0) {
      errors.push(`${id}: samples required`)
      continue
    }
    const samples = power.publishedSamples.map(record)
    const valid = samples.every((sample) => positive(sample.powerLevel) && Number.isInteger(sample.powerLevel) && positive(sample.damage) && [1, 2, 3].includes(Number(sample.tier)) && httpUrl(sample.source))
    if (!valid) { errors.push(`${id}: invalid numeric sample`); continue }
    const keys = samples.map((sample) => `${sample.powerLevel}:${sample.tier}`)
    if (new Set(keys).size !== keys.length) errors.push(`${id}: duplicate sample`)
    const powers = [...new Set(samples.map((sample) => Number(sample.powerLevel)))]
    const range = record(power.supportedPowerRange)
    if (range.min !== Math.min(...powers) || range.max !== Math.max(...powers)) errors.push(`${id}: supported range must match samples (no extrapolation)`)
    const tiers = record(entry.tiers)
    for (const tier of [1, 2, 3]) {
      const expected = thunder ? tier : [1, 1.5, 2][tier - 1]
      const value = record(tiers[tier])
      if (value.multiplier !== expected || value.raw !== (expected === 1 ? 'X' : `${expected}X`)) errors.push(`${id}: tier ${tier} mismatch`)
    }
    let maximumError = 0
    for (const powerLevel of powers) {
      const group = samples.filter((sample) => sample.powerLevel === powerLevel)
      if (group.length !== 3 || new Set(group.map((sample) => sample.tier)).size !== 3) errors.push(`${id}: incomplete tier samples at ${powerLevel}`)
      const base = Number(group.find((sample) => sample.tier === 1)?.damage)
      for (const sample of group) {
        const multiplier = Number(record(tiers[Number(sample.tier)]).multiplier)
        maximumError = Math.max(maximumError, Math.abs(base * multiplier / Number(sample.damage) - 1))
      }
    }
    if (!Number.isFinite(maximumError) || maximumError > 0.003) errors.push(`${id}: tier reconstruction exceeds tolerance`)
    if (Math.abs(Number(record(common.maxTierReconstructionRelativeErrors)[id]) - maximumError) > 1e-12 || !Number.isFinite(Number(record(common.maxTierReconstructionRelativeErrors)[id]))) errors.push(`${id}: recorded validation error mismatch`)
  }
  return errors
}

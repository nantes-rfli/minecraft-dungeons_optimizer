import { describe, expect, it } from 'vitest'
import audit from '../research/damage-event-audit.json'
import meleeAudit from '../research/melee-enchantment-audit.json'
import { collectDamageEventAuditErrors } from '../src/research/damageEventAudit'
import { PROC_DAMAGE_DEFINITIONS, PROC_DAMAGE_IDS } from '../src/data/damageEvents'
import { interpolateProcDamage } from '../src/core/damageEvents'

describe('DamageEvent research audit integrity', () => {
  it('validates 38 power knots / 114 published tier samples without claiming full coverage', () => {
    expect(collectDamageEventAuditErrors(audit)).toEqual([])
    expect(audit.entries.map((entry) => entry.powerScaling.publishedSamples.length)).toEqual([42, 54, 18])
    expect(audit.phaseStatus).toBe('partial')
    for (const id of PROC_DAMAGE_IDS) {
      const entry = audit.entries.find((entry) => entry.id === id)!
      const runtime = PROC_DAMAGE_DEFINITIONS[id]
      const melee = meleeAudit.entries.find((entry) => entry.id === id)!
      expect(melee.runtimePowerRange).toEqual(entry.powerScaling.supportedPowerRange)
      expect(melee.runtimeStatus).toBe('implemented')
      expect(runtime.damageCurve.value.points).toEqual(entry.powerScaling.publishedSamples.filter((sample) => sample.tier === 1).map((sample) => ({ powerLevel: sample.powerLevel, tierOneDamage: sample.damage })))
      const residuals = entry.powerScaling.publishedSamples.map((sample) => Math.abs(interpolateProcDamage(runtime.damageCurve.value, sample.powerLevel) * entry.tiers[String(sample.tier) as '1' | '2' | '3'].multiplier / sample.damage - 1))
      expect(Math.max(...residuals)).toBeCloseTo(audit.commonCurveAudit.maxTierReconstructionRelativeErrors[id], 12)
    }
  })
  it('reproduces normalized common-curve disagreement and retains the Swirling anomaly', () => {
    for (const comparison of audit.commonCurveAudit.shockwaveSwirlingComparisons) {
      const shock = PROC_DAMAGE_DEFINITIONS.shockwave.samples.value.find((sample) => sample.powerLevel === comparison.powerLevel && sample.tier === 1)!
      const swirl = PROC_DAMAGE_DEFINITIONS.swirling.samples.value.find((sample) => sample.powerLevel === comparison.powerLevel && sample.tier === 1)!
      expect(Math.abs((shock.damage / 30) / (swirl.damage / 40) - 1)).toBeCloseTo(comparison.relativeDisagreement, 12)
    }
    expect(PROC_DAMAGE_DEFINITIONS.swirling.samples.value.find((sample) => sample.powerLevel === 243 && sample.tier === 3)?.damage).toBe(442566)
    for (const comparison of audit.commonCurveAudit.swirlingThunderingComparisons) {
      const swirl = PROC_DAMAGE_DEFINITIONS.swirling.samples.value.find((sample) => sample.powerLevel === comparison.powerLevel && sample.tier === 1)!
      const thunder = PROC_DAMAGE_DEFINITIONS.thundering.samples.value.find((sample) => sample.powerLevel === comparison.powerLevel && sample.tier === 1)!
      expect(swirl.damage / thunder.damage).toBeCloseTo(comparison.swirlingToThunderingTierOneRatio, 12)
      expect(thunder.damage / swirl.damage * 40).toBeCloseTo(comparison.inferredThunderingBaseIfSwirlingBase40, 12)
    }
  })
  it('rejects invented coverage, direct kill leakage, invalid numbers and missing tiers/sources', () => {
    expect(collectDamageEventAuditErrors(null).length).toBeGreaterThan(0)
    const mutations: Array<(copy: typeof audit) => void> = [
      (copy) => { copy.entries[0]!.powerScaling.supportedPowerRange.min = 50 },
      (copy) => { copy.entries[0]!.attribution.directWeaponKill = true },
      (copy) => { copy.entries[0]!.powerScaling.publishedSamples[0]!.damage = NaN },
      (copy) => { copy.entries[0]!.powerScaling.publishedSamples.pop() },
      (copy) => { copy.entries[0]!.sources = [] },
      (copy) => { copy.entries[2]!.trigger.probability = 1 },
      (copy) => { copy.entries[1]!.voidStrikeInteraction.consumesVoid = 'no' },
      (copy) => { copy.phaseStatus = 'complete' },
    ]
    for (const mutate of mutations) {
      const copy = structuredClone(audit)
      mutate(copy)
      expect(collectDamageEventAuditErrors(copy).length).toBeGreaterThan(0)
    }
  })
})

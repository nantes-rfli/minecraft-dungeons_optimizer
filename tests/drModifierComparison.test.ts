import { describe, expect, it } from 'vitest'
import { composeFactorizedRuntimeProxy, composeModifierHypothesis, expectedDamageTaken, resolveDefenseState } from '../src/research/drModifierComparison'
import comparison from '../research/external-community/dr-modifier-comparison.json'

describe('Phase 6.9E DR / modifier comparison', () => {
  it('reproduces withheld same-origin rows at raw and displayed precision', () => {
    expect(comparison.defense.holdouts).toHaveLength(6)
    for (const row of comparison.defense.holdouts) {
      expect(Math.abs(row.residualDamageTaken)).toBeLessThan(0.0001)
      expect(Math.abs(1 - row.predictedDamageTaken - row.reportedReduction)).toBeLessThanOrEqual(0.0005)
      expect(row.validationKind).toContain('not independent')
    }
  })

  it('resolves known families but rejects the unresolved Ghost/Guarding conflict', () => {
    expect(1 - resolveDefenseState(['armor-35', 'iron-hide'], 'direct-mob-attack')).toBeCloseTo(0.6060606)
    expect(1 - resolveDefenseState(['armor-35', 'iron-hide', 'guarding-strike'], 'direct-mob-attack')).toBeCloseTo(0.8030303)
    expect(() => resolveDefenseState(['ghost-cloak', 'guarding-strike'], 'direct-mob-attack')).toThrow('unresolved')
    expect(() => resolveDefenseState(['iron-hide', 'iron-hide'], 'direct-mob-attack')).toThrow('duplicate')
  })

  it('limits Weakening by incoming channel instead of applying it globally', () => {
    expect(resolveDefenseState(['weakening'], 'direct-mob-attack')).toBeCloseTo(0.6)
    expect(resolveDefenseState(['weakening'], 'mob-enchantment')).toBe(1)
  })

  it('requires joint activation states and keeps nonlinear averaging explicit', () => {
    const joint = expectedDamageTaken([{ probability: 0.5, active: ['armor-35'] }, { probability: 0.5, active: ['armor-35', 'potion-barrier'] }], 'direct-mob-attack')
    expect(joint).toBeCloseTo(comparison.defense.stateComparison.jointStateTaken)
    expect(joint).toBeLessThan(comparison.defense.stateComparison.comparatorTaken)
    expect(comparison.defense.stateComparison.meanInputTaken).toBeGreaterThan(comparison.defense.stateComparison.comparatorTaken)
    expect(() => expectedDamageTaken([{ probability: 0.9, active: [] }], 'direct-mob-attack')).toThrow('sum to 1')
  })

  it('keeps Dynamo placement hypotheses separate and shows rank sensitivity', () => {
    const row = comparison.modifier.taxonomyVsRuntimeProxy
    expect(composeModifierHypothesis(row.input, '2021-indirect').total).toBeCloseTo(row.taxonomyTotal)
    expect(composeFactorizedRuntimeProxy(row.input)).toBeCloseTo(row.factorizedRuntimeProxyTotal)
    expect(row.taxonomyTotal).toBeLessThan(row.comparatorTotal)
    expect(row.factorizedRuntimeProxyTotal).toBeGreaterThan(row.comparatorTotal)
    expect(comparison.modifier.dynamoConflict.formula2026Total).toBeGreaterThan(comparison.modifier.dynamoConflict.taxonomy2021Total)
  })

  it('rejects invalid research inputs and remains unpromoted', () => {
    const valid = { basePhysical: 100, additivePhysical: [0.2], physicalMultipliers: [0.4], dynamo: 0, otherIndirect: 0, fullMultiplier: 1 }
    for (const value of [-1, NaN, Infinity]) expect(() => composeModifierHypothesis({ ...valid, basePhysical: value }, '2021-indirect')).toThrow()
    expect(() => composeModifierHypothesis({ ...valid, additivePhysical: [1] }, '2021-indirect')).toThrow()
    expect(comparison.promotionCount).toBe(0)
    expect(comparison.newGapClosures).toBe(0)
  })
})

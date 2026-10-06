import { describe, expect, it } from 'vitest'
import { artifactEvidenceAllowed, ESTIMATED_PARAMETER_EVIDENCE, isEvidenceStatusAllowed, parameterEvidenceForBuild, estimatedParametersForBuild } from '../src/core/evidenceStatus'
import { optimize, type Build } from '../src/core'
import { DEFAULT_SCENARIO } from '../src/data/scenarios'
import { OptimizeResults } from '../src/screens/OptimizeResults'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const build = (enchantmentId: Build['enchantments'][number]['enchantmentId'] = 'critical-hit', artifacts: Build['artifacts'] = []): Build => ({
  weapon: { instanceId: 'weapon', weaponId: 'double-axe', powerLevel: 251, enchantmentSlots: [{ candidates: [enchantmentId] }] },
  enchantments: [{ enchantmentId, tier: 3, source: 'slot' }], artifacts,
})

describe('parameter evidence status', () => {
  it('retains basis, conditions, version and confidence for every estimate', () => {
    expect(ESTIMATED_PARAMETER_EVIDENCE.length).toBeGreaterThan(0)
    for (const parameter of ESTIMATED_PARAMETER_EVIDENCE) {
      expect(parameter.status).toBe('estimated')
      expect(parameter.basis).not.toBe('')
      expect(parameter.conditions).not.toBe('')
      expect(parameter.gameVersion).not.toBe('')
      expect(['high', 'medium', 'low']).toContain(parameter.confidence)
    }
  })

  it('reports only estimates used by the selected build', () => {
    expect(estimatedParametersForBuild(build('critical-hit', [{ instanceId: 'mushroom', artifactId: 'death-cap-mushroom', powerLevel: 251 }])).filter((parameter) => parameter.mechanicId === 'death-cap-mushroom')).toEqual([
      expect.objectContaining({ parameterId: 'duration-curve' }),
    ])
    expect(estimatedParametersForBuild(build())).toEqual([])
  })

  it('allows only explicitly classified statuses and never treats runtime support as evidence', () => {
    expect(isEvidenceStatusAllowed('derived', 'high-confidence-only')).toBe(true)
    expect(isEvidenceStatusAllowed('estimated', 'high-confidence-only')).toBe(false)
    expect(isEvidenceStatusAllowed('estimated', 'include-estimated')).toBe(true)
    expect(isEvidenceStatusAllowed('unknown', 'include-estimated')).toBe(false)
    expect(isEvidenceStatusAllowed('unclassified', 'include-estimated')).toBe(false)
  })

  it('records mechanic and parameter identifiers for every build input', () => {
    expect(parameterEvidenceForBuild(build())).toEqual(expect.arrayContaining([
      expect.objectContaining({ mechanicId: 'melee:double-axe', parameterId: 'attack-timing', status: 'derived' }),
      expect.objectContaining({ mechanicId: 'melee-enchantment:critical-hit', parameterId: 'trigger-chance', status: 'measured' }),
      expect.objectContaining({ mechanicId: 'melee-enchantment:critical-hit', parameterId: 'damage-multiplier', status: 'measured' }),
    ]))
  })

  it('keeps an unre-evaluated runtime parameter unclassified instead of deriving it from support', () => {
    expect(artifactEvidenceAllowed('shock-powder', 'high-confidence-only')).toBe(true)
    expect(parameterEvidenceForBuild(build('critical-hit', [
      { instanceId: 'shock', artifactId: 'shock-powder', powerLevel: 251 },
    ]))).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ mechanicId: 'shock-powder', parameterId: 'stacking-interaction' }),
    ]))
    expect(parameterEvidenceForBuild(build('critical-hit', [
      { instanceId: 'shock-1', artifactId: 'shock-powder', powerLevel: 251 },
      { instanceId: 'shock-2', artifactId: 'shock-powder', powerLevel: 251 },
    ]))).toEqual(expect.arrayContaining([
      expect.objectContaining({ mechanicId: 'shock-powder', parameterId: 'stacking-interaction', status: 'unclassified' }),
    ]))
  })

  it('reports each mechanic parameter once when equipment copies are duplicated', () => {
    const parameters = parameterEvidenceForBuild(build('critical-hit', [
      { instanceId: 'mushroom-1', artifactId: 'death-cap-mushroom', powerLevel: 251 },
      { instanceId: 'mushroom-2', artifactId: 'death-cap-mushroom', powerLevel: 251 },
    ]))
    const keys = parameters.map((parameter) => `${parameter.mechanicId}/${parameter.parameterId}`)
    expect(new Set(keys).size).toBe(keys.length)
    expect(keys).toContain('death-cap-mushroom/duplicate-stacking')
  })

  it('includes non-Artifact estimates in the result disclosure', () => {
    const estimatedBuild = build('guarding-strike')
    expect(estimatedParametersForBuild(estimatedBuild)).toEqual(expect.arrayContaining([
      expect.objectContaining({ mechanicId: 'melee-enchantment:guarding-strike', parameterId: 'activation-coverage-model' }),
    ]))
    const result = optimize({ weapons: [estimatedBuild.weapon], artifacts: [] }, { ...DEFAULT_SCENARIO, evidencePolicy: 'include-estimated' })
    const html = renderToStaticMarkup(createElement(OptimizeResults, { weights: DEFAULT_SCENARIO.weights, error: null, result, status: 'complete', evidencePolicy: 'include-estimated' }))
    expect(html).toContain('ガードストライク / activation coverage')
    expect(html).toContain('melee-enchantment:guarding-strike')
  })
})

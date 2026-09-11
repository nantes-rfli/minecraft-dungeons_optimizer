import { describe, expect, it } from 'vitest'
import { ESTIMATED_PARAMETER_EVIDENCE, isEvidenceStatusAllowed, parameterEvidenceForBuild, estimatedParametersForBuild } from '../src/core/evidenceStatus'
import type { Build } from '../src/core'

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
    const build = { artifacts: [{ instanceId: 'mushroom', artifactId: 'death-cap-mushroom', powerLevel: 251 }] } as Pick<Build, 'artifacts'>
    expect(estimatedParametersForBuild(build).map((parameter) => parameter.mechanicId)).toEqual(['death-cap-mushroom', 'death-cap-mushroom'])
    expect(estimatedParametersForBuild({ artifacts: [] })).toEqual([])
  })

  it('allows only explicitly classified statuses and never treats runtime support as evidence', () => {
    expect(isEvidenceStatusAllowed('derived', 'high-confidence-only')).toBe(true)
    expect(isEvidenceStatusAllowed('estimated', 'high-confidence-only')).toBe(false)
    expect(isEvidenceStatusAllowed('estimated', 'include-estimated')).toBe(true)
    expect(isEvidenceStatusAllowed('unknown', 'include-estimated')).toBe(false)
    expect(isEvidenceStatusAllowed('unclassified', 'include-estimated')).toBe(false)
  })

  it('records mechanic and parameter identifiers for every build input', () => {
    const build = {
      weapon: { instanceId: 'weapon', weaponId: 'double-axe', powerLevel: 251, enchantmentSlots: [{ candidates: ['critical-hit'] }] },
      enchantments: [{ enchantmentId: 'critical-hit', tier: 3, source: 'slot' }], artifacts: [],
    } as Build
    expect(parameterEvidenceForBuild(build)).toEqual(expect.arrayContaining([
      expect.objectContaining({ mechanicId: 'melee:double-axe', parameterId: 'damage-and-attack-profile', status: 'derived' }),
      expect.objectContaining({ mechanicId: 'melee-enchantment:critical-hit', status: 'derived' }),
    ]))
  })
})

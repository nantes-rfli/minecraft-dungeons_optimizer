import { describe, expect, it } from 'vitest'
import { ESTIMATED_PARAMETER_EVIDENCE, estimatedParametersForBuild } from '../src/core/evidenceStatus'
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
})

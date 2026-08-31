import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { evaluate } from '../src/core'
import type { Build } from '../src/core'
import { DEFAULT_SCENARIO } from '../src/data/scenarios'
import { TemporalStateDetails } from '../src/views/TemporalStateDetails'

const build: Build = {
  weapon: { instanceId: 'ui-temporal', weaponId: 'double-axe', powerLevel: 251, observedDamagePerHit: 30, enchantmentSlots: [{ candidates: ['artifact-synergy'] }, { candidates: ['rampaging'] }] },
  enchantments: [{ enchantmentId: 'artifact-synergy', tier: 3, source: 'slot' }, { enchantmentId: 'rampaging', tier: 3, source: 'slot' }],
  artifacts: [{ instanceId: 'amulet', artifactId: 'iron-hide-amulet', powerLevel: 251 }],
}
describe('temporal result details', () => {
  it('shows activation, charged attacks and the converged Rampaging state with limitations', () => {
    const result = evaluate(build, DEFAULT_SCENARIO)
    const markup = renderToStaticMarkup(<TemporalStateDetails evaluation={result} />)
    expect(markup).toContain(`Artifact使用 ${result.temporalState.artifactActivation.totalActivationsPerSecond.toFixed(4)}回/秒`)
    expect(markup).toContain(`強化攻撃 ${result.temporalState.artifactSynergy.chargedAttacksPerSecond.toFixed(4)}/秒`)
    expect(markup).toContain(`固定点 ${result.temporalState.rampaging.iterations}回`)
    expect(markup).toContain(`発動 ${result.temporalState.rampaging.triggerEventsPerSecond.toFixed(4)}/秒`)
    expect(markup).toContain('Committed前')
    expect(markup).toContain('proc撃破は発動源に含めません')
    expect(markup).toContain('low-confidence')
    const noArtifacts = evaluate({ ...build, artifacts: [] }, DEFAULT_SCENARIO)
    expect(renderToStaticMarkup(<TemporalStateDetails evaluation={noArtifacts} />)).toContain('Artifact未装備')
  })
  it('does not show temporal assumptions for unaffected builds', () => {
    const plain: Build = { ...build, weapon: { ...build.weapon, enchantmentSlots: [{ candidates: ['radiance'] }] }, enchantments: [{ enchantmentId: 'radiance', tier: 3, source: 'slot' }] }
    expect(renderToStaticMarkup(<TemporalStateDetails evaluation={evaluate(plain, DEFAULT_SCENARIO)} />)).toBe('')
  })
})
